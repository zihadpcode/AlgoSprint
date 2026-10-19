import { createHash, webcrypto } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({ cookies: vi.fn(), viewer: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: f.cookies }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/features/auth/session", () => ({ getViewer: f.viewer }));
vi.mock("@/lib/supabase/config", () => ({
  accountsConfigured: () => true,
  getAppOrigin: () => "https://learn.example.com",
  getSupabaseConfig: () => ({ url: "https://roundtrip.supabase.co", key: "sb_publishable_synthetic_roundtrip_test_key" }),
  authCookieOptions: { path: "/", sameSite: "lax", httpOnly: true, secure: true },
}));

import { GET } from "@/app/auth/callback/route";
import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";
import ResetPasswordPage from "@/app/reset-password/page";
import { requestPasswordReset, resendConfirmation, updatePassword } from "@/features/auth/recovery-actions";
import { getRecoveryUser } from "@/features/auth/recovery-session";
import { createAuthClient } from "@/lib/supabase/server";

const user = { id: "20000000-0000-4000-8000-000000000001", email: "ada@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", is_anonymous: false };
const jar = new Map<string, string>();
const codes = new Map<string, { challenge: string; method: string }>();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
let signingKey: webcrypto.CryptoKey;
let jwk: webcrypto.JsonWebKey;

beforeAll(async () => {
  const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  signingKey = pair.privateKey;
  jwk = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
});

async function accessToken(method: string) {
  const now = Math.floor(Date.now() / 1000);
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const input = `${part({ alg: "ES256", kid: "roundtrip-key", typ: "JWT" })}.${part({
    iss: "https://roundtrip.supabase.co/auth/v1", aud: "authenticated", sub: user.id, role: "authenticated", aal: "aal1",
    iat: now, exp: now + 3600, session_id: "30000000-0000-4000-8000-000000000001", amr: [{ method, timestamp: now }],
  })}`;
  const signature = await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signingKey, Buffer.from(input));
  return `${input}.${Buffer.from(signature).toString("base64url")}`;
}

// All provider traffic is intercepted. Synthetic codes are single-use and bound
// to the actual installed SDK's challenge, and access tokens are signed locally.
const transport = vi.fn(async (input: string | URL | Request, options?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.origin !== "https://roundtrip.supabase.co") throw new Error("Unexpected network request");
  const body = options?.body ? JSON.parse(String(options.body)) : {};
  if (url.pathname === "/auth/v1/recover" || url.pathname === "/auth/v1/resend") {
    const recovery = url.pathname.endsWith("recover");
    codes.set(recovery ? "recovery-code" : "signup-code", { challenge: body.code_challenge, method: recovery ? "recovery" : "email/signup" });
    return json({});
  }
  if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "pkce") {
    const code = codes.get(body.auth_code);
    if (!code || createHash("sha256").update(body.code_verifier).digest("base64url") !== code.challenge) return json({ code: "invalid_grant", msg: "Synthetic expired or mismatched code" }, 400);
    codes.delete(body.auth_code);
    return json({ access_token: await accessToken(code.method), refresh_token: "synthetic-refresh-token", expires_in: 3600, token_type: "bearer", user });
  }
  if (url.pathname === "/auth/v1/.well-known/jwks.json") return json({ keys: [{ ...jwk, kid: "roundtrip-key", alg: "ES256", use: "sig" }] });
  if (url.pathname === "/auth/v1/user" && (!options?.method || options.method === "GET")) return json(user);
  throw new Error(`Unexpected mocked provider operation: ${options?.method} ${url.pathname}`);
});

beforeEach(() => {
  vi.clearAllMocks(); jar.clear(); codes.clear();
  f.viewer.mockResolvedValue(null);
  f.cookies.mockResolvedValue({
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => { if (value) jar.set(name, value); else jar.delete(name); },
  });
  vi.stubGlobal("fetch", transport);
});
afterEach(() => vi.unstubAllGlobals());

function emailForm() { const form = new FormData(); form.set("email", user.email); return form; }
const callback = (code: string, extra = "") => GET(new NextRequest(`https://forged-host.test/auth/callback?code=${code}${extra}`));
async function recover() {
  expect((await requestPasswordReset({}, emailForm())).success).toBe(true);
  return callback("recovery-code");
}

