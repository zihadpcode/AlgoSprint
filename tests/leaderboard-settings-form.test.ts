// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/leaderboard/actions", () => ({
  saveLeaderboardSettings: vi.fn(async () => ({ success: true, message: "ok" })),
}));
import { LeaderboardSettingsForm } from "@/components/leaderboard/settings-form";

let host: HTMLDivElement; let root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); });

const form = () => host.querySelector("form")!;
const toggle = () => host.querySelector<HTMLInputElement>('input[name="optIn"]')!;
const nameInput = () => host.querySelector<HTMLInputElement>('input[name="displayName"]')!;
const saved = () => new FormData(form()).get("optIn");
// React 19 resets the form itself once the action settles, and happy-dom reproduces that, so no manual reset is needed.
const save = async () => {
  await act(async () => { form().requestSubmit(); });
  await act(async () => { await Promise.resolve(); });
};

it("keeps the switch, the name field and the submitted value in step after saving and flipping again", async () => {
  await act(() => root.render(createElement(LeaderboardSettingsForm, { optedIn: true, initialName: "Ada" })));
  expect(toggle().checked).toBe(true);
  expect(nameInput().disabled).toBe(false);

  // Turn it off and save: the reset must not bring the switch back on.
  await act(() => { toggle().click(); });
  expect(toggle().checked).toBe(false);
  expect(nameInput().disabled).toBe(true);
  await save();
  expect(toggle().checked).toBe(false);
  expect(nameInput().disabled).toBe(true);
  expect(saved()).toBeNull();

  // Turn it back on and save: the visible switch is what gets submitted.
  await act(() => { toggle().click(); });
  expect(toggle().checked).toBe(true);
  expect(nameInput().disabled).toBe(false);
  await save();
  expect(toggle().checked).toBe(true);
  expect(nameInput().disabled).toBe(false);
  expect(saved()).toBe("on");
});
