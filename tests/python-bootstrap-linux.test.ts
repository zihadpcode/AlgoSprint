import { spawnSync } from "node:child_process";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { PYTHON_BOOTSTRAP } from "@/features/submissions/python-vercel-sandbox";

// Explicit local check using an already-installed image; never pulls an image or starts a hosted VM.
// PYTHON_BOOTSTRAP_LINUX_CHECK=1 npx vitest run tests/python-bootstrap-linux.test.ts
const enabled = process.env.PYTHON_BOOTSTRAP_LINUX_CHECK === "1";
const fixture = String.raw`
import json, os, shutil, subprocess, sys, tempfile
bootstrap = json.loads(sys.stdin.read())
here = tempfile.mkdtemp()
os.chmod(here, 0o755)
boot = os.path.join(here, "boot.py")
target = os.path.join(here, "root-id")
shutil.copyfile("/usr/bin/id", target)
os.chmod(target, 0o4755)
with open(boot, "w") as f: f.write(bootstrap)
with open(os.path.join(here, "input.json"), "w") as f: f.write("[]")
program = os.path.join(here, "program.py")
def demote():
    os.setgroups([])
    os.setgid(65534)
    os.setuid(65534)
def run(args, unprivileged=True):
    return subprocess.run(args, preexec_fn=demote if unprivileged else None, capture_output=True, text=True, timeout=5)
args = [sys.executable, "-I", boot, "2", str(128 * 1024 * 1024)]
# A real setuid executable must gain root without the bootstrap, or this test proves nothing.
control = run([target, "-u"])
assert control.returncode == 0 and control.stdout.strip() == "0", control
with open(program, "w") as f: f.write("import os\nos.execv(" + repr(target) + ", ['id', '-u'])\n")
protected = run(args)
assert protected.returncode == 0 and protected.stdout.strip() == "65534", protected
root = run(args, False)
assert root.returncode != 0 and "requires an unprivileged user" in root.stderr, root
# A failed kernel call must stop before reaching the learner's program.
with open(boot, "w") as f:
    f.write(bootstrap.replace('libc = ctypes.CDLL(None, use_errno=True)', 'libc = type("Denied", (), {"prctl": staticmethod(lambda *args: -1)})()'))
denied = run(args)
assert denied.returncode != 0 and "cannot disable privilege gains" in denied.stderr and not denied.stdout, denied
with open(boot, "w") as f:
    f.write(bootstrap.replace('libc = ctypes.CDLL(None, use_errno=True)', 'libc = type("Unverified", (), {"prctl": staticmethod(lambda *args: 0)})()'))
unverified = run(args)
assert unverified.returncode != 0 and "cannot disable privilege gains" in unverified.stderr and not unverified.stdout, unverified
with open(boot, "w") as f: f.write(bootstrap)
with open(program, "w") as f:
    f.write("import errno, os\ntry:\n os.fork()\nexcept OSError as error:\n assert error.errno == errno.EAGAIN\n print('fork denied')\nelse:\n os._exit(9)\n")
fork = run(args)
assert fork.returncode == 0 and fork.stdout.strip() == "fork denied", fork
print("setuid exec denied; root rejected; failed prctl rejected; fork denied")
`;

it.runIf(enabled)("blocks privilege gain across exec and fails closed before learner code on Linux", () => {
  const result = spawnSync("docker", ["run", "--rm", "--pull", "never", "-i", "--network", "none", "--memory", "256m", "--pids-limit", "32", "--cpus", "1", "--cap-drop", "ALL", "--cap-add", "SETUID", "--cap-add", "SETGID", "--cap-add", "CHOWN", "--cap-add", "FOWNER", "python:3.14-slim", "python3", "-I", "-c", fixture], {
    input: JSON.stringify(PYTHON_BOOTSTRAP), encoding: "utf8", timeout: 30_000, maxBuffer: 16_384,
  });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain("setuid exec denied; root rejected; failed prctl rejected; fork denied");
});
