import { Sandbox } from "@vercel/sandbox";

// Trusted capability inspection only: never imports or runs learner code. The
// caller supplies existing credentials in memory; none are copied into the VM.
// Importing this module performs no remote action.
export type SandboxProbeCredentials = { token: string; teamId: string; projectId: string };
export const PYTHON_PROBE_IMAGE = "vercel/sandbox/python:3.14";

const INSPECT = String.raw`
import hashlib, json, os, pathlib, shutil, stat, sys
def read(path, limit=4096):
    try:
        with open(path, "r") as source: return source.read(limit)
    except OSError as error: return {"error": error.errno}
def info(path):
    try:
        value = os.stat(path)
        return {"exists": True, "uid": value.st_uid, "gid": value.st_gid,
                "mode": oct(stat.S_IMODE(value.st_mode)), "rootWriteAccess": os.access(path, os.W_OK)}
    except OSError as error: return {"exists": False, "error": error.errno}
binary = pathlib.Path(sys.executable).resolve()
digest = hashlib.sha256()
with binary.open("rb") as source:
    while chunk := source.read(65536): digest.update(chunk)
root = "/sys/fs/cgroup"
try: readonly = bool(os.statvfs(root).f_flag & os.ST_RDONLY)
except OSError: readonly = None
print(json.dumps({
    "uid": os.getuid(), "gid": os.getgid(), "groups": os.getgroups(),
    "python": {"version": sys.version, "implementation": sys.implementation.name,
               "binary": str(binary), "sha256": digest.hexdigest()},
    "kernel": os.uname().release, "osRelease": read("/etc/os-release"),
    "processCgroup": read("/proc/self/cgroup"),
    "capabilities": [line for line in read("/proc/self/status").splitlines()
                     if line.startswith(("Cap", "NoNewPrivs", "Seccomp"))],
    "cgroup": {"readonlyMount": readonly,
        "controllers": read(root + "/cgroup.controllers"),
        "subtreeControl": read(root + "/cgroup.subtree_control"),
        "files": {name: info(root + "/" + name) for name in
                  [".", "cgroup.procs", "cgroup.subtree_control", "memory.max", "memory.swap.max",
                   "memory.events", "memory.peak", "pids.max", "cpu.max", "cpu.stat", "cgroup.kill"]}},
    "tools": {name: shutil.which(name) for name in
              ["setpriv", "unshare", "mount", "useradd", "timeout", "python3", "sudo"]},
    "environmentNames": sorted(os.environ.keys()),
    "enforcementVerified": False
}, separators=(",", ":")))
`;

export async function inspectPythonSandbox(credentials: SandboxProbeCredentials) {
  const started = Date.now();
  const sandbox = await Sandbox.create({
    token: credentials.token, teamId: credentials.teamId, projectId: credentials.projectId,
    image: PYTHON_PROBE_IMAGE, resources: { vcpus: 1 }, timeout: 30_000,
    persistent: false, networkPolicy: "deny-all", ports: [],
    signal: AbortSignal.timeout(20_000),
  });
  let stopped = false;
  try {
    const command = await sandbox.runCommand({
      cmd: "python3", args: ["-I", "-c", INSPECT], sudo: true,
      timeoutMs: 3000, signal: AbortSignal.timeout(5000),
    });
    if (command.exitCode !== 0) throw new Error("Trusted Sandbox inspection did not complete.");
    const output = await command.stdout();
    if (Buffer.byteLength(output) > 16_384) throw new Error("Unexpected inspection output size.");
    const inspection: unknown = JSON.parse(output);
    return {
      requestedImage: PYTHON_PROBE_IMAGE, reportedImage: sandbox.image,
      resources: { vcpus: sandbox.vcpus, memoryMb: sandbox.memory },
      persistent: sandbox.persistent, inspection, durationMs: Date.now() - started,
    };
  } finally {
    try { await sandbox.stop({ signal: AbortSignal.timeout(5000) }); stopped = true; }
    finally {
      // A failed stop is visible to the caller; the provider-side 30s TTL is the
      // backstop. Never retry by starting a replacement VM automatically.
      if (!stopped) throw new Error("Sandbox stop could not be confirmed; the 30-second provider timeout remains the backstop.");
    }
  }
}
