import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { queryRoadmap, queryRoadmaps } from "@/features/roadmaps/query";
import { writeProblemChange } from "@/features/problems/detail-write";
import { ROADMAPS } from "@/data/seeds/roadmaps";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import { seedRoadmaps } from "../../prisma/seed-roadmaps";

let db: ReturnType<typeof createDatabaseClient>; let owns = false; let slugs: string[] = [];
const users = [randomUUID(), randomUUID()]; const at = new Date("2026-01-01T00:00:00Z");
const mainSlug = ROADMAPS[0].slug; const seedSlugs = ROADMAPS.map((r) => r.slug);
const fixturePrefix = `roadmap-${randomUUID()}`;
const ownedRoadmaps = () => ({ OR: [{ slug: { in: seedSlugs } }, { slug: { startsWith: fixturePrefix } }] });
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use an empty disposable TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count() || await db.roadmap.count()) throw new Error("Roadmap tests require an empty collection.");
  const seeds = await loadProblems(); slugs = seeds.map((p) => p.slug); owns = true;
  await seedProblems(db, seeds); await db.user.createMany({ data: users.map((id, i) => ({ id, role: i === 1 ? "ADMIN" as const : "USER" as const })) });
}, 30000);
beforeEach(async () => {
  await db.roadmap.deleteMany({ where: ownedRoadmaps() });
  await db.userProgress.deleteMany({ where: { userId: { in: users } } });
  await db.userNote.deleteMany({ where: { userId: { in: users } } });
  await db.problem.updateMany({ where: { slug: { in: slugs } }, data: { status: "PUBLISHED", revision: 1 } });
  await seedRoadmaps(db, ROADMAPS);
});
afterAll(async () => {
  if (db && owns) {
    await db.roadmap.deleteMany({ where: ownedRoadmaps() });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.problem.deleteMany({ where: { slug: { in: slugs } } });
  }
  await db?.$disconnect();
});
it("returns ordered public paths with no guest personal data or hidden projections", async () => {
  await writeProblemChange(db, users[0], { slug: "quiet-badge", operation: "mark-solved" });
  await writeProblemChange(db, users[0], { slug: "quiet-badge", operation: "save-note", content: "PRIVATE-ROADMAP-NOTE", expectedContent: "" });
  const result = await queryRoadmap(db, null, mainSlug);
  expect(result?.steps.map((s) => s.problem.slug)).toEqual(ROADMAPS[0].steps.map((s) => s.problemSlug));
  expect(result?.steps.map((s) => s.position)).toEqual([1, 2, 3]); expect(result?.progress).toBeNull(); expect(result?.steps.every((s) => s.progress === null)).toBe(true);
  expect(result?.next?.position).toBe(1);
  for (const secret of ["PRIVATE-ROADMAP-NOTE", users[0], "userId", "problemId", "seedHash", "testCases", "statement", "solutions", "starterCode", "sourceCode"]) expect(JSON.stringify(result)).not.toContain(secret);
});
it("isolates owners and administrators; reflects problem changes in every shared path", async () => {
  await seedRoadmaps(db, [{ ...ROADMAPS[0], slug: `${fixturePrefix}-shared` }]);
  await writeProblemChange(db, users[0], { slug: "quiet-badge", operation: "mark-solved" });
  for (const slug of [mainSlug, `${fixturePrefix}-shared`]) {
    expect((await queryRoadmap(db, users[0], slug))?.progress).toMatchObject({ solved: 1, selfMarked: 1, percent: 33 });
    expect((await queryRoadmap(db, users[1], slug))?.progress?.solved).toBe(0);
  }
  await writeProblemChange(db, users[0], { slug: "quiet-badge", operation: "clear-solved" });
  expect((await queryRoadmap(db, users[0], mainSlug))?.progress?.solved).toBe(0);
});
it("distinguishes manual and current/earlier verified progress; browsing writes nothing", async () => {
  const problems = await db.problem.findMany({ where: { slug: { in: ROADMAPS[0].steps.map((s) => s.problemSlug) } } });
  for (const p of problems) await db.userProgress.create({ data: { userId: users[0], problemId: p.id, status: "SOLVED", solvedAt: at,
    selfMarked: p.slug === "quiet-badge", verifiedRevision: p.slug === "quiet-badge" ? null : 1, verifiedAt: p.slug === "quiet-badge" ? null : at } });
  await db.problem.update({ where: { slug: "parcel-checkpoints" }, data: { revision: 2 } });
  const before = await db.userProgress.findMany({ where: { userId: users[0] }, orderBy: { problemId: "asc" } });
  const result = await queryRoadmap(db, users[0], mainSlug);
  expect(result?.progress).toMatchObject({ solved: 3, total: 3, percent: 100, selfMarked: 1, verifiedCurrent: 1, verifiedEarlier: 1 });
  expect(result?.next?.slug).toBe("parcel-checkpoints");
  expect(await db.userProgress.findMany({ where: { userId: users[0] }, orderBy: { problemId: "asc" } })).toEqual(before);
  await writeProblemChange(db, users[0], { slug: "quiet-badge", operation: "set-review", review: "true" });
  expect((await queryRoadmap(db, users[0], mainSlug))?.next?.slug).toBe("quiet-badge");
});
it("hides drafts, archived and empty paths and paths with any unavailable problem", async () => {
  for (const status of ["DRAFT", "ARCHIVED"] as const) {
    await db.roadmap.update({ where: { slug: mainSlug }, data: { status } });
    expect(await queryRoadmap(db, users[0], mainSlug)).toBeNull(); expect((await queryRoadmaps(db, null)).total).toBe(1);
  }
  await db.roadmap.update({ where: { slug: mainSlug }, data: { status: "PUBLISHED" } });
  for (const status of ["DRAFT", "ARCHIVED"] as const) {
    await db.problem.update({ where: { slug: "relay-window" }, data: { status } });
    expect(await queryRoadmap(db, null, mainSlug)).toBeNull(); expect((await queryRoadmaps(db, null)).total).toBe(1);
  }
  await db.roadmap.create({ data: { slug: `${fixturePrefix}-empty`, title: "Empty private sentinel", description: "Private", difficulty: "EASY", estimatedMinutes: 1, status: "PUBLISHED" } });
  expect(await queryRoadmap(db, null, `${fixturePrefix}-empty`)).toBeNull();
  expect(await queryRoadmap(db, null, "does-not-exist")).toBeNull();
});
it("paginates deterministically with tied titles and clamps requests", async () => {
  await seedRoadmaps(db, Array.from({ length: 13 }, (_, i) => ({ ...ROADMAPS[0], title: "AAA tied title", slug: `${fixturePrefix}-${String(i).padStart(2, "0")}` })));
  const first = await queryRoadmaps(db, null, 1); const last = await queryRoadmaps(db, null, 999999);
  expect(first).toMatchObject({ total: 15, pages: 2, page: 1 }); expect(first.items).toHaveLength(12); expect(last.items).toHaveLength(3); expect(last.page).toBe(2);
  expect(new Set([...first.items, ...last.items].map((r) => r.slug)).size).toBe(15);
  expect(first.items.map((r) => r.slug)).toEqual(Array.from({ length: 12 }, (_, i) => `${fixturePrefix}-${String(i).padStart(2, "0")}`));
});
it("reruns and concurrent seed calls preserve roadmap/step IDs and user progress", async () => {
  const read = () => db.roadmap.findMany({ orderBy: { slug: "asc" }, include: { steps: { orderBy: { position: "asc" } } } });
  const before = await read(); await writeProblemChange(db, users[0], { slug: "quiet-badge", operation: "mark-solved" });
  expect(await seedRoadmaps(db, ROADMAPS)).toEqual({ created: 0, skipped: 2 });
  const extra = [{ ...ROADMAPS[0], slug: `${fixturePrefix}-concurrent` }];
  const results = await Promise.all([seedRoadmaps(db, extra), seedRoadmaps(db, extra)]);
  expect(results.map((r) => r.created).sort()).toEqual([0, 1]);
  expect((await read()).filter((r) => seedSlugs.includes(r.slug))).toEqual(before);
  expect((await queryRoadmap(db, users[0], mainSlug))?.progress?.solved).toBe(1);
});
it("rolls back the entire roadmap batch on content conflict or unpublished references", async () => {
  const extra = { ...ROADMAPS[0], slug: `${fixturePrefix}-rollback` };
  await expect(seedRoadmaps(db, [extra, { ...ROADMAPS[0], title: "Changed" }])).rejects.toThrow(/Roadmap seed conflict/);
  expect(await db.roadmap.count()).toBe(2);
  await db.problem.update({ where: { slug: "quiet-badge" }, data: { status: "ARCHIVED" } });
  await expect(seedRoadmaps(db, [extra])).rejects.toThrow(/requires published problem/);
  expect(await db.roadmap.count()).toBe(2);
  await db.problem.update({ where: { slug: "quiet-badge" }, data: { status: "PUBLISHED" } });
  await db.roadmap.update({ where: { slug: mainSlug }, data: { status: "ARCHIVED" } });
  await expect(seedRoadmaps(db, ROADMAPS)).rejects.toThrow(/Roadmap seed conflict/);
  expect((await db.roadmap.findUniqueOrThrow({ where: { slug: mainSlug } })).status).toBe("ARCHIVED");
});
