import "server-only";
import { Worker } from "node:worker_threads";
import type { RunnerCase, RunnerOutcome } from "./judge0";

// In-process sandbox: the harness program runs inside a QuickJS interpreter compiled to WebAssembly, hosted in a
// Node worker thread. The interpreter has no access to Node, the filesystem, the network or the host process; it sees
// only the tiny Node-like surface the harness needs (stdin text, stdout/stderr writers, console). Memory, stack depth
// and wall-clock time are capped per case, the worker is terminated if it ever overruns the total budget, and the app
// still compares stdout JSON itself. This is a deliberate exception to the "no user code on the web server" rule,
// chosen so verified submissions work without an external provider.

export const SANDBOX_LIMITS = {
  maxCpuMs: 2000, graceMs: 500, maxMemoryKb: 262144, interpreterStackBytes: 4 * 1024 * 1024, workerStackMb: 64,
  outputBytes: 90_000, totalMs: 20_000, workerGraceMs: 5000,
} as const;

// Runs inside the worker thread. Plain CommonJS so it needs no bundling; the interpreter packages resolve from the
// deployment's node_modules exactly as the main bundle's externals do.
const WORKER_SOURCE = String.raw`
"use strict";
const { parentPort, workerData } = require("node:worker_threads");
const { isDeepStrictEqual } = require("node:util");
const core = require("quickjs-emscripten-core");
const loaded = require("@jitl/quickjs-singlefile-cjs-release-sync");
const variant = loaded.default ?? loaded;
const { source, cases, limits, config } = workerData;
const HOST = "__asHost";
const PRELUDE = [
  "const process = { exitCode: 0,",
  "  stdout: { write: (chunk) => { " + HOST + ".write(0, String(chunk)); return true; } },",
  "  stderr: { write: (chunk) => { " + HOST + ".write(1, String(chunk)); return true; } } };",
  "const console = { log: (...args) => process.stdout.write(args.map(String).join(' ') + '\\n'), error: (...args) => process.stderr.write(args.map(String).join(' ') + '\\n') };",
  "console.warn = console.error; console.info = console.log; console.debug = console.log;",
  "const require = (name) => { if (name === 'fs' || name === 'node:fs') return { readFileSync: (fd, encoding) => { if (fd !== 0) throw new Error('Only standard input is readable.'); if (encoding !== undefined && encoding !== 'utf8' && encoding !== 'utf-8') throw new Error('Read standard input as utf8.'); return " + HOST + ".stdin(); } }; throw new Error('Modules are not available in this sandbox: ' + name); };",
  "",
].join("\n");

function classify(error, cpuMs, memoryKb) {
  const dumped = error && typeof error === "object" ? error : { message: String(error) };
  if (dumped.name === "InternalError" && dumped.message === "interrupted") return { status: "TIME_LIMIT", diagnostic: "Execution exceeded " + cpuMs + " ms." };
  if (dumped.name === "InternalError" && dumped.message === "out of memory") return { status: "MEMORY_LIMIT", diagnostic: "Execution exceeded " + memoryKb + " KB." };
  if (dumped.name === "InternalError" && /stack overflow/i.test(dumped.message || "")) return { status: "RUNTIME_ERROR", diagnostic: "Maximum call stack size exceeded." };
  const text = (dumped.name || "Error") + ": " + (dumped.message || "") + (dumped.stack ? "\n" + dumped.stack : "");
  return { status: dumped.name === "SyntaxError" ? "COMPILE_ERROR" : "RUNTIME_ERROR", diagnostic: text };
}

function runCase(QuickJS, test, budgetEndsAt) {
  const output = ["", ""];
  let overflow = false;
  const write = (stream, chunk) => {
    if (output[stream].length + chunk.length > config.outputBytes) { overflow = true; throw new Error("Output exceeds the sandbox limit."); }
    output[stream] += chunk;
  };
  const cpuMs = Math.min(limits.timeMs, config.maxCpuMs);
  const memoryKb = Math.min(limits.memoryKb, config.maxMemoryKb);
  const deadline = Math.min(Date.now() + cpuMs + config.graceMs, budgetEndsAt);
  if (deadline <= Date.now()) return { status: "TIME_LIMIT", stdout: "", diagnostic: "The submission exceeded the total execution budget.", runtimeMs: null, memoryKb: null };
  const runtime = QuickJS.newRuntime();
  let started = 0, elapsed = 0, usedKb = null, failure = null;
  try {
    runtime.setMemoryLimit(memoryKb * 1024);
    runtime.setMaxStackSize(config.interpreterStackBytes);
    runtime.setInterruptHandler(core.shouldInterruptAfterDeadline(deadline));
    const vm = runtime.newContext();
    try {
      core.Scope.withScope((scope) => {
        const host = scope.manage(vm.newObject());
        vm.setProp(host, "write", scope.manage(vm.newFunction("write", (streamHandle, chunkHandle) => { write(vm.getNumber(streamHandle), vm.getString(chunkHandle)); })));
        vm.setProp(host, "stdin", scope.manage(vm.newFunction("stdin", () => vm.newString(test.stdin))));
        vm.setProp(vm.global, HOST, host);
        started = performance.now();
        const evaluated = vm.evalCode(PRELUDE + source, "submission.js");
        if (evaluated.error) { failure = classify(vm.dump(scope.manage(evaluated.error)), cpuMs, memoryKb); return; }
        scope.manage(evaluated.value);
        // The harness settles its result through Promise callbacks, which only run when jobs are executed.
        const jobs = runtime.executePendingJobs();
        if (jobs.error) { failure = classify(vm.dump(scope.manage(jobs.error)), cpuMs, memoryKb); }
      });
    } finally {
      elapsed = started ? Math.ceil(performance.now() - started) : 0;
      core.Scope.withScope((scope) => {
        const usage = vm.dump(scope.manage(runtime.computeMemoryUsage()));
        if (usage && typeof usage.memory_used_size === "number") usedKb = Math.ceil(usage.memory_used_size / 1024);
      });
      vm.dispose();
    }
  } finally { runtime.dispose(); }
  const stdout = output[0], diagnostic = output[1];
  if (overflow) return { status: "RUNTIME_ERROR", stdout: stdout.slice(0, 4000), diagnostic: "Output exceeds the sandbox limit.", runtimeMs: elapsed, memoryKb: usedKb };
  if (failure) return { status: failure.status, stdout: stdout.slice(0, 4000), diagnostic: [diagnostic, failure.diagnostic].filter(Boolean).join("\n").slice(0, 4000), runtimeMs: elapsed, memoryKb: usedKb };
  // The harness reports an uncaught error by writing it to stderr and setting a non-zero exit code; stdout stays empty.
  let status = "WRONG_ANSWER";
  if (stdout === "" && diagnostic) status = "RUNTIME_ERROR";
  else { try { if (isDeepStrictEqual(JSON.parse(stdout), test.expected)) status = "ACCEPTED"; } catch (error) { /* Non-JSON output is a wrong answer. */ } }
  return { status, stdout: stdout.slice(0, 4000), diagnostic: diagnostic.slice(0, 4000), runtimeMs: elapsed, memoryKb: usedKb };
}

(async () => {
  const QuickJS = await core.newQuickJSWASMModuleFromVariant(variant);
  const budgetEndsAt = Date.now() + config.totalMs;
  // Sequential execution keeps one interpreter alive at a time and makes the per-case timing meaningful.
  for (let index = 0; index < cases.length; index++) parentPort.postMessage({ index, outcome: runCase(QuickJS, cases[index], budgetEndsAt) });
})().catch((error) => { throw error; });
`;

