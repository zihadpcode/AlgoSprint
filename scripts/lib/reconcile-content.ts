import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import type { Client } from "pg";
import { problemBatchSchema, type ProblemSeed } from "../../src/lib/validators/problem";
import { canonicalJson, problemHash } from "../../prisma/seed-data";

export const CONTENT_OLD_REF = "1bacb2f947de89e92cb4fc08604132c1b78090e0";
export const CONTENT_NEW_REF = "03c3ac9936a4b5ada88a53888d5bb09475f38cca";
type Row = Record<string, unknown>;
const PUBLIC_TABLES = ["Problem", "ProblemExample", "ProblemHint", "ProblemSolution", "SolutionStep", "StarterCode", "TestCase", "Category", "Tag", "InterviewStyle", "ProblemCategory", "ProblemTag", "ProblemInterviewStyle", "ProblemRelation", "ProblemVideo", "Roadmap", "RoadmapStep"] as const;
const PRIVATE_TABLES = ["User", "UserProgress", "UserSubmission", "UserNote", "MockInterview", "MockInterviewQuestion"] as const;
type PublicTable = typeof PUBLIC_TABLES[number];
type Content = Record<PublicTable, Row[]>;
type Pair = { path: string; old: ProblemSeed; next: ProblemSeed; oldHash: string; newHash: string };
type Patch = { table: PublicTable; old: Row; next: Row; fields: Record<string, unknown> };
export type ContentBaseline = { oldRef: string; newRef: string; planHash: string; appliedAt: string; allowedExtraStarters: Record<string, string[]>; content: Content };
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const sorted = (rows: Row[]) => [...rows].sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
const fail = (message: string): never => { throw new Error(`Content reconciliation: ${message}`); };
function one(rows: Row[], predicate: (row: Row) => boolean): Row {
  const found = rows.filter(predicate); if (found.length !== 1) fail("missing or duplicate keyed child"); return found[0];
}

