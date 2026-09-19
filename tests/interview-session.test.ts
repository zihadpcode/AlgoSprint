// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ action: vi.fn(), push: vi.fn() }));
vi.mock("@/features/interviews/actions", () => ({ interviewAction: mocks.action }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
import { InterviewSession } from "@/components/interviews/session";
import { EMPTY_ANSWER, type SessionView } from "@/features/interviews/contracts";
let host: HTMLDivElement, root: Root;
const session: SessionView = { id: "session", status: "IN_PROGRESS", duration: 15, remainingMs: 10000, score: null, questions: [{ id: "question", position: 1, kind: "CODING", prompt: { version: 1, title: "Practice", statement: "Explain it", details: "Examples", revision: 1, slug: "problem" }, answer: { ...EMPTY_ANSWER }, token: "a".repeat(64), score: null, feedback: null }] };
beforeEach(async () => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.resetAllMocks(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); await act(() => root.render(createElement(InterviewSession, { session }))); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
async function edit() { const input = host.querySelector("textarea")!; await act(() => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "My response"); input.dispatchEvent(new Event("input", { bubbles: true })); }); return input; }
const save = () => host.querySelector("fieldset button")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
it("retains a conflicting draft and its original token", async () => {
  const input = await edit(); mocks.action.mockResolvedValue({ success: false, message: "Changed in another tab" });
  await act(async () => { save(); }); expect(input.value).toBe("My response"); expect(host.textContent).toContain("Changed in another tab");
  await act(async () => { save(); }); expect(mocks.action.mock.calls[1][0].token).toBe("a".repeat(64));
});
it("prevents duplicate saves and advances only a confirmed answer token", async () => {
  let resolve!: (result: unknown) => void; mocks.action.mockImplementation(() => new Promise((r) => { resolve = r; }));
  await act(() => { save(); save(); }); expect(mocks.action).toHaveBeenCalledOnce(); expect(host.querySelector("fieldset")!.disabled).toBe(true);
  await act(async () => { resolve({ success: true, message: "Saved", token: "b".repeat(64) }); });
  mocks.action.mockResolvedValue({ success: false, message: "Conflict" }); await act(async () => { save(); }); expect(mocks.action.mock.calls[1][0].token).toBe("b".repeat(64));
});
it("keeps a late draft available to copy instead of navigating away", async () => {
  const input = await edit(); mocks.action.mockResolvedValue({ success: true, ended: true, message: "Time expired" });
  await act(async () => { save(); }); expect(input.value).toBe("My response"); expect(mocks.push).not.toHaveBeenCalled(); expect(host.textContent).toContain("remains here to copy"); expect(host.querySelector("fieldset")!.disabled).toBe(true);
});
