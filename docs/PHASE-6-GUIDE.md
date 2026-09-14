# AlgoSprint Phase 6 — problem details and personal learning controls

## 🟦 What this phase builds

Phase 5 helps you find a problem. Phase 6 gives that problem a study page at `/problems/[slug]`: statement, examples, constraints, progressively revealed hints, guided solution tabs, starter code, related challenges, a private note, and manual solved/review controls. The five original seeded problems are reused unchanged.

This phase does not require a schema migration or a new dependency. Monaco editing belongs to Phase 7, execution to Phase 8, richer progress to Phase 9, analytics to Phase 10, and the full notes/bookmarks manager to Phase 11. The per-problem note and manual controls are explicitly part of Phase 6.

## 🟦 Run the completed project

Use Node.js 24. For a fresh checkout:

```bash
git clone https://github.com/zihadpcode/AlgoSprint.git
cd AlgoSprint
git switch main
npm ci
cp .env.example .env.local
```

If PR #7 is still open, use `git switch algosprint/phase-6-details` before installing. For an existing checkout, preserve your own changes and existing `.env.local`; update the appropriate branch with `git pull --ff-only` rather than cloning again or overwriting configuration.

Set `DATABASE_URL` in `.env.local` to your development PostgreSQL connection. The Phase 2 guide explains setup; the Phase 3 guide explains Supabase configuration. Then run:

```bash
npm run db:deploy
npm run db:seed
npm run dev
```

Visit `http://localhost:3000/problems`, then open Relay Window. Its detail URL is `http://localhost:3000/problems/relay-window`.

Public problem reading needs the database but no account. Private notes and progress require the existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `APP_URL` configuration, a confirmed email account, and a successful sign-in. Store credentials in local configuration, never in Git or chat. A missing database shows a preparation state; a connected database with an unknown or unpublished slug returns the custom 404.

## 🟨 Trace one read through the files

1. `problem-card.tsx` links to a URL based on the published slug.
2. The dynamic page awaits `params`. Installed Next.js 16.3.5 documents `params` as a promise, so treating it as an ordinary object would be incorrect.
3. `detail-load.ts` validates the slug, checks configuration, and calls the existing `getViewer`. Only the verified session supplies identity and role. Guests use a null viewer.
4. `detail-query.ts` reads PUBLISHED content using an explicit Prisma `select`. It does not load `TestCase`, submissions, seed hashes, database IDs into the returned object, or other users' notes. Its repeatable-read transaction keeps the content and personal reads in a consistent snapshot.
5. Examples are public `ProblemExample` records. Hints, solutions, and starter code are intentional learning content. Related links must also point to published problems; where no explicit published relation exists, the query suggests up to three problems sharing a category.
6. The page renders shared Cards, headings and badges. It sends only the relevant public data to the hint/solution/starter components, and only the viewer's own note/progress to the personal controls.

`import "server-only"` prevents an accidental runtime import of database logic into browser components. A TypeScript `import type` supplies compile-time shapes without shipping the query implementation.

## 🟨 Understand the interactions

**Hints:** `HintReveal` starts with zero displayed hints. Each click increments a bounded counter and renders one more clue, in database position order. A status message announces the count. “Hide hints” returns to zero. The hints are learning content, not secrets: they can exist in the client payload even while the interface has not revealed them.

**Solutions:** a native `details` element starts closed to avoid accidental spoilers. Within it, the tab list shows one solution panel at a time. Left/Right arrows wrap through approaches; Home/End choose the first/last; Tab enters the active tab and then its panel. IDs connect tabs to panels through `aria-controls` and `aria-labelledby`. Every solution includes intuition, approach, ordered walkthrough, pseudocode, complete code, both complexity measures, mistakes, and an interview explanation.

**Starter code:** a native language selector chooses among the available seed entries. A focusable, scrollable code block preserves indentation. Code is rendered as escaped React text; neither a starter nor a displayed solution is evaluated. Copy it into your own editor for now.

**Notes:** the textarea is controlled React state so a failed save keeps the draft. Notes save explicitly; navigating away can discard unsaved text. A successful response advances this tab's saved baseline. Failed saves and unrelated server refreshes do not silently replace it. To clear a note, save an empty textarea. The server preserves whitespace and limits both the draft and its baseline to 10,000 characters, rejecting PostgreSQL's unsupported null character.

**Progress:** “Mark solved” is an explicit command, not a toggle based on an untrusted previous status. The UI labels it self-marked. “Undo manual solve” returns to attempted if a prior attempt exists, otherwise not started. Review state is independent. A future runner-verified solve cannot be cleared or relabeled by the manual action.

## 🟨 Trace one write and its concurrency rules

All personal forms submit through `detail-actions.ts`. Server Actions are public POST entry points even if their buttons are hidden from guests. The action validates the exact fields with Zod, obtains a freshly verified viewer, and passes that viewer's ID to a server-only write helper. User-supplied `userId`, role, and internal problem IDs are ignored. Next.js supplies its normal same-origin action protections; application authorization still happens inside the action.

The helper performs a parameterized query for a published problem with `FOR SHARE`. This row lock prevents an archival update from changing the problem's availability in the middle of a write. It does not lock the whole table. The query uses a template parameter, not string concatenation.

Progress writes first ensure a single owner/problem row exists with `createMany(... skipDuplicates: true)`. Separate updates change only their own fields. Concurrent first requests can therefore mark solved and set review without overwriting one another. Repeated solved requests preserve the first solve date. The database constraint requiring `solvedAt` exactly when status is SOLVED remains satisfied.

Note saves compare the database content with the exact content this tab last loaded or saved. The conditional update succeeds only if they still match. Two different concurrent drafts from the same baseline produce one save and one conflict. A conflict asks you to copy your draft, reload, and reconcile it with the saved note; it does not silently overwrite another tab. This is content-based optimistic concurrency, not a version history or collaborative editor. A save whose response is lost may require reloading to see whether it committed.

After a successful mutation, `revalidatePath` refreshes the detail and library views. Failures return fixed, safe messages and do not claim a save succeeded. No new analytics are fabricated from these records.

## 🟩 File map

| File/group | Role |
| --- | --- |
| `src/app/problems/[slug]/page.tsx` | Public detail route, guest states, section layout. |
| `src/features/problems/detail-validation.ts` | Slug and action validation, note limit, action result type. |
| `detail-load.ts`, `detail-query.ts` | Verified read boundary and explicit public/private selection. |
| `detail-actions.ts`, `detail-write.ts` | Authenticated mutation boundary and transactional updates. |
| `src/components/problems/code-block.tsx` | Shared escaped, scrollable code display. |
| `hint-reveal.tsx`, `solution-tabs.tsx`, `starter-code.tsx` | Public learning interactions. |
| `personal-controls.tsx` | Pending states, manual progress forms, private note draft. |
| Problem card/list, dashboard, constants | Links and descriptions updated for the available pages. |
| `tests/problem-detail-boundary.test.ts` | Input, session, safe-result and revalidation tests. |
| `tests/integration/problem-detail.test.ts` | Real database privacy, ordering, ownership and concurrency. |
| `scripts/smoke-auth.mjs`, `scripts/smoke-library.mjs` | Production HTTP checks without/with a test database. |

