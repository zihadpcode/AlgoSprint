// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/features/problems/detail-actions", () => ({ updateProblem: vi.fn() }));
import { ProgressControls } from "@/components/problems/personal-controls";
import type { ProgressView } from "@/features/progress/presentation";
let host: HTMLDivElement; let root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
const buttons = async (progress: Partial<ProgressView>) => {
  await act(() => root.render(createElement(ProgressControls, { slug: "relay-window", progress: { status: "NOT_STARTED", selfMarked: false, reviewLater: false, verification: null, ...progress } })));
  return [...host.querySelectorAll<HTMLButtonElement>('button[name="operation"]')].slice(0, 2).map((b) => [b.textContent, b.value, b.disabled]);
};
it("offers an undo for every progress state, naming the state it clears", async () => {
  expect(await buttons({})).toEqual([["Mark attempted", "mark-attempted", false], ["Mark solved", "mark-solved", false]]);
  expect(await buttons({ status: "ATTEMPTED" })).toEqual([["Undo attempted", "clear-attempted", false], ["Mark solved", "mark-solved", false]]);
  expect(await buttons({ status: "SOLVED", selfMarked: true })).toEqual([["Mark attempted", "mark-attempted", true], ["Undo manual solve", "clear-solved", false]]);
  expect(await buttons({ status: "SOLVED", verification: "current" })).toEqual([["Mark attempted", "mark-attempted", true], ["Undo verified solve", "clear-verified", false]]);
  expect(await buttons({ status: "SOLVED" })).toEqual([["Mark attempted", "mark-attempted", true], ["Undo solve", "clear-verified", false]]);
});
