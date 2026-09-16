import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { reserveSubmission, finishSubmission } from "@/features/submissions/store";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import type { ExecutionResult } from "@/features/submissions/contracts";

let db: ReturnType<typeof createDatabaseClient>;
let ownsFixtures = false;
let slugs: string[] = [];
let problemId: string;
const owners = [randomUUID(), randomUUID()];
const input = { slug: "relay-window", language: "JAVASCRIPT" as const, mode: "RUN" as const, code: "function relayWindow() { return 13; }" };
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use a disposable TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Submission tests require an empty problem collection.");
  const seeds = await loadProblems(); slugs = seeds.map((seed) => seed.slug); ownsFixtures = true;
  await seedProblems(db, seeds); await db.user.createMany({ data: owners.map((id) => ({ id })) });
  problemId = (await db.problem.findUniqueOrThrow({ where: { slug: input.slug } })).id;
}, 30_000);
beforeEach(async () => {
  await db.userSubmission.deleteMany({ where: { userId: { in: owners } } });
  await db.problem.update({ where: { id: problemId }, data: { status: "PUBLISHED" } });
});
afterAll(async () => {
  if (db && ownsFixtures) {
    await db.user.deleteMany({ where: { id: { in: owners } } });
    await db.problem.deleteMany({ where: { slug: { in: slugs } } });
  }
  await db?.$disconnect();
});
function result(id: string): ExecutionResult { return { id, mode: "RUN", status: "ACCEPTED", passedCount: 2, totalCount: 2, runtimeMs: 12, memoryKb: 1024, cases: [] }; }
async function reserve(owner = owners[0], mode: "RUN" | "SUBMIT" = "RUN") {
  const value = await reserveSubmission(db, owner, { ...input, mode });
  if ("error" in value) throw new Error(value.error);
  return value;
}
it("snapshots only visible cases for Run and the full suite for Submit", async () => {
  const run = await reserve(); expect(run.cases).toHaveLength(2);
  expect(run.cases.every((test) => test.visibility === "VISIBLE")).toBe(true);
  const submit = await reserve(owners[1], "SUBMIT"); expect(submit.cases).toHaveLength(6);
  expect(submit.cases.filter((test) => test.visibility === "HIDDEN")).toHaveLength(4);
  expect(JSON.parse(run.cases[0].stdin)).toEqual([[3, 1, 5, 2, 6, 1], 3]);
  const saved = await db.userSubmission.findUniqueOrThrow({ where: { id: run.id } });
  expect(saved).toMatchObject({ userId: owners[0], status: "RUNNING", code: input.code, problemRevision: run.revision, totalCount: 2 });
});
it("denies archived and absent problems without recording or executing an attempt", async () => {
  await db.problem.update({ where: { id: problemId }, data: { status: "ARCHIVED" } });
  expect(await reserveSubmission(db, owners[0], input)).toHaveProperty("error");
  expect(await reserveSubmission(db, owners[0], { ...input, slug: "not-present" })).toHaveProperty("error");
  expect(await db.userSubmission.count()).toBe(0);
});
it("allows one concurrent reservation per owner across database connections", async () => {
  const values = await Promise.all([reserveSubmission(db, owners[0], input), reserveSubmission(db, owners[0], input)]);
  expect(values.filter((v) => "error" in v)).toHaveLength(1);
  expect(await db.userSubmission.count({ where: { userId: owners[0] } })).toBe(1);
  expect(await reserveSubmission(db, owners[1], input)).not.toHaveProperty("error");
});
it("enforces persisted per-minute and per-hour quotas, including failed requests", async () => {
  for (const [count, age] of [[5, 10000], [30, 120000]]) {
    await db.userSubmission.deleteMany({ where: { userId: owners[0] } });
    await db.userSubmission.createMany({ data: Array.from({ length: count }, () => ({ userId: owners[0], problemId,
      problemRevision: 1, language: "JAVASCRIPT" as const, mode: "RUN" as const, code: "fixture", status: "INTERNAL_ERROR" as const,
      createdAt: new Date(Date.now() - age), completedAt: new Date() })) });
    expect(await reserveSubmission(db, owners[0], input)).toHaveProperty("error");
  }
});
it("recovers abandoned reservations after two minutes without fabricating success", async () => {
  const first = await reserve();
  await db.userSubmission.update({ where: { id: first.id }, data: { createdAt: new Date(Date.now() - 130000) } });
  await reserve();
  expect(await db.userSubmission.findUnique({ where: { id: first.id } })).toMatchObject({ status: "INTERNAL_ERROR", passedCount: 0, result: null, completedAt: expect.any(Date) });
});
it("persists a final verdict only for its owner and only once", async () => {
  const first = await reserve();
  await expect(finishSubmission(db, owners[1], result(first.id))).rejects.toThrow();
  await finishSubmission(db, owners[0], result(first.id));
  const saved = await db.userSubmission.findUniqueOrThrow({ where: { id: first.id } });
  expect(saved).toMatchObject({ status: "ACCEPTED", passedCount: 2, runtimeMs: 12, result: result(first.id), completedAt: expect.any(Date) });
  await expect(finishSubmission(db, owners[0], { ...result(first.id), status: "WRONG_ANSWER" })).rejects.toThrow();
  expect(await db.userProgress.count({ where: { userId: { in: owners } } })).toBe(0);
});

it("enforces the deployment-wide quota across different owners", async () => {
  await db.userSubmission.createMany({ data: Array.from({ length: 60 }, () => ({ userId: owners[1], problemId,
    problemRevision: 1, language: "JAVASCRIPT" as const, mode: "RUN" as const, code: "fixture", status: "INTERNAL_ERROR" as const,
    createdAt: new Date(), completedAt: new Date() })) });
  expect(await reserveSubmission(db, owners[0], input)).toHaveProperty("error");
});
