import { spawnSync } from "node:child_process";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { PYTHON_BOOTSTRAP } from "@/features/submissions/python-vercel-sandbox";
import { parsePythonUsage, PYTHON_SUPERVISOR, PYTHON_USAGE_PATH } from "@/features/submissions/python-supervisor";

const normal = { version: 1, exitCode: 0, signal: null, cpuMs: 12.25, maxRssKb: 8192 };

it("accepts authoritative normal and signaled exit metadata without conflating exit 137 with SIGKILL", () => {
  expect(parsePythonUsage(normal)).toEqual(normal);
  const exited = { ...normal, exitCode: 137 };
  const signaled = { ...normal, exitCode: null, signal: 9 };
  expect(parsePythonUsage(exited)).toEqual(exited);
  expect(parsePythonUsage(signaled)).toEqual(signaled);
  expect(parsePythonUsage({ ...normal, exitCode: 255, cpuMs: 30_000, maxRssKb: 4 * 1024 * 1024 })).not.toBeNull();
});

it.each([
  null, undefined, false, 1, "{}", [], [normal], {},
  { ...normal, version: 2 }, { ...normal, version: "1" },
  { ...normal, exitCode: null }, { ...normal, exitCode: 0, signal: 9 },
  { ...normal, exitCode: -1 }, { ...normal, exitCode: 256 }, { ...normal, exitCode: 0.5 },
  { ...normal, exitCode: "0" }, { ...normal, exitCode: NaN },
  { ...normal, exitCode: null, signal: 0 }, { ...normal, exitCode: null, signal: 65 },
  { ...normal, exitCode: null, signal: 9.5 }, { ...normal, exitCode: null, signal: "9" },
  { ...normal, cpuMs: -1 }, { ...normal, cpuMs: Infinity }, { ...normal, cpuMs: NaN },
  { ...normal, cpuMs: 30_001 }, { ...normal, cpuMs: "12" },
  { ...normal, maxRssKb: -1 }, { ...normal, maxRssKb: Infinity }, { ...normal, maxRssKb: 0.5 },
  { ...normal, maxRssKb: 4 * 1024 * 1024 + 1 }, { ...normal, maxRssKb: "8192" },
  { ...normal, unexpected: "untrusted" },
  { version: 1, exitCode: 0, signal: null, cpuMs: 12.25 },
  Object.assign(Object.create({ version: 1 }), { exitCode: 0, signal: null, cpuMs: 1, maxRssKb: 1 }),
])("rejects malformed or inconsistent usage metadata (%#)", (value) => {
  expect(parsePythonUsage(value)).toBeNull();
});

