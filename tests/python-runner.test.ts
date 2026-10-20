import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
// A short whole-run budget so the deadline can be tested with real timers; every other limit is unchanged.
vi.mock("@/features/submissions/limits", async (original) => {
  const actual = await original<typeof import("@/features/submissions/limits")>();
  return { ...actual, RUNNER_LIMITS: { ...actual.RUNNER_LIMITS, totalBudgetMs: 150 } };
});
import { executePython, getPythonExecutor, mapPythonRun, PYTHON_UNAVAILABLE_DIAGNOSTIC, registerPythonExecutor, unavailablePythonExecutor,
  type PythonCaseRequest, type PythonCaseRun, type PythonExecutor } from "@/features/submissions/python-runner";
import { supportedRunnerLanguages } from "@/features/submissions/runner-languages";
import { RUNNER_LIMITS } from "@/features/submissions/limits";

const limits = { timeMs: 2000, memoryKb: 262_144 };
const exited = (stdout: string, extra: Partial<Extract<PythonCaseRun, { kind: "exited" }>> = {}): PythonCaseRun =>
  ({ kind: "exited", exitCode: 0, stdout, stderr: "", runtimeMs: 5, memoryKb: 900, ...extra });
function fake(results: PythonCaseRun[] | ((request: PythonCaseRequest, index: number) => PythonCaseRun)) {
  const requests: PythonCaseRequest[] = [];
  const executor: PythonExecutor = { available: true, async runCase(request) {
    requests.push(request);
    return typeof results === "function" ? results(request, requests.length - 1) : results[requests.length - 1];
  } };
  return { executor, requests };
}
afterEach(() => registerPythonExecutor(null));

