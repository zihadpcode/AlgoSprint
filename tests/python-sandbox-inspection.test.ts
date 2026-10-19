import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ create: vi.fn(), run: vi.fn(), stop: vi.fn(), stdout: vi.fn() }));
vi.mock("@vercel/sandbox", () => ({ Sandbox: { create: f.create } }));
import { inspectPythonSandbox } from "../scripts/inspect-python-sandbox";
const credentials = { token: "test-provider-credential", teamId: "test-team", projectId: "test-project" };
beforeEach(() => {
  vi.resetAllMocks();
  f.stdout.mockResolvedValue('{"enforcementVerified":false}');
  f.run.mockResolvedValue({ exitCode: 0, stdout: f.stdout });
  f.stop.mockResolvedValue(undefined);
  f.create.mockResolvedValue({ runCommand: f.run, stop: f.stop, image: "managed-image", vcpus: 1, memory: 2048, persistent: false });
});
it("creates one bounded nonpersistent deny-all VM without exposing caller secrets to commands", async () => {
  expect(await inspectPythonSandbox(credentials)).toMatchObject({ inspection: { enforcementVerified: false }, persistent: false });
  expect(f.create).toHaveBeenCalledTimes(1);
  expect(f.create.mock.calls[0][0]).toMatchObject({ ...credentials, timeout: 30_000, persistent: false, networkPolicy: "deny-all", resources: { vcpus: 1 }, ports: [] });
  for (const name of ["env", "source", "mounts"]) expect(f.create.mock.calls[0][0]).not.toHaveProperty(name);
  const command = f.run.mock.calls[0][0];
  expect(command).toMatchObject({ cmd: "python3", sudo: true, timeoutMs: 3000 });
  expect(command.args.slice(0, 2)).toEqual(["-I", "-c"]);
  expect(JSON.stringify(command)).not.toContain(credentials.token);
  expect(command).not.toHaveProperty("env");
  expect(f.stop).toHaveBeenCalledTimes(1);
});
it("stops the VM when inspection or output validation fails, without replacement VMs", async () => {
  for (const failure of [new Error("inspection unavailable"), null]) {
    f.run.mockReset(); f.stop.mockClear(); f.create.mockClear();
    if (failure) f.run.mockRejectedValue(failure);
    else { f.stdout.mockResolvedValue("x".repeat(16_385)); f.run.mockResolvedValue({ exitCode: 0, stdout: f.stdout }); }
    await expect(inspectPythonSandbox(credentials)).rejects.toThrow();
    expect(f.create).toHaveBeenCalledTimes(1); expect(f.stop).toHaveBeenCalledTimes(1);
  }
});
it("reports unconfirmed stop explicitly instead of silently claiming cleanup", async () => {
  f.stop.mockRejectedValue(new Error("stop unavailable"));
  await expect(inspectPythonSandbox(credentials)).rejects.toThrow("stop could not be confirmed");
  expect(f.create).toHaveBeenCalledTimes(1);
});
