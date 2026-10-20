import "server-only";
import { Sandbox } from "@vercel/sandbox";
import { RUNNER_LIMITS } from "./limits";
import type { PythonCaseRequest, PythonCaseRun, PythonExecutor } from "./python-runner";

// Runs learner Python in Vercel Sandbox, a managed Firecracker microVM, instead of anything inside the Next.js process.
//
// Isolation choices (see docs/PYTHON-RUNNER.md):
// - One brand-new VM per test case, never reused: nothing a program leaves behind can reach another case or another user.
// - networkPolicy "deny-all", no ports, nothing mounted, no credentials or environment passed in, persistent: false.
// - The program runs as the VM's unprivileged user (no sudo), under rlimits set by a trusted bootstrap before any learner code.
// - Host side: one hard deadline for the whole run, a wall-clock deadline per case, output consumed through a bounded
//   collector (never through SDK-accumulated streams), the command killed and the VM stopped in `finally`. The provider-side
//   `timeout` is only a backstop if stop() fails.
// The expected outputs never enter the VM; the application compares the program's stdout itself.
//
// What is NOT claimed: rlimits are per process. The bootstrap attempts to forbid new processes and threads (see below).
// A trusted live probe allowed fork despite NPROC=0: do not activate this executor until an aggregate boundary is verified.
// The VM itself (one vCPU, 2 GiB, 30 s TTL, no network) bounds the damage of anything that slips through.

export const PYTHON_SANDBOX_IMAGE = "vercel/sandbox/python:3.14";
export const PYTHON_SANDBOX_UNAVAILABLE = "Python execution is temporarily unavailable. Please try again in a moment.";
export const PYTHON_BUDGET_EXHAUSTED = "The submission exceeded the total execution budget.";

// Absolute, so the bootstrap and the working directory do not depend on where the SDK starts a command.
export const PYTHON_RUN_DIR = "/vercel/sandbox";

// How many VMs one submission starts at once, and how many this server instance runs at once across submissions. The
// instance gate is a courtesy that keeps one busy server from queueing itself; it is NOT a project-wide limit. Total
// concurrency across serverless instances is bounded only by the provider's own quota.
const PER_RUN_CONCURRENCY = 5;
const INSTANCE_CONCURRENCY = 8;
// Time allowed for the VM to start and receive its files. Not charged against the learner's per-case time, but always
// bounded by the run's total budget.
const START_BUDGET_MS = 12_000;
// Process start-up inside the VM. Added to the wall deadline so a program that uses its whole budget is not cut short.
const STARTUP_GRACE_MS = 600;
// After the program exits, how long to wait for its last output to arrive.
const DRAIN_MS = 1500;
const CLEANUP_TIMEOUT_MS = 2000;
const VM_TTL_MS = 30_000;
const MEMORY_HEADROOM_BYTES = 32 * 1024 * 1024;
const ADDRESS_SPACE_HEADROOM_BYTES = 512 * 1024 * 1024;

// Trusted bootstrap. Lowers the limits first (hard limits cannot be raised again without privilege), then runs the generated
// program with stdin pointed at the case input. Learner code only ever reaches Python as text inside program.py.
// Reject root and irreversibly disable privilege gains across exec before learner code. NPROC=0 avoids relying on a racy
// snapshot of /proc, but the live fork-denial probe failed; it is not a verified aggregate boundary in the managed image.
export const PYTHON_BOOTSTRAP = String.raw`
import ctypes, os, resource, sys
if os.getuid() == 0 or os.geteuid() == 0:
    raise RuntimeError("Python bootstrap requires an unprivileged user")
libc = ctypes.CDLL(None, use_errno=True)
PR_SET_NO_NEW_PRIVS, PR_GET_NO_NEW_PRIVS = 38, 39
if libc.prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0 or libc.prctl(PR_GET_NO_NEW_PRIVS, 0, 0, 0, 0) != 1:
    raise RuntimeError("Python bootstrap cannot disable privilege gains")
here = os.path.dirname(os.path.abspath(__file__))
cpu_seconds, memory_bytes = int(sys.argv[1]), int(sys.argv[2])
def cap(kind, soft, hard=None):
    resource.setrlimit(kind, (soft, soft if hard is None else hard))
cap(resource.RLIMIT_NPROC, 0)
cap(resource.RLIMIT_CORE, 0)
cap(resource.RLIMIT_FSIZE, 1 << 20)
cap(resource.RLIMIT_NOFILE, 32)
cap(resource.RLIMIT_CPU, cpu_seconds, cpu_seconds + 1)
cap(resource.RLIMIT_DATA, memory_bytes)
cap(resource.RLIMIT_AS, memory_bytes + ${ADDRESS_SPACE_HEADROOM_BYTES - MEMORY_HEADROOM_BYTES})
sys.stdin = open(os.path.join(here, "input.json"), "r", encoding="utf-8")
with open(os.path.join(here, "program.py"), "r", encoding="utf-8") as handle:
    text = handle.read()
exec(compile(text, "program.py", "exec"), {"__name__": "__main__"})
`;

