# Python runner: architecture and the pending runtime decision

**Status: plumbing only. No Python interpreter is installed, vendored or downloaded, and no dependency was added.** The only shipped Python executor reports `INTERNAL_ERROR` with the diagnostic "The Python runtime is not installed on this server." Choosing and vendoring a runtime is a decision for the project owner (see [Pending decision](#pending-decision)).

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

Exit codes are part of the executor contract: `0` success, `3` compile error (`SyntaxError` and friends), `1` runtime error (traceback on stderr), anything else is treated as a runtime error. The application compares stdout JSON itself (`isDeepStrictEqual` on parsed JSON), caps stored stdout at 4,000 characters (stderr keeps its last 4,000, where the exception line is), treats more than 90,000 characters of output as a runtime error, and keeps hidden-case inputs, expected values, output and diagnostics out of `SUBMIT` responses and stored results.

### Writing an executor

An executor runs one program against one stdin and reports what happened: `exited` (exit code, stdout, stderr, runtime, memory), `time-limit`, `memory-limit` or `unavailable`. It must give the program no host filesystem, network, environment variables or other processes, and enforce the time and memory budget it is given (already clamped to `RUNNER_LIMITS`). Install it with `registerPythonExecutor(executor)` and set `available: true`; the UI and the action then expose Python automatically. Application execution remains disabled and runner tests use a fake executor. The optional harness test may invoke an already-installed local `python3`; that test is separate from the application runtime.

## Add-on Python starters

`npm run starters:python` regenerates `src/data/seeds/languages/python-starters.json` from `SIGNATURES` (one short stub per slug with `pass`; names and parameters in snake_case). `npm run seed:validate` checks that every slug exists, entry points and parameters are valid non-keyword identifiers, parameters do not collide, and the file matches the generator.

`seedLanguageStarters` in `prisma/seed-language-starters.ts` inserts missing `StarterCode` rows for existing problems. It never updates or deletes, never touches `Problem` rows (so insert-only problem seeding and its content-hash protection are unaffected), is idempotent, and throws a conflict error before writing anything if an existing row for the same problem and language differs. It is **not yet wired into `prisma/seed.ts`**. The wiring is one line after `seedProblems`:

```ts
console.log("Language starters:", await seedLanguageStarters(db, await loadPythonStarters()));
```

(plus importing both functions from `./seed-language-starters`). Until Python starters are seeded and an executor is installed, Python is neither offered nor runnable in production.

## Pending decision

**Nothing is installed until the owner approves vendoring an interpreter and a WASI host dependency.** A previous attempt to add both was denied by the permission system as untrusted code integration, and that decision belongs to the owner.

The earlier prototype used **CPython 3.12 compiled to WASI**, release `python/3.12.0+20231211-040d5a6` of `vmware-labs/webassembly-language-runtimes`, file `python-3.12.0.wasm` with sha256 `e5dc5a398b07b54ea8fdb503bf68fb583d533f10ec3f930963e02b9505f7a763`, run through a **pure-JavaScript WASI host with an in-memory, read-only filesystem**, inside a worker that can be terminated.

This historical artifact is not a selected production runtime. The [vendor repository](https://github.com/vmware-labs/webassembly-language-runtimes) announces a handoff to a community fork, and its listed Python binary is the older 3.12.0 release. Before choosing a build, review its maintenance, security patch provenance, license, host capabilities, resource enforcement and Vercel compatibility. [WASI isolation](https://wasi.dev/security) depends on the capabilities granted by the host; a prototype alone does not establish a production security boundary.

Measured in a prototype on 2026-10-13:

- Startup about 70 ms.
- Host files unreachable (only the in-memory filesystem exists).
- Sockets unsupported.
- A memory bomb raised `MemoryError` once a memory maximum was patched into the module.
- An infinite loop was killed by terminating the worker.
- About 7-10x slower than native CPython: a 10^7-iteration loop took 5 s, so the current 2 s per-case budget suits small inputs only.

Rejected alternatives:

- **Pyodide**: its JavaScript bridge lets Python code reach host globals and `process.env`.
- **MicroPython (WASM)**: same class of problem; the JS bridge exposes the host.

If approved, the work is: vendor the pinned binary with its checksum verified at build time, add the WASI host as a reviewed dependency, implement `PythonExecutor` on top of them (worker per case, memory maximum patched in, worker termination on timeout), register it at startup, wire the starter seed, and re-run the sandbox escape checks used for QuickJS (`npm run test:trace`).