it("ships only an executor that reports the runtime as not installed", async () => {
  expect(getPythonExecutor()).toBe(unavailablePythonExecutor);
  expect(getPythonExecutor().available).toBe(false);
  expect(await executePython(getPythonExecutor(), "src", [{ stdin: "[]", expected: 1 }, { stdin: "[]", expected: 2 }], limits)).toEqual(
    Array.from({ length: 2 }, () => ({ status: "INTERNAL_ERROR", stdout: "", diagnostic: "The Python runtime is not installed on this server.", runtimeMs: null, memoryKb: null })));
  expect(PYTHON_UNAVAILABLE_DIAGNOSTIC).toBe("The Python runtime is not installed on this server.");
  expect(await unavailablePythonExecutor.runCase({ source: "", stdin: "", ...limits })).toEqual({ kind: "unavailable", diagnostic: PYTHON_UNAVAILABLE_DIAGNOSTIC });
});
it("registers and resets the executor", () => {
  const { executor } = fake([]);
  registerPythonExecutor(executor); expect(getPythonExecutor()).toBe(executor);
  registerPythonExecutor(null); expect(getPythonExecutor()).toBe(unavailablePythonExecutor);
});
it("advertises Python only for the in-process provider with an installed executor", () => {
  const sandbox = { provider: "sandbox" as const };
  const judge0 = { provider: "judge0" as const, url: "https://runner.example/", key: "k", auth: "token" as const, languageId: 102 };
  expect(supportedRunnerLanguages(null)).toEqual([]);
  expect(supportedRunnerLanguages(sandbox)).toEqual(["JAVASCRIPT"]);
  registerPythonExecutor(fake([]).executor);
  expect(supportedRunnerLanguages(sandbox)).toEqual(["JAVASCRIPT", "PYTHON"]);
  expect(supportedRunnerLanguages(judge0)).toEqual(["JAVASCRIPT"]);
  expect(supportedRunnerLanguages(null)).toEqual([]);
});
it("maps accepted and wrong answers by comparing parsed JSON, never text", () => {
  expect(mapPythonRun(exited("[1, 2, {\"a\": null}]"), [1, 2, { a: null }], limits).status).toBe("ACCEPTED");
  expect(mapPythonRun(exited("13"), 13.0, limits).status).toBe("ACCEPTED");
  expect(mapPythonRun(exited("14"), 13, limits).status).toBe("WRONG_ANSWER");
  expect(mapPythonRun(exited("[1, 2]"), [2, 1], limits).status).toBe("WRONG_ANSWER");
  expect(mapPythonRun(exited("not json"), 1, limits)).toMatchObject({ status: "WRONG_ANSWER", stdout: "not json" });
  expect(mapPythonRun(exited(""), 1, limits).status).toBe("WRONG_ANSWER");
  expect(mapPythonRun(exited('"13"'), 13, limits).status).toBe("WRONG_ANSWER");
});
it("maps runtime errors, compile errors and exit codes with the traceback as diagnostic", () => {
  const trace = "Traceback (most recent call last):\n  File \"solution.py\", line 2\nZeroDivisionError: division by zero\n";
  expect(mapPythonRun(exited("", { exitCode: 1, stderr: trace }), 1, limits)).toMatchObject({ status: "RUNTIME_ERROR", diagnostic: trace, stdout: "" });
  expect(mapPythonRun(exited("", { exitCode: 3, stderr: "SyntaxError: invalid syntax" }), 1, limits)).toMatchObject({ status: "COMPILE_ERROR", diagnostic: "SyntaxError: invalid syntax" });
  expect(mapPythonRun(exited("13", { exitCode: 137 }), 13, limits)).toMatchObject({ status: "RUNTIME_ERROR", diagnostic: "The program exited with code 137." });
  // A correct-looking stdout never rescues a failing exit code.
  expect(mapPythonRun(exited("13", { exitCode: 1, stderr: "boom" }), 13, limits).status).toBe("RUNTIME_ERROR");
});
it("maps time and memory limit reports to their verdicts", () => {
  expect(mapPythonRun({ kind: "time-limit", stdout: "", stderr: "", runtimeMs: 2000, memoryKb: null }, 1, limits))
    .toEqual({ status: "TIME_LIMIT", stdout: "", diagnostic: "Execution exceeded 2000 ms.", runtimeMs: 2000, memoryKb: null });
  expect(mapPythonRun({ kind: "memory-limit", stdout: "", stderr: "MemoryError", runtimeMs: 30, memoryKb: 262_144 }, 1, limits))
    .toMatchObject({ status: "MEMORY_LIMIT", diagnostic: "MemoryError", memoryKb: 262_144 });
  expect(mapPythonRun({ kind: "memory-limit", stdout: "", stderr: "", runtimeMs: null, memoryKb: null }, 1, limits).diagnostic).toBe("Execution exceeded 262144 KB.");
});
it("truncates stored output to 4,000 characters but compares the complete output", () => {
  const long = JSON.stringify("x".repeat(10_000));
  const accepted = mapPythonRun(exited(long), "x".repeat(10_000), limits);
  expect(accepted.status).toBe("ACCEPTED"); expect(accepted.stdout).toHaveLength(4000);
  const noisy = "start-marker\n" + "y".repeat(8000) + "\nZeroDivisionError: final line";
  const failed = mapPythonRun(exited("", { exitCode: 1, stderr: noisy }), 1, limits);
  // The exception line sits at the end of a traceback, so the tail is kept.
  expect(failed.diagnostic).toHaveLength(4000); expect(failed.diagnostic.endsWith("ZeroDivisionError: final line")).toBe(true); expect(failed.diagnostic).not.toContain("start-marker");
});
it("bounds UTF-8 bytes rather than characters for stdout and stderr", () => {
  const exact = "é".repeat((RUNNER_LIMITS.maxOutputBytes - 2) / 2);
  expect(mapPythonRun(exited(JSON.stringify(exact)), exact, limits).status).toBe("ACCEPTED");
  expect(mapPythonRun(exited(JSON.stringify(exact + "é")), exact, limits)).toMatchObject({ status: "RUNTIME_ERROR", diagnostic: "Output exceeds the sandbox limit." });
  expect(mapPythonRun(exited("1", { stderr: "é".repeat(RUNNER_LIMITS.maxOutputBytes / 2 + 1) }), 1, limits).status).toBe("RUNTIME_ERROR");
});
it("turns an executor-reported unavailability into an internal error that is not a verdict on the code", () => {
  expect(mapPythonRun({ kind: "unavailable", diagnostic: "" }, 1, limits)).toMatchObject({ status: "INTERNAL_ERROR", diagnostic: PYTHON_UNAVAILABLE_DIAGNOSTIC });
  expect(mapPythonRun({ kind: "unavailable", diagnostic: "custom" }, 1, limits)).toMatchObject({ status: "INTERNAL_ERROR", diagnostic: "custom" });
});
it("runs each case sequentially with the program, its stdin and clamped limits", async () => {
  const { executor, requests } = fake((request) => exited(request.stdin));
  const outcomes = await executePython(executor, "program", [{ stdin: "1", expected: 1 }, { stdin: "2", expected: 3 }], { timeMs: 99_999, memoryKb: 9_999_999 });
  expect(requests).toMatchObject([{ source: "program", stdin: "1", timeMs: 2000, memoryKb: 262_144 }, { source: "program", stdin: "2", timeMs: 2000, memoryKb: 262_144 }]);
  // Every case shares one run-wide deadline signal.
  expect(requests[0].signal).toBeInstanceOf(AbortSignal);
  expect(requests[1].signal).toBe(requests[0].signal);
  expect(outcomes.map((o) => o.status)).toEqual(["ACCEPTED", "WRONG_ANSWER"]);
  const small = fake([exited("1")]);
  await executePython(small.executor, "p", [{ stdin: "1", expected: 1 }], { timeMs: 500, memoryKb: 1024 });
  expect(small.requests[0]).toMatchObject({ timeMs: 500, memoryKb: 1024 });
});
it("rejects an unsupported case count", async () => {
  const { executor } = fake([]);
  await expect(executePython(executor, "p", [], limits)).rejects.toThrow("Unsupported test count");
  await expect(executePython(executor, "p", Array.from({ length: 11 }, () => ({ stdin: "", expected: 1 })), limits)).rejects.toThrow("Unsupported test count");
});
it("holds the whole run to one deadline even when an executor ignores its signal and hangs", async () => {
  let calls = 0;
  const hung: PythonExecutor = { available: true, runCase() { calls++; return new Promise<PythonCaseRun>(() => undefined); } };
  const started = Date.now();
  const outcomes = await executePython(hung, "p", [{ stdin: "", expected: 1 }, { stdin: "", expected: 1 }], limits);
  expect(Date.now() - started).toBeLessThan(2000);
  // Sequential executor: the second case is never started once the first has consumed the budget.
  expect(calls).toBe(1);
  // The platform being slow is an infrastructure outcome, never a time limit on the learner's code.
  expect(outcomes.map((o) => o.status)).toEqual(["INTERNAL_ERROR", "INTERNAL_ERROR"]);
  expect(outcomes[0].diagnostic).toContain("time budget");
});
it("does not start further batches once the budget is spent", async () => {
  let calls = 0;
  const slow: PythonExecutor & { concurrency: number } = { available: true, concurrency: 1, async runCase() { calls++; await new Promise((resolve) => setTimeout(resolve, 200)); return exited("1"); } };
  const outcomes = await executePython(slow, "p", [{ stdin: "", expected: 1 }, { stdin: "", expected: 1 }, { stdin: "", expected: 1 }], limits);
  expect(calls).toBe(1);
  expect(outcomes.map((o) => o.status)).toEqual(["INTERNAL_ERROR", "INTERNAL_ERROR", "INTERNAL_ERROR"]);
});
it("stops starting environments after an infrastructure failure", async () => {
  let calls = 0;
  const flaky: PythonExecutor & { concurrency: number } = { available: true, concurrency: 2, async runCase() { calls++; return { kind: "unavailable", diagnostic: "quota" }; } };
  const outcomes = await executePython(flaky, "p", Array.from({ length: 10 }, () => ({ stdin: "", expected: 1 })), limits);
  expect(calls).toBe(2);
  expect(outcomes).toHaveLength(10);
  expect(outcomes.every((o) => o.status === "INTERNAL_ERROR" && o.diagnostic === "quota")).toBe(true);
});
it("makes learner output safe for the jsonb column: no NUL characters, no lone surrogates", () => {
  const long = "x".repeat(3999) + "😀tail";
  const out = mapPythonRun(exited("a\u0000b" + long, { stderr: "e\u0000" + "y".repeat(3998) + "😀" }), 1, limits);
  expect(out.stdout).not.toContain("\u0000");
  expect(out.diagnostic).not.toContain("\u0000");
  for (const text of [out.stdout, out.diagnostic]) expect(text.isWellFormed()).toBe(true);
  // Truncation can split a surrogate pair; the result must still serialise to JSON that Postgres accepts.
  expect(JSON.stringify(out)).not.toMatch(/\\ud[89ab][0-9a-f]{2}(?!\\ud[c-f])/i);
});
it("treats Python's -0.0 as 0, the way JavaScript's JSON.stringify would have written it", () => {
  expect(mapPythonRun(exited("-0.0"), 0, limits).status).toBe("ACCEPTED");
  expect(mapPythonRun(exited("[1,-0.0,{\"a\":[-0.0]}]"), [1, 0, { a: [0] }], limits).status).toBe("ACCEPTED");
  expect(mapPythonRun(exited("-1.0"), 0, limits).status).toBe("WRONG_ANSWER");
  expect(mapPythonRun(exited("0.5"), 0, limits).status).toBe("WRONG_ANSWER");
  expect(mapPythonRun(exited("[0,1]"), [0, 1], limits).status).toBe("ACCEPTED");
});
