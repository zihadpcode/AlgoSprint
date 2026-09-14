# Phase 5 — Published problem library

## 🟦 What this checkpoint adds

A real PostgreSQL-backed `/problems` page, available to guests, with URL-based search and filters. It uses the Phase 4 shell and components. Phase 5 adds no package dependencies or schema migration. It reads the five reviewed seed problems already created in Phase 2.

The code is published in PR #6. The implementation passed [CI run 34872547083](https://github.com/zihadpcode/AlgoSprint/actions/runs/34872547083) at commit bc463d95299ca119e3f52c47e8615fa0f5f2a452: 45 unit/migration tests, nine PostgreSQL integration tests, schema/seed validation, lint, types, build, and both production HTTP checks. The final queued-search/clear-button follow-up is gated on CI; PR #6 records its final result. The coding environment is unavailable; this session uses GitHub CI, not local command results. Browser and live Supabase validation remain unperformed.

## 🟦 Run on your Mac

Use Node.js 24. From a fresh clone of the repository (or the Phase 5 branch while its PR is open):

```bash
git clone https://github.com/zihadpcode/AlgoSprint.git
cd AlgoSprint
git switch algosprint/phase-5-library
npm ci
cp .env.example .env.local
```

For an existing checkout, fetch the branch and preserve local changes and your configured environment file. Do not overwrite an existing .env.local. Set DATABASE_URL to your development PostgreSQL database as described in the Phase 2 guide. DIRECT_URL can supply a migration connection. Then run:

```bash
npm run db:deploy
npm run db:seed
npm run dev
```

Open http://localhost:3000/problems. Stop the server with Control-C. Seeding is repeatable and conflict-aware; this phase does not change the seed files.

Public browsing only needs PostgreSQL. To view personal indicators, complete the confirmed-email Supabase setup in PHASE-3-GUIDE.md. A database alone does not fabricate an account. Without PostgreSQL configuration, the library displays an unavailable state.

## 🟨 How a request travels

1. A GET form or pagination link changes the URL. For example: `/problems?q=relay&difficulty=EASY&maxMinutes=30`.
2. The Next.js Server Component awaits searchParams. `parseLibraryFilters` validates each scalar independently, rejects duplicates/malformed values to safe defaults, and bounds query length, time, and page.
3. `loadLibrary` verifies identity through the existing auth layer. A supplied userId or role is ignored. Personal filters require a verified viewer; guests receive a sign-in link preserving the safe destination.
4. `queryLibrary` fixes publication status to PUBLISHED, combines the selected conditions, and sorts with a slug tie breaker. A repeatable-read transaction gives count, rows, facets, and progress one consistent snapshot.
5. Prisma selects only fields needed for the library. A final DTO mapping removes internal IDs. The page renders cards and a small result announcement. Client filter controls receive only filter/facet values, not records from hidden tables.
6. Pagination preserves the validated filters and shows 12 items per page. An excessive valid page redirects to the last available page. Zero results render an empty state rather than an invalid negative range.

`status=DRAFT` never opens editorial content. Publication status is fixed for this public page. Completion (not started/attempted/solved) and review-later are independent personal filters. A missing progress row counts as not started for that user. Another user's progress cannot change these results. Self-marked solved records display that qualification.

## 🟨 Search and navigation decisions

Title search is case-insensitive substring matching. PostgreSQL LIKE wildcard characters are escaped so a typed percent sign or underscore is literal. At the intended initial collection size (five growing toward 1,000 problems), a bounded substring scan is a reasonable first implementation. Larger collections should measure query plans and consider search-specific indexes; this phase makes no large-scale performance claim.

Category/tag/pattern options come from published records, so draft-only taxonomy does not leak through filters. All selected filters combine with AND. Each sort uses slug as a unique secondary key, avoiding duplicate or skipped rows when primary values match. Offset pagination provides familiar page numbers; future high-volume frequently changing collections may need cursor pagination.

The Next.js Form component provides GET behavior and client navigation while preserving the no-JavaScript submit path. Inputs submit after a 350ms pause. Composition events defer submission until IME input completes; Enter and Apply filters submit immediately. Timers are cleared on submission, history changes, normal library link clicks, clearing, and unmount. Clearing also resets an unsubmitted draft immediately. Incoming results preserve a newer local draft. Popstate restores controls from the URL. Search updates replace the current history entry; pagination links create entries normally. Scroll stays stable during filtering.

The form uses native labeled inputs/selects and the existing pending submit control. Results announce a short count. Cards display difficulty, time, categories, tags, pattern, and permitted status badges. The headings are intentionally not dead links: statement/hint/solution pages belong to Phase 6.

## 🟩 Files and responsibilities

| File | Responsibility |
| --- | --- |
| src/features/problems/filters.ts | URL validation, limits, safe pagination URLs, literal search escaping |
| src/features/problems/query.ts | Server-only published queries, owned progress, consistent snapshot, public DTO |
| src/features/problems/load.ts | Verified identity/configuration boundary and sign-in state |
| src/app/problems/page.tsx | Server-rendered library, range/empty states, canonical pagination |
| src/components/problems/library-filters.tsx | GET form, debouncing, composition, history restoration |
| src/components/problems/problem-card.tsx | Public summary/status display |
| tests/library-*.test.ts | URL and identity boundary regressions |
| tests/integration/library.test.ts | Real PostgreSQL publication, filtering, ownership, pagination |
| scripts/smoke-library.mjs | Seeded production HTTP checks using a disposable test database |

