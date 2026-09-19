// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ save: vi.fn(), replace: vi.fn() }));
vi.mock("@/features/admin/actions", () => ({ administer: m.save }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: m.replace }) }));
import { ContentEditor } from "@/components/admin/content-editor";
import { loadProblems } from "../scripts/lib/load-problems";
let host: HTMLDivElement; let root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
async function render(revision = 1) { const p = (await loadProblems())[0]; await act(() => root.render(createElement(ContentEditor, { kind: "problem", initial: p, slug: p.slug, revision }))); }
const submit = () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
it("retains drafts and stale baseline after conflicts or unrelated server refreshes", async () => {
  await render(); const input = [...host.querySelectorAll("input")].find((x) => x.id.endsWith("-title"))!;
  await act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "My unsaved title"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  m.save.mockResolvedValue({ success: false, message: "Stale revision" }); await act(async () => { submit(); });
  expect(input.value).toBe("My unsaved title"); expect(host.textContent).toContain("Stale revision");
  await render(2); await act(async () => { submit(); }); expect(m.save.mock.calls[1][0].revision).toBe(1);
  expect((host.querySelectorAll("fieldset")[host.querySelectorAll("fieldset").length - 1] as HTMLFieldSetElement).disabled).toBe(true);
});
it("blocks duplicate requests while pending and advances revision only after confirmed success", async () => {
  await render(); let resolve!: (value: unknown) => void; m.save.mockImplementation(() => new Promise((r) => { resolve = r; }));
  await act(() => { submit(); submit(); }); expect(m.save).toHaveBeenCalledOnce(); expect(host.querySelector("fieldset")!.disabled).toBe(true);
  await act(async () => { resolve({ success: true, message: "Saved", revision: 2 }); });
  m.save.mockResolvedValue({ success: false, message: "Conflict" }); await act(async () => { submit(); });
  expect(m.save.mock.calls[1][0].revision).toBe(2);
});
it("keeps content on unconfirmed responses without exposing transport details", async () => {
  await render(); m.save.mockRejectedValue(new Error("secret transport")); await act(async () => { submit(); });
  expect(host.textContent).toContain("draft is retained"); expect(host.textContent).not.toContain("secret transport"); expect(host.querySelector("textarea")!.value).not.toBe("");
});