The full source of all 19 authored or edited implementation/test files follows this guide. The existing Phase 5 workflow already runs these test suites and smoke scripts, so its configuration is unchanged. Historical phase appendices describe their own checkpoints; use the current source files for the latest application.

## 🟩 Automated checks

```bash
npm run db:validate
npm run seed:validate
npm test
npm run lint
npm run typecheck
npm run build
npm run test:smoke
```

The ordinary suite includes ten new boundary tests. Authentication is mocked in those tests to exercise failure/success paths; that does not prove a real Supabase login.

PostgreSQL integration tests need a dedicated, disposable, empty problem collection in a database whose name ends with `_test`. Do not point them at a development database containing work. For a local test database you created with the example credentials:

```bash
export TEST_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/algosprint_test'
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL='' npm run db:deploy
npm run test:integration
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL='' npm run db:seed
node scripts/smoke-library.mjs
```

Run integration tests before the final seed step: the tests seed and remove their own problems, and reject a prepopulated problem collection. The final seed supplies the five problems for the HTTP check. GitHub CI uses PostgreSQL 17 and runs these steps in that order.

Eight new integration tests cover public projection/order, published related-link fallback, unpublished reads/writes, two-user privacy, simultaneous first progress writes, undo semantics, future verified-solve preservation, stale notes, and concurrent note saves. The seeded HTTP smoke opens every problem, checks library links and collapsed solutions, verifies 404s, and creates/removes owned fixtures to prove that hidden test payloads and another user's note never appear in a guest production response. It uses no real Supabase account.

