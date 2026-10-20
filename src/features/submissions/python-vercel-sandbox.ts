import "server-only";
import { Writable } from "node:stream";
import { Sandbox } from "@vercel/sandbox";
import { RUNNER_LIMITS } from "./limits";
import type { PythonCaseRequest, PythonCaseRun, PythonExecutor } from "./python-runner";

// Runs learner Python in Vercel Sandbox, a managed Firecracker microVM, instead of anything inside the Next.js process.
//
// Isolation choices (see docs/PYTHON-RUNNER.md):
// - One brand-new VM per test case, never reused: nothing a program leaves behind can reach another case or another user.
// - networkPolicy "deny-all", no ports, nothing mounted, no credentials or environment passed in, persistent: false.
// - The program runs as the VM's unprivileged user (no sudo), under rlimits set by a trusted bootstrap before any learner code.
// - Host side: wall-clock deadline, output capped while it streams, the VM stopped in `finally`. The provider-side `timeout`
//   is only a backstop if stop() fails.
// The expected outputs never enter the VM; the application compares the program's stdout itself.

export const PYTHON_SANDBOX_IMAGE = "vercel/sandbox/python:3.14";
export const PYTHON_SANDBOX_UNAVAILABLE = "Python execution is temporarily unavailable. Please try again in a moment.";

// How many VMs one submission starts at once, and how many this server instance runs at once across submissions.
// The cases of a run must finish inside RUNNER_LIMITS.totalBudgetMs, and VM start-up is the slow part.
const PER_RUN_CONCURRENCY = 4;
const INSTANCE_CONCURRENCY = 8;
// Time allowed for the VM to start and receive its files. Not charged against the learner's per-case time.
const START_BUDGET_MS = 12_000;
// Process start-up inside the VM. Added to the wall deadline so a program that uses its whole budget is not cut short.
const STARTUP_GRACE_MS = 600;
const VM_TTL_MS = 30_000;
const MEMORY_HEADROOM_BYTES = 32 * 1024 * 1024;
const ADDRESS_SPACE_HEADROOM_BYTES = 512 * 1024 * 1024;

// Trusted bootstrap. Lowers the limits first (the hard limits cannot be raised again without privilege), then runs the generated
// program with stdin pointed at the case input. Learner code only ever reaches Python as text inside program.py.
export const PYTHON_BOOTSTRAP = String.raw`
import os, resource, sys
here = os.path.dirname(os.path.abspath(__file__))
cpu_seconds, memory_bytes = int(sys.argv[1]), int(sys.argv[2])
def cap(kind, soft, hard=None):
    resource.setrlimit(kind, (soft, soft if hard is None else hard))
cap(resource.RLIMIT_CORE, 0)
cap(resource.RLIMIT_FSIZE, 1 << 20)
cap(resource.RLIMIT_NOFILE, 32)
cap(resource.RLIMIT_NPROC, 32)
cap(resource.RLIMIT_CPU, cpu_seconds, cpu_seconds + 1)
cap(resource.RLIMIT_DATA, memory_bytes)
cap(resource.RLIMIT_AS, memory_bytes + ${ADDRESS_SPACE_HEADROOM_BYTES - MEMORY_HEADROOM_BYTES})
sys.stdin = open(os.path.join(here, "input.json"), "r", encoding="utf-8")
with open(os.path.join(here, "program.py"), "r", encoding="utf-8") as handle:
    text = handle.read()
exec(compile(text, "program.py", "exec"), {"__name__": "__main__"})
`;

// Minimal structural view of the SDK so tests can supply a fake VM.
export type SandboxHandle = {
  writeFiles(files: { path: string; content: Buffer }[], options?: { signal?: AbortSignal }): Promise<void>;
  runCommand(options: { cmd: string; args: string[]; stdout: Writable; stderr: Writable; timeoutMs: number; signal: AbortSignal }): Promise<{ exitCode: number | null }>;
  stop(options?: { signal?: AbortSignal }): Promise<unknown>;
};
export type SandboxFactory = (signal: AbortSignal) => Promise<SandboxHandle>;

export const createVercelSandbox: SandboxFactory = (signal) => Sandbox.create({
  image: PYTHON_SANDBOX_IMAGE, resources: { vcpus: 1 }, timeout: VM_TTL_MS,
  persistent: false, networkPolicy: "deny-all", ports: [], signal,
}) as Promise<SandboxHandle>;

// Collects at most limit + 1 bytes: one byte over is enough for the outcome mapper to report "output too large".
function boundedOutput(limit: number, onExceeded: () => void) {
  const chunks: Buffer[] = [];
  let bytes = 0, exceeded = false;
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      if (!exceeded) {
        const room = limit + 1 - bytes;
        chunks.push(room >= chunk.length ? Buffer.from(chunk) : Buffer.from(chunk.subarray(0, room)));
        bytes += Math.min(room, chunk.length);
        if (bytes > limit) { exceeded = true; onExceeded(); }
      }
      callback();
    },
  });
  return { stream, text: () => Buffer.concat(chunks).toString("utf8") };
}

