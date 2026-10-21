import { afterAll, beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import { loadPythonStarters, seedLanguageStarters } from "../../prisma/seed-language-starters";
import { seedPythonSolutions } from "../../prisma/seed-python-solutions";
import { loadPythonSolutions, selectPythonSolutions } from "../../scripts/lib/python-solutions";
import type { ProblemSeed } from "@/lib/validators/problem";
import { Client } from "pg";
import { pythonSolutionRolloutSql } from "../../scripts/lib/python-solution-rollout";
import { queryProblem } from "@/features/problems/detail-query";

let db: ReturnType<typeof createDatabaseClient>;
let problems: ProblemSeed[] = [];
let ownsFixtures = false;
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use a dedicated TEST_DATABASE_URL ending in _test");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Integration tests require an empty problem collection");
  problems = await loadProblems(); ownsFixtures = true;
  await seedProblems(db, problems);
  await seedLanguageStarters(db, await loadPythonStarters());
}, 60_000);
afterAll(async () => {
  if (db && ownsFixtures) await db.problem.deleteMany({ where: { slug: { in: problems.map((problem) => problem.slug) } } });
  await db?.$disconnect();
});
const problemRows = () => db.problem.findMany({ orderBy: { slug: "asc" } });
const solutionRows = () => db.problemSolution.findMany({ where: { language: "PYTHON" }, orderBy: [{ problemId: "asc" }, { kind: "asc" }],
  include: { steps: { orderBy: { position: "asc" } } } });

it("adds a canary then the complete editorial set, preserves original rows and is idempotent", async () => {
  const entries = await loadPythonSolutions();
  const before = await problemRows();
  const javascript = await db.problemSolution.findMany({ where: { language: "JAVASCRIPT" }, orderBy: { id: "asc" }, include: { steps: true } });
  const starters = await db.starterCode.findMany({ orderBy: { id: "asc" } });
  expect(await seedPythonSolutions(db, selectPythonSolutions(entries, ["relay-window"]))).toEqual({ created: 2, skipped: 0 });
  expect(await seedPythonSolutions(db, entries)).toEqual({ created: entries.length - 2, skipped: 2 });
  const all = await solutionRows();
  expect(all).toHaveLength(entries.length);
  expect(await seedPythonSolutions(db, entries)).toEqual({ created: 0, skipped: entries.length });
  expect(await solutionRows()).toEqual(all);
  const detail = await queryProblem(db, "relay-window", null);
  expect(detail?.solutions.filter((solution) => solution.language === "PYTHON")).toHaveLength(2);
  expect(detail?.solutions.filter((solution) => solution.language === "JAVASCRIPT")).toHaveLength(2);
  expect(detail?.solutions.find((solution) => solution.language === "PYTHON" && solution.kind === "OPTIMAL")?.code).toContain("def relay_window(loads, width):");
  expect(await problemRows()).toEqual(before);
  expect(await db.starterCode.findMany({ orderBy: { id: "asc" } })).toEqual(starters);
  expect(await db.problemSolution.findMany({ where: { language: "JAVASCRIPT" }, orderBy: { id: "asc" }, include: { steps: true } })).toEqual(javascript);
  // A later ordinary seed must recognize the unchanged content hashes and retain the add-on.
  expect(await seedProblems(db, problems)).toEqual({ created: 0, skipped: problems.length });
  expect(await solutionRows()).toEqual(all);
}, 60_000);

