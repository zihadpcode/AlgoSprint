// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ execute: vi.fn(), browser: vi.fn() }));
vi.mock("@/features/submissions/actions", () => ({ executeCode: f.execute }));
vi.mock("@/features/submissions/browser-runner", () => ({ runInBrowser: f.browser }));
import { RunnerControls } from "@/components/editor/runner-controls";
import { customRunOutcome, defaultCustomInput, parseCustomInput } from "@/components/editor/custom-input";
import { RUNNER_LIMITS } from "@/features/submissions/limits";
import type { CaseResult } from "@/features/submissions/contracts";

const keys = ["loads", "width"];
describe("custom input validation", () => {
  it("accepts a JSON object holding exactly the signature keys", () => {
    expect(parseCustomInput('{"loads":[1,2],"width":2}', keys)).toEqual({ ok: true, input: { loads: [1, 2], width: 2 } });
    expect(parseCustomInput('{"width":null,"loads":[]}', keys).ok).toBe(true);
  });
  it("rejects empty, malformed and non-object JSON with a readable message", () => {
    for (const text of ["", "   ", "{bad", "[1,2]", "null", "7", '"text"']) { const result = parseCustomInput(text, keys); expect(result.ok).toBe(false); }
    expect((parseCustomInput("{bad", keys) as { error: string }).error).toMatch(/^Invalid JSON/);
  });
  it("names missing and unknown parameters", () => {
    expect((parseCustomInput('{"loads":[]}', keys) as { error: string }).error).toContain("Missing parameter: width");
    expect((parseCustomInput('{"loads":[],"width":1,"extra":2}', keys) as { error: string }).error).toContain("Unknown parameter: extra");
  });
  it("enforces the 64,000-byte limit in UTF-8 bytes, not characters", () => {
    const fits = `{"loads":"${"a".repeat(RUNNER_LIMITS.maxInputBytes - 22)}","width":1}`;
    expect(new TextEncoder().encode(fits).byteLength).toBe(RUNNER_LIMITS.maxInputBytes); expect(parseCustomInput(fits, keys).ok).toBe(true);
    expect(parseCustomInput(fits.replace("width", "widths"), keys).ok).toBe(false);
    const wide = `{"loads":"${"é".repeat(RUNNER_LIMITS.maxInputBytes / 2)}","width":1}`;
    expect(wide.length).toBeLessThan(RUNNER_LIMITS.maxInputBytes); const result = parseCustomInput(wide, keys);
    expect(result.ok).toBe(false); expect((result as { error: string }).error).toContain("64,000 bytes");
  });
  it("seeds the editor from the first example in signature order and from null placeholders otherwise", () => {
    expect(JSON.parse(defaultCustomInput(keys, { width: 2, loads: [1], ignored: true }))).toEqual({ loads: [1], width: 2 });
    expect(Object.keys(JSON.parse(defaultCustomInput(keys, { width: 2, loads: [1] })))).toEqual(keys);
    expect(JSON.parse(defaultCustomInput(keys))).toEqual({ loads: null, width: null });
  });
  it("reports a returned value without comparing it and surfaces errors", () => {
    const base: CaseResult = { position: 0, status: "WRONG_ANSWER", input: {}, expected: null, stdout: "[1,2]", diagnostic: "log line", runtimeMs: 3, memoryKb: null };
    expect(customRunOutcome(base)).toEqual({ kind: "returned", value: "[\n  1,\n  2\n]", console: "log line", runtimeMs: 3 });
    expect(customRunOutcome({ ...base, status: "ACCEPTED", stdout: "null" }).kind).toBe("returned");
    expect(customRunOutcome({ ...base, status: "RUNTIME_ERROR", stdout: "", diagnostic: "TypeError: x" })).toEqual({ kind: "error", message: "TypeError: x", console: "" });
    expect(customRunOutcome({ ...base, status: "TIME_LIMIT", diagnostic: "" })).toMatchObject({ kind: "error" });
  });
});

let host: HTMLDivElement; let root: Root;
const example = { position: 1, input: { loads: [4, 5], width: 2 }, output: 9, explanation: "Both loads." };
const props = { slug: "relay-window", code: "function relayWindow(loads, width) { return loads.length; }", language: "JAVASCRIPT", enabled: true, signedIn: true, examples: [example], signature: { entryPoint: "relayWindow", keys } };
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); f.execute.mockReset(); f.browser.mockReset(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
const render = (extra = {}) => act(async () => root.render(createElement(RunnerControls, { ...props, ...extra })));
const panel = () => host.querySelector('[aria-label="Custom input"]');
const runButton = () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Run with custom input")!;
async function setText(text: string) {
  await act(() => { const field = host.querySelector<HTMLTextAreaElement>("textarea")!; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, text); field.dispatchEvent(new Event("input", { bubbles: true })); });
}

