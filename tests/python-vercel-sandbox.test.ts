import { afterEach, beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@vercel/sandbox", () => ({ Sandbox: { create: f.create } }));
import { createVercelSandbox, createVercelSandboxExecutor, PYTHON_BOOTSTRAP, PYTHON_BUDGET_EXHAUSTED, PYTHON_EXIT_SANDBOX_SETUP, PYTHON_RUN_DIR, PYTHON_SANDBOX_UNAVAILABLE, PYTHON_SETUP_MARKER, PYTHON_UNPRIVILEGED_UID,
  type CommandHandle, type SandboxHandle } from "@/features/submissions/python-vercel-sandbox";
import { executePython, getPythonExecutor, mapPythonRun, registerPythonExecutor, unavailablePythonExecutor, type PythonCaseRequest } from "@/features/submissions/python-runner";
import { PYTHON_SUPERVISOR, PYTHON_USAGE_PATH } from "@/features/submissions/python-supervisor";
import { RUNNER_LIMITS } from "@/features/submissions/limits";

const request: PythonCaseRequest = { source: "print('program')", stdin: "[1,2]", timeMs: 2000, memoryKb: 262_144 };
type Options = Parameters<SandboxHandle["runCommand"]>[0];
// A scripted command. `out`/`err` are log chunks; `exit` is the exit code (null = never exits on its own, like a hang).
type Script = { usage?: unknown; out?: string[]; err?: string[]; exit?: number | null; logs?: () => AsyncIterable<{ stream: "stdout" | "stderr"; data: string }> };

function fakeVm(script: Script | ((options: Options) => Script) = { exit: 0 }) {
  const vm = { files: [] as { path: string; content: Buffer }[], commands: [] as Options[], stopped: 0, killed: 0, logsRead: 0 };
  let lastPlan: Script = {};
  const handle: SandboxHandle = {
    async readFileToBuffer({ path }) {
      expect(path).toBe(PYTHON_USAGE_PATH);
      if (Object.hasOwn(lastPlan, "usage")) return lastPlan.usage === undefined ? null : Buffer.from(typeof lastPlan.usage === "string" ? lastPlan.usage : JSON.stringify(lastPlan.usage));
      return Buffer.from(JSON.stringify({ version: 1, exitCode: lastPlan.exit ?? 0, signal: null, cpuMs: 5, maxRssKb: 128 }));
    },
    async writeFiles(files) { vm.files.push(...files); },
    async runCommand(options) {
      vm.commands.push(options);
      const plan = typeof script === "function" ? script(options) : script;
      lastPlan = plan;
      const command: CommandHandle = {
        async *logs({ signal } = {}) {
          if (plan.logs) { for await (const log of plan.logs()) { vm.logsRead++; yield log; } return; }
          for (const data of plan.out ?? []) { vm.logsRead++; yield { stream: "stdout", data }; }
          for (const data of plan.err ?? []) { vm.logsRead++; yield { stream: "stderr", data }; }
          if (plan.exit === null) await new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve(), { once: true }));
        },
        wait({ signal } = {}) {
          if (plan.exit === null || plan.exit === undefined) return new Promise((_resolve, reject) => signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
          return new Promise((resolve) => setTimeout(() => resolve({ exitCode: plan.exit as number }), 5));
        },
        async kill() { vm.killed++; },
      };
      return command;
    },
    async stop() { vm.stopped++; },
  };
  return { vm, handle };
}
const executorFor = (made: ReturnType<typeof fakeVm>) => createVercelSandboxExecutor(async () => made.handle);
afterEach(() => { registerPythonExecutor(null); vi.unstubAllEnvs(); });
beforeEach(() => f.create.mockReset());

it("starts a deny-all, nonpersistent, portless VM with no credentials or environment", async () => {
  const created = fakeVm();
  f.create.mockResolvedValue({ writeFiles: created.handle.writeFiles, runCommand: created.handle.runCommand, readFileToBuffer: created.handle.readFileToBuffer, stop: created.handle.stop });
  const signal = new AbortController().signal;
  await createVercelSandbox(signal);
  expect(f.create).toHaveBeenCalledWith({ image: "vercel/sandbox/python@sha256:5db625121b2172bb6af2c08d9d0df094eb7229e5e284a3f4dee673f6408968aa", resources: { vcpus: 1 }, timeout: 30_000, persistent: false, networkPolicy: "deny-all", ports: [], signal });
  const options = f.create.mock.calls[0][0];
  for (const key of ["env", "mounts", "token", "teamId", "projectId", "source", "name"]) expect(options, key).not.toHaveProperty(key);
});

