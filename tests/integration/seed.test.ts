import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/lib/db/client";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import { ensureProfile } from "@/features/auth/profile";
import type { ProblemSeed } from "@/lib/validators/problem";

let db: ReturnType<typeof createDatabaseClient>;
let problems: ProblemSeed[];
let ownsFixtures = false;
const userId = randomUUID();

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use TEST_DATABASE_URL pointing to a dedicated database ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Integration tests require an empty problem collection in the dedicated test database.");
  problems = await loadProblems();
  ownsFixtures = true;
}, 30_000);
afterAll(async () => {
  if (db && ownsFixtures) {
    await db.user.deleteMany({ where: { id: userId } });
    await db.problem.deleteMany({ where: { slug: { in: problems.map((p) => p.slug) } } });
  }
  await db?.$disconnect();
});

describe("real PostgreSQL seed lifecycle", () => {
  it("inserts complete related data atomically per batch", async () => {
    expect(await seedProblems(db, problems)).toEqual({ created: problems.length, skipped: 0 });
    expect(await db.problemHint.count()).toBe(problems.length * 5);
    expect(await db.problemSolution.count()).toBe(problems.reduce((sum, p) => sum + p.solutions.length, 0));
    expect(await db.testCase.count()).toBe(problems.reduce((sum, p) => sum + p.testCases.length, 0));
    expect(await db.category.count()).toBe(30);
  });
  it("is idempotent and preserves IDs and user data on rerun", async () => {
    const before = await db.problem.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true, updatedAt: true } });
    const profiles = await Promise.all(Array.from({ length: 3 }, () => ensureProfile(db, { id: userId, user_metadata: { role: "ADMIN" } })));
    expect(profiles.every((p) => p.id === userId && p.role === "USER")).toBe(true);
    await db.userProgress.create({ data: { userId, problemId: before[0].id, bookmarked: true } });
    expect(await seedProblems(db, problems)).toEqual({ created: 0, skipped: problems.length });
    expect(await db.problem.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true, updatedAt: true } })).toEqual(before);
    expect(await db.userProgress.count({ where: { userId, bookmarked: true } })).toBe(1);
  });
  it("creates profiles without trusting metadata roles and preserves database roles", async () => {
    const first = await ensureProfile(db, { id: userId, user_metadata: { role: "ADMIN", display_name: "Changed name" } });
    expect(first.role).toBe("USER");
    await db.user.update({ where: { id: userId }, data: { role: "ADMIN", displayName: "Maintained name" } });
    const again = await ensureProfile(db, { id: userId, user_metadata: { role: "USER", display_name: "Override attempt" } });
    expect(again.role).toBe("ADMIN"); expect(again.displayName).toBe("Maintained name");
  });
  it("refuses content collisions without changing the saved problem", async () => {
    const original = await db.problem.findUniqueOrThrow({ where: { slug: problems[0].slug } });
    await expect(seedProblems(db, [{ ...problems[0], title: "Changed content" }])).rejects.toThrow(/Seed conflict/);
    expect((await db.problem.findUniqueOrThrow({ where: { slug: problems[0].slug } })).title).toBe(original.title);
  });
  it("validates the complete input before starting new writes", async () => {
    const before = await db.problem.count();
    await expect(seedProblems(db, [problems[0], problems[0]])).rejects.toThrow(/Duplicate problem slug/);
    await expect(seedProblems(db, [{ ...problems[0], relatedSlugs: ["missing-problem"] }])).rejects.toThrow();
    expect(await db.problem.count()).toBe(before);
  });
});