it("rehearses guarded production SQL for canary, full rollout, repeat and conflict rollback", async () => {
  const entries = await loadPythonSolutions();
  await db.problemSolution.deleteMany({ where: { language: "PYTHON" } });
  const [row] = await db.$queryRaw<{ baseline: string }[]>`SELECT md5(string_agg(id::text || ':' || revision::text || ':' || coalesce("seedHash",''),',' ORDER BY id)) AS baseline FROM app."Problem"`;
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  async function apply(sql: string) {
    try { return await client.query(sql); }
    catch (error) { await client.query("ROLLBACK"); throw error; }
  }
  try {
    const before = await problemRows();
    const starters = await db.starterCode.findMany({ orderBy: { id: "asc" } });
    const js = await db.problemSolution.findMany({ where: { language: "JAVASCRIPT" }, orderBy: { id: "asc" }, include: { steps: true } });
    await apply(pythonSolutionRolloutSql(selectPythonSolutions(entries, ["relay-window"]), row.baseline));
    expect(await db.problemSolution.count({ where: { language: "PYTHON" } })).toBe(2);
    const sql = pythonSolutionRolloutSql(entries, row.baseline);
    await apply(sql);
    const all = await solutionRows();
    expect(all).toHaveLength(entries.length);
    await apply(sql);
    expect(await solutionRows()).toEqual(all);
    expect(await problemRows()).toEqual(before);
    expect(await db.starterCode.findMany({ orderBy: { id: "asc" } })).toEqual(starters);
    expect(await db.problemSolution.findMany({ where: { language: "JAVASCRIPT" }, orderBy: { id: "asc" }, include: { steps: true } })).toEqual(js);
    const missing = all.find((solution) => solution.problemId !== all[0].problemId)!;
    await db.problemSolution.delete({ where: { id: missing.id } });
    await db.problemSolution.update({ where: { id: all[0].id }, data: { title: "Conflicting editorial" } });
    const conflict = await solutionRows();
    await expect(apply(sql)).rejects.toThrow("Existing Python editorial differs");
    expect(await solutionRows()).toEqual(conflict);
    await db.problemSolution.update({ where: { id: all[0].id }, data: { title: all[0].title } });
    await apply(sql);
    const current = await solutionRows();
    await expect(apply(pythonSolutionRolloutSql(entries, "0".repeat(32)))).rejects.toThrow("drift");
    const invalid = [{ ...entries[0], seedHash: "0".repeat(64) }, ...entries.slice(1)];
    await expect(apply(pythonSolutionRolloutSql(invalid, row.baseline))).rejects.toThrow("contract differs");
    expect(await solutionRows()).toEqual(current);
  } finally { await client.end(); }
}, 60_000);

it("rejects a conflicting existing solution before inserting any missing approach", async () => {
  const entries = await loadPythonSolutions();
  const missing = await db.problemSolution.findFirstOrThrow({ where: { language: "PYTHON", problem: { slug: "quiet-badge" } } });
  await db.problemSolution.delete({ where: { id: missing.id } });
  const conflict = await db.problemSolution.findFirstOrThrow({ where: { language: "PYTHON", problem: { slug: "relay-window" } } });
  await db.problemSolution.update({ where: { id: conflict.id }, data: { code: "def relay_window(loads, width):\n    return 0" } });
  const before = await solutionRows();
  await expect(seedPythonSolutions(db, entries)).rejects.toThrow("Python solution conflict");
  expect(await solutionRows()).toEqual(before);
});

it("rejects problem content drift, absent starters and invalid input without partial publication", async () => {
  const entries = selectPythonSolutions(await loadPythonSolutions(), ["dock-threshold"]);
  const before = await solutionRows();
  await expect(seedPythonSolutions(db, [{ ...entries[0], seedHash: "0".repeat(64) }])).rejects.toThrow("problem conflict");
  const starter = await db.starterCode.findFirstOrThrow({ where: { language: "PYTHON", problem: { slug: "dock-threshold" } } });
  await db.starterCode.delete({ where: { id: starter.id } });
  await expect(seedPythonSolutions(db, entries)).rejects.toThrow("starter missing");
  await db.starterCode.create({ data: starter });
  await db.starterCode.update({ where: { id: starter.id }, data: { entryPoint: "wrong_entry" } });
  await expect(seedPythonSolutions(db, entries)).rejects.toThrow("starter missing or mismatched");
  await db.starterCode.update({ where: { id: starter.id }, data: { entryPoint: starter.entryPoint } });
  await expect(seedPythonSolutions(db, [{ ...entries[0], unexpected: true }])).rejects.toThrow();
  expect(await solutionRows()).toEqual(before);
});
