# Phase 3 — Supabase authentication

This checkpoint adds working authentication integration code. Its source appendix records this milestone; current repository files are authoritative after later phases. A real Supabase project is still required to exercise sign-in and email delivery. No project, credentials, users, or administrator were created during implementation.

The [authentication review](AUTH-REVIEW.md) adds confirmed-email enforcement, tighter configuration checks, return-path continuity, and updated complete source. Consult it after this checkpoint.

## 🟦 What we are building

The application now has `/register`, `/login`, `/auth/callback`, `/dashboard`, `/profile`, and `/admin`. Supabase handles password authentication. Next.js server actions validate forms and call Supabase. A request-scoped server client reads/writes cookies; Proxy refreshes expired tokens before rendering. The data access layer verifies the current user, provisions the application's profile, and applies role checks.

The public landing page still builds and renders without credentials. Unconfigured account pages show a useful unavailable state rather than pretending to create accounts. Dashboard/profile require a verified user, and the admin page requires `ADMIN` from the database.

## 🟨 Why these boundaries

Authentication answers who the visitor is; authorization answers what that visitor may access. We use a fresh Supabase `getUser()` response before creating/querying a profile. Proxy refreshes cookies with `getClaims()` but is not the authorization gate. These choices follow [Supabase's SSR integration model](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs). A client is created per request; it is never a global singleton.

The server can trust the verified user ID, but editable user metadata is not a source of privileges. Only a validated display name is read from metadata. Profiles default to `USER`. Subsequent visits preserve the existing display name, role, and preferences. Concurrent first requests recover from a duplicate-ID race without overwriting the winning record.

React `cache()` deduplicates profile verification within a server render, not across visitors. Each protected page calls its guard before accessing personal/admin content; layout-only hiding would not protect server payloads. Future API routes and server actions must do the same near each query.

Authentication happens through server actions, so cookies can be HttpOnly. Secure cookies are enabled in production; SameSite is Lax for confirmation navigation. Next.js checks Server Action origins; our code validates all fields and does not widen allowed origins. Proxy preserves every refreshed cookie and no-cache headers, including multiple writes. Callback responses prevent caching and referrer leakage.

## 🟩 Supabase setup

1. Use a development Supabase project you control. This task did not create one. Copy its PostgreSQL connection information from **Connect** and its browser-safe **publishable** key. This version requires a current `sb_publishable_` key rather than a legacy anon JWT.
2. In local `.env.local`, set `DATABASE_URL` and optional `DIRECT_URL` as explained in Phase 2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `APP_URL=http://localhost:3000`. `APP_URL` is a trusted origin without a path, query, or credentials. Production requires an explicit HTTPS origin.
3. Apply the committed migration and seed: `npm run db:deploy`, then `npm run db:seed`.
4. In Supabase Auth, enable email/password and keep email confirmation enabled for the deployed product. Align the provider's minimum password length to at least 12 characters. AlgoSprint registration accepts 12–128 characters and preserves spaces; login permits shorter existing passwords so a later policy change does not lock users out.
5. Set Supabase's Site URL to the app origin and allow the exact callback URL, e.g. `http://localhost:3000/auth/callback`. Add the deployed HTTPS callback when you deploy; avoid broad production wildcards.
6. Keep the confirmation template's Supabase verification link flow. Signup supplies the app callback as `emailRedirectTo`; the provider redirects there with a PKCE code. Open the confirmation in the same browser that started signup so the verifier cookie is present. Invalid, expired, or replayed codes go to a fixed login message. The code and raw provider errors are not reflected.
7. Configure SMTP/delivery and provider rate limits appropriate for your environment. The [Supabase password guide](https://supabase.com/docs/guides/auth/passwords) describes email confirmation and delivery setup. This milestone relies on provider throttling and displays a wait message for HTTP 429; it does not claim to provide a distributed app rate limiter or CAPTCHA.

```bash
npm ci
npm run db:deploy
npm run db:seed
npm run dev
```

The `NEXT_PUBLIC_` configuration values are browser-safe and are normally fixed at build time. Set them before building a configured deployment and rebuild when changing projects. Never place a database password, service-role key, or secret key behind this prefix. No service-role key is needed for this integration.

## 🟩 How a request flows

- Registration validates the display name, email, and password, then calls Supabase. If confirmation is pending, the form displays a generic check-email response. If the provider deliberately returns an immediate session, it redirects to the dashboard.
- Login validates input, delegates password checking to Supabase, writes the session cookies, invalidates the route tree, and redirects to an allowlisted local destination. It does not return the password in action state or provider messages in errors.
- The callback exchanges the PKCE code, then redirects using the configured origin. It never trusts a request's Host for the final destination. External URLs, protocol-relative URLs, encoded path separators, and path traversal are rejected as return paths.
- A protected page calls `requireViewer()`. The server asks Supabase for the verified user, creates or reads the application profile, and returns a small view containing the profile and verified email. Invalid sessions redirect to login; provider outages fail closed.
- `requireAdmin()` checks the database role after authentication. Ordinary users receive a not-found response. Adding an admin link is only a convenience, not a permission grant.
- Logout is a server POST action, revokes this browser's session through Supabase, and redirects only after success. Other devices remain signed in because the scope is local. Previously issued access tokens may retain their provider-defined lifetime; this is not a claim of universal instant token revocation.

## 🟥 Provisioning your administrator

Register, confirm, and sign in once so a profile exists. In a trusted local terminal with the correct database connection, run:

```bash
npm run user:role -- --user-id YOUR_VERIFIED_SUPABASE_USER_UUID --role ADMIN
```

Use the UUID of the intended account from Supabase Auth. The CLI validates UUID/role and updates an existing profile; it cannot create a login account. `--role USER` removes admin privileges. No public role-changing action exists. Never infer privileges from email spelling, a hidden input, or `user_metadata.role`.

## 🟩 Tests and manual checklist

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

The suite now has 35 unit/migration tests, including auth input validation, safe return paths, rejected secret keys, verified-user profile creation, forged metadata roles, anonymous/admin guards, provider failures, signup/login/logout behavior, callback errors, and refresh-cookie preservation. These auth tests mock provider responses; they do not send email or authenticate a real account.

The PostgreSQL integration suite also checks concurrent profile creation and preservation of maintained database roles/display names. CI supplies a disposable PostgreSQL 17 database for `npm run test:integration`. After building, `npm run test:smoke` starts a temporary production server with account configuration deliberately removed and checks real HTTP redirects/denials. This runs in CI because local server sockets are restricted in the coding workspace. The owned smoke server is terminated in a finally block.

Once you configure a development Supabase project:

1. Register with an email you control. Check required-field messages, long inputs, pending state, and server errors. Never use a real production password for testing.
2. Before confirming, verify that dashboard/profile/admin are inaccessible. Confirm in the signup browser, then check the dashboard and profile's identity.
3. Reload after token expiry and verify the session refreshes. Confirm cookie HttpOnly/SameSite settings and Secure in HTTPS production. Check that account responses are not cached publicly.
4. Sign out and revisit protected URLs directly, including in another tab. A forged `role=ADMIN` cookie or signup metadata must not grant access.
5. Test wrong password, invalid/reused confirmation code, and `/login?next=//example.com`. Provider errors should not leak tokens or internal details.
6. Promote only your intended UUID via the trusted CLI, confirm `/admin` becomes available, then demote and confirm access is removed on a fresh request.
7. Test keyboard navigation, visible focus, form labels/errors, mobile widths, and 200% zoom. No browser visual QA was performed in this implementation session.

## 🟥 Common mistakes and remaining work

Do not use `getSession().user` alone to authorize a request. Do not cache viewer data globally or make a global Supabase server client. Do not serialize entire provider sessions or Prisma models to the browser. Do not silently swallow failed cookie writes in an action or report successful logout when provider revocation failed. Do not widen callback origins to solve a configuration typo.

This milestone is not a production launch. Live project integration, email delivery, password recovery/resend UX, abuse controls, and deployment checks still need attention before a public release. GitHub OAuth is deferred. The account frame and dashboard are intentionally small; Phase 4 creates the reusable UI system, and later milestones add real practice and analytics.

## 🟪 Expansion

Build the shared app shell next, then the searchable problem library. Keep role checks close to every future admin operation and ownership checks close to every progress/note/submission query. Add OAuth through the same verified identity/profile boundary when its provider configuration is available.

## 🟩 Complete Phase 3 source

The lockfile is supplied in the repository. The following complete files form the authentication checkpoint; earlier source remains in the Phase 1 and Phase 2 guides.

### `package.json`

```json
{
  "name": "algosprint",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --max-warnings=0",
    "typecheck": "next typegen && tsc --noEmit",
    "db:generate": "prisma generate",
    "db:validate": "prisma validate",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio",
    "db:local": "prisma dev --name algosprint",
    "seed:validate": "node --import tsx scripts/validate-seeds.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "prebuild": "prisma generate",
    "pretypecheck": "prisma generate",
    "predev": "prisma generate",
    "test:integration": "vitest run --config vitest.integration.config.mts",
    "user:role": "node --import tsx scripts/set-user-role.ts",
    "test:smoke": "node scripts/smoke-auth.mjs"
  },
  "engines": {
    "node": ">=24 <25"
  },
  "dependencies": {
    "@next/env": "16.3.5",
    "@prisma/adapter-pg": "7.10.0",
    "@prisma/client": "7.10.0",
    "@supabase/ssr": "0.12.7",
    "@supabase/supabase-js": "2.116.0",
    "clsx": "2.1.1",
    "lucide-react": "1.45.0",
    "next": "16.3.5",
    "pg": "8.23.0",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "server-only": "0.0.1",
    "tailwind-merge": "3.6.0",
    "zod": "4.6.4"
  },
  "devDependencies": {
    "@electric-sql/pglite": "0.4.3",
    "@tailwindcss/postcss": "^4",
    "@types/node": "24.13.4",
    "@types/pg": "8.23.1",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.5",
    "prisma": "7.10.0",
    "tailwindcss": "^4",
    "tsx": "4.23.13",
    "typescript": "^5",
    "vitest": "5.0.0"
  }
}
```

### `.env.example`

```text
# Copy this file to .env.local without overwriting existing configuration.
# The landing page, build, and unit tests work without credentials.

# Phase 2: server-only PostgreSQL connection, including its password.
# DATABASE_URL=
# DIRECT_URL=
# DATABASE_URL is used by the server. DIRECT_URL, if set, is used by migrations
# and seeding. Copy the appropriate PostgreSQL URL from Supabase Connect.
# Keep TLS verification enabled; URL-encode special characters in passwords.
# Optional separate shadow database, only for creating new dev migrations:
# SHADOW_DATABASE_URL=
# Dedicated disposable database for integration tests (name must end in _test):
# TEST_DATABASE_URL=

# Phase 3: browser-safe Supabase project URL and publishable key.
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
# Use a current sb_publishable_ key, never a secret/service-role key.
# Canonical origin for auth redirects; required in production:
# APP_URL=http://localhost:3000

# Phase 8: server-only runner credentials, if we choose Judge0.
# JUDGE0_API_URL=
# JUDGE0_API_KEY=

# Do not add a Supabase service-role key unless a specific server task needs it.
# Never put database passwords or private API keys behind NEXT_PUBLIC_.
```

### `.github/workflows/ci.yml`

```yaml
name: Validate AlgoSprint

on:
  pull_request:
  push:
    branches: [main, "algosprint/**"]

permissions:
  contents: read

concurrency:
  group: validate-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: algosprint_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres -d algosprint_test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/algosprint_test
      TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/algosprint_test
      NEXT_TELEMETRY_DISABLED: "1"
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run db:generate
      - run: npm run db:validate
      - run: npm run db:deploy
      - run: npm run seed:validate
      - run: npm test
      - run: npm run test:integration
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build
      - run: npm run test:smoke
```

### `src/proxy.ts`

```ts
import type { NextRequest } from "next/server";
import { refreshAuth } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return refreshAuth(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp)$).*)"],
};
```

### `src/components/layout/site-header.tsx`

```tsx
import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { Container } from "@/components/layout/container";
import { LANDING_NAV } from "@/lib/constants";

export function SiteHeader() {
  return (
    <header className="border-b border-line/70">
      <Container className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-5">
        <Brand />
        <Link href="/login" className="min-h-11 rounded-xl border border-line px-4 py-2.5 text-sm text-accent hover:bg-surface lg:order-last">Sign in</Link>
        <nav aria-label="Main navigation" className="flex w-full flex-wrap gap-x-5 gap-y-1 lg:w-auto lg:gap-x-8">
          {LANDING_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 items-center rounded-md text-sm text-muted transition-colors hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </Container>
    </header>
  );
}
```

### `scripts/set-user-role.ts`

```ts
import { parseArgs } from "node:util";
import { loadEnvConfig } from "@next/env";
import { z } from "zod";
import { createDatabaseClient } from "../src/lib/db/client";

loadEnvConfig(process.cwd());
async function main() {
  const { values } = parseArgs({ options: { "user-id": { type: "string" }, role: { type: "string" } }, strict: true });
  const id = z.uuid().parse(values["user-id"]);
  const role = z.enum(["USER", "ADMIN"]).parse(values.role);
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Configure a trusted database connection first.");
  const db = createDatabaseClient(url);
  try {
    // Only an existing, authenticated profile can be promoted; no account creation.
    await db.user.update({ where: { id }, data: { role } });
    console.log(`Updated role for ${id} to ${role}.`);
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error("Role update failed. Check the UUID, USER/ADMIN role, and database configuration. The user must sign in once first."); process.exitCode = 1; });
```

### `scripts/smoke-auth.mjs`

```js
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const origin = "http://127.0.0.1:3100";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"], {
  env: { ...process.env, DATABASE_URL: "", DIRECT_URL: "", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", APP_URL: "", NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "ignore", "pipe"],
});
let diagnostic = "";
server.stderr.on("data", (chunk) => { diagnostic = (diagnostic + chunk.toString()).slice(-3000); });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Server exited: ${diagnostic}`);
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* Wait for the owned server. */ }
    await delay(200);
  }
  assert.ok(ready, "Production server must become ready");
  for (const path of ["/dashboard", "/profile", "/admin"]) {
    const response = await fetch(origin + path, { redirect: "manual", headers: { cookie: "sb-access-token=forged; role=ADMIN" } });
    assert.equal(response.status, 307, path);
    assert.ok(response.headers.get("location")?.startsWith("/login?next="), path);
  }
  for (const path of ["/login", "/register"]) {
    const response = await fetch(origin + path); assert.equal(response.status, 200, path);
    assert.ok((await response.text()).includes("Accounts are being prepared"), path);
  }
  const callback = await fetch(origin + "/auth/callback?code=forged", { redirect: "manual" });
  assert.equal(callback.status, 503); assert.equal(callback.headers.get("cache-control"), "no-store");
  console.log("Production HTTP smoke passed: landing, protected redirects, missing-config forms, and callback denial.");
} finally {
  server.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(3000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
```

### `tests/integration/seed.test.ts`

```ts
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/lib/db/client";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import { ensureProfile } from "@/features/auth/profile";
import type { ProblemSeed } from "@/lib/validators/problem";

let db: ReturnType<typeof createDatabaseClient>;
let problems: ProblemSeed[];
let ownsFixtures = false;
const userId = randomUUID();

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use TEST_DATABASE_URL pointing to a dedicated database ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Integration tests require an empty problem collection in the dedicated test database.");
  problems = await loadProblems();
  ownsFixtures = true;
}, 30_000);
afterAll(async () => {
  if (db && ownsFixtures) {
    await db.user.deleteMany({ where: { id: userId } });
    await db.problem.deleteMany({ where: { slug: { in: problems.map((p) => p.slug) } } });
  }
  await db?.$disconnect();
});

