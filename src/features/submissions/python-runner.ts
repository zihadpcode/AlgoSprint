import "server-only";
import { isDeepStrictEqual } from "node:util";
import type { RunnerCase, RunnerOutcome } from "./judge0";
import { PYTHON_EXIT_COMPILE_ERROR } from "./harness-python";
import { RUNNER_LIMITS } from "./limits";
import { utf8ByteLength } from "./serialization";

// Pluggable Python execution. The application owns the generated program (harness-python.ts), the per-case limits and
// the verdict mapping below; an executor only runs one program against one stdin and reports what the process did.
// No Python interpreter ships with the application: the default executor reports that the runtime is not installed.
// Choosing and vendoring a runtime is a pending owner decision, see docs/PYTHON-RUNNER.md.

export const PYTHON_UNAVAILABLE_DIAGNOSTIC = "The Python runtime is not installed on this server.";
// Same bound the QuickJS sandbox applies to a program's output.
export const PYTHON_OUTPUT_BYTES = RUNNER_LIMITS.maxOutputBytes;
const DISPLAY_CHARS = 4000;

export type PythonCaseRequest = {
  source: string; stdin: string;
  // Per-case budgets, already clamped to RUNNER_LIMITS. The executor must enforce them or report the matching kind.
  timeMs: number; memoryKb: number;
};
export type PythonCaseRun =
  | { kind: "exited"; exitCode: number; stdout: string; stderr: string; runtimeMs: number | null; memoryKb: number | null }
  | { kind: "time-limit"; stdout: string; stderr: string; runtimeMs: number | null; memoryKb: number | null }
  | { kind: "memory-limit"; stdout: string; stderr: string; runtimeMs: number | null; memoryKb: number | null }
  | { kind: "unavailable"; diagnostic: string };

export interface PythonExecutor {
  // False means no interpreter is installed; the application then reports Python as unsupported instead of running it.
  readonly available: boolean;
  // Runs one program in isolation: no host filesystem, network, environment or other processes. Resolve with
  // "unavailable" when the runtime cannot be used; reject only for unexpected infrastructure failures.
  runCase(request: PythonCaseRequest): Promise<PythonCaseRun>;
}

export const unavailablePythonExecutor: PythonExecutor = {
  available: false,
  async runCase() { return { kind: "unavailable", diagnostic: PYTHON_UNAVAILABLE_DIAGNOSTIC }; },
};

let current: PythonExecutor = unavailablePythonExecutor;
export function getPythonExecutor(): PythonExecutor { return current; }
// Called by a runtime integration when it is wired in, and by tests with a fake. Pass null to restore the default.
export function registerPythonExecutor(executor: PythonExecutor | null) { current = executor ?? unavailablePythonExecutor; }

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
  const endsAt = Date.now() + RUNNER_LIMITS.totalBudgetMs;
  const outcomes: RunnerOutcome[] = [];
  // Sequential on purpose: one interpreter at a time keeps per-case timings meaningful and memory bounded.
  for (const test of cases) {
    if (Date.now() >= endsAt) {
      outcomes.push({ status: "TIME_LIMIT", stdout: "", diagnostic: "The submission exceeded the total execution budget.", runtimeMs: null, memoryKb: null });
      continue;
    }
    outcomes.push(mapPythonRun(await executor.runCase({ source, stdin: test.stdin, ...effective }), test.expected, effective));
  }
  return outcomes;
}
