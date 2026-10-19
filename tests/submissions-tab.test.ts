// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { SubmissionsTab } from "@/components/workspace/submissions-list";
import { SUBMISSION_HISTORY_LIMIT } from "@/features/submissions/history-limit";

let host: HTMLDivElement; let root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
const render = (submissions: Parameters<typeof SubmissionsTab>[0]["submissions"]) => act(async () => root.render(createElement(SubmissionsTab, { submissions, loginHref: "/login?next=%2Fproblems%2Frelay-window" })));
const item = (index: number) => ({ id: `id-${index}`, mode: "SUBMIT" as const, language: "JAVASCRIPT", status: "ACCEPTED", passedCount: 6, totalCount: 6, runtimeMs: 12, createdAt: new Date(Date.now() - index * 60_000) });

it("shows a distinct unavailable state, not the guest sign-in prompt, when the history lookup failed", async () => {
  await render("unavailable");
  expect(host.textContent).toContain("History is temporarily unavailable");
  expect(host.textContent).not.toContain("Sign in"); expect(host.querySelector("a")).toBeNull(); expect(host.querySelector("ul")).toBeNull();
});
it("keeps the guest prompt for signed-out viewers and an empty state for viewers without attempts", async () => {
  await render(null); expect(host.textContent).toContain("Sign in to keep a history"); expect(host.querySelector("a")?.getAttribute("href")).toContain("/login");
  await render([]); expect(host.textContent).toContain("No attempts yet"); expect(host.textContent).not.toContain("temporarily unavailable");
});
it("labels the list only when it is capped", async () => {
  await render([item(0), item(1)]); expect(host.textContent).not.toContain("Latest");
  await render(Array.from({ length: SUBMISSION_HISTORY_LIMIT }, (_, i) => item(i)));
  expect(host.textContent).toContain(`Latest ${SUBMISSION_HISTORY_LIMIT} attempts`); expect(host.querySelectorAll("li")).toHaveLength(SUBMISSION_HISTORY_LIMIT);
});