it("runs each case in its own fresh VM, from absolute paths, and stops it", async () => {
  const vms: ReturnType<typeof fakeVm>[] = [];
  const executor = createVercelSandboxExecutor(async () => { const made = fakeVm({ out: ["42"], exit: 0 }); vms.push(made); return made.handle; });
  const runs = await Promise.all([executor.runCase(request), executor.runCase({ ...request, stdin: "[3]" })]);
  expect(runs.every((run) => run.kind === "exited" && run.exitCode === 0 && run.stdout === "42")).toBe(true);
  expect(vms).toHaveLength(2);
  for (const { vm } of vms) {
    expect(vm.stopped).toBe(1);
    expect(vm.killed).toBe(0);
    expect(vm.files.map((file) => file.path)).toEqual([`${PYTHON_RUN_DIR}/boot.py`, `${PYTHON_RUN_DIR}/supervisor.py`, `${PYTHON_RUN_DIR}/program.py`, `${PYTHON_RUN_DIR}/input.json`]);
    expect(vm.files[0].content.toString()).toBe(PYTHON_BOOTSTRAP);
    expect(vm.files[1].content.toString()).toBe(PYTHON_SUPERVISOR);
    expect(vm.files[2].content.toString()).toBe("print('program')");
    // The nominal CPU budget stays 2 seconds; a 3-second kernel guard avoids premature rounded-tick kills.
    expect(vm.commands[0]).toMatchObject({ cmd: "python3", cwd: PYTHON_RUN_DIR, detached: true, sudo: true,
      args: ["-I", "-X", "utf8", `${PYTHON_RUN_DIR}/supervisor.py`, `${PYTHON_RUN_DIR}/boot.py`, "3", String(262_144 * 1024)] });
  }
  expect(vms[0].vm.files[3].content.toString()).not.toBe(vms[1].vm.files[3].content.toString());
});

it("never puts learner input on the command line or in the environment", async () => {
  const made = fakeVm();
  await executorFor(made).runCase({ ...request, stdin: "[\"secret-hidden-input\"]" });
  expect(JSON.stringify(made.vm.commands)).not.toContain("secret-hidden-input");
  expect(made.vm.commands[0]).not.toHaveProperty("env");
});

it("starts as root only so the bootstrap can drop to an unprivileged identity before any learner code", () => {
  // The Sandbox image's own user holds every capability and has passwordless sudo, so limits set by it would bind nothing.
  expect(PYTHON_UNPRIVILEGED_UID).toBe(65534);
  // capset clears the inheritable set (setuid() leaves it set) and must happen while still root, before the identity change.
  const order = ["program.py", "input.json", "RLIMIT_NPROC, 1", "prctl(38, 1", "prctl(22, 2", "libc.syscall(numbers[0]", "libc.syscall(numbers[1]", "prctl(24, capability", "os.setgroups([])", "os.setgid(65534)", "os.setuid(65534)", "os.setuid(0)", "exec(program"];
  const positions = order.map((needle) => PYTHON_BOOTSTRAP.indexOf(needle));
  expect(positions.every((position) => position >= 0), order.filter((_, i) => positions[i] < 0).join()).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  // Files are read while privileged; learner code is compiled and executed only after the privilege and filter checks.
  expect(PYTHON_BOOTSTRAP.indexOf("exec(")).toBe(PYTHON_BOOTSTRAP.lastIndexOf("exec("));
  // All five capability sets must be empty, the bounding set included, before learner code runs.
  expect(PYTHON_BOOTSTRAP).toContain('("CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb")');
  expect(PYTHON_BOOTSTRAP).toContain("125, 126");
  expect(PYTHON_BOOTSTRAP).toContain("90, 91");
  expect(PYTHON_BOOTSTRAP).toContain(PYTHON_SETUP_MARKER);
  expect(PYTHON_BOOTSTRAP).toContain(`os._exit(${PYTHON_EXIT_SANDBOX_SETUP})`);
});