// Immutable source objects, never a mutable checkout or a caller-supplied patch.
export function loadContentPlan(): Pair[] {
  const paths = execFileSync("git", ["diff", "--name-only", CONTENT_OLD_REF, CONTENT_NEW_REF, "--", "src/data/seeds/problems"], { encoding: "utf8" }).trim().split("\n");
  if (paths.length !== 24 || paths.some((path) => !/^src\/data\/seeds\/problems\/[a-z/-]+\.json$/.test(path))) fail("unexpected immutable source scope");
  return paths.map((path) => {
    const [old, next] = [CONTENT_OLD_REF, CONTENT_NEW_REF].map((ref) => problemBatchSchema.parse([JSON.parse(execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8" }))])[0]);
    if (old.slug !== next.slug || old.status !== "PUBLISHED" || next.status !== "PUBLISHED" || !same({ ...old, hints: [], solutions: [] }, { ...next, hints: [], solutions: [] })) fail("source changes outside hints/solutions");
    const shape = (problem: ProblemSeed) => ({ hints: problem.hints.map((hint) => hint.position), solutions: problem.solutions.map((solution) => ({ kind: solution.kind, language: solution.language, steps: solution.steps.map((step) => step.position) })) });
    if (!same(shape(old), shape(next))) fail("immutable source child keys changed");
    return { path, old, next, oldHash: problemHash(old), newHash: problemHash(next) };
  });
}
const planHash = (plan: Pair[]) => createHash("sha256").update(canonicalJson(plan)).digest("hex");
async function assertJobTimestamp(db: Client, stamp: string, targets: Row[]) {
  // PostgreSQL retains all six fractional digits; JavaScript Date comparisons
  // would silently discard the final three. Recheck untrusted baseline metadata
  // at execution as well as capture, before any content changes.
  const check = await db.query<{ valid: boolean }>(`SELECT isfinite($1::timestamptz)
    AND $1::timestamptz <= clock_timestamp()
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements($2::jsonb) target
      WHERE (target->>'updatedAt')::timestamptz > $1::timestamptz
         OR (target->>'createdAt')::timestamptz > $1::timestamptz) AS valid`, [stamp, JSON.stringify(targets)]);
  if (!check.rows[0].valid) fail("job timestamp must not precede target creation/update or exceed the database clock");
}
function targetRows(snapshot: Content, plan: Pair[]) {
  return plan.map((pair) => one(snapshot.Problem, (row) => row.slug === pair.old.slug));
}
async function localOnly(db: Client) {
  const row = (await db.query<{ name: string }>("SELECT current_database() AS name")).rows[0];
  if (!row.name.endsWith("_test")) fail("this rehearsal helper requires a disposable database ending in _test");
}
async function begin(db: Client, readOnly = false) {
  await localOnly(db);
  await db.query(`BEGIN ISOLATION LEVEL REPEATABLE READ${readOnly ? " READ ONLY" : ""}`);
  try {
    await db.query("SET LOCAL TIME ZONE 'UTC'");
    await db.query("SET LOCAL lock_timeout='500ms'");
    await db.query("SET LOCAL statement_timeout='5s'");
    await db.query("SET LOCAL idle_in_transaction_session_timeout='5s'");
    await db.query("SET LOCAL transaction_timeout='25s'");
  } catch (error) { await db.query("ROLLBACK"); throw error; }
}
async function content(db: Client): Promise<Content> {
  const output = {} as Content; let bytes = 0;
  for (const table of PUBLIC_TABLES) {
    const rows = (await db.query<{ row: Row }>(`SELECT to_jsonb(t) AS row FROM app."${table}" t LIMIT 50001`)).rows.map((value) => value.row);
    if (rows.length > 50_000) fail("rehearsal snapshot row budget exceeded");
    bytes += Buffer.byteLength(JSON.stringify(rows)); if (bytes > 16_000_000) fail("rehearsal snapshot byte budget exceeded");
    output[table] = sorted(rows);
  }
  return output;
}
// User code, notes, answers and reports never leave PostgreSQL for these guards.
async function privateDigests(db: Client) {
  const result: Record<string, unknown> = {};
  for (const table of PRIVATE_TABLES) result[table] = (await db.query(`SELECT count(*)::int AS count,
    encode(sha256(convert_to(COALESCE(string_agg(hash, '' ORDER BY hash), ''), 'UTF8')), 'hex') AS hash
    FROM (SELECT encode(sha256(convert_to(to_jsonb(t)::text, 'UTF8')), 'hex') AS hash FROM app."${table}" t) hashes`)).rows[0];
  return result;
}
function projection(all: Content, source: ProblemSeed, extras: Record<string, string[]>): ProblemSeed {
  const p = one(all.Problem, (row) => row.slug === source.slug);
  const children = (table: PublicTable) => all[table].filter((row) => row.problemId === p.id);
  const fields = (row: Row, names: string[]) => Object.fromEntries(names.map((name) => [name, row[name]]));
  const positional = (table: PublicTable, names: string[]) => children(table).map((row) => fields(row, names)).sort((a, b) => Number(a.position) - Number(b.position));
  const starterLanguages = new Set(source.starterCode.map((starter) => starter.language));
  const extra = children("StarterCode").filter((row) => !starterLanguages.has(row.language as never));
  if (!same(extra.map((row) => row.language).sort(), [...(extras[source.slug] ?? [])].sort())) fail(`unapproved additional starters for ${source.slug}`);
  const links = (table: PublicTable, foreign: string, lookup: PublicTable) => children(table).map((row) => one(all[lookup], (target) => target.id === row[foreign]).slug).sort();
  const value = { ...fields(p, ["slug", "title", "difficulty", "kind", "status", "pattern", "statement", "constraints", "estimatedMinutes", "timeLimitMs", "memoryLimitKb"]), schemaVersion: 1,
    categories: links("ProblemCategory", "categoryId", "Category"), tags: links("ProblemTag", "tagId", "Tag"), interviewStyles: links("ProblemInterviewStyle", "styleId", "InterviewStyle"),
    relatedSlugs: links("ProblemRelation", "relatedId", "Problem"),
    examples: positional("ProblemExample", ["position", "input", "output", "explanation"]), hints: positional("ProblemHint", ["position", "content"]),
    testCases: positional("TestCase", ["position", "visibility", "input", "output", "explanation"]),
    starterCode: children("StarterCode").filter((row) => starterLanguages.has(row.language as never)).map((row) => fields(row, ["language", "entryPoint", "code"])),
    solutions: children("ProblemSolution").map((row) => ({ ...fields(row, ["kind", "language", "title", "intuition", "approach", "pseudocode", "code", "timeComplexity", "spaceComplexity", "commonMistakes", "interviewExplanation"]),
      steps: all.SolutionStep.filter((step) => step.solutionId === row.id).map((step) => fields(step, ["position", "title", "content"])).sort((a, b) => Number(a.position) - Number(b.position)) })),
  };
  return problemBatchSchema.parse([value])[0];
}
function normalized(seed: ProblemSeed) {
  return { ...seed, categories: [...seed.categories].sort(), tags: [...seed.tags].sort(), interviewStyles: [...seed.interviewStyles].sort(), relatedSlugs: [...seed.relatedSlugs].sort(),
    starterCode: [...seed.starterCode].sort((a, b) => a.language.localeCompare(b.language)), solutions: [...seed.solutions].sort((a, b) => `${a.kind}:${a.language}`.localeCompare(`${b.kind}:${b.language}`)) };
}
export async function captureContentBaseline(db: Client, allowedExtraStarters: Record<string, string[]> = {}): Promise<ContentBaseline> {
  const plan = loadContentPlan(); await begin(db, true);
  try {
    const snapshot = await content(db);
    for (const pair of plan) {
      const p = one(snapshot.Problem, (row) => row.slug === pair.old.slug);
      if (p.seedHash !== pair.oldHash || !Number.isInteger(p.revision) || Number(p.revision) < 1 || !same(normalized(projection(snapshot, pair.old, allowedExtraStarters)), normalized(pair.old))) fail(`old source/hash/shape mismatch for ${pair.old.slug}`);
    }
    const appliedAt = (await db.query<{ stamp: string }>("SELECT to_jsonb(clock_timestamp()) AS stamp")).rows[0].stamp;
    await assertJobTimestamp(db, appliedAt, targetRows(snapshot, plan));
    const baseline = { oldRef: CONTENT_OLD_REF, newRef: CONTENT_NEW_REF, planHash: planHash(plan), appliedAt, allowedExtraStarters, content: snapshot };
    await db.query("COMMIT"); return baseline;
  } catch (error) { await db.query("ROLLBACK"); throw error; }
}
function patchesFor(baseline: ContentBaseline, pair: Pair): Patch[] {
  const all = baseline.content; const problem = one(all.Problem, (row) => row.slug === pair.old.slug); const patches: Patch[] = [];
  const add = (table: PublicTable, row: Row, fields: Record<string, unknown>) => { if (Object.keys(fields).length) patches.push({ table, old: row, next: { ...row, ...fields }, fields }); };
  for (const hint of pair.next.hints) {
    const row = one(all.ProblemHint, (value) => value.problemId === problem.id && value.position === hint.position);
    if (row.content !== hint.content) add("ProblemHint", row, { content: hint.content });
  }
  for (const solution of pair.next.solutions) {
    const row = one(all.ProblemSolution, (value) => value.problemId === problem.id && value.kind === solution.kind && value.language === solution.language);
    const fields: Record<string, unknown> = {};
    for (const key of ["title", "intuition", "approach", "pseudocode", "code", "timeComplexity", "spaceComplexity", "commonMistakes", "interviewExplanation"] as const) if (!same(row[key], solution[key])) fields[key] = solution[key];
    add("ProblemSolution", row, fields);
    for (const step of solution.steps) {
      const target = one(all.SolutionStep, (value) => value.solutionId === row.id && value.position === step.position);
      const changes: Record<string, unknown> = {}; for (const key of ["title", "content"] as const) if (target[key] !== step[key]) changes[key] = step[key];
      add("SolutionStep", target, changes);
    }
  }
  add("Problem", problem, { revision: Number(problem.revision) + 1, seedHash: pair.newHash, updatedAt: baseline.appliedAt });
  return patches;
}
function withPatches(content: Content, patches: Patch[]): Content {
  const result = structuredClone(content);
  for (const patch of patches) { const index = result[patch.table].findIndex((row) => row.id === patch.old.id); if (index < 0) fail("missing patch ID"); result[patch.table][index] = patch.next; }
  for (const table of PUBLIC_TABLES) result[table] = sorted(result[table]);
  return result;
}
export async function reconcileContent(db: Client, baseline: ContentBaseline) {
  const plan = loadContentPlan();
  if (baseline.oldRef !== CONTENT_OLD_REF || baseline.newRef !== CONTENT_NEW_REF || baseline.planHash !== planHash(plan) || !Number.isFinite(Date.parse(baseline.appliedAt))) fail("baseline source identity mismatch");
  // Revalidate the recorded old data too: a caller cannot weaken its source guards.
  for (const pair of plan) {
    const row = one(baseline.content.Problem, (value) => value.slug === pair.old.slug);
    if (!Number.isInteger(row.revision) || Number(row.revision) < 1 || Number(row.revision) >= 2_147_483_647 || row.seedHash !== pair.oldHash || !same(normalized(projection(baseline.content, pair.old, baseline.allowedExtraStarters)), normalized(pair.old))) fail("baseline no longer matches pinned old content/revision");
  }
  const batches = plan.map((pair) => ({ pair, patches: patchesFor(baseline, pair) })).sort((a, b) => String(a.patches.at(-1)!.old.id).localeCompare(String(b.patches.at(-1)!.old.id)));
  await begin(db);
  try {
    await assertJobTimestamp(db, baseline.appliedAt, targetRows(baseline.content, plan));
    await db.query("SELECT pg_advisory_xact_lock(713013::bigint)"); await db.query("SELECT pg_advisory_xact_lock(712012::bigint)");
    const ids = batches.map((batch) => String(batch.patches.at(-1)!.old.id));
    const locked = await db.query('SELECT id FROM app."Problem" WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [ids]);
    if (locked.rowCount !== 24) fail("target IDs changed");
    // Lock the complete existing child shape; new FK children also wait on the
    // strong parent locks. These are fixed identifiers, never SQL from content.
    for (const table of ["ProblemExample", "ProblemHint", "ProblemSolution", "StarterCode", "TestCase", "ProblemCategory", "ProblemTag", "ProblemInterviewStyle", "ProblemRelation", "ProblemVideo"] as const) {
      await db.query(`SELECT * FROM app."${table}" WHERE "problemId"=ANY($1::uuid[]) ORDER BY to_jsonb("${table}")::text FOR UPDATE`, [ids]);
    }
    await db.query('SELECT s.id FROM app."SolutionStep" s JOIN app."ProblemSolution" p ON p.id=s."solutionId" WHERE p."problemId"=ANY($1::uuid[]) ORDER BY s.id FOR UPDATE OF s', [ids]);
    const triggers = await db.query(`SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgrelid=ANY($1::regclass[]) UNION ALL SELECT 1 FROM pg_rewrite WHERE rulename<>'_RETURN' AND ev_class=ANY($1::regclass[])`, [[...new Set(batches.flatMap((batch) => batch.patches.map((patch) => `app."${patch.table}"`)))]]);
    if (triggers.rowCount) fail("unexpected triggers or rules on mutation tables");
    const beforePrivate = await privateDigests(db); const current = await content(db); const pending: typeof batches = []; const applied: Patch[] = [];
    for (const batch of batches) {
      const patch = batch.patches.at(-1)!; const row = one(current.Problem, (value) => value.id === patch.old.id);
      if (same(row, patch.old)) pending.push(batch);
      else if (same(row, patch.next)) applied.push(...batch.patches);
      else fail(`unrecognized old/new metadata state for ${batch.pair.old.slug}`);
    }
    if (!same(current, withPatches(baseline.content, applied))) fail("complete old/new content or child-ID shape drift");
    let changedRows = 0;
    for (const batch of pending) for (const patch of batch.patches) {
      const keys = Object.keys(patch.fields);
      const values = keys.map((key) => patch.fields[key]);
      const update = await db.query(`UPDATE app."${patch.table}" AS t SET ${keys.map((key, index) => `"${key}"=$${index + 1}`).join(", ")} WHERE t.id=$${keys.length + 1}::uuid AND to_jsonb(t)=$${keys.length + 2}::jsonb RETURNING t.id`, [...values, patch.old.id, JSON.stringify(patch.old)]);
      if (update.rowCount !== 1) fail("late keyed old-value conflict"); changedRows++;
    }
    const expected = withPatches(baseline.content, batches.flatMap((batch) => batch.patches)); const after = await content(db);
    if (!same(after, expected) || !same(await privateDigests(db), beforePrivate)) fail("postflight content/history preservation failed");
    for (const pair of plan) if (!same(normalized(projection(after, pair.next, baseline.allowedExtraStarters)), normalized(pair.next))) fail("new complete content mismatch");
    await db.query("COMMIT"); return { applied: pending.length, skipped: batches.length - pending.length, changedRows };
  } catch (error) { await db.query("ROLLBACK"); throw error; }
}
