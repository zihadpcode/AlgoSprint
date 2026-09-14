import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const f = vi.hoisted(() => ({ exchange: vi.fn(), configured: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/config", () => ({ accountsConfigured: f.configured, getAppOrigin: () => "https://learn.example.com" }));
vi.mock("@/lib/supabase/server", () => ({ createAuthClient: async () => ({ auth: { exchangeCodeForSession: f.exchange } }) }));
import { GET } from "@/app/auth/callback/route";
beforeEach(() => { vi.clearAllMocks(); f.configured.mockReturnValue(true); });
it("exchanges PKCE codes and redirects only to the configured origin", async () => {
  f.exchange.mockResolvedValue({ error: null });
  const r = await GET(new NextRequest("https://forged-host.test/auth/callback?code=abc&next=%2F%2Fevil.test"));
  expect(f.exchange).toHaveBeenCalledWith("abc"); expect(r.headers.get("location")).toBe("https://learn.example.com/dashboard"); expect(r.headers.get("cache-control")).toContain("no-store"); expect(r.headers.get("referrer-policy")).toBe("no-referrer");
});
it("does not reflect failed tokens or provider error text", async () => {
  f.exchange.mockResolvedValue({ error: { message: "private detail" } });
  const r = await GET(new NextRequest("https://learn.example.com/auth/callback?code=secret-code"));
  expect(r.headers.get("location")).toBe("https://learn.example.com/login?confirmation=failed");
});
it("fails closed when auth is not configured", async () => {
  f.configured.mockReturnValue(false); expect((await GET(new NextRequest("https://learn.example.com/auth/callback?code=x"))).status).toBe(503); expect(f.exchange).not.toHaveBeenCalled();
});
