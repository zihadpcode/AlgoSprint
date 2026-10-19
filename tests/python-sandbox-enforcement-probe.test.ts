import { beforeEach, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({ create: vi.fn(), run: vi.fn(), stop: vi.fn() }));
vi.mock("@vercel/sandbox", () => ({ Sandbox: { create: f.create } }));
import { boundedProbeOutput, probePythonSandboxEnforcement } from "../scripts/probe-python-sandbox-enforcement";

const credentials = { token: "test-provider-credential", teamId: "test-team", projectId: "test-project" };

beforeEach(() => {
  vi.resetAllMocks();
  f.stop.mockResolvedValue(undefined);
  f.create.mockResolvedValue({ runCommand: f.run, stop: f.stop, image: "managed-image", vcpus: 1, memory: 2048 });
  f.run.mockImplementation(async ({ stdout }: { stdout: { write: (value: string) => void } }) => {
    stdout.write('{"trustedProbeOnly":true,"results":{},"learnerIsolationVerified":false}');
    return { exitCode: 0 };
  });
});

it("bounds output in the streaming path and aborts on the first excess chunk", () => {
  const abort = vi.fn();
  const output = boundedProbeOutput(abort, 4);
  output.stream.write(Buffer.from("abcd"));
  output.stream.write(Buffer.from("efgh"));
  expect(output.text()).toBe("abcd");
  expect(output.exceeded).toBe(true);
  expect(abort).toHaveBeenCalledTimes(1);
});

it("runs only the pinned trusted fixture in one bounded, deny-all, nonpersistent VM", async () => {
  const result = await probePythonSandboxEnforcement(credentials);
  expect(result.result).toMatchObject({ trustedProbeOnly: true, learnerIsolationVerified: false });
  expect(f.create).toHaveBeenCalledTimes(1);
  expect(f.create.mock.calls[0][0]).toMatchObject({ ...credentials, timeout: 30_000,
    persistent: false, networkPolicy: "deny-all", ports: [], resources: { vcpus: 1 } });
  for (const name of ["env", "source", "mounts"]) expect(f.create.mock.calls[0][0]).not.toHaveProperty(name);
  const command = f.run.mock.calls[0][0];
  expect(command).toMatchObject({ cmd: "python3", sudo: true, timeoutMs: 10_000 });
  expect(command.args.slice(0, 2)).toEqual(["-I", "-c"]);
  expect(command.args[2]).toContain("check_descendants");
  expect(command.args[2]).toContain('"networkEnforcementVerified": False');
  expect(command.args[2]).toContain('"directConnectionSucceeded": False');
  expect(JSON.stringify(command.args)).not.toContain(credentials.token);
  expect(command).not.toHaveProperty("env");
  expect(f.stop).toHaveBeenCalledTimes(1);
});

it("stops the VM on execution failure, output excess, and bad result", async () => {
  for (const mode of ["run", "output", "json"]) {
    f.run.mockReset(); f.stop.mockClear(); f.create.mockClear();
    if (mode === "run") f.run.mockRejectedValue(new Error("command failed"));
    else if (mode === "output") f.run.mockImplementation(async ({ stdout }: { stdout: { write: (value: string) => void } }) => {
      stdout.write("x".repeat(20_000)); return { exitCode: 0 };
    });
    else f.run.mockImplementation(async ({ stdout }: { stdout: { write: (value: string) => void } }) => {
      stdout.write("{}"); return { exitCode: 0 };
    });
    await expect(probePythonSandboxEnforcement(credentials)).rejects.toThrow();
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(f.stop).toHaveBeenCalledTimes(1);
  }
});

it("reports a failed stop rather than claiming cleanup", async () => {
  f.stop.mockRejectedValue(new Error("stop unavailable"));
  await expect(probePythonSandboxEnforcement(credentials)).rejects.toThrow("stop could not be confirmed");
});