it("carries a real SDK recovery request through the actual callback to a verified reset form", async () => {
  const response = await recover();
  expect(response.headers.get("location")).toBe("https://learn.example.com/reset-password");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await getRecoveryUser(await createAuthClient())).toMatchObject({ id: user.id });
  const html = renderToStaticMarkup(await ResetPasswordPage());
  expect(html).toContain("New password");
  expect(html).toContain("Confirm new password");
});

it("keeps ordinary signup sessions out of password recovery even when a query claims recovery", async () => {
  await resendConfirmation({}, emailForm());
  const response = await callback("signup-code", "&type=recovery&next=%2Freset-password");
  expect(response.headers.get("location")).toBe("https://learn.example.com/dashboard");
  expect(await getRecoveryUser(await createAuthClient())).toBeNull();
  const html = renderToStaticMarkup(await ResetPasswordPage());
  expect(html).not.toContain("Confirm new password");
  expect(html).toContain("Open a recent password reset link");
  const form = new FormData(); form.set("password", "synthetic new password"); form.set("confirmPassword", "synthetic new password");
  expect((await updatePassword({}, form)).success).not.toBe(true);
  expect(transport.mock.calls.some(([, options]) => options?.method === "PUT")).toBe(false);
});

it("shows a reused-link error and retry links even when the existing session is signed in", async () => {
  await recover();
  const session = jar.get("sb-roundtrip-auth-token");
  expect(session).toBeDefined();
  const response = await callback("recovery-code");
  expect(response.headers.get("location")).toBe("https://learn.example.com/login?confirmation=failed");
  expect(jar.get("sb-roundtrip-auth-token")).toBe(session);
  f.viewer.mockResolvedValue(user);
  const html = renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({ confirmation: "failed" }) }));
  expect(html).toContain('role="alert"');
  expect(html).toContain("That email link could not be used.");
  expect(html).toContain('href="/forgot-password"');
  expect(html).toContain('href="/resend-confirmation"');
  expect(html).not.toContain("recovery-code");
});

it("shows a failed wrong-browser link without rendering a password update form", async () => {
  await requestPasswordReset({}, emailForm());
  jar.clear();
  const response = await callback("recovery-code");
  expect(response.headers.get("location")).toContain("/login?confirmation=failed");
  const html = renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({ confirmation: "failed" }) }));
  expect(html).toContain('role="alert"');
  expect(html).not.toContain("Confirm new password");
});

it("retains the normal signed-in login redirect and rejects an external next destination", async () => {
  f.viewer.mockResolvedValue(user);
  await expect(LoginPage({ searchParams: Promise.resolve({ next: "//evil.test" }) })).rejects.toThrow("REDIRECT:/dashboard");
  await expect(LoginPage({ searchParams: Promise.resolve({ next: "/profile" }) })).rejects.toThrow("REDIRECT:/profile");
});

it("rejects an external next destination on the register page for signed-in and signed-out visitors", async () => {
  f.viewer.mockResolvedValue(user);
  await expect(RegisterPage({ searchParams: Promise.resolve({ next: "//evil.test" }) })).rejects.toThrow("REDIRECT:/dashboard");
  await expect(RegisterPage({ searchParams: Promise.resolve({ next: "https://evil.test" }) })).rejects.toThrow("REDIRECT:/dashboard");
  await expect(RegisterPage({ searchParams: Promise.resolve({ next: "/profile" }) })).rejects.toThrow("REDIRECT:/profile");
  f.viewer.mockResolvedValue(null);
  const hostile = renderToStaticMarkup(await RegisterPage({ searchParams: Promise.resolve({ next: "//evil.test" }) }));
  expect(hostile).not.toContain("evil.test");
  expect(hostile).toContain('name="next" value="/dashboard"');
  expect(renderToStaticMarkup(await RegisterPage({ searchParams: Promise.resolve({ next: "/profile" }) }))).toContain('name="next" value="/profile"');
});