// Explicit local verification: installed image only, no pulls, hosted VMs or network.
const fixture = String.raw`
import json, os, shutil, signal, stat, subprocess, sys, tempfile
payload = json.loads(sys.stdin.read())
with tempfile.TemporaryDirectory() as here:
    os.chmod(here, 0o755)
    boot = os.path.join(here, 'boot.py')
    supervisor = os.path.join(here, 'supervisor.py')
    program = os.path.join(here, 'program.py')
    for path, text in ((boot, payload['bootstrap']), (supervisor, payload['supervisor']),
                       (os.path.join(here, 'input.json'), '21\n')):
        with open(path, 'w') as handle: handle.write(text)
    args = [sys.executable, '-I', '-X', 'utf8', supervisor, boot, '1', str(128 * 1024 * 1024)]
    def run(source):
        shutil.rmtree('/root/algosprint', ignore_errors=True)
        with open(program, 'w') as handle: handle.write(source)
        result = subprocess.run(args, capture_output=True, text=True, timeout=6)
        with open(payload['usage']) as handle: usage = json.load(handle)
        assert set(usage) == {'version', 'exitCode', 'signal', 'cpuMs', 'maxRssKb'}, usage
        assert usage['version'] == 1 and usage['cpuMs'] >= 0 and usage['maxRssKb'] > 0, usage
        directory = os.stat('/root/algosprint')
        metrics = os.stat(payload['usage'])
        assert directory.st_uid == 0 and stat.S_IMODE(directory.st_mode) == 0o700
        assert metrics.st_uid == 0 and stat.S_IMODE(metrics.st_mode) == 0o600
        return result, usage
    result, usage = run('print(int(input()) * 2)')
    assert result.returncode == 0 and result.stdout.strip() == '42', (result.returncode, result.stdout, result.stderr)
    assert usage['exitCode'] == 0 and usage['signal'] is None, usage
    result, usage = run('import os\nos._exit(137)')
    assert result.returncode == 137 and usage['exitCode'] == 137 and usage['signal'] is None, (result, usage)
    result, usage = run('import os,signal\nos.kill(os.getpid(),signal.SIGKILL)')
    assert result.returncode == 137 and usage['exitCode'] is None and usage['signal'] == signal.SIGKILL, (result, usage)
    assert usage['cpuMs'] < 900, ('low CPU SIGKILL incorrectly resembles CPU exhaustion', usage)
    result, usage = run('print(\'{"version":1,"exitCode":null,"signal":9,"cpuMs":30000,"maxRssKb":1}\')')
    assert result.returncode == 0 and usage['exitCode'] == 0 and usage['signal'] is None and usage['cpuMs'] < 900, (result, usage)
    result, usage = run('''import os, signal
for path in (''' + repr(payload['usage']) + ''', '/proc/' + str(os.getppid()) + '/mem'):
 try: handle = open(path, 'wb')
 except PermissionError: pass
 else:
  handle.close()
  raise AssertionError(('learner accessed privileged metadata or parent', path))
try: os.kill(os.getppid(), signal.SIGKILL)
except PermissionError: pass
else: raise AssertionError('learner killed root supervisor')
print('parent and metrics protected')
''')
    assert result.returncode == 0 and result.stdout.strip() == 'parent and metrics protected', (result, usage)
    result, usage = run('import signal\nsignal.signal(signal.SIGXCPU, signal.SIG_IGN)\nwhile True: pass')
    assert result.returncode == 137 and usage['exitCode'] is None and usage['signal'] == signal.SIGKILL, (result, usage)
    assert 900 <= usage['cpuMs'] <= 1400, ('hard CPU limit not enforced', usage)
    # Refuse a pre-existing metrics directory rather than overwrite or trust its contents.
    with open(program, 'w') as handle: handle.write("print('LEARNER_RAN')")
    refused = subprocess.run(args, capture_output=True, text=True, timeout=3)
    assert refused.returncode == 70 and not refused.stdout and 'AS_SANDBOX_SETUP_FAILED supervisor' in refused.stderr, refused
    with open(payload['usage']) as handle: assert json.load(handle) == usage
    print('supervisor normal exits, signals, trusted usage, privilege separation and hard CPU limit verified')
`;

it.runIf(process.env.PYTHON_BOOTSTRAP_LINUX_CHECK === "1")("supervises the actual isolated child and measures hard CPU exhaustion on Linux", () => {
  const result = spawnSync("docker", [
    "run", "--rm", "--pull", "never", "-i", "--network", "none", "--memory", "256m",
    "--pids-limit", "32", "--cpus", "1", "--cap-drop", "ALL", "--cap-add", "SETUID",
    "--cap-add", "SETGID", "--cap-add", "SETPCAP", "python:3.14-slim", "python3", "-I", "-c", fixture,
  ], {
    input: JSON.stringify({ bootstrap: PYTHON_BOOTSTRAP, supervisor: PYTHON_SUPERVISOR, usage: PYTHON_USAGE_PATH }),
    encoding: "utf8", timeout: 20_000, maxBuffer: 16_384,
  });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain("supervisor normal exits, signals, trusted usage, privilege separation and hard CPU limit verified");
}, 25_000);