class Gate {
  private active = 0;
  private waiting: (() => void)[] = [];
  constructor(private readonly size: number) {}
  async run<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> {
    while (this.active >= this.size) {
      await new Promise<void>((resolve, reject) => {
        const wake = () => { signal.removeEventListener("abort", abort); resolve(); };
        const abort = () => { this.waiting = this.waiting.filter((entry) => entry !== wake); reject(new Error("queue timeout")); };
        if (signal.aborted) return abort();
        signal.addEventListener("abort", abort, { once: true });
        this.waiting.push(wake);
      });
    }
    this.active++;
    try { return await task(); }
    finally { this.active--; this.waiting.shift()?.(); }
  }
}

const unavailable = (): PythonCaseRun => ({ kind: "unavailable", diagnostic: PYTHON_SANDBOX_UNAVAILABLE });
const SIGXCPU_EXIT = 128 + 24;
const SIGKILL_EXIT = 128 + 9;

export function createVercelSandboxExecutor(factory: SandboxFactory = createVercelSandbox): PythonExecutor & { concurrency: number } {
  const gate = new Gate(INSTANCE_CONCURRENCY);
  return {
    available: true,
    concurrency: PER_RUN_CONCURRENCY,
    async runCase(request: PythonCaseRequest): Promise<PythonCaseRun> {
      const wallMs = request.timeMs + STARTUP_GRACE_MS;
      const startSignal = AbortSignal.timeout(START_BUDGET_MS + wallMs);
      try {
        return await gate.run(() => runInFreshVm(factory, request, wallMs), startSignal);
      } catch {
        // Quota, capacity, network and provider failures all look the same to the learner and are never a wrong answer.
        return unavailable();
      }
    },
  };
}

async function runInFreshVm(factory: SandboxFactory, request: PythonCaseRequest, wallMs: number): Promise<PythonCaseRun> {
  const sandbox = await factory(AbortSignal.timeout(START_BUDGET_MS));
  try {
    const limit = RUNNER_LIMITS.maxOutputBytes;
    const overflow = new AbortController();
    const stdout = boundedOutput(limit, () => overflow.abort());
    const stderr = boundedOutput(limit, () => overflow.abort());
    await sandbox.writeFiles([
      { path: "boot.py", content: Buffer.from(PYTHON_BOOTSTRAP) },
      { path: "program.py", content: Buffer.from(request.source) },
      { path: "input.json", content: Buffer.from(request.stdin) },
    ], { signal: AbortSignal.timeout(START_BUDGET_MS) });
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), wallMs);
    const started = Date.now();
    let exitCode: number | null = null;
    try {
      const command = await sandbox.runCommand({
        // -I: ignore the environment and user site; -X utf8: the program's stdout is UTF-8 regardless of the VM locale.
        cmd: "python3", args: ["-I", "-X", "utf8", "boot.py", String(Math.max(1, Math.ceil(request.timeMs / 1000))), String(request.memoryKb * 1024 + MEMORY_HEADROOM_BYTES)],
        stdout: stdout.stream, stderr: stderr.stream,
        timeoutMs: wallMs + 2000, signal: AbortSignal.any([deadline.signal, overflow.signal]),
      });
      exitCode = command.exitCode;
    } catch (error) {
      // An abort is an expected stop (deadline or output cap); anything else is an infrastructure failure.
      if (!deadline.signal.aborted && !overflow.signal.aborted) throw error;
    } finally { clearTimeout(timer); }
    const runtimeMs = Math.min(Date.now() - started, request.timeMs);
    const base = { stdout: stdout.text(), stderr: stderr.text(), runtimeMs, memoryKb: null };
    if (overflow.signal.aborted) return { kind: "exited", exitCode: exitCode ?? 1, ...base };
    if (deadline.signal.aborted || exitCode === SIGXCPU_EXIT) return { kind: "time-limit", ...base };
    if (exitCode === null) throw new Error("no exit status");
    // MemoryError is the learner's own exception (exit 1); a kill without a deadline is the kernel enforcing the data limit.
    if (/\bMemoryError\b/.test(base.stderr.slice(-2000)) || exitCode === SIGKILL_EXIT) return { kind: "memory-limit", ...base };
    return { kind: "exited", exitCode, ...base };
  } finally {
    // The provider TTL is the backstop if this fails; never block the verdict on it.
    await sandbox.stop({ signal: AbortSignal.timeout(5000) }).catch(() => undefined);
  }
}
