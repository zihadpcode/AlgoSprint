import { execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { beforeAll, beforeEach, afterAll, expect, it } from "vitest";
import { Client } from "pg";
import { createDatabaseClient } from "@/lib/db/client";
import { problemBatchSchema, type ProblemSeed } from "@/lib/validators/problem";
import { canonicalJson, seedProblems } from "../../prisma/seed-data";
import { seedRoadmaps } from "../../prisma/seed-roadmaps";
import { seedVideos } from "../../prisma/seed-videos";
import { reconciliationRelations } from "../fixtures/content-reconciliation-relations";
import { captureContentBaseline, reconcileContent, loadContentPlan, CONTENT_OLD_REF, CONTENT_NEW_REF, type ContentBaseline } from "../../scripts/lib/reconcile-content";

let db: ReturnType<typeof createDatabaseClient>; let client: Client; let baseline: ContentBaseline;
let old: ProblemSeed[]; let corrected: ProblemSeed[]; let owns = false;
const userId = randomUUID();
function source(ref: string) {
  const paths = execFileSync("git", ["ls-tree", "-r", "--name-only", ref, "src/data/seeds/problems"], { encoding: "utf8" }).trim().split("\n").filter((path) => path.endsWith(".json"));
  return problemBatchSchema.parse(paths.map((path) => JSON.parse(execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8" }))));
}
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use a dedicated disposable TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url); client = new Client({ connectionString: url }); await client.connect();
  if (await db.problem.count() || await db.user.count()) throw new Error("Content reconciliation tests require an empty collection.");
  owns = true; old = source(CONTENT_OLD_REF); corrected = source(CONTENT_NEW_REF);
  const relations = reconciliationRelations(new Set(old.filter((problem) => problem.status === "PUBLISHED").map((problem) => problem.slug)));
  await seedProblems(db, old); await seedRoadmaps(db, relations.roadmaps); await seedVideos(db, relations.videos);
  const problem = await db.problem.findUniqueOrThrow({ where: { slug: "dock-threshold" } }); const at = new Date("2026-01-01T00:00:00Z");
  await db.starterCode.create({ data: { problemId: problem.id, language: "PYTHON", entryPoint: "dock_threshold", code: "def dock_threshold(capacities, load):\n    pass" } });
  await db.user.create({ data: { id: userId, progress: { create: { problemId: problem.id, status: "SOLVED", verifiedRevision: problem.revision, verifiedAt: at, solvedAt: at, bookmarked: true, reviewLater: true } },
    submissions: { create: { problemId: problem.id, problemRevision: problem.revision, language: "JAVASCRIPT", mode: "SUBMIT", status: "ACCEPTED", passedCount: 1, totalCount: 1, code: "PRIVATE-LOCAL-SOURCE", result: { private: "LOCAL-DETAILS" }, completedAt: at } },
    notes: { create: { problemId: problem.id, content: "PRIVATE-LOCAL-NOTE" } },
    interviews: { create: { durationMinutes: 30, status: "IN_PROGRESS", questions: { create: { problemId: problem.id, kind: "CODING", position: 1, prompt: "ORIGINAL-INTERVIEW-SNAPSHOT", answer: "PRIVATE-LOCAL-ANSWER" } } } } } });
  baseline = await captureContentBaseline(client, { "dock-threshold": ["PYTHON"] });
}, 30_000);
const equal = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
async function appState() {
  const result: Record<string, string> = {};
  const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='app' ORDER BY tablename")).rows;
  for (const { tablename } of tables) {
    if (!/^[A-Za-z]+$/.test(tablename)) throw new Error("Unexpected table name");
    const rows = (await client.query(`SELECT to_jsonb(t) AS row FROM app."${tablename}" t ORDER BY to_jsonb(t)::text`)).rows.map((row) => row.row);
    result[tablename] = createHash("sha256").update(canonicalJson(rows)).digest("hex");
  }
  return result;
}
// Test fixture restoration only. The production candidate itself never inserts
// or deletes content rows and writes only keyed changed fields.
async function restore() {
  for (const table of ["Problem", "ProblemHint", "ProblemSolution", "SolutionStep"] as const) {
    const current = (await client.query(`SELECT to_jsonb(t) AS row FROM app."${table}" t`)).rows.map((value) => value.row);
    for (const row of current) if (!baseline.content[table].some((before) => before.id === row.id)) await client.query(`DELETE FROM app."${table}" WHERE id=$1::uuid`, [row.id]);
    for (const row of baseline.content[table]) {
      const actual = current.find((value) => value.id === row.id); if (equal(actual, row)) continue;
      if (!actual) await client.query(`INSERT INTO app."${table}" SELECT * FROM jsonb_populate_record(NULL::app."${table}", $1::jsonb)`, [JSON.stringify(row)]);
      else {
        const columns = Object.keys(row).map((key) => `"${key}"`).join(",");
        await client.query(`UPDATE app."${table}" SET (${columns})=(SELECT ${columns} FROM jsonb_populate_record(NULL::app."${table}", $1::jsonb)) WHERE id=$2::uuid`, [JSON.stringify(row), row.id]);
      }
    }
  }
}
beforeEach(async () => { await restore(); }, 30_000);
afterAll(async () => {
  if (db && owns) { await db.user.deleteMany({ where: { id: userId } }); await db.roadmap.deleteMany(); await db.problem.deleteMany(); }
  await db?.$disconnect(); await client?.end();
});
it("updates exactly24 existing revisions once and repeats without changing any row or timestamp", async () => {
  const history = await db.userProgress.findMany(); const attempt = await db.userSubmission.findMany(); const interviews = await db.mockInterviewQuestion.findMany();
  const ids = await client.query('SELECT id FROM app."ProblemHint" UNION ALL SELECT id FROM app."ProblemSolution" UNION ALL SELECT id FROM app."SolutionStep" ORDER BY id');
  expect(await reconcileContent(client, baseline)).toMatchObject({ applied: 24, skipped: 0 });
  for (const pair of loadContentPlan()) {
    const row = await db.problem.findUniqueOrThrow({ where: { slug: pair.old.slug } });
    expect(row.seedHash).toBe(pair.newHash); expect(row.revision).toBe(Number(baseline.content.Problem.find((old) => old.slug === pair.old.slug)!.revision) + 1);
  }
  expect((await client.query('SELECT id FROM app."ProblemHint" UNION ALL SELECT id FROM app."ProblemSolution" UNION ALL SELECT id FROM app."SolutionStep" ORDER BY id')).rows).toEqual(ids.rows);
  expect(await db.userProgress.findMany()).toEqual(history); expect(await db.userSubmission.findMany()).toEqual(attempt); expect(await db.mockInterviewQuestion.findMany()).toEqual(interviews);
  const before = await appState(); expect(await reconcileContent(client, baseline)).toEqual({ applied: 0, skipped: 24, changedRows: 0 }); expect(await appState()).toEqual(before);
  // Corrected source seeding must skip, with all added starters/videos/history intact.
  expect(await seedProblems(db, corrected)).toEqual({ created: 0, skipped: 100 }); expect(await appState()).toEqual(before);
}, 30_000);
it("accepts a deliberate mixture of recognized old and new target states", async () => {
  await reconcileContent(client, baseline);
  const keep = await client.query('SELECT to_jsonb(p) AS row FROM app."Problem" p WHERE slug=$1', ["task-order"]);
  const keepSolutions = await client.query('SELECT to_jsonb(s) AS row FROM app."ProblemSolution" s JOIN app."Problem" p ON p.id=s."problemId" WHERE p.slug=$1', ["task-order"]);
  await restore();
  for (const [table, rows] of [["Problem", keep.rows], ["ProblemSolution", keepSolutions.rows]] as const) for (const { row } of rows) {
    const columns = Object.keys(row).map((key) => `"${key}"`).join(",");
    await client.query(`UPDATE app."${table}" SET (${columns})=(SELECT ${columns} FROM jsonb_populate_record(NULL::app."${table}",$1::jsonb)) WHERE id=$2::uuid`, [JSON.stringify(row), row.id]);
  }
  expect(await reconcileContent(client, baseline)).toMatchObject({ applied: 23, skipped: 1 });
}, 30_000);
it("rejects old hash, content, status, revision, timestamp and child-ID-shape drift before any correction", async () => {
  const p = baseline.content.Problem.find((row) => row.slug === "dock-threshold")!;
  const cases = [
    ['UPDATE app."Problem" SET "seedHash"=NULL WHERE id=$1', p.id],
    ['UPDATE app."Problem" SET title=title||\' drift\' WHERE id=$1', p.id],
    ['UPDATE app."Problem" SET status=\'DRAFT\' WHERE id=$1', p.id],
    ['UPDATE app."Problem" SET revision=revision+1 WHERE id=$1', p.id],
    ['UPDATE app."Problem" SET "updatedAt"="updatedAt"+interval \'1 microsecond\' WHERE id=$1', p.id],
    ['UPDATE app."ProblemHint" SET id=gen_random_uuid() WHERE "problemId"=$1 AND position=1', p.id],
  ];
  for (const [sql, id] of cases) {
    await restore(); await client.query(sql as string, [id]); const before = await appState();
    await expect(reconcileContent(client, baseline)).rejects.toThrow(/metadata state|content or child-ID shape drift/); expect(await appState()).toEqual(before);
  }
}, 30_000);
it("rejects mutated past, microsecond-earlier and future job timestamps or invalid recorded revisions", async () => {
  const before = await appState();
  const ids = loadContentPlan().map((pair) => baseline.content.Problem.find((row) => row.slug === pair.old.slug)!.id);
  const earlier = (await client.query<{ stamp: string }>('SELECT to_jsonb(max(GREATEST("createdAt", "updatedAt"))-interval \'1 microsecond\') AS stamp FROM app."Problem" WHERE id=ANY($1::uuid[])', [ids])).rows[0].stamp;
  for (const appliedAt of ["2000-01-01T00:00:00Z", earlier, "2999-01-01T00:00:00Z"]) {
    await expect(reconcileContent(client, { ...baseline, appliedAt })).rejects.toThrow("job timestamp");
    expect(await appState()).toEqual(before);
  }
  const invalid = structuredClone(baseline);
  invalid.content.Problem.find((row) => row.id === ids[0])!.revision = 0;
  await expect(reconcileContent(client, invalid)).rejects.toThrow("old content/revision");
  expect(await appState()).toEqual(before);
}, 30_000);
it("rolls back real earlier updates when a later keyed old-value conflict is injected", async () => {
  const before = await appState(); const original = client.query.bind(client); let updates = 0; let injected = false;
  const proxy = Object.create(client) as Client;
  proxy.query = (async (sql: string, values?: unknown[]) => {
    if (/^UPDATE app\./.test(sql) && ++updates === 4) {
      const table = /UPDATE app\."([A-Za-z]+)"/.exec(sql)![1];
      const id = values![values!.length - 2];
      const column = table === "Problem" ? "title" : table === "ProblemSolution" ? "intuition" : "content";
      await original(`UPDATE app."${table}" SET "${column}"="${column}"||' injected late conflict' WHERE id=$1::uuid`, [id]); injected = true;
    }
    return original(sql, values);
  }) as Client["query"];
  await expect(reconcileContent(proxy, baseline)).rejects.toThrow("late keyed old-value conflict");
  expect(updates).toBeGreaterThanOrEqual(4); expect(injected).toBe(true); expect(await appState()).toEqual(before);
}, 30_000);
it("respects existing parent runner locks and administrator advisory order without partial writes", async () => {
  const connection = process.env.TEST_DATABASE_URL!; const blocker = new Client({ connectionString: connection }); await blocker.connect();
  try {
    for (const sql of ['SELECT id FROM app."Problem" WHERE slug=\'dock-threshold\' FOR SHARE', "SELECT pg_advisory_xact_lock(713013::bigint)"]) {
      await blocker.query("BEGIN"); await blocker.query(sql); const before = await appState();
      try { await expect(reconcileContent(client, baseline)).rejects.toMatchObject({ code: "55P03" }); expect(await appState()).toEqual(before); }
      finally { await blocker.query("ROLLBACK"); }
    }
  } finally { await blocker.end(); }
}, 30_000);
