import "server-only";
import { isDeepStrictEqual } from "node:util";
import type { RunnerCase, RunnerOutcome } from "./judge0";
import { PYTHON_EXIT_COMPILE_ERROR } from "./harness-python";
import { RUNNER_LIMITS } from "./limits";
import { utf8ByteLength } from "./serialization";

// Pluggable Python execution. The application owns the generated program (harness-python.ts), the per-case limits and
// the verdict mapping below; an executor only runs one program against one stdin and reports what the process did.
// Python activation is blocked after the managed-image process-limit probe failed. See docs/PYTHON-RUNNER.md.

export const PYTHON_UNAVAILABLE_DIAGNOSTIC = "The Python runtime is not installed on this server.";
// Same bound the QuickJS sandbox applies to a program's output.
export const PYTHON_OUTPUT_BYTES = RUNNER_LIMITS.maxOutputBytes;
const DISPLAY_CHARS = 4000;

export type PythonCaseRequest = {
  source: string; stdin: string;
  // Per-case budgets, already clamped to RUNNER_LIMITS. The executor must enforce them or report the matching kind.
  timeMs: number; memoryKb: number;
  // Aborts when the whole run's budget (RUNNER_LIMITS.totalBudgetMs) is spent. An executor must stop everything it started
  // by then, including environment start-up; executePython also stops waiting on its own.
  signal?: AbortSignal;
};
export type PythonCaseRun =
  | { kind: "exited"; exitCode: number; stdout: string; stderr: string; runtimeMs: number | null; memoryKb: number | null }
  | { kind: "time-limit"; stdout: string; stderr: string; runtimeMs: number | null; memoryKb: number | null }
  | { kind: "memory-limit"; stdout: string; stderr: string; runtimeMs: number | null; memoryKb: number | null }
  | { kind: "unavailable"; diagnostic: string };

export interface PythonExecutor {
  // False means no interpreter is installed; the application then reports Python as unsupported instead of running it.
  readonly available: boolean;
  // Cases run this many at a time (default 1). Only for executors that give every case its own isolated environment.
  readonly concurrency?: number;
  // Runs one program in isolation: no host filesystem, network, environment or other processes. Resolve with
  // "unavailable" when the runtime cannot be used; reject only for unexpected infrastructure failures.
  runCase(request: PythonCaseRequest): Promise<PythonCaseRun>;
}

export const unavailablePythonExecutor: PythonExecutor = {
  available: false,
  async runCase() { return { kind: "unavailable", diagnostic: PYTHON_UNAVAILABLE_DIAGNOSTIC }; },
};

let current: PythonExecutor | null = null;
// Explicit registration supports controlled tests. Deployment flags cannot activate the managed executor until its
// aggregate resource boundary is repaired and live-verified; the October 20 probe allowed fork despite NPROC=0.
export function getPythonExecutor(): PythonExecutor {
  if (current) return current;
  return unavailablePythonExecutor;
}
// Controlled test injection. Pass null to restore the unavailable default; production code must not register an executor.
export function registerPythonExecutor(executor: PythonExecutor | null) { current = executor; }

export function pythonUnavailableOutcome(diagnostic = PYTHON_UNAVAILABLE_DIAGNOSTIC): RunnerOutcome {
  return { status: "INTERNAL_ERROR", stdout: "", diagnostic, runtimeMs: null, memoryKb: null };
}

// The traceback ends with the exception line, so keep the end of stderr when it has to be shortened.
const tail = (text: string) => text.length > DISPLAY_CHARS ? text.slice(text.length - DISPLAY_CHARS) : text;

export function mapPythonRun(run: PythonCaseRun, expected: unknown, limits: { timeMs: number; memoryKb: number }): RunnerOutcome {
  if (run.kind === "unavailable") return pythonUnavailableOutcome(run.diagnostic.slice(0, DISPLAY_CHARS) || PYTHON_UNAVAILABLE_DIAGNOSTIC);
  const base = { stdout: run.stdout.slice(0, DISPLAY_CHARS), diagnostic: tail(run.stderr), runtimeMs: run.runtimeMs, memoryKb: run.memoryKb };
  if (run.kind === "time-limit") return { ...base, status: "TIME_LIMIT", diagnostic: tail(run.stderr) || `Execution exceeded ${limits.timeMs} ms.` };
  if (run.kind === "memory-limit") return { ...base, status: "MEMORY_LIMIT", diagnostic: tail(run.stderr) || `Execution exceeded ${limits.memoryKb} KB.` };
  if (utf8ByteLength(run.stdout) > PYTHON_OUTPUT_BYTES || utf8ByteLength(run.stderr) > PYTHON_OUTPUT_BYTES) {
    return { ...base, status: "RUNTIME_ERROR", diagnostic: "Output exceeds the sandbox limit." };
  }
  if (run.exitCode === PYTHON_EXIT_COMPILE_ERROR) return { ...base, status: "COMPILE_ERROR" };
  if (run.exitCode !== 0) return { ...base, status: "RUNTIME_ERROR", diagnostic: base.diagnostic || `The program exited with code ${run.exitCode}.` };
  // The complete bounded stdout is compared; truncation above is only for display and storage.
  let status: RunnerOutcome["status"] = "WRONG_ANSWER";
  try { if (isDeepStrictEqual(JSON.parse(run.stdout), expected)) status = "ACCEPTED"; } catch { /* Non-JSON output is a wrong answer. */ }
  return { ...base, status };
}

export async function executePython(executor: PythonExecutor, source: string, cases: RunnerCase[], limits: { timeMs: number; memoryKb: number }): Promise<RunnerOutcome[]> {
  if (!cases.length || cases.length > RUNNER_LIMITS.maxCases) throw new Error("Unsupported test count");
  if (!executor.available) return cases.map(() => pythonUnavailableOutcome());
  const effective = { timeMs: Math.min(limits.timeMs, RUNNER_LIMITS.maxTimeMs), memoryKb: Math.min(limits.memoryKb, RUNNER_LIMITS.maxMemoryKb) };
  // One hard deadline for the whole run, measured on a monotonic timer from here. It covers start-up of every case.
  const budget = AbortSignal.timeout(RUNNER_LIMITS.totalBudgetMs);
  const exhausted: PythonCaseRun = { kind: "time-limit", stdout: "", stderr: "The submission exceeded the total execution budget.", runtimeMs: null, memoryKb: null };
  const budgetSpent = new Promise<PythonCaseRun>((resolve) => {
    if (budget.aborted) resolve(exhausted); else budget.addEventListener("abort", () => resolve(exhausted), { once: true });
  });
  const outcomes: RunnerOutcome[] = [];
  // Sequential unless the executor isolates every case in its own environment: one interpreter at a time keeps per-case
  // timings meaningful and memory bounded. Outcomes stay in case order either way.
  const width = Math.max(1, Math.min(executor.concurrency ?? 1, cases.length));
  for (let from = 0; from < cases.length; from += width) {
    const batch = cases.slice(from, from + width);
    // Racing the budget means a slow or misbehaving executor cannot hold the run past its deadline.
    outcomes.push(...await Promise.all(batch.map(async (test) => mapPythonRun(
      budget.aborted ? exhausted : await Promise.race([executor.runCase({ source, stdin: test.stdin, ...effective, signal: budget }), budgetSpent]),
      test.expected, effective))));
  }
  return outcomes;
}
