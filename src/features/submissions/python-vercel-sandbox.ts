import "server-only";
import { Sandbox } from "@vercel/sandbox";
import { RUNNER_LIMITS } from "./limits";
import type { PythonCaseRequest, PythonCaseRun, PythonExecutor } from "./python-runner";

// Runs learner Python in Vercel Sandbox, a managed Firecracker microVM, instead of anything inside the Next.js process.
//
// Isolation choices (see docs/PYTHON-RUNNER.md):
// - One brand-new VM per test case, never reused: nothing a program leaves behind can reach another case or another user.
// - networkPolicy "deny-all", no ports, nothing mounted, no credentials or environment passed in, persistent: false.
// - The learner's program runs as uid/gid 65534 with no capabilities, no supplementary groups, no_new_privs and rlimits set
//   by a trusted bootstrap that runs as root and proves the drop before any learner code (see PYTHON_BOOTSTRAP). The image's
//   own default user is NOT a boundary: it has every capability and passwordless sudo.
// - Host side: one hard deadline for the whole run, a wall-clock deadline per case, output consumed through a bounded
//   collector (never through SDK-accumulated streams), the command killed and the VM stopped in `finally`. The provider-side
//   `timeout` is only a backstop if stop() fails.
// The expected outputs never enter the VM; the application compares the program's stdout itself.
//
// What is NOT claimed: peak memory is not measured, and nothing here stops a program that does something the VM allows an
// ordinary user to do (burn its CPU and memory budget, fill its own writable directory). The VM (one vCPU, 2 GiB, no network,
// no secrets, 30 s TTL, killed from the host) bounds all of that. Re-verify live whenever the image or the bootstrap changes.

export const PYTHON_SANDBOX_IMAGE = "vercel/sandbox/python@sha256:5db625121b2172bb6af2c08d9d0df094eb7229e5e284a3f4dee673f6408968aa";
export const PYTHON_SANDBOX_UNAVAILABLE = "Python execution is temporarily unavailable. Please try again in a moment.";
// Running out of the whole-run budget means the platform was slow (VM start-up, a busy instance), not that the learner's code
// was; it is never reported as a time limit.
export const PYTHON_BUDGET_EXHAUSTED = "Python execution did not finish within the time budget. Please try again.";

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

