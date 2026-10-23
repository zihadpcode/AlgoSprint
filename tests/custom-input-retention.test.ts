// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const runner = vi.hoisted(() => ({ browser: vi.fn(), execute: vi.fn() }));
vi.mock("@/features/submissions/actions", () => ({ executeCode: runner.execute }));
vi.mock("@/features/submissions/browser-runner", () => ({ runInBrowser: runner.browser }));
import { RunnerControls } from "@/components/editor/runner-controls";

const javascript = "function relayWindow(loads, width) { return loads.length; }";
const args = '{"loads":[8,9,10],"width":3}';
const props = {
  slug: "relay-window", code: javascript, language: "JAVASCRIPT", enabled: true, signedIn: false,
  serverLanguages: ["JAVASCRIPT", "PYTHON"], signature: { entryPoint: "relayWindow", keys: ["loads", "width"] },
  examples: [{ position: 1, input: { loads: [4, 5], width: 2 }, output: 9, explanation: "Example" }],
};
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  runner.browser.mockReset(); runner.execute.mockReset();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
async function render(language = "JAVASCRIPT") {
  await act(() => root.render(createElement(RunnerControls, { ...props, language, code: language === "JAVASCRIPT" ? javascript : "def relayWindow(loads, width): return len(loads)" })));
}
const tabs = () => [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const tab = (label: string) => tabs().find((button) => button.textContent === label)!;
const field = () => host.querySelector<HTMLTextAreaElement>('textarea[data-shortcut-scope="custom"]')!;
const panel = () => field().closest<HTMLElement>('[role="tabpanel"]')!;
const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find((entry) => entry.textContent === label)!;
async function edit(text: string) {
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field(), text);
    field().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("retains custom JSON and returned output across a JavaScript/Python round trip without executing Python", async () => {
  runner.browser.mockResolvedValue({ cases: [{ position: 0, status: "WRONG_ANSWER", input: {}, expected: null, stdout: "3", diagnostic: "kept console", runtimeMs: 2, memoryKb: null }] });
  await render(); await act(() => tab("Custom input").click()); await edit(args);
  await act(async () => button("Run with custom input").click());
  const originalField = field();
  expect(panel().hidden).toBe(false); expect(panel().textContent).toContain("kept console");

  await render("PYTHON");
  expect(field()).toBe(originalField); expect(field().value).toBe(args); expect(panel().hidden).toBe(true);
  expect(tabs().map((entry) => entry.textContent)).toEqual(["Test cases", "Result"]);
  expect(button("Run with custom input").disabled).toBe(true);
  await act(() => button("Run with custom input").click());
  expect(runner.browser).toHaveBeenCalledOnce(); expect(runner.execute).not.toHaveBeenCalled();

  await render();
  expect(field()).toBe(originalField); expect(field().value).toBe(args); expect(panel().hidden).toBe(false);
  expect(tab("Custom input").getAttribute("aria-selected")).toBe("true");
  expect(panel().textContent).toContain("kept console"); expect(button("Run with custom input").disabled).toBe(false);
  expect(runner.browser).toHaveBeenCalledOnce();
});

it("preserves a collapsed drawer and skips the unavailable custom tab during keyboard navigation", async () => {
  await render(); await act(() => tab("Custom input").click()); await edit(args);
  await act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Collapse results panel"]')!.click());
  await render("PYTHON"); await render();
  expect(field().value).toBe(args); expect(panel().hidden).toBe(true);
  expect(host.querySelector('button[aria-label="Expand results panel"]')).not.toBeNull();
  await render("PYTHON");
  await act(() => tab("Test cases").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
  expect(document.activeElement).toBe(tab("Result")); expect(tab("Result").getAttribute("aria-selected")).toBe("true");
  expect(host.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])')?.textContent).toContain("No output yet");
  await act(() => tab("Result").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
  expect(document.activeElement).toBe(tab("Test cases"));
  expect(host.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])')?.textContent).toContain("Case 1");
  expect(panel().hidden).toBe(true); expect(runner.browser).not.toHaveBeenCalled();
});
