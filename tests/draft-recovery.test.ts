// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DeviceDraftRecovery } from "@/components/drafts/device-draft-recovery";
import { DRAFT_CLEAR_KEY, DRAFT_OWNER_KEY, clearBrowserDrafts, draftKey, readDeviceDraft, writeDeviceDraft, type DraftScope } from "@/features/drafts/storage";
const scope: DraftScope = { owner: "verified-user", kind: "code", target: "problem", revision: "2" };
const value = JSON.stringify({ JAVASCRIPT: "new local work" });
const older = JSON.stringify({ JAVASCRIPT: "recovered work" });
let host: HTMLDivElement, root: Root;
const restore = vi.fn(), clear = vi.fn();
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); localStorage.clear(); restore.mockReset(); clear.mockReset(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); localStorage.clear(); });
async function render(props: Partial<Parameters<typeof DeviceDraftRecovery>[0]> = {}) { await act(async () => root.render(createElement(DeviceDraftRecovery, { scope, value, dirty: true, onRestore: restore, onClear: clear, ...props }))); }
async function click(text: string) { const button = [...host.querySelectorAll("button")].find((entry) => entry.textContent === text)!; await act(() => button.click()); }
async function enable() { await act(() => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()); }
function seed(revision = scope.revision, baseline = "") { readDeviceDraft(localStorage, scope); writeDeviceDraft(localStorage, { ...scope, revision }, older, baseline); }
it("does not persist private code until the user explicitly enables device recovery", async () => {
  await render(); expect(localStorage.getItem(draftKey(scope))).toBeNull();
  await enable(); expect(readDeviceDraft(localStorage, scope).draft?.payload).toBe(value);
  await render({ value: JSON.stringify({ JAVASCRIPT: "edited" }) }); expect(readDeviceDraft(localStorage, scope).draft?.payload).toContain("edited");
  await enable(); expect(localStorage.getItem(draftKey(scope))).toBeNull();
});
it("offers explicit recovery without silently applying or overwriting a saved local draft", async () => {
  seed(); await render(); expect(restore).not.toHaveBeenCalled(); expect(readDeviceDraft(localStorage, scope).draft?.payload).toBe(older);
  await enable(); expect(readDeviceDraft(localStorage, scope).draft?.payload).toBe(older);
  await click("Restore device draft"); expect(restore).toHaveBeenCalledWith(older); expect(host.textContent).toContain("Review it before running code or saving an answer");
});
it("requires fresh consent after changing draft target or revision", async () => {
  await render(); await enable();
  const next = { ...scope, target: "another-problem" };
  await render({ scope: next });
  expect(host.querySelector<HTMLInputElement>("input")!.checked).toBe(false);
  expect(localStorage.getItem(draftKey(next))).toBeNull();
  await enable();
  await render({ scope: { ...next, revision: "3" } });
  expect(host.querySelector<HTMLInputElement>("input")!.checked).toBe(false);
  expect(readDeviceDraft(localStorage, { ...next, revision: "3" }).draft?.revision).toBe("2");
});
it("never carries another scope's recovery prompt or consent to a new owner", async () => {
  seed(); await render(); await enable();
  expect(host.textContent).toContain("An unsaved device draft is available");
  const next = { ...scope, owner: "another-user" };
  await render({ scope: next });
  expect(host.textContent).not.toContain("An unsaved device draft is available");
  expect(host.querySelector<HTMLInputElement>("input")!.checked).toBe(false);
  expect(localStorage.getItem(draftKey(next))).toBeNull();
  expect(restore).not.toHaveBeenCalled();
});
it("revised drafts are copy-only and cannot replace current text", async () => {
  seed("1"); await render(); expect(host.textContent).toContain("older problem revision or saved answer");
  expect(host.querySelector("textarea")!.value).toContain("recovered work"); expect(host.querySelector("textarea")!.readOnly).toBe(true);
  expect([...host.querySelectorAll("button")].some((entry) => entry.textContent === "Restore device draft")).toBe(false); expect(restore).not.toHaveBeenCalled();
  await click("Discard device draft"); expect(localStorage.getItem(draftKey(scope))).toBeNull();
});
it("changed server concurrency tokens make a same-revision draft copy-only", async () => {
  seed("2", "original-token"); await render({ baseline: "latest-token" }); expect(host.querySelector("textarea")!.value).toContain("recovered work"); expect(restore).not.toHaveBeenCalled();
  expect([...host.querySelectorAll("button")].some((entry) => entry.textContent === "Restore device draft")).toBe(false);
});
it("confirmed clean state removes the device copy without any server save", async () => {
  await render(); await enable(); expect(localStorage.getItem(draftKey(scope))).not.toBeNull();
  await render({ dirty: false }); expect(localStorage.getItem(draftKey(scope))).toBeNull(); expect(restore).not.toHaveBeenCalled();
});
it("guest pages never expose or retain a previous account's saved draft", async () => {
  seed(); await render({ scope: null }); expect(host.textContent).toContain("Guest drafts stay on this page"); expect(host.querySelector("input")).toBeNull(); expect(localStorage.getItem(draftKey(scope))).toBeNull(); expect(restore).not.toHaveBeenCalled();
});
it("logout clears device data, clears current private text and disables future writes", async () => {
  await render(); await enable(); await act(() => clearBrowserDrafts());
  expect(clear).toHaveBeenCalledOnce(); expect(localStorage.getItem(draftKey(scope))).toBeNull(); expect(host.querySelector<HTMLInputElement>("input")!.checked).toBe(false);
  await render({ value: JSON.stringify({ JAVASCRIPT: "after logout" }) }); expect(localStorage.getItem(draftKey(scope))).toBeNull();
});
it("another tab signing out or switching account disables recovery and clears current private text", async () => {
  await render(); await enable();
  await act(() => window.dispatchEvent(new StorageEvent("storage", { key: DRAFT_CLEAR_KEY, newValue: "logout" })));
  expect(clear).toHaveBeenCalledOnce(); expect(host.querySelector<HTMLInputElement>("input")!.checked).toBe(false);
  await enable(); await act(() => window.dispatchEvent(new StorageEvent("storage", { key: DRAFT_OWNER_KEY, newValue: "another-user" })));
  expect(clear).toHaveBeenCalledTimes(2); expect(host.querySelector<HTMLInputElement>("input")!.checked).toBe(false);
});
it("storage failures leave editing usable with a clear copy-your-work message", async () => {
  const access = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  await render(); expect(host.textContent).toContain("Device storage is unavailable"); expect(host.querySelector<HTMLInputElement>("input")!.disabled).toBe(true);
  access.mockRestore();
});
it("ended interviews offer copy-only local text and discard without saving or scoring", async () => {
  seed(); await render({ copyOnly: true, disabled: true }); expect(host.textContent).toContain("This interview has ended"); expect(host.querySelector("textarea")!.value).toContain("recovered work"); expect(restore).not.toHaveBeenCalled();
  expect([...host.querySelectorAll("button")].some((entry) => entry.textContent === "Restore device draft")).toBe(false); await click("Discard device draft"); expect(localStorage.getItem(draftKey(scope))).toBeNull();
});
