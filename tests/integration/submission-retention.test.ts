import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { Prisma } from "@/generated/prisma/client";
import { createDatabaseClient } from "@/lib/db/client";
import { pruneSubmissionPayloads } from "@/features/submissions/retention";
import { finishSubmission, reserveSubmission } from "@/features/submissions/store";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";

let db: ReturnType<typeof createDatabaseClient>;
let problemId: string;
let ownsFixtures = false;
const owners = [randomUUID(), randomUUID()];
const savedAt = new Date("2026-10-14T12:00:00Z");
const cutoff = new Date(savedAt.getTime() - 30 * 24 * 3600_000);
const old = new Date(cutoff.getTime() - 1);
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use a disposable TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Retention tests require an empty problem collection.");
  const fixture = (await loadProblems()).find((problem) => problem.slug === "relay-window")!;
  ownsFixtures = true;
  await seedProblems(db, [{ ...fixture, relatedSlugs: [] }]);
  await db.user.createMany({ data: owners.map((id) => ({ id })) });
  problemId = (await db.problem.findUniqueOrThrow({ where: { slug: fixture.slug } })).id;
}, 30_000);
beforeEach(async () => {
  await db.userSubmission.deleteMany({ where: { userId: { in: owners } } });
  await db.userProgress.deleteMany({ where: { userId: { in: owners } } });
  await db.problem.update({ where: { id: problemId }, data: { status: "PUBLISHED" } });
});
afterAll(async () => {
  if (db && ownsFixtures) {
    await db.user.deleteMany({ where: { id: { in: owners } } });
    await db.problem.deleteMany({ where: { id: problemId } });
  }
  await db?.$disconnect();
});
function attempt(overrides: Partial<Prisma.UserSubmissionCreateManyInput> = {}): Prisma.UserSubmissionCreateManyInput {
  return { id: randomUUID(), userId: owners[0], problemId, problemRevision: 1, language: "PYTHON", mode: "SUBMIT", status: "WRONG_ANSWER", code: "private code", result: { diagnostic: "private output" }, passedCount: 1, totalCount: 2, runtimeMs: 9, memoryKb: 100, createdAt: old, completedAt: new Date(old.getTime() + 1), ...overrides };
}
async function rows() { return db.userSubmission.findMany({ orderBy: { id: "asc" } }); }
it("uses a strict elapsed-time cutoff and distinguishes SQL null from JSON null", async () => {
  const values = [attempt(), attempt({ createdAt: cutoff }), attempt({ createdAt: new Date(cutoff.getTime() + 1) }), attempt({ code: "", result: Prisma.JsonNull }), attempt({ code: "", result: Prisma.DbNull })];
  await db.userSubmission.createMany({ data: values });
  expect(await pruneSubmissionPayloads(db, owners[0], savedAt)).toBe(2);
  for (const [index, value] of values.entries()) {
    const row = await db.userSubmission.findUniqueOrThrow({ where: { id: value.id } });
    expect(row.code).toBe(index === 0 || index === 3 || index === 4 ? "" : "private code");
  }
  expect(await db.$queryRaw<Array<{ isNull: boolean }>>`SELECT result IS NULL AS "isNull" FROM app."UserSubmission" WHERE id=${values[3].id}::uuid`).toEqual([{ isNull: true }]);
  expect(await pruneSubmissionPayloads(db, owners[0], savedAt)).toBe(0);
});
it("clears the oldest 50 then the remainder, preserving every summary and progress field", async () => {
  const values = Array.from({ length: 53 }, (_, index) => attempt({ id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, createdAt: new Date(old.getTime() - (index < 3 ? 1000 : 0)) }));
  await db.userSubmission.createMany({ data: values });
  await db.userProgress.create({ data: { userId: owners[0], problemId, status: "SOLVED", solvedAt: old, verifiedAt: old, verifiedRevision: 1 } });
  const before = await rows(); const progress = await db.userProgress.findMany();
  expect(await pruneSubmissionPayloads(db, owners[0], savedAt)).toBe(50);
  const middle = await rows();
  expect(middle.map((row) => row.code === "")).toEqual(Array.from({ length: 53 }, (_, index) => index < 50));
  expect(await pruneSubmissionPayloads(db, owners[0], savedAt)).toBe(3);
  expect(await pruneSubmissionPayloads(db, owners[0], savedAt)).toBe(0);
  expect(await rows()).toEqual(before.map((row) => ({ ...row, code: "", result: null })));
  expect(await db.userProgress.findMany()).toEqual(progress);
});
it("preserves other owners and queued, running, and incomplete history", async () => {
  await db.userSubmission.createMany({ data: [attempt({ userId: owners[1] }), attempt({ status: "QUEUED", completedAt: null }), attempt({ status: "RUNNING", completedAt: null }), attempt({ completedAt: null })] });
  const before = await rows();
  expect(await pruneSubmissionPayloads(db, owners[0], savedAt)).toBe(0);
  expect(await rows()).toEqual(before);
});
it("skips held rows and does not acquire the deployment admission lock", async () => {
  const held = attempt({ createdAt: new Date(old.getTime() - 1000) }); const free = attempt();
  await db.userSubmission.createMany({ data: [held, free] });
  let release!: () => void; const released = new Promise<void>((resolve) => { release = resolve; });
  let ready!: () => void; const locked = new Promise<void>((resolve) => { ready = resolve; });
  const holder = db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(728551, 8)`;
    await tx.$queryRaw`SELECT id FROM app."UserSubmission" WHERE id=${held.id}::uuid FOR UPDATE`;
    ready(); await released;
  }, { timeout: 5000 });
  await locked;
  try {
    expect(await pruneSubmissionPayloads(db, owners[0], savedAt)).toBe(1);
    expect((await db.userSubmission.findUniqueOrThrow({ where: { id: held.id } })).code).toBe("private code");
    expect((await db.userSubmission.findUniqueOrThrow({ where: { id: free.id } })).code).toBe("");
  } finally { release(); await holder; }
  expect(await pruneSubmissionPayloads(db, owners[0], savedAt)).toBe(1);
});
it("rolls back the entire batch on a real statement timeout", async () => {
  await db.userSubmission.createMany({ data: [attempt(), attempt()] });
  const before = await rows();
  // Disposable database only: make row updates slow enough to exceed the helper's statement budget.
  await db.$executeRawUnsafe(`CREATE FUNCTION app.retention_test_delay() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.15); RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER retention_test_delay BEFORE UPDATE ON app."UserSubmission" FOR EACH ROW EXECUTE FUNCTION app.retention_test_delay()`);
  try { await expect(pruneSubmissionPayloads(db, owners[0], savedAt)).rejects.toThrow(/57014|statement timeout/); }
  finally {
    await db.$executeRawUnsafe(`DROP TRIGGER retention_test_delay ON app."UserSubmission"`);
    await db.$executeRawUnsafe(`DROP FUNCTION app.retention_test_delay()`);
  }
  expect(await rows()).toEqual(before);
  expect(await pruneSubmissionPayloads(db, owners[0], savedAt)).toBe(2);
});
it("cleans after a saved non-accepted verdict while retaining the new result", async () => {
  const past = new Date(Date.now() - 31 * 24 * 3600_000);
  const retained = attempt({ createdAt: past, completedAt: past }); await db.userSubmission.create({ data: retained });
  const reservation = await reserveSubmission(db, owners[0], { slug: "relay-window", language: "JAVASCRIPT", mode: "RUN", code: "function relayWindow() { return 13; }" });
  if ("error" in reservation) throw new Error(reservation.error);
  const verdict = { id: reservation.id, mode: "RUN" as const, status: "WRONG_ANSWER" as const, passedCount: 1, totalCount: reservation.cases.length, runtimeMs: 9, memoryKb: 100, cases: [] };
  await finishSubmission(db, owners[0], verdict);
  expect(await db.userSubmission.findUniqueOrThrow({ where: { id: retained.id } })).toMatchObject({ code: "", result: null });
  expect(await db.userSubmission.findUniqueOrThrow({ where: { id: reservation.id } })).toMatchObject({ code: "function relayWindow() { return 13; }", result: verdict, status: "WRONG_ANSWER" });
});
it("does not clear payloads on unavailable, absent, quota-rejected, or invalid completion requests", async () => {
  const retained = attempt(); await db.userSubmission.create({ data: retained });
  const input = { slug: "relay-window", language: "JAVASCRIPT" as const, mode: "RUN" as const, code: "function relayWindow() { return 13; }" };
  await db.problem.update({ where: { id: problemId }, data: { status: "ARCHIVED" } });
  expect(await reserveSubmission(db, owners[0], input)).toHaveProperty("error");
  expect(await reserveSubmission(db, owners[0], { ...input, slug: "not-present" })).toHaveProperty("error");
  await db.problem.update({ where: { id: problemId }, data: { status: "PUBLISHED" } });
  await db.userSubmission.createMany({ data: Array.from({ length: 5 }, () => attempt({ createdAt: new Date() })) });
  expect(await reserveSubmission(db, owners[0], input)).toHaveProperty("error");
  await expect(finishSubmission(db, owners[1], { id: retained.id!, mode: "SUBMIT", status: "WRONG_ANSWER", passedCount: 1, totalCount: 2, runtimeMs: 9, memoryKb: 100, cases: [] })).rejects.toThrow();
  expect(await db.userSubmission.findUniqueOrThrow({ where: { id: retained.id } })).toMatchObject({ code: "private code", result: { diagnostic: "private output" } });
});
