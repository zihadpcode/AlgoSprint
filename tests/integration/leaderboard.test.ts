import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { queryLeaderboard } from "@/features/leaderboard/query";
import { writeLeaderboardSettings } from "@/features/leaderboard/store";

let db: ReturnType<typeof createDatabaseClient>;
const tag = `lb-${randomUUID().slice(0, 8)}`;
const ids = { ada: randomUUID(), bo: randomUUID(), cy: randomUUID(), di: randomUUID(), hidden: randomUUID(), selfie: randomUUID() };
const emails = { ada: "ada-secret@example.com", hidden: "hidden-secret@example.com" };
const problems = (["EASY", "EASY", "MEDIUM", "HARD", "EASY"] as const).map((difficulty, i) => ({ id: randomUUID(), slug: `${tag}-${i}`, difficulty }));
const draft = { id: randomUUID(), slug: `${tag}-draft` };
const day = (n: number) => new Date(Date.UTC(2026, 0, n));
const solve = (userId: string, problemId: string, solvedAt: Date, selfMarked = false) =>
  db.userProgress.create({ data: { userId, problemId, status: "SOLVED", solvedAt, selfMarked, verifiedRevision: selfMarked ? null : 1, verifiedAt: selfMarked ? null : solvedAt } });
const rows = async (viewer: string | null = null) => (await queryLeaderboard(db, viewer)).entries.filter((e) => e.name.startsWith(tag));

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use an empty disposable TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url);
  await db.user.createMany({ data: [
    { id: ids.ada, displayName: `${tag} Ada` }, { id: ids.bo, displayName: `${tag} Bo` }, { id: ids.cy, displayName: `${tag} Cy` },
    { id: ids.di, displayName: `${tag} Di` }, { id: ids.hidden, displayName: `${tag} Hidden` }, { id: ids.selfie, displayName: `${tag} Selfie` },
  ] });
  await db.problem.createMany({ data: [...problems, { ...draft, difficulty: "EASY" as const }].map((p, i) => ({ ...p, title: p.slug, status: p.slug === draft.slug ? "DRAFT" as const : "PUBLISHED" as const,
    publishedAt: p.slug === draft.slug ? null : day(1), pattern: "fixture", statement: "x", constraints: ["x"], estimatedMinutes: 1 + i })) });
}, 30000);
beforeEach(async () => {
  await db.userProgress.deleteMany({ where: { userId: { in: Object.values(ids) } } });
  await db.user.updateMany({ where: { id: { in: Object.values(ids) } }, data: { leaderboardOptIn: false } });
});
afterAll(async () => {
  if (db) {
    await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
    await db.problem.deleteMany({ where: { slug: { startsWith: tag } } });
  }
  await db?.$disconnect();
});
const optIn = (...users: string[]) => db.user.updateMany({ where: { id: { in: users } }, data: { leaderboardOptIn: true } });

it("never lists users who did not opt in, even with the most solves", async () => {
  for (const [i, p] of problems.entries()) await solve(ids.hidden, p.id, day(2 + i));
  await solve(ids.ada, problems[0].id, day(2)); await optIn(ids.ada);
  const board = await rows();
  expect(board.map((e) => e.name)).toEqual([`${tag} Ada`]);
  expect(JSON.stringify(await queryLeaderboard(db, ids.hidden))).not.toContain("Hidden");
  expect((await queryLeaderboard(db, ids.hidden)).viewerEntry).toBeNull();
});

it("never exposes emails or user ids in the payload", async () => {
  await db.user.update({ where: { id: ids.ada }, data: { displayName: `${tag} Ada` } });
  await solve(ids.ada, problems[0].id, day(2)); await optIn(ids.ada);
  const payload = JSON.stringify(await queryLeaderboard(db, ids.ada));
  for (const secret of [...Object.values(emails), ...Object.values(ids), "email", "userId"]) expect(payload).not.toContain(secret);
  expect(Object.keys((await rows(ids.ada))[0]).sort()).toEqual(["easy", "hard", "isViewer", "medium", "name", "rank", "solved", "week"]);
});