Implementation commit `db472a96b041ce57a096038b58b551b6663227b9` passed [CI run 34905876549](https://github.com/zihadpcode/AlgoSprint/actions/runs/34905876549): all 55 unit/migration tests, 17 PostgreSQL integration tests and every validation/build/HTTP stage. The first run exposed a SQL type-inference error in the HTTP fixture, fixed by explicitly casting its reused text parameter. Consult `SESSION-HANDOFF.md` and PR #7 for the closing documentation commit and merge result.

## 🟨 Browser and live-account checklist

These are manual checks still required with a configured development account; do not treat automated HTTP checks as browser verification.

1. Open each of the five cards from `/problems`. Confirm the correct statement, two examples, constraints, starter and related links. Check that an unknown slug returns 404.
2. Before clicking, verify no hint text is visible and the guided solutions are closed. Reveal all five hints, then hide them. Use only the keyboard for a second pass.
3. Open solutions. Exercise Left/Right/Home/End and Tab. Confirm selected tabs, visible panels, walkthrough order, full code and complexity. Test all available starter languages.
4. Test a narrow 375px viewport and 200% browser zoom. The page must remain readable; long code should scroll within its own block rather than widening the page. Check focus outlines, screen-reader labels and status announcements.
5. As a guest, confirm progress/notes offer sign-in. Sign in using a confirmed development account and return to the problem.
6. Mark solved, refresh, verify “self-marked” in both detail and library, set review, remove review, and undo the manual solve. Confirm each operation preserves unrelated fields.
7. Save a note with spaces and newlines, refresh, then verify exact content. Sign out and confirm it is absent. Sign in as a second user and verify the first user's note and progress remain inaccessible.
8. Open the same note in two tabs. Save a different draft in each; the second must show a conflict and keep its draft. Copy that draft, reload, compare, and save a deliberate revision. Save an empty draft to clear the note.
9. Expire/sign out the session in another tab before saving. Verify the save is denied and the textarea retains its draft. Simulate a failed request in browser developer tools and verify no success claim appears.
10. Switch between different problem URLs and back; hints and selected solution state should not carry over to the wrong problem. Test entering notes, changing a progress flag, and confirming the unsaved draft remains intact.

## 🟥 Common mistakes

- Returning `include: { testCases: true }` or importing seed JSON into a client component discloses hidden evaluation data. Select public examples explicitly.
- Trusting `userId` from a form lets one user target another person's records. Use the verified session near every write.
- Hiding controls is a presentation choice, not authentication. Test the Server Action directly.
- Updating an entire progress record from a stale form can erase review or solve information. Update only the fields the command owns.
- Resetting the note input on every server render loses unsaved work. Keep the local draft and its saved baseline separate.
- Rendering seed text as HTML or running code to show a preview creates an unnecessary execution boundary. This phase renders text only.
- Calling a self-marked problem “test passed” would mislead learners. No code runner exists yet.

## 🟪 Next learning step

Trace “save-note” from the form through validation, verified identity, the publication lock, conditional update, and revalidation. Explain why a role checkbox or user ID in the browser cannot grant access. Then inspect the concurrent-note integration test and predict which request can succeed.

Phase 7 will add Monaco editing. Keep starter display and problem data separate from editor state, and preserve the server-only hidden-test boundary when execution is introduced later.

## 🟩 Complete authored source files

### scripts/smoke-auth.mjs

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
  const detail = await fetch(origin + "/problems/relay-window");
  assert.equal(detail.status, 200);
  assert.ok((await detail.text()).includes("Practice is being prepared"));
  assert.equal((await fetch(origin + "/problems/INVALID")).status, 404);
  const callback = await fetch(origin + "/auth/callback?code=forged", { redirect: "manual" });
  assert.equal(callback.status, 503); assert.match(callback.headers.get("cache-control") ?? "", /(?:^|,\s*)no-store(?:,|$)/);
  console.log("Production HTTP smoke passed: landing, protected redirects, missing-config forms, custom 404, and callback denial.");
} finally {
  server.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(3000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
```

### scripts/smoke-library.mjs

```javascript
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test")) throw new Error("Use a seeded, dedicated TEST_DATABASE_URL ending in _test.");
const db = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const fixtureIds = [randomUUID(), randomUUID(), randomUUID()];
const fixtureSlugs = fixtureIds.map((id) => "qa-http-" + id);
const userId = randomUUID();
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
  for (const slug of ["relay-window", "quiet-badge", "parcel-checkpoints", "dock-threshold", "lantern-steps"]) {
    assert.ok(html.includes(`/problems/${slug}`), "Card must link to its detail page");
    const detail = await fetch(origin + `/problems/${slug}?userId=forged&role=ADMIN`);
    assert.equal(detail.status, 200, slug);
    assert.match(detail.headers.get("cache-control") ?? "", /no-store/);
    const body = await detail.text();
    for (const section of ["Problem statement", "Examples", "Constraints", "Layered hints", "Reveal guided solutions", "Starter code", "Related problems", "Sign in to write notes"]) assert.ok(body.includes(section), `${slug}: ${section}`);
    assert.match(body, /<details(?:\s[^>]*)?>/);
    assert.ok(!/<details[^>]*\sopen(?:[\s=>])/.test(body), "Solutions start collapsed");
    for (const field of ["testCases", "seedHash", "HIDDEN"]) assert.ok(!body.includes(field), field);
  }
  // Owned fixtures prove the production response also excludes private relations,
  // hidden test payloads and another user's notes (not just private field names).
  await db.query('INSERT INTO app."User" (id, "updatedAt") VALUES ($1, now())', [userId]);
  for (const [index, status] of ["PUBLISHED", "DRAFT", "ARCHIVED"].entries()) {
    await db.query(`INSERT INTO app."Problem" (id, slug, title, difficulty, status, pattern, statement, constraints, "estimatedMinutes", "publishedAt", "updatedAt")
      VALUES ($1, $2, $3::text, 'EASY', $4, 'http-fixture', $3::text, ARRAY['Fixture'], 1, $5, now())`,
    [fixtureIds[index], fixtureSlugs[index], index === 0 ? "PUBLIC-DETAIL-SENTINEL" : "UNPUBLISHED-DETAIL-SENTINEL", status, index === 0 ? new Date() : null]);
  }
  await db.query('INSERT INTO app."UserNote" (id, "userId", "problemId", content, "updatedAt") VALUES ($1, $2, $3, $4, now())', [randomUUID(), userId, fixtureIds[0], "PRIVATE-NOTE-SENTINEL"]);
  await db.query(`INSERT INTO app."TestCase" (id, "problemId", position, visibility, input, output, explanation)
    VALUES ($1, $2, 1, 'HIDDEN', $3::jsonb, $3::jsonb, $4)`, [randomUUID(), fixtureIds[0], JSON.stringify({ secret: "HIDDEN-PAYLOAD-SENTINEL" }), "HIDDEN-EXPLANATION-SENTINEL"]);
  await db.query('INSERT INTO app."ProblemRelation" ("problemId", "relatedId") VALUES ($1, $2)', [fixtureIds[0], fixtureIds[1]]);
  const fixture = await fetch(origin + `/problems/${fixtureSlugs[0]}?userId=${userId}`, { headers: { cookie: `userId=${userId}; role=ADMIN; sb-access-token=forged` } });
  assert.equal(fixture.status, 200);
  const fixtureHtml = await fixture.text();
  assert.ok(fixtureHtml.includes("PUBLIC-DETAIL-SENTINEL"));
  for (const secret of ["PRIVATE-NOTE-SENTINEL", "HIDDEN-PAYLOAD-SENTINEL", "HIDDEN-EXPLANATION-SENTINEL", "UNPUBLISHED-DETAIL-SENTINEL"]) assert.ok(!fixtureHtml.includes(secret), secret);
  for (const unavailable of [fixtureSlugs[1], fixtureSlugs[2], "does-not-exist", "INVALID"]) {
    const response = await fetch(origin + `/problems/${unavailable}`);
    assert.equal(response.status, 404, unavailable);
    assert.ok(!(await response.text()).includes("UNPUBLISHED-DETAIL-SENTINEL"));
  }
  console.log("Library/detail HTTP smoke passed: seeded links, filters, detail sections, collapsed solutions, guest gates, privacy headers, hidden payload exclusion and unpublished 404s.");
} finally {
  server.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(3000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
  try {
    await db.query('DELETE FROM app."User" WHERE id = $1', [userId]);
    await db.query('DELETE FROM app."Problem" WHERE id = ANY($1::uuid[])', [fixtureIds]);
  } finally { await db.end(); }
}
```

### src/app/dashboard/page.tsx

```tsx
import type { Metadata } from "next";
import { requireViewer } from "@/features/auth/session";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const viewer = await requireViewer();
  return <AccountFrame admin={viewer.role === "ADMIN"}>
    <PageHeading eyebrow="Your practice space" title={`Welcome, ${viewer.displayName || "learner"}.`} description="Build an approach you understand, then carry that insight into the next challenge." action={<ButtonLink href="/profile" variant="secondary">View profile</ButtonLink>} />
    <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <Card><Badge tone="success">Account ready</Badge><CardTitle className="mt-5">A small step, taken consistently.</CardTitle><CardDescription>Start with the question, trace a simple example, and explain your approach before optimizing it. Deliberate practice starts with understanding.</CardDescription></Card>
      <Card><CardTitle>Your practice rhythm</CardTitle><ol className="mt-5 space-y-4 text-sm text-muted">{["Read the constraints and choose an example.", "Write a first approach you can explain.", "Review what changed your understanding."].map((step, index) => <li key={step} className="flex gap-3"><span className="font-mono text-accent">0{index + 1}</span><span>{step}</span></li>)}</ol></Card>
    </div>
    <section className="mt-8" aria-label="Practice activity"><EmptyState title="Your next insight starts with a problem" description="Explore the library, work through a guided explanation, and keep a private note. Activity analytics are coming later." action={<ButtonLink href="/problems">Explore problems</ButtonLink>} /></section>
  </AccountFrame>;
}
```

### src/app/problems/[slug]/page.tsx

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CodeBlock } from "@/components/problems/code-block";
import { HintReveal } from "@/components/problems/hint-reveal";
import { SolutionTabs } from "@/components/problems/solution-tabs";
import { StarterCode } from "@/components/problems/starter-code";
import { ProblemNotes, ProgressControls } from "@/components/problems/personal-controls";
import { loadProblem } from "@/features/problems/detail-load";

export const metadata: Metadata = { title: "Problem practice", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ProblemPage({ params }: { params: Promise<{ slug: string }> }) {
  const view = await loadProblem((await params).slug);
  if (view.kind === "not-found") notFound();
  if (view.kind === "unavailable") return <AppShell>
    <PageHeading eyebrow="Problem practice" title="Practice is being prepared" description="Please check back when the collection is available." />
    <ButtonLink href="/problems" variant="secondary">Back to problem library</ButtonLink>
  </AppShell>;
  const { problem } = view;
  const loginHref = `/login?next=${encodeURIComponent(`/problems/${problem.slug}`)}`;
  return <AppShell signedIn={view.signedIn} admin={view.admin}>
    <Link href="/problems" className="mb-6 inline-block text-sm font-semibold text-accent hover:underline">← Problem library</Link>
    <PageHeading eyebrow="Read · reason · explain" title={problem.title}
      description={`Practice ${problem.pattern.replaceAll("-", " ")}. Allow about ${problem.estimatedMinutes} minutes.`} />
    <div className="mb-6 flex flex-wrap gap-2"><Badge tone={problem.difficulty === "HARD" ? "warm" : "accent"}>{problem.difficulty}</Badge>
      {problem.categories.map((category) => <Badge key={category.slug}>{category.name}</Badge>)}
    </div>
    <nav aria-label="Problem sections" className="mb-8 flex flex-wrap gap-x-5 gap-y-3 text-sm text-accent">
      {[["statement", "Statement"], ["examples", "Examples"], ["constraints", "Constraints"], ["hints", "Hints"], ["solutions", "Solutions"], ["starter", "Starter code"], ["notes", "Notes"]].map(([id, label]) => <a key={id} href={`#${id}`} className="underline underline-offset-4">{label}</a>)}
    </nav>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,1fr)]">
      <div className="min-w-0 space-y-6">
        <Card id="statement"><CardTitle>Problem statement</CardTitle><p className="mt-4 whitespace-pre-wrap leading-8 text-muted">{problem.statement}</p>
          {problem.tags.length > 0 && <p className="mt-5 text-xs text-muted">Tags: {problem.tags.map((tag) => tag.name).join(", ")}</p>}
        </Card>
        <Card id="examples"><CardTitle>Examples</CardTitle><ol className="mt-5 space-y-7">
          {problem.examples.map((example, index) => <li key={example.position} className="space-y-4">
            <h3 className="font-semibold text-accent">Example {index + 1}</h3>
            <CodeBlock label={`Example ${index + 1} input`} code={JSON.stringify(example.input, null, 2)} />
            <CodeBlock label={`Example ${index + 1} expected output`} code={JSON.stringify(example.output, null, 2)} />
            <p className="text-sm leading-7 text-muted">{example.explanation}</p>
          </li>)}
        </ol></Card>
        <Card id="constraints"><CardTitle>Constraints</CardTitle><ul className="mt-4 list-disc space-y-3 pl-5 font-mono text-sm leading-7 text-muted">
          {problem.constraints.map((constraint, index) => <li key={index} className="[overflow-wrap:anywhere]">{constraint}</li>)}
        </ul></Card>
        <Card id="hints"><CardTitle>Layered hints</CardTitle><HintReveal key={problem.slug} hints={problem.hints} /></Card>
        <Card id="solutions"><CardTitle>Guided solutions</CardTitle><SolutionTabs key={problem.slug} solutions={problem.solutions} /></Card>
      </div>
      <aside aria-label="Practice tools" className="min-w-0 space-y-6">
        <Card><CardTitle>Your progress</CardTitle>{problem.personal ? <ProgressControls slug={problem.slug} progress={problem.personal.progress} /> :
          <div className="mt-4 space-y-4"><p className="text-sm leading-7 text-muted">Sign in to mark a problem solved or save it for review.</p><ButtonLink href={loginHref}>Sign in to save progress</ButtonLink></div>}
        </Card>
        <Card id="starter"><CardTitle>Starter code</CardTitle><StarterCode key={problem.slug} entries={problem.starterCode} /></Card>
        <Card id="notes"><CardTitle>Your notes</CardTitle>{problem.personal ? <ProblemNotes key={problem.slug} slug={problem.slug} note={problem.personal.note} /> :
          <div className="mt-4 space-y-4"><p className="text-sm leading-7 text-muted">Keep your own explanation and questions in a private note.</p><ButtonLink href={loginHref} variant="secondary">Sign in to write notes</ButtonLink></div>}
        </Card>
        <Card><CardTitle>Related problems</CardTitle><p className="mt-3 text-xs leading-6 text-muted">Linked challenges or problems that share a topic.</p>{problem.related.length ? <ul className="mt-4 space-y-4">
          {problem.related.map((related) => <li key={related.slug}><Link href={`/problems/${related.slug}`} className="font-semibold text-accent underline underline-offset-4">{related.title}</Link><p className="mt-1 text-xs text-muted">{related.difficulty}</p></li>)}
        </ul> : <div className="mt-4"><EmptyState title="Keep exploring" description="No related challenges are linked yet." action={<ButtonLink href="/problems" variant="secondary">Browse the library</ButtonLink>} /></div>}</Card>
      </aside>
    </div>
  </AppShell>;
}
```

### src/app/problems/page.tsx

```tsx
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
          <p className="mt-8 text-sm leading-7 text-muted">Open a problem for examples, layered hints, starter code, and guided solutions.</p>
        </>
      )}
    </AppShell>
  );
}
```

### src/components/problems/code-block.tsx

```tsx
export function CodeBlock({ label, code }: { label: string; code: string }) {
  return <div className="min-w-0">
    <p className="mb-2 text-xs font-semibold text-muted">{label}</p>
    <pre tabIndex={0} aria-label={label} className="max-h-[32rem] overflow-auto rounded-xl border border-line bg-canvas p-4 font-mono text-sm leading-7"><code>{code}</code></pre>
  </div>;
}
```

### src/components/problems/hint-reveal.tsx

```tsx
"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";