Navigation and landing copy now point to the implemented collection. Server errors use the existing fixed-message retry boundary. No root loading boundary was added around protected routes.

## 🟩 Verification

```bash
npm run db:validate
npm run seed:validate
npm test
npm run lint
npm run typecheck
npm run build
npm run test:smoke
```

CI supplies a disposable PostgreSQL 17 service for integration. To reproduce integration independently, provide TEST_DATABASE_URL and DATABASE_URL for an empty dedicated database ending in _test, apply the migrations there, then run `npm run test:integration`. Never point test setup or fixtures at a valuable database.

The integration suites clean up owned users/problems and private taxonomy fixtures. Afterwards, CI reseeds its disposable database and runs `node scripts/smoke-library.mjs` against the built production app. This checks seeded titles, search/empty states, personal-filter gating, privacy headers, and out-of-range redirects. The script guards the test database name and owns/stops its server. The existing auth smoke additionally checks the unconfigured library state.

New unit tests target malicious/malformed URLs and the verified identity boundary. PostgreSQL tests cover draft/archive/facet exclusion, explicit output keys, combined filters, literal wildcard input, cross-user progress isolation, sorting, and more than one page of equal-valued fixtures.

### Browser checklist still required

1. At 320px, tablet, and desktop widths, check card layout, long filter labels, navigation overflow, and 200% zoom.
2. Tab through every labeled field and button. Confirm focus remains visible and the result count is announced without reading every card.
3. Type quickly, pause, edit again while a response is pending, clear, press Enter, and use an IME. The newest input should win without lost focus or duplicate submits.
4. Apply combined filters, paginate, copy/reopen the URL, then use Back/Forward. Controls, count, page, and results should agree.
5. Disable JavaScript and submit filters through Apply filters. Standard GET navigation should work.
6. With two verified development accounts and different progress fixtures, verify each account sees only its own badges and filters. Guests must receive a sign-in prompt for personal filters.
7. Confirm no card links to a missing detail page, unavailable setup does not pretend the database is empty, and errors reveal no raw connection details.

No browser pass is claimed. Live provider flows still require the Phase 3 checklist.

## 🟪 Next milestone

Phase 6 will add original statements, visible examples, constraints, layered hints, solutions, and related-problem navigation. Keep hidden tests and runner payloads server-only. Progress mutations, the editor, and execution remain in their assigned phases.

## 🟩 Complete authored source

These are the complete files introduced or changed for Phase 5, excluding this guide and the general status documents. Current repository source remains authoritative after later edits.

### `.github/workflows/ci.yml`

````yaml
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
      - run: npm run db:seed
      - run: node scripts/smoke-library.mjs
