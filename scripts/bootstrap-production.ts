// Explicit, one-time job. Never called by the normal build or application.
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import pg from "pg";

export function migrationEnvironment(env: Record<string, string | undefined>, projectRef: string | undefined): NodeJS.ProcessEnv & { DIRECT_URL: string } {
  if (env.VERCEL_ENV !== "production" || !/^[a-z]{20}$/.test(projectRef ?? "")) {
    throw new Error("Bootstrap requires Vercel Production and an explicit project reference.");
  }
  let url;
  try {
    const auth = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    url = new URL(env.DATABASE_URL ?? "");
    if (auth.origin !== `https://${projectRef}.supabase.co` ||
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) ||
      decodeURIComponent(url.username) !== `postgres.${projectRef}` ||
      !url.password || /^(?:\[YOUR-PASSWORD\]|YOUR-PASSWORD|YOUR_ENCODED_PASSWORD)$/i.test(decodeURIComponent(url.password)) ||
      url.pathname !== "/postgres" || url.port !== "6543" || url.hash ||
      url.searchParams.getAll("sslmode").length !== 1 ||
      url.searchParams.get("sslmode") !== "verify-full" ||
      [...url.searchParams.keys()].some((key) => key !== "sslmode" && key !== "schema") ||
      (url.searchParams.has("schema") && url.searchParams.get("schema") !== "app") ||
      env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new Error();
  } catch { throw new Error("Bootstrap target or verified-TLS database configuration is invalid. Values withheld."); }
  // Supabase shared pooler: the same host/user on 5432 provides session mode.
  // Prisma migrations must not run through transaction mode on 6543.
  url.port = "5432";
  url.searchParams.set("schema", "app");
  return { ...env, NODE_ENV: "production", DIRECT_URL: url.toString() };
}

export async function bootstrap(env: Record<string, string | undefined>, projectRef: string | undefined) {
  const jobEnv = migrationEnvironment(env, projectRef);
  const run = (script: string) => {
    console.log(`Bootstrap: ${script}`);
    const result = spawnSync("npm", ["run", script], {
      env: jobEnv, encoding: "utf8", timeout: 180_000, maxBuffer: 4 * 1024 * 1024,
    });
    // CLI/database errors can contain credentials or connection URLs.
    if (result.status !== 0) throw new Error(`Bootstrap stage ${script} failed; output withheld.`);
  };
  run("deploy:check");
  run("db:generate");
  run("db:validate");
  run("seed:validate");
  const db = new pg.Client({ connectionString: jobEnv.DIRECT_URL, connectionTimeoutMillis: 15_000, query_timeout: 15_000 });
  try {
    await db.connect();
    const lock = await db.query("SELECT pg_try_advisory_lock(7061, 1601) AS locked");
    if (!lock.rows[0].locked) throw new Error("Another bootstrap is running.");
    const existing = await db.query("SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' LIMIT 1");
    if (existing.rowCount) throw new Error("App schema already contains objects. Bootstrap refuses to migrate or reseed an existing database.");
    run("db:deploy");
    run("db:seed");
    const result = await db.query(`SELECT
      (SELECT count(*)::int FROM app."Problem" WHERE status='PUBLISHED') AS problems,
      (SELECT count(*)::int FROM app."Roadmap" WHERE status='PUBLISHED') AS roadmaps`);
    if (!result.rows[0].problems || !result.rows[0].roadmaps) throw new Error("Published seed content verification failed.");
    console.log("Bootstrap verified:", JSON.stringify(result.rows[0]));
  } finally { await db.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await bootstrap(process.env, process.argv[2]); }
  catch (error) {
    // Never print arbitrary pg errors, stack traces, or connection strings.
    const message = error instanceof Error && /^(Bootstrap|Another bootstrap|App schema|Published seed)/.test(error.message)
      ? error.message : "Bootstrap connection/query failed; credentials and server diagnostics withheld.";
    console.error(message);
    process.exitCode = 1;
  }
}
