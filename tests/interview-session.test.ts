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

it("restores a local draft without saving, scoring or changing the original server token", async () => {
  const { interviewDraftSchema, readDeviceDraft, writeDeviceDraft } = await import("@/features/drafts/storage");
  const scope = { owner: "verified-user", kind: "interview" as const, target: session.id, revision: JSON.stringify([[session.questions[0].id, 1]]) };
  const draft = [{ ...EMPTY_ANSWER, reasoning: "Recovered private answer", reasoningRating: null, tradeoffsRating: null, checksRating: null }];
  expect(interviewDraftSchema.safeParse(draft).success).toBe(true);
  localStorage.clear(); readDeviceDraft(localStorage, scope); writeDeviceDraft(localStorage, scope, JSON.stringify(draft), JSON.stringify([session.questions[0].token]));
  await act(() => root.unmount()); root = createRoot(host);
  await act(async () => root.render(createElement(InterviewSession, { session, draftOwner: scope.owner })));
  expect(host.querySelector("textarea")!.value).toBe(""); expect(mocks.action).not.toHaveBeenCalled();
  const restore = [...host.querySelectorAll("button")].find((button) => button.textContent === "Restore device draft")!;
  await act(() => restore.click()); expect(host.querySelector("textarea")!.value).toBe("Recovered private answer"); expect(host.querySelector("select")!.value).toBe(""); expect(mocks.action).not.toHaveBeenCalled();
  await rate("1"); mocks.action.mockResolvedValue({ success: false, message: "Conflict" }); await act(async () => save());
  expect(mocks.action.mock.calls[0][0].token).toBe(session.questions[0].token); localStorage.clear();
});
it("does not allow restoring a local answer over a newer saved server answer", async () => {
  const { readDeviceDraft, writeDeviceDraft } = await import("@/features/drafts/storage");
  const scope = { owner: "verified-user", kind: "interview" as const, target: session.id, revision: JSON.stringify([[session.questions[0].id, 1]]) };
  localStorage.clear(); readDeviceDraft(localStorage, scope); writeDeviceDraft(localStorage, scope, JSON.stringify([{ ...EMPTY_ANSWER, reasoning: "Older local answer" }]), JSON.stringify(["old-token"]));
  await act(() => root.unmount()); root = createRoot(host);
  const latest = { ...session, questions: [{ ...session.questions[0], answer: { ...EMPTY_ANSWER, reasoning: "Latest saved answer", reasoningRating: 1 } }] };
  await act(async () => root.render(createElement(InterviewSession, { session: latest, draftOwner: scope.owner })));
  expect(host.querySelector("textarea")!.readOnly).toBe(true);
  expect(host.querySelector<HTMLTextAreaElement>("fieldset textarea")!.value).toBe("Latest saved answer");
  expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Restore device draft")).toBe(false); expect(mocks.action).not.toHaveBeenCalled(); localStorage.clear();
});
it("clears rendered private answers when another tab signs out", async () => {
  const { clearBrowserDrafts } = await import("@/features/drafts/storage");
  await act(() => root.unmount()); root = createRoot(host);
  const saved = { ...session, questions: [{ ...session.questions[0], answer: { ...EMPTY_ANSWER, reasoning: "Saved private answer", reasoningRating: 1 } }] };
  await act(async () => root.render(createElement(InterviewSession, { session: saved, draftOwner: "verified-user" })));
  await act(() => clearBrowserDrafts()); expect(host.querySelector<HTMLTextAreaElement>("fieldset textarea")!.value).toBe(""); expect(mocks.action).not.toHaveBeenCalled(); localStorage.clear();
});
it("clears unsaved local recovery after explicitly finishing without recreating it", async () => {
  const { draftKey } = await import("@/features/drafts/storage");
  const scope = { owner: "verified-user", kind: "interview" as const, target: session.id, revision: JSON.stringify([[session.questions[0].id, 1]]) };
  localStorage.clear(); await act(() => root.unmount()); root = createRoot(host);
  await act(async () => root.render(createElement(InterviewSession, { session, draftOwner: scope.owner })));
  await act(() => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await edit(); expect(localStorage.getItem(draftKey(scope))).not.toBeNull();
  const originalConfirm = window.confirm; window.confirm = vi.fn(() => true); mocks.action.mockResolvedValue({ success: true, ended: true, message: "Finished" });
  const finish = [...host.querySelectorAll("button")].find((button) => button.textContent === "Finish and review")!;
  await act(async () => finish.click()); expect(mocks.push).toHaveBeenCalledWith(`/interview-results/${session.id}`); expect(localStorage.getItem(draftKey(scope))).toBeNull(); expect(host.querySelector("fieldset")!.disabled).toBe(true);
  window.confirm = originalConfirm; localStorage.clear();
});
