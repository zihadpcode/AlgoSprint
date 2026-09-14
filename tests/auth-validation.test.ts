import { describe, expect, it, vi, afterEach } from "vitest";
import { loginSchema, registerSchema, safeReturnTo } from "@/features/auth/validation";
vi.mock("server-only", () => ({}));
import { accountsConfigured, getAppOrigin, getSupabaseConfig } from "@/lib/supabase/config";
afterEach(() => vi.unstubAllEnvs());

describe("authentication input and configuration boundaries", () => {
  it("preserves password whitespace and permits existing shorter passwords at login", () => {
    expect(loginSchema.parse({ email: " a@example.com ", password: " secret " })).toEqual({ email: "a@example.com", password: " secret " });
    expect(registerSchema.safeParse({ email: "a@example.com", password: "short", displayName: "Ada" }).success).toBe(false);
    expect(registerSchema.parse({ email: "a@example.com", password: " a long password ", displayName: " Ada " }).password).toBe(" a long password ");
  });
  it("rejects malformed emails, oversized input, and control characters in names", () => {
    expect(loginSchema.safeParse({ email: "broken", password: "pass" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@example.com", password: "x".repeat(129) }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@example.com", password: "long password", displayName: "Ada\nAdmin" }).success).toBe(false);
  });
  it("allows local app destinations and rejects external, encoded, and traversal redirects", () => {
    for (const value of ["https://evil.test", "//evil.test", "/\\evil.test", "/%2f%2fevil.test", "/admin/../auth/callback", "/login", "/dashboard\nLocation: evil", ["/profile"], null]) expect(safeReturnTo(value)).toBe("/dashboard");
    expect(safeReturnTo("/profile")).toBe("/profile");
    expect(safeReturnTo("/problems/relay-window?from=library")).toBe("/problems/relay-window?from=library");
  });
  it("does not use the request host for redirects or accept secret Supabase keys", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("APP_URL", "https://learn.example.com");
    expect(getAppOrigin()).toBe("https://learn.example.com");
    vi.stubEnv("APP_URL", "https://user:pass@example.com"); expect(() => getAppOrigin()).toThrow();
    vi.stubEnv("APP_URL", "http://example.com"); expect(() => getAppOrigin()).toThrow();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_secret_not_a_publishable_key"); expect(getSupabaseConfig()).toBeNull();
    expect(accountsConfigured()).toBe(false);
  });
});