it("ranks by verified solves of published problems, with difficulty split, and excludes drafts and self-marked solves", async () => {
  await solve(ids.ada, problems[0].id, day(2)); await solve(ids.ada, problems[2].id, day(3)); await solve(ids.ada, problems[3].id, day(4)); await solve(ids.ada, draft.id, day(5));
  await solve(ids.bo, problems[0].id, day(2)); await solve(ids.bo, problems[1].id, day(3));
  for (const p of problems) await solve(ids.selfie, p.id, day(2), true);
  await db.userProgress.create({ data: { userId: ids.bo, problemId: problems[4].id, status: "ATTEMPTED", attemptedAt: day(2) } });
  await optIn(ids.ada, ids.bo, ids.selfie);
  const board = await rows();
  expect(board.map((e) => [e.name, e.solved, e.easy, e.medium, e.hard])).toEqual([[`${tag} Ada`, 3, 1, 1, 1], [`${tag} Bo`, 2, 2, 0, 0]]);
  expect(board.map((e) => e.rank)).toEqual([...board.map((e) => e.rank)].sort((a, b) => a - b));
});

it("breaks ties by the earlier latest solve, then by name", async () => {
  await solve(ids.cy, problems[0].id, day(2)); await solve(ids.cy, problems[1].id, day(9));
  await solve(ids.bo, problems[0].id, day(2)); await solve(ids.bo, problems[1].id, day(5));
  await solve(ids.ada, problems[0].id, day(2)); await solve(ids.ada, problems[1].id, day(5));
  await solve(ids.di, problems[0].id, day(1));
  await optIn(ids.ada, ids.bo, ids.cy, ids.di);
  expect((await rows()).map((e) => e.name)).toEqual([`${tag} Ada`, `${tag} Bo`, `${tag} Cy`, `${tag} Di`]);
  const ranks = (await rows()).map((e) => e.rank);
  expect(new Set(ranks).size).toBe(4);
});

it("highlights the viewer's own row", async () => {
  await solve(ids.ada, problems[0].id, day(2)); await solve(ids.bo, problems[0].id, day(3)); await optIn(ids.ada, ids.bo);
  const mine = (await rows(ids.bo)).filter((e) => e.isViewer);
  expect(mine.map((e) => e.name)).toEqual([`${tag} Bo`]);
  expect((await rows(null)).some((e) => e.isViewer)).toBe(false);
});

it("round-trips opt-in and opt-out, owner-scoped", async () => {
  await solve(ids.ada, problems[0].id, day(2));
  expect(await writeLeaderboardSettings(db, ids.ada, { optIn: true, displayName: `  ${tag} Ada Lovelace  ` })).toEqual({ ok: true, optIn: true });
  expect((await rows()).map((e) => e.name)).toEqual([`${tag} Ada Lovelace`]);
  expect((await db.user.findUniqueOrThrow({ where: { id: ids.bo } })).leaderboardOptIn).toBe(false);
  expect(await writeLeaderboardSettings(db, ids.ada, { optIn: false })).toEqual({ ok: true, optIn: false });
  expect(await rows()).toEqual([]);
  expect(await writeLeaderboardSettings(db, randomUUID(), { optIn: false })).toEqual({ ok: false, reason: "missing-user" });
});

it("rejects invalid names and case-insensitive duplicates among opted-in users", async () => {
  for (const displayName of ["a", "x".repeat(41), "me@example.com", "https://spam.example", "visit example.com", "bad\u0007name", " "]) {
    await expect(writeLeaderboardSettings(db, ids.ada, { optIn: true, displayName })).rejects.toThrow();
  }
  expect(await writeLeaderboardSettings(db, ids.ada, { optIn: true, displayName: `${tag} Twin` })).toMatchObject({ ok: true });
  expect(await writeLeaderboardSettings(db, ids.bo, { optIn: true, displayName: `${tag.toUpperCase()} TWIN` })).toEqual({ ok: false, reason: "taken" });
  expect((await db.user.findUniqueOrThrow({ where: { id: ids.bo } })).leaderboardOptIn).toBe(false);
  // A name held by someone who is not opted in does not block it.
  await writeLeaderboardSettings(db, ids.ada, { optIn: false });
  expect(await writeLeaderboardSettings(db, ids.bo, { optIn: true, displayName: `${tag} Twin` })).toMatchObject({ ok: true });
});