const levels = ["A light clue", "Choose a tool", "Find the pattern", "Strong guidance", "Full solution direction"];
export function HintReveal({ hints }: { hints: { position: number; content: string }[] }) {
  const [shown, setShown] = useState(0);
  const id = useId();
  return <div>
    <p className="mt-3 text-sm leading-7 text-muted">Take one clue at a time. Try a small example before revealing the next.</p>
    <ol id={id} className="mt-5 space-y-3">
      {hints.slice(0, shown).map((hint, index) => <li key={hint.position} className="rounded-xl border border-line bg-canvas p-4">
        <h3 className="text-sm font-semibold text-accent">Hint {index + 1} · {levels[index] ?? "Keep exploring"}</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{hint.content}</p>
      </li>)}
    </ol>
    <p role="status" className="my-4 text-xs text-muted">{shown} of {hints.length} hints revealed{shown === hints.length ? " · all clues shown" : ""}.</p>
    <div className="flex flex-wrap gap-3">
      <Button aria-controls={id} disabled={shown >= hints.length} onClick={() => setShown((count) => Math.min(count + 1, hints.length))}>
        {shown === hints.length ? "All hints revealed" : `Reveal hint ${shown + 1}`}
      </Button>
      {shown > 0 && <Button variant="secondary" onClick={() => setShown(0)}>Hide hints</Button>}
    </div>
  </div>;
}
```

### src/components/problems/personal-controls.tsx

```tsx
"use client";

import { useActionState, useId, useState } from "react";
import { updateProblem } from "@/features/problems/detail-actions";
import { NOTE_LIMIT, type ProblemActionState } from "@/features/problems/detail-validation";
import type { ProblemDetail } from "@/features/problems/detail-query";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/ui/badge";

const initial: ProblemActionState = {};
const statuses = { NOT_STARTED: "Not started", ATTEMPTED: "Attempted", SOLVED: "Solved" };
export function ProgressControls({ slug, progress }: { slug: string; progress: NonNullable<ProblemDetail["personal"]>["progress"] }) {
  const [state, action, pending] = useActionState(updateProblem, initial);
  const solved = progress.status === "SOLVED";
  return <div className="mt-4 space-y-4">
    <div className="flex flex-wrap gap-2"><Badge tone="accent">{statuses[progress.status]}{solved && progress.selfMarked ? " · self-marked" : ""}</Badge>
      {progress.reviewLater && <Badge tone="warm">Review later</Badge>}
    </div>
    <p className="text-sm leading-7 text-muted">A manual mark records your own assessment. It does not mean code has passed tests.</p>
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="review" value={String(!progress.reviewLater)} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton name="operation" value={solved ? "clear-solved" : "mark-solved"} disabled={pending || (solved && !progress.selfMarked)} pendingLabel="Saving…">
          {solved ? progress.selfMarked ? "Undo manual solve" : "Solved" : "Mark solved"}
        </SubmitButton>
        <SubmitButton name="operation" value="set-review" variant="secondary" disabled={pending} pendingLabel="Saving…">
          {progress.reviewLater ? "Remove from review" : "Review later"}
        </SubmitButton>
      </div>
    </form>
    <ActionMessage state={state} />
  </div>;
}

