import { spawnSync } from "node:child_process";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { PYTHON_BOOTSTRAP } from "@/features/submissions/python-vercel-sandbox";

// Explicit local check using an already-installed image: no pulls, network, or hosted VMs.
// PYTHON_BOOTSTRAP_LINUX_CHECK=1 npx vitest run tests/python-bootstrap-linux.test.ts
const enabled = process.env.PYTHON_BOOTSTRAP_LINUX_CHECK === "1";
const hostPythonAvailable = spawnSync("python3", ["--version"], { timeout: 2000 }).status === 0;
// Extract and evaluate the actual bootstrap's cBPF instructions without installing any filter on the host.
const policyEvaluator = String.raw`
import ast, json, types, sys
tree = ast.parse(json.loads(sys.stdin.read()))
body = next(node.body for node in tree.body if isinstance(node, ast.Try))
selected = []
for node in body:
    if isinstance(node, ast.Assign):
        names = {part.id for target in node.targets for part in ast.walk(target) if isinstance(part, ast.Name)}
        if names in ({'audit_arch', 'denied'}, {'rules'}): selected.append(node)
    elif isinstance(node, ast.For) and isinstance(node.target, ast.Name) and node.target.id == 'number':
        selected.append(node)
    elif isinstance(node, ast.Expr) and isinstance(node.value, ast.Call):
        func = node.value.func
        if isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name) and func.value.id == 'rules' and func.attr == 'append':
            selected.append(node)
assert len(selected) == 4, 'expected actual policy builder statements'
builder = compile(ast.Module(body=selected, type_ignores=[]), '<actual-policy>', 'exec')
def evaluate(rules, arch, number):
    accumulator = 0
    pc = 0
    for _ in range(len(rules) + 1):
        code, jt, jf, value = rules[pc]
        if code == 0x20:
            assert value in (0, 4)
            accumulator = (arch if value == 4 else number) & 0xffffffff
            pc += 1
        elif code == 0x15: pc += 1 + (jt if accumulator == value else jf)
        elif code == 0x35: pc += 1 + (jt if accumulator >= value else jf)
        elif code == 0x06: return value
        else: raise AssertionError(('unexpected opcode', code))
        assert 0 <= pc < len(rules), 'jump outside program'
    raise AssertionError('filter did not terminate')
for machine, arch, denied in [('x86_64', 0xc000003e, {56,57,58,272,308,435}),
                               ('aarch64', 0xc00000b7, {220,97,268,435})]:
    scope = {'os': types.SimpleNamespace(uname=lambda: types.SimpleNamespace(machine=machine))}
    exec(builder, scope)
    rules = scope['rules']
    for number in range(1025):
        assert evaluate(rules, arch, number) == (0x00050001 if number in denied else 0x7fff0000), (machine, number)
    for number in (0x40000000, 0x40000038, 0x400001b3, 0x7fffffff, 0xffffffff, -1):
        assert evaluate(rules, arch, number) == 0x00050001
    assert evaluate(rules, arch, 0x3fffffff) == 0x7fff0000
    for other_arch in (0x40000003, 0, arch ^ 1):
        for number in (20, 56, 435):
            assert evaluate(rules, other_arch, number) == 0x80000000
print('both architectures, native syscalls, ABI guards and jump targets verified')
`;

it.runIf(hostPythonAvailable)("evaluates the actual seccomp policy branches for both supported architectures", () => {
  const result = spawnSync("python3", ["-I", "-c", policyEvaluator], {
    input: JSON.stringify(PYTHON_BOOTSTRAP), encoding: "utf8", timeout: 5000, maxBuffer: 16_384,
  });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain("both architectures, native syscalls, ABI guards and jump targets verified");
});

