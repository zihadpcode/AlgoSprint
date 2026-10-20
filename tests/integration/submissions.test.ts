import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { reserveSubmission, finishSubmission, RUN_REFUSALS } from "@/features/submissions/store";
import { PYTHON_BUSY, PYTHON_DAILY_LIMIT, PYTHON_USER_LIMIT } from "@/features/submissions/python-budget";
import { runSubmission } from "@/features/submissions/service";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import type { ExecutionResult } from "@/features/submissions/contracts";
import { registerPythonExecutor } from "@/features/submissions/python-runner";
import { loadPythonStarters, seedLanguageStarters } from "../../prisma/seed-language-starters";

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
  await db.starterCode.deleteMany({ where: { language: "PYTHON" } });
  await db.userSubmission.deleteMany({ where: { userId: { in: owners } } });
  await db.userProgress.deleteMany({ where: { userId: { in: owners } } });
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
  expect(values.find((v) => "error" in v)).toEqual({ error: RUN_REFUSALS.ownActive });
  expect(await db.userSubmission.count({ where: { userId: owners[0] } })).toBe(1);
  expect(await reserveSubmission(db, owners[1], input)).not.toHaveProperty("error");
});
it("enforces persisted per-minute and per-hour quotas, including failed requests", async () => {
  for (const [count, age, message] of [[5, 10000, RUN_REFUSALS.perMinute], [30, 120000, RUN_REFUSALS.perHour]] as const) {
    await db.userSubmission.deleteMany({ where: { userId: owners[0] } });
    await db.userSubmission.createMany({ data: Array.from({ length: count }, () => ({ userId: owners[0], problemId,
      problemRevision: 1, language: "JAVASCRIPT" as const, mode: "RUN" as const, code: "fixture", status: "INTERNAL_ERROR" as const,
      createdAt: new Date(Date.now() - age), completedAt: new Date() })) });
    // Each cap names itself: hitting the per-minute cap must not claim an hourly limit, and vice versa.
    expect(await reserveSubmission(db, owners[0], input)).toEqual({ error: message });
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
  expect(await db.userProgress.findUnique({ where: { userId_problemId: { userId: owners[0], problemId } } })).toMatchObject({ status: "ATTEMPTED", verifiedRevision: null });
});

it("enforces the deployment-wide quota across different owners", async () => {
  await db.userSubmission.createMany({ data: Array.from({ length: 60 }, () => ({ userId: owners[1], problemId,
    problemRevision: 1, language: "JAVASCRIPT" as const, mode: "RUN" as const, code: "fixture", status: "INTERNAL_ERROR" as const,
    createdAt: new Date(), completedAt: new Date() })) });
  expect(await reserveSubmission(db, owners[0], input)).toEqual({ error: RUN_REFUSALS.busy });
});
it("verifies a full submission end to end through the in-process sandbox and records a verified solve", async () => {
  const optimal = "function relayWindow(loads, width) { let total = 0; for (let i = 0; i < width; i++) total += loads[i]; let best = total; for (let i = width; i < loads.length; i++) { total += loads[i] - loads[i - width]; best = Math.max(best, total); } return best; }";
  const accepted = await runSubmission(db, owners[0], { ...input, mode: "SUBMIT", code: optimal }, { provider: "sandbox" });
  expect(accepted).toMatchObject({ success: true, result: { mode: "SUBMIT", status: "ACCEPTED", cases: [] } });
  if (!accepted.success) throw new Error("unreachable");
  expect(accepted.result.passedCount).toBe(accepted.result.totalCount); expect(accepted.result.totalCount).toBeGreaterThan(2);
  expect(accepted.result.runtimeMs).not.toBeNull(); expect(accepted.result.memoryKb).toBeGreaterThan(0);
  const stored = await db.userSubmission.findUniqueOrThrow({ where: { id: accepted.result.id } });
  expect(stored).toMatchObject({ userId: owners[0], status: "ACCEPTED", mode: "SUBMIT" });
  const progress = await db.userProgress.findUnique({ where: { userId_problemId: { userId: owners[0], problemId } } });
  expect(progress?.status).toBe("SOLVED");
  const wrong = await runSubmission(db, owners[1], { ...input, mode: "SUBMIT", code: "function relayWindow() { return 13; }" }, { provider: "sandbox" });
  expect(wrong).toMatchObject({ success: true, result: { status: "WRONG_ANSWER", cases: [] } });
  if (!wrong.success) throw new Error("unreachable");
  expect(wrong.result.passedCount).toBeLessThan(wrong.result.totalCount);
  expect(JSON.stringify(wrong)).not.toContain("HIDDEN");
}, 60_000);

const pythonInput = { slug: "relay-window", language: "PYTHON" as const, mode: "RUN" as const, code: "def relay_window(loads, width):\n    return 13" };
it("rejects a language that has no starter row, without recording an attempt", async () => {
  expect(await db.starterCode.count({ where: { problemId, language: "PYTHON" } })).toBe(0);
  expect(await reserveSubmission(db, owners[0], pythonInput)).toEqual({ error: "This problem is not available to run in Python yet." });
  expect(await db.userSubmission.count()).toBe(0);
  expect(await db.userProgress.count({ where: { userId: owners[0] } })).toBe(0);
});
it("snapshots the starter row and entry point of the requested language", async () => {
  await seedLanguageStarters(db, await loadPythonStarters());
  const js = await reserve();
  expect(js.source).toContain("const __asSolve") ; expect(js.source).toContain(";return relayWindow;");
  const py = await reserveSubmission(db, owners[1], pythonInput);
  if ("error" in py) throw new Error(py.error);
  expect(py.source).toContain('__as_entry = "relay_window"'); expect(py.source).not.toContain("relayWindow");
  expect(py.source).toContain(JSON.stringify(pythonInput.code));
  expect(py.cases.map((c) => c.stdin)).toEqual(js.cases.map((c) => c.stdin));
  expect(py.cases.every((c) => c.visibility === "VISIBLE")).toBe(true);
  expect(await db.userSubmission.findUniqueOrThrow({ where: { id: py.id } })).toMatchObject({ userId: owners[1], language: "PYTHON", code: pythonInput.code, status: "RUNNING", totalCount: 2 });
});
it("shares one rate limit across languages", async () => {
  await seedLanguageStarters(db, await loadPythonStarters());
  await db.userSubmission.createMany({ data: Array.from({ length: 5 }, () => ({ userId: owners[0], problemId, problemRevision: 1, language: "JAVASCRIPT" as const,
    mode: "RUN" as const, code: "fixture", status: "INTERNAL_ERROR" as const, createdAt: new Date(Date.now() - 10000), completedAt: new Date() })) });
  expect(await reserveSubmission(db, owners[0], pythonInput)).toHaveProperty("error");
});
it("rejects Python for a slug without a reviewed signature even when a starter row exists", async () => {
  await db.starterCode.upsert({ where: { problemId_language: { problemId, language: "PYTHON" } }, create: { problemId, language: "PYTHON", entryPoint: "solve", code: "def solve(): pass" }, update: {} });
  await db.problem.update({ where: { id: problemId }, data: { slug: "custom-unsigned" } });
  try {
    expect(await reserveSubmission(db, owners[0], { ...pythonInput, slug: "custom-unsigned" })).toEqual({ error: "This problem is not available to run in Python yet." });
    expect(await db.userSubmission.count()).toBe(0);
  } finally { await db.problem.update({ where: { id: problemId }, data: { slug: input.slug } }); }
});
it("refuses a Python starter whose entry point disagrees with the reviewed signature and records nothing", async () => {
  await seedLanguageStarters(db, await loadPythonStarters());
  await db.starterCode.update({ where: { problemId_language: { problemId, language: "PYTHON" } }, data: { entryPoint: "relayWindow" } });
  await expect(reserveSubmission(db, owners[0], pythonInput)).rejects.toThrow("Unsupported runner signature");
  expect(await db.userSubmission.count()).toBe(0);
  await db.starterCode.update({ where: { problemId_language: { problemId, language: "PYTHON" } }, data: { entryPoint: "relay_window" } });
});
it("runs Python end to end through an injected executor and stores the verdict", async () => {
  await seedLanguageStarters(db, await loadPythonStarters());
  const seen: string[] = [];
  registerPythonExecutor({ available: true, async runCase(request) {
    seen.push(request.source);
    const [loads, width] = JSON.parse(request.stdin) as [number[], number];
    let best = -Infinity; for (let i = 0; i + width <= loads.length; i++) best = Math.max(best, loads.slice(i, i + width).reduce((a, b) => a + b, 0));
    return { kind: "exited", exitCode: 0, stdout: JSON.stringify(best), stderr: "", runtimeMs: 3, memoryKb: 500 };
  } });
  try {
    const accepted = await runSubmission(db, owners[0], { ...pythonInput, mode: "SUBMIT" }, { provider: "sandbox" });
    expect(accepted).toMatchObject({ success: true, result: { mode: "SUBMIT", status: "ACCEPTED", cases: [] } });
    if (!accepted.success) throw new Error("unreachable");
    expect(accepted.result.passedCount).toBe(accepted.result.totalCount); expect(seen).toHaveLength(accepted.result.totalCount);
    expect(await db.userSubmission.findUniqueOrThrow({ where: { id: accepted.result.id } })).toMatchObject({ language: "PYTHON", status: "ACCEPTED", mode: "SUBMIT" });
    expect((await db.userProgress.findUnique({ where: { userId_problemId: { userId: owners[0], problemId } } }))?.status).toBe("SOLVED");
  } finally { registerPythonExecutor(null); }
}, 30_000);

it("refuses a published non-CODING problem even with a reviewed signature and starter row, recording nothing", async () => {
  expect(await db.starterCode.count({ where: { problemId, language: "JAVASCRIPT" } })).toBe(1);
  for (const kind of ["SQL", "CONCEPTUAL", "OBJECT_ORIENTED"] as const) {
    await db.problem.update({ where: { id: problemId }, data: { kind } });
    try {
      for (const mode of ["RUN", "SUBMIT"] as const) {
        expect(await reserveSubmission(db, owners[0], { ...input, mode }), `${kind} ${mode}`).toEqual({ error: "This problem is no longer available for execution." });
      }
      expect(await db.userSubmission.count()).toBe(0);
      expect(await db.userProgress.count({ where: { userId: owners[0] } })).toBe(0);
    } finally { await db.problem.update({ where: { id: problemId }, data: { kind: "CODING" } }); }
  }
  expect(await reserveSubmission(db, owners[0], input)).not.toHaveProperty("error");
});
it("enforces the deployment-wide cap of 20 active attempts across different owners", async () => {
  const others = Array.from({ length: 4 }, () => randomUUID());
  await db.user.createMany({ data: others.map((id) => ({ id })) });
  try {
    const active = (userId: string) => ({ userId, problemId, problemRevision: 1, language: "JAVASCRIPT" as const, mode: "RUN" as const, code: "fixture", status: "RUNNING" as const, createdAt: new Date() });
    await db.userSubmission.createMany({ data: Array.from({ length: 19 }, (_, i) => active(others[i % others.length])) });
    const first = await reserveSubmission(db, owners[0], input);
    expect(first).not.toHaveProperty("error");
    await db.userSubmission.createMany({ data: [active(others[0])] });
    await db.userSubmission.updateMany({ where: { userId: owners[0] }, data: { status: "INTERNAL_ERROR", completedAt: new Date() } });
    expect(await db.userSubmission.count({ where: { status: { in: ["QUEUED", "RUNNING"] } } })).toBe(20);
    const before = await db.userSubmission.count();
    expect(await reserveSubmission(db, owners[1], input)).toEqual({ error: RUN_REFUSALS.busy });
    expect(await db.userSubmission.count()).toBe(before);
  } finally {
    await db.userSubmission.deleteMany({ where: { userId: { in: others } } });
    await db.user.deleteMany({ where: { id: { in: others } } });
  }
});
it("rejects Submit for a problem with no HIDDEN case while Run still works", async () => {
  const hidden = await db.testCase.findMany({ where: { problemId, visibility: "HIDDEN" }, select: { id: true } });
  expect(hidden.length).toBeGreaterThan(0);
  await db.testCase.updateMany({ where: { id: { in: hidden.map((t) => t.id) } }, data: { visibility: "VISIBLE" } });
  try {
    expect(await reserveSubmission(db, owners[0], { ...input, mode: "SUBMIT" })).toEqual({ error: "This problem does not have a supported test suite yet." });
    expect(await db.userSubmission.count()).toBe(0);
    expect(await reserveSubmission(db, owners[0], input)).not.toHaveProperty("error");
  } finally { await db.testCase.updateMany({ where: { id: { in: hidden.map((t) => t.id) } }, data: { visibility: "HIDDEN" } }); }
});

// Python starts one VM per case, so it has its own VM budgets on top of the request limits. JavaScript is never affected.
const pythonRows = (userId: string, count: number, totalCount: number, extra: Record<string, unknown> = {}) => db.userSubmission.createMany({ data: Array.from({ length: count }, () => ({
  userId, problemId, problemRevision: 1, language: "PYTHON" as const, mode: "RUN" as const, code: "fixture", status: "INTERNAL_ERROR" as const, totalCount,
  createdAt: new Date(Date.now() - 7_200_000), completedAt: new Date(), ...extra })) });
it("budgets Python by VMs per user per day, counting failed runs, without limiting JavaScript", async () => {
  await seedLanguageStarters(db, await loadPythonStarters());
  await pythonRows(owners[0], 6, 10);                       // 60 VMs used today, all of them failed runs
  expect(await reserveSubmission(db, owners[0], pythonInput)).toEqual({ error: PYTHON_USER_LIMIT });
  expect(await reserveSubmission(db, owners[0], input)).not.toHaveProperty("error");
  expect(await reserveSubmission(db, owners[1], pythonInput)).not.toHaveProperty("error");
});
it("renews the per-user Python budget after 24 hours", async () => {
  await seedLanguageStarters(db, await loadPythonStarters());
  await pythonRows(owners[0], 6, 10, { createdAt: new Date(Date.now() - 90_000_000) });
  expect(await reserveSubmission(db, owners[0], pythonInput)).not.toHaveProperty("error");
});
it("applies the global daily Python budget across owners and caps concurrent Python attempts", async () => {
  await seedLanguageStarters(db, await loadPythonStarters());
  await pythonRows(owners[1], 15, 10);                      // 150 VMs used today by someone else
  expect(await reserveSubmission(db, owners[0], pythonInput)).toEqual({ error: PYTHON_DAILY_LIMIT });
  await db.userSubmission.deleteMany({ where: { userId: owners[1] } });
  await pythonRows(owners[1], 2, 1, { status: "RUNNING", createdAt: new Date() });
  expect(await reserveSubmission(db, owners[0], pythonInput)).toEqual({ error: PYTHON_BUSY });
  expect(await reserveSubmission(db, owners[0], input)).not.toHaveProperty("error");
});
