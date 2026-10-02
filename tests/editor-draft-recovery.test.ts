// @vitest-environment happy-dom
import { act, createElement, type ChangeEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("next/dynamic", () => ({ default: () => function TestEditor(props: { value: string; onChange: (code: string) => void }) { return createElement("textarea", { "aria-label": "Test code editor", value: props.value, onChange: (event: ChangeEvent<HTMLTextAreaElement>) => props.onChange(event.target.value) }); } }));
vi.mock("@/components/editor/runner-controls", () => ({ RunnerControls: () => createElement("p", null, "Runner waiting for your action") }));
import { CodeEditor } from "@/components/editor/code-editor";
import { draftKey, readDeviceDraft, writeDeviceDraft, type DraftScope } from "@/features/drafts/storage";
const starters = [{ language: "JAVASCRIPT" as const, code: "js starter", entryPoint: "solve" }, { language: "PYTHON" as const, code: "py starter", entryPoint: "solve" }];
const scope: DraftScope = { owner: "verified-user", kind: "code", target: "problem", revision: "2" };
let host: HTMLDivElement, root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); localStorage.clear(); });
async function render(draftOwner: string | null = scope.owner) { await act(async () => root.render(createElement(CodeEditor, { starters, slug: scope.target, revision: 2, draftOwner }))); }
async function click(text: string) { const button = [...host.querySelectorAll("button")].find((entry) => entry.textContent === text)!; await act(() => button.click()); }
it("restores deliberately empty code and drafts for each language without running them", async () => {
  readDeviceDraft(localStorage, scope); writeDeviceDraft(localStorage, scope, JSON.stringify({ JAVASCRIPT: "", PYTHON: "private python draft" }));
  await render(); expect(host.querySelector("textarea")!.value).toBe("js starter");
  await click("Restore device draft"); expect(host.querySelector("textarea")!.value).toBe("");
  const language = host.querySelector("select")!;
  await act(() => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(language, "PYTHON"); language.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(host.querySelector("textarea")!.value).toBe("private python draft"); expect(host.textContent).toContain("Runner waiting for your action");
  const leaving = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(leaving); expect(leaving.defaultPrevented).toBe(true);
});
it("ignores code for languages without a current starter and removes saved recovery after reset", async () => {
  readDeviceDraft(localStorage, scope); writeDeviceDraft(localStorage, scope, JSON.stringify({ JAVASCRIPT: "private code", SQL: "old SQL" }));
  await render(); await click("Restore device draft");
  expect(readDeviceDraft(localStorage, scope).draft?.payload).not.toContain("old SQL");
  await click("Reset to starter");
  const confirm = [...host.querySelectorAll("button")].find((button) => button.textContent === "Replace with starter");
  expect(confirm).toBeDefined(); await act(() => confirm!.click());
  expect(host.querySelector("textarea")!.value).toBe("js starter"); expect(localStorage.getItem(draftKey(scope))).toBeNull();
});
it("offers no device persistence to a guest and clears a former account's code", async () => {
  readDeviceDraft(localStorage, scope); writeDeviceDraft(localStorage, scope, JSON.stringify({ JAVASCRIPT: "private code" }));
  await render(null); expect(host.querySelector("textarea")!.value).toBe("js starter"); expect(host.querySelector('input[type="checkbox"]')).toBeNull(); expect(localStorage.getItem(draftKey(scope))).toBeNull();
});