const fixture = String.raw`
import json, os, shutil, signal, subprocess, sys, tempfile
bootstrap = json.loads(sys.stdin.read())
with tempfile.TemporaryDirectory() as here:
    os.chmod(here, 0o755)
    boot = os.path.join(here, 'boot.py')
    program = os.path.join(here, 'program.py')
    target = os.path.join(here, 'root-id')
    backing = os.path.join(here, 'large-backing')
    shutil.copyfile('/usr/bin/id', target)
    os.chmod(target, 0o4755)
    with open(backing, 'wb') as handle: handle.truncate(160 * 1024 * 1024)
    with open(os.path.join(here, 'input.json'), 'w') as handle: handle.write('12\n')
    args = [sys.executable, '-I', boot, '2', str(128 * 1024 * 1024)]
    def demote():
        os.setgroups([]); os.setgid(65534); os.setuid(65534)
    def run(source, variant=bootstrap, unprivileged=False):
        with open(boot, 'w') as handle: handle.write(variant)
        with open(program, 'w') as handle: handle.write(source)
        return subprocess.run(args, capture_output=True, text=True, timeout=4,
                              preexec_fn=demote if unprivileged else None)
    def success(source, expected):
        result = run(source)
        assert result.returncode == 0 and result.stdout.strip() == expected, (result.returncode, result.stdout, result.stderr)
    # Prove the setuid control works in this container before testing no_new_privs.
    control = subprocess.run([target, '-u'], preexec_fn=demote, capture_output=True, text=True, timeout=2)
    assert control.returncode == 0 and control.stdout.strip() == '0', ('invalid setuid control', control)
    success("print(int(input()) * 2)", '24')
    success('''import os, resource
assert os.getresuid() == (65534,) * 3
assert os.getresgid() == (65534,) * 3
assert os.getgroups() == []
status = dict(line.split(':', 1) for line in open('/proc/self/status'))
for name in ('CapInh', 'CapPrm', 'CapEff', 'CapBnd', 'CapAmb'):
 assert int(status[name].strip(), 16) == 0, (name, status[name])
assert status['NoNewPrivs'].strip() == '1'
assert resource.getrlimit(resource.RLIMIT_NPROC) == (1, 1)
assert resource.getrlimit(resource.RLIMIT_AS) == (128*1024*1024,) * 2
for kind in (resource.RLIMIT_AS, resource.RLIMIT_DATA, resource.RLIMIT_CPU, resource.RLIMIT_NPROC, resource.RLIMIT_NOFILE):
 soft, hard = resource.getrlimit(kind)
 try: resource.setrlimit(kind, (hard + 1, hard + 1))
 except (ValueError, PermissionError): pass
 else: raise AssertionError(('raised hard limit', kind))
try: os.setuid(0)
except PermissionError: pass
else: raise AssertionError('regained root')
print('identity and hard limits verified')
''', 'identity and hard limits verified')
    success('''import errno, os, threading
try: child = os.fork()
except OSError as error: assert error.errno == errno.EPERM, error
else:
 if child == 0: os._exit(0)
 os.waitpid(child, 0)
 raise AssertionError('fork succeeded')
thread = threading.Thread(target=lambda: None)
try: thread.start()
except RuntimeError: pass
else:
 thread.join()
 raise AssertionError('thread succeeded')
print('fork and thread denied')
''', 'fork and thread denied')
    success('''import ctypes, errno, json, os
libc = ctypes.CDLL(None, use_errno=True)
machine = os.uname().machine
denied = {'x86_64': (56,57,58,272,308,435), 'aarch64': (220,97,268,435)}[machine]
for number in denied:
 ctypes.set_errno(0)
 assert libc.syscall(number,0,0,0,0,0,0) == -1 and ctypes.get_errno() == errno.EPERM, number
if machine == 'x86_64':
 for number in (0x40000000, 0x40000038, 0x400001b3):
  ctypes.set_errno(0)
  assert libc.syscall(number,0,0,0,0,0,0) == -1 and ctypes.get_errno() == errno.EPERM
assert libc.prctl(21,0,0,0,0) == 2
print('process and namespace syscalls denied')
''', 'process and namespace syscalls denied')
    # Adding a permissive filter or requesting disabled mode must not remove the existing restriction.
    success('''import ctypes, errno, os
libc = ctypes.CDLL(None, use_errno=True)
class Filter(ctypes.Structure): _fields_ = [('code',ctypes.c_ushort),('jt',ctypes.c_ubyte),('jf',ctypes.c_ubyte),('k',ctypes.c_uint32)]
class Policy(ctypes.Structure): _fields_ = [('len',ctypes.c_ushort),('filter',ctypes.POINTER(Filter))]
rules = (Filter * 1)(Filter(0x06,0,0,0x7fff0000))
policy = Policy(1,rules)
assert libc.prctl(22,2,ctypes.byref(policy),0,0) == 0
assert libc.prctl(22,0,0,0,0) == -1
assert libc.prctl(38,0,0,0,0) == -1
for number in {'x86_64':(56,272,308), 'aarch64':(220,97,268)}[os.uname().machine]:
 ctypes.set_errno(0)
 assert libc.syscall(number,0,0,0,0,0,0) == -1 and ctypes.get_errno() == errno.EPERM
print('filter cannot be relaxed')
''', 'filter cannot be relaxed')
    inherited = os.path.join(here, 'exec-check.py')
    with open(inherited, 'w') as handle:
        handle.write("import ctypes,errno,os\nlibc=ctypes.CDLL(None,use_errno=True)\nn={'x86_64':272,'aarch64':97}[os.uname().machine]\nctypes.set_errno(0)\nassert libc.syscall(n,0x10000000)==-1 and ctypes.get_errno()==errno.EPERM\nassert libc.prctl(39,0,0,0,0)==1\nassert os.getresuid()==(65534,)*3\nprint('filter survives exec')\n")
    success("import os,sys\nos.execv(sys.executable,[sys.executable,'-I'," + repr(inherited) + "])\n", 'filter survives exec')
    if os.uname().machine == 'x86_64':
        # A benign i386 getpid via int80 must be killed by the ABI guard, not allowed under native numbers.
        compat = run('''import ctypes,mmap
code = bytes.fromhex('b814000000cd80c3')
page = mmap.mmap(-1,4096,prot=mmap.PROT_READ|mmap.PROT_WRITE|mmap.PROT_EXEC)
page.write(code)
ctypes.CFUNCTYPE(ctypes.c_int)(ctypes.addressof(ctypes.c_char.from_buffer(page)))()
raise AssertionError('compat ABI allowed')
''')
        assert compat.returncode == -signal.SIGSYS, (compat.returncode, compat.stdout, compat.stderr)
    success("import os\nos.execv(" + repr(target) + ", ['id', '-u'])\n", '65534')
    success('''import errno, mmap, os
with open(''' + repr(backing) + ''', 'rb') as handle:
 try: mapping = mmap.mmap(handle.fileno(), 160*1024*1024, access=mmap.ACCESS_READ)
 except OSError as error: assert error.errno == errno.ENOMEM, error
 else:
  mapping.close()
  raise AssertionError('oversized file-backed mapping accepted')
 mapping = mmap.mmap(handle.fileno(), 96*1024*1024, access=mmap.ACCESS_READ)
 try:
  assert sum(mapping[offset] for offset in range(0, 96*1024*1024, 4096)) == 0
  try: extra = mmap.mmap(handle.fileno(), 64*1024*1024, access=mmap.ACCESS_READ)
  except OSError as error: assert error.errno == errno.ENOMEM, error
  else:
   extra.close()
   raise AssertionError('aggregate file mappings exceeded address-space limit')
 finally: mapping.close()
fd = os.memfd_create('bounded-shared-probe', 0)
os.ftruncate(fd, 512*1024)
mappings = []
try:
 for _ in range(300):
  try: mapping = mmap.mmap(fd, 512*1024, flags=mmap.MAP_SHARED, prot=mmap.PROT_READ | mmap.PROT_WRITE, trackfd=False)
  except OSError as error:
   assert error.errno == errno.ENOMEM, error
   break
  mappings.append(mapping)
  for offset in range(0, 512*1024, 4096): mapping[offset] = 1
 else: raise AssertionError('shared mappings exceeded address-space limit')
 assert mappings, 'no shared mapping was tested'
finally:
 for mapping in mappings: mapping.close()
 os.close(fd)
print('file and touched shared mappings bounded')
''', 'file and touched shared mappings bounded')
    variants = [
        (bootstrap, True, 'not started as root'),
        (bootstrap.replace('libc.prctl(38, 1, 0, 0, 0)', '-1'), False, 'no_new_privs'),
        (bootstrap.replace('libc.prctl(39, 0, 0, 0, 0)', '0'), False, 'no_new_privs'),
        (bootstrap.replace('libc.syscall(numbers[1], ctypes.byref(header), data)', '-1'), False, 'capset'),
        (bootstrap.replace('libc.prctl(22, 2, ctypes.byref(policy), 0, 0)', '-1'), False, 'seccomp install'),
        (bootstrap.replace('libc.prctl(21, 0, 0, 0, 0)', '0'), False, 'seccomp readback'),
    ]
    for variant, unprivileged, reason in variants:
        result = run("print('LEARNER_RAN')", variant, unprivileged)
        assert result.returncode == 70, (reason, result.returncode, result.stderr)
        assert 'AS_SANDBOX_SETUP_FAILED ' + reason in result.stderr, (reason, result.stderr)
        assert not result.stdout, ('learner executed after setup failure', result.stdout)
    print('bootstrap identity, exec, process, hard-limit, mmap, and fail-closed checks passed')
`;

it.runIf(enabled)("enforces the root bootstrap privilege drop and kernel limits on Linux", () => {
  const result = spawnSync("docker", [
    "run", "--rm", "--pull", "never", "-i", "--network", "none", "--memory", "256m",
    "--pids-limit", "32", "--cpus", "1", "--cap-drop", "ALL", "--cap-add", "SETUID",
    "--cap-add", "SETGID", "--cap-add", "SETPCAP", "python:3.14-slim", "python3", "-I", "-c", fixture,
  ], { input: JSON.stringify(PYTHON_BOOTSTRAP), encoding: "utf8", timeout: 30_000, maxBuffer: 16_384 });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain("bootstrap identity, exec, process, hard-limit, mmap, and fail-closed checks passed");
}, 35_000);
