# Phase 16 — Polish and deployment preparation

## 🟦 What this phase delivers

The application now presents its shipped practice tools on the landing page, has more deliberate mobile form sizing, adds guarded loading states and a root-layout error fallback, and includes release configuration and operational documentation. This is **repository release preparation**, not evidence of a live production deployment. Supabase and Vercel connections are confirmed, but their account tools were not exposed in the session.

Phase 15 is merged in [PR #16](https://github.com/zihadpcode/AlgoSprint/pull/16), commit `4df08339cfb2a95865a193831687be6673324ccd`. Phase 16 is tracked in [PR #17](https://github.com/zihadpcode/AlgoSprint/pull/17). The PR records the exact final tested commit, CI and merge tree, avoiding a self-referential commit ID inside this file.

## 🟩 Design and behavior

The landing page's primary action opens the problem library. Learning paths, progress and interview practice link to implemented routes. Existing original content, layered hints, optional judging and self-assessment semantics are preserved. No artificial usage or outcome statistics are added.

Text can wrap at long tokens. Native controls fit their parent widths. Below 640px, ordinary form text uses 1rem outside Tailwind's layers so a `text-sm` utility cannot override it. Monaco's internal inputs are excluded because it manages its own geometry. The horizontal workspace navigation contains overscroll. These are implementation improvements; actual 320px/390px, zoom and keyboard checks remain required.

Dashboard, mock-interview and interview-result segments have parent viewer guards before their loading boundary; admin already had a role guard. Individual loaders and actions retain authorization. The request-scoped viewer cache avoids repeated user/profile lookups during one server render. There is deliberately no new root loading boundary that would cause early streaming before guest redirects or missing-page status selection.

`global-error.tsx` supplies its own HTML/body because a failing root layout cannot provide them. Recovery uses the installed Next.js 16.3.5 `retry` API, verified in the package's file-convention documentation. Error UIs do not render raw exception details and remind the user to copy unsaved work. Recovery is not autosave and may not preserve an already unmounted form.

The configuration adds `nosniff`, frame denial, a no-referrer policy and camera/microphone/geolocation denial, and removes `X-Powered-By`. The HTTP smoke suite asserts key headers. This is not a claim of a comprehensive security audit; a future CSP must account for Next.js scripts and Monaco workers before enabling it.

## 🟦 Deployment preflight

```bash
npm run deploy:check
npm run deploy:check -- --migrations
```

The script loads production-mode environment files quietly and reports variable names and corrective guidance, never their values. It checks HTTPS root origins, current publishable-key shape, credential-bearing PostgreSQL URLs with exactly one `sslmode=verify-full`, selected TLS bypass settings, suspicious browser-public secret names, enabled runner configuration and Node 24. Migration mode additionally requires `DIRECT_URL`. A runner remains opt-in.

Six tests cover valid configuration, redaction, invalid origins, migration-only settings, unsafe TLS/key/flag values and optional runner configuration. The checker has no network calls or database mutations. It cannot establish project identity, complete secret detection, TLS trust, connectivity, schema readiness, mail delivery, pooling behavior or successful execution. An unconfigured checkout correctly exits nonzero.

`vercel.json` selects Next.js, `npm ci` and `npm run build`. The build generates Prisma but does not migrate or seed a live database. Use a trusted release job for those operations. No schema or dependency changes were introduced by this phase.

## 🟨 Verification and remaining work

[Implementation CI 35461544519](https://github.com/zihadpcode/AlgoSprint/actions/runs/35461544519) passed **176 unit/component/migration tests and 73 PostgreSQL integration tests (249 total)**, plus schema validation, migrations, generated fixture checks, seed validation, lint, type checks, production build, auth HTTP smoke, seeding and library HTTP smoke. Local tests, lint, build and auth smoke also passed. The final documentation commit includes a CSS cascade correction; its final CI evidence is recorded on PR #17 before merging.

A cloud browser attempt to the local server returned `ERR_BLOCKED_BY_CLIENT`. No screenshots, mobile-browser checks, live account delivery, live provider behavior or production deployment are claimed. Do not work around that browser restriction with a hidden tunnel or a different browser runtime.

Complete the remaining release tasks in order:

1. Identify the intended connected Supabase and Vercel projects through available account tools or an authorized dashboard workflow.
2. Configure separate preview/production database, authentication and environment settings; verify migrations and curated seed data.
3. Deploy and verify a preview, including two-account privacy, role checks, saves, interviews and the optional provider flow.
4. Finish browser/mobile/accessibility checks and capture real screens.
5. Build with production configuration, verify the production release and record its actual URL, commit, time and results.

## 🟪 Companion documents

- [Deployment guide](DEPLOYMENT.md): environment table, database/auth setup, Vercel configuration, staged verification and rollback.
- [Screenshot checklist](SCREENSHOTS.md): capture plan, responsive/accessibility checks and evidence log.
- [Portfolio copy](PORTFOLIO.md): description, resume bullets and honest demo narration for implemented features.
- [Session handoff](SESSION-HANDOFF.md): current repository state and unresolved deployment access.

## 🟩 Complete changed source, configuration and tests

The following listings reproduce all 21 changed implementation files in this phase, including existing files in full. Documentation is linked above rather than recursively embedded. Do not copy example credentials into a live environment.

### `.env.example`

```dotenv
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

# Phase 8: server-only Judge0 credentials.
# JUDGE0_API_URL=
# JUDGE0_API_KEY=

# Do not add a Supabase service-role key unless a specific server task needs it.
# Never put database passwords or private API keys behind NEXT_PUBLIC_.

# Phase 8: explicit opt-in. Use an independently operated, maintained Judge0 service.
# CODE_RUNNER_ENABLED=false
# JUDGE0_AUTH_MODE=token
# token uses X-Auth-Token; rapidapi uses X-RapidAPI-Key and the URL host.
# Set the JavaScript (Node.js) ID from YOUR provider's /languages endpoint:
# JUDGE0_JAVASCRIPT_LANGUAGE_ID=
# API URL must be an HTTPS origin, with no path/query/embedded credentials.
# No public/default provider is called unless all settings are supplied.

# Phase 16: run npm run deploy:check before a full account-enabled deployment.
# Use sslmode=verify-full for production database URLs; supply your provider's
# CA trust configuration when required. Never disable certificate verification.
# Preview and production must use separate databases/auth projects.
# Do not run migrations/seeding from Vercel's build command.
# DIRECT_URL is needed only in the trusted migration/seed job, not the web app.
```

### `next.config.ts`

```typescript
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
};
export default nextConfig;
```

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
    "test:smoke": "node scripts/smoke-auth.mjs",
    "problems:generate": "node --import tsx scripts/generate-problems.ts",
    "problems:check": "npm run problems:generate -- --check",
    "deploy:check": "node --import tsx scripts/check-deployment.ts"
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
    "monaco-editor": "0.56.0",
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
    "happy-dom": "20.14.5",
    "prisma": "7.10.0",
    "tailwindcss": "^4",
    "tsx": "4.23.13",
    "typescript": "^5",
    "vitest": "5.0.0"
  }
}
```

### `scripts/check-deployment.ts`

```typescript
import { loadEnvConfig } from "@next/env";
import { parseArgs } from "node:util";
import { deploymentIssues } from "./lib/deployment-config";
try {
  const { values } = parseArgs({ options: { migrations: { type: "boolean", default: false } }, strict: true, allowPositionals: false });
  // Suppress dotenv parser diagnostics: the report prints variable names, never values.
  loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
  const issues = deploymentIssues(process.env, values.migrations);
  if (Number(process.versions.node.split(".")[0]) !== 24) issues.push("Use Node.js 24, matching package.json and .nvmrc.");
  if (issues.length) {
    console.error("Deployment configuration needs attention:"); for (const issue of issues) console.error(`- ${issue}`); process.exitCode = 1;
  } else console.log("Configuration format checks passed. This does not verify connections, migrations, account delivery or provider behavior. Complete the deployment guide's live checks.");
} catch { console.error("Deployment check failed. Use npm run deploy:check -- [--migrations]. No configuration values were printed."); process.exitCode = 1; }
```

### `scripts/lib/deployment-config.ts`

```typescript
// Pure, redacted checks: do not log values, open sockets or mutate databases.
export function deploymentIssues(env: Record<string, string | undefined>, migrations = false): string[] {
  const issues: string[] = [];
  const httpsOrigin = (name: string) => {
    try {
      const u = new URL(env[name] ?? "");
      if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || u.pathname !== "/" || ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)) throw new Error();
    } catch { issues.push(`${name}: set a public HTTPS origin without credentials, path, query or fragment.`); }
  };
  httpsOrigin("APP_URL"); httpsOrigin("NEXT_PUBLIC_SUPABASE_URL");
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "") || (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.length ?? 0) < 25) issues.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: set the project's publishable key, never a secret/service-role key.");
  for (const name of ["DATABASE_URL", ...(migrations ? ["DIRECT_URL"] : [])]) {
    try {
      const u = new URL(env[name] ?? "");
      if (!["postgres:", "postgresql:"].includes(u.protocol) || !u.hostname || !u.username || !u.password || u.pathname.length < 2 || u.searchParams.getAll("sslmode").length !== 1 || u.searchParams.get("sslmode") !== "verify-full") throw new Error();
    } catch { issues.push(`${name}: use a PostgreSQL URL with database credentials and sslmode=verify-full.`); }
  }
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === "0" || env.PGSSLMODE === "disable" || env.PGSSLMODE === "no-verify") issues.push("TLS verification must remain enabled.");
  if (Object.keys(env).some((name) => name.startsWith("NEXT_PUBLIC_") && /SECRET|PASSWORD|TOKEN|DATABASE|PRIVATE|SERVICE_ROLE|API_KEY/.test(name) && env[name])) issues.push("Potential private credential in a NEXT_PUBLIC_ setting: remove it from browser-exposed configuration.");
  if (env.CODE_RUNNER_ENABLED && !["true", "false"].includes(env.CODE_RUNNER_ENABLED)) issues.push("CODE_RUNNER_ENABLED: use exactly true or false.");
  if (env.CODE_RUNNER_ENABLED === "true") {
    httpsOrigin("JUDGE0_API_URL");
    if (!/^[\x21-\x7e]{1,512}$/.test(env.JUDGE0_API_KEY ?? "")) issues.push("JUDGE0_API_KEY: set the private provider key.");
    if (env.JUDGE0_AUTH_MODE && !["token", "rapidapi"].includes(env.JUDGE0_AUTH_MODE)) issues.push("JUDGE0_AUTH_MODE: use token or rapidapi.");
    const id = Number(env.JUDGE0_JAVASCRIPT_LANGUAGE_ID);
    if (!Number.isInteger(id) || id < 1 || id > 10000) issues.push("JUDGE0_JAVASCRIPT_LANGUAGE_ID: use your provider's verified JavaScript language ID.");
  }
  return issues;
}
```

### `scripts/smoke-auth.mjs`

```javascript
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const origin = "http://127.0.0.1:3100";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"], {
  env: { ...process.env, DATABASE_URL: "", DIRECT_URL: "", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", APP_URL: "", NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let diagnostic = "";
const collect = (chunk) => { diagnostic = (diagnostic + chunk.toString()).slice(-5000); };
server.stderr.on("data", collect);
server.stdout.on("data", collect);
try {
  let ready = false;
  let lastFailure = "No response yet";
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Server exited: ${diagnostic}`);
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(2000) });
      if (response.ok) { ready = true; break; }
      lastFailure = `HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`;
    } catch (error) { lastFailure = String(error); }
    await delay(200);
  }
  assert.ok(ready, `Production server must become ready: ${lastFailure}\n${diagnostic}`);
  const home = await fetch(origin);
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");
  assert.equal(home.headers.get("x-frame-options"), "DENY");
  assert.equal(home.headers.get("referrer-policy"), "no-referrer");
  assert.equal(home.headers.get("x-powered-by"), null);
  assert.ok((await home.text()).includes("Explore the problem library"));
  for (const path of ["/mock-interview", "/mock-interview/00000000-0000-4000-8000-000000000000", "/interview-results/00000000-0000-4000-8000-000000000000", "/dashboard", "/progress", "/profile", "/admin", "/admin/problems/new", "/admin/problems/relay-window", "/admin/import", "/admin/roadmaps/scan-store-reuse", "/notes", "/bookmarks", "/review"]) {
    const response = await fetch(origin + path, { redirect: "manual", headers: { cookie: "sb-access-token=forged; role=ADMIN" } });
    assert.equal(response.status, 307, `${path}: ${diagnostic}`);
    assert.ok(response.headers.get("location")?.startsWith("/login?next="), path);
  }
  for (const path of ["/login", "/register"]) {
    const response = await fetch(origin + path); assert.equal(response.status, 200, path);
    assert.ok((await response.text()).includes("Accounts are being prepared"), path);
  }
  for (const path of ["/not-a-real-route", "/ui-check"]) {
    const missing = await fetch(origin + path);
    assert.equal(missing.status, 404, path);
    assert.ok((await missing.text()).includes("This page isn’t available"), path);
  }
  const library = await fetch(origin + "/problems");
  assert.equal(library.status, 200);
  assert.ok((await library.text()).includes("The library is being prepared"));
  const detail = await fetch(origin + "/problems/relay-window");
  assert.equal(detail.status, 200);
  assert.ok((await detail.text()).includes("Practice is being prepared"));
  assert.equal((await fetch(origin + "/problems/INVALID")).status, 404);
  for (const path of ["/roadmaps", "/roadmaps/scan-store-reuse"]) {
    const response = await fetch(origin + path); assert.equal(response.status, 200);
    assert.ok((await response.text()).includes("Roadmaps are being prepared"));
  }
  assert.equal((await fetch(origin + "/roadmaps/INVALID")).status, 404);
  const callback = await fetch(origin + "/auth/callback?code=forged", { redirect: "manual" });
  assert.equal(callback.status, 503); assert.match(callback.headers.get("cache-control") ?? "", /(?:^|,\s*)no-store(?:,|$)/);
  console.log("Production HTTP smoke passed: landing, protected redirects, missing-config forms, custom 404, and callback denial.");
} finally {
  server.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(3000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
```

### `src/app/admin/loading.tsx`

```tsx
import { LoadingState } from "@/components/ui/loading-state";
export default function Loading() {
  return <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8"><LoadingState label="Loading content administration…" /></div>;
}
```

### `src/app/dashboard/layout.tsx`

```tsx
import type { ReactNode } from "react";
import { requireViewer } from "@/features/auth/session";
export default async function Layout({ children }: { children: ReactNode }) {
  await requireViewer("/dashboard");
  return children;
}
```

### `src/app/dashboard/loading.tsx`

```tsx
import { LoadingState } from "@/components/ui/loading-state";
export default function Loading() {
  return <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8"><LoadingState label="Loading your practice overview…" /></div>;
}
```

### `src/app/error.tsx`

```tsx
"use client";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="mx-auto max-w-2xl px-5 py-24"><ErrorState title="We couldn’t load this page" description="Try again in a moment. Copy any unsaved work before reloading. If the problem continues, return to the home page." action={<><Button onClick={retry}>Try again</Button><ButtonLink href="/" variant="secondary">Back to home</ButtonLink></>} /></main>;
}
```

### `src/app/global-error.tsx`

```tsx
"use client";
import Link from "next/link";
// The root layout may be unavailable, so this boundary supplies its own document.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="en"><body style={{ margin: 0, background: "#090d16", color: "#f3f6fc", fontFamily: "system-ui, sans-serif" }}>
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "64px 24px" }}>
      <h1>AlgoSprint couldn’t open this page</h1><p style={{ lineHeight: 1.8 }}>Your connection or the service may be temporarily unavailable. Try again, or return to the home page. Copy any unsaved work before leaving.</p>
      <button onClick={retry} style={{ padding: "12px 20px", font: "inherit", cursor: "pointer" }}>Try again</button>{" "}<Link href="/" style={{ color: "#8ab4ff", padding: 12 }}>Back to home</Link>
    </main>
  </body></html>;
}
```

### `src/app/globals.css`

```css
@import "tailwindcss";

/* Tailwind v4 creates utilities such as bg-canvas from these theme tokens. */
@theme {
  --color-canvas: #090d16;
  --color-surface: #101724;
  --color-surface-raised: #172235;
  --color-line: #2b3a50;
  --color-ink: #f3f6fc;
  --color-muted: #b2bdd0;
  --color-accent: #8ab4ff;
  --color-accent-strong: #bad2ff;
  --color-warm: #f2c879;
  --color-lilac: #c6b6fa;
  --color-success: #82dbb0;
  --color-danger: #ffadb6;
  --font-sans: "Avenir Next", "Segoe UI", Arial, sans-serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}

@layer base {
  html {
    color-scheme: dark;
    scroll-behavior: smooth;
    scroll-padding-top: 2rem;
  }

  body {
    @apply min-h-dvh bg-canvas font-sans text-base text-ink antialiased;
    overflow-wrap: anywhere;
  }

  input, select, textarea {
    min-width: 0;
    max-width: 100%;
  }

  ::selection {
    @apply bg-accent text-canvas;
  }

  :focus-visible {
    outline: 3px solid var(--color-warm);
    outline-offset: 5px;
  }

  /* Respect reduced motion for native scrolling and CSS transitions. */
  @media (prefers-reduced-motion: reduce) {
    html {
      scroll-behavior: auto;
    }

    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
    }
  }
}

/* Outside the layers so text-sm utilities cannot reintroduce mobile focus zoom.
   Monaco manages its own input geometry and typography. */
@media (max-width: 639px) {
  input:not(.monaco-editor *), select, textarea:not(.monaco-editor *) {
    font-size: 1rem;
  }
}

@layer components {
  .eyebrow {
    @apply font-mono text-sm font-medium tracking-[0.12em] uppercase;
  }

  .action-link {
    @apply inline-flex min-h-12 items-center justify-center gap-2 rounded-xl
      border border-transparent px-5 py-3 text-base font-semibold transition-colors;
  }

  .action-link-primary {
    @apply bg-accent text-canvas hover:bg-accent-strong;
  }

  .action-link-secondary {
    @apply border-line bg-surface text-ink hover:border-accent hover:bg-surface-raised;
  }

  .preview-surface {
    background:
      radial-gradient(ellipse at top right, #28457340, transparent 65%),
      var(--color-surface);
    box-shadow: 0 24px 80px #00000040;
  }
}
```

### `src/app/interview-results/layout.tsx`

```tsx
import type { ReactNode } from "react";
import { requireViewer } from "@/features/auth/session";
export default async function Layout({ children }: { children: ReactNode }) {
  await requireViewer("/interview-results");
  return children;
}
```

### `src/app/interview-results/loading.tsx`

```tsx
import { LoadingState } from "@/components/ui/loading-state";
export default function Loading() {
  return <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8"><LoadingState label="Loading your private report…" /></div>;
}
```

### `src/app/mock-interview/layout.tsx`

```tsx
import type { ReactNode } from "react";
import { requireViewer } from "@/features/auth/session";
export default async function Layout({ children }: { children: ReactNode }) {
  await requireViewer("/mock-interview");
  return children;
}
```

### `src/app/mock-interview/loading.tsx`

```tsx
import { LoadingState } from "@/components/ui/loading-state";
export default function Loading() {
  return <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8"><LoadingState label="Loading your interview space…" /></div>;
}
```

### `src/app/page.tsx`

```tsx
import Link from "next/link";
import { ArrowRight, BookOpen, Compass, NotebookPen } from "lucide-react";
import { Container } from "@/components/layout/container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { PracticePreview } from "@/components/landing/practice-preview";
import { PRACTICE_FEATURES, PRACTICE_STEPS } from "@/lib/constants";

const FEATURE_ICONS = {
  collection: BookOpen,
  progress: NotebookPen,
  preparation: Compass,
} as const;

export default function HomePage() {
  return (
    <>
      <a href="#main-content" className="sr-only z-50 rounded-lg bg-warm p-4 font-semibold text-canvas focus:fixed focus:top-4 focus:left-4 focus:not-sr-only">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <Container className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-24">
          <div className="min-w-0">
            <p className="eyebrow text-accent">Coding practice, with purpose</p>
            <h1 className="mt-6 text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.1] font-bold tracking-[-0.045em]">
              Think it through.
              <span className="mt-1 block text-accent">Then make it run.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
              Practice original coding challenges, uncover one hint at a time,
              and explain your approach. Keep the lessons in your own notes
              and build a practice habit that lasts.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/problems" className="action-link action-link-primary">
                Explore the problem library
                <ArrowRight aria-hidden="true" size={19} />
              </Link>
              <Link href="/roadmaps" className="action-link action-link-secondary">Follow a learning path</Link>
            </div>
            <p className="mt-5 text-sm leading-6 text-muted">
              Browse problems and roadmaps without an account. Sign in to save your progress and practice interviews.
            </p>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-line/70 pt-6 font-mono text-sm text-muted">
              <span>Understand the pattern</span>
              <span className="text-warm">Explain the tradeoff</span>
            </div>
          </div>
          <PracticePreview />
        </Container>
        <section id="approach" aria-labelledby="approach-title" className="border-y border-line/70 bg-surface/50 py-16 sm:py-20">
          <Container>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="eyebrow text-warm">The practice loop</p>
                <h2 id="approach-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Make every attempt teach you something.
                </h2>
              </div>
              <p className="max-w-sm leading-7 text-muted">
                A repeatable way to approach a problem, even when you do not know where to start.
              </p>
            </div>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {PRACTICE_STEPS.map((step) => (
                <li key={step.number} className="rounded-2xl border border-line bg-canvas/60 p-6 transition-colors hover:border-accent/60">
                  <span className="font-mono text-sm text-warm">{step.number}</span>
                  <h3 className="mt-5 text-xl leading-7 font-semibold">{step.title}</h3>
                  <p className="mt-3 leading-7 text-muted">{step.description}</p>
                </li>
              ))}
            </ol>
          </Container>
        </section>
        <section id="path-ahead" aria-labelledby="future-title" className="py-16 sm:py-20">
          <Container>
            <p className="eyebrow text-lilac">Your practice space</p>
            <h2 id="future-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              A clearer next step, every session.
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-muted">
              Move from understanding a problem to explaining a solution.
              Start with the original collection, then revisit what challenged you.
            </p>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {PRACTICE_FEATURES.map((feature) => {
                const Icon = FEATURE_ICONS[feature.id];
                return (
                  <article key={feature.id} className="border-t border-line pt-6">
                    <Icon aria-hidden="true" size={25} className="text-lilac" />
                    <h3 className="mt-4 text-xl font-semibold">{feature.title}</h3>
                    <p className="mt-3 leading-7 text-muted">{feature.description}</p>
                    <Link href={feature.href} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">{feature.label}<ArrowRight aria-hidden="true" size={16} className="ml-2" /></Link>
                  </article>
                );
              })}
            </div>
            <a href="#practice-preview" className="mt-10 inline-flex min-h-11 items-center gap-2 rounded-md font-medium text-accent hover:text-accent-strong">
              Back to the practice example
              <ArrowRight aria-hidden="true" size={18} />
            </a>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
```

### `src/components/layout/workspace-nav.tsx`

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UserRound, ShieldCheck, BookOpen, Route } from "lucide-react";
import { cn } from "@/lib/utils";
const links = [ { href: "/mock-interview", label: "Mock interviews", icon: BookOpen }, { href: "/roadmaps", label: "Roadmaps", icon: Route }, { href: "/problems", label: "Problems", icon: BookOpen }, { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, { href: "/progress", label: "Progress", icon: BookOpen }, { href: "/notes", label: "Notes", icon: BookOpen }, { href: "/bookmarks", label: "Bookmarks", icon: BookOpen }, { href: "/review", label: "Review later", icon: BookOpen }, { href: "/profile", label: "Profile", icon: UserRound } ];
export function WorkspaceNav({ admin = false }: { admin?: boolean }) {
  const pathname = usePathname();
  const items = admin ? [...links, { href: "/admin", label: "Admin", icon: ShieldCheck }] : links;
  return <nav aria-label="Workspace navigation"><ul className="flex gap-2 overflow-x-auto overscroll-x-contain p-2 lg:flex-col">
    {items.map(({ href, label, icon: Icon }) => {
      const active = pathname === href || pathname.startsWith(`${href}/`);
      return <li key={href} className="shrink-0"><Link href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors", active ? "border-accent/25 bg-accent/10 text-accent" : "border-transparent text-muted hover:bg-surface-raised hover:text-ink")}><Icon aria-hidden="true" size={18} />{label}</Link></li>;
    })}
  </ul></nav>;
}
```

### `src/lib/constants.ts`

```typescript
// Public display content only. Never import secrets into this module.
export const APP_CONFIG = {
  name: "AlgoSprint",
  tagline: "Practice with purpose",
  description:
    "Original coding challenges, guided solutions, learning roadmaps and timed interview practice. Build the reasoning behind every solution.",
} as const;

// These links point to real sections on the current landing page.
export const LANDING_NAV = [
  { label: "The approach", href: "#approach" },
  { label: "Practice preview", href: "#practice-preview" },
  { label: "Practice tools", href: "#path-ahead" },
] as const;

export const PRACTICE_STEPS = [
  {
    number: "01",
    title: "Find the question inside the question.",
    description:
      "Start with the inputs, the constraints, and a small example. Understand what a correct answer needs to do.",
  },
  {
    number: "02",
    title: "Build an approach you can explain.",
    description:
      "Write down a first solution. Trace it by hand, spot repeated work, and look for a pattern that makes it simpler.",
  },
  {
    number: "03",
    title: "Carry the lesson forward.",
    description:
      "Check edge cases, explain the tradeoffs, and revisit what challenged you. Make the next unfamiliar problem feel more familiar.",
  },
] as const;

export const PRACTICE_FEATURES = [
  {
    id: "collection",
    title: "An original problem collection",
    description:
      "Explore five original challenges with examples, layered hints, and guided solutions. Keep your own notes as you learn.",
    label: "Explore problems", href: "/problems",
  },
  {
    id: "progress",
    title: "A record of how you learn",
    description:
      "Keep notes, revisit tricky questions, and see which topics deserve another practice session.",
    label: "View your progress", href: "/progress",
  },
  {
    id: "preparation",
    title: "Preparation with direction",
    description:
      "Follow original learning paths and put your reasoning into words in timed, private interview practice.",
    label: "Start interview practice", href: "/mock-interview",
  },
] as const;
```

### `tests/deployment-config.test.ts`

```typescript
import { describe, expect, it } from "vitest";
import { deploymentIssues } from "../scripts/lib/deployment-config";
const valid = { APP_URL: "https://algosprint.example", NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_exampleonly012345", DATABASE_URL: "postgresql://user:private-password@db.example:5432/postgres?sslmode=verify-full" };
describe("redacted deployment readiness checks", () => {
  it("accepts account configuration without enabling a runner or requiring migration credentials", () => { expect(deploymentIssues({ ...valid, NEXT_PUBLIC_VERCEL_URL: "preview.vercel.app" })).toEqual([]); });
  it("reports missing settings without logging credential values", () => {
    expect(deploymentIssues({})).toHaveLength(4);
    const errors = deploymentIssues({ ...valid, DATABASE_URL: "postgresql://user:private-password@db.example/db?sslmode=disable", NEXT_PUBLIC_PRIVATE_KEY: "secret-value" });
    expect(errors.join(" ")).toContain("DATABASE_URL"); expect(errors.join(" ")).not.toMatch(/private-password|secret-value|db.example/);
  });
  it("rejects local, insecure and credential-bearing origins", () => {
    for (const APP_URL of ["http://site.example", "https://localhost", "https://user:pass@site.example", "https://site.example/path", "https://site.example?token=secret"]) expect(deploymentIssues({ ...valid, APP_URL })).not.toEqual([]);
  });
  it("requires private migration settings only in migration mode", () => {
    expect(deploymentIssues(valid, true).join()).toContain("DIRECT_URL");
    expect(deploymentIssues({ ...valid, DIRECT_URL: valid.DATABASE_URL }, true)).toEqual([]);
  });
  it("rejects disabled TLS, private browser keys and unrecognized runner flags", () => {
    expect(deploymentIssues({ ...valid, DATABASE_URL: valid.DATABASE_URL + "&sslmode=disable" }).join()).toContain("DATABASE_URL");
    expect(deploymentIssues({ ...valid, NODE_TLS_REJECT_UNAUTHORIZED: "0" }).join()).toContain("TLS");
    expect(deploymentIssues({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_private" }).join()).toContain("publishable");
    expect(deploymentIssues({ ...valid, CODE_RUNNER_ENABLED: "TRUE" }).join()).toContain("exactly");
  });
  it("checks enabled runner configuration without contacting any provider", () => {
    expect(deploymentIssues({ ...valid, CODE_RUNNER_ENABLED: "true" }).length).toBeGreaterThan(0);
    expect(deploymentIssues({ ...valid, CODE_RUNNER_ENABLED: "true", JUDGE0_API_URL: "https://runner.example", JUDGE0_API_KEY: "private-runner-key", JUDGE0_JAVASCRIPT_LANGUAGE_ID: "102", JUDGE0_AUTH_MODE: "token" })).toEqual([]);
  });
});
```

### `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "installCommand": "npm ci",
  "buildCommand": "npm run build"
}
```

