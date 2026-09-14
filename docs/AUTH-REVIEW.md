# Phase 3 authentication review

This follow-up builds on published PR #3, preserving its profile race handling, PostgreSQL integration tests, production HTTP smoke test, and complete Phase 3 guide.

## 🟩 Changes and reasoning

- Reject Supabase anonymous users and users without a confirmed email before provisioning or reading an AlgoSprint profile. A successful `getUser()` verifies the identity but does not by itself mean the account meets AlgoSprint's email/password registration requirements.
- Require the configured Supabase URL to be an origin without path, query, or fragment, and require a syntactically valid publishable key. No secret value is accepted in browser-safe configuration.
- Preserve the local return destination when moving between sign-in and registration, and when registration returns an immediate session. Existing safe-path validation remains authoritative.
- Make the signup message conditional so it does not claim an email was sent to an already registered address.
- Refresh sessions only on application and auth routes. The public landing page does not need a provider call. Each protected data access still performs its own online identity check.
- Prevent caching of account responses even when configuration is missing, and add a no-referrer policy to matched responses. Preserve the existing cache headers and all refreshed cookie chunks.

- Fix an empty/malformed-URL crash discovered by the production HTTP smoke test. Zod refinements must not throw when an earlier URL-format check fails. A regression test covers empty, malformed, and non-origin configuration values.

## 🟨 Verification

Paused on 2026-09-14. The implementation commit `445d803c44129f41facc4bff5d5060a6a1ec957d` passed [GitHub CI](https://github.com/zihadpcode/AlgoSprint/actions/runs/34796497047), including PostgreSQL and production HTTP checks. PR #4 remains open; its base branch changed after the verified run and requires reconciliation. See [the handoff](SESSION-HANDOFF.md).

All 37 local tests, lint, TypeScript, the production build, and the production HTTP smoke check passed after the configuration fix.

The added session test covers anonymous and unconfirmed provider identities and asserts that Prisma is not called. The cookie test checks that headers survive multiple writes. The existing integration and HTTP smoke tests remain in the CI workflow. Provider unit tests use mocks. Live Supabase configuration, signup, email delivery, refresh, and logout still need the manual checklist in [PHASE-3-GUIDE.md](PHASE-3-GUIDE.md).

Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`. GitHub CI additionally runs the PostgreSQL integration suite and `npm run test:smoke` against a temporary production server. No account, administrator, or production deployment was created.

## 🟦 Working-copy continuity

Another session published Phase 3 while this review was underway. The review uses an isolated copy and a separate branch. It is based on the published `619811e221470e6b54fc07633338571c2852eff8` checkpoint, without overwriting the other session's files or branch. Follow the current main branch and latest pull requests when resuming.

## 🟩 Complete changed source

These listings supersede matching historical Phase 3 listings.

### `scripts/smoke-auth.mjs`

````javascript
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const origin = "http://127.0.0.1:3100";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"], {
  env: { ...process.env, DATABASE_URL: "", DIRECT_URL: "", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", APP_URL: "", NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let diagnostic = "";
server.stdout.on("data", (chunk) => { diagnostic = (diagnostic + chunk.toString()).slice(-6000); });
server.stderr.on("data", (chunk) => { diagnostic = (diagnostic + chunk.toString()).slice(-3000); });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Server exited: ${diagnostic}`);
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* Wait for the owned server. */ }
    await delay(200);
  }
  assert.ok(ready, `Production server must become ready: ${diagnostic}`);
  for (const path of ["/dashboard", "/profile", "/admin"]) {
    const response = await fetch(origin + path, { redirect: "manual", headers: { cookie: "sb-access-token=forged; role=ADMIN" } });
    assert.equal(response.status, 307, `${path}: ${diagnostic}`);
    assert.ok(response.headers.get("location")?.startsWith("/login?next="), path);
  }
  for (const path of ["/login", "/register"]) {
    const response = await fetch(origin + path); assert.equal(response.status, 200, path);
    assert.ok((await response.text()).includes("Accounts are being prepared"), path);
  }
  const callback = await fetch(origin + "/auth/callback?code=forged", { redirect: "manual" });
  assert.equal(callback.status, 503); assert.match(callback.headers.get("cache-control") ?? "", /(?:^|,\s*)no-store(?:,|$)/);
  console.log("Production HTTP smoke passed: landing, protected redirects, missing-config forms, and callback denial.");
} finally {
  server.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(3000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
````

### `src/app/register/page.tsx`

````tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPage, AccountsUnavailable } from "@/components/auth/auth-page";
import { AuthForm } from "@/components/auth/auth-form";
import { accountsConfigured } from "@/lib/supabase/config";
import { getViewer } from "@/features/auth/session";
import { safeReturnTo } from "@/features/auth/validation";

export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeReturnTo((await searchParams).next);
  if (await getViewer()) redirect(next);
  return <AuthPage title="Make room for progress" description="Create your AlgoSprint account and build a practice habit you can keep.">
    {accountsConfigured() ? <AuthForm mode="register" returnTo={next} /> : <AccountsUnavailable />}
  </AuthPage>;
}
````