````

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
  for (const path of ["/dashboard", "/profile", "/admin"]) {
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
  const callback = await fetch(origin + "/auth/callback?code=forged", { redirect: "manual" });
  assert.equal(callback.status, 503); assert.match(callback.headers.get("cache-control") ?? "", /(?:^|,\s*)no-store(?:,|$)/);
  console.log("Production HTTP smoke passed: landing, protected redirects, missing-config forms, custom 404, and callback denial.");
} finally {
  server.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(3000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
````

### `scripts/smoke-library.mjs`

````javascript
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test")) throw new Error("Use a seeded, dedicated TEST_DATABASE_URL ending in _test.");
const origin = "http://127.0.0.1:3101";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3101"], {
  env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: "", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", APP_URL: "", NEXT_TELEMETRY_DISABLED: "1" },
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
  const library = await fetch(origin + "/problems", { headers: { cookie: "role=ADMIN; sb-access-token=forged" } });
  assert.equal(library.status, 200);
  assert.match(library.headers.get("cache-control") ?? "", /no-store/);
  const html = await library.text();
  for (const title of ["Relay Window", "Quiet Badge", "Parcel Checkpoints", "Dock Threshold", "Lantern Steps"]) assert.ok(html.includes(title), title);
  for (const privateField of ["seedHash", "testCases", "starterCode"]) assert.ok(!html.includes(privateField), privateField);
  const search = await fetch(origin + "/problems?q=RELAY");
  const searchHtml = await search.text();
  assert.equal(search.status, 200);
  assert.ok(searchHtml.includes("Relay Window"));
  assert.ok(!searchHtml.includes("Dock Threshold"));
  const empty = await fetch(origin + "/problems?q=no-such-title-ever");
  assert.ok((await empty.text()).includes("No matches yet"));
  const personal = await fetch(origin + "/problems?completion=SOLVED&userId=forged");
  assert.equal(personal.status, 200);
  const personalHtml = await personal.text();
  assert.ok(personalHtml.includes("Sign in to filter your progress"));
  assert.ok(!personalHtml.includes("Relay Window"));
  const page = await fetch(origin + "/problems?page=999", { redirect: "manual" });
  assert.equal(page.status, 307);
  assert.equal(page.headers.get("location"), "/problems");
  console.log("Library HTTP smoke passed: seeded public cards, search, empty results, personal-filter gate, privacy headers, and bounded pagination.");
} finally {
  server.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(3000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
````

### `src/app/problems/page.tsx`

````tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { LibraryFiltersForm } from "@/components/problems/library-filters";
import { ProblemCard } from "@/components/problems/problem-card";
import { loadLibrary } from "@/features/problems/load";
import { libraryHref, type SearchParams } from "@/features/problems/filters";

export const metadata: Metadata = { title: "Problem library", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ProblemsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const view = await loadLibrary(await searchParams);
  if (view.kind === "ready" && view.result.page !== view.filters.page) {
    redirect(libraryHref({ ...view.filters, page: view.result.page }));
  }
  return (
    <AppShell signedIn={view.signedIn} admin={view.admin}>
      <PageHeading eyebrow="Choose your next challenge" title="Problem library"
        description="Find an original problem that fits your time and the pattern you want to practice." />
      {view.kind === "unavailable" ? (
        <EmptyState title="The library is being prepared" description="Published problems will appear here when the collection is available. Please check back later." />
      ) : view.kind === "sign-in" ? (
        <EmptyState title="Sign in to filter your progress" description="Completion and review filters belong to your account."
          action={<div className="flex flex-wrap justify-center gap-3"><ButtonLink href={"/login?next=" + encodeURIComponent(libraryHref(view.filters))}>Sign in</ButtonLink><ButtonLink href="/problems" variant="secondary">Browse all problems</ButtonLink></div>} />
      ) : (
        <>
          <LibraryFiltersForm filters={view.filters} facets={view.result.facets} signedIn={view.signedIn} />
          <p role="status" aria-live="polite" aria-atomic="true" className="mb-5 text-sm text-muted">
            {view.result.total === 0 ? "No matching problems" : "Showing " + ((view.result.page - 1) * view.result.pageSize + 1) + "–" + Math.min(view.result.page * view.result.pageSize, view.result.total) + " of " + view.result.total + " published problems"}
          </p>
          {view.result.items.length ? (
            <ul aria-label="Problems" className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {view.result.items.map((problem) => <li key={problem.slug} className="min-w-0"><ProblemCard problem={problem} /></li>)}
            </ul>
          ) : (
            <EmptyState title="No matches yet" description="Try a shorter search or clear some filters."
              action={<ButtonLink href="/problems" variant="secondary">Clear filters</ButtonLink>} />
          )}
          {view.result.total > 0 && <nav aria-label="Problem pages" className="mt-8 flex flex-wrap items-center justify-between gap-4">
            {view.result.page > 1 ? <ButtonLink variant="secondary" href={libraryHref({ ...view.filters, page: view.result.page - 1 })}>Previous page</ButtonLink> : <span aria-disabled="true" className="text-sm text-muted">Previous page</span>}
            <p className="text-sm text-muted">Page {view.result.page} of {view.result.pages}</p>
            {view.result.page < view.result.pages ? <ButtonLink variant="secondary" href={libraryHref({ ...view.filters, page: view.result.page + 1 })}>Next page</ButtonLink> : <span aria-disabled="true" className="text-sm text-muted">Next page</span>}
          </nav>}
          <p className="mt-8 text-sm leading-7 text-muted">Browse the collection now. Problem pages and practice tools are coming next.</p>
        </>
      )}
    </AppShell>
  );
}
````

### `src/components/layout/site-header.tsx`

````tsx
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
          <Link href="/problems" className="inline-flex min-h-11 items-center rounded-md text-sm text-accent hover:text-ink">Problems</Link>
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
````

### `src/components/layout/workspace-nav.tsx`

````tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UserRound, ShieldCheck, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
const links = [ { href: "/problems", label: "Problems", icon: BookOpen }, { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, { href: "/profile", label: "Profile", icon: UserRound } ];
export function WorkspaceNav({ admin = false }: { admin?: boolean }) {
  const pathname = usePathname();
  const items = admin ? [...links, { href: "/admin", label: "Admin", icon: ShieldCheck }] : links;
  return <nav aria-label="Workspace navigation"><ul className="flex gap-2 overflow-x-auto p-2 lg:flex-col">
    {items.map(({ href, label, icon: Icon }) => {
      const active = pathname === href || pathname.startsWith(`${href}/`);
      return <li key={href} className="shrink-0"><Link href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors", active ? "border-accent/25 bg-accent/10 text-accent" : "border-transparent text-muted hover:bg-surface-raised hover:text-ink")}><Icon aria-hidden="true" size={18} />{label}</Link></li>;
    })}
  </ul></nav>;
}
````

### `src/components/problems/library-filters.tsx`

````tsx
"use client";

import Form from "next/form";
import { useEffect, useRef } from "react";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { ButtonLink } from "@/components/ui/button";
import { DIFFICULTIES, libraryHref, parseLibraryFilters, type LibraryFilters } from "@/features/problems/filters";
import type { LibraryResult } from "@/features/problems/query";

function values(filters: LibraryFilters) {
  return {
    q: filters.q, difficulty: filters.difficulty, category: filters.category,
    tag: filters.tag, pattern: filters.pattern, sort: filters.sort,
    maxMinutes: filters.maxMinutes ? String(filters.maxMinutes) : "",
    completion: filters.completion, review: filters.review ? "1" : "",
  };
}
function syncForm(form: HTMLFormElement, filters: LibraryFilters) {
  for (const [name, value] of Object.entries(values(filters))) {
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) field.value = value;
  }
}
function fingerprint(form: HTMLFormElement) {
  return JSON.stringify(Array.from(new FormData(form).entries()));
}

export function LibraryFiltersForm({ filters, facets, signedIn }: {
  filters: LibraryFilters; facets: LibraryResult["facets"]; signedIn: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const submitted = useRef<string | null>(null);
  const composing = useRef(false);
  const cancel = () => { clearTimeout(timer.current); timer.current = undefined; };

  useEffect(() => {
    // Preserve typing that happened after submission while its response was pending.
    if (!form.current || timer.current !== undefined) return;
    if (submitted.current && submitted.current !== fingerprint(form.current)) return;
    syncForm(form.current, filters);
    submitted.current = null;
  }, [filters]);

  useEffect(() => {
    const restore = () => {
      clearTimeout(timer.current);
      timer.current = undefined;
      submitted.current = null;
      if (form.current) {
        syncForm(form.current, parseLibraryFilters(Object.fromEntries(new URLSearchParams(window.location.search))));
      }
    };
    const cancelForLink = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin === window.location.origin && target.pathname === "/problems") {
        clearTimeout(timer.current);
        timer.current = undefined;
        submitted.current = null;
      }
    };
    window.addEventListener("popstate", restore);
    window.addEventListener("click", cancelForLink, true);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener("popstate", restore);
      window.removeEventListener("click", cancelForLink, true);
    };
  }, []);

  function schedule() {
    cancel();
    if (composing.current) return;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      form.current?.requestSubmit();
    }, 350);
  }

  const current = values(filters);
  const facetOptions = (options: { slug: string; name: string }[], selected: string) => (
    <>
      <option value="">All</option>
      {selected && !options.some((option) => option.slug === selected) && <option value={selected}>{selected} (no published matches)</option>}
      {options.map((option) => <option key={option.slug} value={option.slug}>{option.name}</option>)}
    </>
  );
  return (
    <Form ref={form} action="/problems" replace scroll={false} prefetch={false}
      className="mb-8 space-y-5 rounded-2xl border border-line bg-surface p-5 sm:p-7"
      aria-label="Filter problems"
      onChange={schedule}
      onCompositionStart={() => { composing.current = true; cancel(); }}
      onCompositionEnd={() => { composing.current = false; schedule(); }}
      onSubmit={() => { cancel(); if (form.current) submitted.current = fingerprint(form.current); }}>
      <div>
        <label htmlFor="library-q" className="mb-2 block text-sm font-medium">Search by title</label>
        <Input id="library-q" name="q" type="search" maxLength={100} defaultValue={current.q}
          placeholder="Try Relay Window" aria-describedby="search-help" />
        <p id="search-help" className="mt-2 text-xs leading-6 text-muted">Results update after a short pause. You can also press Enter or Apply filters.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 text-sm"><span className="block">Difficulty</span><Select name="difficulty" defaultValue={current.difficulty}><option value="">All levels</option>{DIFFICULTIES.map((value) => <option key={value} value={value}>{value[0] + value.slice(1).toLowerCase()}</option>)}</Select></label>
        <label className="space-y-2 text-sm"><span className="block">Category</span><Select name="category" defaultValue={current.category}>{facetOptions(facets.categories, current.category)}</Select></label>
        <label className="space-y-2 text-sm"><span className="block">Tag</span><Select name="tag" defaultValue={current.tag}>{facetOptions(facets.tags, current.tag)}</Select></label>
        <label className="space-y-2 text-sm"><span className="block">Pattern</span><Select name="pattern" defaultValue={current.pattern}>{facetOptions(facets.patterns.map((pattern) => ({ slug: pattern, name: pattern.replaceAll("-", " ") })), current.pattern)}</Select></label>
        <label className="space-y-2 text-sm"><span className="block">Maximum time</span><Select name="maxMinutes" defaultValue={current.maxMinutes}><option value="">Any duration</option>{[...new Set([15, 30, 45, 60, 120, 240, ...(filters.maxMinutes ? [filters.maxMinutes] : [])])].sort((a, b) => a - b).map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</Select></label>
        <label className="space-y-2 text-sm"><span className="block">Completion</span><Select name="completion" defaultValue={current.completion} disabled={!signedIn}><option value="ALL">All problems</option><option value="NOT_STARTED">Not started</option><option value="ATTEMPTED">Attempted</option><option value="SOLVED">Solved</option></Select></label>
        <label className="space-y-2 text-sm"><span className="block">Review status</span><Select name="review" defaultValue={current.review} disabled={!signedIn}><option value="">Any review status</option><option value="1">Review later</option></Select></label>
        <label className="space-y-2 text-sm"><span className="block">Sort by</span><Select name="sort" defaultValue={current.sort}><option value="title">Title A–Z</option><option value="newest">Newest published</option><option value="difficulty">Difficulty: easy first</option><option value="time">Shortest time</option></Select></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Searching…">Apply filters</SubmitButton>
        <ButtonLink href="/problems" variant="quiet" onClick={() => { cancel(); submitted.current = null; if (form.current) syncForm(form.current, parseLibraryFilters({})); }}>Clear filters</ButtonLink>
        {!signedIn && <ButtonLink variant="quiet" href={"/login?next=" + encodeURIComponent(libraryHref(filters))}>Sign in for progress</ButtonLink>}
      </div>
    </Form>
  );
}
````

