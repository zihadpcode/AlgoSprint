import type { Writable } from "node:stream";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@vercel/sandbox", () => ({ Sandbox: { create: f.create } }));
import { createVercelSandbox, createVercelSandboxExecutor, PYTHON_BOOTSTRAP, PYTHON_SANDBOX_UNAVAILABLE, type SandboxHandle } from "@/features/submissions/python-vercel-sandbox";
import { executePython, getPythonExecutor, mapPythonRun, registerPythonExecutor, unavailablePythonExecutor, type PythonCaseRequest } from "@/features/submissions/python-runner";
import { RUNNER_LIMITS } from "@/features/submissions/limits";

const request: PythonCaseRequest = { source: "print('program')", stdin: "[1,2]", timeMs: 2000, memoryKb: 262_144 };
type Behaviour = (opts: Parameters<SandboxHandle["runCommand"]>[0]) => Promise<{ exitCode: number | null }>;
function fakeVm(run: Behaviour) {
  const vm = { files: [] as { path: string; content: Buffer }[], commands: [] as Parameters<SandboxHandle["runCommand"]>[0][], stopped: 0 };
  const handle: SandboxHandle = {
    async writeFiles(files) { vm.files.push(...files); },
    async runCommand(opts) { vm.commands.push(opts); return run(opts); },
    async stop() { vm.stopped++; },
  };
  return { vm, handle };
}
const say = (stream: Writable, text: string) => new Promise<void>((resolve) => stream.write(Buffer.from(text), () => resolve()));
afterEach(() => { registerPythonExecutor(null); vi.unstubAllEnvs(); });
beforeEach(() => f.create.mockReset());

it("starts a deny-all, nonpersistent, portless VM with no credentials or environment", async () => {
  f.create.mockResolvedValue({});
  const signal = new AbortController().signal;
  await createVercelSandbox(signal);
  expect(f.create).toHaveBeenCalledWith({ image: "vercel/sandbox/python:3.14", resources: { vcpus: 1 }, timeout: 30_000, persistent: false, networkPolicy: "deny-all", ports: [], signal });
  const options = f.create.mock.calls[0][0];
  for (const key of ["env", "mounts", "token", "teamId", "projectId", "source", "name"]) expect(options, key).not.toHaveProperty(key);
});

it("runs each case in its own fresh VM and stops it", async () => {
  const vms: ReturnType<typeof fakeVm>[] = [];
  const executor = createVercelSandboxExecutor(async () => { const made = fakeVm(async (o) => { await say(o.stdout, "42"); return { exitCode: 0 }; }); vms.push(made); return made.handle; });
  const runs = await Promise.all([executor.runCase(request), executor.runCase({ ...request, stdin: "[3]" })]);
  expect(runs.every((run) => run.kind === "exited" && run.exitCode === 0 && run.stdout === "42")).toBe(true);
  expect(vms).toHaveLength(2);
  for (const { vm } of vms) {
    expect(vm.stopped).toBe(1);
    expect(vm.files.map((file) => file.path)).toEqual(["boot.py", "program.py", "input.json"]);
    expect(vm.files[0].content.toString()).toBe(PYTHON_BOOTSTRAP);
    expect(vm.files[1].content.toString()).toBe("print('program')");
    expect(vm.commands[0]).toMatchObject({ cmd: "python3", args: ["-I", "-X", "utf8", "boot.py", "2", String(262_144 * 1024 + 32 * 1024 * 1024)] });
  }
  expect(vms[0].vm.files[2].content.toString()).not.toBe(vms[1].vm.files[2].content.toString());
});

it("never puts learner input on the command line or in the environment", async () => {
  const made = fakeVm(async () => ({ exitCode: 0 }));
  await createVercelSandboxExecutor(async () => made.handle).runCase({ ...request, stdin: "[\"secret-hidden-input\"]" });
  expect(JSON.stringify(made.vm.commands)).not.toContain("secret-hidden-input");
  expect(made.vm.commands[0]).not.toHaveProperty("env");
  expect(made.vm.commands[0]).not.toHaveProperty("sudo");
});