describe("custom input panel", () => {
  it("is offered only for JavaScript with a signature", async () => {
    await render(); expect(panel()).not.toBeNull();
    await render({ language: "PYTHON", serverLanguages: ["JAVASCRIPT", "PYTHON"] });
    expect(panel()?.closest<HTMLElement>('[role="tabpanel"]')?.hidden).toBe(true);
    expect(host.querySelector('[role="tab"][id$="-tab-custom"]')).toBeNull();
    await render({ signature: undefined }); expect(panel()).toBeNull();
  });
  it.each(["", " ", "x".repeat(20_001)])("does not run disabled code through the custom shortcut (%#)", async (code) => {
    await render({ code });
    expect(runButton().disabled).toBe(true);
    const event = new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true, cancelable: true });
    await act(() => { host.querySelector("textarea")!.dispatchEvent(event); });
    expect(f.browser).not.toHaveBeenCalled(); expect(f.execute).not.toHaveBeenCalled(); expect(event.defaultPrevented).toBe(false);
  });
  it("leaves submit, Alt, repeating and composing shortcuts alone in custom input", async () => {
    await render();
    for (const extra of [{ shiftKey: true }, { altKey: true }, { repeat: true }, { isComposing: true }]) {
      const event = new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true, cancelable: true, ...extra });
      await act(() => { host.querySelector("textarea")!.dispatchEvent(event); });
      expect(event.defaultPrevented).toBe(false);
    }
    expect(f.browser).not.toHaveBeenCalled(); expect(f.execute).not.toHaveBeenCalled();
  });
  it.each(["ctrlKey", "metaKey"])("runs the custom arguments locally with %s+Enter", async (modifier) => {
    f.browser.mockResolvedValue({ cases: [{ position: 0, status: "WRONG_ANSWER", stdout: "42", diagnostic: "", runtimeMs: 1 }] });
    await render(); await setText('{"loads":[7],"width":1}');
    const event = new KeyboardEvent("keydown", { key: "Enter", [modifier]: true, bubbles: true, cancelable: true });
    await act(async () => { host.querySelector("textarea")!.dispatchEvent(event); });
    expect(f.browser).toHaveBeenCalledExactlyOnceWith({ entryPoint: "relayWindow", keys, code: props.code, cases: [{ position: 0, input: { loads: [7], width: 1 }, expected: null }] });
    expect(event.defaultPrevented).toBe(true); expect(f.execute).not.toHaveBeenCalled();
  });
  it("shows validation errors and never runs invalid input", async () => {
    await render(); await setText("{nope"); await act(() => runButton().click());
    expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/Invalid JSON/); expect(f.browser).not.toHaveBeenCalled();
    await setText(`{"loads":"${"x".repeat(RUNNER_LIMITS.maxInputBytes)}","width":1}`); await act(() => runButton().click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("64,000 bytes"); expect(f.browser).not.toHaveBeenCalled();
  });
  it("runs locally with the signature's keys, shows the returned value and never calls the server", async () => {
    f.browser.mockResolvedValue({ id: "", mode: "RUN", browser: true, status: "WRONG_ANSWER", passedCount: 0, totalCount: 1, runtimeMs: 2, memoryKb: null,
      cases: [{ position: 0, status: "WRONG_ANSWER", input: {}, expected: null, stdout: "42", diagnostic: "hello", runtimeMs: 2, memoryKb: null }] });
    await render(); await setText('{"loads":[7],"width":1}'); await act(async () => { runButton().click(); });
    expect(f.browser).toHaveBeenCalledOnce();
    expect(f.browser).toHaveBeenCalledWith({ entryPoint: "relayWindow", keys, code: props.code, cases: [{ position: 0, input: { loads: [7], width: 1 }, expected: null }] });
    expect(panel()?.textContent).toContain("Returned value"); expect(panel()?.textContent).toContain("42"); expect(panel()?.textContent).toContain("hello");
    expect(panel()?.textContent).not.toMatch(/Wrong answer|Expected output/);
    expect(f.execute).not.toHaveBeenCalled();
  });
  it("shows runtime errors from the user's code", async () => {
    f.browser.mockResolvedValue({ id: "", mode: "RUN", browser: true, status: "RUNTIME_ERROR", passedCount: 0, totalCount: 1, runtimeMs: 1, memoryKb: null,
      cases: [{ position: 0, status: "RUNTIME_ERROR", input: {}, expected: null, stdout: "", diagnostic: "ReferenceError: boom", runtimeMs: 1, memoryKb: null }] });
    await render(); await act(async () => { runButton().click(); });
    expect(panel()?.textContent).toContain("ReferenceError: boom"); expect(f.execute).not.toHaveBeenCalled();
  });
  it("marks output stale when arguments change while the captured run is pending", async () => {
    let finish!: (value: { cases: CaseResult[] }) => void;
    f.browser.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await render(); await setText('{"loads":[7],"width":1}'); await act(() => runButton().click());
    await setText('{"loads":[9],"width":1}');
    await act(async () => finish({ cases: [{ position: 0, status: "WRONG_ANSWER", input: {}, expected: null, stdout: "7", diagnostic: "", runtimeMs: 1, memoryKb: null }] }));
    expect(panel()?.textContent).toContain("earlier code or arguments");
    expect(panel()?.textContent).toContain("Returned value");
    await setText('{"loads":[7],"width":1}');
    expect(panel()?.textContent).not.toContain("earlier code or arguments");
    await render({ code: `${props.code}\n// edited` });
    expect(panel()?.textContent).toContain("earlier code or arguments");
  });
});