export function ProblemNotes({ slug, note }: { slug: string; note: string }) {
  const [state, action, pending] = useActionState(async (previous: ProblemActionState, form: FormData) => {
    const result = await updateProblem(previous, form);
    // Keep this tab's last saved baseline on errors and unrelated page refreshes.
    return { ...result, savedContent: result.success ? result.savedContent : previous.savedContent };
  }, { savedContent: note });
  const [draft, setDraft] = useState(note);
  const id = useId();
  return <form action={action} className="mt-4 space-y-4">
    <input type="hidden" name="slug" value={slug} />
    <input type="hidden" name="operation" value="save-note" />
    <input type="hidden" name="expectedContent" value={state.savedContent ?? ""} />
    <label htmlFor={id} className="block text-sm text-muted">Private notes · record an insight, a mistake, or a question to revisit.</label>
    <textarea id={id} name="content" rows={9} maxLength={NOTE_LIMIT} value={draft} readOnly={pending}
      aria-describedby={`${id}-help`} onChange={(event) => setDraft(event.target.value)}
      className="w-full resize-y rounded-xl border border-muted/60 bg-canvas p-4 text-sm leading-7 text-ink" />
    <p id={`${id}-help`} className="text-xs leading-6 text-muted">{draft.length.toLocaleString("en-US")} / 10,000 characters. Save explicitly before leaving. Save an empty note to clear it.</p>
    <SubmitButton pendingLabel="Saving note…" disabled={pending}>Save note</SubmitButton>
    <ActionMessage state={state} />
  </form>;
}
function ActionMessage({ state }: { state: ProblemActionState }) {
  return <p role="status" aria-atomic="true" className={`text-sm leading-7 ${state.success === false ? "text-warm" : "text-accent"}`}>{state.message ?? ""}</p>;
}
```

### src/components/problems/problem-card.tsx

```tsx
import Link from "next/link";
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
      <h2 className="mt-5 text-xl font-semibold [overflow-wrap:anywhere]"><Link href={`/problems/${problem.slug}`} className="text-accent hover:underline underline-offset-4">{problem.title}</Link></h2>
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
```

### src/components/problems/solution-tabs.tsx

```tsx
"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { ProblemDetail } from "@/features/problems/detail-query";
import { CodeBlock } from "./code-block";

