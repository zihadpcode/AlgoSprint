import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { queryProblem } from "@/features/problems/detail-query";
import { writeProblemChange } from "@/features/problems/detail-write";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import type { ProblemSeed } from "@/lib/validators/problem";

let db: ReturnType<typeof createDatabaseClient>;
let seeds: ProblemSeed[] = [];
let ownsFixtures = false;
let problemId: string;
const users = [randomUUID(), randomUUID()];
const slug = "relay-window";
const privateSlugs = ["qa-detail-draft", "qa-detail-archived"];
const hiddenSentinel = "HIDDEN-DETAIL-TEST-SENTINEL";

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use a dedicated TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Detail tests require an empty problem collection.");
  seeds = await loadProblems();
  ownsFixtures = true;
  await seedProblems(db, seeds);
  await db.user.createMany({ data: users.map((id) => ({ id })) });
  problemId = (await db.problem.findUniqueOrThrow({ where: { slug } })).id;
  for (const [index, status] of (["DRAFT", "ARCHIVED"] as const).entries()) {
    const hidden = await db.problem.create({ data: { slug: privateSlugs[index], title: "Private detail sentinel", status,
      difficulty: "EASY", pattern: "fixture", statement: "Private statement", constraints: ["Fixture"], estimatedMinutes: 1 } });
    await db.problemRelation.create({ data: { problemId, relatedId: hidden.id } });
  }
  const related = await db.problem.findUniqueOrThrow({ where: { slug: "parcel-checkpoints" } });
  await db.problemRelation.create({ data: { problemId, relatedId: related.id } });
  await db.testCase.updateMany({ where: { problemId, visibility: "HIDDEN" }, data: { explanation: hiddenSentinel } });
}, 30_000);
beforeEach(async () => {
  await db.userProgress.deleteMany({ where: { userId: { in: users } } });
  await db.userNote.deleteMany({ where: { userId: { in: users } } });
});
afterAll(async () => {
  if (db && ownsFixtures) {
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.problem.deleteMany({ where: { slug: { in: [...seeds.map((seed) => seed.slug), ...privateSlugs] } } });
  }
  await db?.$disconnect();
});
const progress = (userId = users[0]) => db.userProgress.findUniqueOrThrow({ where: { userId_problemId: { userId, problemId } } });