it("reports a deadline as a time limit and still stops the VM", async () => {
  const made = fakeVm((o) => new Promise((_resolve, reject) => o.signal.addEventListener("abort", () => reject(new Error("aborted")))));
  const run = await createVercelSandboxExecutor(async () => made.handle).runCase({ ...request, timeMs: 30 });
  expect(run.kind).toBe("time-limit");
  expect(made.vm.stopped).toBe(1);
});

it("maps CPU-limit kills, MemoryError and kernel kills to the right verdicts", async () => {
  const kinds = async (exitCode: number, stderr = "") => {
    const made = fakeVm(async (o) => { await say(o.stderr, stderr); return { exitCode }; });
    return (await createVercelSandboxExecutor(async () => made.handle).runCase(request)).kind;
  };
  expect(await kinds(152)).toBe("time-limit");
  expect(await kinds(1, "Traceback...\nMemoryError")).toBe("memory-limit");
  expect(await kinds(137)).toBe("memory-limit");
  expect(await kinds(1, "ValueError: nope")).toBe("exited");
  expect(await kinds(3, "SyntaxError")).toBe("exited");
});

it("caps output while it streams and aborts the command", async () => {
  const made = fakeVm(async (o) => {
    await say(o.stdout, "x".repeat(RUNNER_LIMITS.maxOutputBytes + 5000));
    expect(o.signal.aborted).toBe(true);
    return { exitCode: null };
  });
  const run = await createVercelSandboxExecutor(async () => made.handle).runCase(request);
  expect(run.kind === "exited" && Buffer.byteLength(run.stdout)).toBe(RUNNER_LIMITS.maxOutputBytes + 1);
  expect(mapPythonRun(run, 1, request).status).toBe("RUNTIME_ERROR");
});

it("hides provider failures behind one generic message and never calls them a wrong answer", async () => {
  const failing = [
    async () => { throw new Error("quota exceeded for team zihadpcode-7061 token abc"); },
    async () => fakeVm(async () => { throw new Error("socket hang up secret-detail"); }).handle,
    async () => fakeVm(async () => ({ exitCode: null })).handle,
  ];
  for (const factory of failing) {
    const run = await createVercelSandboxExecutor(factory).runCase(request);
    expect(run).toEqual({ kind: "unavailable", diagnostic: PYTHON_SANDBOX_UNAVAILABLE });
    expect(mapPythonRun(run, 1, request).status).toBe("INTERNAL_ERROR");
  }
});

it("stops the VM even when it could not write its files", async () => {
  const made = fakeVm(async () => ({ exitCode: 0 }));
  made.handle.writeFiles = async () => { throw new Error("disk"); };
  expect((await createVercelSandboxExecutor(async () => made.handle).runCase(request)).kind).toBe("unavailable");
  expect(made.vm.stopped).toBe(1);
});

it("runs a submission's cases concurrently but returns outcomes in case order", async () => {
  let active = 0, peak = 0;
  const executor = { ...createVercelSandboxExecutor(async () => fakeVm(async (o) => {
    active++; peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await say(o.stdout, "1"); active--; return { exitCode: 0 };
  }).handle) };
  const outcomes = await executePython(executor, "src", Array.from({ length: 10 }, (_, i) => ({ stdin: String(i), expected: i % 2 })), { timeMs: 2000, memoryKb: 262_144 });
  expect(outcomes.map((o) => o.status)).toEqual(Array.from({ length: 10 }, (_, i) => i % 2 ? "ACCEPTED" : "WRONG_ANSWER"));
  expect(peak).toBeGreaterThan(1); expect(peak).toBeLessThanOrEqual(4);
});

it("is selected only by the explicit PYTHON_RUNNER opt-in", () => {
  expect(getPythonExecutor()).toBe(unavailablePythonExecutor);
  for (const value of ["", "true", "vercel_sandbox", "judge0"]) { vi.stubEnv("PYTHON_RUNNER", value); expect(getPythonExecutor(), value).toBe(unavailablePythonExecutor); }
  vi.stubEnv("PYTHON_RUNNER", "vercel-sandbox");
  expect(getPythonExecutor().available).toBe(true);
  expect(getPythonExecutor()).toBe(getPythonExecutor());
  const fake = { available: true, runCase: async () => ({ kind: "unavailable" as const, diagnostic: "" }) };
  registerPythonExecutor(fake);
  expect(getPythonExecutor()).toBe(fake);
});
