import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { SUBMISSION_HISTORY_LIMIT, queryProblemSubmissions } from "@/features/submissions/history-query";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";

let db: ReturnType<typeof createDatabaseClient>; let ownsFixtures = false; let slugs: string[] = []; let problemId: string; let otherProblemId: string;
const users = [randomUUID(), randomUUID()]; const slug = "relay-window"; const otherSlug = "quiet-badge";
const SECRET_CODE = "OTHER-USER-SOURCE-SENTINEL"; const SECRET_RESULT = "OTHER-USER-STDOUT-SENTINEL";
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use an empty disposable TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url); if (await db.problem.count()) throw new Error("Submission history tests require an empty collection.");
  const seeds = await loadProblems(); slugs = seeds.map((s) => s.slug); ownsFixtures = true;
  await seedProblems(db, seeds); await db.user.createMany({ data: users.map((id) => ({ id })) });
  problemId = (await db.problem.findUniqueOrThrow({ where: { slug } })).id;
  otherProblemId = (await db.problem.findUniqueOrThrow({ where: { slug: otherSlug } })).id;
}, 30000);
beforeEach(async () => {
  await db.userSubmission.deleteMany({ where: { userId: { in: users } } });
  await db.problem.update({ where: { id: problemId }, data: { status: "PUBLISHED" } });
});
afterAll(async () => {
  if (db && ownsFixtures) { await db.user.deleteMany({ where: { id: { in: users } } }); await db.problem.deleteMany({ where: { slug: { in: slugs } } }); }
  await db?.$disconnect();
});
const attempt = (userId: string, id: string, minutesAgo: number, extra: Record<string, unknown> = {}) => db.userSubmission.create({ data: {
  userId, problemId: id, problemRevision: 1, language: "JAVASCRIPT", mode: "SUBMIT", status: "ACCEPTED", code: "my own code", passedCount: 6, totalCount: 6,
  runtimeMs: 12, memoryKb: 2000, createdAt: new Date(Date.now() - minutesAgo * 60_000), completedAt: new Date(), ...extra } as never });

describe("owner-scoped submission history", () => {
  it("returns only the viewer's own attempts for this problem, newest first", async () => {
    const older = await attempt(users[0], problemId, 30, { status: "WRONG_ANSWER", passedCount: 2 });
    const newer = await attempt(users[0], problemId, 5);
    await attempt(users[0], otherProblemId, 1);
    const rows = await queryProblemSubmissions(db, users[0], slug);
    expect(rows.map((row) => row.id)).toEqual([newer.id, older.id]);
    expect(rows[0]).toMatchObject({ status: "ACCEPTED", mode: "SUBMIT", language: "JAVASCRIPT", passedCount: 6, totalCount: 6, runtimeMs: 12 });
  });
  it("never includes another user's attempts, code or results", async () => {
    await attempt(users[1], problemId, 1, { code: SECRET_CODE, result: { stdout: SECRET_RESULT } });
    const mine = await attempt(users[0], problemId, 2);
    const rows = await queryProblemSubmissions(db, users[0], slug);
    expect(rows.map((row) => row.id)).toEqual([mine.id]);
    const theirs = await queryProblemSubmissions(db, users[1], slug);
    expect(theirs).toHaveLength(1); expect(theirs[0].id).not.toBe(mine.id);
    expect(JSON.stringify(rows)).not.toContain(SECRET_CODE); expect(JSON.stringify(rows)).not.toContain(SECRET_RESULT);
  });
  it("selects only the display fields, never code, stored results or user and problem ids", async () => {
    await attempt(users[0], problemId, 1, { code: SECRET_CODE, result: { stdout: SECRET_RESULT } });
    const [row] = await queryProblemSubmissions(db, users[0], slug);
    expect(Object.keys(row).sort()).toEqual(["createdAt", "id", "language", "mode", "passedCount", "runtimeMs", "status", "totalCount"]);
    const json = JSON.stringify(row);
    for (const forbidden of [SECRET_CODE, SECRET_RESULT, "userId", "problemId", "code", "result"]) expect(json).not.toContain(forbidden);
  });
  it("gives guests nothing and does not query for them", async () => {
    await attempt(users[0], problemId, 1);
    expect(await queryProblemSubmissions(db, null, slug)).toEqual([]);
    expect(await queryProblemSubmissions(db, "", slug)).toEqual([]);
  });
  it("hides attempts for unpublished problems and unknown slugs", async () => {
    await attempt(users[0], problemId, 1);
    expect(await queryProblemSubmissions(db, users[0], "no-such-problem")).toEqual([]);
    await db.problem.update({ where: { id: problemId }, data: { status: "ARCHIVED" } });
    expect(await queryProblemSubmissions(db, users[0], slug)).toEqual([]);
  });
  it("caps the list at the history limit", async () => {
    await db.userSubmission.createMany({ data: Array.from({ length: SUBMISSION_HISTORY_LIMIT + 5 }, (_, index) => ({
      userId: users[0], problemId, problemRevision: 1, language: "JAVASCRIPT" as const, mode: "RUN" as const, status: "ACCEPTED" as const, code: "x", passedCount: 1, totalCount: 1,
      createdAt: new Date(Date.now() - index * 60_000), completedAt: new Date() })) });
    expect(await queryProblemSubmissions(db, users[0], slug)).toHaveLength(SUBMISSION_HISTORY_LIMIT);
  });
});