const kinds = { BRUTE_FORCE: "Brute force", BETTER: "Better", OPTIMAL: "Optimal", ALTERNATIVE: "Alternative" };
export function SolutionTabs({ solutions }: { solutions: ProblemDetail["solutions"] }) {
  const [active, setActive] = useState(0);
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % solutions.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + solutions.length) % solutions.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = solutions.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    buttons.current[next]?.focus();
  }
  if (!solutions.length) return <p className="mt-3 text-muted">A guided solution is being prepared.</p>;
  return <details className="mt-4">
    <summary className="cursor-pointer rounded-xl border border-line p-4 font-semibold text-accent">Reveal guided solutions</summary>
    <p className="my-5 text-sm leading-7 text-muted">Compare the tradeoffs, then explain the approach in your own words.</p>
    <div role="tablist" aria-label="Solution approaches" className="flex flex-wrap gap-2">
      {solutions.map((solution, index) => <button key={`${solution.kind}-${solution.language}`}
        ref={(element) => { buttons.current[index] = element; }}
        type="button" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`}
        aria-selected={active === index} tabIndex={active === index ? 0 : -1}
        onClick={() => setActive(index)} onKeyDown={(event) => onKeyDown(event, index)}
        className="min-h-11 rounded-xl border border-line px-4 py-3 text-sm text-muted aria-selected:border-accent aria-selected:bg-accent/10 aria-selected:text-accent">
        {kinds[solution.kind]} · {solution.language.toLowerCase()}
      </button>)}
    </div>
    {solutions.map((solution, index) => <div key={`${solution.kind}-${solution.language}`} role="tabpanel"
      id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} hidden={active !== index} tabIndex={0} className="mt-6 space-y-6">
      <h3 className="text-lg font-semibold">{solution.title}</h3>
      <TextSection title="Intuition" text={solution.intuition} />
      <TextSection title="Approach" text={solution.approach} />
      <div><h4 className="font-semibold">Walkthrough</h4><ol className="mt-3 space-y-4">
        {solution.steps.map((step, stepIndex) => <li key={step.position} className="border-l-2 border-accent/40 pl-4">
          <h5 className="text-sm font-semibold">{stepIndex + 1}. {step.title}</h5><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted">{step.content}</p>
        </li>)}
      </ol></div>
      <CodeBlock label="Pseudocode" code={solution.pseudocode} />
      <CodeBlock label={`Solution code · ${solution.language.toLowerCase()}`} code={solution.code} />
      <dl className="grid gap-3 rounded-xl bg-canvas p-4 sm:grid-cols-2">
        <div><dt className="text-sm text-muted">Time complexity</dt><dd className="mt-2 font-mono text-sm">{solution.timeComplexity}</dd></div>
        <div><dt className="text-sm text-muted">Space complexity</dt><dd className="mt-2 font-mono text-sm">{solution.spaceComplexity}</dd></div>
      </dl>
      <div><h4 className="font-semibold">Common mistakes</h4><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-muted">
        {solution.commonMistakes.map((mistake, item) => <li key={item}>{mistake}</li>)}
      </ul></div>
      <TextSection title="Explain it in an interview" text={solution.interviewExplanation} />
    </div>)}
  </details>;
}
function TextSection({ title, text }: { title: string; text: string }) {
  return <div><h4 className="font-semibold">{title}</h4><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted">{text}</p></div>;
}
```

### src/components/problems/starter-code.tsx

```tsx
"use client";

import { useId, useState } from "react";
import { Select } from "@/components/ui/input";
import type { ProblemDetail } from "@/features/problems/detail-query";
import { CodeBlock } from "./code-block";

export function StarterCode({ entries }: { entries: ProblemDetail["starterCode"] }) {
  const [index, setIndex] = useState(0);
  const id = useId();
  const entry = entries[index];
  if (!entry) return <p className="mt-3 text-muted">Starter code is being prepared.</p>;
  return <div className="mt-4 space-y-4">
    <label htmlFor={id} className="block text-sm font-semibold">Language</label>
    <Select id={id} value={index} onChange={(event) => setIndex(Number(event.target.value))}>
      {entries.map((item, position) => <option key={item.language} value={position}>{item.language.toLowerCase()}</option>)}
    </Select>
    <CodeBlock label={`Starter code · ${entry.language.toLowerCase()}`} code={entry.code} />
    <p className="text-xs leading-6 text-muted">Entry point: <code>{entry.entryPoint}</code>. Copy this starter into your own editor. In-app editing and execution are coming later.</p>
  </div>;
}
```

### src/features/problems/detail-actions.ts

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { problemChange, type ProblemActionState } from "./detail-validation";
import { writeProblemChange } from "./detail-write";

export async function updateProblem(_previous: ProblemActionState, form: FormData): Promise<ProblemActionState> {
  // Explicit fields: caller-supplied user IDs, roles and problem IDs are ignored.
  const input = problemChange.safeParse({
    slug: form.get("slug"), operation: form.get("operation"), review: form.get("review"),
    content: form.get("content"), expectedContent: form.get("expectedContent"),
  });
  if (!input.success) return { success: false, message: "Check your request. Notes must be at most 10,000 characters and contain no null characters." };
  try {
    const viewer = await getViewer();
    if (!viewer) return { success: false, message: "Sign in again before saving. Your unsaved note remains in this page." };
    const outcome = await writeProblemChange(getDatabase(), viewer.id, input.data);
    if (outcome === "not-found") return { success: false, message: "This problem is no longer available." };
    if (outcome === "conflict") return { success: false, message: "Your note changed in another tab. Copy your draft, then reload to review the saved version before trying again." };
  } catch { return { success: false, message: "Could not save your change. Please try again." }; }
  revalidatePath(`/problems/${input.data.slug}`);
  revalidatePath("/problems");
  if (input.data.operation === "save-note") return { success: true, message: input.data.content ? "Note saved." : "Note cleared.", savedContent: input.data.content };
  return { success: true, message: "Progress updated." };
}
```

### src/features/problems/detail-load.ts

```ts
import "server-only";
import { getViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { problemSlug } from "./detail-validation";
import { queryProblem } from "./detail-query";

export async function loadProblem(slug: string) {
  if (!problemSlug.safeParse(slug).success) return { kind: "not-found" as const };
  if (!process.env.DATABASE_URL) return { kind: "unavailable" as const };
  const viewer = await getViewer();
  const problem = await queryProblem(getDatabase(), slug, viewer?.id ?? null);
  if (!problem) return { kind: "not-found" as const };
  return { kind: "ready" as const, problem, signedIn: Boolean(viewer), admin: viewer?.role === "ADMIN" };
}
```

### src/features/problems/detail-query.ts

```ts
import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

// An allowlist, never include:true: hidden tests and operational fields stay server-side.
const detailSelect = {
  id: true, slug: true, title: true, difficulty: true, kind: true, pattern: true,
  statement: true, constraints: true, estimatedMinutes: true,
  categories: { select: { category: { select: { slug: true, name: true } } }, orderBy: { category: { name: "asc" } } },
  tags: { select: { tag: { select: { slug: true, name: true } } }, orderBy: { tag: { name: "asc" } } },
  examples: { select: { position: true, input: true, output: true, explanation: true }, orderBy: { position: "asc" } },
  hints: { select: { position: true, content: true }, orderBy: { position: "asc" } },
  solutions: {
    select: {
      kind: true, language: true, title: true, intuition: true, approach: true, pseudocode: true,
      code: true, timeComplexity: true, spaceComplexity: true, commonMistakes: true, interviewExplanation: true,
      steps: { select: { position: true, title: true, content: true }, orderBy: { position: "asc" } },
    },
    orderBy: [{ kind: "asc" }, { language: "asc" }],
  },
  starterCode: { select: { language: true, entryPoint: true, code: true }, orderBy: { language: "asc" } },
  related: {
    where: { related: { status: "PUBLISHED" } }, take: 6,
    select: { related: { select: { slug: true, title: true, difficulty: true } } },
    orderBy: { related: { slug: "asc" } },
  },
} satisfies Prisma.ProblemSelect;

// viewerId is supplied only by loadProblem after provider verification.
export async function queryProblem(db: PrismaClient, slug: string, viewerId: string | null) {
  return db.$transaction(async (tx) => {
    const row = await tx.problem.findFirst({ where: { slug, status: "PUBLISHED" }, select: detailSelect });
    if (!row) return null;
    const { id, categories, tags, related, ...content } = row;
    const relatedProblems = related.length ? related.map((item) => item.related) : await tx.problem.findMany({
      where: { status: "PUBLISHED", slug: { not: slug }, categories: { some: { category: { slug: { in: categories.map((item) => item.category.slug) } } } } },
      select: { slug: true, title: true, difficulty: true }, orderBy: { slug: "asc" }, take: 3,
    });
    const personal = viewerId ? {
      progress: await tx.userProgress.findUnique({
        where: { userId_problemId: { userId: viewerId, problemId: id } },
        select: { status: true, reviewLater: true, selfMarked: true },
      }) ?? { status: "NOT_STARTED" as const, reviewLater: false, selfMarked: false },
      note: (await tx.userNote.findUnique({
        where: { userId_problemId: { userId: viewerId, problemId: id } }, select: { content: true },
      }))?.content ?? "",
    } : null;
    return {
      ...content, categories: categories.map((item) => item.category), tags: tags.map((item) => item.tag),
      related: relatedProblems, personal,
    };
  }, { isolationLevel: "RepeatableRead" });
}
export type ProblemDetail = NonNullable<Awaited<ReturnType<typeof queryProblem>>>;
```

### src/features/problems/detail-validation.ts

```ts
import { z } from "zod";

export const problemSlug = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const NOTE_LIMIT = 10_000;
const noteText = z.string().max(NOTE_LIMIT).refine((text) => !text.includes("\u0000"), "Remove null characters.");
export const problemChange = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("mark-solved"), slug: problemSlug }),
  z.object({ operation: z.literal("clear-solved"), slug: problemSlug }),
  z.object({ operation: z.literal("set-review"), slug: problemSlug, review: z.enum(["true", "false"]) }),
  z.object({ operation: z.literal("save-note"), slug: problemSlug, content: noteText, expectedContent: noteText }),
]);
export type ProblemChange = z.infer<typeof problemChange>;
export type ProblemActionState = { success?: boolean; message?: string; savedContent?: string };
```

### src/features/problems/detail-write.ts

```ts
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ProblemChange } from "./detail-validation";