it("treats a failed privilege drop as an infrastructure failure, never the learner's verdict", async () => {
  const setupFailed = fakeVm({ exit: PYTHON_EXIT_SANDBOX_SETUP, err: [`${PYTHON_SETUP_MARKER} setuid(0) succeeded\n`] });
  const run = await executorFor(setupFailed).runCase(request);
  expect(run).toEqual({ kind: "unavailable", diagnostic: PYTHON_SANDBOX_UNAVAILABLE });
  expect(mapPythonRun(run, 1, request).status).toBe("INTERNAL_ERROR");
  // A learner exiting with the same code, without the marker the bootstrap writes, is just a runtime error.
  expect((await executorFor(fakeVm({ exit: PYTHON_EXIT_SANDBOX_SETUP })).runCase(request)).kind).toBe("exited");
});

it("does not hand the SDK output streams, which would accumulate every byte", async () => {
  const made = fakeVm();
  await executorFor(made).runCase(request);
  expect(made.vm.commands[0]).not.toHaveProperty("stdout");
  expect(made.vm.commands[0]).not.toHaveProperty("stderr");
});

it("reports the case deadline as a time limit, kills the command and stops the VM", async () => {
  const made = fakeVm({ exit: null });
  const run = await executorFor(made).runCase({ ...request, timeMs: 30 });
  expect(run.kind).toBe("time-limit");
  expect(made.vm.killed).toBeGreaterThan(0);
  expect(made.vm.stopped).toBe(1);
});

it("honours the run-wide deadline while the program is running", async () => {
  const made = fakeVm({ exit: null });
  const total = AbortSignal.timeout(40);
  const run = await executorFor(made).runCase({ ...request, signal: total });
  expect(run).toEqual({ kind: "unavailable", diagnostic: PYTHON_BUDGET_EXHAUSTED });
  expect(made.vm.killed).toBeGreaterThan(0);
  expect(made.vm.stopped).toBe(1);
});

it("honours the run-wide deadline while the VM is still starting, and never starts one when it is already spent", async () => {
  const slowStart = createVercelSandboxExecutor((signal) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })));
  expect(await slowStart.runCase({ ...request, signal: AbortSignal.timeout(40) })).toEqual({ kind: "unavailable", diagnostic: PYTHON_BUDGET_EXHAUSTED });
  const factory = vi.fn(async () => fakeVm().handle);
  const spent = AbortSignal.abort();
  expect(await createVercelSandboxExecutor(factory).runCase({ ...request, signal: spent })).toEqual({ kind: "unavailable", diagnostic: PYTHON_BUDGET_EXHAUSTED });
  expect(factory).not.toHaveBeenCalled();
});

it("keeps ordinary signal-shaped exit codes as runtime errors and maps MemoryError", async () => {
  const kind = async (exit: number, err: string[] = []) => (await executorFor(fakeVm({ exit, err })).runCase(request)).kind;
  expect(await kind(152)).toBe("exited");
  expect(await kind(1, ["Traceback...\nMemoryError"])).toBe("memory-limit");
  expect(await kind(137)).toBe("exited");
  expect(await kind(1, ["ValueError: nope"])).toBe("exited");
  expect(await kind(3, ["SyntaxError"])).toBe("exited");
});


it("charges successful completion against the exact CPU budget rather than its rounded kernel seconds", async () => {
  const made = fakeVm({ exit: 0, out: ["7"], usage: { version: 1, exitCode: 0, signal: null, cpuMs: 501, maxRssKb: 128 } });
  expect((await executorFor(made).runCase({ ...request, timeMs: 500 })).kind).toBe("time-limit");
});

it("uses kernel signals and CPU usage to distinguish CPU kills from ambiguous SIGKILL", async () => {
  const signaled = (signal: number, cpuMs: number) => fakeVm({ exit: 128 + signal, usage: { version: 1, exitCode: null, signal, cpuMs, maxRssKb: 128 } });
  expect((await executorFor(signaled(9, 2000)).runCase(request)).kind).toBe("time-limit");
  expect((await executorFor(signaled(24, 2000)).runCase(request)).kind).toBe("time-limit");
  expect(await executorFor(signaled(9, 5)).runCase(request)).toEqual({ kind: "unavailable", diagnostic: PYTHON_SANDBOX_UNAVAILABLE });
});

it.each([undefined, "{bad json", " ".repeat(4097), {}, { version: 1, exitCode: 0, signal: null, cpuMs: -1, maxRssKb: 128 }, { version: 1, exitCode: 1, signal: null, cpuMs: 5, maxRssKb: 128 }])("rejects missing, malformed or inconsistent trusted execution accounting %j", async (usage) => {
  const made = fakeVm({ exit: 0, out: ["7"], usage });
  expect(await executorFor(made).runCase(request)).toEqual({ kind: "unavailable", diagnostic: PYTHON_SANDBOX_UNAVAILABLE });
  expect(made.vm.stopped).toBe(1);
});

