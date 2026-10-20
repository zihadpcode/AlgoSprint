// Immutable snapshot used by the failed October 20 probe, never by application execution.
export const FAILED_BOOTSTRAP_OCT20 = "\nimport ctypes, os, resource, sys\nif os.getuid() == 0 or os.geteuid() == 0:\n    raise RuntimeError(\"Python bootstrap requires an unprivileged user\")\nlibc = ctypes.CDLL(None, use_errno=True)\nPR_SET_NO_NEW_PRIVS, PR_GET_NO_NEW_PRIVS = 38, 39\nif libc.prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0 or libc.prctl(PR_GET_NO_NEW_PRIVS, 0, 0, 0, 0) != 1:\n    raise RuntimeError(\"Python bootstrap cannot disable privilege gains\")\nhere = os.path.dirname(os.path.abspath(__file__))\ncpu_seconds, memory_bytes = int(sys.argv[1]), int(sys.argv[2])\ndef cap(kind, soft, hard=None):\n    resource.setrlimit(kind, (soft, soft if hard is None else hard))\ncap(resource.RLIMIT_NPROC, 0)\ncap(resource.RLIMIT_CORE, 0)\ncap(resource.RLIMIT_FSIZE, 1 << 20)\ncap(resource.RLIMIT_NOFILE, 32)\ncap(resource.RLIMIT_CPU, cpu_seconds, cpu_seconds + 1)\ncap(resource.RLIMIT_DATA, memory_bytes)\ncap(resource.RLIMIT_AS, memory_bytes + 503316480)\nsys.stdin = open(os.path.join(here, \"input.json\"), \"r\", encoding=\"utf-8\")\nwith open(os.path.join(here, \"program.py\"), \"r\", encoding=\"utf-8\") as handle:\n    text = handle.read()\nexec(compile(text, \"program.py\", \"exec\"), {\"__name__\": \"__main__\"})\n";

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
  return `import os,sys\nhere='/vercel/sandbox'\nos.makedirs(here,exist_ok=True)\nwith open(here+'/boot.py','w') as f: f.write(${JSON.stringify(FAILED_BOOTSTRAP_OCT20)})\nwith open(here+'/program.py','w') as f: f.write(${JSON.stringify(TRUSTED_BOOTSTRAP_PROBE)})\nwith open(here+'/input.json','w') as f: f.write('[]')\nos.execv(sys.executable,[sys.executable,'-I',here+'/boot.py','2',str(256*1024*1024+32*1024*1024)])\n`;
}
