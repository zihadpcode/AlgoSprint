import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { writeAdmin } from "@/features/admin/write";
import { queryAdminIndex, queryAdminProblem, queryAdminRoadmap } from "@/features/admin/query";
import { queryProblem } from "@/features/problems/detail-query";
import { writeProblemChange } from "@/features/problems/detail-write";
import { reserveSubmission, finishSubmission } from "@/features/submissions/store";
import { queryRoadmap } from "@/features/roadmaps/query";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import { seedRoadmaps } from "../../prisma/seed-roadmaps";
import { ROADMAPS } from "@/data/seeds/roadmaps";
import type { ProblemSeed } from "@/lib/validators/problem";
let db: ReturnType<typeof createDatabaseClient>; let owns = false; let seeds: ProblemSeed[] = [];
const admin = randomUUID(), user = randomUUID(); const prefix = `admin-${randomUUID()}`;
const filter = { q: "", status: "" as const, page: 1 };
const ownedProblems = () => ({ OR: [{ slug: { in: seeds.map((p) => p.slug) } }, { slug: { startsWith: prefix } }] });
async function clear() {
  await db.roadmap.deleteMany({ where: { slug: { in: ROADMAPS.map((r) => r.slug) } } });
  await db.userSubmission.deleteMany({ where: { userId: { in: [admin, user] } } });
  await db.userProgress.deleteMany({ where: { userId: { in: [admin, user] } } });
  await db.userNote.deleteMany({ where: { userId: { in: [admin, user] } } });
  await db.problem.deleteMany({ where: ownedProblems() });
}
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use an empty disposable TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url); if (await db.problem.count() || await db.roadmap.count()) throw new Error("Admin tests require an empty collection.");
  seeds = await loadProblems(); owns = true; await db.user.createMany({ data: [{ id: admin, role: "ADMIN" }, { id: user }] });
}, 30000);
beforeEach(async () => { await clear(); await db.user.update({ where: { id: admin }, data: { role: "ADMIN" } }); await seedProblems(db, seeds); }, 30000);
afterAll(async () => { if (db && owns) { await clear(); await db.user.deleteMany({ where: { id: { in: [admin, user] } } }); } await db?.$disconnect(); });
const custom = (suffix: string, changes: Partial<ProblemSeed> = {}): ProblemSeed => ({ ...structuredClone(seeds[0]), slug: `${prefix}-${suffix}`, title: `Admin fixture ${suffix}`, relatedSlugs: [], status: "DRAFT", ...changes });
const save = (p: ProblemSeed, revision: number | null = null, reviewed = false) => writeAdmin(db, admin, { operation: "save", slug: revision === null ? null : p.slug, revision, payload: JSON.stringify(p), reviewed });
const lifecycle = (slug: string, revision: number, operation: "archive" | "delete") => writeAdmin(db, admin, { operation, slug, revision, confirmation: slug });
it("rechecks database authorization for reads/writes and rejects revoked administrator sessions", async () => {
  for (const id of [user, randomUUID()]) {
    await expect(queryAdminProblem(db, id, "relay-window")).rejects.toThrow(/Administrator/);
    await expect(queryAdminIndex(db, id, filter)).rejects.toThrow(/Administrator/);
    await expect(writeAdmin(db, id, { operation: "import", payload: "[]", reviewed: false })).rejects.toThrow(/Administrator/);
  }
  await db.user.update({ where: { id: admin }, data: { role: "USER" } });
  await expect(save(custom("revoked"))).rejects.toThrow(/Administrator/); expect(await db.problem.count()).toBe(5);
});
it("creates complete structured content and keeps hidden tests out of public projections", async () => {
  const p = custom("complete", { status: "PUBLISHED" }); p.testCases.find((x) => x.visibility === "HIDDEN")!.explanation = "PRIVATE-ADMIN-TEST";
  await expect(save(p)).rejects.toThrow(/reviewed/); expect((await save(p, null, true)).revision).toBe(1);
  const row = await queryAdminProblem(db, admin, p.slug); expect(row?.content.testCases).toHaveLength(p.testCases.length);
  expect(JSON.stringify(row)).toContain("PRIVATE-ADMIN-TEST"); expect(JSON.stringify(await queryProblem(db, p.slug, null))).not.toContain("PRIVATE-ADMIN-TEST");
  expect(await db.problem.findUniqueOrThrow({ where: { slug: p.slug } })).toMatchObject({ seedHash: null, revision: 1, status: "PUBLISHED", publishedAt: expect.any(Date) });
});
it("updates content atomically, advances revisions and retains all user history and seed conflicts", async () => {
  const p = structuredClone(seeds.find((x) => x.slug === "relay-window")!);
  const problem = await db.problem.findUniqueOrThrow({ where: { slug: p.slug } }); const at = new Date("2026-01-01T00:00:00Z");
  await db.userProgress.create({ data: { userId: user, problemId: problem.id, status: "SOLVED", solvedAt: at, verifiedRevision: 1, verifiedAt: at, bookmarked: true, reviewLater: true } });
  await writeProblemChange(db, user, { operation: "save-note", slug: p.slug, content: "PRIVATE-HISTORY", expectedContent: "" });
  p.title = "Revised Relay Window"; p.hints[0].content = "Revised guidance";
  expect((await save(p, 1, true)).revision).toBe(2);
  expect((await queryAdminProblem(db, admin, p.slug))?.content.hints[0].content).toBe("Revised guidance");
  expect((await queryProblem(db, p.slug, user))?.personal).toMatchObject({ note: "PRIVATE-HISTORY", bookmarked: true, progress: { verification: "earlier", reviewLater: true } });
  expect((await db.problem.findUniqueOrThrow({ where: { slug: p.slug } })).id).toBe(problem.id);
  await expect(seedProblems(db, seeds)).rejects.toThrow(/Seed conflict/);
});
it("serializes stale editors so exactly one concurrent save succeeds", async () => {
  const p = custom("concurrent"); await save(p);
  const result = await Promise.allSettled([save({ ...p, title: "First editor" }, 1), save({ ...p, title: "Second editor" }, 1)]);
  expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await queryAdminProblem(db, admin, p.slug))?.revision).toBe(2);
  await expect(save(p, 1)).rejects.toThrow(/another tab/);
});
it("preserves in-flight attempt history without verifying an outdated edited revision", async () => {
  const p = structuredClone(seeds.find((x) => x.slug === "relay-window")!);
  const reserved = await reserveSubmission(db, user, { slug: p.slug, language: "JAVASCRIPT", mode: "SUBMIT", code: "SOURCE-RETAINED" });
  if (!("id" in reserved)) throw new Error("Expected reservation");
  await save({ ...p, title: "Edited during execution" }, 1, true);
  await finishSubmission(db, user, { id: reserved.id!, mode: "SUBMIT", status: "ACCEPTED", passedCount: reserved.cases!.length, totalCount: reserved.cases!.length, runtimeMs: 1, memoryKb: 10, cases: [] });
  expect((await queryProblem(db, p.slug, user))?.personal?.progress).toMatchObject({ status: "ATTEMPTED", verification: null });
  expect((await db.userSubmission.findUniqueOrThrow({ where: { id: reserved.id } })).code).toBe("SOURCE-RETAINED");
});
it("imports create-only batches with internal links and rolls back every new row on any failure", async () => {
  const a = custom("import-a"), b = custom("import-b"); a.relatedSlugs = [b.slug];
  await writeAdmin(db, admin, { operation: "import", payload: JSON.stringify([a, b]), reviewed: false });
  expect((await queryAdminProblem(db, admin, a.slug))?.content.relatedSlugs).toEqual([b.slug]);
  await expect(writeAdmin(db, admin, { operation: "import", payload: JSON.stringify([custom("rollback"), a]), reviewed: false })).rejects.toThrow(/already exists/);
  expect(await db.problem.count({ where: { slug: custom("rollback").slug } })).toBe(0);
  await expect(writeAdmin(db, admin, { operation: "import", payload: JSON.stringify([custom("rollback"), custom("bad", { relatedSlugs: ["missing-problem"] })]), reviewed: false })).rejects.toThrow(/related problem/);
  expect(await db.problem.count()).toBe(7);
});
it("archives with stale checks and only deletes unreferenced archived problems", async () => {
  const p = custom("deletion"); await save(p); await expect(lifecycle(p.slug, 1, "delete")).rejects.toThrow(/Only archived/);
  await lifecycle(p.slug, 1, "archive"); await expect(lifecycle(p.slug, 1, "delete")).rejects.toThrow(/changed/);
  await lifecycle(p.slug, 2, "delete"); expect(await queryAdminProblem(db, admin, p.slug)).toBeNull();
  await writeProblemChange(db, user, { slug: "quiet-badge", operation: "mark-solved" }); await lifecycle("quiet-badge", 1, "archive");
  await expect(lifecycle("quiet-badge", 2, "delete")).rejects.toThrow(/history/);
  expect(await db.userProgress.count({ where: { userId: user } })).toBe(1);
  await expect(writeAdmin(db, admin, { operation: "archive", slug: "dock-threshold", revision: 1, confirmation: "wrong" })).rejects.toThrow(/exact problem slug/);
});
it("edits ordered roadmap placement with conflict tokens and preserves existing seed protection", async () => {
  await seedRoadmaps(db, ROADMAPS); const slug = ROADMAPS[0].slug;
  const row = (await queryAdminRoadmap(db, admin, slug))!;
  const content = { ...row.content, steps: [...row.content.steps].reverse() };
  const command = { operation: "roadmap", slug, token: row.token, payload: JSON.stringify({ content, status: "PUBLISHED" }), reviewed: true };
  await writeAdmin(db, admin, command);
  expect((await queryRoadmap(db, null, slug))?.steps.map((s) => s.problem.slug)).toEqual(content.steps.map((s) => s.problemSlug));
  await expect(writeAdmin(db, admin, command)).rejects.toThrow(/roadmap changed/);
  await expect(seedRoadmaps(db, ROADMAPS)).rejects.toThrow(/seed conflict/);
  await lifecycle("quiet-badge", 1, "archive"); expect(await queryRoadmap(db, null, slug)).toBeNull();
});
it("protects runner contracts and rejects reserved slugs before writing", async () => {
  const p = structuredClone(seeds.find((x) => x.slug === "relay-window")!); p.testCases[0].output = 9999999;
  await expect(save(p, 1, true)).rejects.toThrow(/expected output/);
  expect((await queryAdminProblem(db, admin, p.slug))?.revision).toBe(1);
  await expect(save(custom("reserved", { slug: "new" }))).rejects.toThrow(/reserved/);
});
it("lists twenty safe summaries per page with stable title search and status filters", async () => {
  for (let start = 0; start < 21; start += 10) await writeAdmin(db, admin, { operation: "import", payload: JSON.stringify(Array.from({ length: Math.min(10, 21-start) }, (_, i) => custom(`page-${String(start+i).padStart(2,"0")}`, { title: "AAA Admin tie" }))), reviewed: false });
  const first = await queryAdminIndex(db, admin, { ...filter, q: "aaa", status: "DRAFT" }); const last = await queryAdminIndex(db, admin, { ...filter, q: "AAA", page: 999 });
  expect(first.problems).toHaveLength(20); expect(last.problems).toHaveLength(1); expect(last.page).toBe(2);
  expect(new Set([...first.problems, ...last.problems].map((p) => p.slug)).size).toBe(21);
  expect(JSON.stringify(first)).not.toMatch(/testCases|statement|code|seedHash/);
});
