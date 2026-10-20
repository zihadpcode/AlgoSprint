import { expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/components/layout/app-shell", () => ({ TopBar: () => null }));
import { hasAuthCookie } from "@/components/layout/site-header";

it("recognises a Supabase session cookie, including chunked ones, by name only", () => {
  expect(hasAuthCookie(["sb-wohoooueqlfrszqjuuck-auth-token"])).toBe(true);
  expect(hasAuthCookie(["theme", "sb-127-auth-token.0", "sb-127-auth-token.1"])).toBe(true);
  expect(hasAuthCookie([])).toBe(false);
  // Look-alikes and the PKCE verifier cookie are not a session.
  for (const name of ["sb-abc-auth-token-code-verifier", "auth-token", "sb--auth-token", "xsb-abc-auth-token", "sb-abc-auth-token.x"]) expect(hasAuthCookie([name]), name).toBe(false);
});