describe("real PostgreSQL seed lifecycle", () => {
  it("inserts complete related data atomically per batch", async () => {
    expect(await seedProblems(db, problems)).toEqual({ created: 5, skipped: 0 });
    expect(await db.problemHint.count()).toBe(25);
    expect(await db.problemSolution.count()).toBe(10);
    expect(await db.testCase.count()).toBe(30);
    expect(await db.category.count()).toBe(30);
  });
  it("is idempotent and preserves IDs and user data on rerun", async () => {
    const before = await db.problem.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true, updatedAt: true } });
    const profiles = await Promise.all(Array.from({ length: 3 }, () => ensureProfile(db, { id: userId, user_metadata: { role: "ADMIN" } })));
    expect(profiles.every((p) => p.id === userId && p.role === "USER")).toBe(true);
    await db.userProgress.create({ data: { userId, problemId: before[0].id, bookmarked: true } });
    expect(await seedProblems(db, problems)).toEqual({ created: 0, skipped: 5 });
    expect(await db.problem.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true, updatedAt: true } })).toEqual(before);
    expect(await db.userProgress.count({ where: { userId, bookmarked: true } })).toBe(1);
  });
  it("creates profiles without trusting metadata roles and preserves database roles", async () => {
    const first = await ensureProfile(db, { id: userId, user_metadata: { role: "ADMIN", display_name: "Changed name" } });
    expect(first.role).toBe("USER");
    await db.user.update({ where: { id: userId }, data: { role: "ADMIN", displayName: "Maintained name" } });
    const again = await ensureProfile(db, { id: userId, user_metadata: { role: "USER", display_name: "Override attempt" } });
    expect(again.role).toBe("ADMIN"); expect(again.displayName).toBe("Maintained name");
  });
  it("refuses content collisions without changing the saved problem", async () => {
    const original = await db.problem.findUniqueOrThrow({ where: { slug: problems[0].slug } });
    await expect(seedProblems(db, [{ ...problems[0], title: "Changed content" }])).rejects.toThrow(/Seed conflict/);
    expect((await db.problem.findUniqueOrThrow({ where: { slug: problems[0].slug } })).title).toBe(original.title);
  });
  it("validates the complete input before starting new writes", async () => {
    const before = await db.problem.count();
    await expect(seedProblems(db, [problems[0], problems[0]])).rejects.toThrow(/Duplicate problem slug/);
    await expect(seedProblems(db, [{ ...problems[0], relatedSlugs: ["missing-problem"] }])).rejects.toThrow();
    expect(await db.problem.count()).toBe(before);
  });
});
```

### `src/features/auth/actions.ts`

```ts
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
    redirect("/dashboard");
  }
  // The same response covers an existing account; do not disclose membership.
  return { success: true, message: "Check your email for a confirmation link. Open it in this browser, then sign in if needed." };
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
```

### `src/features/auth/profile.ts`

```ts
import { z } from "zod";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { displayNameSchema } from "./validation";