### `src/components/problems/problem-card.tsx`

````tsx
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LibraryResult } from "@/features/problems/query";

const statusLabels = { NOT_STARTED: "Not started", ATTEMPTED: "Attempted", SOLVED: "Solved" };
export function ProblemCard({ problem }: { problem: LibraryResult["items"][number] }) {
  return (
    <Card className="h-full">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={problem.difficulty === "HARD" ? "warm" : "accent"}>
          {problem.difficulty[0] + problem.difficulty.slice(1).toLowerCase()}
        </Badge>
        <span className="text-xs text-muted">{problem.estimatedMinutes} min</span>
      </div>
      <h2 className="mt-5 text-xl font-semibold [overflow-wrap:anywhere]">{problem.title}</h2>
      <p className="mt-3 text-sm text-muted">Pattern: {problem.pattern.replaceAll("-", " ")}</p>
      <div className="mt-5 flex flex-wrap gap-2" aria-label="Categories">
        {problem.categories.map((category) => <Badge key={category.slug}>{category.name}</Badge>)}
      </div>
      <p className="mt-3 text-xs leading-6 text-muted">Tags: {problem.tags.map((tag) => tag.name).join(", ") || "None"}</p>
      {problem.progress && <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
        <Badge tone={problem.progress.status === "SOLVED" ? "success" : "neutral"}>
          {statusLabels[problem.progress.status]}{problem.progress.status === "SOLVED" && problem.progress.selfMarked ? " · self-marked" : ""}
        </Badge>
        {problem.progress.reviewLater && <Badge tone="warm">Review later</Badge>}
      </div>}
    </Card>
  );
}
````

