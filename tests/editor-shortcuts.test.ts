// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ execute: vi.fn(), browser: vi.fn() }));
vi.mock("@/features/submissions/actions", () => ({ executeCode: f.execute }));
vi.mock("@/features/submissions/browser-runner", () => ({ runInBrowser: f.browser }));
import { RunnerControls } from "@/components/editor/runner-controls";
import { resolveShortcut, shortcutFor, shortcutIgnoresTarget } from "@/components/editor/shortcuts";

const key = (extra: Partial<KeyboardEventInit> = {}) => ({ key: "Enter", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra });
describe("shortcut resolution", () => {
  it("maps Ctrl/Cmd+Enter to run and adding Shift to submit", () => {
    expect(shortcutFor(key({ ctrlKey: true }))).toBe("run"); expect(shortcutFor(key({ metaKey: true }))).toBe("run");
    expect(shortcutFor(key({ ctrlKey: true, shiftKey: true }))).toBe("submit"); expect(shortcutFor(key({ metaKey: true, shiftKey: true }))).toBe("submit");
  });
  it("ignores plain Enter, other keys, Alt combinations, key repeat and IME composition", () => {
    expect(shortcutFor(key())).toBeNull(); expect(shortcutFor(key({ shiftKey: true }))).toBeNull();
    expect(shortcutFor({ ...key({ ctrlKey: true }), key: "r" })).toBeNull(); expect(shortcutFor(key({ ctrlKey: true, altKey: true }))).toBeNull();
    expect(shortcutFor({ ...key({ ctrlKey: true }), repeat: true })).toBeNull(); expect(shortcutFor({ ...key({ ctrlKey: true }), isComposing: true })).toBeNull();
  });
  it("respects disabled actions", () => {
    expect(resolveShortcut(key({ ctrlKey: true }), { run: false, submit: true })).toBeNull();
    expect(resolveShortcut(key({ ctrlKey: true, shiftKey: true }), { run: true, submit: false })).toBeNull();
    expect(resolveShortcut(key({ ctrlKey: true }), { run: true, submit: false })).toBe("run");
    expect(resolveShortcut(key({ ctrlKey: true, shiftKey: true }), { run: false, submit: true })).toBe("submit");
  });
  it("leaves editable fields outside the editor panel and the custom-input box alone", () => {
    document.body.innerHTML = `<textarea id="notes"></textarea><div data-editor-panel><textarea id="monaco"></textarea><div data-shortcut-scope="custom"><textarea id="custom"></textarea></div></div>`;
    const el = (id: string) => document.getElementById(id);
    expect(shortcutIgnoresTarget(el("notes"))).toBe(true); expect(shortcutIgnoresTarget(el("monaco"))).toBe(false);
    expect(shortcutIgnoresTarget(el("custom"))).toBe(true); expect(shortcutIgnoresTarget(document.body)).toBe(false); document.body.innerHTML = "";
  });
});

let host: HTMLDivElement; let root: Root;
const example = { position: 1, input: { loads: [4, 5], width: 2 }, output: 9, explanation: "Both loads." };
const props = { slug: "relay-window", code: "function relayWindow() {}", language: "JAVASCRIPT", enabled: true, signedIn: true, examples: [example], signature: { entryPoint: "relayWindow", keys: ["loads", "width"] } };
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); f.execute.mockReset(); f.browser.mockReset();
  f.browser.mockResolvedValue({ id: "", mode: "RUN", browser: true, status: "ACCEPTED", passedCount: 1, totalCount: 1, runtimeMs: 1, memoryKb: null, cases: [] });
  f.execute.mockResolvedValue({ success: false, message: "stub" });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
const render = (extra = {}) => act(async () => root.render(createElement(RunnerControls, { ...props, ...extra })));
const press = (init: Partial<KeyboardEventInit>, target: Element = document.body) => act(async () => { target.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...init })); });

describe("keyboard shortcuts in the runner", () => {
  it("runs on Ctrl+Enter and Cmd+Enter, and submits on Ctrl/Cmd+Shift+Enter", async () => {
    await render();
    await press({ ctrlKey: true }); expect(f.browser).toHaveBeenCalledTimes(1); expect(f.execute).not.toHaveBeenCalled();
    await press({ metaKey: true }); expect(f.browser).toHaveBeenCalledTimes(2);
    await press({ ctrlKey: true, shiftKey: true }); expect(f.execute).toHaveBeenLastCalledWith({ slug: "relay-window", code: props.code, language: "JAVASCRIPT", mode: "SUBMIT" });
    await press({ metaKey: true, shiftKey: true }); expect(f.execute).toHaveBeenCalledTimes(2);
  });
  it("is not swallowed by an editor-like field inside the editor panel and stops the event from reaching it", async () => {
    const panel = document.createElement("div"); panel.setAttribute("data-editor-panel", ""); const area = document.createElement("textarea"); panel.append(area); document.body.append(panel);
    const seen = vi.fn(); area.addEventListener("keydown", seen);
    await render(); await press({ ctrlKey: true }, area);
    expect(f.browser).toHaveBeenCalledTimes(1); expect(seen).not.toHaveBeenCalled(); panel.remove();
  });
  it("does nothing when the action is disabled and lets the key through", async () => {
    await render({ signedIn: false });
    const event = new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true });
    await act(async () => { document.body.dispatchEvent(event); });
    expect(f.execute).not.toHaveBeenCalled(); expect(event.defaultPrevented).toBe(false);
    await render({ code: "" }); await press({ ctrlKey: true }); expect(f.browser).not.toHaveBeenCalled();
    await render({ language: "PYTHON" }); await press({ ctrlKey: true }); expect(f.browser).not.toHaveBeenCalled(); expect(f.execute).not.toHaveBeenCalled();
  });
  it("does not run from a notes-style textarea outside the editor", async () => {
    const notes = document.createElement("textarea"); document.body.append(notes);
    await render(); await press({ ctrlKey: true }, notes); expect(f.browser).not.toHaveBeenCalled(); notes.remove();
  });
  it("removes its listener on unmount", async () => {
    await render(); await act(() => root.render(null)); await press({ ctrlKey: true }); expect(f.browser).not.toHaveBeenCalled();
    root = createRoot(host);
  });
});