// Caller must pass a user returned by Supabase getUser(), never form data.
export async function ensureProfile(db: PrismaClient, verifiedUser: { id: string; user_metadata?: Record<string, unknown> }) {
  const id = z.uuid().parse(verifiedUser.id);
  const name = displayNameSchema.safeParse(verifiedUser.user_metadata?.display_name);
  const select = { id: true, displayName: true, role: true, timeZone: true, createdAt: true } as const;
  try { return await db.user.upsert({
    where: { id },
    create: { id, displayName: name.success ? name.data : null, role: "USER" },
    update: {},
    select,
  }); } catch (error) {
    // Two first requests may provision the same profile concurrently.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return db.user.findUniqueOrThrow({ where: { id }, select });
    }
    throw error;
  }
}
```

### `src/features/auth/session.ts`

```ts
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
```

### `src/features/auth/validation.ts`

```ts
import { z } from "zod";

export const displayNameSchema = z.string().trim().min(2, "Use at least 2 characters.").max(80, "Use at most 80 characters.")
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Use a name without control characters.");
const email = z.string().trim().max(254).pipe(z.email("Enter a valid email address."));
export const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password.").max(128) });
export const registerSchema = z.object({
  displayName: displayNameSchema,
  email,
  // Preserve spaces; never silently trim or transform a password.
  password: z.string().min(12, "Use at least 12 characters.").max(128, "Use at most 128 characters."),
});