### `src/features/problems/filters.ts`

````typescript
import { z } from "zod";

export const PAGE_SIZE = 12;
export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export const SORTS = ["title", "newest", "difficulty", "time"] as const;
export const COMPLETIONS = ["ALL", "NOT_STARTED", "ATTEMPTED", "SOLVED"] as const;
export type SearchParams = Record<string, string | string[] | undefined>;

const slug = z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).catch("");
const scalar = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;
const positive = (max: number, fallback: number) =>
  z.string().regex(/^[1-9]\d{0,5}$/).transform(Number).pipe(z.number().int().max(max)).catch(fallback);

export function parseLibraryFilters(params: SearchParams) {
  return {
    q: z.string().trim().max(100).catch("").parse(scalar(params.q)),
    difficulty: z.enum(["", ...DIFFICULTIES]).catch("").parse(scalar(params.difficulty)),
    category: slug.parse(scalar(params.category)),
    tag: slug.parse(scalar(params.tag)),
    pattern: slug.parse(scalar(params.pattern)),
    maxMinutes: positive(240, 0).parse(scalar(params.maxMinutes)),
    completion: z.enum(COMPLETIONS).catch("ALL").parse(scalar(params.completion)),
    review: scalar(params.review) === "1",
    sort: z.enum(SORTS).catch("title").parse(scalar(params.sort)),
    page: positive(10_000, 1).parse(scalar(params.page)),
  };
}
export type LibraryFilters = ReturnType<typeof parseLibraryFilters>;

export function needsPersonalProgress(filters: LibraryFilters) {
  return filters.completion !== "ALL" || filters.review;
}

