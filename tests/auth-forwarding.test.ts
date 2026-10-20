import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const f = vi.hoisted(() => ({ create: vi.fn(), jar: { getAll: vi.fn(() => []), set: vi.fn() }, headers: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({ createServerClient: f.create }));
vi.mock("next/headers", () => ({ cookies: async () => f.jar, headers: f.headers }));
import { authForwardingOptions } from "@/lib/supabase/auth-forwarding";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createAuthClient } from "@/lib/supabase/server";
import { refreshAuth } from "@/lib/supabase/proxy";
const config = { url: "https://project.supabase.co", key: "sb_publishable_test_key_123456789" };
const secret = "sb_secret_test_credential_123456789";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_AUTH_IP_FORWARDING", "true"); vi.stubEnv("VERCEL", "1");
  vi.stubEnv("SUPABASE_AUTH_FORWARDING_SECRET_KEY", secret);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", config.url); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", config.key);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function options(ip = "203.0.113.4") { return authForwardingOptions(config, new Headers({ "x-vercel-forwarded-for": ip })); }
describe("Auth forwarding boundary", () => {
  it.each(["203.0.113.4", "2001:db8::8"])("forwards a single Vercel IP %s while preserving user authorization", async (ip) => {
    const send = vi.fn<typeof fetch>().mockImplementation(async () => new Response("{}")); vi.stubGlobal("fetch", send);
    const transport = options(ip).global!.fetch;
    for (const path of ["token", "signup", "recover", "resend", "user", "logout"]) {
      await transport(`${config.url}/auth/v1/${path}?grant_type=password`, { headers: { apikey: config.key, Authorization: "Bearer user-jwt" } });
      const request = send.mock.calls.at(-1)![0] as unknown as Request;
      expect(request.headers.get("apikey")).toBe(secret); expect(request.headers.get("sb-forwarded-for")).toBe(ip);
      expect(request.headers.get("authorization")).toBe("Bearer user-jwt"); expect(request.redirect).toBe("error");
    }
  });
  it("replaces only the SDK default bearer, and keeps secrets out of public configuration", async () => {
    const send = vi.fn<typeof fetch>().mockImplementation(async () => new Response("{}")); vi.stubGlobal("fetch", send);
    await options().global!.fetch(`${config.url}/auth/v1/token`, { headers: { apikey: config.key, Authorization: `Bearer ${config.key}` } });
    const request = send.mock.calls[0][0] as unknown as Request;
    expect(request.headers.get("authorization")).toBe(`Bearer ${secret}`);
    expect(getSupabaseConfig()).toEqual(config); expect(JSON.stringify(getSupabaseConfig())).not.toContain(secret);
  });
  it.each(["/rest/v1/User", "/storage/v1/object", "/auth/v1/admin/users", "/auth/v1/token/", "/auth/v1/token/extra", "/auth/v1/verify"])("does not elevate %s", async (path) => {
    const send = vi.fn<typeof fetch>().mockImplementation(async () => new Response("{}")); vi.stubGlobal("fetch", send);
    await options().global!.fetch(`${config.url}${path}`, { headers: { apikey: config.key, Authorization: `Bearer ${config.key}` } });
    const request = send.mock.calls[0][0] as unknown as Request;
    expect(request.headers.get("apikey")).toBe(config.key); expect(request.headers.get("sb-forwarded-for")).toBeNull();
    expect([...request.headers.values()].join()).not.toContain(secret);
  });
  it("does not leak to another origin or forwarded caller headers", async () => {
    const send = vi.fn<typeof fetch>().mockImplementation(async () => new Response("{}")); vi.stubGlobal("fetch", send);
    await options().global!.fetch("https://other.example/auth/v1/token", { headers: { apikey: config.key } });
    expect((send.mock.calls[0][0] as unknown as Request).headers.get("apikey")).toBe(config.key);
    expect(() => authForwardingOptions(config, new Headers({ "x-forwarded-for": "203.0.113.4", "sb-forwarded-for": "203.0.113.4" }))).toThrow("misconfigured");
  });
  it.each(["", "nonsense", "203.0.113.4, 203.0.113.5", "127.0.0.1:80"])("fails closed for invalid IP %s", (ip) => { expect(() => options(ip)).toThrow("misconfigured"); });
  it("fails closed for missing secret, local spoofing, or malformed opt-in", () => {
    vi.stubEnv("SUPABASE_AUTH_FORWARDING_SECRET_KEY", ""); expect(() => options()).toThrow("misconfigured");
    vi.stubEnv("SUPABASE_AUTH_FORWARDING_SECRET_KEY", secret); vi.stubEnv("VERCEL", ""); expect(() => options()).toThrow("misconfigured");
    vi.stubEnv("SUPABASE_AUTH_IP_FORWARDING", "yes"); expect(() => options()).toThrow("misconfigured");
  });
  it("preserves the default path without any secret or trusted headers", async () => {
    vi.stubEnv("SUPABASE_AUTH_IP_FORWARDING", undefined); vi.stubEnv("SUPABASE_AUTH_FORWARDING_SECRET_KEY", undefined);
    expect(authForwardingOptions(config, new Headers())).toEqual({});
    f.create.mockReturnValue({}); await createAuthClient(); expect(f.headers).not.toHaveBeenCalled();
    expect(f.create.mock.calls[0][1]).toBe(config.key); expect(f.create.mock.calls[0][2].global).toBeUndefined();
  });
  it("applies the boundary to the installed SDK without elevating data or admin calls", async () => {
    const send = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ message: "Test rejection", code: "invalid_credentials" }), { status: 400, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", send);
    const { createServerClient } = await vi.importActual<typeof import("@supabase/ssr")>("@supabase/ssr");
    const client = createServerClient(config.url, config.key, { ...options(), cookies: { getAll: () => [], setAll: () => {} } });
    await client.auth.signInWithPassword({ email: "test@example.com", password: "test-password" });
    let request = send.mock.calls.at(-1)![0] as unknown as Request;
    expect(new URL(request.url).pathname).toBe("/auth/v1/token"); expect(request.headers.get("apikey")).toBe(secret);
    expect(request.headers.get("authorization")).toBe(`Bearer ${secret}`);
    await client.auth.getUser("test-user-token");
    request = send.mock.calls.at(-1)![0] as unknown as Request;
    expect(request.headers.get("apikey")).toBe(secret); expect(request.headers.get("authorization")).toBe("Bearer test-user-token");
    await client.from("User").select("id");
    request = send.mock.calls.at(-1)![0] as unknown as Request;
    expect(request.headers.get("apikey")).toBe(config.key); expect(request.headers.get("authorization")).toBe(`Bearer ${config.key}`);
    await client.auth.admin.listUsers();
    request = send.mock.calls.at(-1)![0] as unknown as Request;
    expect(request.headers.get("apikey")).toBe(config.key); expect(request.headers.get("authorization")).toBe(`Bearer ${config.key}`);
  });
  it("wires both factories and preserves cookie persistence", async () => {
    f.headers.mockResolvedValue(new Headers({ "x-vercel-forwarded-for": "203.0.113.4" }));
    f.create.mockImplementation((_url, _key, opts) => ({ auth: { getClaims: async () => { opts.cookies.setAll([{ name: "refresh", value: "new", options: { httpOnly: true } }]); } } }));
    await createAuthClient(true);
    const factory = f.create.mock.calls[0][2]; expect(factory.global.fetch).toBeTypeOf("function");
    factory.cookies.setAll([{ name: "session", value: "new", options: { httpOnly: true } }]); expect(f.jar.set).toHaveBeenCalledWith("session", "new", { httpOnly: true });
    await createAuthClient(false); f.jar.set.mockClear(); f.create.mock.calls[1][2].cookies.setAll([{ name: "session", value: "ignored" }]); expect(f.jar.set).not.toHaveBeenCalled();
    const request = new NextRequest("https://learn.example/profile", { headers: { "x-vercel-forwarded-for": "2001:db8::8" } });
    const response = await refreshAuth(request);
    expect(f.create.mock.calls[2][2].global.fetch).toBeTypeOf("function"); expect(request.cookies.get("refresh")?.value).toBe("new");
    expect(response.cookies.get("refresh")?.httpOnly).toBe(true); expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
