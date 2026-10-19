import { isPythonIdentifier } from "./python-names";

// Exit codes the generated Python program uses. The outcome mapper in python-runner.ts depends on them.
export const PYTHON_EXIT_RUNTIME_ERROR = 1;
export const PYTHON_EXIT_COMPILE_ERROR = 3;

// Learner code and the entry point reach Python only as JSON string literals. JSON.stringify output is a valid Python
// string literal (it never emits \/ or raw line breaks), so nothing the learner types can break out of the literal.
function literal(value: string) { return JSON.stringify(value); }

// Text handed to a Python runtime. Never evaluate it inside Next.js, Node vm, or a local child process.
export function makePythonProgram(entryPoint: string, code: string) {
  if (!isPythonIdentifier(entryPoint)) throw new Error("Unsupported runner signature");
  return `import json as __as_json
import sys as __as_sys
import traceback as __as_traceback

__as_entry = ${literal(entryPoint)}
__as_source = ${literal(code)}


def __as_main():
    __as_stdout = __as_sys.stdout
    __as_args = __as_json.loads(__as_sys.stdin.read())
    # Learner print() output goes to stderr; only the JSON result is written to the real stdout.
    __as_sys.stdout = __as_sys.stderr
    try:
        __as_code = compile(__as_source, "solution.py", "exec")
    except BaseException:
        __as_traceback.print_exc(file=__as_sys.stderr)
        return ${PYTHON_EXIT_COMPILE_ERROR}
    try:
        __as_scope = {"__name__": "solution"}
        exec(__as_code, __as_scope)
        __as_solve = __as_scope.get(__as_entry)
        if not callable(__as_solve):
            raise NameError("Define a function named " + __as_entry + ".")
        __as_text = __as_json.dumps(__as_solve(*__as_args), allow_nan=False, ensure_ascii=False, separators=(",", ":"))
        # Keep lone UTF-16 surrogates representable as JSON escapes while other
        # Unicode is emitted as UTF-8, matching the JavaScript result encoding.
        __as_text = __as_text.encode("utf-8", errors="backslashreplace").decode("utf-8")
    except BaseException:
        __as_traceback.print_exc(file=__as_sys.stderr)
        return ${PYTHON_EXIT_RUNTIME_ERROR}
    __as_stdout.write(__as_text)
    __as_stdout.flush()
    return 0


raise SystemExit(__as_main())
`;
}
