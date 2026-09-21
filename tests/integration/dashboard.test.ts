import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { queryDashboard } from "@/features/dashboard/query";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
let db: ReturnType<typeof createDatabaseClient>; let owns = false; let slugs: string[] = []; let ids: string[];
const users = [randomUUID(), randomUUID()];
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use an empty disposable TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url); if (await db.problem.count()) throw new Error("Dashboard tests require an empty collection.");
  const seeds = await loadProblems(); slugs = seeds.map((p) => p.slug); owns = true;
  await seedProblems(db, seeds); await db.user.createMany({ data: users.map((id) => ({ id })) });
  ids = (await db.problem.findMany({ orderBy: { slug: "asc" }, select: { id: true } })).map((p) => p.id);
}, 30000);
beforeEach(async () => {
  await db.userSubmission.deleteMany({ where: { userId: { in: users } } });
  await db.userProgress.deleteMany({ where: { userId: { in: users } } });
  await db.problem.updateMany({ where: { id: { in: ids } }, data: { status: "PUBLISHED", revision: 1 } });
});
afterAll(async () => {
  if (db && owns) { await db.user.deleteMany({ where: { id: { in: users } } }); await db.problem.deleteMany({ where: { slug: { in: slugs } } }); }
  await db?.$disconnect();
});
const submission = (problemId: string, userId = users[0]) => ({ problemId, userId, mode: "SUBMIT" as const, language: "JAVASCRIPT" as const, status: "WRONG_ANSWER" as const, problemRevision: 1, passedCount: 0, totalCount: 2, code: "PRIVATE-CODE", result: { secret: "PRIVATE-RESULT" }, createdAt: new Date("2026-09-01T00:00:00Z"), completedAt: new Date("2026-09-16T00:00:00Z") });
it("keeps counts, review signals and submissions owner-only and excludes private DTO fields", async () => {
  await db.userProgress.create({ data: { userId: users[0], problemId: ids[0], reviewLater: true } });
  await db.userSubmission.create({ data: submission(ids[0]) });
  await db.userSubmission.create({ data: submission(ids[1], users[1]) });
  const a = await queryDashboard(db, users[0]); const b = await queryDashboard(db, users[1]);
  expect(a.analytics.overall.reviewLater).toBe(1); expect(b.analytics.overall.reviewLater).toBe(0);
  expect(a.insights.recommendations[0].reason).toContain("marked this problem for review");
  expect(a.insights.recentSubmissions).toHaveLength(1); expect(b.insights.recentSubmissions).toHaveLength(1);
  for (const secret of [users[0], users[1], "PRIVATE-CODE", "PRIVATE-RESULT", '"code"', '"result"', '"userId"']) expect(JSON.stringify(a)).not.toContain(secret);
});
it("returns the five latest full submissions even after many newer visible runs", async () => {
  await db.userSubmission.createMany({ data: Array.from({ length: 8 }, (_, i) => ({ ...submission(ids[0]), createdAt: new Date(Date.UTC(2026, 8, i + 1)) })) });
  await db.userSubmission.createMany({ data: Array.from({ length: 12 }, () => ({ ...submission(ids[0]), mode: "RUN" as const, createdAt: new Date("2026-09-15T00:00:00Z") })) });
  const recent = (await queryDashboard(db, users[0])).insights.recentSubmissions;
  expect(recent).toHaveLength(5); expect(recent[0].createdAt).toBe("2026-09-08T00:00:00.000Z"); expect(recent[4].createdAt).toBe("2026-09-04T00:00:00.000Z");
});
it("uses the latest completed full result and ignores stale revisions for wrong-answer recommendations", async () => {
  await db.userSubmission.create({ data: { ...submission(ids[0]), createdAt: new Date("2026-09-01T00:00:00Z") } });
  expect((await queryDashboard(db, users[0])).insights.recommendations[0].reason).toContain("Wrong answer");
  await db.userSubmission.create({ data: { ...submission(ids[0]), status: "INTERNAL_ERROR", createdAt: new Date("2026-09-02T00:00:00Z") } });
  expect(JSON.stringify((await queryDashboard(db, users[0])).insights.recommendations)).not.toContain("Wrong answer");
  await db.userSubmission.deleteMany({ where: { userId: users[0], status: "INTERNAL_ERROR" } });
  await db.problem.update({ where: { id: ids[0] }, data: { revision: 2 } });
  expect(JSON.stringify((await queryDashboard(db, users[0])).insights.recommendations)).not.toContain("Wrong answer");
});
it("omits archived problems from every dashboard section and rejects an empty owner", async () => {
  await db.userProgress.create({ data: { userId: users[0], problemId: ids[0], reviewLater: true } });
  await db.userSubmission.create({ data: submission(ids[0]) });
  const archived = await db.problem.update({ where: { id: ids[0] }, data: { status: "ARCHIVED" } });
  const summary = await queryDashboard(db, users[0]);
  expect(summary.analytics.overall.total).toBe(slugs.length - 1); expect(summary.insights.recentSubmissions).toEqual([]);
  expect(summary.insights.topics).toEqual([]); expect(JSON.stringify(summary)).not.toContain(archived.slug);
  await expect(queryDashboard(db, "")).rejects.toThrow("Verified viewer required");
});

it("requires distinct unresolved full-submission problems for inferred topic signals", async () => {
  const arrayProblems = await db.problem.findMany({ where: { categories: { some: { category: { slug: "arrays" } } } }, take: 2, orderBy: { slug: "asc" } });
  expect(arrayProblems).toHaveLength(2);
  await db.userSubmission.createMany({ data: arrayProblems.map((p) => ({ ...submission(p.id), mode: "RUN" as const })) });
  expect((await queryDashboard(db, users[0])).insights.topics).toEqual([]);
  await db.userSubmission.createMany({ data: arrayProblems.map((p) => submission(p.id)) });
  expect((await queryDashboard(db, users[0])).insights.topics.find((t) => t.slug === "arrays")?.unresolvedCount).toBe(2);
  await db.userSubmission.createMany({ data: Array.from({ length: 4 }, () => submission(arrayProblems[0].id)) });
  await db.userSubmission.create({ data: { ...submission(arrayProblems[1].id), createdAt: new Date("2026-09-02T00:00:00Z"), status: "ACCEPTED", passedCount: 2 } });
  expect((await queryDashboard(db, users[0])).insights.topics).toEqual([]);
});