it("fails closed when the trusted accounting transport fails", async () => {
  const made = fakeVm({ exit: 0, out: ["7"] });
  made.handle.readFileToBuffer = async () => { throw new Error("private provider failure"); };
  expect(await executorFor(made).runCase(request)).toEqual({ kind: "unavailable", diagnostic: PYTHON_SANDBOX_UNAVAILABLE });
  expect(made.vm.stopped).toBe(1);
});

it("does not charge provider command creation against the learner's case deadline", async () => {
  // Creation exceeds the 50 ms budget plus its 600 ms wall grace; the program itself exits promptly afterwards.
  const made = fakeVm({ exit: 0, out: ["7"] });
  const originalRun = made.handle.runCommand;
  made.handle.runCommand = async (options) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return originalRun(options);
  };
  const run = await executorFor(made).runCase({ ...request, timeMs: 50 });
  expect(mapPythonRun(run, 7, request).status).toBe("ACCEPTED");
  expect(run.kind === "exited" && run.runtimeMs).toBeLessThan(400);
  expect(made.vm.stopped).toBe(1);
});

it("accepts a successful program whose debug output mentions MemoryError", async () => {
  const run = await executorFor(fakeVm({ exit: 0, out: ["7"], err: ["caught MemoryError; retried with less memory\n"] })).runCase(request);
  expect(run).toMatchObject({ kind: "exited", exitCode: 0, stdout: "7" });
  expect(mapPythonRun(run, 7, request).status).toBe("ACCEPTED");
});

it("records runtime at command completion while still waiting for complete output", async () => {
  vi.useFakeTimers();
  try {
    const made = fakeVm({ exit: 0, logs: async function* () {
      await new Promise((resolve) => setTimeout(resolve, 100));
      yield { stream: "stdout" as const, data: "7" };
    } });
    const running = executorFor(made).runCase(request);
    // The command exits at 5 ms; its stdout arrives later and must still be judged in full.
    await vi.advanceTimersByTimeAsync(101);
    const run = await running;
    expect(run).toMatchObject({ kind: "exited", exitCode: 0, runtimeMs: 5, stdout: "7" });
    expect(mapPythonRun(run, 7, request).status).toBe("ACCEPTED");
    expect(made.vm.stopped).toBe(1);
  } finally { vi.useRealTimers(); }
});

it("keeps host memory bounded: output past the cap is never read, and the command is killed", async () => {
  const chunk = "x".repeat(64 * 1024);
  const made = fakeVm({ exit: null, logs: async function* () { for (let i = 0; i < 100_000; i++) yield { stream: "stdout" as const, data: chunk }; } });
  const run = await executorFor(made).runCase(request);
  expect(run.kind === "exited" && Buffer.byteLength(run.stdout)).toBe(RUNNER_LIMITS.maxOutputBytes + 1);
  // 256 KiB cap / 64 KiB chunks: only a handful of chunks are ever pulled from the stream, never the whole 6 GB.
  expect(made.vm.logsRead).toBeLessThanOrEqual(RUNNER_LIMITS.maxOutputBytes / chunk.length + 2);
  expect(made.vm.killed).toBeGreaterThan(0);
  expect(mapPythonRun(run, 1, request).status).toBe("RUNTIME_ERROR");
});

it("caps stderr independently and keeps stdout intact", async () => {
  const made = fakeVm({ exit: null, out: ["7"], logs: async function* () { yield { stream: "stdout" as const, data: "7" }; for (let i = 0; i < 1000; i++) yield { stream: "stderr" as const, data: "e".repeat(64 * 1024) }; } });
  const run = await executorFor(made).runCase(request);
  expect(run.kind === "exited" && run.stdout).toBe("7");
  expect(run.kind === "exited" && Buffer.byteLength(run.stderr)).toBe(RUNNER_LIMITS.maxOutputBytes + 1);
});

it.each([0, 15])("rejects incomplete output when log transport fails after %i ms", async (delay) => {
  const made = fakeVm({ exit: 0, logs: async function* () {
    yield { stream: "stdout" as const, data: "1" };
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    throw new Error("provider transport secret");
  } });
  const run = await executorFor(made).runCase(request);
  expect(mapPythonRun(run, 1, request).status).toBe("INTERNAL_ERROR");
  expect(run).toEqual({ kind: "unavailable", diagnostic: PYTHON_SANDBOX_UNAVAILABLE });
  expect(made.vm.stopped).toBe(1);
});

