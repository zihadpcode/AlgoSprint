// Pure, redacted checks: do not log values, open sockets or mutate databases.
export function deploymentIssues(env: Record<string, string | undefined>, migrations = false): string[] {
  const issues: string[] = [];
  const httpsOrigin = (name: string) => {
    try {
      const u = new URL(env[name] ?? "");
      if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || u.pathname !== "/" || ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)) throw new Error();
    } catch { issues.push(`${name}: set a public HTTPS origin without credentials, path, query or fragment.`); }
  };
  httpsOrigin("APP_URL"); httpsOrigin("NEXT_PUBLIC_SUPABASE_URL");
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "") || (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.length ?? 0) < 25) issues.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: set the project's publishable key, never a secret/service-role key.");
  for (const name of ["DATABASE_URL", ...(migrations ? ["DIRECT_URL"] : [])]) {
    try {
      const u = new URL(env[name] ?? "");
      if (!["postgres:", "postgresql:"].includes(u.protocol) || !u.hostname || !u.username || !u.password || u.pathname.length < 2 || u.searchParams.getAll("sslmode").length !== 1 || u.searchParams.get("sslmode") !== "verify-full") throw new Error();
    } catch { issues.push(`${name}: use a PostgreSQL URL with database credentials and sslmode=verify-full.`); }
  }
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === "0" || env.PGSSLMODE === "disable" || env.PGSSLMODE === "no-verify") issues.push("TLS verification must remain enabled.");
  if (Object.keys(env).some((name) => name.startsWith("NEXT_PUBLIC_") && /SECRET|PASSWORD|TOKEN|DATABASE|PRIVATE|SERVICE_ROLE|API_KEY/.test(name) && env[name])) issues.push("Potential private credential in a NEXT_PUBLIC_ setting: remove it from browser-exposed configuration.");
  if (env.CODE_RUNNER_ENABLED && !["true", "false"].includes(env.CODE_RUNNER_ENABLED)) issues.push("CODE_RUNNER_ENABLED: use exactly true or false.");
  if (env.CODE_RUNNER_PROVIDER && !["judge0", "sandbox"].includes(env.CODE_RUNNER_PROVIDER)) issues.push("CODE_RUNNER_PROVIDER: use judge0 or sandbox.");
  if (env.CODE_RUNNER_ENABLED === "true" && (env.CODE_RUNNER_PROVIDER ?? "judge0") === "judge0") {
    httpsOrigin("JUDGE0_API_URL");
    if (!/^[\x21-\x7e]{1,512}$/.test(env.JUDGE0_API_KEY ?? "")) issues.push("JUDGE0_API_KEY: set the private provider key.");
    if (env.JUDGE0_AUTH_MODE && !["token", "rapidapi"].includes(env.JUDGE0_AUTH_MODE)) issues.push("JUDGE0_AUTH_MODE: use token or rapidapi.");
    const id = Number(env.JUDGE0_JAVASCRIPT_LANGUAGE_ID);
    if (!Number.isInteger(id) || id < 1 || id > 10000) issues.push("JUDGE0_JAVASCRIPT_LANGUAGE_ID: use your provider's verified JavaScript language ID.");
  }
  return issues;
}
