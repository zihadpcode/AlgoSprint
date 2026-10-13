import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/lib/db/client";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import { loadPythonStarters, seedLanguageStarters } from "../../prisma/seed-language-starters";
import type { ProblemSeed } from "@/lib/validators/problem";

let db: ReturnType<typeof createDatabaseClient>;
let problems: ProblemSeed[];
let ownsFixtures = false;
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use TEST_DATABASE_URL pointing to a dedicated database ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Integration tests require an empty problem collection in the dedicated test database.");
  problems = await loadProblems(); ownsFixtures = true;
  await seedProblems(db, problems);
}, 30_000);
afterAll(async () => {
  if (db && ownsFixtures) await db.problem.deleteMany({ where: { slug: { in: problems.map((p) => p.slug) } } });
  await db?.$disconnect();
});
const snapshot = () => db.problem.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true, seedHash: true, updatedAt: true, revision: true } });
const python = () => db.starterCode.findMany({ where: { language: "PYTHON" }, orderBy: { problem: { slug: "asc" } }, select: { entryPoint: true, code: true, problem: { select: { slug: true } } } });

describe("Python starter add-on layer", () => {
  it("inserts a Python starter for every existing problem without touching problem rows, then is idempotent", async () => {
    const entries = await loadPythonStarters();
    const before = await snapshot();
    expect(await seedLanguageStarters(db, entries)).toEqual({ created: problems.length, skipped: 0, missingProblems: 0 });
    expect(await snapshot()).toEqual(before);
    const rows = await python();
    expect(rows).toHaveLength(problems.length);
    expect(rows.find((r) => r.problem.slug === "relay-window")).toMatchObject({ entryPoint: "relay_window", code: expect.stringContaining("def relay_window(loads, width):") });
    expect(await db.starterCode.count({ where: { language: "JAVASCRIPT" } })).toBe(problems.length);
    expect(await seedLanguageStarters(db, entries)).toEqual({ created: 0, skipped: problems.length, missingProblems: 0 });
    expect(await python()).toEqual(rows);
  });
  it("fills only the missing rows and ignores entries for problems that do not exist", async () => {
    const entries = await loadPythonStarters();
    await db.starterCode.deleteMany({ where: { language: "PYTHON", problem: { slug: { in: ["relay-window", "quiet-badge"] } } } });
    const result = await seedLanguageStarters(db, [...entries, { ...entries[0], slug: "not-seeded-yet" }]);
    expect(result).toEqual({ created: 2, skipped: problems.length - 2, missingProblems: 1 });
    expect(await python()).toHaveLength(problems.length);
  });
  it("throws a conflict and writes nothing when an existing row differs", async () => {
    const entries = await loadPythonStarters();
    await db.starterCode.deleteMany({ where: { language: "PYTHON", problem: { slug: "quiet-badge" } } });
    await db.starterCode.update({ where: { problemId_language: { problemId: (await db.problem.findUniqueOrThrow({ where: { slug: "relay-window" } })).id, language: "PYTHON" } },
      data: { code: "def relay_window(loads, width):\n    return 0" } });
    const before = await python();
    await expect(seedLanguageStarters(db, entries)).rejects.toThrow("Starter conflict for relay-window");
    // quiet-badge was missing and sorts after relay-window in the file's order; it must still not have been inserted.
    expect(await python()).toEqual(before);
    expect(await db.starterCode.count({ where: { language: "PYTHON", problem: { slug: "quiet-badge" } } })).toBe(0);
  });
  it("validates entries before touching the database", async () => {
    const entries = await loadPythonStarters();
    await expect(seedLanguageStarters(db, [{ ...entries[0], entryPoint: "def" }])).rejects.toThrow();
    await expect(seedLanguageStarters(db, [{ ...entries[0], language: "JAVA" }])).rejects.toThrow();
  });
});
