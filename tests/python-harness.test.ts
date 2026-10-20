import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { makeProgram, makeStdin } from "@/features/submissions/harness";
import { executionInput } from "@/features/submissions/contracts";

const code = "def relay_window(loads, width):\n    return max(sum(loads[i:i + width]) for i in range(len(loads) - width + 1))";

// The JavaScript program must stay byte-identical to what Judge0 and the sandbox have always received.
function legacyJavaScript(entry: string, source: string) {
  return `const __asArgs = JSON.parse(require("fs").readFileSync(0, "utf8"));
const __asWrite = process.stdout.write.bind(process.stdout);
const __asJSON = JSON.stringify.bind(JSON);
console.log = (...args) => process.stderr.write(args.map(String).join(" ") + "\\n");
const __asSolve = (() => {
${source}
;return ${entry};
})();
Promise.resolve(__asSolve(...__asArgs)).then(value => {
  const json = __asJSON(value);
  if (json === undefined) throw new Error("Return a JSON value from your function.");
  __asWrite(json);
}).catch(error => { console.error(error); process.exitCode = 1; });
`;
}

it("accepts JAVASCRIPT and PYTHON and nothing else, strictly", () => {
  const base = { slug: "relay-window", mode: "RUN", code: "x" };
  expect(executionInput.safeParse({ ...base, language: "JAVASCRIPT" }).success).toBe(true);
  expect(executionInput.safeParse({ ...base, language: "PYTHON" }).success).toBe(true);
  for (const language of ["JAVA", "python", "TYPESCRIPT", "", undefined]) expect(executionInput.safeParse({ ...base, language }).success).toBe(false);
  expect(executionInput.safeParse({ ...base, language: "PYTHON", extra: 1 }).success).toBe(false);
});
it("keeps the JavaScript program byte-identical, defaulting to JavaScript", () => {
  const js = "function relayWindow(loads, width) { return 1; }";
  expect(makeProgram("relay-window", "relayWindow", js)).toBe(legacyJavaScript("relayWindow", js));
  expect(makeProgram("relay-window", "relayWindow", js, "JAVASCRIPT")).toBe(legacyJavaScript("relayWindow", js));
});
it("only accepts the snake_case entry point for Python and the camelCase one for JavaScript", () => {
  expect(() => makeProgram("relay-window", "relayWindow", code, "PYTHON")).toThrow("Unsupported runner signature");
  expect(() => makeProgram("relay-window", "relay_window", code, "JAVASCRIPT")).toThrow("Unsupported runner signature");
  expect(() => makeProgram("not-a-signature", "relay_window", code, "PYTHON")).toThrow("Unsupported runner signature");
  expect(() => makeProgram("relay-window", "relay_window; import os", code, "PYTHON")).toThrow("Unsupported runner signature");
});
it("generates a Python program that reads stdin JSON, isolates print, and writes only json.dumps to stdout", () => {
  const program = makeProgram("relay-window", "relay_window", code, "PYTHON");
  expect(program).toContain("__as_json.loads(__as_sys.stdin.read())");
  expect(program).toContain("__as_sys.stdout = __as_sys.stderr");
  expect(program).toContain("exec(__as_code, __as_scope)");
  expect(program).toContain('compile(__as_source, "solution.py", "exec")');
  expect(program).toContain("allow_nan=False");
  expect(program).toContain("__as_solve(*__as_args)");
  expect(program).toContain("__as_traceback.print_exception(__as_kind, __as_value, __as_tb, file=__as_sys.stderr)");
  expect(program).not.toContain("print_exc(");
  expect(program).toContain("raise SystemExit(__as_main())");
});
it("passes learner code only as a JSON string literal so it cannot break out of the harness", () => {
  const hostile = 'x = """\n\'\'\'\\"\n__import__("os").system("echo pwned")\n#"""\u2028\u00e9\u{1f600}';
  const program = makeProgram("relay-window", "relay_window", hostile, "PYTHON");
  const literalLine = program.split("\n").find((line) => line.startsWith("__as_source = "))!;
  expect(JSON.parse(literalLine.slice("__as_source = ".length))).toBe(hostile);
  // The raw hostile text never appears as program text.
  expect(program).not.toContain('__import__("os")');
  expect(program.split("\n").filter((line) => line.startsWith("__as_source = "))).toHaveLength(1);
});

