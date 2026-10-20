import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";

const remote = vi.hoisted(() => ({ create: vi.fn(() => { throw new Error("Remote calls forbidden in probe builder tests"); }) }));
vi.mock("server-only", () => ({}));
vi.mock("@vercel/sandbox", () => ({ Sandbox: { create: remote.create } }));
import { PYTHON_BOOTSTRAP } from "../src/features/submissions/python-vercel-sandbox";
import { buildPythonBootstrapProbeSetup, TRUSTED_BOOTSTRAP_PROBE } from "../scripts/lib/python-bootstrap-probe";

it("reproduces the reviewed trusted-only setup without starting a VM", () => {
  const setup = buildPythonBootstrapProbeSetup();
  // Frozen setup used for the single hosted probe, whose successful fork caused exit 9.
  expect(createHash("sha256").update(setup).digest("hex")).toBe("8f3ddb2e5899b029cf4195df33d7975b066ba2d071a84cbb137a2bbb3c180ff0");
  expect(setup).toContain(`f.write(${JSON.stringify(PYTHON_BOOTSTRAP)})`);
  expect(setup).toContain(`f.write(${JSON.stringify(TRUSTED_BOOTSTRAP_PROBE)})`);
  expect(setup.split("\n")).toHaveLength(8);
  expect(remote.create).not.toHaveBeenCalled();
});

