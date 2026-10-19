// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({ logout: vi.fn(), viewer: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/features/auth/actions", () => ({ logout: f.logout, login: vi.fn(), register: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ getViewer: f.viewer }));
vi.mock("@/lib/supabase/config", () => ({ accountsConfigured: () => true }));
import LoginPage from "@/app/login/page";
import { SignOutForm } from "@/components/auth/sign-out-form";
import { DRAFT_CLEAR_KEY, DRAFT_OWNER_KEY, draftKey, readDeviceDraft, writeDeviceDraft, type DraftScope } from "@/features/drafts/storage";

const scope: DraftScope = { owner: "verified-user", kind: "code", target: "problem", revision: "2" };
const payload = JSON.stringify({ JAVASCRIPT: "private unsaved work" });
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); f.viewer.mockResolvedValue(null); localStorage.clear();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); localStorage.clear(); });
function seedDraft() {
  localStorage.setItem(DRAFT_OWNER_KEY, scope.owner);
  expect(writeDeviceDraft(localStorage, scope, payload)).toBe(true);
  expect(localStorage.getItem(draftKey(scope))).not.toBeNull();
}
const hasDraft = () => readDeviceDraft(localStorage, scope).draft !== null;

it("clears this browser's private drafts as the sign-out form is submitted", async () => {
  seedDraft();
  await act(async () => root.render(createElement(SignOutForm)));
  const form = host.querySelector("form")!;
  expect(hasDraft()).toBe(true);
  await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  expect(localStorage.getItem(draftKey(scope))).toBeNull();
  expect(localStorage.getItem(DRAFT_OWNER_KEY)).toBeNull();
  expect(localStorage.getItem(DRAFT_CLEAR_KEY)).not.toBeNull();
});

it("clears private drafts when the login page is shown after signing out, and only then", async () => {
  seedDraft();
  await act(async () => root.render(await LoginPage({ searchParams: Promise.resolve({}) })));
  expect(host.textContent).not.toContain("You have signed out of this browser.");
  expect(localStorage.getItem(draftKey(scope))).not.toBeNull();
  await act(async () => root.render(await LoginPage({ searchParams: Promise.resolve({ signedOut: "0" }) })));
  expect(localStorage.getItem(draftKey(scope))).not.toBeNull();
  await act(async () => root.render(await LoginPage({ searchParams: Promise.resolve({ signedOut: "1" }) })));
  expect(host.textContent).toContain("You have signed out of this browser.");
  expect(localStorage.getItem(draftKey(scope))).toBeNull();
  expect(localStorage.getItem(DRAFT_OWNER_KEY)).toBeNull();
  expect(localStorage.getItem(DRAFT_CLEAR_KEY)).not.toBeNull();
});
