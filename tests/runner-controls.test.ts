// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/features/submissions/actions", () => ({ executeCode: f.execute }));
import { RunnerControls } from "@/components/editor/runner-controls";
import type { ExecutionState } from "@/features/submissions/contracts";
let host: HTMLDivElement; let root: Root;
const props = { slug: "relay-window", code: "function relayWindow() {}", language: "JAVASCRIPT", enabled: true, signedIn: true, examples: [] };
const response: ExecutionState = { success: true, result: { id: "saved-id", mode: "RUN", status: "WRONG_ANSWER", passedCount: 0, totalCount: 1, runtimeMs: 12, memoryKb: 3000,
  cases: [{ position: 1, status: "WRONG_ANSWER", input: [1], expected: 13, stdout: '<script>alert("output")</script>', diagnostic: "debug", runtimeMs: 12, memoryKb: 3000 }] } };
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); f.execute.mockReset(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
async function render(extra = {}) { await act(() => root.render(createElement(RunnerControls, { ...props, ...extra }))); }
function button(text: string) { return [...host.querySelectorAll("button")].find((b) => b.textContent === text)!; }
it("gates guests, disabled providers, unsupported languages and oversized code", async () => {
  for (const extra of [{ signedIn: false }, { enabled: false }, { language: "PYTHON" }, { code: "" }, { code: "x".repeat(20001) }]) {
    await render(extra); expect(button("Run visible tests").disabled).toBe(true); expect(button("Submit solution").disabled).toBe(true);
  }
  expect(f.execute).not.toHaveBeenCalled();
});
it("captures the draft, blocks duplicate clicks and warns about edits during execution", async () => {
  let finish!: (value: ExecutionState) => void;
  f.execute.mockReturnValue(new Promise<ExecutionState>((resolve) => { finish = resolve; }));
  await render(); await act(() => { button("Run visible tests").click(); button("Run visible tests").click(); });
  expect(f.execute).toHaveBeenCalledOnce(); expect(f.execute).toHaveBeenCalledWith({ slug: props.slug, code: props.code, language: props.language, mode: "RUN" });
  expect(button("Submit solution").disabled).toBe(true);
  await render({ code: "changed draft" }); await act(async () => { finish(response); });
  expect(host.textContent).toContain("earlier draft or language"); expect(host.textContent).toContain("Execution result saved");
  expect(host.textContent).toContain("12 ms (slowest test)"); expect(host.querySelector("script")).toBeNull();
});
it("shows full-suite summaries and keeps errors distinct from saved results", async () => {
  f.execute.mockResolvedValue({ ...response, result: { ...response.result, mode: "SUBMIT", cases: [] } });
  await render(); await act(async () => { button("Submit solution").click(); });
  expect(host.textContent).toContain("hidden details are withheld"); expect(host.textContent).not.toContain("Actual output");
  f.execute.mockRejectedValue(new Error("network")); await act(async () => { button("Run visible tests").click(); });
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("may have been saved");
  expect(host.textContent).not.toContain("Execution result saved"); expect(button("Run visible tests").disabled).toBe(false);
});
