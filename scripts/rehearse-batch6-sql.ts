import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { Client } from "pg";
import { createDatabaseClient } from "../src/lib/db/client";
import { canonicalJson, seedProblems } from "../prisma/seed-data";
import { seedRoadmaps } from "../prisma/seed-roadmaps";
import { seedVideos } from "../prisma/seed-videos";
import { seedCategoryGroups } from "../prisma/seed-categories";
import { ROADMAPS } from "../src/data/seeds/roadmaps";
import { VIDEOS } from "../src/data/seeds/videos";
import { problemBatchSchema } from "../src/lib/validators/problem";
import { loadProblems } from "./lib/load-problems";
import { generateBatch6Sql, OLD_SOURCE, type Batch6Baseline } from "./generate-batch6-sql";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
// Explicit local-only rehearsal. Never reads a production connection or env file.
export async function rehearseBatch6(connectionString: string) {
  const address = new URL(connectionString);
  if (address.hostname !== "127.0.0.1" || address.port !== "57003" || address.pathname !== "/algosprint_batch6_seed_20261019_test") throw new Error("Requires the owned, disposable local rehearsal database.");
  const c = new Client({ connectionString }); await c.connect(); const db = createDatabaseClient(connectionString);
  const evidence: { scenario: string; result: string; elapsedMs: number }[] = [];
  async function scenario(name: string, action: () => Promise<void>) { const at = Date.now(); await action(); evidence.push({ scenario: name, result: "PASS", elapsedMs: Date.now() - at }); console.log(`PASS ${name}`); }
  try {
    assert.equal((await c.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='app'")).rows[0].n, 0, "Fresh empty owned database required");
    for (const migration of (await readdir("prisma/migrations")).sort()) if (migration !== "migration_lock.toml") await c.query(await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8"));
    const version = (await c.query("SELECT version() version")).rows[0].version as string; assert.match(version, /^PostgreSQL 17\.11 /);
    const paths = execFileSync("git", ["ls-tree", "-r", "--name-only", OLD_SOURCE, "src/data/seeds/problems"], { encoding: "utf8" }).trim().split("\n").filter((file) => file.endsWith(".json"));
    const original = problemBatchSchema.parse(paths.map((file) => JSON.parse(execFileSync("git", ["show", `${OLD_SOURCE}:${file}`], { encoding: "utf8" }))));
    const current = await loadProblems(); const oldSlugs = new Set(original.map((problem) => problem.slug)); const additions = current.filter((problem) => !oldSlugs.has(problem.slug));
    assert.deepEqual(await seedProblems(db, original), { created: 100, skipped: 0 });
    assert.deepEqual(await seedRoadmaps(db, ROADMAPS.filter((roadmap) => roadmap.slug !== "capstone-mix-2")), { created: 18, skipped: 0 });
    await seedCategoryGroups(db);
    const oldVideos = VIDEOS.filter((video) => oldSlugs.has(video.problemSlug)); assert.equal(oldVideos.length, 45);
    assert.deepEqual(await seedVideos(db, oldVideos), { created: 45, skipped: 0 }); assert.equal(await db.category.count(), 34);
    const problem = await db.problem.findUniqueOrThrow({ where: { slug: "dock-threshold" } }); const at = new Date("2026-01-01T00:00:00Z");
    await db.user.create({ data: { id: randomUUID(), displayName: "Local rehearsal", progress: { create: { problemId: problem.id, status: "SOLVED", verifiedRevision: 1, verifiedAt: at, solvedAt: at, bookmarked: true, reviewLater: true } },
      submissions: { create: { problemId: problem.id, problemRevision: 1, language: "JAVASCRIPT", mode: "SUBMIT", status: "ACCEPTED", code: "PRIVATE-LOCAL-CODE", result: { private: "LOCAL-OUTPUT" }, passedCount: 1, totalCount: 1, completedAt: at } },
      notes: { create: { problemId: problem.id, content: "PRIVATE-LOCAL-NOTE" } }, interviews: { create: { durationMinutes: 30, status: "IN_PROGRESS", questions: { create: { problemId: problem.id, kind: "CODING", position: 1, prompt: "ORIGINAL-LOCAL-PROMPT", answer: "PRIVATE-LOCAL-ANSWER" } } } } } });
    const tables = (await c.query("SELECT tablename FROM pg_tables WHERE schemaname='app' ORDER BY tablename")).rows.map((row) => row.tablename as string); assert.equal(tables.length, 23);
    async function state() { const result: Record<string, { count: number; sha256: string }> = {}; for (const table of tables) { const rows = (await c.query(`SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) rows FROM app."${table}" t`)).rows[0].rows; result[table] = { count: rows.length, sha256: hash(canonicalJson(rows)) }; } return result; }
    const baseline = (await c.query(`SELECT jsonb_build_object('captured_at',clock_timestamp(),'problems',(SELECT jsonb_agg(jsonb_build_object('id',id,'slug',slug,'seedHash',"seedHash",'status',status,'kind',kind,'revision',revision,'updatedAt',"updatedAt") ORDER BY slug) FROM app."Problem"),'roadmaps',(SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('steps',(SELECT jsonb_agg((to_jsonb(s)-'roadmapId')||jsonb_build_object('slug',p.slug) ORDER BY s.position) FROM app."RoadmapStep" s JOIN app."Problem" p ON p.id=s."problemId" WHERE s."roadmapId"=r.id)) ORDER BY r.slug) FROM app."Roadmap" r)) baseline`)).rows[0].baseline as Batch6Baseline;
    const baselineText = JSON.stringify(baseline, null, 2) + "\n"; const baselinePath = "/tmp/algosprint-batch6-local-baseline-oct19.json"; await writeFile(baselinePath, baselineText, { mode: 0o600 });
    const manifest = await generateBatch6Sql(baselinePath, "/tmp/algosprint-batch6-local-oct19.sql", hash(baselineText)); const sql = await readFile("/tmp/algosprint-batch6-local-oct19.sql", "utf8"); const initial = await state();
    const notices: string[] = []; c.on("notice", (notice) => { if (notice.message?.startsWith("BATCH6_RESULT")) notices.push(notice.message); });
    async function reject(candidate: string, expected: RegExp | string) { const before = await state(); let error: unknown; try { await c.query(candidate); } catch (caught) { error = caught; } finally { await c.query("ROLLBACK"); } assert.ok(error, "Expected SQL to reject"); if (typeof expected === "string") assert.equal((error as { code: string }).code, expected); else assert.match((error as Error).message, expected); assert.deepEqual(await state(), before, "Every existing row and private payload unchanged on failure"); }
    await scenario("production-ID artifact rejects on local UUIDs without writes", async () => { await reject(await readFile("/tmp/algosprint-batch6-problems-ee5f330.sql", "utf8"), /Original problem ID\/hash\/status\/revision\/timestamp drift/); });
    await scenario("first insert adds exactly13 problems +1 HARD path/13 steps and preserves all existing rows", async () => {
      await c.query(sql); assert.match(notices.at(-1)!, /problems_created=13 roadmaps_created=1/);
      assert.equal(await db.problem.count(), 113); assert.equal(await db.roadmap.count(), 19); assert.equal(await db.roadmapStep.count(), 320);
      for (const table of tables) { const rows = (await c.query(`SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) rows FROM app."${table}" t`)).rows[0].rows as unknown[]; assert.ok(rows.length >= initial[table].count); }
      // The SQL itself checks complete preexisting rows of all23 tables, not just these counters.
      const unchanged = await state(); for (const table of ["Category", "Tag", "InterviewStyle", "ProblemVideo", "User", "UserProgress", "UserSubmission", "UserNote", "MockInterview", "MockInterviewQuestion"]) assert.deepEqual(unchanged[table], initial[table]);
      const path = await db.roadmap.findUniqueOrThrow({ where: { slug: "capstone-mix-2" }, include: { steps: { orderBy: { position: "asc" }, include: { problem: { select: { slug: true } } } } } }); assert.equal(path.difficulty, "HARD"); assert.equal(path.estimatedMinutes, 520); assert.deepEqual(path.steps.map((step) => ({ problemSlug: step.problem.slug, title: step.title, description: step.description })), ROADMAPS.find((row) => row.slug === path.slug)!.steps); assert.deepEqual(path.steps.map((step) => step.position), Array.from({ length: 13 }, (_, i) => i + 1));
    });
    await scenario("repeat creates zero rows and changes no IDs/metadata/history", async () => { const before = await state(); await c.query(sql); assert.match(notices.at(-1)!, /problems_created=0 roadmaps_created=0/); assert.deepEqual(await state(), before); });
    await scenario("ordinary full source seed skips113 problems and19 paths without changing any row", async () => { const before = await state(); assert.deepEqual(await seedProblems(db, current), { created: 0, skipped: 113 }); assert.deepEqual(await seedRoadmaps(db, ROADMAPS), { created: 0, skipped: 19 }); assert.deepEqual(await state(), before); });
    await db.roadmap.deleteMany({ where: { slug: "capstone-mix-2" } }); await db.problem.deleteMany({ where: { slug: { in: additions.map((problem) => problem.slug) } } }); assert.deepEqual(await state(), initial);
    await scenario("old hash/status/timestamp/content and roadmap metadata/step drift all abort before writes", async () => {
      const variants = [
        ['UPDATE app."Problem" SET "seedHash"=NULL WHERE id=$1', problem.id], ['UPDATE app."Problem" SET status=\'DRAFT\' WHERE id=$1', problem.id], ['UPDATE app."Problem" SET "updatedAt"="updatedAt"+interval \'1 microsecond\' WHERE id=$1', problem.id], ['UPDATE app."ProblemHint" SET content=content||\' drift\' WHERE "problemId"=$1 AND position=1', problem.id], ['UPDATE app."Roadmap" SET title=title||\' drift\' WHERE id=$1', baseline.roadmaps[0].id], ['UPDATE app."RoadmapStep" SET title=title||\' drift\' WHERE id=$1', baseline.roadmaps[0].steps[0].id],
      ];
      for (const [update, id] of variants) { await c.query("BEGIN"); await c.query(update, [id]); const before = await state(); const body = sql.slice(sql.indexOf("SET LOCAL"), sql.lastIndexOf("COMMIT;")); await assert.rejects(c.query(body), /Original problem|Original roadmap/); await c.query("ROLLBACK"); assert.notDeepEqual(before, initial); assert.deepEqual(await state(), initial); }
    });
    await scenario("unknown existing problem fails with no new content", async () => { const extra = await db.problem.create({ data: { slug: "unknown-local", title: "Local unknown", difficulty: "EASY", pattern: "Local", statement: "Local", constraints: [], estimatedMinutes: 1 } }); try { await reject(sql, /Unknown existing problem/); } finally { await db.problem.delete({ where: { id: extra.id } }); } });
    await scenario("last new problem conflict rejects the entire13+1 batch before first insertion", async () => { const desired = additions.at(-1)!; const extra = await db.problem.create({ data: { slug: desired.slug, title: "Local conflicting content", difficulty: "EASY", pattern: "Local", statement: "Local", constraints: [], estimatedMinutes: 1 } }); try { await reject(sql, /New problem conflict/); assert.equal(await db.problem.count(), 101); } finally { await db.problem.delete({ where: { id: extra.id } }); } });
    await scenario("existing capstone conflict rejects all13 problem inserts", async () => { const path = await db.roadmap.create({ data: { slug: "capstone-mix-2", title: "Local conflicting path", description: "Local", difficulty: "HARD", estimatedMinutes: 520 } }); try { await reject(sql, /New roadmap conflict/); assert.equal(await db.problem.count(), 100); } finally { await db.roadmap.delete({ where: { id: path.id } }); } });
    await scenario("forced late failure after two complete problem inserts rolls back every table", async () => { const candidate = sql.replace("-- LOCAL_REHEARSAL_LATE_FAILURE_MARKER", "IF problems_created=2 THEN RAISE EXCEPTION 'Injected late failure after two inserts'; END IF;"); assert.notEqual(candidate, sql); await reject(candidate, /Injected late failure after two inserts/); assert.deepEqual(await state(), initial); });
    await scenario("unexpected insert trigger aborts before writes", async () => { await c.query(`CREATE FUNCTION app.local_batch6_probe() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$; CREATE TRIGGER local_batch6_probe BEFORE INSERT ON app."Problem" FOR EACH ROW EXECUTE FUNCTION app.local_batch6_probe()`); try { await reject(sql, /Unexpected insert trigger/); } finally { await c.query('DROP TRIGGER local_batch6_probe ON app."Problem"; DROP FUNCTION app.local_batch6_probe()'); } });
    await scenario("real lock timeout55P03 rolls back with complete history preserved", async () => { const blocker = new Client({ connectionString }); await blocker.connect(); try { await blocker.query("BEGIN"); await blocker.query('UPDATE app."ProblemHint" SET content=content WHERE "problemId"=$1 AND position=1', [problem.id]); await reject(sql, "55P03"); } finally { await blocker.query("ROLLBACK"); await blocker.end(); } });
    await scenario("top-level statement timeout57014 applies to DO and rolls back", async () => { await reject(sql.replace("statement_timeout='25s'", "statement_timeout='10ms'"), "57014"); });
    assert.deepEqual(await state(), initial);
    const report = { source: manifest.source, database: address.pathname.slice(1), postgresVersion: version, allMigrationsApplied: 7, initialCounts: Object.fromEntries(Object.entries(initial).map(([table, value]) => [table, value.count])), artifactSqlSha256: JSON.parse(await readFile("/tmp/algosprint-batch6-problems-ee5f330.sql.manifest.json", "utf8")).sqlSha256, localSqlSha256: manifest.sqlSha256, notices, evidence, noProductionExecution: true };
    await writeFile("/tmp/algosprint-batch6-local-proof-oct19.json", JSON.stringify(report, null, 2) + "\n", { mode: 0o600 }); console.log(`PASS ${evidence.length} bounded scenarios; ${version}`); return report;
  } finally { await db.$disconnect(); await c.end(); }
}
