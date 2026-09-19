import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { writeInterview, queryInterview, queryInterviews } from "@/features/interviews/store";
import { EMPTY_ANSWER } from "@/features/interviews/contracts";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
let db: ReturnType<typeof createDatabaseClient>; let owns = false; let slugs: string[] = [];
const owner = randomUUID(), stranger = randomUUID();
const setup = { duration: 15, count: 2, difficulty: "ANY", kind: "CODING", topic: "" };
const start = (patch = {}) => writeInterview(db, owner, { operation: "start", setup: { ...setup, ...patch } });
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL; if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use an empty dedicated test database ending in _test.");
  db = createDatabaseClient(url); if (await db.problem.count() || await db.mockInterview.count()) throw new Error("Interview tests need an empty collection.");
  owns = true; await db.user.createMany({ data: [{ id: owner }, { id: stranger, role: "ADMIN" }] });
  const problems = await loadProblems(); slugs = problems.map((p) => p.slug); await seedProblems(db, problems);
}, 30000);
beforeEach(async () => { await db.mockInterview.deleteMany({ where: { userId: { in: [owner, stranger] } } }); await db.problem.updateMany({ where: { slug: { in: slugs } }, data: { status: "PUBLISHED" } }); });
afterAll(async () => { if (db && owns) { await db.user.deleteMany({ where: { id: { in: [owner, stranger] } } }); await db.problem.deleteMany({ where: { slug: { in: slugs } } }); } await db?.$disconnect(); });
it("selects distinct matching published questions and hides reference content until completion", async () => {
  await db.problem.update({ where: { slug: "quiet-badge" }, data: { status: "DRAFT" } });
  const result = await start({ count: 3 }); const view = await queryInterview(db, owner, result.id!);
  expect(view?.questions).toHaveLength(3); expect(new Set(view!.questions.map((q) => q.prompt.slug)).size).toBe(3);
  expect(view!.questions.some((q) => q.prompt.slug === "quiet-badge")).toBe(false);
  expect(JSON.stringify(view)).not.toContain('"reference"'); expect(JSON.stringify(view)).not.toContain('"testCases"');
  await writeInterview(db, owner, { operation: "finish", id: result.id });
  expect((await queryInterview(db, owner, result.id!))!.questions.every((q) => q.reference)).toBe(true);
});
it("enforces ownership for reads, writes and reports, even for another admin", async () => {
  const result = await start(); expect(await queryInterview(db, stranger, result.id!)).toBeNull(); expect(await queryInterviews(db, stranger)).toEqual([]);
  await expect(writeInterview(db, stranger, { operation: "finish", id: result.id })).rejects.toThrow(/unavailable/);
  await writeInterview(db, owner, { operation: "finish", id: result.id }); expect(await queryInterview(db, stranger, result.id!)).toBeNull();
});
it("serializes duplicate starts into one active session", async () => {
  const results = await Promise.all([start(), start()]); expect(results[0].id).toBe(results[1].id); expect(await db.mockInterview.count()).toBe(1);
});
it("rejects stale answer writes and preserves the winning draft", async () => {
  const result = await start(); const q = (await queryInterview(db, owner, result.id!))!.questions[0];
  const save = (reasoning: string) => writeInterview(db, owner, { operation: "save", id: result.id, questionId: q.id, token: q.token, answer: { ...EMPTY_ANSWER, reasoning } });
  const writes = await Promise.allSettled([save("first"), save("second")]); expect(writes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(["first", "second"]).toContain((await queryInterview(db, owner, result.id!))!.questions[0].answer.reasoning);
});
it("refuses late answer updates and finalizes using previously saved responses", async () => {
  const result = await start(); const q = (await queryInterview(db, owner, result.id!))!.questions[0];
  await db.mockInterview.update({ where: { id: result.id }, data: { startedAt: new Date(Date.now() - 16 * 60000) } });
  const response = await writeInterview(db, owner, { operation: "save", id: result.id, questionId: q.id, token: q.token, answer: { ...EMPTY_ANSWER, reasoning: "late", reasoningRating: 2 } });
  expect(response.ended).toBe(true); const view = await queryInterview(db, owner, result.id!); expect(view?.status).toBe("COMPLETED"); expect(view?.score).toBe(0); expect(view?.questions[0].answer.reasoning).toBe("");
});
it("persists self-assessment without creating verified progress and makes finish idempotent", async () => {
  const result = await start({ count: 1 }); const q = (await queryInterview(db, owner, result.id!))!.questions[0];
  await writeInterview(db, owner, { operation: "save", id: result.id, questionId: q.id, token: q.token, answer: { ...EMPTY_ANSWER, reasoning: "Supported reasoning", reasoningRating: 2 } });
  await writeInterview(db, owner, { operation: "finish", id: result.id }); const before = await db.mockInterview.findUniqueOrThrow({ where: { id: result.id } });
  await writeInterview(db, owner, { operation: "finish", id: result.id }); expect(await db.mockInterview.findUniqueOrThrow({ where: { id: result.id } })).toEqual(before); expect(before.score).toBe(33);
  expect(await db.userProgress.count({ where: { userId: owner } })).toBe(0); expect(await db.userSubmission.count({ where: { userId: owner } })).toBe(0);
});
it("freezes the prompt/reference across library edits and abandonment retains saved answers without score", async () => {
  const result = await start({ count: 1, topic: "strings" }); const before = (await queryInterview(db, owner, result.id!))!;
  await db.problem.update({ where: { slug: before.questions[0].prompt.slug! }, data: { title: "Changed after start", revision: { increment: 1 } } });
  await writeInterview(db, owner, { operation: "abandon", id: result.id }); const after = (await queryInterview(db, owner, result.id!))!;
  expect(after.questions[0].prompt).toEqual(before.questions[0].prompt); expect(after.status).toBe("ABANDONED"); expect(after.score).toBeNull(); expect(after.questions[0].reference).toBeTruthy();
});
it("supports original noncoding styles, rejects empty pools and finalizes expired sessions before restarting", async () => {
  await expect(start({ count: 3, kind: "BEHAVIORAL" })).rejects.toThrow(/Only 1/);
  const old = await start({ count: 1, kind: "SYSTEM_DESIGN", topic: "design" }); expect((await queryInterview(db, owner, old.id!))!.questions[0].kind).toBe("SYSTEM_DESIGN");
  await db.mockInterview.update({ where: { id: old.id }, data: { startedAt: new Date(Date.now() - 16 * 60000) } });
  const next = await start(); expect(next.id).not.toBe(old.id); expect((await queryInterview(db, owner, old.id!))?.status).toBe("COMPLETED");
});
it("limits new sessions to twenty in a rolling day", async () => {
  await db.mockInterview.createMany({ data: Array.from({ length: 20 }, () => ({ userId: owner, status: "ABANDONED" as const, durationMinutes: 15 })) });
  await expect(start()).rejects.toThrow(/20 sessions/); expect(await db.mockInterview.count()).toBe(20);
});
