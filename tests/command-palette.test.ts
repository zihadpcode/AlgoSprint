// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
import { CommandPalette, openCommandPalette } from "@/components/layout/command-palette";

let host: HTMLDivElement;
let root: Root;
const fetchOriginal = globalThis.fetch;

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  router.push.mockReset();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [{ slug: "alpha-problem", title: "Alpha Problem", difficulty: "EASY", pattern: "linear-scan" }] }) });
  await act(() => root.render(createElement(CommandPalette)));
  await act(() => openCommandPalette());
});

afterEach(async () => { await act(() => root.unmount()); host.remove(); globalThis.fetch = fetchOriginal; });

async function typeQuery(value: string) {
  const input = host.querySelector<HTMLInputElement>('input[role="combobox"]')!;
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return input;
}

it("cannot open a previous query's problem while the next search is debouncing", async () => {
  await typeQuery("Alpha");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 160)); });
  expect(host.textContent).toContain("Alpha Problem");

  const input = await typeQuery("Beta");
  expect(host.textContent).not.toContain("Alpha Problem");
  await act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
  expect(router.push).not.toHaveBeenCalledWith("/problems/alpha-problem");
  expect(router.push).toHaveBeenCalledWith("/problems?q=Beta");
});
