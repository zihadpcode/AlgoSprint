// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ execute: vi.fn(), browser: vi.fn() }));
vi.mock("@/features/submissions/actions", () => ({ executeCode: f.execute }));
vi.mock("@/features/submissions/browser-runner", () => ({ runInBrowser: f.browser }));
import { RunnerControls } from "@/components/editor/runner-controls";
import type { ExecutionState } from "@/features/submissions/contracts";
let host: HTMLDivElement; let root: Root;
const example = { position: 1, input: { loads: [4, 5], width: 2 }, output: 9, explanation: "Both loads." };
const props = { slug: "relay-window", code: "function relayWindow() {}", language: "JAVASCRIPT", enabled: true, signedIn: true, examples: [example], signature: { entryPoint: "relayWindow", keys: ["loads", "width"] } };
const response: ExecutionState = { success: true, result: { id: "saved-id", mode: "RUN", status: "WRONG_ANSWER", passedCount: 0, totalCount: 1, runtimeMs: 12, memoryKb: 3000,
  cases: [{ position: 1, status: "WRONG_ANSWER", input: [1], expected: 13, stdout: '<script>alert("output")</script>', diagnostic: "debug", runtimeMs: 12, memoryKb: 3000 }] } };
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); f.execute.mockReset(); f.browser.mockReset(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
async function render(extra = {}) { await act(() => root.render(createElement(RunnerControls, { ...props, ...extra }))); }
function button(text: string) { return [...host.querySelectorAll("button")].find((b) => b.textContent === text)!; }
it("gates submissions for guests and disabled providers, and everything for unsupported languages and oversized code", async () => {
  for (const extra of [{ signedIn: false }, { enabled: false }]) {
    await render(extra); expect(button("Run visible tests").disabled).toBe(false); expect(button("Submit solution").disabled).toBe(true);
  }
  for (const extra of [{ language: "PYTHON" }, { code: "" }, { code: "x".repeat(20001) }, { signature: undefined }, { examples: [] }]) {
    await render(extra); expect(button("Run visible tests").disabled).toBe(true);
  }
  await render({ signature: undefined }); expect(button("Submit solution").disabled).toBe(false);
  expect(f.execute).not.toHaveBeenCalled(); expect(f.browser).not.toHaveBeenCalled();
});
it("runs visible tests in the browser for anyone, in signature order, without calling the server", async () => {
  let finish!: (value: ExecutionState & { success: true }) => void;
  f.browser.mockReturnValue(new Promise((resolve) => { finish = (state) => resolve(state.result); }));
  await render({ signedIn: false, enabled: false }); await act(() => { button("Run visible tests").click(); button("Run visible tests").click(); });
  expect(f.browser).toHaveBeenCalledOnce(); expect(f.execute).not.toHaveBeenCalled();
  expect(f.browser).toHaveBeenCalledWith({ entryPoint: "relayWindow", keys: ["loads", "width"], code: props.code, cases: [{ position: 1, input: example.input, expected: 9 }] });
  expect(host.textContent).toContain("Executing the captured draft");
  await render({ signedIn: false, enabled: false, code: "changed draft" }); await act(async () => { finish({ ...response, result: { ...response.result, id: "", browser: true } }); });
  expect(host.textContent).toContain("earlier draft or language"); expect(host.textContent).toContain("Ran in your browser. Nothing was saved.");
  expect(host.textContent).toContain("Ran in your browser on the public examples"); expect(host.textContent).not.toContain("Saved attempt");
  expect(host.textContent).toContain("12 ms (slowest test)"); expect(host.querySelector("script")).toBeNull();
});
it("submits through the server, blocks duplicate clicks and reports saved results", async () => {
  let finish!: (value: ExecutionState) => void;
  f.execute.mockReturnValue(new Promise<ExecutionState>((resolve) => { finish = resolve; }));
  await render(); await act(() => { button("Submit solution").click(); button("Submit solution").click(); });
  expect(f.execute).toHaveBeenCalledOnce(); expect(f.execute).toHaveBeenCalledWith({ slug: props.slug, code: props.code, language: props.language, mode: "SUBMIT" });
  expect(button("Run visible tests").disabled).toBe(true);
  await act(async () => { finish({ ...response, result: { ...response.result, mode: "SUBMIT", cases: [] } }); });
  expect(host.textContent).toContain("Execution result saved"); expect(host.textContent).toContain("Saved attempt: saved-id");
});
it("explains a browser failure without claiming anything was saved", async () => {
  f.browser.mockRejectedValue(new Error("no workers"));
  await render(); await act(async () => { button("Run visible tests").click(); });
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("The browser could not run this code");
  expect(host.textContent).not.toContain("Execution result saved"); expect(button("Run visible tests").disabled).toBe(false);
});
it("shows full-suite summaries and keeps errors distinct from saved results", async () => {
  f.execute.mockResolvedValue({ ...response, result: { ...response.result, mode: "SUBMIT", cases: [] } });
  await render(); await act(async () => { button("Submit solution").click(); });
  expect(host.textContent).toContain("hidden details are withheld"); expect(host.textContent).not.toContain("Actual output");
  f.execute.mockRejectedValue(new Error("network")); await act(async () => { button("Submit solution").click(); });
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("may have been saved");
  expect(host.textContent).not.toContain("Execution result saved"); expect(button("Submit solution").disabled).toBe(false);
});
