// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/problems" }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("@/components/auth/sign-out-form", () => ({ SignOutForm: () => null }));
import { UserMenu } from "@/components/layout/user-menu";

let host: HTMLDivElement;
let root: Root;
let outside: HTMLInputElement;

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  outside = document.createElement("input");
  document.body.append(host, outside);
  root = createRoot(host);
  await act(() => root.render(createElement(UserMenu, { name: "Practice User" })));
  await act(() => host.querySelector("button")!.click());
});

afterEach(async () => { await act(() => root.unmount()); host.remove(); outside.remove(); });

async function key(target: HTMLElement, value: string) {
  const event = new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true });
  await act(() => target.dispatchEvent(event));
  return event;
}

it("keeps menu arrow navigation local after focus moves to another control", async () => {
  const trigger = host.querySelector("button")!;
  trigger.focus();
  expect((await key(trigger, "ArrowDown")).defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(host.querySelector('[href="/dashboard"]'));
  await key(document.activeElement as HTMLElement, "ArrowDown");
  expect(document.activeElement).toBe(host.querySelector('[href="/progress"]'));

  outside.focus();
  expect((await key(outside, "ArrowDown")).defaultPrevented).toBe(false);
  expect((await key(outside, "ArrowUp")).defaultPrevented).toBe(false);
  expect(document.activeElement).toBe(outside);
});

it("starts at the first or last destination when arrowing from the trigger", async () => {
  const trigger = host.querySelector("button")!;
  trigger.focus();
  await key(trigger, "ArrowDown");
  expect(document.activeElement).toBe(host.querySelector('[href="/dashboard"]'));

  trigger.focus();
  await key(trigger, "ArrowUp");
  expect(document.activeElement).toBe(host.querySelector('[href="/profile"]'));
  await key(document.activeElement as HTMLElement, "ArrowDown");
  expect(document.activeElement).toBe(host.querySelector('[href="/dashboard"]'));
  await key(document.activeElement as HTMLElement, "ArrowUp");
  expect(document.activeElement).toBe(host.querySelector('[href="/profile"]'));
});

it("returns focus on Escape inside the menu without stealing focus from another control", async () => {
  const trigger = host.querySelector("button")!;
  host.querySelector<HTMLElement>('[href="/dashboard"]')!.focus();
  await key(document.activeElement as HTMLElement, "Escape");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger);

  await act(() => trigger.click());
  outside.focus();
  await key(outside, "Escape");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(outside);
});
