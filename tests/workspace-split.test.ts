// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SplitPane } from "@/components/workspace/split-pane";
import { SPLIT_DEFAULT, SPLIT_MAX, SPLIT_MIN, SPLIT_STORAGE_KEY, clampRatio, ratioForKey, ratioForPointer, readStoredRatio, writeStoredRatio } from "@/components/workspace/split-ratio";

describe("split ratio helpers", () => {
  it("clamps to the allowed range and falls back for non-numbers", () => {
    expect(clampRatio(5)).toBe(SPLIT_MIN); expect(clampRatio(99)).toBe(SPLIT_MAX); expect(clampRatio(50)).toBe(50);
    expect(clampRatio(Number.NaN)).toBe(SPLIT_DEFAULT);
  });
  it("maps keys to ratios, with Shift for larger steps", () => {
    expect(ratioForKey("ArrowRight", 40)).toBe(42); expect(ratioForKey("ArrowLeft", 40)).toBe(38);
    expect(ratioForKey("ArrowRight", 40, true)).toBe(50); expect(ratioForKey("ArrowLeft", 40, true)).toBe(30);
    expect(ratioForKey("Home", 40)).toBe(SPLIT_MIN); expect(ratioForKey("End", 40)).toBe(SPLIT_MAX); expect(ratioForKey("Enter", 60)).toBe(SPLIT_DEFAULT);
    expect(ratioForKey("ArrowLeft", SPLIT_MIN)).toBe(SPLIT_MIN); expect(ratioForKey("a", 40)).toBeNull();
  });
  it("converts pointer positions and survives a zero-width container", () => {
    expect(ratioForPointer(500, 100, 1000)).toBe(40); expect(ratioForPointer(0, 100, 1000)).toBe(SPLIT_MIN); expect(ratioForPointer(5, 0, 0)).toBe(SPLIT_DEFAULT);
  });
  it("reads and writes storage defensively", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
    writeStoredRatio(storage, 55); expect(store.get(SPLIT_STORAGE_KEY)).toBe("55"); expect(readStoredRatio(storage)).toBe(55);
    store.set(SPLIT_STORAGE_KEY, "junk"); expect(readStoredRatio(storage)).toBe(SPLIT_DEFAULT);
    const throwing = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    expect(readStoredRatio(throwing)).toBe(SPLIT_DEFAULT); expect(() => writeStoredRatio(throwing, 50)).not.toThrow(); expect(readStoredRatio(null)).toBe(SPLIT_DEFAULT);
  });
});

let host: HTMLDivElement; let root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); localStorage.clear(); });
const render = async () => { await act(async () => root.render(createElement(SplitPane, { left: createElement("p", null, "left"), right: createElement("p", null, "right") }))); };
const separator = () => host.querySelector<HTMLElement>('[role="separator"]')!;
const press = (key: string, shiftKey = false) => act(() => { separator().dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true })); });

describe("resizable separator", () => {
  it("is an accessible vertical separator that starts at the default or the saved ratio", async () => {
    await render();
    expect(separator().getAttribute("aria-orientation")).toBe("vertical"); expect(separator().tabIndex).toBe(0);
    expect(separator().getAttribute("aria-valuenow")).toBe(String(SPLIT_DEFAULT));
    expect(separator().getAttribute("aria-valuemin")).toBe(String(SPLIT_MIN)); expect(separator().getAttribute("aria-valuemax")).toBe(String(SPLIT_MAX));
    await act(() => root.unmount()); localStorage.setItem(SPLIT_STORAGE_KEY, "60");
    root = createRoot(host); await render(); expect(separator().getAttribute("aria-valuenow")).toBe("60");
  });
  it("adjusts with arrow keys, Home and End, persists the ratio and resets on double click", async () => {
    await render();
    await press("ArrowRight"); expect(separator().getAttribute("aria-valuenow")).toBe(String(SPLIT_DEFAULT + 2)); expect(localStorage.getItem(SPLIT_STORAGE_KEY)).toBe(String(SPLIT_DEFAULT + 2));
    await press("ArrowLeft", true); expect(separator().getAttribute("aria-valuenow")).toBe(String(SPLIT_DEFAULT + 2 - 10));
    await press("End"); expect(separator().getAttribute("aria-valuenow")).toBe(String(SPLIT_MAX));
    await press("ArrowRight"); expect(separator().getAttribute("aria-valuenow")).toBe(String(SPLIT_MAX));
    await press("Home"); expect(separator().getAttribute("aria-valuenow")).toBe(String(SPLIT_MIN));
    await act(() => { separator().dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); });
    expect(separator().getAttribute("aria-valuenow")).toBe(String(SPLIT_DEFAULT)); expect(localStorage.getItem(SPLIT_STORAGE_KEY)).toBe(String(SPLIT_DEFAULT));
  });
  it("leaves other keys alone", async () => {
    await render(); const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    await act(() => { separator().dispatchEvent(event); }); expect(event.defaultPrevented).toBe(false);
  });
});