type Log = { stream: "stdout" | "stderr"; data: string };
// Minimal structural view of the SDK so tests can supply a fake VM. The command is run detached and WITHOUT stdout/stderr
// options: with those, the SDK accumulates every byte of output in memory regardless of any cap the caller applies.
export type CommandHandle = {
  logs(options?: { signal?: AbortSignal }): AsyncIterable<Log>;
  wait(options?: { signal?: AbortSignal }): Promise<{ exitCode: number | null }>;
  kill(signal?: "SIGKILL", options?: { abortSignal?: AbortSignal }): Promise<void>;
};
export type SandboxHandle = {
  writeFiles(files: { path: string; content: Buffer }[], options?: { signal?: AbortSignal }): Promise<void>;
  runCommand(options: { cmd: string; args: string[]; cwd: string; detached: true; timeoutMs: number; signal?: AbortSignal }): Promise<CommandHandle>;
  stop(options?: { signal?: AbortSignal }): Promise<unknown>;
};
export type SandboxFactory = (signal: AbortSignal) => Promise<SandboxHandle>;

// Typed adapter rather than a cast: the compiler checks every SDK call made on the learner's behalf.
function adapt(sandbox: Sandbox): SandboxHandle {
  return {
    writeFiles: (files, options) => sandbox.writeFiles(files, options),
    runCommand: (options) => sandbox.runCommand({ ...options, detached: true }),
    stop: (options) => sandbox.stop(options),
  };
}

export const createVercelSandbox: SandboxFactory = async (signal) => adapt(await Sandbox.create({
  image: PYTHON_SANDBOX_IMAGE, resources: { vcpus: 1 }, timeout: VM_TTL_MS,
  persistent: false, networkPolicy: "deny-all", ports: [], signal,
}));

// Keeps at most limit + 1 bytes: one byte over is enough for the outcome mapper to report "output too large".
class BoundedText {
  private chunks: Buffer[] = [];
  private bytes = 0;
  exceeded = false;
  constructor(private readonly limit: number) {}
  add(text: string) {
    if (this.exceeded) return;
    const chunk = Buffer.from(text);
    const room = this.limit + 1 - this.bytes;
    this.chunks.push(room >= chunk.length ? chunk : chunk.subarray(0, room));
    this.bytes += Math.min(room, chunk.length);
    if (this.bytes > this.limit) this.exceeded = true;
  }
  text() { return Buffer.concat(this.chunks).toString("utf8"); }
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
const budgetExhausted = (): PythonCaseRun => ({ kind: "time-limit", stdout: "", stderr: PYTHON_BUDGET_EXHAUSTED, runtimeMs: null, memoryKb: null });
const SIGXCPU_EXIT = 128 + 24;
const SIGKILL_EXIT = 128 + 9;

async function boundedCleanup(operation: (signal: AbortSignal) => Promise<unknown>) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      new Promise<void>((resolve) => { timer = setTimeout(() => { controller.abort(); resolve(); }, CLEANUP_TIMEOUT_MS); }),
      operation(controller.signal),
    ]);
  } catch { /* The provider TTL remains the backstop if cleanup fails. */ }
  finally { clearTimeout(timer); }
}

async function drainOutput(reading: Promise<boolean>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([reading, new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), DRAIN_MS); })]);
  } finally { clearTimeout(timer); }
}

export function createVercelSandboxExecutor(factory: SandboxFactory = createVercelSandbox): PythonExecutor & { concurrency: number } {
  const gate = new Gate(INSTANCE_CONCURRENCY);
  return {
    available: true,
    concurrency: PER_RUN_CONCURRENCY,
    async runCase(request: PythonCaseRequest): Promise<PythonCaseRun> {
      // The run's own deadline always applies, including while waiting for a free slot and while the VM starts.
      const total = request.signal ?? AbortSignal.timeout(RUNNER_LIMITS.totalBudgetMs);
      const wallMs = request.timeMs + STARTUP_GRACE_MS;
      if (total.aborted) return budgetExhausted();
      try {
        return await gate.run(() => runInFreshVm(factory, request, wallMs, total), AbortSignal.any([total, AbortSignal.timeout(START_BUDGET_MS + wallMs)]));
      } catch {
        if (total.aborted) return budgetExhausted();
        // Quota, capacity, network and provider failures all look the same to the learner and are never a wrong answer.
        return unavailable();
      }
    },
  };
}