export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length > 1000) return "/dashboard";
  // Only known application roots and simple path segments. Query values stay local.
  if (!/^\/(?:dashboard|profile|problems|roadmaps|notes|review|admin|mock-interview)(?:\/[a-zA-Z0-9_-]+)*(?:\?[^#\\\u0000-\u001f\u007f]*)?$/.test(value)) return "/dashboard";
  return value;
}

export type AuthFormState = {
  message?: string;
  success?: boolean;
  errors?: Partial<Record<"email" | "password" | "displayName", string[]>>;
};
```

### `src/lib/supabase/config.ts`

```ts
import "server-only";
import { z } from "zod";

const configSchema = z.object({
  url: z.url().refine((value) => {
    const url = new URL(value);
    return !url.username && !url.password && (url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
  }),
  key: z.string().startsWith("sb_publishable_").min(25),
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
```

### `src/lib/supabase/proxy.ts`

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions, getSupabaseConfig } from "./config";

export async function refreshAuth(request: NextRequest) {
  let response = NextResponse.next({ request });
  const cacheHeaders: Record<string, string> = {};
  const config = getSupabaseConfig();
  if (!config) return response;
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
  return response;
}
```

### `src/lib/supabase/server.ts`

```ts
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authCookieOptions, getSupabaseConfig } from "./config";

export async function createAuthClient(writable = false) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Accounts are temporarily unavailable.");
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        // Server Components only read cookies. Proxy persists refreshed tokens.
        // Actions and callbacks opt into writes, where failures must propagate.
        if (!writable) return;
        for (const { name, value, options } of values) jar.set(name, value, options);
      },
    },
  });
}
```

### `src/components/auth/account-frame.tsx`

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/layout/brand";
import { Container } from "@/components/layout/container";
import { logout } from "@/features/auth/actions";

export function AccountFrame({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  return <>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-canvas focus:p-4">Skip to content</a>
    <header className="border-b border-line"><Container className="flex flex-wrap items-center justify-between gap-5 py-5">
      <Brand /><nav aria-label="Account navigation" className="flex flex-wrap items-center gap-5 text-sm">
        <Link href="/dashboard" className="rounded py-3 text-accent">Dashboard</Link><Link href="/profile" className="rounded py-3 text-accent">Profile</Link>
        {admin && <Link href="/admin" className="rounded py-3 text-accent">Admin</Link>}
        <form action={logout}><button className="min-h-11 rounded-lg border border-line px-4 hover:bg-surface-raised" type="submit">Sign out</button></form>
      </nav>
    </Container></header>
    <main id="main-content"><Container className="py-12">{children}</Container></main>
  </>;
}
```

### `src/components/auth/auth-form.tsx`

```tsx
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
      {registering && <Field name="displayName" label="Display name" autoComplete="nickname" errors={state.errors?.displayName} maxLength={80} />}
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
        <Link className="rounded text-accent underline underline-offset-4" href={registering ? "/login" : "/register"}>{registering ? "Sign in" : "Create an account"}</Link>
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
```

### `src/components/auth/auth-page.tsx`

```tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { Brand } from "@/components/layout/brand";

export function AuthPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main id="main-content" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-12">
    <div className="mb-10"><Brand /></div>
    <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
      <p className="eyebrow mb-3 text-accent">Practice with purpose</p>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 leading-7 text-muted">{description}</p>
      {children}
    </section>
    <Link href="/" className="mt-6 self-start rounded py-2 text-sm text-muted underline underline-offset-4">Back to home</Link>
  </main>;
}
export function AccountsUnavailable() {
  return <p role="status" className="mt-6 rounded-xl border border-line p-4 text-sm leading-6 text-muted">Accounts are being prepared. Please try again later.</p>;
}
```

### `tests/auth-actions.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ configured: vi.fn(), signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), create: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/config", () => ({ accountsConfigured: f.configured, getAppOrigin: () => "https://learn.example.com" }));
vi.mock("@/lib/supabase/server", () => ({ createAuthClient: f.create }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import { login, logout, register } from "@/features/auth/actions";
function form(extra: Record<string, string> = {}) { const d = new FormData(); for (const [k,v] of Object.entries({ email: "a@example.com", password: "correct horse battery", displayName: "Ada", ...extra })) d.set(k,v); return d; }
beforeEach(() => { vi.clearAllMocks(); f.configured.mockReturnValue(true); f.create.mockResolvedValue({ auth: { signInWithPassword: f.signIn, signUp: f.signUp, signOut: f.signOut } }); });
describe("auth actions", () => {
  it("validates before calling Supabase and never returns credentials", async () => {
    const result = await login({}, form({ email: "bad" })); expect(result.errors?.email).toBeDefined(); expect(f.create).not.toHaveBeenCalled(); expect(JSON.stringify(result)).not.toContain("correct horse battery");
  });
  it("masks provider errors and handles throttling", async () => {
    f.signIn.mockResolvedValue({ error: { status: 400, message: "private provider detail" } }); expect((await login({}, form())).message).not.toContain("private");
    f.signIn.mockResolvedValue({ error: { status: 429 } }); expect((await login({}, form())).message).toContain("Too many attempts");
  });
  it("writes cookies and limits post-login navigation", async () => {
    f.signIn.mockResolvedValue({ error: null }); await expect(login({}, form({ next: "//evil.test" }))).rejects.toThrow("REDIRECT:/dashboard"); expect(f.create).toHaveBeenCalledWith(true); expect(f.revalidate).toHaveBeenCalled();
  });
  it("registers without accepting roles and waits for confirmation", async () => {
    f.signUp.mockResolvedValue({ data: { session: null }, error: null }); const result = await register({}, form({ role: "ADMIN" })); expect(result.success).toBe(true);
    expect(f.signUp.mock.calls[0][0].options).toEqual({ data: { display_name: "Ada" }, emailRedirectTo: "https://learn.example.com/auth/callback" });
  });
  it("supports immediate sessions only when returned by the provider", async () => {
    f.signUp.mockResolvedValue({ data: { session: { access_token: "private" } }, error: null }); await expect(register({}, form())).rejects.toThrow("REDIRECT:/dashboard");
  });
  it("does not report successful logout if revocation fails", async () => {
    f.signOut.mockResolvedValue({ error: { status: 503 } }); await expect(logout()).rejects.toThrow("Could not sign out"); expect(f.revalidate).not.toHaveBeenCalled();
    f.signOut.mockResolvedValue({ error: null }); await expect(logout()).rejects.toThrow("REDIRECT:/login?signedOut=1"); expect(f.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
```

### `tests/auth-callback.test.ts`

```ts
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
```

### `tests/auth-proxy.test.ts`

```ts
import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const f = vi.hoisted(() => ({ create: vi.fn(), claims: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({ createServerClient: f.create }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: () => ({ url: "https://project.supabase.co", key: "publishable" }), authCookieOptions: { httpOnly: true, secure: true, sameSite: "lax", path: "/" } }));
import { refreshAuth } from "@/lib/supabase/proxy";
it("preserves all refreshed cookies on both request and response", async () => {
  f.create.mockImplementation((_url, _key, options) => ({ auth: { getClaims: async () => {
    f.claims(); options.cookies.setAll([{ name: "session.0", value: "part1", options: { httpOnly: true, secure: true } }], { "Expires": "0", "Pragma": "no-cache" }); options.cookies.setAll([{ name: "session.1", value: "part2", options: { httpOnly: true, secure: true } }]);
  } } }));
  const request = new NextRequest("https://learn.example.com/profile"); const response = await refreshAuth(request);
  expect(f.claims).toHaveBeenCalledOnce();
  for (const name of ["session.0", "session.1"]) { expect(request.cookies.get(name)?.value).toBeTruthy(); expect(response.cookies.get(name)?.httpOnly).toBe(true); }
  expect(response.headers.get("expires")).toBe("0"); expect(response.headers.get("pragma")).toBe("no-cache");
  expect(response.headers.get("cache-control")).toContain("no-store");
});
```

### `tests/auth-session.test.ts`

```ts
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
  f.getUser.mockResolvedValue({ data: { user: { id, email: "a@example.com", user_metadata: { display_name: "Ada", role: "ADMIN" } } }, error: null });
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
});
```

### `tests/auth-validation.test.ts`

```ts
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
```

### `src/app/login/page.tsx`

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPage, AccountsUnavailable } from "@/components/auth/auth-page";
import { AuthForm } from "@/components/auth/auth-form";
import { accountsConfigured } from "@/lib/supabase/config";
import { getViewer } from "@/features/auth/session";
import { safeReturnTo } from "@/features/auth/validation";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = safeReturnTo(query.next);
  if (await getViewer()) redirect(next);
  return <AuthPage title="Welcome back" description="Pick up your practice, one clear idea at a time.">
    {query.confirmation === "failed" && <p role="alert" className="mt-4 text-sm text-warm">That confirmation link could not be used. It may have expired or opened in a different browser. Try signing in, or request a new signup link.</p>}
    {query.signedOut === "1" && <p role="status" className="mt-4 text-sm text-accent">You have signed out of this browser.</p>}
    {accountsConfigured() ? <AuthForm mode="login" returnTo={next} /> : <AccountsUnavailable />}
  </AuthPage>;
}
```

### `src/app/register/page.tsx`

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPage, AccountsUnavailable } from "@/components/auth/auth-page";
import { AuthForm } from "@/components/auth/auth-form";
import { accountsConfigured } from "@/lib/supabase/config";
import { getViewer } from "@/features/auth/session";

export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function RegisterPage() {
  if (await getViewer()) redirect("/dashboard");
  return <AuthPage title="Make room for progress" description="Create your AlgoSprint account and build a practice habit you can keep.">
    {accountsConfigured() ? <AuthForm mode="register" /> : <AccountsUnavailable />}
  </AuthPage>;
}
```

### `src/app/dashboard/page.tsx`

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { requireViewer } from "@/features/auth/session";
import { AccountFrame } from "@/components/auth/account-frame";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const viewer = await requireViewer();
  return <AccountFrame admin={viewer.role === "ADMIN"}>
    <p className="eyebrow text-accent">Your practice space</p>
    <h1 className="mt-4 text-4xl font-semibold tracking-tight">Welcome, {viewer.displayName || "learner"}.</h1>
    <section className="mt-8 max-w-2xl rounded-2xl border border-line bg-surface p-7">
      <h2 className="text-xl font-semibold">Your account is ready</h2>
      <p className="mt-3 leading-7 text-muted">This is the start of your AlgoSprint workspace. Problem practice and progress insights are being added next.</p>
      <Link href="/profile" className="action-link action-link-secondary mt-6">View your profile</Link>
    </section>
  </AccountFrame>;
}
```

### `src/app/profile/page.tsx`

```tsx
import type { Metadata } from "next";
import { requireViewer } from "@/features/auth/session";
import { AccountFrame } from "@/components/auth/account-frame";

export const metadata: Metadata = { title: "Profile", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function ProfilePage() {
  const viewer = await requireViewer("/profile");
  return <AccountFrame admin={viewer.role === "ADMIN"}>
    <p className="eyebrow text-accent">Your account</p><h1 className="mt-4 text-4xl font-semibold">Profile</h1>
    <dl className="mt-8 grid max-w-2xl gap-6 rounded-2xl border border-line bg-surface p-7 sm:grid-cols-2">
      {[ ["Display name", viewer.displayName || "Learner"], ["Email", viewer.email || "Not available"], ["Time zone", viewer.timeZone], ["Member since", viewer.createdAt.toISOString().slice(0, 10)] ].map(([label, value]) => <div key={label}><dt className="text-sm text-muted">{label}</dt><dd className="mt-2 break-words font-medium">{value}</dd></div>)}
    </dl>
  </AccountFrame>;
}
```

### `src/app/admin/page.tsx`

```tsx
import type { Metadata } from "next";
import { requireAdmin } from "@/features/auth/session";
import { AccountFrame } from "@/components/auth/account-frame";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  await requireAdmin();
  return <AccountFrame admin>
    <p className="eyebrow text-warm">Content administration</p><h1 className="mt-4 text-4xl font-semibold">Admin workspace</h1>
    <p className="mt-6 max-w-2xl leading-7 text-muted">Your administrator access is verified. Problem authoring and content management tools will be added in the admin milestone.</p>
  </AccountFrame>;
}
```

### `src/app/auth/callback/route.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { accountsConfigured, getAppOrigin } from "@/lib/supabase/config";
import { safeReturnTo } from "@/features/auth/validation";

export async function GET(request: NextRequest) {
  if (!accountsConfigured()) return new NextResponse("Accounts are temporarily unavailable.", { status: 503, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  const origin = getAppOrigin();
  const code = request.nextUrl.searchParams.get("code");
  let destination = "/login?confirmation=failed";
  if (code && code.length <= 2048) {
    try {
      const client = await createAuthClient(true);
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) destination = safeReturnTo(request.nextUrl.searchParams.get("next"));
    } catch { /* Show a fixed message without reflecting provider errors or tokens. */ }
  }
  const response = NextResponse.redirect(new URL(destination, origin), 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
```

### `src/app/error.tsx`

```tsx
"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-xl px-5 py-24">
    <h1 className="text-3xl font-semibold">We couldn’t load this page</h1>
    <p className="mt-4 leading-7 text-muted">Please try again in a moment. If the problem continues, come back a little later.</p>
    <div className="mt-7 flex flex-wrap gap-4"><button onClick={reset} className="action-link action-link-primary">Try again</button><Link href="/" className="action-link action-link-secondary">Back to home</Link></div>
  </main>;
}
```

