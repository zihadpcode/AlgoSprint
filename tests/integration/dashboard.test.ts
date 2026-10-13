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
  await db.mockInterview.deleteMany({ where: { userId: { in: users } } });
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

const NOW = new Date("2026-10-12T10:00:00Z");
it("derives the practice streak from saved activity in UTC days and keeps it owner-only", async () => {
  // 23:59:59Z and 00:00:01Z fall on different UTC days even though they are two seconds apart.
  await db.userSubmission.create({ data: { ...submission(ids[0]), createdAt: new Date("2026-10-10T23:59:59Z") } });
  await db.userSubmission.create({ data: { ...submission(ids[0]), createdAt: new Date("2026-10-11T00:00:01Z") } });
  await db.userProgress.create({ data: { userId: users[0], problemId: ids[1], status: "SOLVED", attemptedAt: new Date("2026-10-08T12:00:00Z"), solvedAt: new Date("2026-10-09T12:00:00Z") } });
  await db.userSubmission.create({ data: { ...submission(ids[2], users[1]), createdAt: new Date("2026-10-12T01:00:00Z") } });
  const morning = (await queryDashboard(db, users[0], NOW)).insights.streak;
  // Days 8, 9, 10 and 11; nothing yet today, but yesterday keeps the streak alive.
  expect(morning).toEqual({ current: 4, longest: 4, activeToday: false, lastActiveDay: "2026-10-11", activeDays: 4 });
  // Another learner's activity today does not count for this owner, and vice versa.
  expect((await queryDashboard(db, users[1], NOW)).insights.streak).toEqual({ current: 1, longest: 1, activeToday: true, lastActiveDay: "2026-10-12", activeDays: 1 });
  // A server run today (visible tests) is saved activity and extends the streak.
  await db.userSubmission.create({ data: { ...submission(ids[0]), mode: "RUN" as const, createdAt: new Date("2026-10-12T08:00:00Z") } });
  expect((await queryDashboard(db, users[0], NOW)).insights.streak).toMatchObject({ current: 5, activeToday: true });
  // Two silent days end the current streak but the longest run is kept.
  expect((await queryDashboard(db, users[0], new Date("2026-10-15T10:00:00Z"))).insights.streak).toMatchObject({ current: 0, longest: 5, activeToday: false });
});
it("does not count repeated attempt marks or an undone attempt as new practice days", async () => {
  await db.userProgress.create({ data: { userId: users[0], problemId: ids[0], status: "ATTEMPTED", attemptedAt: new Date("2026-10-11T12:00:00Z") } });
  // updatedAt moves when flags change, but only attemptedAt and solvedAt are activity events.
  await db.userProgress.update({ where: { userId_problemId: { userId: users[0], problemId: ids[0] } }, data: { bookmarked: true, updatedAt: new Date("2026-10-12T09:00:00Z") } });
  expect((await queryDashboard(db, users[0], NOW)).insights.streak).toMatchObject({ current: 1, activeToday: false, activeDays: 1 });
  await db.userProgress.update({ where: { userId_problemId: { userId: users[0], problemId: ids[0] } }, data: { status: "NOT_STARTED", attemptedAt: null } });
  expect((await queryDashboard(db, users[0], NOW)).insights.streak).toMatchObject({ current: 0, activeDays: 0 });
});
it("lists only the owner's five latest completed, scored mock interviews", async () => {
  const interview = (score: number | null, day: number, extra: Record<string, unknown> = {}) => ({ userId: users[0], status: "COMPLETED" as const, durationMinutes: 15, score, completedAt: new Date(Date.UTC(2026, 8, day, 12)), ...extra });
  await db.mockInterview.createMany({ data: [
    ...[1, 2, 3, 4, 5, 6, 7].map((day) => interview(day * 10, day)),
    interview(null, 20), interview(99, 21, { status: "ABANDONED" }), interview(88, 22, { status: "IN_PROGRESS", completedAt: null }),
    { ...interview(77, 23), userId: users[1] },
  ] });
  const mine = (await queryDashboard(db, users[0], NOW)).insights.interviews;
  expect(mine.recent.map((row) => row.score)).toEqual([70, 60, 50, 40, 30]);
  expect(mine.average).toBe(50);
  expect(mine.recent[0]).toMatchObject({ durationMinutes: 15, completedAt: "2026-09-07T12:00:00.000Z" });
  expect(Object.keys(mine.recent[0]).sort()).toEqual(["completedAt", "durationMinutes", "id", "score"]);
  const theirs = (await queryDashboard(db, users[1], NOW)).insights.interviews;
  expect(theirs.recent.map((row) => row.score)).toEqual([77]);
  expect(JSON.stringify(mine)).not.toContain(users[0]);
});
it("names strongest topics from the owner's own solves in the current catalogue only", async () => {
  const arrays = await db.problem.findMany({ where: { categories: { some: { category: { slug: "arrays" } } } }, take: 3, orderBy: { slug: "asc" }, select: { id: true } });
  expect(arrays).toHaveLength(3);
  await db.userProgress.createMany({ data: arrays.slice(0, 2).map((p) => ({ userId: users[0], problemId: p.id, status: "SOLVED" as const, solvedAt: new Date("2026-10-01T00:00:00Z"), verifiedRevision: 1, verifiedAt: new Date("2026-10-01T00:00:00Z") })) });
  await db.userProgress.create({ data: { userId: users[1], problemId: arrays[2].id, status: "SOLVED", solvedAt: new Date("2026-10-01T00:00:00Z"), verifiedRevision: 1, verifiedAt: new Date("2026-10-01T00:00:00Z") } });
  const mine = (await queryDashboard(db, users[0], NOW)).insights.strongest;
  expect(mine.find((topic) => topic.slug === "arrays")).toMatchObject({ solved: 2, verifiedCurrent: 2 });
  expect(await db.problem.count({ where: { id: { in: arrays.map((p) => p.id) } } })).toBe(3);
  // One solve in a category is not enough to be a strongest topic.
  expect((await queryDashboard(db, users[1], NOW)).insights.strongest).toEqual([]);
  // A revision bump makes the verified solve earlier: still solved, no longer verified on the current revision.
  await db.problem.updateMany({ where: { id: { in: arrays.map((p) => p.id) } }, data: { revision: 2 } });
  expect((await queryDashboard(db, users[0], NOW)).insights.strongest.find((topic) => topic.slug === "arrays")).toMatchObject({ solved: 2, verifiedCurrent: 0 });
});
