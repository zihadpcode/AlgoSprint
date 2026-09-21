// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/features/submissions/actions", () => ({ executeCode: vi.fn() }));
const control = vi.hoisted(() => ({ fail: false }));
vi.mock("next/dynamic", () => ({ default: () => function FakeSurface({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  if (control.fail) throw new Error("Simulated chunk failure");
  return createElement("textarea", { "aria-label": "Mock editor", value, onChange: (event: { target: { value: string } }) => onChange(event.target.value) });
} }));
import { CodeEditor } from "@/components/editor/code-editor";
import { ExecutionPanels } from "@/components/editor/execution-panels";
import { draftFor, editorLanguages, type EditorStarter } from "@/components/editor/editor-state";

const starters: EditorStarter[] = [
  { language: "JAVASCRIPT", entryPoint: "solve", code: "function solve() {}" },
  { language: "PYTHON", entryPoint: "solve", code: "def solve():\n    pass" },
];
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  control.fail = false;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });
async function render(key = "relay-window", entries = starters) {
  await act(() => root.render(createElement(CodeEditor, { key, starters: entries })));
}
async function choose(language: string) {
  await act(() => { const select = host.querySelector("select")!; select.value = language; select.dispatchEvent(new Event("change", { bubbles: true })); });
}
async function type(code: string) {
  await act(() => {
    const field = host.querySelector("textarea")!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, code);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("loads the supplied starter and exposes only languages supplied by that problem", async () => {
  await render();
  expect(host.querySelector("textarea")?.value).toBe(starters[0].code);
  expect([...host.querySelectorAll("option")].map((option) => option.textContent)).toEqual(["JavaScript", "Python"]);
  expect(host.textContent).toContain("Running code in the browser is not available for this problem");
  expect(host.textContent).toContain("Submitting for a verified result is not available yet");
  expect(Object.keys(editorLanguages)).toHaveLength(6);
});
it("keeps independent drafts, including intentionally empty code, when switching languages", async () => {
  await render(); await type("my JavaScript draft"); await choose("PYTHON");
  expect(host.querySelector("textarea")?.value).toBe(starters[1].code);
  await type(""); await choose("JAVASCRIPT");
  expect(host.querySelector("textarea")?.value).toBe("my JavaScript draft");
  await choose("PYTHON"); expect(host.querySelector("textarea")?.value).toBe("");
  expect(draftFor(starters[1], { PYTHON: "" })).toBe("");
});
it("preserves drafts during a same-problem rerender and resets on a different problem key", async () => {
  await render(); await type("draft survives refresh of personal controls"); await render();
  expect(host.querySelector("textarea")?.value).toBe("draft survives refresh of personal controls");
  await render("another-problem"); expect(host.querySelector("textarea")?.value).toBe(starters[0].code);
});
it("shows an honest empty state when there is no starter", async () => {
  await render("no-starter", []);
  expect(host.textContent).toContain("No starter code is available");
  expect(host.querySelector("select")).toBeNull();
});
it("keeps the current draft copyable when the editor fails", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  await render(); await type("recover this draft"); control.fail = true; await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("editor could not load");
  expect(host.querySelector("code")?.textContent).toBe("solve");
  expect(host.querySelector("pre code")?.textContent).toBe("recover this draft");
});

function button(label: string) { return [...host.querySelectorAll("button")].find((entry) => entry.textContent === label)!; }
async function click(label: string) { await act(() => button(label).click()); }

it("requires confirmation, focuses keeping code, and supports Escape", async () => {
  await render(); expect(button("Reset to starter").disabled).toBe(true);
  await type("keep this draft"); await click("Reset to starter");
  expect(host.querySelector("textarea")?.value).toBe("keep this draft");
  expect(document.activeElement).toBe(button("Keep my code"));
  await act(() => button("Keep my code").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(host.querySelector('[aria-label="Confirm code reset"]')).toBeNull();
  expect(host.querySelector("textarea")?.value).toBe("keep this draft");
  expect(document.activeElement).toBe(host.querySelector("select"));
  await click("Reset to starter"); await click("Keep my code");
  expect(host.querySelector("textarea")?.value).toBe("keep this draft");
});

it("resets only the selected language and announces success", async () => {
  await render(); await type("JavaScript draft"); await choose("PYTHON"); await type("Python draft");
  await click("Reset to starter"); await click("Replace with starter");
  expect(host.querySelector("textarea")?.value).toBe(starters[1].code);
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Python code reset to starter.");
  expect(document.activeElement).toBe(host.querySelector("select"));
  expect(button("Reset to starter").disabled).toBe(true);
  await choose("JAVASCRIPT"); expect(host.querySelector("textarea")?.value).toBe("JavaScript draft");
  expect(host.querySelector('[role="status"]')?.textContent).toBe("");
});

it("restores an intentionally empty draft only after confirmation", async () => {
  await render(); await type(""); expect(host.querySelector("textarea")?.value).toBe("");
  expect(button("Reset to starter").disabled).toBe(false);
  await click("Reset to starter"); await click("Replace with starter");
  expect(host.querySelector("textarea")?.value).toBe(starters[0].code);
});

it("cancels stale reset prompts when the language or draft changes", async () => {
  await render(); await type("js draft"); await click("Reset to starter"); await choose("PYTHON");
  expect(host.querySelector('[aria-label="Confirm code reset"]')).toBeNull();
  await choose("JAVASCRIPT"); await click("Reset to starter"); await type("newer draft");
  expect(host.querySelector('[aria-label="Confirm code reset"]')).toBeNull();
  expect(host.querySelector("textarea")?.value).toBe("newer draft");
});

it("separates public expectations from unrun output and escapes example content", async () => {
  const payload = '<img src=x onerror="alert(1)">';
  await act(() => root.render(createElement(ExecutionPanels, { examples: [{ position: 1, input: { text: payload }, output: 7, explanation: "Public explanation" }] })));
  expect(host.querySelector('[aria-label="Output"]')?.textContent).toContain("No output yet");
  expect(host.querySelector('[aria-label="Output"]')?.textContent).toContain("Not measured");
  expect(host.querySelector("summary")?.textContent).toBe("Example 1 · Not run");
  expect(host.querySelector("details")?.open).toBe(false);
  expect(host.textContent).toContain("Actual output: Not run");
  expect(host.querySelectorAll("pre code")[1].textContent).toBe("7");
  expect(host.querySelector("img")).toBeNull();
  expect(host.querySelector("pre code")?.textContent).toContain("<img");
  expect(host.textContent).not.toMatch(/Accepted|Passed|0 ms/);
});

it("keeps both panels honest when public examples and starters are missing", async () => {
  await render("empty", []);
  expect(host.querySelector('[aria-label="Output"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Test results"]')?.textContent).toContain("No public examples are available");
  expect(host.querySelector("summary")).toBeNull();
});
