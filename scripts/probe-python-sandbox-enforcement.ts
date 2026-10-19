import { readFile } from "node:fs/promises";
import { Writable } from "node:stream";
import { Sandbox } from "@vercel/sandbox";
import { PYTHON_PROBE_IMAGE, type SandboxProbeCredentials } from "./inspect-python-sandbox";

const MAX_PROBE_OUTPUT_BYTES = 16_384;

// This collector bounds host memory while the SDK streams. The SDK's sandbox-
// side command timeout and the VM timeout remain independent backstops.
export function boundedProbeOutput(onLimit: () => void, limit = MAX_PROBE_OUTPUT_BYTES) {
  let bytes = 0;
  let exceeded = false;
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > limit) {
        if (!exceeded) {
          exceeded = true;
          onLimit();
        }
      } else if (!exceeded) {
        chunks.push(Buffer.from(chunk));
      }
      callback();
    },
  });
  return { stream, get exceeded() { return exceeded; }, text: () => Buffer.concat(chunks).toString("utf8") };
}

export async function probePythonSandboxEnforcement(credentials: SandboxProbeCredentials) {
  // Read the pinned, trusted fixture before creating any billable resource.
  const fixture = await readFile(new URL("./python-sandbox-enforcement-probe.py", import.meta.url), "utf8");
  if (Buffer.byteLength(fixture) > 16_384) throw new Error("Trusted probe fixture exceeds its size limit.");

  const sandbox = await Sandbox.create({
    token: credentials.token, teamId: credentials.teamId, projectId: credentials.projectId,
    image: PYTHON_PROBE_IMAGE, resources: { vcpus: 1 }, timeout: 30_000,
    persistent: false, networkPolicy: "deny-all", ports: [],
    signal: AbortSignal.timeout(20_000),
  });
  let stopped = false;
  try {
    const controller = new AbortController();
    const stdout = boundedProbeOutput(() => controller.abort());
    const stderr = boundedProbeOutput(() => controller.abort());
    const command = await sandbox.runCommand({
      cmd: "python3", args: ["-I", "-c", fixture], sudo: true,
      stdout: stdout.stream, stderr: stderr.stream,
      timeoutMs: 10_000, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]),
    });
    if (stdout.exceeded || stderr.exceeded) throw new Error("Trusted probe output exceeded the host stream limit.");
    if (command.exitCode !== 0) throw new Error("Trusted enforcement probe failed; review the VM image and cgroup setup.");
    const parsed: unknown = JSON.parse(stdout.text());
    if (!parsed || typeof parsed !== "object" || (parsed as { trustedProbeOnly?: unknown }).trustedProbeOnly !== true) {
      throw new Error("Unexpected trusted probe result.");
    }
    return { requestedImage: PYTHON_PROBE_IMAGE, reportedImage: sandbox.image,
      resources: { vcpus: sandbox.vcpus, memoryMb: sandbox.memory },
      result: parsed };
  } finally {
    try { await sandbox.stop({ signal: AbortSignal.timeout(5000) }); stopped = true; }
    finally {
      if (!stopped) throw new Error("Sandbox stop could not be confirmed; the 30-second provider timeout remains the backstop.");
    }
  }
}