describe("problem details and personal writes against PostgreSQL", () => {
  it("returns ordered learning content, published relations and no hidden/operational data", async () => {
    const result = await queryProblem(db, slug, null);
    expect(result?.personal).toBeNull();
    expect(result?.hints.map((hint) => hint.position)).toEqual([1, 2, 3, 4, 5]);
    expect(result?.examples).toHaveLength(2);
    expect(result?.solutions).toHaveLength(2);
    expect(result?.starterCode.length).toBeGreaterThan(0);
    expect(result?.related.map((item) => item.slug)).toEqual(["parcel-checkpoints"]);
    const fallback = await queryProblem(db, "parcel-checkpoints", null);
    const sharedCategories = seeds.find((seed) => seed.slug === "parcel-checkpoints")!.categories;
    expect(fallback?.related.length).toBeGreaterThan(0);
    expect(fallback?.related.length).toBeLessThanOrEqual(3);
    for (const item of fallback!.related) expect(seeds.find((seed) => seed.slug === item.slug)!.categories.some((c) => sharedCategories.includes(c))).toBe(true);
    expect(fallback?.related.every((item) => !privateSlugs.includes(item.slug) && item.slug !== "parcel-checkpoints")).toBe(true);
    expect(Object.keys(result!).sort()).toEqual(["slug", "title", "difficulty", "kind", "pattern", "statement", "constraints", "estimatedMinutes", "categories", "tags", "examples", "hints", "solutions", "starterCode", "related", "personal"].sort());
    const json = JSON.stringify(result);
    for (const forbidden of [hiddenSentinel, "Private detail", "testCases", "seedHash", '"id":', '"userId":', '"problemId":']) expect(json).not.toContain(forbidden);
  });
  it("denies draft, archived and missing detail reads and writes", async () => {
    for (const unavailable of [...privateSlugs, "not-a-problem"]) {
      expect(await queryProblem(db, unavailable, users[0])).toBeNull();
      expect(await writeProblemChange(db, users[0], { slug: unavailable, operation: "mark-solved" })).toBe("not-found");
      expect(await writeProblemChange(db, users[0], { slug: unavailable, operation: "save-note", content: "private", expectedContent: "" })).toBe("not-found");
    }
    expect(await db.userProgress.count()).toBe(0);
    expect(await db.userNote.count()).toBe(0);
  });
  it("isolates notes and progress between two verified users and guests", async () => {
    await writeProblemChange(db, users[0], { slug, operation: "save-note", content: "Owner A private note", expectedContent: "" });
    await writeProblemChange(db, users[0], { slug, operation: "mark-solved" });
    await writeProblemChange(db, users[1], { slug, operation: "save-note", content: "Owner B private note", expectedContent: "" });
    const first = await queryProblem(db, slug, users[0]);
    const second = await queryProblem(db, slug, users[1]);
    expect(first?.personal).toMatchObject({ note: "Owner A private note", progress: { status: "SOLVED", selfMarked: true } });
    expect(second?.personal).toMatchObject({ note: "Owner B private note", progress: { status: "NOT_STARTED" } });
    expect(JSON.stringify(await queryProblem(db, slug, null))).not.toContain("private note");
    expect(JSON.stringify(second)).not.toContain("Owner A");
  });
  it("handles concurrent first progress writes without losing independent fields or duplicating rows", async () => {
    await Promise.all([
      writeProblemChange(db, users[0], { slug, operation: "mark-solved" }),
      writeProblemChange(db, users[0], { slug, operation: "set-review", review: "true" }),
      writeProblemChange(db, users[0], { slug, operation: "mark-solved" }),
    ]);
    const before = await progress();
    expect(before).toMatchObject({ status: "SOLVED", selfMarked: true, reviewLater: true });
    expect(await db.userProgress.count()).toBe(1);
    await writeProblemChange(db, users[0], { slug, operation: "mark-solved" });
    expect((await progress()).solvedAt).toEqual(before.solvedAt);
    await writeProblemChange(db, users[0], { slug, operation: "set-review", review: "false" });
    expect(await progress()).toMatchObject({ status: "SOLVED", reviewLater: false });
  });
  it("undoes manual solves while preserving review flags and previous attempt status", async () => {
    await writeProblemChange(db, users[0], { slug, operation: "mark-solved" });
    await writeProblemChange(db, users[0], { slug, operation: "set-review", review: "true" });
    await writeProblemChange(db, users[0], { slug, operation: "clear-solved" });
    expect(await progress()).toMatchObject({ status: "NOT_STARTED", selfMarked: false, solvedAt: null, reviewLater: true });
    await db.userProgress.updateMany({ where: { userId: users[0] }, data: { status: "ATTEMPTED", attemptedAt: new Date(), bookmarked: true } });
    await writeProblemChange(db, users[0], { slug, operation: "mark-solved" });
    await writeProblemChange(db, users[0], { slug, operation: "clear-solved" });
    expect(await progress()).toMatchObject({ status: "ATTEMPTED", solvedAt: null, bookmarked: true, reviewLater: true });
  });
  it("preserves a future verified solve's date and provenance", async () => {
    const solvedAt = new Date("2026-01-01T00:00:00Z");
    await db.userProgress.create({ data: { userId: users[0], problemId, status: "SOLVED", solvedAt, selfMarked: false } });
    await writeProblemChange(db, users[0], { slug, operation: "mark-solved" });
    await writeProblemChange(db, users[0], { slug, operation: "clear-solved" });
    expect(await progress()).toMatchObject({ status: "SOLVED", solvedAt, selfMarked: false });
  });
  it("rejects stale note edits, preserves whitespace, and supports explicit clearing", async () => {
    expect(await writeProblemChange(db, users[0], { slug, operation: "save-note", content: "  first\n", expectedContent: "" })).toBe("saved");
    expect(await writeProblemChange(db, users[0], { slug, operation: "save-note", content: "stale", expectedContent: "" })).toBe("conflict");
    expect((await queryProblem(db, slug, users[0]))?.personal?.note).toBe("  first\n");
    expect(await writeProblemChange(db, users[0], { slug, operation: "save-note", content: "", expectedContent: "  first\n" })).toBe("saved");
    expect((await queryProblem(db, slug, users[0]))?.personal?.note).toBe("");
  });
  it("allows only one of two concurrent note saves from the same baseline", async () => {
    const outcomes = await Promise.all(["one", "two"].map((content) => writeProblemChange(db, users[0], { slug, operation: "save-note", content, expectedContent: "" })));
    expect(outcomes.sort()).toEqual(["conflict", "saved"]);
    expect(await db.userNote.count()).toBe(1);
    expect(["one", "two"]).toContain((await queryProblem(db, slug, users[0]))?.personal?.note);
  });
});