### `src/components/auth/auth-form.tsx`

````tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/features/auth/actions";
import type { AuthFormState } from "@/features/auth/validation";

const initial: AuthFormState = {};
export function AuthForm({ mode, returnTo = "/dashboard" }: { mode: "login" | "register"; returnTo?: string }) {
  const registering = mode === "register";
  const [state, action, pending] = useActionState(registering ? register : login, initial);
  return (
    <form action={action} className="mt-8 space-y-5" aria-busy={pending}>
      <input type="hidden" name="next" value={returnTo} />
      {registering && <Field name="displayName" label="Display name" autoComplete="nickname" errors={state.errors?.displayName} minLength={2} maxLength={80} />}
      <Field name="email" label="Email" type="email" autoComplete="email" errors={state.errors?.email} maxLength={254} />
      <Field name="password" label="Password" type="password" autoComplete={registering ? "new-password" : "current-password"} errors={state.errors?.password} maxLength={128} minLength={registering ? 12 : 1} />
      {registering && <p className="text-sm text-muted">Use 12–128 characters. A long, unique passphrase works well.</p>}
      <div aria-live="polite" aria-atomic="true">
        {state.message && <p className="rounded-xl border border-line bg-surface-raised p-4 text-sm leading-6">{state.message}</p>}
      </div>
      <button type="submit" disabled={pending || state.success} className="action-link action-link-primary w-full disabled:cursor-wait disabled:opacity-60">
        {pending ? "Please wait…" : registering ? "Create account" : "Sign in"}
      </button>
      <p className="text-sm text-muted">{registering ? "Already have an account? " : "New to AlgoSprint? "}
        <Link className="rounded text-accent underline underline-offset-4" href={`${registering ? "/login" : "/register"}?next=${encodeURIComponent(returnTo)}`}>{registering ? "Sign in" : "Create an account"}</Link>
      </p>
    </form>
  );
}

function Field({ name, label, errors, ...props }: {
  name: string; label: string; errors?: string[]; type?: string; autoComplete: string; maxLength: number; minLength?: number;
}) {
  return <div>
    <label className="mb-2 block text-sm font-medium" htmlFor={name}>{label}</label>
    <input {...props} id={name} name={name} required aria-invalid={Boolean(errors?.length)} aria-describedby={errors?.length ? `${name}-error` : undefined}
      className="min-h-12 w-full rounded-xl border border-line bg-canvas px-4 text-ink" />
    {errors?.length ? <p id={`${name}-error`} className="mt-2 text-sm text-warm">{errors[0]}</p> : null}
  </div>;
}
````

### `src/features/auth/actions.ts`

````typescript
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server";
import { accountsConfigured, getAppOrigin } from "@/lib/supabase/config";
import { loginSchema, registerSchema, safeReturnTo, type AuthFormState } from "./validation";

const unavailable = "Accounts are temporarily unavailable. Please try again later.";

export async function login(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  const input = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!input.success) return { errors: input.error.flatten().fieldErrors, message: "Check the highlighted fields." };
  if (!accountsConfigured()) return { message: unavailable };
  try {
    const client = await createAuthClient(true);
    const { error } = await client.auth.signInWithPassword(input.data);
    if (error) return { message: error.status === 429 ? "Too many attempts. Please wait before trying again." : "Could not sign in. Check your email, password, and email confirmation." };
  } catch { return { message: unavailable }; }
  revalidatePath("/", "layout");
  redirect(safeReturnTo(form.get("next")));
}

export async function register(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  const input = registerSchema.safeParse({ email: form.get("email"), password: form.get("password"), displayName: form.get("displayName") });
  if (!input.success) return { errors: input.error.flatten().fieldErrors, message: "Check the highlighted fields." };
  if (!accountsConfigured()) return { message: unavailable };
  let signedIn = false;
  try {
    const client = await createAuthClient(true);
    const { email, password, displayName } = input.data;
    const { data, error } = await client.auth.signUp({ email, password, options: {
      data: { display_name: displayName },
      emailRedirectTo: `${getAppOrigin()}/auth/callback`,
    } });
    if (error) return { message: error.status === 429 ? "Too many attempts. Please wait before trying again." : "We could not complete registration. Please try again, or sign in if you already have an account." };
    signedIn = Boolean(data.session);
  } catch { return { message: unavailable }; }
  if (signedIn) {
    revalidatePath("/", "layout");
    redirect(safeReturnTo(form.get("next")));
  }
  // The same response covers an existing account; do not disclose membership.
  return { success: true, message: "If your email is eligible, a confirmation link is on its way. Open it in this browser. Already registered? Sign in below." };
}

