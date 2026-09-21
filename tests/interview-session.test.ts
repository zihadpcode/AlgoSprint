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
async function rate(value: string) {
  const select = host.querySelector("select")!;
  await act(() => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, value); select.dispatchEvent(new Event("change", { bubbles: true })); });
  return select;
}
it("retains a conflicting draft and its original token", async () => {
  const input = await edit(); await rate("1"); mocks.action.mockResolvedValue({ success: false, message: "Changed in another tab" });
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
  const input = await edit(); await rate("1"); mocks.action.mockResolvedValue({ success: true, ended: true, message: "Time expired" });
  await act(async () => { save(); }); expect(input.value).toBe("My response"); expect(mocks.push).not.toHaveBeenCalled(); expect(host.textContent).toContain("remains here to copy"); expect(host.querySelector("fieldset")!.disabled).toBe(true);
});
it("starts every rating unchosen and saves an untouched answer as zeros without marking it dirty", async () => {
  expect([...host.querySelectorAll("select")].every((select) => select.value === "")).toBe(true);
  expect(host.textContent).toContain("No unsaved changes");
  mocks.action.mockResolvedValue({ success: true, message: "Saved", token: "b".repeat(64) });
  await act(async () => { save(); });
  expect(mocks.action.mock.calls[0][0].answer).toEqual(EMPTY_ANSWER);
});
it("refuses to save written text until its area is rated, then sends the chosen rating", async () => {
  await edit();
  await act(async () => { save(); });
  expect(mocks.action).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Choose a self-rating for reasoning and solution / code before saving");
  expect(host.querySelector("select")!.getAttribute("aria-invalid")).toBe("true");
  mocks.action.mockResolvedValue({ success: true, message: "Saved", token: "b".repeat(64) });
  await rate("2");
  await act(async () => { save(); });
  expect(mocks.action).toHaveBeenCalledOnce();
  expect(mocks.action.mock.calls[0][0].answer).toEqual({ ...EMPTY_ANSWER, reasoning: "My response", reasoningRating: 2 });
  expect(host.textContent).toContain("No unsaved changes");
});
it("shows a previously saved rating of zero rather than resetting it", async () => {
  await act(() => root.unmount());
  root = createRoot(host);
  const rated: SessionView = { ...session, questions: [{ ...session.questions[0], answer: { ...EMPTY_ANSWER, tradeoffs: "Some tradeoffs", tradeoffsRating: 0 } }] };
  await act(() => root.render(createElement(InterviewSession, { session: rated })));
  const selects = [...host.querySelectorAll("select")].map((select) => select.value);
  expect(selects).toEqual(["", "0", ""]);
  expect(host.textContent).toContain("No unsaved changes");
});