const unavailable = (diagnostic: string): RunnerOutcome => ({ status: "INTERNAL_ERROR", stdout: "", diagnostic, runtimeMs: null, memoryKb: null });
const VERDICTS = new Set(["ACCEPTED", "WRONG_ANSWER", "COMPILE_ERROR", "RUNTIME_ERROR", "TIME_LIMIT", "MEMORY_LIMIT", "INTERNAL_ERROR"]);

function isOutcome(value: unknown): value is RunnerOutcome {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return VERDICTS.has(o.status as string) && typeof o.stdout === "string" && typeof o.diagnostic === "string"
    && (o.runtimeMs === null || typeof o.runtimeMs === "number") && (o.memoryKb === null || typeof o.memoryKb === "number");
}

export async function executeSandbox(source: string, cases: RunnerCase[], limits: { timeMs: number; memoryKb: number }): Promise<RunnerOutcome[]> {
  if (!cases.length || cases.length > 10) throw new Error("Unsupported test count");
  return new Promise((resolve) => {
    const outcomes: (RunnerOutcome | null)[] = cases.map(() => null);
    let settled = false;
    let worker: Worker;
    const settle = (reason: string) => {
      if (settled) return;
      settled = true; clearTimeout(guard);
      void worker.terminate();
      resolve(outcomes.map((outcome) => outcome ?? unavailable(reason)));
    };
    try {
      worker = new Worker(WORKER_SOURCE, {
        eval: true, workerData: { source, cases, limits, config: SANDBOX_LIMITS }, stdout: true, stderr: true,
        resourceLimits: { stackSizeMb: SANDBOX_LIMITS.workerStackMb, maxOldGenerationSizeMb: 1024 },
      });
    } catch { resolve(cases.map(() => unavailable("The sandbox worker could not start."))); return; }
    // The worker enforces per-case and total budgets itself; this guard only catches a wedged interpreter.
    const guard = setTimeout(() => settle("The sandbox did not finish in time."), SANDBOX_LIMITS.totalMs + SANDBOX_LIMITS.workerGraceMs);
    worker.on("message", (message: { index?: number; outcome?: unknown }) => {
      if (typeof message?.index !== "number" || !isOutcome(message.outcome) || !Object.hasOwn(outcomes, message.index)) return;
      outcomes[message.index] = message.outcome;
      if (outcomes.every((outcome) => outcome !== null)) settle("complete");
    });
    worker.on("error", () => settle("The sandbox stopped before finishing every test."));
    worker.on("exit", () => settle("The sandbox stopped before finishing every test."));
  });
}
