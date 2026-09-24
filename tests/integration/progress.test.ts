import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { writeProblemChange } from "@/features/problems/detail-write";
import { queryProblem } from "@/features/problems/detail-query";
import { queryProgress } from "@/features/progress/query";
import { reserveSubmission, finishSubmission } from "@/features/submissions/store";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import type { ExecutionResult } from "@/features/submissions/contracts";
let db: ReturnType<typeof createDatabaseClient>; let ownsFixtures = false; let slugs: string[] = []; let problemId: string;
const users = [randomUUID(), randomUUID()]; const slug = "relay-window";
const input = { slug, language: "JAVASCRIPT" as const, mode: "SUBMIT" as const, code: "SOURCE-SENTINEL" };
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use an empty disposable TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url); if (await db.problem.count()) throw new Error("Progress tests require an empty collection.");
  const seeds = await loadProblems(); slugs = seeds.map((s) => s.slug); ownsFixtures = true;
  await seedProblems(db, seeds); await db.user.createMany({ data: users.map((id) => ({ id })) });
  problemId = (await db.problem.findUniqueOrThrow({ where: { slug } })).id;
}, 30000);
beforeEach(async () => {
  await db.userSubmission.deleteMany({ where: { userId: { in: users } } });
  await db.userProgress.deleteMany({ where: { userId: { in: users } } });
  await db.userNote.deleteMany({ where: { userId: { in: users } } });
  await db.problem.update({ where: { id: problemId }, data: { revision: 1, status: "PUBLISHED" } });
});
afterAll(async () => {
  if (db && ownsFixtures) { await db.user.deleteMany({ where: { id: { in: users } } }); await db.problem.deleteMany({ where: { slug: { in: slugs } } }); }
  await db?.$disconnect();
});
const progress = () => db.userProgress.findUniqueOrThrow({ where: { userId_problemId: { userId: users[0], problemId } } });
async function reserve(mode: "RUN" | "SUBMIT" = "SUBMIT") {
  const saved = await reserveSubmission(db, users[0], { ...input, mode }); if ("error" in saved) throw new Error(saved.error); return saved;
}
function verdict(id: string, mode: "RUN" | "SUBMIT" = "SUBMIT", status: ExecutionResult["status"] = "ACCEPTED"): ExecutionResult {
  const totalCount = mode === "RUN" ? 2 : 6;
  return { id, mode, status, totalCount, passedCount: status === "ACCEPTED" ? totalCount : 0, runtimeMs: 12, memoryKb: 2000, cases: [] };
}
it("marks manual attempts once and undoes manual solves back to attempted while keeping flags", async () => {
  await writeProblemChange(db, users[0], { slug, operation: "mark-attempted" }); const first = await progress();
  await writeProblemChange(db, users[0], { slug, operation: "mark-attempted" });
  expect((await progress()).attemptedAt).toEqual(first.attemptedAt); expect((await progress()).updatedAt).toEqual(first.updatedAt);
  await writeProblemChange(db, users[0], { slug, operation: "mark-solved" });
  await writeProblemChange(db, users[0], { slug, operation: "set-review", review: "true" });
  await db.userProgress.updateMany({ where: { userId: users[0] }, data: { bookmarked: true } });
  await writeProblemChange(db, users[0], { slug, operation: "clear-solved" });
  expect(await progress()).toMatchObject({ status: "ATTEMPTED", selfMarked: false, solvedAt: null, reviewLater: true, bookmarked: true, verifiedRevision: null });
});
it("counts a reservation immediately, but visible passes and failures cannot verify a solve", async () => {
  const visible = await reserve("RUN"); expect(await progress()).toMatchObject({ status: "ATTEMPTED", attemptedAt: expect.any(Date) });
  await finishSubmission(db, users[0], verdict(visible.id, "RUN"));
  const failed = await reserve(); await finishSubmission(db, users[0], verdict(failed.id, "SUBMIT", "INTERNAL_ERROR"));
  expect(await progress()).toMatchObject({ status: "ATTEMPTED", verifiedRevision: null, solvedAt: null });
});
it("upgrades a manual solve to verified atomically, preserving dates, notes and flags", async () => {
  await writeProblemChange(db, users[0], { slug, operation: "mark-solved" }); const manual = await progress();
  await writeProblemChange(db, users[0], { slug, operation: "set-review", review: "true" });
  await writeProblemChange(db, users[0], { slug, operation: "save-note", content: "NOTE-SENTINEL", expectedContent: "" });
  await db.userProgress.updateMany({ where: { userId: users[0] }, data: { bookmarked: true } });
  const saved = await reserve(); await finishSubmission(db, users[0], verdict(saved.id));
  const verified = await progress(); expect(verified).toMatchObject({ status: "SOLVED", selfMarked: false, verifiedRevision: 1, verifiedAt: expect.any(Date), solvedAt: manual.solvedAt, reviewLater: true, bookmarked: true });
  await writeProblemChange(db, users[0], { slug, operation: "clear-solved" });
  await writeProblemChange(db, users[0], { slug, operation: "mark-solved" });
  expect((await progress()).updatedAt).toEqual(verified.updatedAt);
  expect((await queryProblem(db, slug, users[0]))?.personal).toMatchObject({ note: "NOTE-SENTINEL", progress: { verification: "current" } });
});
it("serializes a verified completion with concurrent manual undo and review writes", async () => {
  await writeProblemChange(db, users[0], { slug, operation: "mark-solved" }); const saved = await reserve();
  await Promise.all([finishSubmission(db, users[0], verdict(saved.id)), writeProblemChange(db, users[0], { slug, operation: "clear-solved" }), writeProblemChange(db, users[0], { slug, operation: "set-review", review: "true" })]);
  expect(await progress()).toMatchObject({ status: "SOLVED", selfMarked: false, verifiedRevision: 1, reviewLater: true });
});
it("undoes a verified solve and then the attempt, keeping submission history, flags and notes", async () => {
  const saved = await reserve(); await finishSubmission(db, users[0], verdict(saved.id));
  await writeProblemChange(db, users[0], { slug, operation: "set-review", review: "true" });
  await writeProblemChange(db, users[0], { slug, operation: "save-note", content: "NOTE-SENTINEL", expectedContent: "" });
  // A stale manual undo or attempt undo must not erase the verified solve.
  const verified = await progress();
  await writeProblemChange(db, users[0], { slug, operation: "clear-solved" });
  await writeProblemChange(db, users[0], { slug, operation: "clear-attempted" });
  expect(await progress()).toEqual(verified);
  await writeProblemChange(db, users[0], { slug, operation: "clear-verified" });
  expect(await progress()).toMatchObject({ status: "ATTEMPTED", selfMarked: false, solvedAt: null, verifiedRevision: null, verifiedAt: null, attemptedAt: verified.attemptedAt, reviewLater: true });
  expect(await db.userSubmission.count({ where: { userId: users[0] } })).toBe(1);
  await writeProblemChange(db, users[0], { slug, operation: "clear-attempted" });
  expect(await progress()).toMatchObject({ status: "NOT_STARTED", attemptedAt: null, solvedAt: null, reviewLater: true });
  expect((await queryProblem(db, slug, users[0]))?.personal).toMatchObject({ note: "NOTE-SENTINEL", progress: { status: "NOT_STARTED", verification: null } });
  const again = await reserve(); await finishSubmission(db, users[0], verdict(again.id));
  expect(await progress()).toMatchObject({ status: "SOLVED", verifiedRevision: 1, verifiedAt: expect.any(Date) });
});
it("leaves manual solves to their own undo and repeated undos unchanged", async () => {
  await writeProblemChange(db, users[0], { slug, operation: "mark-solved" }); const manual = await progress();
  await writeProblemChange(db, users[0], { slug, operation: "clear-verified" });
  expect(await progress()).toEqual(manual);
  await writeProblemChange(db, users[0], { slug, operation: "clear-solved" });
  await writeProblemChange(db, users[0], { slug, operation: "clear-attempted" }); const cleared = await progress();
  expect(cleared).toMatchObject({ status: "NOT_STARTED", selfMarked: false, solvedAt: null });
  await writeProblemChange(db, users[0], { slug, operation: "clear-attempted" });
  await writeProblemChange(db, users[0], { slug, operation: "clear-verified" });
  expect((await progress()).updatedAt).toEqual(cleared.updatedAt);
});
it("rejects old-revision and archived in-flight solves while retaining their attempt results", async () => {
  const old = await reserve(); await db.problem.update({ where: { id: problemId }, data: { revision: 2 } });
  await finishSubmission(db, users[0], verdict(old.id)); expect(await progress()).toMatchObject({ status: "ATTEMPTED", verifiedRevision: null });
  const archived = await reserve(); await db.problem.update({ where: { id: problemId }, data: { status: "ARCHIVED" } });
  await finishSubmission(db, users[0], verdict(archived.id)); expect(await progress()).toMatchObject({ status: "ATTEMPTED", verifiedRevision: null });
  expect((await queryProgress(db, users[0])).recentAttempts).toEqual([]);
});
it("keeps earlier verified solves visible and can verify a new revision without erasing first solved date", async () => {
  const first = await reserve(); await finishSubmission(db, users[0], verdict(first.id)); const old = await progress();
  await db.problem.update({ where: { id: problemId }, data: { revision: 2 } });
  expect((await queryProblem(db, slug, users[0]))?.personal?.progress.verification).toBe("earlier");
  expect((await queryProgress(db, users[0])).overall).toMatchObject({ solved: 1, verifiedEarlier: 1, verifiedCurrent: 0 });
  const next = await reserve(); await finishSubmission(db, users[0], verdict(next.id));
  expect(await progress()).toMatchObject({ verifiedRevision: 2, solvedAt: old.solvedAt, attemptedAt: old.attemptedAt });
  const updated = await progress(); const repeated = await reserve(); await finishSubmission(db, users[0], verdict(repeated.id));
  expect((await progress()).verifiedAt).toEqual(updated.verifiedAt); expect((await progress()).updatedAt).toEqual(updated.updatedAt);
});
it("rejects forged completion mode/counts and rolls back invalid final writes", async () => {
  const saved = await reserve("RUN");
  await expect(finishSubmission(db, users[0], verdict(saved.id))).rejects.toThrow();
  await expect(finishSubmission(db, users[1], verdict(saved.id, "RUN"))).rejects.toThrow();
  await expect(finishSubmission(db, users[0], { ...verdict(saved.id, "RUN"), passedCount: 1 })).rejects.toThrow();
  expect(await progress()).toMatchObject({ status: "ATTEMPTED", verifiedRevision: null });
  expect(await db.userSubmission.findUnique({ where: { id: saved.id } })).toMatchObject({ status: "RUNNING", completedAt: null });
});
it("computes owner-only counts by difficulty/category without leaking code, results, notes or other users", async () => {
  const saved = await reserve(); await finishSubmission(db, users[0], verdict(saved.id));
  await writeProblemChange(db, users[0], { slug, operation: "set-review", review: "true" });
  await writeProblemChange(db, users[1], { slug: "quiet-badge", operation: "mark-solved" });
  await db.userSubmission.update({ where: { id: saved.id }, data: { result: { secret: "HIDDEN-RESULT-SENTINEL" } } });
  const summary = await queryProgress(db, users[0]);
  expect(summary.overall).toMatchObject({ total: slugs.length, started: 1, attempted: 1, solved: 1, verifiedCurrent: 1, manualSolved: 0, reviewLater: 1 });
  expect(summary.difficulty.EASY.solved).toBe(1); expect(summary.categories.find((c) => c.slug === "arrays")?.counts.solved).toBe(1);
  expect(summary.categories.find((c) => c.slug === "sliding-window")?.counts.solved).toBe(1);
  expect(summary.recentAttempts).toHaveLength(1); expect(summary.recentProgress).toHaveLength(1);
  for (const secret of ["SOURCE-SENTINEL", "HIDDEN-RESULT-SENTINEL", users[0], users[1], '"code"', '"result"', '"userId"']) expect(JSON.stringify(summary)).not.toContain(secret);
  expect((await queryProgress(db, users[1])).overall).toMatchObject({ attempted: 0, solved: 1, manualSolved: 1, verifiedCurrent: 0 });
});
it("bounds recent attempts to ten with deterministic newest-first ordering", async () => {
  await db.userSubmission.createMany({ data: Array.from({ length: 12 }, (_, i) => ({ userId: users[0], problemId, problemRevision: 1, mode: "RUN" as const, language: "JAVASCRIPT" as const, status: "INTERNAL_ERROR" as const, code: "private", createdAt: new Date(Date.UTC(2026,0,i+1)), completedAt: new Date(Date.UTC(2026,0,i+1)) })) });
  const recent = (await queryProgress(db, users[0])).recentAttempts;
  expect(recent).toHaveLength(10); expect(recent[0].createdAt).toBe("2026-01-12T00:00:00.000Z"); expect(recent[9].createdAt).toBe("2026-01-03T00:00:00.000Z");
});