// Trusted bootstrap. In the Sandbox image the "vercel-sandbox" user is not a privilege boundary: it holds every Linux
// capability (so it is exempt from RLIMIT_NPROC and can raise any rlimit) and has passwordless sudo. Limits set by that user
// would therefore bind nothing. So the bootstrap runs as root (the command is started with sudo), reads the files it needs,
// sets the limits, sets no_new_privs, and then becomes uid/gid 65534 with no supplementary groups and no capabilities. It
// proves the drop worked (setuid(0) must fail, every capability set must be empty) and exits with
// PYTHON_EXIT_SANDBOX_SETUP before running any learner code if anything is off; learner code never runs as root. As an
// ordinary user the program cannot raise its limits, start a process (RLIMIT_NPROC is 1) or become root again.
export const PYTHON_EXIT_SANDBOX_SETUP = 70;
export const PYTHON_SETUP_MARKER = "AS_SANDBOX_SETUP_FAILED";
export const PYTHON_UNPRIVILEGED_UID = 65534;
export const PYTHON_BOOTSTRAP = String.raw`
import ctypes, os, resource, sys
def refuse(why):
    sys.stderr.write("${PYTHON_SETUP_MARKER} " + why + "\n"); sys.stderr.flush(); os._exit(${PYTHON_EXIT_SANDBOX_SETUP})
try:
    here = os.path.dirname(os.path.abspath(__file__))
    cpu_seconds, memory_bytes = int(sys.argv[1]), int(sys.argv[2])
    if os.getuid() != 0: refuse("not started as root")
    with open(os.path.join(here, "program.py"), "r", encoding="utf-8") as handle: text = handle.read()
    stdin_file = open(os.path.join(here, "input.json"), "r", encoding="utf-8")
    def cap(kind, soft, hard=None): resource.setrlimit(kind, (soft, soft if hard is None else hard))
    cap(resource.RLIMIT_NPROC, 1)
    cap(resource.RLIMIT_CORE, 0)
    cap(resource.RLIMIT_FSIZE, 1 << 20)
    cap(resource.RLIMIT_NOFILE, 32)
    cap(resource.RLIMIT_CPU, cpu_seconds, cpu_seconds + 1)
    cap(resource.RLIMIT_DATA, memory_bytes)
    cap(resource.RLIMIT_AS, memory_bytes)
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(38, 1, 0, 0, 0) != 0 or libc.prctl(39, 0, 0, 0, 0) != 1: refuse("no_new_privs")
    # setuid() empties the permitted, effective and ambient sets but leaves the inheritable one, so clear that explicitly
    # (capset), and empty the bounding set so nothing can be acquired again. capget/capset numbers differ by architecture.
    numbers = {"x86_64": (125, 126), "aarch64": (90, 91)}.get(os.uname().machine)
    if numbers is None: refuse("architecture " + os.uname().machine)
    # The kernel, not NPROC/user-namespace accounting, enforces a single process/thread. Filters persist across exec and
    # can only be made stricter. Check the syscall ABI first: compat int80 and x32 must not bypass native syscall numbers.
    audit_arch, denied = {"x86_64": (0xc000003e, (56, 57, 58, 272, 308, 435)),
                          "aarch64": (0xc00000b7, (220, 97, 268, 435))}[os.uname().machine]
    class Filter(ctypes.Structure): _fields_ = [("code", ctypes.c_ushort), ("jt", ctypes.c_ubyte), ("jf", ctypes.c_ubyte), ("k", ctypes.c_uint32)]
    class Policy(ctypes.Structure): _fields_ = [("len", ctypes.c_ushort), ("filter", ctypes.POINTER(Filter))]
    def filter_count():
        with open("/proc/self/status") as status:
            return int(dict(line.split(":", 1) for line in status)["Seccomp_filters"].strip())
    before_filters = filter_count()
    rules = [(0x20, 0, 0, 4), (0x15, 1, 0, audit_arch), (0x06, 0, 0, 0x80000000),
             (0x20, 0, 0, 0), (0x35, 0, 1, 0x40000000), (0x06, 0, 0, 0x00050001)]
    for number in denied: rules.extend(((0x15, 0, 1, number), (0x06, 0, 0, 0x00050001)))
    rules.append((0x06, 0, 0, 0x7fff0000))
    instructions = (Filter * len(rules))(*(Filter(*rule) for rule in rules))
    policy = Policy(len(rules), instructions)
    if libc.prctl(22, 2, ctypes.byref(policy), 0, 0) != 0: refuse("seccomp install")
    if libc.prctl(21, 0, 0, 0, 0) != 2 or filter_count() <= before_filters: refuse("seccomp readback")
    class Header(ctypes.Structure): _fields_ = [("version", ctypes.c_uint32), ("pid", ctypes.c_int)]
    class Data(ctypes.Structure): _fields_ = [("effective", ctypes.c_uint32), ("permitted", ctypes.c_uint32), ("inheritable", ctypes.c_uint32)]
    header, data = Header(0x20080522, 0), (Data * 2)()
    if libc.syscall(numbers[0], ctypes.byref(header), data) != 0: refuse("capget")
    for part in data: part.inheritable = 0
    if libc.syscall(numbers[1], ctypes.byref(header), data) != 0: refuse("capset")
    for capability in range(64): libc.prctl(24, capability, 0, 0, 0)
    os.setgroups([]); os.setgid(${PYTHON_UNPRIVILEGED_UID}); os.setuid(${PYTHON_UNPRIVILEGED_UID})
    try:
        os.setuid(0); refuse("setuid(0) succeeded")
    except PermissionError: pass
    if (os.getuid(), os.geteuid(), os.getgid(), os.getegid(), os.getgroups()) != (${PYTHON_UNPRIVILEGED_UID}, ${PYTHON_UNPRIVILEGED_UID}, ${PYTHON_UNPRIVILEGED_UID}, ${PYTHON_UNPRIVILEGED_UID}, []): refuse("identity")
    if os.getresuid() != (${PYTHON_UNPRIVILEGED_UID},) * 3 or os.getresgid() != (${PYTHON_UNPRIVILEGED_UID},) * 3: refuse("saved identity")
    if libc.prctl(39, 0, 0, 0, 0) != 1: refuse("no_new_privs readback")
    if libc.prctl(21, 0, 0, 0, 0) != 2 or filter_count() <= before_filters: refuse("seccomp readback")
    with open("/proc/self/status") as status:
        for line in status:
            if line.startswith(("CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb")) and int(line.split()[1], 16) != 0: refuse(line.strip())
    sys.stdin = stdin_file
    program = compile(text, "program.py", "exec")
except SystemExit: raise
except BaseException as error: refuse(type(error).__name__)
exec(program, {"__name__": "__main__"})
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
  runCommand(options: { cmd: string; args: string[]; cwd: string; sudo: true; detached: true; timeoutMs: number; signal?: AbortSignal }): Promise<CommandHandle>;
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
const budgetExhausted = (): PythonCaseRun => ({ kind: "unavailable", diagnostic: PYTHON_BUDGET_EXHAUSTED });
// Operators need to see why runs fail, but provider text can carry account details: log only the error type and numeric codes.
function logFailure(error: unknown) {
  const failure = error as { name?: unknown; status?: unknown; statusCode?: unknown; code?: unknown } | null;
  const pick = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value).slice(0, 40) : undefined;
  console.error("python-sandbox: run failed", { type: pick(failure?.name), status: pick(failure?.status ?? failure?.statusCode), code: pick(failure?.code) });
}
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
      } catch (error) {
        if (total.aborted) return budgetExhausted();
        logFailure(error);
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
    command = await sandbox.runCommand({
      // -I: ignore the environment and user site; -X utf8: the program's stdout is UTF-8 regardless of the VM locale.
      cmd: "python3", args: ["-I", "-X", "utf8", `${PYTHON_RUN_DIR}/boot.py`, String(Math.max(1, Math.ceil(request.timeMs / 1000))), String(request.memoryKb * 1024)],
      // sudo: only so the bootstrap can drop to an unprivileged identity; see PYTHON_BOOTSTRAP.
      cwd: PYTHON_RUN_DIR, sudo: true, detached: true, timeoutMs: wallMs + 2000, signal: total,
    });
    // Creating the provider command is infrastructure time. Charge the case only after a command handle exists;
    // the independent run-wide signal still bounds creation, upload and execution together.
    const caseDeadline = AbortSignal.timeout(wallMs);
    const started = Date.now();

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
    // Listeners on the shared run-wide signal are removed in `finally`, or one would accumulate per case.
    const detach: (() => void)[] = [];
    const abortedBy = (signal: AbortSignal, label: "case" | "total") => new Promise<typeof label>((resolve) => {
      if (signal.aborted) { resolve(label); return; }
      const listener = () => resolve(label);
      signal.addEventListener("abort", listener, { once: true });
      detach.push(() => signal.removeEventListener("abort", listener));
    });

    let first: Awaited<typeof exit> | "overflow" | "stream-failure" | "case" | "total";
    try { first = await Promise.race([exit, overflow, streamFailure, abortedBy(caseDeadline, "case"), abortedBy(total, "total")]); }
    finally { for (const remove of detach) remove(); }
    const runtimeMs = Math.min(Date.now() - started, request.timeMs);
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
    const base = { stdout: stdout.text(), stderr: stderr.text(), runtimeMs, memoryKb: null };
    if (first === "total") return budgetExhausted();
    if (first === "case" || exitCode === SIGXCPU_EXIT) return { kind: "time-limit", ...base };
    if (first === "overflow") return { kind: "exited", exitCode: 1, ...base };
    if (exitCode === null) throw new Error("no exit status");
    // The bootstrap could not prove it had dropped privileges, so no learner code ran. Never the learner's fault.
    if (exitCode === PYTHON_EXIT_SANDBOX_SETUP && base.stderr.includes(PYTHON_SETUP_MARKER)) throw new Error("sandbox setup failed");
    // MemoryError is the learner's own exception (exit 1); a kill without a deadline is the kernel enforcing the data limit.
    if ((exitCode === 1 && /\bMemoryError\b/.test(base.stderr.slice(-2000))) || exitCode === SIGKILL_EXIT) return { kind: "memory-limit", ...base };
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