it("requires the output stream to finish before judging a successful process", async () => {
  vi.useFakeTimers();
  try {
    const made = fakeVm({ exit: 0, logs: async function* () {
      yield { stream: "stdout" as const, data: "1" };
      await new Promise<void>(() => undefined);
    } });
    const running = executorFor(made).runCase(request);
    await vi.advanceTimersByTimeAsync(1600);
    expect(await running).toEqual({ kind: "unavailable", diagnostic: PYTHON_SANDBOX_UNAVAILABLE });
    expect(made.vm.stopped).toBe(1);
  } finally { vi.useRealTimers(); }
});

it("attempts VM teardown even when command kill hangs, and bounds cleanup", async () => {
  vi.useFakeTimers();
  try {
    const made = fakeVm({ exit: null });
    const kill = vi.fn<CommandHandle["kill"]>(() => new Promise<void>(() => undefined));
    const teardown = vi.fn<SandboxHandle["stop"]>(() => new Promise<void>(() => undefined));
    const originalRun = made.handle.runCommand;
    made.handle.runCommand = async (options) => ({ ...await originalRun(options), kill });
    made.handle.stop = teardown;
    const total = new AbortController();
    const running = executorFor(made).runCase({ ...request, signal: total.signal });
    await vi.advanceTimersByTimeAsync(0);
    total.abort();
    await vi.advanceTimersByTimeAsync(2001);
    expect(await running).toMatchObject({ kind: "unavailable" });
    expect(kill).toHaveBeenCalledTimes(1);
    expect(teardown).toHaveBeenCalledTimes(1);
    expect(kill.mock.calls[0][1]?.abortSignal?.aborted).toBe(true);
    expect(teardown.mock.calls[0][0]?.signal?.aborted).toBe(true);
  } finally { vi.useRealTimers(); }
});

it("logs why a run failed without leaking provider text, and keeps the learner message generic", async () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    const error = Object.assign(new Error("quota exceeded for team zihadpcode-7061 token abc123"), { name: "APIError", status: 429 });
    await createVercelSandboxExecutor(async () => { throw error; }).runCase(request);
    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).toContain("APIError"); expect(logged).toContain("429");
    expect(logged).not.toMatch(/zihadpcode|abc123|quota exceeded/);
  } finally { spy.mockRestore(); }
});

it("does not leave listeners behind on the shared run-wide signal", async () => {
  const { EventEmitter } = await import("node:events");
  const total = new AbortController();
  const executor = createVercelSandboxExecutor(async () => fakeVm({ out: ["1"], exit: 0 }).handle);
  for (let i = 0; i < 12; i++) await executor.runCase({ ...request, signal: total.signal });
  expect(EventEmitter.getEventListeners(total.signal, "abort").length).toBeLessThanOrEqual(1);
});

it("hides provider failures behind one generic message and never calls them a wrong answer", async () => {
  const failing = [
    async () => { throw new Error("quota exceeded for team zihadpcode-7061 token abc"); },
    async () => { const made = fakeVm(); made.handle.runCommand = async () => { throw new Error("socket hang up secret-detail"); }; return made.handle; },
    async () => { const made = fakeVm(); made.handle.writeFiles = async () => { throw new Error("disk"); }; return made.handle; },
  ];
  for (const factory of failing) {
    const run = await createVercelSandboxExecutor(factory).runCase(request);
    expect(run).toEqual({ kind: "unavailable", diagnostic: PYTHON_SANDBOX_UNAVAILABLE });
    expect(mapPythonRun(run, 1, request).status).toBe("INTERNAL_ERROR");
  }
});

it("stops the VM even when it could not write its files or start the command", async () => {
  const noFiles = fakeVm(); noFiles.handle.writeFiles = async () => { throw new Error("disk"); };
  expect((await executorFor(noFiles).runCase(request)).kind).toBe("unavailable");
  expect(noFiles.vm.stopped).toBe(1);
  const noCommand = fakeVm(); noCommand.handle.runCommand = async () => { throw new Error("boom"); };
  expect((await executorFor(noCommand).runCase(request)).kind).toBe("unavailable");
  expect(noCommand.vm.stopped).toBe(1);
});