const hasPython = spawnSync("python3", ["--version"]).status === 0;
// Local check of the harness semantics only. Python is not part of the product; the real runtime is a pending decision.
const run = (source: string, args: unknown[], entry = "relay_window") => {
  const dir = mkdtempSync(join(tmpdir(), "as-py-"));
  try {
    const file = join(dir, "program.py");
    writeFileSync(file, makeProgram("relay-window", entry, source, "PYTHON"));
    const done = spawnSync("python3", [file], { input: JSON.stringify(args), encoding: "utf8", timeout: 20_000 });
    return { status: done.status, stdout: done.stdout, stderr: done.stderr };
  } finally { rmSync(dir, { recursive: true, force: true }); }
};
const executable = it.skipIf(!hasPython);
executable("python3: returns the result as JSON on stdout, with print output kept on stderr", () => {
  const done = run(`def relay_window(loads, width):\n    print("debug line")\n    return {"best": [loads[0], width], "ok": True, "none": None}`, [[4, 5], 2]);
  expect(done).toMatchObject({ status: 0, stdout: '{"best":[4,2],"ok":true,"none":null}' });
  expect(done.stderr).toContain("debug line");
});
executable("python3: serializes compact UTF-8 JSON at the shared result boundary without a newline", () => {
  const expected = "é".repeat(131071);
  const done = run('def relay_window(loads, width):\n    return "é" * 131071', [[1], 1]);
  expect(done.status).toBe(0);
  expect(done.stdout).toBe(JSON.stringify(expected));
  expect(Buffer.byteLength(done.stdout)).toBe(262144);
  const lone = run('def relay_window(loads, width):\n    return chr(0xd800)', [[1], 1]);
  expect(lone).toMatchObject({ status: 0, stdout: JSON.stringify(String.fromCharCode(0xd800)) });
});
executable("python3: solves a real case from the seeded stdin shape", () => {
  const stdin = JSON.parse(makeStdin("relay-window", { loads: [3, 1, 5, 2, 6, 1], width: 3 })) as unknown[];
  expect(run(code, stdin)).toMatchObject({ status: 0, stdout: "13" });
});
executable("python3: survives hostile learner source and a non-main __name__", () => {
  const hostile = `"""docstring with ''' and \\\\ and \u2028 and \u00e9\u{1f600}"""\nS = '\\\\n\\\\"'\nif __name__ == "__main__":\n    raise SystemExit(7)\ndef relay_window(loads, width):\n    return S + "\u{1f600}"`;
  const done = run(hostile, [[1], 1]);
  expect(done.status).toBe(0);
  expect(JSON.parse(done.stdout)).toBe('\\n\\"\u{1f600}');
});
executable("python3: exits 1 with a traceback and no stdout for runtime errors, NaN and unserializable results", () => {
  for (const body of ["return 1 // 0", "return float('nan')", "return float('inf')", "return {1, 2}", "import sys\n    sys.exit(0)", "raise KeyboardInterrupt()"]) {
    const done = run(`def relay_window(loads, width):\n    ${body}`, [[1], 1]);
    expect(done.status, body).toBe(1); expect(done.stdout, body).toBe(""); expect(done.stderr, body).toMatch(/Error|Exception|Interrupt|SystemExit/);
  }
});
executable("python3: exits 3 for syntax errors and 1 when the entry point is missing or not callable", () => {
  const syntax = run("def relay_window(:\n    pass", [[1], 1]);
  expect(syntax).toMatchObject({ status: 3, stdout: "" }); expect(syntax.stderr).toContain("SyntaxError");
  const missing = run("def other():\n    pass", [[1], 1]);
  expect(missing).toMatchObject({ status: 1, stdout: "" }); expect(missing.stderr).toContain("Define a function named relay_window");
  expect(run("relay_window = 5", [[1], 1])).toMatchObject({ status: 1, stdout: "" });
});

executable("python3: a natural recursive solution survives a 5,000-level input, as it does in JavaScript", () => {
  // grove-harvest has a depth-5000 tree; Python's default recursion limit of 1000 would raise RecursionError.
  const done = run("def relay_window(depth, _):\n    def down(n):\n        return 0 if n == 0 else 1 + down(n - 1)\n    return down(depth)", [5000, 0]);
  expect(done.status).toBe(0);
  expect(done.stdout).toBe("5000");
});
executable("python3: an infinite recursion still ends as an ordinary runtime error", () => {
  const done = run("def relay_window(a, b):\n    def down(n):\n        return down(n + 1)\n    return down(0)", [0, 0]);
  expect(done.status).toBe(1);
  expect(done.stderr).toContain("RecursionError");
});
executable("python3: tracebacks start in the learner's code, without the harness's own frames", () => {
  const runtime = run("def relay_window(a, b):\n    return helper(a)\n\ndef helper(x):\n    return 1 // 0", [1, 2]);
  expect(runtime.status).toBe(1);
  expect(runtime.stderr).toContain("Traceback (most recent call last)");
  expect(runtime.stderr).toContain('File "solution.py", line 2, in relay_window');
  expect(runtime.stderr).toMatch(/ZeroDivisionError: .*zero/);
  expect(runtime.stderr).not.toMatch(/__as_|program\.py/);
  const syntax = run("def relay_window(a, b)\n    return 1", [1, 2]);
  expect(syntax.status).toBe(3);
  expect(syntax.stderr).toContain("SyntaxError");
  expect(syntax.stderr).not.toMatch(/__as_|program\.py/);
  // A failure inside the harness itself (an unserialisable result) still reports the exception, just without a harness traceback.
  const unserialisable = run("def relay_window(a, b):\n    return {1, 2}", [1, 2]);
  expect(unserialisable.status).toBe(1);
  expect(unserialisable.stderr).toContain("TypeError");
  expect(unserialisable.stderr).not.toMatch(/__as_|program\.py/);
});
