import type { CaseResult, ExecutionResult, Verdict } from "./contracts";

// Visible tests run inside a Web Worker in the learner's own browser. Nothing is sent to or saved on the server,
// so this gives instant feedback for free; only Submit needs the external provider. The worker mirrors the Judge0
// harness contract: positional JSON arguments in, the JSON-serialized return value out, console output as diagnostics.

export const BROWSER_TIME_LIMIT_MS = 3000;
export const BROWSER_OUTPUT_LIMIT = 4000;

export const BROWSER_WORKER_SOURCE = `"use strict";
self.onmessage = function (event) {
  var data = event.data;
  var logs = [];
  var record = function () {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) {
      var item = arguments[i];
      try { parts.push(typeof item === "string" ? item : JSON.stringify(item)); } catch (error) { parts.push(String(item)); }
    }
    logs.push(parts.join(" "));
  };
  console.log = record; console.info = record; console.warn = record; console.error = record; console.debug = record;
  // This scope keeps no network or code-loading capabilities.
  self.fetch = undefined; self.XMLHttpRequest = undefined; self.WebSocket = undefined; self.importScripts = undefined; self.EventSource = undefined;
  var started = performance.now();
  var finished = false;
  var describe = function (error) { return error && error.stack ? String(error.stack) : String(error); };
  var done = function (kind, stdout, diagnostic) {
    if (finished) return;
    finished = true;
    var lines = logs.slice();
    if (diagnostic) lines.push(diagnostic);
    self.postMessage({ kind: kind, stdout: stdout, diagnostic: lines.join("\\n"), runtimeMs: Math.ceil(performance.now() - started) });
  };
  var solve;
  try { solve = new Function(data.code + "\\n;return " + data.entryPoint + ";")(); }
  catch (error) { return done(error instanceof SyntaxError ? "syntax" : "runtime", "", describe(error)); }
  if (typeof solve !== "function") return done("runtime", "", "Define a function named " + data.entryPoint + ".");
  try {
    Promise.resolve(solve.apply(null, data.args)).then(function (value) {
      var json;
      try { json = JSON.stringify(value); } catch (error) { return done("runtime", "", describe(error)); }
      if (json === undefined) return done("runtime", "", "Return a JSON value from your function.");
      done("ok", json, "");
    }, function (error) { done("runtime", "", describe(error)); });
  } catch (error) { done("runtime", "", describe(error)); }
};
`;

export type WorkerLike = { postMessage(message: unknown): void; terminate(): void; listen(handlers: { message: (data: unknown) => void; error: () => void }): void };
export type BrowserCase = { position: number; input: Record<string, unknown>; expected: unknown };
export type BrowserRunInput = { entryPoint: string; keys: string[]; code: string; cases: BrowserCase[] };
type WorkerMessage = { kind: "ok" | "syntax" | "runtime"; stdout: string; diagnostic: string; runtimeMs: number };

export function deepEqualJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => deepEqualJson(item, b[index]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && deepEqualJson(left[key], right[key]));
  }
  return false;
}

function isWorkerMessage(value: unknown): value is WorkerMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return ["ok", "syntax", "runtime"].includes(message.kind as string) && typeof message.stdout === "string" && typeof message.diagnostic === "string" && typeof message.runtimeMs === "number";
}

export function createBrowserWorker(): WorkerLike {
  const url = URL.createObjectURL(new Blob([BROWSER_WORKER_SOURCE], { type: "text/javascript" }));
  try {
    const worker = new Worker(url);
    return {
      postMessage: (message) => worker.postMessage(message), terminate: () => worker.terminate(),
      listen: ({ message, error }) => { worker.onmessage = (event) => message(event.data); worker.onerror = () => error(); },
    };
  }
  finally { URL.revokeObjectURL(url); }
}

function runCase(test: BrowserCase, input: BrowserRunInput, createWorker: () => WorkerLike, timeLimitMs: number): Promise<CaseResult> {
  const base = { position: test.position, input: test.input, expected: test.expected, memoryKb: null };
  return new Promise((resolve) => {
    let worker: WorkerLike;
    try { worker = createWorker(); }
    catch { resolve({ ...base, status: "INTERNAL_ERROR", stdout: "", diagnostic: "This browser cannot start a background worker.", runtimeMs: null }); return; }
    let settled = false;
    const finish = (result: CaseResult) => {
      if (settled) return;
      settled = true; clearTimeout(timer); worker.terminate(); resolve(result);
    };
    const timer = setTimeout(() => finish({ ...base, status: "TIME_LIMIT", stdout: "", diagnostic: `No result within ${timeLimitMs} ms. Check for infinite loops or very slow algorithms.`, runtimeMs: timeLimitMs }), timeLimitMs);
    worker.listen({
      error: () => finish({ ...base, status: "RUNTIME_ERROR", stdout: "", diagnostic: "The worker stopped before returning a result.", runtimeMs: null }),
      message: (message) => {
        if (!isWorkerMessage(message)) { finish({ ...base, status: "INTERNAL_ERROR", stdout: "", diagnostic: "Unexpected worker response.", runtimeMs: null }); return; }
        const stdout = message.stdout.slice(0, BROWSER_OUTPUT_LIMIT), diagnostic = message.diagnostic.slice(0, BROWSER_OUTPUT_LIMIT);
        let status: Verdict = message.kind === "syntax" ? "COMPILE_ERROR" : message.kind === "runtime" ? "RUNTIME_ERROR" : "WRONG_ANSWER";
        if (message.kind === "ok") {
          // Compare the complete output before truncating it for display, exactly like the server verdict.
          try { if (deepEqualJson(JSON.parse(message.stdout), test.expected)) status = "ACCEPTED"; } catch { /* Non-JSON output is a wrong answer. */ }
        }
        finish({ ...base, status, stdout, diagnostic, runtimeMs: message.runtimeMs });
      },
    });
    worker.postMessage({ code: input.code, entryPoint: input.entryPoint, args: input.keys.map((key) => test.input[key]) });
  });
}

export async function runInBrowser(input: BrowserRunInput, options: { createWorker?: () => WorkerLike; timeLimitMs?: number } = {}): Promise<ExecutionResult> {
  const createWorker = options.createWorker ?? createBrowserWorker;
  const timeLimitMs = options.timeLimitMs ?? BROWSER_TIME_LIMIT_MS;
  const cases: CaseResult[] = [];
  // Run sequentially so timings are not skewed by parallel workers on small machines.
  for (const test of input.cases) cases.push(await runCase(test, input, createWorker, timeLimitMs));
  const failure = cases.find((c) => c.status !== "ACCEPTED");
  const times = cases.map((c) => c.runtimeMs);
  return {
    id: "", mode: "RUN", browser: true, status: cases.some((c) => c.status === "INTERNAL_ERROR") ? "INTERNAL_ERROR" : failure?.status ?? "ACCEPTED",
    passedCount: cases.filter((c) => c.status === "ACCEPTED").length, totalCount: cases.length,
    runtimeMs: times.length && times.every((n) => n !== null) ? Math.max(...(times as number[])) : null, memoryKb: null, cases,
  };
}
