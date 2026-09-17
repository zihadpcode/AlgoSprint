import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { querySaved } from "@/features/saved/query";
import { writeProblemChange } from "@/features/problems/detail-write";
import { queryProblem } from "@/features/problems/detail-query";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
let db: ReturnType<typeof createDatabaseClient>; let owns = false; let slugs: string[] = []; let problemId: string;
const users = [randomUUID(), randomUUID()]; const slug = "relay-window"; const filters = { q: "", page: 1 };
const extras = Array.from({ length: 12 }, (_, i) => `saved-fixture-${String(i).padStart(2, "0")}`);
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use an empty disposable TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url); if (await db.problem.count()) throw new Error("Saved tests require an empty collection.");
  const seeds = await loadProblems(); slugs = seeds.map((p) => p.slug); owns = true; await seedProblems(db, seeds);
  await db.user.createMany({ data: users.map((id) => ({ id })) });
  problemId = (await db.problem.findUniqueOrThrow({ where: { slug } })).id;
  await db.problem.createMany({ data: extras.map((slug) => ({ slug, title: slug, difficulty: "EASY" as const, status: "PUBLISHED" as const, pattern: "fixture", statement: "DO-NOT-EXPOSE", constraints: ["Fixture"], estimatedMinutes: 1 })) });
}, 30000);
beforeEach(async () => {
  await db.userNote.deleteMany({ where: { userId: { in: users } } }); await db.userProgress.deleteMany({ where: { userId: { in: users } } });
  await db.problem.update({ where: { id: problemId }, data: { status: "PUBLISHED" } });
});
afterAll(async () => { if (db && owns) { await db.user.deleteMany({ where: { id: { in: users } } }); await db.problem.deleteMany({ where: { slug: { in: [...slugs, ...extras] } } }); } await db?.$disconnect(); });
const save = (content: string, expectedContent = "", userId = users[0]) => writeProblemChange(db, userId, { slug, operation: "save-note", content, expectedContent });
const remove = (expectedContent: string) => writeProblemChange(db, users[0], { slug, operation: "delete-note", expectedContent });
it("isolates owner notes, flags and private projections; non-note lists do not include note text", async () => {
  await save("A-PRIVATE"); await save("B-PRIVATE", "", users[1]);
  await writeProblemChange(db, users[0], { slug, operation: "set-bookmark", bookmarked: "true" });
  const notes = await querySaved(db, users[0], "notes", filters); const bookmarks = await querySaved(db, users[0], "bookmarks", filters);
  expect(notes.items[0].note).toBe("A-PRIVATE"); expect(bookmarks.items[0].note).toBe("");
  expect((await querySaved(db, users[1], "bookmarks", filters)).total).toBe(0);
  for (const secret of ["B-PRIVATE", '"userId"', '"problemId"', '"statement"', '"testCases"', users[0]]) expect(JSON.stringify(notes)).not.toContain(secret);
  expect((await queryProblem(db, slug, users[0]))?.personal?.bookmarked).toBe(true);
});
it("deletes only matching saved content, is repeatable, and clearing removes the row", async () => {
  await save("old"); await save("new", "old"); expect(await remove("old")).toBe("conflict");
  expect((await querySaved(db, users[0], "notes", filters)).items[0].note).toBe("new");
  expect(await remove("new")).toBe("saved"); expect(await remove("new")).toBe("saved");
  expect(await db.userNote.count({ where: { userId: users[0] } })).toBe(0);
  await save("restored"); expect(await save("", "restored")).toBe("saved");
  expect(await db.userNote.count({ where: { userId: users[0] } })).toBe(0);
});
it("serializes concurrent edit/delete without erasing a newer edit or creating empty placeholders", async () => {
  await save("baseline");
  const outcomes = await Promise.all([save("newer", "baseline"), remove("baseline")]);
  expect(outcomes.sort()).toEqual(["conflict", "saved"]);
  const row = await db.userNote.findUnique({ where: { userId_problemId: { userId: users[0], problemId } } });
  expect(row === null || row.content === "newer").toBe(true);
});
it("keeps bookmark/review changes independent of verified solves and repeat timestamps", async () => {
  const at = new Date("2026-01-01T00:00:00Z");
  await db.userProgress.create({ data: { userId: users[0], problemId, status: "SOLVED", selfMarked: false, verifiedRevision: 1, solvedAt: at, verifiedAt: at } });
  await Promise.all([writeProblemChange(db, users[0], { slug, operation: "set-bookmark", bookmarked: "true" }), writeProblemChange(db, users[0], { slug, operation: "set-review", review: "true" })]);
  const read = () => db.userProgress.findUniqueOrThrow({ where: { userId_problemId: { userId: users[0], problemId } } });
  const first = await read(); await writeProblemChange(db, users[0], { slug, operation: "set-bookmark", bookmarked: "true" });
  expect((await read()).updatedAt).toEqual(first.updatedAt);
  await writeProblemChange(db, users[0], { slug, operation: "set-bookmark", bookmarked: "false" });
  expect(await read()).toMatchObject({ bookmarked: false, reviewLater: true, status: "SOLVED", verifiedRevision: 1, solvedAt: at, verifiedAt: at });
  expect((await querySaved(db, users[0], "review", filters)).total).toBe(1);
});
it("paginates ten at a time, retains title search and clamps out-of-range pages", async () => {
  const rows = await db.problem.findMany({ where: { slug: { in: extras } } });
  await db.userProgress.createMany({ data: rows.map(({ id }) => ({ userId: users[0], problemId: id, bookmarked: true })) });
  const first = await querySaved(db, users[0], "bookmarks", filters);
  const last = await querySaved(db, users[0], "bookmarks", { q: "", page: 999999 });
  expect(first).toMatchObject({ total: 12, pages: 2, page: 1 }); expect(first.items).toHaveLength(10); expect(last.items).toHaveLength(2); expect(last.page).toBe(2);
  expect(new Set([...first.items, ...last.items].map((p) => p.slug)).size).toBe(12);
  expect((await querySaved(db, users[0], "bookmarks", { q: "FIXTURE-11", page: 2 })).items[0].slug).toBe("saved-fixture-11");
});
it("omits archived content and blank legacy notes without deleting stored private records", async () => {
  await save("kept privately"); await writeProblemChange(db, users[0], { slug, operation: "set-review", review: "true" });
  await db.problem.update({ where: { id: problemId }, data: { status: "ARCHIVED" } });
  for (const kind of ["notes", "bookmarks", "review"] as const) expect((await querySaved(db, users[0], kind, filters)).total).toBe(0);
  expect(await remove("kept privately")).toBe("not-found");
  expect(await db.userNote.count({ where: { userId: users[0] } })).toBe(1);
  await db.problem.update({ where: { id: problemId }, data: { status: "PUBLISHED" } });
  await db.userNote.updateMany({ where: { userId: users[0] }, data: { content: "" } });
  expect((await querySaved(db, users[0], "notes", filters)).total).toBe(0);
  await expect(querySaved(db, "", "notes", filters)).rejects.toThrow();
});
