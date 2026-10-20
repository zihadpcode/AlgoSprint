# Python runner: architecture and the Vercel Sandbox executor

**Status: implemented and verified in a real Vercel Sandbox VM (October 20, 2026); OFF by default; not yet enabled in Production.** Python runs only when a deployment sets `PYTHON_RUNNER=vercel-sandbox` (with `CODE_RUNNER_ENABLED=true` and `CODE_RUNNER_PROVIDER=sandbox`); the flag is absent from Production and Preview. The owner chose Vercel Sandbox on October 19, 2026. The first two live runs found real problems (see [Live evidence](#live-evidence-october-20-2026)); the current bootstrap passed the adversarial matrix. Follow the [go-live checklist](#go-live-checklist) to enable it.

## What exists today

Code execution is language-generic. JavaScript still runs exactly as before (QuickJS in a worker, or Judge0). Python goes through a pluggable interface.

| Piece | File | Role |
| --- | --- | --- |
| Input contract | `src/features/submissions/contracts.ts` | `executionInput` accepts `JAVASCRIPT` or `PYTHON` (strict object). |
| Reservation | `src/features/submissions/store.ts` | `reserveSubmission` reads the starter row for the requested language; its `entryPoint` is the entry point. A problem is runnable in a language only if a reviewed `SIGNATURES` entry exists **and** a starter row exists for that language. Locking, quotas (shared across languages) and snapshots are unchanged. |
| Program text | `src/features/submissions/harness.ts`, `harness-python.ts` | `makeProgram(slug, entryPoint, code, language)`. JavaScript output is byte-identical. The Python entry point must equal the snake_case form of the signature entry point (`relayWindow` becomes `relay_window`, `python-names.ts`). |
| Executor interface | `src/features/submissions/python-runner.ts` | `PythonExecutor` (`available`, `runCase`), registry (`getPythonExecutor`, `registerPythonExecutor`), verdict mapping (`mapPythonRun`) and sequential execution under the shared limits (`executePython`). |
| Dispatch | `src/features/submissions/service.ts` | Python goes to the registered executor only on the in-process (`sandbox`) provider. On Judge0 it returns the same unavailable outcome; no Judge0 language id was invented. |
| Capability | `src/features/submissions/runner-languages.ts` | `supportedRunnerLanguages(config)` is JavaScript only unless the provider is `sandbox` **and** an executor reports `available`. The `executeCode` action rejects Python before reserving an attempt when unsupported. |
| UI | `src/components/editor/{code-editor,runner-controls}.tsx` | The selector lists every starter language. JavaScript keeps its in-browser Run. Python Run executes on the server in `RUN` mode (sign-in required, same rate limit); when Python is unsupported both buttons are disabled with an explanatory message. |
| Starters | `src/data/seeds/languages/python-starters.json`, `scripts/generate-python-starters.ts`, `prisma/seed-language-starters.ts` | Add-on seed layer, see below. |

### The Python program

The harness reads the JSON argument array from stdin, compiles and `exec`s the learner's code in a fresh namespace (`__name__` is `"solution"`, so `if __name__ == "__main__"` blocks do not run), calls the entry point with positional arguments, redirects the learner's `print()` to stderr, and writes only `json.dumps(result, allow_nan=False)` to the real stdout. `NaN`/`Infinity` therefore become a runtime error. Learner code and the entry point reach Python only as JSON string literals, never by string interpolation into code.

Exit codes are part of the executor contract: `0` success, `3` compile error (`SyntaxError` and friends), `1` runtime error (traceback on stderr), anything else is treated as a runtime error. The application compares stdout JSON itself (`isDeepStrictEqual` on parsed JSON), caps stored stdout at 4,000 characters (stderr keeps its last 4,000, where the exception line is), treats either output stream above 262,144 UTF-8 bytes as a runtime error, and keeps hidden-case inputs, expected values, output and diagnostics out of `SUBMIT` responses and stored results. The harness emits compact Unicode JSON without a newline; see [the shared byte policy](RUNNER-BYTE-LIMITS.md).

### Writing an executor

An executor runs one program against one stdin and reports what happened: `exited` (exit code, stdout, stderr, runtime, memory), `time-limit`, `memory-limit` or `unavailable`. It must give the program no host filesystem, network, environment variables or other processes, and enforce the time and memory budget it is given (already clamped to `RUNNER_LIMITS`). Install it with `registerPythonExecutor(executor)` and set `available: true`; the UI and the action then expose Python automatically. Application execution remains disabled and runner tests use a fake executor. The optional harness test may invoke an already-installed local `python3`; that test is separate from the application runtime.

## Add-on Python starters

`npm run starters:python` regenerates `src/data/seeds/languages/python-starters.json` from `SIGNATURES` (one short stub per slug with `pass`; names and parameters in snake_case). `npm run seed:validate` checks that every slug exists, entry points and parameters are valid non-keyword identifiers, parameters do not collide, and the file matches the generator.

`seedLanguageStarters` in `prisma/seed-language-starters.ts` inserts missing `StarterCode` rows for existing problems. It never updates or deletes, never touches `Problem` rows (so insert-only problem seeding and its content-hash protection are unaffected), is idempotent, and throws a conflict error before writing anything if an existing row for the same problem and language differs. It is deliberately **not** part of `npm run db:seed`: once these rows exist the editor offers Python (with Run disabled until `PYTHON_RUNNER` is set). Run `npm run db:seed:python-starters` (`scripts/seed-python-starters.ts`) only when the runner is about to be switched on. It reuses the same insert-only, conflict-checked function and is safe to repeat. For a canary, `npm run db:seed:python-starters -- --slug relay-window` (repeatable) seeds only the named problems, so only those offer Python; an unknown slug is an error.

## Earlier runtime options (historical)

The owner selected Vercel Sandbox, so the WASI and in-process directions below were not pursued. They are kept as the evidence behind that choice.

The earlier prototype used **CPython 3.12 compiled to WASI**, release `python/3.12.0+20231211-040d5a6` of `vmware-labs/webassembly-language-runtimes`, file `python-3.12.0.wasm` with sha256 `e5dc5a398b07b54ea8fdb503bf68fb583d533f10ec3f930963e02b9505f7a763`, run through a **pure-JavaScript WASI host with an in-memory, read-only filesystem**, inside a worker that can be terminated.

This historical artifact is not a selected production runtime. The [vendor repository](https://github.com/vmware-labs/webassembly-language-runtimes) announces a handoff to a community fork, and its listed Python binary is the older 3.12.0 release. Before choosing a build, review its maintenance, security patch provenance, license, host capabilities, resource enforcement and Vercel compatibility. [WASI isolation](https://wasi.dev/security) depends on the capabilities granted by the host; a prototype alone does not establish a production security boundary.

Measured in a prototype on 2026-10-13:

- Startup about 70 ms.
- Host files unreachable (only the in-memory filesystem exists).
- Sockets unsupported.
- A memory bomb raised `MemoryError` once a memory maximum was patched into the module.
- An infinite loop was killed by terminating the worker.
- About 7-10x slower than native CPython: a 10^7-iteration loop took 5 s, so the current 2 s per-case budget suits small inputs only.

### October 14 maintenance and isolation review

Read-only source review found no ready-to-ship replacement for the historical binary. The recommendation is to keep Python disabled and first scope an isolated managed judge pilot with the owner. A reproducible upstream WASI build is an alternative with a larger maintenance burden; neither direction has been approved or installed.

| Direction | Evidence checked October 14, 2026 | Work still required |
| --- | --- | --- |
| Historical WLR / community successor | The [successor release page](https://github.com/webassemblylabs/webassembly-language-runtimes/releases) has no releases. Its advertised Python remains 3.12.0; the historical binary is from December 2023. | Current interpreter security-patch provenance is not established. Do not select the old binary merely because its checksum is known. |
| Build upstream CPython for WASI | WASIp1 is a [Tier 2 CPython platform](https://peps.python.org/pep-0011/). [Python 3.14.8](https://www.python.org/downloads/release/python-3148/) includes security fixes and was released September 30, 2026. | Reproducible build, licenses for all bundled libraries, pinned source/toolchain, security updates, compatible host and Vercel packaging review. |
| Componentize-py | [0.25.1](https://github.com/bytecodealliance/componentize-py/releases/tag/v0.25.1) is recent, but its [tagged build source](https://github.com/bytecodealliance/componentize-py/blob/v0.25.1/build.rs) selects a `3.14.0-wasi-sdk-30` CPython fork. | Audit interpreter patches/backports and component-host compatibility. A recent wrapper release alone does not establish a patched interpreter. |
| Vercel Sandbox | [Firecracker microVM isolation](https://vercel.com/docs/sandbox) and managed Python images provide an external host boundary. | Provider/budget decision, image provenance, a disabled adapter, then actual enforcement and failure tests before enabling execution. |

Do not substitute built-in `node:wasi`: the [Node 24 security documentation](https://nodejs.org/docs/latest-v24.x/api/wasi.html#security) explicitly does not guarantee secure confinement for untrusted code. For a WASI implementation, the host must deny unnecessary capabilities and prove hard interruption, bounded output and memory; an interpreter checksum and worker alone are insufficient.

The earlier alternative descriptions were too broad. [Pyodide's `jsglobals`](https://pyodide.org/en/stable/usage/api/js-api.html#pyodideconfig-jsglobals) defaults to `globalThis` but is configurable. Giving learner code a privileged JavaScript host is unsuitable; changing this setting alone does not establish safe isolation. MicroPython's [WebAssembly bridge has build-time switches](https://github.com/micropython/micropython/blob/v1.29.0/ports/webassembly/mpconfigport.h), and it also has language/library compatibility differences from CPython. Neither is selected; neither is inherently impossible to isolate.

A managed judge pilot should explicitly use `networkPolicy: "deny-all"`, no exposed ports, credentials or account-data mounts, and `persistent: false`; [network access is allowed by default](https://vercel.com/docs/sandbox/concepts/firewall). Avoid reusing an execution environment across accounts or hidden cases. The [SDK](https://vercel.com/docs/sandbox/sdk-reference) allocates 2,048 MB per vCPU, which does not enforce this app's 256 MiB per-case limit. A VM timeout also does not prove the 2-second case deadline or 20-second whole-run budget. Enforce and verify those limits, bounded stdout/stderr while streaming, cancellation and teardown of descendants, and hidden-case confidentiality. Do not send a whole hidden suite into an environment after learner code has run there.

The saved `scripts/inspect-python-sandbox.ts` inspection and `scripts/probe-python-sandbox-enforcement.ts` enforcement probe are **manual, trusted-code tools only**. Importing them does not create a VM; neither is wired to application execution. The enforcement probe sends only the checked-in `python-sandbox-enforcement-probe.py` fixture to one 30-second, one-vCPU, deny-all, nonpersistent VM, with a 10-second command deadline, bounded host output streams and a `stop()` in `finally`. It attempts to verify writable cgroup memory/swap, CPU and process controls, a memory OOM kill, CPU throttling, the PID cap, and `cgroup.kill` of a trusted descendant. Its fixed-address outbound connection attempt records only whether the connection succeeded; a failed attempt is inconclusive because routing or the destination could fail independently of the firewall. `networkEnforcementVerified` therefore remains false. Any failed or inconclusive result is a **NO GO** for enabling Python. Local unit tests only verify the caller's configuration, stream cap and cleanup logic; they do not establish VM enforcement.

Even a successful live result would not prove the final learner runner: it does not test a 256 MiB production case limit, two-second case deadline, hidden-case secrecy, per-user/per-case VM isolation, DNS and all network paths, or actual malicious submissions. The next step is a single quota-checked live run of this trusted probe, then a separate bounded runner design and adversarial end-to-end verification before registering an available Python executor or seeding starters. No live VM is started by tests, builds or imports. (The first live run has since happened; see [Live diagnostic](#live-diagnostic-october-20-2026).)

[Hobby quotas](https://vercel.com/docs/sandbox/pricing) currently include 5 active-CPU hours, 420 GB-hours and 5,000 creations per month; exhaustion pauses creation rather than charging overages. Pro usage is metered. AlgoSprint currently admits up to 20 active server executions while Hobby allows 10 concurrent sandboxes, so provider-specific admission/capacity handling is needed. Confirm the actual team plan, remaining quota and budget before a live pilot; no service was activated during this review.

The next approved implementation must preserve the executor contract, reject unsupported execution before reservation, and pass escape/resource/cancellation/cleanup checks in the intended environment. Wire and verify the insert-only starter seed only after that runtime is ready. The existing `test:trace` checks packaging and selected QuickJS behavior; it does not prove Python or a remote judge secure.

## Vercel Sandbox executor

`src/features/submissions/python-vercel-sandbox.ts`, selected by `getPythonExecutor()` only when `PYTHON_RUNNER=vercel-sandbox` (a registered executor, used by tests, still wins).

- **One new VM per test case.** Image `vercel/sandbox/python:3.14`, one vCPU, `networkPolicy: "deny-all"`, no ports, nothing mounted, no credentials or environment passed in, `persistent: false`, 30 s provider TTL as a backstop. The command is killed and the VM stopped in `finally` (the stop is awaited but bounded to 5 s). Nothing is reused across cases or users, and expected outputs never enter a VM.
- **Files, not arguments.** The generated program and the case input are written under the absolute directory `/vercel/sandbox` (`boot.py`, `program.py`, `input.json`), which is also the working directory. Learner text never appears on a command line.
- **Privilege drop, then limits.** The image's default user is not a boundary (see the live evidence), so the command is started with `sudo` and the trusted bootstrap (`PYTHON_BOOTSTRAP`, `python3 -I -X utf8 /vercel/sandbox/boot.py <cpu seconds> <memory bytes>`) runs as root. While privileged it reads `program.py` and `input.json`, sets `RLIMIT_NPROC` = 1, CPU seconds (hard limit one higher), data segment (case limit plus 32 MiB), address space, 32 open files, 1 MiB per written file and no core files, sets `no_new_privs`, then clears the **inheritable** capability set with `capset` (`setuid` leaves it set) and the **bounding** set, and only then calls `setgroups([])`, `setgid(65534)`, `setuid(65534)`. It proves the drop before running anything: `setuid(0)` must raise `PermissionError`; uid, euid, gid and egid are 65534; no supplementary groups; `CapInh`, `CapPrm`, `CapEff`, `CapBnd` and `CapAmb` are all zero. The program is then compiled and run in the same interpreter. `capget`/`capset` syscall numbers are selected by architecture (x86_64 125/126, aarch64 90/91); any other architecture refuses to run.
- **Setup failure is infrastructure, not the learner.** Any failed step writes `AS_SANDBOX_SETUP_FAILED <reason>` to stderr and exits 70. The host maps exit 70 with that marker to the generic unavailable result. Because stderr is learner-controlled, a learner can forge that marker, but the only effect is an unavailable result for their own run.
- **One hard deadline.** `executePython` creates a single `AbortSignal.timeout(totalBudgetMs)` (20 s, monotonic) and passes it to every case; it covers waiting for a slot, VM start-up, upload and the run, and `executePython` also stops waiting on its own. Each case also has its own wall-clock deadline (case time limit plus 600 ms start-up). Running out of the **run** budget means the platform was slow, so it is reported as unavailable ("did not finish within the time budget"), never as a time limit on the learner's code.
- **Bounded output on the host.** The command runs detached and without `stdout`/`stderr` options, because @vercel/sandbox 3.8.0 accumulates all output in memory when they are given. Output is read from `Command.logs()` into a collector that keeps at most 256 KiB + 1 byte per stream and kills the command when either stream passes that.
- **Harness behaviour that matches JavaScript.** The harness raises Python's recursion limit to 15,000 (the default 1,000 is far below the roughly 11,000 frames a JavaScript solution gets, and `grove-harvest` has a depth-5,000 tree); an infinite recursion still ends as an ordinary `RecursionError` runtime error, checked in the real image. `mapPythonRun` compares `-0.0` as `0`, as JavaScript's `JSON.stringify` would write it. Tracebacks start at the first frame in the learner's own code, without the harness's frames.
- **Storable output.** Learner output is stored in a jsonb column, so NUL characters are removed and lone surrogates (including ones created by truncation) are repaired before it leaves `mapPythonRun`.
- **Verdicts:** case deadline or SIGXCPU is `TIME_LIMIT`; `MemoryError` or a kernel kill is `MEMORY_LIMIT`; exit 3 is a compile error; anything else non-zero is a runtime error. Quota, capacity, provider, run-budget and sandbox-setup failures become one generic `INTERNAL_ERROR` message, never a wrong answer. After the first such failure `executePython` stops starting further VMs for that run. The executor logs the error type and numeric status or code (never provider text) with `console.error`.
- **VM budgets** (`src/features/submissions/python-budget.ts`, checked inside the reservation transaction). Python costs one VM per case, up to 10 per Submit, so the submission-count limits (5/min, 30/hour per user, which also cover JavaScript) are far too loose. Python additionally has: at most `PYTHON_MAX_ACTIVE` attempts in flight (default 2, the provider's 10 concurrent sandboxes divided by the run width of 5), `PYTHON_USER_VMS_PER_DAY` per user (default 60) and `PYTHON_VMS_PER_DAY` across all users (default 150), counted from stored `totalCount` over 24 hours, failed and aborted runs included. The defaults suit the Hobby plan (5,000 creations a month is about 166 a day); raise them with those variables on a larger plan. When a budget is exhausted the learner sees a message that names Python only and JavaScript is unaffected.
- **Not measured:** peak memory is reported as unknown, and runtime is host-observed wall time (a round trip to the VM, about 1.8 s for a trivial case).

### What this does and does not guarantee

- **The learner process is genuinely unprivileged** (verified live, below): uid 65534, no capabilities of any kind, `no_new_privs`, limits it cannot raise, no ability to start a process or thread.
- **No aggregate (cgroup) bound.** cgroup v2 is read-only to the image's default user, so there is no enforceable pids or memory limit beyond the VM itself. `RLIMIT_FSIZE` is per file.
- **Blast radius.** The VM is the outer boundary: one vCPU, 2 GiB, no network, no secrets, 30 s provider TTL, host-side wall-clock kill and `stop()`.
- **Hidden-case information.** Hidden inputs do enter the VM, and Submit reports a pass count and the slowest runtime, so a determined learner can extract a bit per case by passing or failing, or by sleeping. This is the usual judge trade-off and is bounded by the attempt and VM budgets above; it does not reveal expected outputs, which never enter a VM.
- **Programs that use threads or subprocesses fail** (`can't start new thread`, `BlockingIOError`). The problem library does not need either.
- **Capacity.** The per-instance gate (8 VMs) and per-run width (5) only keep one server from queueing itself. Concurrency across serverless instances is bounded by the Python active-attempt budget and the provider's quota.
- **Not yet done:** an unforged exit-70 path was exercised only by the bootstrap itself in the first failing runs; a full 10-case end-to-end run in one submission was not repeated after the final bootstrap (6 `while True` cases took 9.5 s, under the 20 s budget).

## Live evidence (October 20, 2026)

All runs went through the app's own executor against the real image (`vercel/sandbox/python:3.14`: Python 3.14.4, x86_64, kernel 6.18) with a development OIDC token. Dozens of VMs were created in total. `vercel sandbox list` showed no sandboxes left after the runs.

**1. The first design was wrong.** A diagnostic showed the default user (uid/gid 1000, `vercel-sandbox`) holds **all** capabilities (`CapEff`, `CapPrm`, `CapAmb`, `CapBnd` = `0x1ffffffffff`) and has passwordless `sudo` (`sudo -n true` exits 0). `RLIMIT_NPROC` therefore did not stop `fork()` (the process is exempt through `CAP_SYS_RESOURCE`), and any rlimit could be raised again. The earlier text of this document ("runs as the unprivileged user (no `sudo`)", "hard limits cannot be raised") was false for the real image. Other findings: a seccomp filter is already present (mode 2, 1 filter), cgroup v2 is read-only to that user (`memory.max` = 2147483648, `pids.max` = max), 1 vCPU, about 2.2 GB RAM, `/vercel/sandbox` is writable and is the working directory, only 15 benign environment variable names exist (CA bundle paths, `HOME`, `LANG`, `PATH`, `SHELL`, and `SUDO_*` set by sudo), and a TCP connect to 1.1.1.1:53 timed out (one destination only).

**2. The first redesign failed closed on every real run.** The root-then-drop bootstrap passed in a local container but refused all 13 real runs with `AS_SANDBOX_SETUP_FAILED CapInh: 000001ffffffffff`: `setuid` clears the permitted, effective and ambient sets but not the inheritable one. The proof of the drop caught it, so no learner code ran as root, but every submission would have reported "temporarily unavailable". The local container had not shown this. The fix is the `capset` call and bounding-set drop described above.

**3. The current bootstrap passed.** An earlier matrix (30 VMs) ran on a variant of the bootstrap that cleared only the inheritable set; the table below was then re-run in full against the **exact committed bootstrap** (inheritable and bounding sets cleared, all five capability sets checked): 10 VMs, no infrastructure errors, every row as listed. "Refused" means the operation raised an error. Raw output is kept with the evidence from this session, not in the repository.

| Case | Result |
| --- | --- |
| Correct solution | ACCEPTED in about 1.8 s |
| Identity and capabilities | uid, euid, gid 65534, groups `[]`, `CapInh`/`CapPrm`/`CapEff`/`CapBnd`/`CapAmb` all `0`, `NoNewPrivs` 1 |
| `setuid(0)` | `PermissionError` |
| `sudo -n true` | fork refused (`BlockingIOError`) |
| Raise `RLIMIT_NPROC`/`CPU`/`DATA` | refused ("not allowed to raise maximum limit") |
| `fork()` | errno 11, output not duplicated |
| Threads | "can't start new thread" |
| Write `/etc`, `/usr/local`, `/vercel/sandbox/*` (including `boot.py`) | denied (`/tmp` writable) |
| `kill(1)`, `ptrace` | EPERM |
| `/proc/1/environ` | denied; own environment holds nothing secret |
| `while True: pass` | `TIME_LIMIT` (the VM-level round trip is about 4 s) |
| `time.sleep(30)` | `TIME_LIMIT` at the wall deadline, not 30 s |
| Memory bomb | `MemoryError`, `MEMORY_LIMIT` |
| 100 MB output flood | `RUNTIME_ERROR` "Output exceeds the sandbox limit"; host memory did not balloon (about 62 to 88 MB, the same as other cases in the batch) |
| Syntax error / `ValueError` | `COMPILE_ERROR` (exit 3) / `RUNTIME_ERROR` with traceback tail |
| TCP connect, DNS lookup | timed out / "Temporary failure in name resolution" |
| `sys.exit(70)`, with or without printing the setup marker | exit 1, `RUNTIME_ERROR` (the harness catches `SystemExit`, so a learner cannot reach exit 70 this way; only `os._exit(70)` plus a forged marker could, and that only makes their own run unavailable) |
| Run of 2 cases (1 correct, 1 wrong expectation) | `ACCEPTED`, `WRONG_ANSWER` in 1.9 s total |
| Run of 6 `while True` cases (two waves of 5) | all `TIME_LIMIT` in 9.5 s total, under the 20 s budget |

Separate single-VM runs on the final code checked a 5,000-deep recursion (succeeds), an infinite recursion (ordinary `RecursionError`, exit 1), a `-0.0` result (accepted as `0`) and clean tracebacks for a runtime error, a syntax error and an unserialisable result.

**4. Compatibility scan and end-to-end browser run.** (a) All 1,014 stored test cases of the 125 runnable problems were round-tripped through Python `json.dumps` and Node `JSON.parse`: 0 mismatches (largest integer 68,719,476,736; only ten floats, all exact `.5`; no objects, no non-ASCII text, no `-0`). Reference solutions for 9 problems of different shapes passed every stored case through the real harness (60/60). That scan found the recursion-limit and `-0.0` defects fixed above. (b) With `PYTHON_RUNNER` set, a signed-in browser session against real Sandbox VMs showed Python alongside JavaScript in the language selector with snake_case starters; Run of a correct solution passed 2/2 in 2.3 s, a wrong answer 1/2, Submit of a correct solution was Accepted 6/6 in 4.1 s and the problem showed "Solved, verified"; a syntax error, a runtime error (traceback in the case detail), an infinite loop (time limit, 5 s for the run) and an output flood each gave the matching verdict and nothing hung; JavaScript Run and Submit still worked with Python enabled.

**5. Leaderboard.** Manual "Mark solved" did not put the account on the board; a judged Python Submit put it there with 1 solve and a judged JavaScript Submit made it 2 immediately; undoing the manual solve left the count unchanged. The test found that the profile leaderboard switch could end up showing a stale state after saving (React resets a form after its action), which could silently flip what was saved next; the switch is now uncontrolled with `defaultChecked` following its state.

**Known gaps:** the editorial "reference" code on problem pages is JavaScript-only even when Python is selected (content, not a runner issue); the unforged exit-70 path and a full 10-case run after the final bootstrap were not repeated live.

## Go-live checklist

Do not skip steps or reorder them. Production keeps `PYTHON_RUNNER` unset until step 3.

1. **Done (2026-10-20).** Sandbox is enabled for the Vercel project, the API is reachable and `vercel sandbox list` was empty before and after the runs. Production already has `CODE_RUNNER_ENABLED` and `CODE_RUNNER_PROVIDER` (the in-process sandbox runner has been verified live for JavaScript). Preview has no database or Supabase variables, so a Preview trial with real accounts is not possible; use the Production canary below.
2. **Done (2026-10-20).** Live diagnostic and adversarial matrix on the real image, above.
3. **Choose the budgets.** Keep the Hobby defaults or set `PYTHON_USER_VMS_PER_DAY`, `PYTHON_VMS_PER_DAY` and `PYTHON_MAX_ACTIVE` for your plan (each Python Submit starts up to 10 VMs).
4. **Production canary, with the owner's go-ahead.** Add `PYTHON_RUNNER=vercel-sandbox` to Production and redeploy. No problem offers Python yet because no Python starter is seeded. Then, from a trusted checkout, run `npm run db:seed:python-starters -- --slug relay-window` (one insert-only row). As a signed-in account, Run and Submit correct, wrong and failing Python on that problem, and check the Vercel logs, the Sandbox dashboard (no VMs left) and that JavaScript still works.
5. **Roll out.** Run `npm run db:seed:python-starters` without `--slug` for the remaining problems.
6. **Roll back.** Remove `PYTHON_RUNNER` and redeploy; the editor then disables Run for Python. Seeded starter rows can stay.

Standing requirements:

- **Re-run the matrix** whenever the image tag (`vercel/sandbox/python:3.14`) or the bootstrap (`PYTHON_BOOTSTRAP`) changes. The first two designs failed only against the real image, so local checks are not enough.
- **Vercel OIDC tokens expire after 12 hours.** For local live runs fetch a fresh one with `vercel env pull <scratch file> --environment=development`, writing to a scratch file and never overwriting a tracked file.
