import { PYTHON_BOOTSTRAP } from "../../src/features/submissions/python-vercel-sandbox";

// Trusted diagnostic source only. Importing or calling this builder never starts a process or VM.
// A fork that succeeds exits with 9; success does not establish learner isolation.
export const TRUSTED_BOOTSTRAP_PROBE = String.raw`
import ctypes, errno, json, os, resource, threading
libc = ctypes.CDLL(None)
assert os.getuid() != 0 and os.geteuid() != 0
assert libc.prctl(39, 0, 0, 0, 0) == 1
assert resource.getrlimit(resource.RLIMIT_NPROC) == (0, 0)
try:
    os.fork()
except OSError as error:
    assert error.errno == errno.EAGAIN
else:
    os._exit(9)
try:
    threading.Thread(target=lambda: None).start()
except RuntimeError:
    pass
else:
    raise RuntimeError("thread creation was not blocked")
assert libc.prctl(38, 0, 0, 0, 0) == -1
print(json.dumps({"trustedProbeOnly": True, "actualBootstrap": True, "uid": os.getuid(), "noNewPrivs": True, "nproc": [0, 0], "forkDenied": True, "threadDenied": True, "learnerIsolationVerified": False}, separators=(",", ":")))
`;

export function buildPythonBootstrapProbeSetup(): string {
  return `import os,sys\nhere='/vercel/sandbox'\nos.makedirs(here,exist_ok=True)\nwith open(here+'/boot.py','w') as f: f.write(${JSON.stringify(PYTHON_BOOTSTRAP)})\nwith open(here+'/program.py','w') as f: f.write(${JSON.stringify(TRUSTED_BOOTSTRAP_PROBE)})\nwith open(here+'/input.json','w') as f: f.write('[]')\nos.execv(sys.executable,[sys.executable,'-I',here+'/boot.py','2',str(256*1024*1024+32*1024*1024)])\n`;
}