// Trusted helper: caller must validate input and verify the user before entering.
export async function writeProblemChange(db: PrismaClient, userId: string, change: ProblemChange) {
  return db.$transaction(async (tx) => {
    // Parameterized SQL. A shared row lock prevents archival during the write.
    const [problem] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM app."Problem" WHERE slug = ${change.slug} AND status = 'PUBLISHED' FOR SHARE
    `;
    if (!problem) return "not-found" as const;
    const owner = { userId, problemId: problem.id };
    if (change.operation === "save-note") {
      // Concurrent first saves are safe; the baseline check catches stale tabs.
      await tx.userNote.createMany({ data: { ...owner, content: "" }, skipDuplicates: true });
      const updated = await tx.userNote.updateMany({
        where: { ...owner, content: change.expectedContent }, data: { content: change.content },
      });
      return updated.count ? "saved" as const : "conflict" as const;
    }
    await tx.userProgress.createMany({ data: owner, skipDuplicates: true });
    if (change.operation === "set-review") {
      await tx.userProgress.updateMany({ where: owner, data: { reviewLater: change.review === "true" } });
    } else if (change.operation === "mark-solved") {
      // Preserve an existing solve's date and provenance; this is a manual mark.
      await tx.userProgress.updateMany({
        where: { ...owner, status: { not: "SOLVED" } },
        data: { status: "SOLVED", solvedAt: new Date(), selfMarked: true },
      });
    } else {
      // Undo only manual marks. Future runner-verified solves cannot be cleared here.
      await tx.userProgress.updateMany({
        where: { ...owner, status: "SOLVED", selfMarked: true, attemptedAt: null },
        data: { status: "NOT_STARTED", solvedAt: null, selfMarked: false },
      });
      await tx.userProgress.updateMany({
        where: { ...owner, status: "SOLVED", selfMarked: true, attemptedAt: { not: null } },
        data: { status: "ATTEMPTED", solvedAt: null, selfMarked: false },
      });
    }
    return "saved" as const;
  });
}
```

### src/lib/constants.ts

```ts
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
      "Explore five original challenges with examples, layered hints, and guided solutions. Keep your own notes as you learn.",
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
```

### tests/integration/problem-detail.test.ts

```ts
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { queryProblem } from "@/features/problems/detail-query";
import { writeProblemChange } from "@/features/problems/detail-write";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import type { ProblemSeed } from "@/lib/validators/problem";

let db: ReturnType<typeof createDatabaseClient>;
let seeds: ProblemSeed[] = [];
let ownsFixtures = false;
let problemId: string;
const users = [randomUUID(), randomUUID()];
const slug = "relay-window";
const privateSlugs = ["qa-detail-draft", "qa-detail-archived"];
const hiddenSentinel = "HIDDEN-DETAIL-TEST-SENTINEL";

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use a dedicated TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Detail tests require an empty problem collection.");
  seeds = await loadProblems();
  ownsFixtures = true;
  await seedProblems(db, seeds);
  await db.user.createMany({ data: users.map((id) => ({ id })) });
  problemId = (await db.problem.findUniqueOrThrow({ where: { slug } })).id;
  for (const [index, status] of (["DRAFT", "ARCHIVED"] as const).entries()) {
    const hidden = await db.problem.create({ data: { slug: privateSlugs[index], title: "Private detail sentinel", status,
      difficulty: "EASY", pattern: "fixture", statement: "Private statement", constraints: ["Fixture"], estimatedMinutes: 1 } });
    await db.problemRelation.create({ data: { problemId, relatedId: hidden.id } });
  }
  const related = await db.problem.findUniqueOrThrow({ where: { slug: "parcel-checkpoints" } });
  await db.problemRelation.create({ data: { problemId, relatedId: related.id } });
  await db.testCase.updateMany({ where: { problemId, visibility: "HIDDEN" }, data: { explanation: hiddenSentinel } });
}, 30_000);
beforeEach(async () => {
  await db.userProgress.deleteMany({ where: { userId: { in: users } } });
  await db.userNote.deleteMany({ where: { userId: { in: users } } });
});
afterAll(async () => {
  if (db && ownsFixtures) {
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.problem.deleteMany({ where: { slug: { in: [...seeds.map((seed) => seed.slug), ...privateSlugs] } } });
  }
  await db?.$disconnect();
});
const progress = (userId = users[0]) => db.userProgress.findUniqueOrThrow({ where: { userId_problemId: { userId, problemId } } });

describe("problem details and personal writes against PostgreSQL", () => {
  it("returns ordered learning content, published relations and no hidden/operational data", async () => {
    const result = await queryProblem(db, slug, null);
    expect(result?.personal).toBeNull();
    expect(result?.hints.map((hint) => hint.position)).toEqual([1, 2, 3, 4, 5]);
    expect(result?.examples).toHaveLength(2);
    expect(result?.solutions).toHaveLength(2);
    expect(result?.starterCode.length).toBeGreaterThan(0);
    expect(result?.related.map((item) => item.slug)).toEqual(["parcel-checkpoints"]);
    const fallback = await queryProblem(db, "parcel-checkpoints", null);
    expect(fallback?.related.map((item) => item.slug)).toContain("relay-window");
    expect(fallback?.related.every((item) => !privateSlugs.includes(item.slug) && item.slug !== "parcel-checkpoints")).toBe(true);
    expect(Object.keys(result!).sort()).toEqual(["slug", "title", "difficulty", "kind", "pattern", "statement", "constraints", "estimatedMinutes", "categories", "tags", "examples", "hints", "solutions", "starterCode", "related", "personal"].sort());
    const json = JSON.stringify(result);
    for (const forbidden of [hiddenSentinel, "Private detail", "testCases", "seedHash", '"id":', '"userId":', '"problemId":']) expect(json).not.toContain(forbidden);
  });
  it("denies draft, archived and missing detail reads and writes", async () => {
    for (const unavailable of [...privateSlugs, "not-a-problem"]) {
      expect(await queryProblem(db, unavailable, users[0])).toBeNull();
      expect(await writeProblemChange(db, users[0], { slug: unavailable, operation: "mark-solved" })).toBe("not-found");
      expect(await writeProblemChange(db, users[0], { slug: unavailable, operation: "save-note", content: "private", expectedContent: "" })).toBe("not-found");
    }
    expect(await db.userProgress.count()).toBe(0);
    expect(await db.userNote.count()).toBe(0);
  });
  it("isolates notes and progress between two verified users and guests", async () => {
    await writeProblemChange(db, users[0], { slug, operation: "save-note", content: "Owner A private note", expectedContent: "" });
    await writeProblemChange(db, users[0], { slug, operation: "mark-solved" });
    await writeProblemChange(db, users[1], { slug, operation: "save-note", content: "Owner B private note", expectedContent: "" });
    const first = await queryProblem(db, slug, users[0]);
    const second = await queryProblem(db, slug, users[1]);
    expect(first?.personal).toMatchObject({ note: "Owner A private note", progress: { status: "SOLVED", selfMarked: true } });
    expect(second?.personal).toMatchObject({ note: "Owner B private note", progress: { status: "NOT_STARTED" } });
    expect(JSON.stringify(await queryProblem(db, slug, null))).not.toContain("private note");
    expect(JSON.stringify(second)).not.toContain("Owner A");
  });
  it("handles concurrent first progress writes without losing independent fields or duplicating rows", async () => {
    await Promise.all([
      writeProblemChange(db, users[0], { slug, operation: "mark-solved" }),
      writeProblemChange(db, users[0], { slug, operation: "set-review", review: "true" }),
      writeProblemChange(db, users[0], { slug, operation: "mark-solved" }),
    ]);
    const before = await progress();
    expect(before).toMatchObject({ status: "SOLVED", selfMarked: true, reviewLater: true });
    expect(await db.userProgress.count()).toBe(1);
    await writeProblemChange(db, users[0], { slug, operation: "mark-solved" });
    expect((await progress()).solvedAt).toEqual(before.solvedAt);
    await writeProblemChange(db, users[0], { slug, operation: "set-review", review: "false" });
    expect(await progress()).toMatchObject({ status: "SOLVED", reviewLater: false });
  });
  it("undoes manual solves while preserving review flags and previous attempt status", async () => {
    await writeProblemChange(db, users[0], { slug, operation: "mark-solved" });
    await writeProblemChange(db, users[0], { slug, operation: "set-review", review: "true" });
    await writeProblemChange(db, users[0], { slug, operation: "clear-solved" });
    expect(await progress()).toMatchObject({ status: "NOT_STARTED", selfMarked: false, solvedAt: null, reviewLater: true });
    await db.userProgress.updateMany({ where: { userId: users[0] }, data: { status: "ATTEMPTED", attemptedAt: new Date(), bookmarked: true } });
    await writeProblemChange(db, users[0], { slug, operation: "mark-solved" });
    await writeProblemChange(db, users[0], { slug, operation: "clear-solved" });
    expect(await progress()).toMatchObject({ status: "ATTEMPTED", solvedAt: null, bookmarked: true, reviewLater: true });
  });
  it("preserves a future verified solve's date and provenance", async () => {
    const solvedAt = new Date("2026-01-01T00:00:00Z");
    await db.userProgress.create({ data: { userId: users[0], problemId, status: "SOLVED", solvedAt, selfMarked: false } });
    await writeProblemChange(db, users[0], { slug, operation: "mark-solved" });
    await writeProblemChange(db, users[0], { slug, operation: "clear-solved" });
    expect(await progress()).toMatchObject({ status: "SOLVED", solvedAt, selfMarked: false });
  });
  it("rejects stale note edits, preserves whitespace, and supports explicit clearing", async () => {
    expect(await writeProblemChange(db, users[0], { slug, operation: "save-note", content: "  first\n", expectedContent: "" })).toBe("saved");
    expect(await writeProblemChange(db, users[0], { slug, operation: "save-note", content: "stale", expectedContent: "" })).toBe("conflict");
    expect((await queryProblem(db, slug, users[0]))?.personal?.note).toBe("  first\n");
    expect(await writeProblemChange(db, users[0], { slug, operation: "save-note", content: "", expectedContent: "  first\n" })).toBe("saved");
    expect((await queryProblem(db, slug, users[0]))?.personal?.note).toBe("");
  });
  it("allows only one of two concurrent note saves from the same baseline", async () => {
    const outcomes = await Promise.all(["one", "two"].map((content) => writeProblemChange(db, users[0], { slug, operation: "save-note", content, expectedContent: "" })));
    expect(outcomes.sort()).toEqual(["conflict", "saved"]);
    expect(await db.userNote.count()).toBe(1);
    expect(["one", "two"]).toContain((await queryProblem(db, slug, users[0]))?.personal?.note);
  });
});
```

### tests/problem-detail-boundary.test.ts

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ viewer: vi.fn(), db: vi.fn(), query: vi.fn(), write: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ getViewer: mocks.viewer }));
vi.mock("@/lib/prisma", () => ({ getDatabase: mocks.db }));
vi.mock("@/features/problems/detail-query", () => ({ queryProblem: mocks.query }));
vi.mock("@/features/problems/detail-write", () => ({ writeProblemChange: mocks.write }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { loadProblem } from "@/features/problems/detail-load";
import { updateProblem } from "@/features/problems/detail-actions";

function form(values: Record<string, string | undefined> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ slug: "relay-window", operation: "mark-solved", ...values })) if (value !== undefined) data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/algosprint_test");
  mocks.viewer.mockResolvedValue({ id: "verified-user", role: "USER" });
  mocks.db.mockReturnValue("trusted-db");
  mocks.query.mockResolvedValue({ slug: "relay-window" });
  mocks.write.mockResolvedValue("saved");
});
afterEach(() => vi.unstubAllEnvs());

