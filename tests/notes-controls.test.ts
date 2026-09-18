// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/features/problems/detail-actions", () => ({ updateProblem: f.update }));
import { ProblemNotes } from "@/components/problems/personal-controls";
let host: HTMLDivElement; let root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); f.update.mockReset(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
const render = (note = "saved") => act(() => root.render(createElement(ProblemNotes, { slug: "relay-window", note })));
const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label)!;
it("retains this tab's saved baseline and draft when unrelated props refresh", async () => {
  await render("initial"); await render("another tab's edit");
  expect(host.querySelector("textarea")?.value).toBe("initial");
  expect((host.querySelector('[name="expectedContent"]') as HTMLInputElement).value).toBe("initial");
});
it("deletes the saved note and resets the draft only after confirmed success", async () => {
  f.update.mockResolvedValue({ success: true, savedContent: "", message: "Note deleted." });
  await render(); await act(async () => { button("Delete saved note").click(); });
  expect(f.update).toHaveBeenCalledOnce(); expect(f.update.mock.calls[0][1].get("operation")).toBe("delete-note");
  expect(f.update.mock.calls[0][1].get("expectedContent")).toBe("saved");
  expect(host.querySelector("textarea")?.value).toBe(""); expect(button("Delete saved note").disabled).toBe(true);
});
it("keeps the draft and baseline on a failed deletion or unconfirmed network response", async () => {
  await render(); f.update.mockResolvedValue({ success: false, message: "Conflict" });
  await act(async () => { button("Delete saved note").click(); });
  expect(host.querySelector("textarea")?.value).toBe("saved");
  f.update.mockRejectedValue(new Error("private network details"));
  await act(async () => { button("Delete saved note").click(); });
  expect(host.textContent).toContain("Could not confirm"); expect(host.textContent).not.toContain("private network details");
  expect(host.querySelector("textarea")?.value).toBe("saved");
  expect((host.querySelector('[name="expectedContent"]') as HTMLInputElement).value).toBe("saved");
});
it("requires saving or discarding a dirty draft before deletion", async () => {
  await render();
  const textarea = host.querySelector("textarea")!;
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "unsaved draft");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(button("Delete saved note").disabled).toBe(true);
  await act(() => { button("Discard unsaved changes").click(); });
  expect(textarea.value).toBe("saved"); expect(button("Delete saved note").disabled).toBe(false);
  expect(f.update).not.toHaveBeenCalled();
});