export async function logout(): Promise<void> {
  try {
    const client = await createAuthClient(true);
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw new Error("Sign-out failed.");
  } catch { throw new Error("Could not sign out. Please try again."); }
  revalidatePath("/", "layout");
  redirect("/login?signedOut=1");
}
````

### `src/features/auth/session.ts`

````typescript
import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";
import { accountsConfigured } from "@/lib/supabase/config";
import { getDatabase } from "@/lib/prisma";
import { ensureProfile } from "./profile";
import { safeReturnTo } from "./validation";

// React cache lasts for one server render; never cache this across users/requests.
export const getViewer = cache(async () => {
  if (!accountsConfigured()) return null;
  const client = await createAuthClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    if (error && (error.status === undefined || error.status >= 500)) {
      throw new Error("Accounts are temporarily unavailable. Please try again.");
    }
    return null;
  }
  if (data.user.is_anonymous || !data.user.email_confirmed_at || !data.user.email) return null;
  const profile = await ensureProfile(getDatabase(), data.user);
  return { ...profile, email: data.user.email ?? null };
});

export async function requireViewer(returnTo = "/dashboard") {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(safeReturnTo(returnTo))}`);
  return viewer;
}

export async function requireAdmin() {
  const viewer = await requireViewer("/admin");
  if (viewer.role !== "ADMIN") notFound();
  return viewer;
}
````

### `src/lib/supabase/config.ts`

````typescript
import "server-only";
import { z } from "zod";

const configSchema = z.object({
  url: z.url().refine((value) => {
    // Refinements can run even when an earlier format check failed. Never let
    // URL construction throw out of safeParse for empty/malformed configuration.
    try {
      const url = new URL(value);
      return !url.username && !url.password && !url.search && !url.hash && url.pathname === "/" && (url.protocol === "https:" ||
        (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
    } catch { return false; }
  }),
  key: z.string().regex(/^sb_publishable_[A-Za-z0-9_-]+$/).min(25),
});

export function getSupabaseConfig() {
  const result = configSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return result.success ? result.data : null;
}

export function getAppOrigin() {
  const raw = process.env.APP_URL || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : undefined);
  if (!raw) throw new Error("APP_URL must be configured before using accounts.");
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      !(url.protocol === "https:" || (process.env.NODE_ENV !== "production" && local && url.protocol === "http:"))) {
    throw new Error("APP_URL must be a trusted site origin.");
  }
  return url.origin;
}

export function accountsConfigured() {
  if (!getSupabaseConfig() || !process.env.DATABASE_URL) return false;
  try { getAppOrigin(); return true; } catch { return false; }
}

// Authentication is handled by server actions; no browser auth client is used.
export const authCookieOptions = {
  path: "/", sameSite: "lax" as const, httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
````

### `src/lib/supabase/proxy.ts`

````typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions, getSupabaseConfig } from "./config";

export async function refreshAuth(request: NextRequest) {
  let response = NextResponse.next({ request });
  const cacheHeaders: Record<string, string> = {};
  const config = getSupabaseConfig();
  if (!config) {
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const client = createServerClient(config.url, config.key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers = {}) {
        Object.assign(cacheHeaders, headers);
        for (const { name, value } of values) request.cookies.set(name, value);
        const previous = response.cookies.getAll();
        response = NextResponse.next({ request });
        for (const cookie of previous) response.cookies.set(cookie);
        for (const { name, value, options } of values) response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(cacheHeaders)) response.headers.set(name, value);
      },
    },
  });
  // Refresh only. Every protected page/action verifies identity again near data.
  try { await client.auth.getClaims(); }
  catch { /* The server guard fails closed if the provider is unavailable. */ }
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
````

### `src/proxy.ts`

````typescript
import type { NextRequest } from "next/server";
import { refreshAuth } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return refreshAuth(request);
}

export const config = {
  matcher: ["/login", "/register", "/auth/:path*", "/dashboard/:path*", "/profile/:path*", "/admin/:path*", "/problems/:path*", "/notes/:path*", "/review/:path*", "/roadmaps/:path*", "/mock-interview/:path*", "/interview-results/:path*", "/api/:path*"],
};
````

### `tests/auth-proxy.test.ts`

````typescript
import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const f = vi.hoisted(() => ({ create: vi.fn(), claims: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({ createServerClient: f.create }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: () => ({ url: "https://project.supabase.co", key: "publishable" }), authCookieOptions: { httpOnly: true, secure: true, sameSite: "lax", path: "/" } }));
import { refreshAuth } from "@/lib/supabase/proxy";
it("preserves all refreshed cookies on both request and response", async () => {
  f.create.mockImplementation((_url, _key, options) => ({ auth: { getClaims: async () => {
    f.claims(); options.cookies.setAll([{ name: "session.0", value: "part1", options: { httpOnly: true, secure: true } }], { Expires: "0", Pragma: "no-cache" }); options.cookies.setAll([{ name: "session.1", value: "part2", options: { httpOnly: true, secure: true } }], {});
  } } }));
  const request = new NextRequest("https://learn.example.com/profile"); const response = await refreshAuth(request);
  expect(f.claims).toHaveBeenCalledOnce();
  for (const name of ["session.0", "session.1"]) { expect(request.cookies.get(name)?.value).toBeTruthy(); expect(response.cookies.get(name)?.httpOnly).toBe(true); }
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("expires")).toBe("0");
  expect(response.headers.get("pragma")).toBe("no-cache");
});
````

### `tests/auth-session.test.ts`

````typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ configured: vi.fn(), getUser: vi.fn(), upsert: vi.fn(), database: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/config", () => ({ accountsConfigured: f.configured }));
vi.mock("@/lib/supabase/server", () => ({ createAuthClient: async () => ({ auth: { getUser: f.getUser } }) }));
vi.mock("@/lib/prisma", () => ({ getDatabase: f.database }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
import { getViewer, requireAdmin, requireViewer } from "@/features/auth/session";
const id = "20000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks(); f.configured.mockReturnValue(true); f.database.mockReturnValue({ user: { upsert: f.upsert } });
  f.getUser.mockResolvedValue({ data: { user: { id, email: "a@example.com", email_confirmed_at: "2026-09-14T00:00:00Z", is_anonymous: false, user_metadata: { display_name: "Ada", role: "ADMIN" } } }, error: null });
  f.upsert.mockResolvedValue({ id, role: "USER", displayName: "Ada", timeZone: "UTC", createdAt: new Date(0) });
});
describe("verified sessions and database roles", () => {
  it("denies anonymous access before querying personal data", async () => {
    f.getUser.mockResolvedValue({ data: { user: null }, error: { status: 400 } });
    await expect(requireViewer("/profile")).rejects.toThrow("REDIRECT:/login?next=%2Fprofile");
    expect(f.database).not.toHaveBeenCalled();
  });
  it("creates a regular profile using only the verified ID and display name", async () => {
    expect((await getViewer())?.id).toBe(id);
    expect(f.upsert.mock.calls[0][0].create).toEqual({ id, displayName: "Ada", role: "USER" });
    expect(f.upsert.mock.calls[0][0].update).toEqual({});
  });
  it("rejects admin access despite forged metadata and permits a database admin", async () => {
    await expect(requireAdmin()).rejects.toThrow("NOT_FOUND");
    f.upsert.mockResolvedValue({ id, role: "ADMIN" });
    expect((await requireAdmin()).role).toBe("ADMIN");
  });
  it("fails closed on provider errors and missing configuration", async () => {
    f.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
    await expect(getViewer()).rejects.toThrow("temporarily unavailable"); expect(f.database).not.toHaveBeenCalled();
    f.configured.mockReturnValue(false); f.getUser.mockClear(); expect(await getViewer()).toBeNull(); expect(f.getUser).not.toHaveBeenCalled();
  });
  it("rejects anonymous and unconfirmed provider users before provisioning profiles", async () => {
    for (const user of [{ id, email: "a@example.com", is_anonymous: true, email_confirmed_at: "2026-09-14T00:00:00Z" }, { id, email: "a@example.com", email_confirmed_at: null }]) {
      f.getUser.mockResolvedValue({ data: { user }, error: null });
      expect(await getViewer()).toBeNull();
      expect(f.database).not.toHaveBeenCalled();
    }
  });
});
````

### `tests/auth-validation.test.ts`

````typescript
import { describe, expect, it, vi, afterEach } from "vitest";
import { loginSchema, registerSchema, safeReturnTo } from "@/features/auth/validation";
vi.mock("server-only", () => ({}));
import { accountsConfigured, getAppOrigin, getSupabaseConfig } from "@/lib/supabase/config";
afterEach(() => vi.unstubAllEnvs());

describe("authentication input and configuration boundaries", () => {
  it("treats empty and malformed environment URLs as unavailable without throwing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_testconfiguration");
    for (const url of ["", "not-a-url", "https://project.supabase.co/path", "https://project.supabase.co?x=1", "https://project.supabase.co#fragment"]) {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
      expect(getSupabaseConfig()).toBeNull();
      expect(accountsConfigured()).toBe(false);
    }
  });
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
````
