import { describe, expect, it, vi } from "vitest";
import { createContext, runInContext } from "node:vm";
import { BROWSER_OUTPUT_LIMIT, BROWSER_RESULT_LIMIT, BROWSER_WORKER_SOURCE, deepEqualJson, runInBrowser, type WorkerLike } from "@/features/submissions/browser-runner";

// Executes the real worker script inside an isolated vm context with a minimal worker-like global, so the harness
// contract (positional arguments, JSON output, console capture, error kinds) is tested rather than a stand-in.
function fakeWorker(onTransfer?: (data: unknown) => void): WorkerLike & { terminated: boolean } {
  let handlers: { message: (data: unknown) => void; error: () => void } | null = null;
  // The context object is the worker's global scope, as `self` is in a real worker; the context's own intrinsics
  // (Function, JSON, Promise, SyntaxError) are used so user code cannot reach the host realm.
  const self: Record<string, unknown> = {
    fetch: () => {}, XMLHttpRequest: class {}, WebSocket: class {}, importScripts: () => {}, EventSource: class {},
    console: { ...console }, performance,
    postMessage: (data: unknown) => { onTransfer?.(data); queueMicrotask(() => handlers?.message(structuredClone(data))); },
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
  it("reports an infrastructure verdict when no worker can start and compares full bounded output before display truncation", async () => {
    const failed = await runInBrowser({ entryPoint: "solve", keys: [], code: "function solve() { return 1; }", cases: [{ position: 1, input: {}, expected: 1 }] }, { createWorker: () => { throw new Error("no workers"); } });
    expect(failed.status).toBe("INTERNAL_ERROR");
    const long = await run("function solve() { return 'x'.repeat(5000); }", [{ input: { a: 0, b: 0 }, expected: "x".repeat(5000) }]);
    expect(long.cases[0].status).toBe("ACCEPTED");
    expect(long.cases[0].stdout).toHaveLength(4000);
  });
  it("bounds repeated and oversized logs before transferring them from the worker", async () => {
    const transfers: { diagnostic: string; stdout: string }[] = [];
    const result = await runInBrowser({ entryPoint: "solve", keys: [],
      code: "function solve() { for (let i = 0; i < 10000; i++) console.log('x'.repeat(100)); console.error('y'.repeat(1000000)); return 7; }",
      cases: [{ position: 1, input: {}, expected: 7 }] },
      { createWorker: () => fakeWorker((message) => transfers.push(message as typeof transfers[number])) });
    expect(result.status).toBe("ACCEPTED");
    expect(transfers).toHaveLength(1);
    expect(transfers[0].diagnostic.length).toBeLessThanOrEqual(BROWSER_OUTPUT_LIMIT);
    expect(transfers[0].diagnostic).toContain("[Diagnostics truncated]");
    expect(transfers[0].stdout).toBe("7");
  });
  it("stops inspecting logged values after the diagnostic buffer fills", async () => {
    const result = await run("function solve() { let touched = 0; console.log('x'.repeat(5000)); for (let i = 0; i < 100; i++) console.log({ toJSON() { touched++; return 'expensive'; } }); return touched; }",
      [{ input: {}, expected: 0 }]);
    expect(result.status).toBe("ACCEPTED");
    const exactFill = await run(`function solve() { let touched = 0; console.log('x'.repeat(${BROWSER_OUTPUT_LIMIT}), { toJSON() { touched++; return 0; } }); return touched; }`, [{ input: {}, expected: 0 }]);
    expect(exactFill.status).toBe("ACCEPTED");
  });
  it("accepts JSON exactly at the result limit and rejects oversized results without transferring them", async () => {
    const atLimit = "x".repeat(BROWSER_RESULT_LIMIT - 2);
    expect((await run(`function solve() { return 'x'.repeat(${BROWSER_RESULT_LIMIT - 2}); }`, [{ input: {}, expected: atLimit }])).status).toBe("ACCEPTED");
    expect((await run("function solve() { return Array(20000).fill(0); }", [{ input: {}, expected: Array(20000).fill(0) }])).status).toBe("ACCEPTED");
    for (const expression of ["'x'.repeat(1000000)", "Array(100000).fill(0)", "{ toJSON() { return 'x'.repeat(1000000); } }", "'\\u0001'.repeat(20000)"]) {
      const transfers: { kind: string; stdout: string; diagnostic: string }[] = [];
      const result = await runInBrowser({ entryPoint: "solve", keys: [], code: `function solve() { return ${expression}; }`, cases: [{ position: 1, input: {}, expected: null }] },
        { createWorker: () => fakeWorker((message) => transfers.push(message as typeof transfers[number])) });
      expect(result.status).toBe("RUNTIME_ERROR");
      expect(transfers[0]).toMatchObject({ kind: "output-limit", stdout: "", diagnostic: expect.stringContaining("Output exceeds") });
      expect(transfers[0].diagnostic.length).toBeLessThanOrEqual(BROWSER_OUTPUT_LIMIT);
    }
  });
  it("bounds object diagnostics and runtime errors while preserving cyclic-result failures", async () => {
    const logged = await run("function solve() { console.log({ huge: 'x'.repeat(1000000) }); return 1; }", [{ input: {}, expected: 1 }]);
    expect(logged.status).toBe("ACCEPTED");
    expect(logged.cases[0].diagnostic).toContain("Value exceeds output limit");
    const noisyFailure = await run("function solve() { console.log('x'.repeat(5000)); return 'y'.repeat(1000000); }", [{ input: {}, expected: null }]);
    expect(noisyFailure.status).toBe("RUNTIME_ERROR");
    expect(noisyFailure.cases[0].diagnostic).toContain("Output exceeds the browser runner limit");
    expect(noisyFailure.cases[0].diagnostic.length).toBeLessThanOrEqual(BROWSER_OUTPUT_LIMIT);
    const thrown = await run("function solve() { throw new Error('x'.repeat(1000000)); }", [{ input: {}, expected: 1 }]);
    expect(thrown.status).toBe("RUNTIME_ERROR");
    expect(thrown.cases[0].diagnostic.length).toBeLessThanOrEqual(BROWSER_OUTPUT_LIMIT);
    const cyclic = await run("function solve() { const a = {}; a.self = a; return a; }", [{ input: {}, expected: null }]);
    expect(cyclic.status).toBe("RUNTIME_ERROR");
  });
  it("rejects malformed, oversized and non-finite worker responses and always terminates the worker", async () => {
    for (const extra of [{ stdout: "x".repeat(BROWSER_RESULT_LIMIT + 1) }, { diagnostic: "x".repeat(BROWSER_OUTPUT_LIMIT + 1) }, { runtimeMs: NaN }, { runtimeMs: -1 }, { kind: "unknown" }]) {
      let receive: (data: unknown) => void = () => {};
      const terminate = vi.fn();
      const result = await runInBrowser({ entryPoint: "solve", keys: [], code: "", cases: [{ position: 1, input: {}, expected: 1 }] }, {
        createWorker: () => ({ listen: ({ message }) => { receive = message; }, terminate,
          postMessage: () => receive({ kind: "ok", stdout: "1", diagnostic: "", runtimeMs: 1, ...extra }) }),
      });
      expect(result.status).toBe("INTERNAL_ERROR");
      expect(terminate).toHaveBeenCalledOnce();
    }
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
