export const PYTHON_USAGE_PATH = "/root/algosprint/result.json";

// Only the root parent writes this file, after wait4 has reaped the isolated learner.
// No metadata descriptor is inherited by the learner and stdout remains ordinary program output.
export const PYTHON_SUPERVISOR = String.raw`
import json, os, signal, stat, sys
child = None
def refuse():
    sys.stderr.write("AS_SANDBOX_SETUP_FAILED supervisor\n")
    sys.stderr.flush()
    os._exit(70)
try:
    if os.getuid() != 0 or os.geteuid() != 0: refuse()
    root = os.lstat("/root")
    if not stat.S_ISDIR(root.st_mode) or root.st_uid != 0 or root.st_mode & 0o022: refuse()
    os.mkdir("/root/algosprint", 0o700)
    directory = os.lstat("/root/algosprint")
    if not stat.S_ISDIR(directory.st_mode) or directory.st_uid != 0 or directory.st_mode & 0o077: refuse()
    if len(sys.argv) != 4: refuse()
    boot, cpu, memory = sys.argv[1:]
    if not os.path.isabs(boot) or not 1 <= int(cpu) <= 30 or not 1 <= int(memory) <= 4 * 1024**3: refuse()
    child = os.fork()
    if child == 0:
        try:
            os.execv(sys.executable, [sys.executable, "-I", "-X", "utf8", boot, cpu, memory])
        except BaseException:
            refuse()
    waited, status, usage = os.wait4(child, 0)
    child = None
    if os.WIFEXITED(status):
        exit_code, terminating_signal = os.WEXITSTATUS(status), None
    elif os.WIFSIGNALED(status):
        exit_code, terminating_signal = None, os.WTERMSIG(status)
    else:
        refuse()
    result = {"version": 1, "exitCode": exit_code, "signal": terminating_signal,
              "cpuMs": (usage.ru_utime + usage.ru_stime) * 1000,
              "maxRssKb": usage.ru_maxrss}
    fd = os.open("${PYTHON_USAGE_PATH}", os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "w", encoding="ascii") as handle:
        json.dump(result, handle, separators=(",", ":"), allow_nan=False)
    os._exit(exit_code if exit_code is not None else min(255, 128 + terminating_signal))
except BaseException:
    if child is not None and child > 0:
        try: os.kill(child, signal.SIGKILL)
        except OSError: pass
        try: os.waitpid(child, 0)
        except OSError: pass
    refuse()
`.trim();

export type PythonUsage = {
  version: 1;
  exitCode: number | null;
  signal: number | null;
  cpuMs: number;
  maxRssKb: number;
};

export function parsePythonUsage(value: unknown): PythonUsage | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const fields = ["version", "exitCode", "signal", "cpuMs", "maxRssKb"];
  if (Object.keys(record).length !== fields.length || fields.some((field) => !Object.hasOwn(record, field))) return null;
  const integerBetween = (number: unknown, maximum: number, minimum = 0): number is number =>
    typeof number === "number" && Number.isInteger(number) && number >= minimum && number <= maximum;
  if (record.version !== 1) return null;
  if (!((integerBetween(record.exitCode, 255) && record.signal === null) ||
    (record.exitCode === null && integerBetween(record.signal, 64, 1)))) return null;
  if (typeof record.cpuMs !== "number" || !Number.isFinite(record.cpuMs) || record.cpuMs < 0 || record.cpuMs > 30_000) return null;
  if (!integerBetween(record.maxRssKb, 4 * 1024 * 1024)) return null;
  return record as PythonUsage;
}
