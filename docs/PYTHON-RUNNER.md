# Python runner: architecture and the Vercel Sandbox executor

**Status: the executor is implemented, reviewed once, and OFF by default. Do not enable it yet.** Python runs only when a deployment sets `PYTHON_RUNNER=vercel-sandbox` (with `CODE_RUNNER_ENABLED=true` and `CODE_RUNNER_PROVIDER=sandbox`); the flag is absent from Production and Preview. The owner chose Vercel Sandbox on October 19, 2026. **A trusted live bootstrap probe failed on October 20, 2026; Python remains unavailable to learners.** Unit tests use a fake VM, and the local Linux checks differ from the live result (see [Executor](#vercel-sandbox-executor)). Complete the [go-live checklist](#go-live-checklist) first.

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

`seedLanguageStarters` in `prisma/seed-language-starters.ts` inserts missing `StarterCode` rows for existing problems. It never updates or deletes, never touches `Problem` rows (so insert-only problem seeding and its content-hash protection are unaffected), is idempotent, and throws a conflict error before writing anything if an existing row for the same problem and language differs. It is deliberately **not** part of `npm run db:seed`: once these rows exist the editor offers Python (with Run disabled until `PYTHON_RUNNER` is set). Run `npm run db:seed:python-starters` (`scripts/seed-python-starters.ts`) only when the runner is about to be switched on. It reuses the same insert-only, conflict-checked function and is safe to repeat.

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

Even a successful live result would not prove the final learner runner: it does not test a 256 MiB production case limit, two-second case deadline, hidden-case secrecy, per-user/per-case VM isolation, DNS and all network paths, or actual malicious submissions. The next step is a single quota-checked live run of this trusted probe, then a separate bounded runner design and adversarial end-to-end verification before registering an available Python executor or seeding starters. No live VM is started by tests, builds or imports.

[Hobby quotas](https://vercel.com/docs/sandbox/pricing) currently include 5 active-CPU hours, 420 GB-hours and 5,000 creations per month; exhaustion pauses creation rather than charging overages. Pro usage is metered. AlgoSprint currently admits up to 20 active server executions while Hobby allows 10 concurrent sandboxes, so provider-specific admission/capacity handling is needed. Confirm the actual team plan, remaining quota and budget before a live pilot; no service was activated during this review.

The next approved implementation must preserve the executor contract, reject unsupported execution before reservation, and pass escape/resource/cancellation/cleanup checks in the intended environment. Wire and verify the insert-only starter seed only after that runtime is ready. The existing `test:trace` checks packaging and selected QuickJS behavior; it does not prove Python or a remote judge secure.

## Vercel Sandbox executor

`src/features/submissions/python-vercel-sandbox.ts`, selected by `getPythonExecutor()` only when `PYTHON_RUNNER=vercel-sandbox` (a registered executor, used by tests, still wins).

- **One new VM per test case.** Image `vercel/sandbox/python:3.14`, one vCPU, `networkPolicy: "deny-all"`, no ports, nothing mounted, no credentials or environment passed in, `persistent: false`, 30 s provider TTL as a backstop. The command is killed and the VM stopped in `finally`. Nothing is reused across cases or users, and expected outputs never enter a VM.
- **Files, not arguments.** The generated program and the case input are written to the VM as files under the absolute directory `/vercel/sandbox` (`boot.py`, `program.py`, `input.json`) and the command runs with that as its working directory, so nothing depends on where the SDK starts a command. Learner text never appears on a command line.
- **One hard deadline.** `executePython` creates a single `AbortSignal.timeout(totalBudgetMs)` (20 s, monotonic) and passes it to every case. It covers waiting for a free slot, VM start-up, file upload and the run; when it fires the executor kills the command and stops the VM, and `executePython` also stops waiting on its own, so an executor that ignores the signal still cannot hold the run past the deadline. Cases not finished by then get `TIME_LIMIT` ("The submission exceeded the total execution budget"). Each case also has its own wall-clock deadline (case time limit plus 600 ms start-up).
- **Bounded output on the host.** The command runs detached and **without** `stdout`/`stderr` options, because @vercel/sandbox 3.8.0 accumulates every byte of output in memory when those are given, whatever cap the caller applies. Output is instead read from `Command.logs()` into a collector that keeps at most 256 KiB + 1 byte per stream and stops reading, kills the command and reports "output too large" as soon as either stream passes that. Host memory retained by the collector is therefore about the cap plus one chunk. A failed log stream or a stream that does not finish within 1.5 seconds after process exit is an infrastructure failure; partial output is never judged.
- **Limits inside the VM**, set by the bootstrap before any learner code runs, after rejecting real/effective root and setting and verifying Linux `PR_SET_NO_NEW_PRIVS` (failure stops execution before learner code): CPU seconds, data segment (case memory limit plus 32 MiB for the interpreter), address space, 32 open files, 1 MiB per written file, no core files, and `RLIMIT_NPROC=0`, intended to block new processes and threads regardless of other same-user processes exiting; the live probe failed this process restriction. `no_new_privs` also prevents replacing the current process with a setuid executable (such as `sudo`) to regain privileges. Hard limits are lowered together with soft ones, so the program cannot raise them.
- **Verdicts:** deadline or SIGXCPU is `TIME_LIMIT`; `MemoryError` or a kernel kill is `MEMORY_LIMIT`; exit 3 is a compile error; anything else non-zero is a runtime error. Quota, capacity and provider failures become one generic `INTERNAL_ERROR` message ("Python execution is temporarily unavailable"), never a wrong answer, and provider text is never shown.
- **Cleanup:** command kill and VM stop are both attempted in `finally`, with separate two-second bounds. A hung kill cannot prevent stop or indefinitely retain an instance slot. Failed cleanup still relies on the provider TTL and must be checked in the live probe.
- **Not measured:** peak memory is reported as unknown, and runtime is host-observed wall time (it includes a round trip to the VM).

### What this does and does not guarantee

- **Per-process, not aggregate, limits.** `RLIMIT_CPU`/`RLIMIT_DATA` apply to one process. They would bound the whole program only if process and thread creation were reliably blocked. That relies on the kernel honouring `RLIMIT_NPROC=0` and `no_new_privs` in the real image. The October 20 live probe reached its fork-allowed failure branch, so this aggregate-bound assumption is not established and must not be used to activate the runner. A cgroup (v2) memory/CPU/pids limit with `cgroup.kill` would be an enforceable aggregate limit, but it needs a privileged bootstrap and live confirmation that delegation works (see `scripts/probe-python-sandbox-enforcement.ts`). The observed failure rules out accepting the current NPROC-only approach as an aggregate bound. Verify an enforceable replacement against the recorded managed image before enabling Python.
- **Programs that use threads or subprocesses fail** (`can't start new thread`, `BlockingIOError`). The problem library does not need either.
- **Blast radius.** Anything that slips past the rlimits is still confined to one throw-away VM: one vCPU, 2 GiB, no network, no secrets, 30 s TTL, wall-clock killed.
- **Capacity.** A per-instance gate (8 VMs) and a per-run width (5) keep one server from queueing itself. They are **not** a project-wide limit: concurrency across serverless instances is bounded only by the provider's quota, and exhaustion shows learners the generic unavailable message.

Local container check (Python 3.14, non-root, no network, same bootstrap and arguments): normal run correct; infinite loop killed by the CPU limit at about 2 s; memory bomb raised `MemoryError`; fork bomb got 0 processes (30 before NPROC was tightened); `threading` and `subprocess` refused; a 10 MB write failed with `EFBIG`; network unreachable; raising a limit refused; syntax and runtime errors mapped. This approximates, and does not replace, a live Sandbox check.

## Go-live checklist

Do not skip steps or reorder them. Production and Preview must keep `PYTHON_RUNNER` unset until step 4.

1. Confirm Sandbox is enabled for the Vercel project and check the plan quota. Hobby allows 10 concurrent sandboxes and monthly CPU and creation caps; each Python run starts up to one VM per test case (at most 10), so capacity is the practical limit.
2. Run the saved trusted probes once (`scripts/inspect-python-sandbox.ts`, `scripts/probe-python-sandbox-enforcement.ts`) with owner approval. Confirm the image runs as a non-root user, that `/vercel/sandbox` is writable, and whether cgroup delegation works. Also exercise the actual `PYTHON_BOOTSTRAP` from the executor: verify `no_new_privs` readback, denial of privilege gain across `exec`, and that hard `RLIMIT_NPROC=0` blocks a second process. The separate cgroup probe does not exercise these bootstrap protections. The October 20 fork-denial failure must be resolved; require live-verified aggregate resource enforcement before continuing.
3. With owner approval, run a bounded live test on a Preview deployment with the flag set only there: a correct solution, an infinite loop, a sleeping program, a memory bomb, a fork/thread attempt and an output flood. Check the verdicts, the elapsed time against the 20 s budget, that output cannot grow server memory, and in the Vercel dashboard that no VMs remain afterwards (command kill and stop, not just the TTL).
4. Set `PYTHON_RUNNER=vercel-sandbox` in Production, redeploy, then run `npm run db:seed:python-starters` from a trusted checkout (insert-only) so the editor offers Python.
5. To turn Python off, remove `PYTHON_RUNNER` and redeploy. The language selector then disables Run for Python again.

The optional local regression `PYTHON_BOOTSTRAP_LINUX_CHECK=1 npx vitest run tests/python-bootstrap-linux.test.ts` uses an already-installed `python:3.14-slim` Docker image with no network and bounded CPU/memory/PIDs. It confirms a root-owned setuid `id` gains root in the control, remains unprivileged when reached through the bootstrap via `os.execv`, and that root execution, failed `prctl`, and `fork` are rejected. This proves the local kernel path only; it does not establish the managed image's sudo policy or live runner enforcement.

## October 20 trusted live bootstrap probe: NO GO

One trusted probe ran against the AlgoSprint Hobby project, using the actual bootstrap from this change and no learner code, application credentials, expected outputs or account data. The command requested `vercel/sandbox/python:3.14`, one vCPU, deny-all networking, nonpersistent storage, a 30-second expiry and automatic stop. Vercel CLI 64.7.0 delegated to Sandbox CLI 4.4.0.

The session record (`sbx_TFXNVA8iVVaWpRf8Guu6QxYw9zmC`) reports **stopped**, a 1,271 ms duration and legacy runtime label `node22`; a later read-only Sandbox-object lookup identifies image `vercel/sandbox/python@sha256:5db625121b2172bb6af2c08d9d0df094eb7229e5e284a3f4dee673f6408968aa`. The legacy runtime label alone does not identify the image. The exact trusted setup is preserved by `buildPythonBootstrapProbeSetup()` in `scripts/lib/python-bootstrap-probe.ts` (SHA256 `8f3ddb2e5899b029cf4195df33d7975b066ba2d071a84cbb137a2bbb3c180ff0`); importing or calling that builder creates no VM. The command (`cmd_6ac5907d4e324e8689de0acb6a7d`) reports exit code **9**, used by the trusted fixture only when `os.fork()` succeeds. Before that attempt, the fixture asserted a non-root real/effective UID, `no_new_privs=1` and hard/soft `RLIMIT_NPROC=(0,0)`. Therefore the live process restriction failed despite passing locally. Thread denial and later assertions were not reached.

The CLI returned status zero without the command's JSON output, so its process status alone was not a successful probe result. Reading the stopped command's logs returned 410; the session and command metadata provided the failure evidence. No second VM or automatic retry was started, and Production/Preview `PYTHON_RUNNER` remained absent.

Activation remains blocked. Use a live-verified aggregate process/resource boundary against the recorded Python image; do not accept the current NPROC-only approach. This one probe does not establish memory, CPU, network or full learner-runner isolation.