// Explicit keys prevent unknown URL fields (including userId) from propagating.
export function libraryHref(filters: LibraryFilters) {
  const params = new URLSearchParams();
  for (const key of ["q", "difficulty", "category", "tag", "pattern"] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  if (filters.maxMinutes) params.set("maxMinutes", String(filters.maxMinutes));
  if (filters.completion !== "ALL") params.set("completion", filters.completion);
  if (filters.review) params.set("review", "1");
  if (filters.sort !== "title") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  return "/problems" + (params.size ? "?" + params.toString() : "");
}

// Prisma's PostgreSQL contains filter uses LIKE syntax; search punctuation literally.
export function literalSearch(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
````

### `src/features/problems/load.ts`

````typescript
import "server-only";
import { getViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { needsPersonalProgress, parseLibraryFilters, type SearchParams } from "./filters";
import { queryLibrary } from "./query";

export async function loadLibrary(params: SearchParams) {
  const filters = parseLibraryFilters(params);
  if (!process.env.DATABASE_URL) {
    return { kind: "unavailable" as const, filters, signedIn: false, admin: false };
  }
  // Identity comes only from a fresh provider verification, never URL parameters.
  const viewer = await getViewer();
  const account = { signedIn: Boolean(viewer), admin: viewer?.role === "ADMIN" };
  if (!viewer && needsPersonalProgress(filters)) {
    return { kind: "sign-in" as const, filters, ...account };
  }
  const result = await queryLibrary(getDatabase(), filters, viewer?.id ?? null);
  return { kind: "ready" as const, filters, result, ...account };
}
````

### `src/features/problems/query.ts`

````typescript
import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { PAGE_SIZE, literalSearch, needsPersonalProgress, type LibraryFilters } from "./filters";

const publicSelect = {
  id: true, slug: true, title: true, difficulty: true, pattern: true, estimatedMinutes: true,
  categories: {
    select: { category: { select: { slug: true, name: true } } },
    orderBy: { category: { name: "asc" } },
  },
  tags: {
    select: { tag: { select: { slug: true, name: true } } },
    orderBy: { tag: { name: "asc" } },
  },
} satisfies Prisma.ProblemSelect;

function orderBy(sort: LibraryFilters["sort"]): Prisma.ProblemOrderByWithRelationInput[] {
  switch (sort) {
    case "newest": return [{ publishedAt: { sort: "desc", nulls: "last" } }, { slug: "asc" }];
    case "difficulty": return [{ difficulty: "asc" }, { slug: "asc" }];
    case "time": return [{ estimatedMinutes: "asc" }, { slug: "asc" }];
    default: return [{ title: "asc" }, { slug: "asc" }];
  }
}

export function libraryWhere(filters: LibraryFilters, viewerId: string | null): Prisma.ProblemWhereInput {
  if (!viewerId && needsPersonalProgress(filters)) throw new Error("Verified viewer required for personal filters.");
  const and: Prisma.ProblemWhereInput[] = [];
  if (filters.q) and.push({ title: { contains: literalSearch(filters.q), mode: "insensitive" } });
  if (filters.difficulty) and.push({ difficulty: filters.difficulty });
  if (filters.category) and.push({ categories: { some: { category: { slug: filters.category } } } });
  if (filters.tag) and.push({ tags: { some: { tag: { slug: filters.tag } } } });
  if (filters.pattern) and.push({ pattern: filters.pattern });
  if (filters.maxMinutes) and.push({ estimatedMinutes: { lte: filters.maxMinutes } });
  if (viewerId) {
    if (filters.completion === "NOT_STARTED") {
      and.push({ progress: { none: { userId: viewerId, status: { in: ["ATTEMPTED", "SOLVED"] } } } });
    } else if (filters.completion !== "ALL") {
      and.push({ progress: { some: { userId: viewerId, status: filters.completion } } });
    }
    if (filters.review) and.push({ progress: { some: { userId: viewerId, reviewLater: true } } });
  }
  return { status: "PUBLISHED", AND: and };
}

// Trusted server helper. Only the load.ts boundary supplies the verified viewer ID.
// Keep count, rows, facets, and progress in one consistent database snapshot.
export async function queryLibrary(db: PrismaClient, filters: LibraryFilters, viewerId: string | null) {
  const where = libraryWhere(filters, viewerId);
  return db.$transaction(async (tx) => {
    const total = await tx.problem.count({ where });
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(filters.page, pages);
    const rows = await tx.problem.findMany({
      where, select: publicSelect, orderBy: orderBy(filters.sort),
      skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    });
    const progress = viewerId && rows.length ? await tx.userProgress.findMany({
      where: { userId: viewerId, problemId: { in: rows.map((row) => row.id) } },
      select: { problemId: true, status: true, reviewLater: true, selfMarked: true },
    }) : [];
    const byProblem = new Map(progress.map((entry) => [entry.problemId, entry]));
    const [categories, tags, patterns] = await Promise.all([
      tx.category.findMany({
        where: { problems: { some: { problem: { status: "PUBLISHED" } } } },
        select: { slug: true, name: true }, orderBy: { name: "asc" },
      }),
      tx.tag.findMany({
        where: { problems: { some: { problem: { status: "PUBLISHED" } } } },
        select: { slug: true, name: true }, orderBy: { name: "asc" },
      }),
      tx.problem.findMany({
        where: { status: "PUBLISHED" }, select: { pattern: true },
        distinct: ["pattern"], orderBy: { pattern: "asc" },
      }),
    ]);
    return {
      total, page, pages, pageSize: PAGE_SIZE,
      facets: { categories, tags, patterns: patterns.map((row) => row.pattern) },
      items: rows.map((row) => {
        const entry = byProblem.get(row.id);
        return {
          slug: row.slug, title: row.title, difficulty: row.difficulty,
          pattern: row.pattern, estimatedMinutes: row.estimatedMinutes,
          categories: row.categories.map((link) => link.category),
          tags: row.tags.map((link) => link.tag),
          progress: viewerId ? {
            status: entry?.status ?? "NOT_STARTED",
            reviewLater: entry?.reviewLater ?? false,
            selfMarked: entry?.selfMarked ?? false,
          } : null,
        };
      }),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15_000 });
}
export type LibraryResult = Awaited<ReturnType<typeof queryLibrary>>;
````

### `src/lib/constants.ts`

````typescript
// Public display content only. Never import secrets into this module.
export const APP_CONFIG = {
  name: "AlgoSprint",
  tagline: "Practice with purpose",
  description:
    "An early preview of AlgoSprint: an original coding interview preparation platform built around deliberate practice and clear explanations.",
} as const;

// These links point to real sections on the current landing page.
export const LANDING_NAV = [
  { label: "The approach", href: "#approach" },
  { label: "Practice preview", href: "#practice-preview" },
  { label: "What's next", href: "#path-ahead" },
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

export const PLANNED_FEATURES = [
  {
    id: "collection",
    title: "An original problem collection",
    description:
      "Browse five carefully checked challenges by topic and available time. Guided problem pages are the next step.",
    label: "Available · problem library",
  },
  {
    id: "progress",
    title: "A record of how you learn",
    description:
      "Keep notes, revisit tricky questions, and see which topics deserve another practice session.",
    label: "Planned · notes and progress",
  },
  {
    id: "preparation",
    title: "Preparation with direction",
    description:
      "Follow original learning paths and, later, put your reasoning into words in timed interview practice.",
    label: "Planned · roadmaps and interviews",
  },
] as const;
````

### `tests/integration/library.test.ts`

````typescript
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { queryLibrary } from "@/features/problems/query";
import { parseLibraryFilters } from "@/features/problems/filters";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import type { ProblemSeed } from "@/lib/validators/problem";

let db: ReturnType<typeof createDatabaseClient>;
let seeds: ProblemSeed[] = [];
let ownsFixtures = false;
const users = [randomUUID(), randomUUID()];
const privateSlug = "qa-private-" + randomUUID();
const extraSlugs = ["qa-draft", "qa-archived", ...Array.from({ length: 14 }, (_, index) => "qa-page-" + String(index).padStart(2, "0"))];
const filters = parseLibraryFilters;

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use a dedicated TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Library integration tests require an empty problem collection.");
  seeds = await loadProblems();
  ownsFixtures = true;
  await seedProblems(db, seeds);
  await db.user.createMany({ data: users.map((id) => ({ id })) });
  await db.category.create({ data: { slug: privateSlug, name: privateSlug } });
  await db.tag.create({ data: { slug: privateSlug, name: privateSlug } });
  for (const status of ["DRAFT", "ARCHIVED"] as const) {
    await db.problem.create({ data: {
      slug: "qa-" + status.toLowerCase(), title: "Private unpublished sentinel", difficulty: "HARD",
      status, pattern: privateSlug, statement: "Private statement sentinel", constraints: ["Only a fixture"],
      estimatedMinutes: 1,
      categories: { create: { category: { connect: { slug: privateSlug } } } },
      tags: { create: { tag: { connect: { slug: privateSlug } } } },
    } });
  }
}, 30_000);
afterAll(async () => {
  if (db && ownsFixtures) {
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.problem.deleteMany({ where: { slug: { in: [...seeds.map((seed) => seed.slug), ...extraSlugs] } } });
    await db.category.deleteMany({ where: { slug: privateSlug } });
    await db.tag.deleteMany({ where: { slug: privateSlug } });
  }
  await db?.$disconnect();
});

describe("published library against PostgreSQL", () => {
  it("excludes draft/archive data and private-only facets from every public DTO", async () => {
    const result = await queryLibrary(db, filters({ status: "DRAFT" }), null);
    expect(result.total).toBe(5);
    expect(result.facets.categories.some((entry) => entry.slug === privateSlug)).toBe(false);
    expect(result.facets.tags.some((entry) => entry.slug === privateSlug)).toBe(false);
    expect(result.facets.patterns).not.toContain(privateSlug);
    expect(JSON.stringify(result)).not.toContain("sentinel");
    for (const item of result.items) {
      expect(Object.keys(item).sort()).toEqual(["slug", "title", "difficulty", "pattern", "estimatedMinutes", "categories", "tags", "progress"].sort());
      expect(item.progress).toBeNull();
    }
  });
  it("combines case-insensitive title, taxonomy, pattern, difficulty and time filters", async () => {
    const seed = seeds[0];
    const result = await queryLibrary(db, filters({
      q: seed.title.toUpperCase(), category: seed.categories[0], tag: seed.tags[0],
      pattern: seed.pattern, difficulty: seed.difficulty, maxMinutes: String(seed.estimatedMinutes),
    }), null);
    expect(result.items.map((item) => item.slug)).toEqual([seed.slug]);
    expect((await queryLibrary(db, filters({ q: seed.title, category: "not-a-category" }), null)).total).toBe(0);
    for (const q of ["%", "_", "\\"]) expect((await queryLibrary(db, filters({ q }), null)).total).toBe(0);
  });
  it("returns consistent ordering and keeps personal progress isolated by verified owner", async () => {
    const first = await db.problem.findUniqueOrThrow({ where: { slug: seeds[0].slug } });
    await db.userProgress.create({ data: { userId: users[0], problemId: first.id, status: "SOLVED", solvedAt: new Date(), reviewLater: true, selfMarked: true } });
    await db.userProgress.create({ data: { userId: users[1], problemId: first.id, status: "ATTEMPTED" } });
    const solved = await queryLibrary(db, filters({ completion: "SOLVED", review: "1" }), users[0]);
    expect(solved.items.map((item) => item.slug)).toEqual([first.slug]);
    expect(solved.items[0].progress).toEqual({ status: "SOLVED", reviewLater: true, selfMarked: true });
    expect((await queryLibrary(db, filters({ completion: "SOLVED" }), users[1])).total).toBe(0);
    expect((await queryLibrary(db, filters({ review: "1" }), users[1])).total).toBe(0);
    expect((await queryLibrary(db, filters({ completion: "NOT_STARTED" }), users[1])).total).toBe(4);
    expect((await queryLibrary(db, filters({ completion: "ATTEMPTED" }), users[1])).total).toBe(1);
    await expect(queryLibrary(db, filters({ completion: "SOLVED" }), null)).rejects.toThrow("Verified viewer");
    const shortest = await queryLibrary(db, filters({ sort: "time" }), null);
    expect(shortest.items.map((item) => item.estimatedMinutes)).toEqual([...shortest.items.map((item) => item.estimatedMinutes)].sort((a, b) => a - b));
    const difficulty = await queryLibrary(db, filters({ sort: "difficulty" }), null);
    const ranks = { EASY: 0, MEDIUM: 1, HARD: 2 };
    const values = difficulty.items.map((item) => ranks[item.difficulty]);
    expect(values).toEqual([...values].sort());
  });
  it("paginates equal sort values without duplicates and clamps out-of-range pages", async () => {
    await db.problem.createMany({ data: extraSlugs.filter((slug) => slug.startsWith("qa-page-")).map((slug) => ({
      slug, title: "Pagination fixture", difficulty: "EASY" as const, status: "PUBLISHED" as const,
      pattern: "linear-scan", statement: "Only test data", constraints: ["Fixture"], estimatedMinutes: 10,
      publishedAt: new Date("2026-01-01T00:00:00Z"),
    })) });
    for (const sort of ["title", "newest", "difficulty", "time"]) {
      const first = await queryLibrary(db, filters({ q: "Pagination fixture", sort }), null);
      const last = await queryLibrary(db, filters({ q: "Pagination fixture", sort, page: "999" }), null);
      expect(first).toMatchObject({ total: 14, page: 1, pages: 2 });
      expect(first.items).toHaveLength(12);
      expect(last.page).toBe(2);
      expect(last.items).toHaveLength(2);
      expect(new Set([...first.items, ...last.items].map((item) => item.slug)).size).toBe(14);
    }
  });
});
````

### `tests/library-filters.test.ts`

````typescript
import { describe, expect, it } from "vitest";
import { libraryHref, literalSearch, parseLibraryFilters } from "@/features/problems/filters";

describe("library URL boundaries", () => {
  it("normalizes empty, duplicated, malformed and oversized parameters", () => {
    const filters = parseLibraryFilters({
      q: ["one", "two"], page: "-1", maxMinutes: "Infinity", difficulty: "ADMIN",
      category: "../private", tag: "x".repeat(101), completion: "DRAFT", sort: "drop table",
    });
    expect(filters).toMatchObject({ q: "", page: 1, maxMinutes: 0, difficulty: "", category: "", tag: "", completion: "ALL", sort: "title" });
    expect(parseLibraryFilters({ q: "x".repeat(101), page: "10001", maxMinutes: "241" })).toMatchObject({ q: "", page: 1, maxMinutes: 0 });
  });
  it("keeps valid filters and trims title searches", () => {
    expect(parseLibraryFilters({ q: "  Relay  ", difficulty: "EASY", review: "1", page: "2", maxMinutes: "30" }))
      .toMatchObject({ q: "Relay", difficulty: "EASY", review: true, page: 2, maxMinutes: 30 });
  });
  it("round trips only allowed keys and preserves filters across pages", () => {
    const filters = parseLibraryFilters({ q: "a & b", category: "arrays", completion: "SOLVED", review: "1", userId: "forged", status: "DRAFT" });
    const url = new URL(libraryHref({ ...filters, page: 3 }), "https://example.test");
    expect(url.pathname).toBe("/problems");
    expect(url.searchParams.has("userId")).toBe(false);
    expect(url.searchParams.has("status")).toBe(false);
    expect(parseLibraryFilters(Object.fromEntries(url.searchParams))).toEqual({ ...filters, page: 3 });
    expect(libraryHref(parseLibraryFilters({}))).toBe("/problems");
  });
  it("escapes PostgreSQL LIKE wildcard characters for literal searches", () => {
    expect(literalSearch("50%_done\\")).toBe("50\\%\\_done\\\\");
  });
});
````

### `tests/library-load.test.ts`

````typescript
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ viewer: vi.fn(), db: vi.fn(), query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ getViewer: mocks.viewer }));
vi.mock("@/lib/prisma", () => ({ getDatabase: mocks.db }));
vi.mock("@/features/problems/query", () => ({ queryLibrary: mocks.query }));
import { loadLibrary } from "@/features/problems/load";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/algosprint_test");
  mocks.viewer.mockResolvedValue(null);
  mocks.db.mockReturnValue("trusted-db");
  mocks.query.mockResolvedValue({ items: [], total: 0 });
});
afterEach(() => vi.unstubAllEnvs());
it("shows unavailable configuration without touching identity or data", async () => {
  vi.stubEnv("DATABASE_URL", "");
  expect((await loadLibrary({})).kind).toBe("unavailable");
  expect(mocks.viewer).not.toHaveBeenCalled();
  expect(mocks.db).not.toHaveBeenCalled();
});
it("requires sign-in for personal filters without running the library query", async () => {
  expect((await loadLibrary({ completion: "SOLVED", userId: "forged" })).kind).toBe("sign-in");
  expect(mocks.query).not.toHaveBeenCalled();
  expect((await loadLibrary({ review: "1" })).kind).toBe("sign-in");
});
it("uses only the verified viewer ID and database role", async () => {
  mocks.viewer.mockResolvedValue({ id: "verified-user", role: "USER" });
  const view = await loadLibrary({ userId: "another-user", role: "ADMIN", status: "DRAFT" });
  expect(view).toMatchObject({ kind: "ready", signedIn: true, admin: false });
  expect(mocks.query.mock.calls[0][2]).toBe("verified-user");
  expect(mocks.query.mock.calls[0][1]).not.toHaveProperty("userId");
});
it("fails closed on identity errors instead of querying another user's data", async () => {
  mocks.viewer.mockRejectedValue(new Error("Provider unavailable"));
  await expect(loadLibrary({})).rejects.toThrow("Provider unavailable");
  expect(mocks.query).not.toHaveBeenCalled();
});
````

