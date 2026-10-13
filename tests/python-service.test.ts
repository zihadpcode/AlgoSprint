import { afterEach, beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ reserve: vi.fn(), finish: vi.fn(), judge0: vi.fn(), sandbox: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/submissions/store", () => ({ reserveSubmission: f.reserve, finishSubmission: f.finish }));
vi.mock("@/features/submissions/judge0", () => ({ executeJudge0: f.judge0 }));
vi.mock("@/features/submissions/sandbox", () => ({ executeSandbox: f.sandbox }));
import { runSubmission } from "@/features/submissions/service";
import { registerPythonExecutor, type PythonCaseRequest, type PythonCaseRun, type PythonExecutor } from "@/features/submissions/python-runner";
import type { PrismaClient } from "@/generated/prisma/client";
const db = {} as PrismaClient;
const sandbox = { provider: "sandbox" as const };
const judge0 = { provider: "judge0" as const, url: "https://runner.example/", key: "private", auth: "token" as const, languageId: 102 };
const input = { slug: "relay-window", language: "PYTHON" as const, mode: "SUBMIT" as const, code: "def relay_window(loads, width): pass" };
const exited = (stdout: string, extra: Partial<Extract<PythonCaseRun, { kind: "exited" }>> = {}): PythonCaseRun => ({ kind: "exited", exitCode: 0, stdout, stderr: "", runtimeMs: 7, memoryKb: 800, ...extra });
const requests: PythonCaseRequest[] = [];
let script: (request: PythonCaseRequest) => PythonCaseRun | Promise<PythonCaseRun>;
const executor: PythonExecutor = { available: true, async runCase(request) { requests.push(request); return script(request); } };
beforeEach(() => {
  vi.clearAllMocks(); requests.length = 0; registerPythonExecutor(executor); f.finish.mockResolvedValue(undefined);
  f.reserve.mockResolvedValue({ id: "own-attempt", revision: 4, source: "PY-PROGRAM", limits: { timeMs: 2000, memoryKb: 262144 }, cases: [
    { position: 1, input: { loads: [1] }, output: 1, stdin: "visible-stdin" },
    { position: 2, input: "HIDDEN-INPUT", output: "HIDDEN-EXPECTED", stdin: "HIDDEN-STDIN" },
  ] });
  script = (request) => exited(request.stdin === "visible-stdin" ? "1" : '"HIDDEN-EXPECTED"');
});
afterEach(() => registerPythonExecutor(null));

it("dispatches Python to the registered executor and never to QuickJS or Judge0", async () => {
  const result = await runSubmission(db, "owner", input, sandbox);
  expect(f.sandbox).not.toHaveBeenCalled(); expect(f.judge0).not.toHaveBeenCalled();
  expect(requests.map((r) => [r.source, r.stdin])).toEqual([["PY-PROGRAM", "visible-stdin"], ["PY-PROGRAM", "HIDDEN-STDIN"]]);
  expect(result).toMatchObject({ success: true, result: { id: "own-attempt", problemRevision: 4, status: "ACCEPTED", passedCount: 2, totalCount: 2, runtimeMs: 7, memoryKb: 800, cases: [] } });
  expect(f.finish).toHaveBeenCalledOnce();
});
it("keeps JavaScript on the existing executors", async () => {
  f.sandbox.mockResolvedValue([{ status: "ACCEPTED", stdout: "1", diagnostic: "", runtimeMs: 1, memoryKb: 1 }, { status: "ACCEPTED", stdout: "1", diagnostic: "", runtimeMs: 1, memoryKb: 1 }]);
  await runSubmission(db, "owner", { ...input, language: "JAVASCRIPT" }, sandbox);
  expect(f.sandbox).toHaveBeenCalledOnce(); expect(requests).toHaveLength(0);
  f.judge0.mockResolvedValue([{ status: "ACCEPTED", stdout: "1", diagnostic: "", runtimeMs: 1, memoryKb: 1 }, { status: "ACCEPTED", stdout: "1", diagnostic: "", runtimeMs: 1, memoryKb: 1 }]);
  await runSubmission(db, "owner", { ...input, language: "JAVASCRIPT" }, judge0);
  expect(f.judge0).toHaveBeenCalledOnce(); expect(requests).toHaveLength(0);
});
it("returns the unavailable outcome for Python on Judge0 without calling the provider or the executor", async () => {
  f.reserve.mockResolvedValue({ id: "own-attempt", revision: 1, source: "s", limits: { timeMs: 1, memoryKb: 1 }, cases: [{ position: 1, input: [1], output: 1, stdin: "[1]" }] });
  const result = await runSubmission(db, "owner", { ...input, mode: "RUN" }, judge0);
  expect(f.judge0).not.toHaveBeenCalled(); expect(requests).toHaveLength(0);
  expect(result).toMatchObject({ success: true, result: { status: "INTERNAL_ERROR", passedCount: 0, cases: [{ status: "INTERNAL_ERROR", diagnostic: "The Python runtime is not installed on this server." }] } });
});
it("reports INTERNAL_ERROR with the install diagnostic when no executor is installed", async () => {
  registerPythonExecutor(null);
  const run = await runSubmission(db, "owner", { ...input, mode: "RUN" }, sandbox);
  expect(run).toMatchObject({ success: true, result: { status: "INTERNAL_ERROR", passedCount: 0, runtimeMs: null } });
  if (!run.success) throw new Error("unreachable");
  expect(run.result.cases.map((c) => c.diagnostic)).toEqual(Array(2).fill("The Python runtime is not installed on this server."));
});
it("maps wrong answers, runtime errors and time limits into the overall verdict", async () => {
  script = (request) => request.stdin === "visible-stdin" ? exited("2") : exited("", { exitCode: 1, stderr: "Traceback...\nValueError: bad" });
  expect(await runSubmission(db, "owner", { ...input, mode: "RUN" }, sandbox)).toMatchObject({ success: true, result: { status: "WRONG_ANSWER", passedCount: 0,
    cases: [{ position: 1, status: "WRONG_ANSWER", input: { loads: [1] }, expected: 1, stdout: "2" }, { position: 2, status: "RUNTIME_ERROR", diagnostic: "Traceback...\nValueError: bad" }] } });
  script = (request) => request.stdin === "visible-stdin" ? exited("1") : exited("", { exitCode: 1, stderr: "ValueError: bad" });
  expect(await runSubmission(db, "owner", { ...input, mode: "RUN" }, sandbox)).toMatchObject({ result: { status: "RUNTIME_ERROR", passedCount: 1 } });
  script = () => ({ kind: "time-limit", stdout: "", stderr: "", runtimeMs: 2000, memoryKb: null });
  expect(await runSubmission(db, "owner", { ...input, mode: "RUN" }, sandbox)).toMatchObject({ result: { status: "TIME_LIMIT", passedCount: 0, runtimeMs: 2000 } });
  script = (request) => request.stdin === "visible-stdin" ? exited("1") : { kind: "memory-limit", stdout: "", stderr: "MemoryError", runtimeMs: 10, memoryKb: 262144 };
  expect(await runSubmission(db, "owner", input, sandbox)).toMatchObject({ result: { status: "MEMORY_LIMIT", passedCount: 1 } });
});
it("truncates long Python output in the stored visible result", async () => {
  script = () => exited(JSON.stringify("x".repeat(9000)), { stderr: "e".repeat(9000) });
  const run = await runSubmission(db, "owner", { ...input, mode: "RUN" }, sandbox);
  if (!run.success) throw new Error("unreachable");
  expect(run.result.cases.every((c) => c.stdout.length === 4000 && c.diagnostic.length === 4000)).toBe(true);
});
it("never discloses hidden inputs, outputs, stdout or diagnostics in SUBMIT mode, in the response or the stored result", async () => {
  script = (request) => request.stdin === "visible-stdin" ? exited("1") : exited("HIDDEN-PRINT", { exitCode: 1, stdout: "HIDDEN-PRINT", stderr: "HIDDEN-ERROR HIDDEN-INPUT" });
  const result = await runSubmission(db, "owner", input, sandbox);
  expect(result).toMatchObject({ success: true, result: { status: "RUNTIME_ERROR", passedCount: 1, totalCount: 2, cases: [] } });
  for (const text of [JSON.stringify(result), JSON.stringify(f.finish.mock.calls)]) expect(text).not.toContain("HIDDEN");
});
it("persists executor failures as infrastructure errors without leaking their message", async () => {
  script = () => { throw new Error("secret-path /srv/python HIDDEN-INPUT"); };
  const result = await runSubmission(db, "owner", input, sandbox);
  expect(result).toMatchObject({ success: true, result: { status: "INTERNAL_ERROR", passedCount: 0, cases: [] } });
  expect(JSON.stringify(result)).not.toContain("secret-path"); expect(f.finish).toHaveBeenCalledOnce();
});
