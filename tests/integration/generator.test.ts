import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/lib/db/client";
import { generateProblems } from "../../scripts/generator/generate";
import { seedProblems } from "../../prisma/seed-data";

let db: ReturnType<typeof createDatabaseClient>;
let ownsFixtures = false;
const problems = generateProblems({ seed: 1401 });
const userId = randomUUID();
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use a dedicated TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Generator integration tests require an empty problem collection.");
  ownsFixtures = true;
});
afterAll(async () => {
  if (db && ownsFixtures) {
    await db.user.deleteMany({ where: { id: userId } });
    await db.problem.deleteMany({ where: { slug: { in: problems.map((p) => p.slug) } } });
  }
  await db?.$disconnect();
});
describe("generated draft seed lifecycle", () => {
  it("seeds the five drafts with complete content and never publishes them automatically", async () => {
    expect(await seedProblems(db, problems)).toEqual({ created: 5, skipped: 0 });
    expect(await db.problem.count({ where: { status: "PUBLISHED" } })).toBe(0);
    expect(await db.problem.count({ where: { status: "DRAFT", publishedAt: null } })).toBe(5);
    expect(await db.problemHint.count()).toBe(25);
    expect(await db.problemSolution.count()).toBe(10);
  });
  it("reruns preserve identifiers and saved learner progress", async () => {
    const before = await db.problem.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true, updatedAt: true } });
    await db.user.create({ data: { id: userId } });
    await db.userProgress.create({ data: { userId, problemId: before[0].id, bookmarked: true } });
    expect(await seedProblems(db, problems)).toEqual({ created: 0, skipped: 5 });
    expect(await db.problem.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true, updatedAt: true } })).toEqual(before);
    expect(await db.userProgress.count({ where: { userId, bookmarked: true } })).toBe(1);
  });
  it("rejects corrupted outputs before writes and preserves subsequent editorial changes", async () => {
    const corrupt = structuredClone(problems); corrupt[0].testCases[0].output = 999;
    await expect(seedProblems(db, corrupt)).rejects.toThrow(/incorrect expected/);
    await db.problem.update({ where: { slug: problems[0].slug }, data: { title: "Reviewed editorial title", seedHash: null } });
    await expect(seedProblems(db, problems)).rejects.toThrow(/Seed conflict/);
    expect((await db.problem.findUniqueOrThrow({ where: { slug: problems[0].slug } })).title).toBe("Reviewed editorial title");
    expect(await db.userProgress.count({ where: { userId, bookmarked: true } })).toBe(1);
  });
});
