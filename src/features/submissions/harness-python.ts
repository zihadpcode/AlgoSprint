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


def __as_report():
    # Print the traceback from the first frame in the learner's own code, so the harness's frames do not clutter it.
    __as_kind, __as_value, __as_tb = __as_sys.exc_info()
    while __as_tb is not None and __as_tb.tb_frame.f_code.co_filename != "solution.py":
        __as_tb = __as_tb.tb_next
    __as_traceback.print_exception(__as_kind, __as_value, __as_tb, file=__as_sys.stderr)


def __as_main():
    __as_stdout = __as_sys.stdout
    __as_args = __as_json.loads(__as_sys.stdin.read())
    # Python's default limit (1000) is far below what the same recursive solution gets in JavaScript (about 11,000 frames), and
    # some problems have inputs thousands of levels deep. Pure-Python frames do not use the C stack in 3.12+; memory is bounded by the sandbox.
    __as_sys.setrecursionlimit(15000)
    # Learner print() output goes to stderr; only the JSON result is written to the real stdout.
    __as_sys.stdout = __as_sys.stderr
    try:
        __as_code = compile(__as_source, "solution.py", "exec")
    except BaseException:
        __as_report()
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
        __as_report()
        return ${PYTHON_EXIT_RUNTIME_ERROR}
    __as_stdout.write(__as_text)
    __as_stdout.flush()
    return 0


raise SystemExit(__as_main())
`;
}