async function runInFreshVm(factory: SandboxFactory, request: PythonCaseRequest, wallMs: number, total: AbortSignal): Promise<PythonCaseRun> {
  const sandbox = await factory(AbortSignal.any([total, AbortSignal.timeout(START_BUDGET_MS)]));
  let command: CommandHandle | undefined;
  let finished = false;
  const stop = new AbortController();
  try {
    await sandbox.writeFiles([
      { path: `${PYTHON_RUN_DIR}/boot.py`, content: Buffer.from(PYTHON_BOOTSTRAP) },
      { path: `${PYTHON_RUN_DIR}/program.py`, content: Buffer.from(request.source) },
      { path: `${PYTHON_RUN_DIR}/input.json`, content: Buffer.from(request.stdin) },
    ], { signal: AbortSignal.any([total, AbortSignal.timeout(START_BUDGET_MS)]) });

    const limit = RUNNER_LIMITS.maxOutputBytes;
    const stdout = new BoundedText(limit), stderr = new BoundedText(limit);
    const caseDeadline = AbortSignal.timeout(wallMs);
    const started = Date.now();
    command = await sandbox.runCommand({
      // -I: ignore the environment and user site; -X utf8: the program's stdout is UTF-8 regardless of the VM locale.
      cmd: "python3", args: ["-I", "-X", "utf8", `${PYTHON_RUN_DIR}/boot.py`, String(Math.max(1, Math.ceil(request.timeMs / 1000))), String(request.memoryKb * 1024 + MEMORY_HEADROOM_BYTES)],
      cwd: PYTHON_RUN_DIR, detached: true, timeoutMs: wallMs + 2000, signal: total,
    });

    const settled = <T>(promise: Promise<T>) => promise.catch(() => undefined);
    let overflowed: () => void = () => undefined;
    const overflow = new Promise<"overflow">((resolve) => { overflowed = () => resolve("overflow"); });
    let streamFailed: () => void = () => undefined;
    const streamFailure = new Promise<"stream-failure">((resolve) => { streamFailed = () => resolve("stream-failure"); });
    // Output is read as it arrives and dropped past the cap; the loop ends on end of stream, overflow or `stop`.
    const reading = (async () => {
      try {
        for await (const log of command!.logs({ signal: stop.signal })) {
          (log.stream === "stdout" ? stdout : stderr).add(log.data);
          if (stdout.exceeded || stderr.exceeded) { overflowed(); return true; }
        }
        return true;
      } catch { streamFailed(); return false; }
    })();
    const exit = command.wait({ signal: stop.signal }).then((result) => ({ exitCode: result.exitCode }));
    const abortedBy = (signal: AbortSignal, label: "case" | "total") => new Promise<typeof label>((resolve) => {
      if (signal.aborted) resolve(label); else signal.addEventListener("abort", () => resolve(label), { once: true });
    });

    const first = await Promise.race([exit, overflow, streamFailure, abortedBy(caseDeadline, "case"), abortedBy(total, "total")]);
    if (first === "stream-failure") throw new Error("output transport failed");
    let exitCode: number | null = null;
    if (typeof first === "object") {
      exitCode = first.exitCode;
      finished = true;
      // The program is done; let the last output arrive, but do not wait on it indefinitely.
      if (!await drainOutput(reading)) throw new Error("output transport incomplete");
    } else {
      // Stop reading and waiting, and kill the program. The VM is stopped below whether or not the kill worked.
      stop.abort();
    }
    stop.abort();
    void settled(exit);
    const base = { stdout: stdout.text(), stderr: stderr.text(), runtimeMs: Math.min(Date.now() - started, request.timeMs), memoryKb: null };
    if (first === "total") return { kind: "time-limit", ...base, stderr: PYTHON_BUDGET_EXHAUSTED };
    if (first === "case" || exitCode === SIGXCPU_EXIT) return { kind: "time-limit", ...base };
    if (first === "overflow") return { kind: "exited", exitCode: 1, ...base };
    if (exitCode === null) throw new Error("no exit status");
    // MemoryError is the learner's own exception (exit 1); a kill without a deadline is the kernel enforcing the data limit.
    if (/\bMemoryError\b/.test(base.stderr.slice(-2000)) || exitCode === SIGKILL_EXIT) return { kind: "memory-limit", ...base };
    return { kind: "exited", exitCode, ...base };
  } finally {
    stop.abort();
    // Start both cleanup operations so a stuck kill cannot prevent VM teardown or hold an instance slot forever.
    await Promise.all([
      command && !finished ? boundedCleanup((signal) => command!.kill("SIGKILL", { abortSignal: signal })) : undefined,
      boundedCleanup((signal) => sandbox.stop({ signal })),
    ]);
  }
}