it("treats a missing exit status as an infrastructure failure, not a verdict", async () => {
  const made = fakeVm({ out: ["1"] });
  made.handle.runCommand = async () => ({ logs: async function* () { yield { stream: "stdout" as const, data: "1" }; }, wait: async () => ({ exitCode: null }), kill: async () => undefined });
  expect((await executorFor(made).runCase(request)).kind).toBe("unavailable");
});

it("runs a submission's cases concurrently but returns outcomes in case order", async () => {
  let active = 0, peak = 0;
  const executor = createVercelSandboxExecutor(async () => fakeVm(() => { active++; peak = Math.max(peak, active); setTimeout(() => active--, 2); return { out: ["1"], exit: 0 }; }).handle);
  const outcomes = await executePython(executor, "src", Array.from({ length: 10 }, (_, i) => ({ stdin: String(i), expected: i % 2 })), { timeMs: 2000, memoryKb: 262_144 });
  expect(outcomes.map((o) => o.status)).toEqual(Array.from({ length: 10 }, (_, i) => i % 2 ? "ACCEPTED" : "WRONG_ANSWER"));
  expect(peak).toBeGreaterThan(1); expect(peak).toBeLessThanOrEqual(5);
});

it("requires all three exact activation flags without starting a VM on inspection", () => {
  const enabled = { PYTHON_RUNNER: "vercel-sandbox", CODE_RUNNER_ENABLED: "true", CODE_RUNNER_PROVIDER: "sandbox" };
  const unavailableConfigs = [
    {},
    ...[undefined, "", "true", "Vercel-Sandbox", "vercel_sandbox", "judge0", "vercel-sandbox "].map((PYTHON_RUNNER) => ({ ...enabled, PYTHON_RUNNER })),
    ...[undefined, "", "false", "TRUE"].map((CODE_RUNNER_ENABLED) => ({ ...enabled, CODE_RUNNER_ENABLED })),
    ...[undefined, "", "judge0", "Sandbox"].map((CODE_RUNNER_PROVIDER) => ({ ...enabled, CODE_RUNNER_PROVIDER })),
  ];
  for (const config of unavailableConfigs) {
    for (const key of ["PYTHON_RUNNER", "CODE_RUNNER_ENABLED", "CODE_RUNNER_PROVIDER"] as const) vi.stubEnv(key, config[key as keyof typeof config]);
    expect(getPythonExecutor(), JSON.stringify(config)).toBe(unavailablePythonExecutor);
  }
  for (const [key, value] of Object.entries(enabled)) vi.stubEnv(key, value);
  const managed = getPythonExecutor();
  expect(managed.available).toBe(true);
  expect(managed.concurrency).toBe(5);
  expect(getPythonExecutor()).toBe(managed);
  expect(f.create).not.toHaveBeenCalled();
});

it("rechecks flags before returning its cached executor and gives controlled injection priority", () => {
  vi.stubEnv("PYTHON_RUNNER", "vercel-sandbox");
  vi.stubEnv("CODE_RUNNER_ENABLED", "true");
  vi.stubEnv("CODE_RUNNER_PROVIDER", "sandbox");
  const managed = getPythonExecutor();
  for (const [key, disabled] of [["PYTHON_RUNNER", undefined], ["CODE_RUNNER_ENABLED", "false"], ["CODE_RUNNER_PROVIDER", "judge0"]] as const) {
    vi.stubEnv(key, disabled);
    expect(getPythonExecutor()).toBe(unavailablePythonExecutor);
    vi.stubEnv(key, key === "PYTHON_RUNNER" ? "vercel-sandbox" : key === "CODE_RUNNER_ENABLED" ? "true" : "sandbox");
    expect(getPythonExecutor()).toBe(managed);
  }
  const fake = { available: true, runCase: async () => ({ kind: "unavailable" as const, diagnostic: "" }) };
  registerPythonExecutor(fake);
  expect(getPythonExecutor()).toBe(fake);
  vi.stubEnv("PYTHON_RUNNER", undefined);
  expect(getPythonExecutor()).toBe(fake);
  registerPythonExecutor(null);
  expect(getPythonExecutor()).toBe(unavailablePythonExecutor);
  vi.stubEnv("PYTHON_RUNNER", "vercel-sandbox");
  expect(getPythonExecutor()).toBe(managed);
  expect(f.create).not.toHaveBeenCalled();
});
