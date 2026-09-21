import { describe, expect, it, vi } from "vitest";
import { createContext, runInContext } from "node:vm";
import { BROWSER_WORKER_SOURCE, deepEqualJson, runInBrowser, type WorkerLike } from "@/features/submissions/browser-runner";

// Executes the real worker script inside an isolated vm context with a minimal worker-like global, so the harness
// contract (positional arguments, JSON output, console capture, error kinds) is tested rather than a stand-in.
function fakeWorker(): WorkerLike & { terminated: boolean } {
  let handlers: { message: (data: unknown) => void; error: () => void } | null = null;
  // The context object is the worker's global scope, as `self` is in a real worker; the context's own intrinsics
  // (Function, JSON, Promise, SyntaxError) are used so user code cannot reach the host realm.
  const self: Record<string, unknown> = {
    fetch: () => {}, XMLHttpRequest: class {}, WebSocket: class {}, importScripts: () => {}, EventSource: class {},
    console: { ...console }, performance,
    postMessage: (data: unknown) => { queueMicrotask(() => handlers?.message(structuredClone(data))); },
  };
  self.self = self;
  runInContext(BROWSER_WORKER_SOURCE, createContext(self));
  const worker = {
    terminated: false,
    postMessage: (message: unknown) => { (self.onmessage as (event: { data: unknown }) => void)({ data: structuredClone(message) }); },
    terminate: () => { worker.terminated = true; },
    listen: (next: typeof handlers) => { handlers = next; },
  };
  return worker;
}

const run = (code: string, cases: { input: Record<string, unknown>; expected: unknown }[], entryPoint = "solve", keys = ["a", "b"], timeLimitMs?: number) =>
  runInBrowser({ entryPoint, keys, code, cases: cases.map((c, i) => ({ position: i + 1, ...c })) }, { createWorker: fakeWorker, timeLimitMs });

describe("browser runner harness", () => {
  it("passes arguments in signature order, compares JSON structurally and reports wall-clock runtime without saving", async () => {
    const result = await run("function solve(a, b) { return { sum: a + b, pair: [b, a] }; }", [
      { input: { b: 2, a: 1 }, expected: { pair: [2, 1], sum: 3 } }, { input: { a: 5, b: 5 }, expected: { sum: 11, pair: [5, 5] } },
    ]);
    expect(result).toMatchObject({ id: "", mode: "RUN", browser: true, status: "WRONG_ANSWER", passedCount: 1, totalCount: 2, memoryKb: null });
    expect(result.cases.map((c) => c.status)).toEqual(["ACCEPTED", "WRONG_ANSWER"]);
    expect(result.cases[0].stdout).toBe('{"sum":3,"pair":[2,1]}');
    expect(result.cases[1].input).toEqual({ a: 5, b: 5 });
    expect(typeof result.runtimeMs).toBe("number");
  });
  it("classifies syntax errors, thrown errors, missing functions and non-JSON returns", async () => {
    const cases = [{ input: { a: 1, b: 1 }, expected: 2 }];
    expect((await run("function solve(a, b { return a + b; }", cases)).cases[0]).toMatchObject({ status: "COMPILE_ERROR" });
    expect((await run("function solve(a, b) { throw new Error('boom'); }", cases)).cases[0]).toMatchObject({ status: "RUNTIME_ERROR", diagnostic: expect.stringContaining("boom") });
    expect((await run("const other = 1;", cases)).cases[0]).toMatchObject({ status: "RUNTIME_ERROR", diagnostic: expect.stringContaining("solve is not defined") });
    expect((await run("function solve() { return undefined; }", cases)).cases[0]).toMatchObject({ status: "RUNTIME_ERROR", diagnostic: expect.stringContaining("Return a JSON value") });
    expect((await run("function solve() { return '2'; }", cases)).cases[0]).toMatchObject({ status: "WRONG_ANSWER", stdout: '"2"' });
  });
  it("captures console output as diagnostics, supports async functions and hides network access", async () => {
    const result = await run("async function solve(a, b) { console.log('debug', { a }); console.error('warn'); return [typeof fetch, typeof importScripts, typeof XMLHttpRequest, a + b]; }",
      [{ input: { a: 1, b: 2 }, expected: ["undefined", "undefined", "undefined", 3] }]);
    expect(result.cases[0]).toMatchObject({ status: "ACCEPTED", diagnostic: 'debug {"a":1}\nwarn' });
  });
  it("terminates a case that never returns and reports a time limit", async () => {
    vi.useFakeTimers();
    const workers: ReturnType<typeof fakeWorker>[] = [];
    const promise = runInBrowser({ entryPoint: "solve", keys: [], code: "function solve() { return new Promise(() => {}); }", cases: [{ position: 1, input: {}, expected: 1 }] },
      { createWorker: () => { const w = fakeWorker(); workers.push(w); return w; }, timeLimitMs: 100 });
    await vi.advanceTimersByTimeAsync(150);
    const result = await promise;
    vi.useRealTimers();
    expect(result.cases[0]).toMatchObject({ status: "TIME_LIMIT", runtimeMs: 100 });
    expect(result.status).toBe("TIME_LIMIT");
    expect(workers[0].terminated).toBe(true);
  });
  it("reports an infrastructure verdict when no worker can start and truncates long output", async () => {
    const failed = await runInBrowser({ entryPoint: "solve", keys: [], code: "function solve() { return 1; }", cases: [{ position: 1, input: {}, expected: 1 }] }, { createWorker: () => { throw new Error("no workers"); } });
    expect(failed.status).toBe("INTERNAL_ERROR");
    const long = await run("function solve() { return 'x'.repeat(5000); }", [{ input: { a: 0, b: 0 }, expected: "x".repeat(5000) }]);
    expect(long.cases[0].status).toBe("ACCEPTED");
    expect(long.cases[0].stdout).toHaveLength(4000);
  });
});

describe("structural JSON comparison", () => {
  it("ignores key order and rejects type coercion, extra keys and array order changes", () => {
    expect(deepEqualJson({ a: [1, { b: null }], c: "x" }, { c: "x", a: [1, { b: null }] })).toBe(true);
    expect(deepEqualJson(1, "1")).toBe(false);
    expect(deepEqualJson([1, 2], [2, 1])).toBe(false);
    expect(deepEqualJson({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(deepEqualJson(null, {})).toBe(false);
    expect(deepEqualJson([], {})).toBe(false);
  });
});
