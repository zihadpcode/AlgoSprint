# Python runner: architecture and the Vercel Sandbox executor

**Status: the executor is implemented and OFF by default.** Python runs only when a deployment sets `PYTHON_RUNNER=vercel-sandbox` (with `CODE_RUNNER_ENABLED=true` and `CODE_RUNNER_PROVIDER=sandbox`). The owner chose Vercel Sandbox on October 19, 2026. Nothing has been run in a live Sandbox VM yet: the unit tests use a fake VM, and the in-VM limits were exercised in a local Linux container (see [Executor](#vercel-sandbox-executor)). Complete the [go-live checklist](#go-live-checklist) before turning it on.

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

`seedLanguageStarters` in `prisma/seed-language-starters.ts` inserts missing `StarterCode` rows for existing problems. It never updates or deletes, never touches `Problem` rows (so insert-only problem seeding and its content-hash protection are unaffected), is idempotent, and throws a conflict error before writing anything if an existing row for the same problem and language differs. It is wired into `prisma/seed.ts`, right after `seedProblems`:

```ts
console.log("Language starters:", await seedLanguageStarters(db, await loadPythonStarters()));
```

(plus importing both functions from `./seed-language-starters`). Until Python starters are seeded and an executor is installed, Python is neither offered nor runnable in production.

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

- **One new VM per test case.** Image `vercel/sandbox/python:3.14`, one vCPU, `networkPolicy: "deny-all"`, no ports, nothing mounted, no credentials or environment passed in, `persistent: false`, 30 s provider TTL as a backstop. The VM is stopped in `finally`. Nothing is reused across cases or users, and expected outputs never enter a VM.
- **Files, not arguments.** The generated program and the case input are written to the VM as files (`program.py`, `input.json`); a trusted bootstrap (`boot.py`) runs them. Learner text never appears on a command line.
- **Limits inside the VM**, set by the bootstrap before any learner code runs and applied to the unprivileged VM user (no `sudo`): CPU seconds, data segment (case memory limit plus 32 MiB for the interpreter), address space, at most 32 processes, 32 open files, 1 MiB per written file, no core files. Hard limits are lowered together with soft ones, so the program cannot raise them.
- **Limits on the host:** wall-clock deadline (case time limit plus 600 ms start-up) that aborts the command, stdout and stderr capped while streaming at the shared 256 KiB policy, and at most 4 VMs per submission and 8 per server instance.
- **Verdicts:** deadline or SIGXCPU is `TIME_LIMIT`; `MemoryError` or a kernel kill is `MEMORY_LIMIT`; exit 3 is a compile error; anything else non-zero is a runtime error. Quota, capacity and provider failures become one generic `INTERNAL_ERROR` message ("Python execution is temporarily unavailable"), never a wrong answer, and provider text is never shown.
- **Not measured:** peak memory is reported as unknown, and runtime is host-observed wall time (it includes a round trip to the VM).

Local container check (Python 3.14, non-root, no network, same bootstrap and arguments): normal run correct; infinite loop killed by the CPU limit at about 2 s; memory bomb raised `MemoryError`; fork bomb stopped by the process limit; a 10 MB write failed with `EFBIG`; network unreachable; raising a limit refused; syntax and runtime errors mapped. This approximates, and does not replace, a live Sandbox check.

## Go-live checklist

1. Confirm Sandbox is enabled for the Vercel project and check the plan quota. Hobby allows 10 concurrent sandboxes and monthly CPU and creation caps; each Python run starts up to one VM per test case (at most 10), so capacity is the practical limit. Exhaustion shows learners the generic unavailable message.
2. Run the saved trusted probes once (`scripts/inspect-python-sandbox.ts`, `scripts/probe-python-sandbox-enforcement.ts`) and confirm the image runs the bootstrap as a non-root user with working rlimits.
3. With the flag still off in production, run a preview deployment with the flag on and submit: a correct solution, an infinite loop, a memory bomb, a fork bomb and an output flood. Check the verdicts, the elapsed time against the 20 s budget, and in the Vercel dashboard that no VMs remain.
4. Set `PYTHON_RUNNER=vercel-sandbox` in Production, redeploy, then run `npm run db:seed` from a trusted checkout to insert the Python starters (insert-only; nothing existing changes).
5. To turn Python off, remove `PYTHON_RUNNER` and redeploy. The language selector then disables Run for Python again.