describe("problem page read boundary", () => {
  it("rejects malformed slugs before any identity or database calls", async () => {
    for (const slug of ["../admin", "UPPER", "x".repeat(101), "a/b", "bad--slug"]) expect((await loadProblem(slug)).kind).toBe("not-found");
    expect(mocks.viewer).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("handles missing configuration without accessing data", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect((await loadProblem("relay-window")).kind).toBe("unavailable");
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("gets identity and roles from the verified session and supports guests", async () => {
    expect(await loadProblem("relay-window")).toMatchObject({ kind: "ready", signedIn: true, admin: false });
    expect(mocks.query).toHaveBeenLastCalledWith("trusted-db", "relay-window", "verified-user");
    mocks.viewer.mockResolvedValue(null);
    expect(await loadProblem("relay-window")).toMatchObject({ kind: "ready", signedIn: false });
    expect(mocks.query).toHaveBeenLastCalledWith("trusted-db", "relay-window", null);
  });
  it("maps missing/unpublished data to not-found and fails closed on provider errors", async () => {
    mocks.query.mockResolvedValue(null);
    expect((await loadProblem("relay-window")).kind).toBe("not-found");
    mocks.query.mockClear();
    mocks.viewer.mockRejectedValue(new Error("Provider unavailable"));
    await expect(loadProblem("relay-window")).rejects.toThrow("Provider unavailable");
    expect(mocks.query).not.toHaveBeenCalled();
  });
});

describe("personal problem action boundary", () => {
  it("validates operations, values and note limits before any writes", async () => {
    for (const values of [
      { operation: "delete-problem" }, { slug: "../admin" }, { operation: "set-review", review: "yes" },
      { operation: "save-note", content: "x".repeat(10_001), expectedContent: "" },
      { operation: "save-note", content: "bad\u0000text", expectedContent: "" },
      { operation: "save-note", content: "new" },
    ]) expect((await updateProblem({}, form(values))).success).toBe(false);
    expect(mocks.viewer).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("denies anonymous or expired sessions even when IDs and roles are forged", async () => {
    mocks.viewer.mockResolvedValue(null);
    expect((await updateProblem({}, form({ userId: "another", role: "ADMIN" }))).message).toContain("Sign in again");
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("uses only the verified owner and revalidates the affected public routes after success", async () => {
    expect((await updateProblem({}, form({ userId: "another", problemId: "another", role: "ADMIN" }))).success).toBe(true);
    expect(mocks.write).toHaveBeenCalledWith("trusted-db", "verified-user", { slug: "relay-window", operation: "mark-solved" });
    expect(mocks.revalidate.mock.calls).toEqual([["/problems/relay-window"], ["/problems"]]);
  });
  it("does not falsely report or revalidate missing problems and stale saves", async () => {
    mocks.write.mockResolvedValue("not-found");
    expect((await updateProblem({}, form())).message).toContain("no longer available");
    mocks.write.mockResolvedValue("conflict");
    expect((await updateProblem({}, form({ operation: "save-note", content: "new", expectedContent: "old" }))).message).toContain("another tab");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("preserves note whitespace, supports clearing, and returns only the saved note", async () => {
    for (const content of ["  reasoning\n", "", "x".repeat(10_000)]) {
      const result = await updateProblem({}, form({ operation: "save-note", content, expectedContent: "" }));
      expect(result).toMatchObject({ success: true, savedContent: content });
      expect(Object.keys(result).sort()).toEqual(["message", "savedContent", "success"]);
    }
  });
  it("masks provider/database details and never reports a failed write as saved", async () => {
    mocks.write.mockRejectedValue(new Error("private database secret"));
    expect(await updateProblem({}, form())).toEqual({ success: false, message: "Could not save your change. Please try again." });
    mocks.viewer.mockRejectedValue(new Error("private token"));
    expect((await updateProblem({}, form())).message).not.toContain("private");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
```
