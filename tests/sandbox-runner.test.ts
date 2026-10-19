import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { executeSandbox, SANDBOX_LIMITS } from "@/features/submissions/sandbox";
import { makeProgram, makeStdin } from "@/features/submissions/harness";

// The sandbox runs the exact program text the Judge0 path sends, so these tests build it with the real harness.
const program = (code: string) => makeProgram("relay-window", "relayWindow", code);
const limits = { timeMs: 2000, memoryKb: 262144 };
const stdin = (loads: number[], width: number) => makeStdin("relay-window", { loads, width });
const run = (code: string, cases: { loads: number[]; width: number; expected: unknown }[]) =>
  executeSandbox(program(code), cases.map((c) => ({ stdin: stdin(c.loads, c.width), expected: c.expected })), limits);

describe("QuickJS sandbox executor", () => {
  it("accepts a correct solution, measures time and memory, and rejects a wrong one without type coercion", async () => {
    const solution = "function relayWindow(loads, width) { let best = -Infinity; for (let s = 0; s + width <= loads.length; s++) { let t = 0; for (let i = s; i < s + width; i++) t += loads[i]; best = Math.max(best, t); } return best; }";
    const [ok, wrong] = await run(solution, [{ loads: [4, 5, 1], width: 2, expected: 9 }, { loads: [4, 5, 1], width: 2, expected: "9" }]);
    expect(ok).toMatchObject({ status: "ACCEPTED", stdout: "9", diagnostic: "" });
    expect(typeof ok.runtimeMs).toBe("number"); expect(ok.memoryKb).toBeGreaterThan(0);
    expect(wrong.status).toBe("WRONG_ANSWER");
  }, 20_000);
  it("supports modern syntax, async functions and console output routed to diagnostics", async () => {
    const [outcome] = await run("async function relayWindow(loads, width) { console.log('debug', width); const m = new Map(); m.set('a', loads.at(-1) ?? 0); return [...m.values()].map((n) => n ** 2); }", [{ loads: [2, 3], width: 1, expected: [9] }]);
    expect(outcome).toMatchObject({ status: "ACCEPTED", stdout: "[9]", diagnostic: "debug 1\n" });
  }, 20_000);
  it("classifies syntax errors, thrown errors, missing entry points and non-JSON returns", async () => {
    const cases = [{ loads: [1], width: 1, expected: 1 }];
    expect((await run("function relayWindow(loads, width { return 1; }", cases))[0]).toMatchObject({ status: "COMPILE_ERROR", diagnostic: expect.stringContaining("SyntaxError") });
    expect((await run("function relayWindow() { throw new Error('boom'); }", cases))[0]).toMatchObject({ status: "RUNTIME_ERROR", diagnostic: expect.stringContaining("boom") });
    expect((await run("const other = 1;", cases))[0]).toMatchObject({ status: "RUNTIME_ERROR", diagnostic: expect.stringContaining("relayWindow") });
    expect((await run("function relayWindow() { return undefined; }", cases))[0]).toMatchObject({ status: "RUNTIME_ERROR", diagnostic: expect.stringContaining("Return a JSON value") });
    expect((await run("function relayWindow() { return () => 1; }", cases))[0].status).toBe("RUNTIME_ERROR");
  }, 20_000);
  it("interrupts infinite loops, caps memory and reports deep recursion as a runtime error", async () => {
    const cases = [{ loads: [1], width: 1, expected: 1 }];
    const looped = await executeSandbox(program("function relayWindow() { while (true) {} }"), [{ stdin: stdin([1], 1), expected: 1 }], { timeMs: 300, memoryKb: 262144 });
    expect(looped[0]).toMatchObject({ status: "TIME_LIMIT", diagnostic: "Execution exceeded 300 ms." });
    expect(looped[0].runtimeMs).toBeLessThan(SANDBOX_LIMITS.maxCpuMs + 1500);
    const hungry = await executeSandbox(program("function relayWindow() { const a = []; while (true) a.push(new Array(1e5).fill(1)); }"), [{ stdin: stdin([1], 1), expected: 1 }], { timeMs: 2000, memoryKb: 16384 });
    expect(hungry[0]).toMatchObject({ status: "MEMORY_LIMIT", diagnostic: "Execution exceeded 16384 KB." });
    const deep = await run("function relayWindow() { function g(n) { return n === 0 ? 0 : 1 + g(n - 1); } return g(15000); }", [{ loads: [1], width: 1, expected: 15000 }]);
    expect(deep[0].status).toBe("ACCEPTED");
    expect((await run("function relayWindow() { function f() { return f() + 1; } return f(); }", cases))[0]).toMatchObject({ status: "RUNTIME_ERROR", diagnostic: expect.stringMatching(/stack/i) });
  }, 30_000);
  it("exposes no Node, filesystem or network surface and rejects module loading", async () => {
    const probe = "function relayWindow() { return [typeof globalThis.fetch, typeof globalThis.process, typeof globalThis.Buffer, typeof globalThis.setTimeout, typeof globalThis.XMLHttpRequest, (() => { try { require('child_process'); return 'loaded'; } catch (e) { return 'blocked'; } })(), (() => { try { require('fs').readFileSync('/etc/passwd'); return 'read'; } catch (e) { return 'blocked'; } })()]; }";
    const [outcome] = await run(probe, [{ loads: [1], width: 1, expected: ["undefined", "undefined", "undefined", "undefined", "undefined", "blocked", "blocked"] }]);
    expect(outcome.status).toBe("ACCEPTED");
  }, 20_000);
  it("bounds output size, truncates displayed text and keeps cases isolated from each other", async () => {
    const [flood] = await run(`function relayWindow() { process.stdout.write('x'.repeat(${SANDBOX_LIMITS.outputBytes + 1})); return 1; }`, [{ loads: [1], width: 1, expected: 1 }]);
    expect(flood.status).toBe("RUNTIME_ERROR");
    const [long] = await run("function relayWindow() { return 'y'.repeat(5000); }", [{ loads: [1], width: 1, expected: "y".repeat(5000) }]);
    expect(long.status).toBe("ACCEPTED"); expect(long.stdout).toHaveLength(4000);
    const results = await run("function relayWindow(loads) { globalThis.count = (globalThis.count ?? 0) + 1; return globalThis.count; }", [{ loads: [1], width: 1, expected: 1 }, { loads: [1], width: 1, expected: 1 }]);
    expect(results.map((r) => r.status)).toEqual(["ACCEPTED", "ACCEPTED"]);
    await expect(executeSandbox(program("x"), [], limits)).rejects.toThrow("Unsupported test count");
  }, 20_000);
  it("accepts the audited parcel case without changing the stored problem", async () => {
    const input = { parcels: [-1000000], ranges: Array.from({ length: 10664 }, () => [0, 1]) };
    const expected = Array(10664).fill(-1000000);
    const stdin = makeStdin("parcel-checkpoints", input);
    expect(Buffer.byteLength(stdin)).toBe(63998);
    expect(Buffer.byteLength(JSON.stringify(expected))).toBe(95977);
    const source = makeProgram("parcel-checkpoints", "parcelCheckpoints", "function parcelCheckpoints(parcels, ranges) { const p = [0]; for (const n of parcels) p.push(p.at(-1) + n); return ranges.map(([start,end]) => p[end] - p[start]); }");
    const [result] = await executeSandbox(source, [{ stdin, expected }], limits);
    expect(result.status).toBe("ACCEPTED");
    expect(result.stdout).toHaveLength(4000);
  }, 20_000);
  it("counts UTF-8 bytes across stdout and stderr writes", async () => {
    const count = (SANDBOX_LIMITS.outputBytes - 2) / 2;
    const [exact] = await run(`function relayWindow() { return 'é'.repeat(${count}); }`, [{ loads: [1], width: 1, expected: "é".repeat(count) }]);
    expect(exact.status).toBe("ACCEPTED");
    const [over] = await run(`function relayWindow() { return 'é'.repeat(${count + 1}); }`, [{ loads: [1], width: 1, expected: null }]);
    expect(over).toMatchObject({ status: "RUNTIME_ERROR", diagnostic: "Output exceeds the sandbox limit." });
    const [noisy] = await run(`function relayWindow() { process.stderr.write('é'.repeat(${count + 2})); return 1; }`, [{ loads: [1], width: 1, expected: 1 }]);
    expect(noisy.status).toBe("RUNTIME_ERROR");
    const emojiCount = Math.floor((SANDBOX_LIMITS.outputBytes - 2) / 4);
    const expected = "😀".repeat(emojiCount) + "aa";
    const [complete] = await run(`function relayWindow() { return '😀'.repeat(${emojiCount}) + 'aa'; }`, [{ loads: [1], width: 1, expected }]);
    expect(complete.status).toBe("ACCEPTED");
    // The bridge replaces isolated surrogate halves before the host sees them;
    // separate writes cannot combine them into a four-byte emoji to evade the cap.
    const prefix = SANDBOX_LIMITS.outputBytes - 6;
    const [split] = await executeSandbox(`process.stdout.write('"' + 'a'.repeat(${prefix})); process.stdout.write(String.fromCharCode(0xd83d)); process.stdout.write(String.fromCharCode(0xde00)); process.stdout.write('"');`, [{ stdin: "[]", expected: "a".repeat(prefix) + "😀" }], limits);
    expect(split).toMatchObject({ status: "RUNTIME_ERROR", diagnostic: "Output exceeds the sandbox limit." });
  }, 20_000);
});
it("fails closed when the worker dies, keeping verdicts already produced", async () => {
  vi.useFakeTimers();
  try {
    const pending = executeSandbox(program("function relayWindow() { return 1; }"), [{ stdin: stdin([1], 1), expected: 1 }], limits);
    // Nothing has resolved under fake timers; the guard timeout terminates the worker and marks the case unavailable.
    await vi.advanceTimersByTimeAsync(SANDBOX_LIMITS.totalMs + SANDBOX_LIMITS.workerGraceMs + 1);
    const result = await pending;
    expect(result[0].status).toBe("INTERNAL_ERROR");
  } finally { vi.useRealTimers(); }
}, 20_000);
