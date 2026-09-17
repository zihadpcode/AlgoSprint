# Phase 11 — Paused implementation guide and source checkpoint

> **PAUSED on 2026-09-17 at the user's request: “pause and update.” Phase 11 is unfinished and must remain unmerged.** This document records the implementation so far and all 25 complete source/test files; the behavior below still needs the outstanding integration verification.
>
> [CI 35260491494](https://github.com/zihadpcode/AlgoSprint/actions/runs/35260491494) passed 123 unit/component/migration tests and 38 existing PostgreSQL tests, but the new saved-collections suite failed in setup: its PUBLISHED problem fixtures omit publishedAt, violating Problem_published_check. All six new integration tests were skipped. Fix the fixtures only after resume, then rerun the full workflow. Later CI lint/types/build/HTTP steps were skipped; earlier local checks passed.

## 🟦 What this phase builds

AlgoSprint now has three protected personal collections: `/notes`, `/bookmarks`, and `/review`. Each includes title search, ten problems per page, stable ordering and empty states. The notes manager edits and deletes existing notes inline. New notes are created from a problem's existing notes form. Bookmark and review controls work on both problem pages and collection pages.

Bookmarks are a saved collection, review later is a separate learning intention, and solved/verified progress remains independent. Marking a bookmark does not mark a problem attempted or solved. Removing a bookmark does not remove a review flag or a note.

This phase uses the existing UserNote and UserProgress models. No schema migration, dependency or seed content is added. Phase 12 roadmaps remains unstarted.

## 🟨 Routes and user flow

| Route | What appears | Available actions |
| --- | --- | --- |
| `/notes` | Your nonempty saved notes on published problems | Edit/save, discard local changes, delete saved note, bookmark/review controls |
| `/bookmarks` | Published problems you bookmarked | Remove bookmark, change review flag, open problem |
| `/review` | Published problems marked for review | Remove review flag, change bookmark, open problem |
| `/problems/[slug]` | Existing learning content and private controls after sign-in | Create/edit/delete note, bookmark, review and existing progress controls |

Collection links appear in workspace navigation and as tabs on each manager page. Search matches problem titles, not note contents. Results are ordered by title then slug. Search resets the page; pagination links preserve the search. A request past the last page is clamped to the last existing page, so deleting the last item on a page does not strand the user on an empty out-of-range page.

Empty saved collections and searches with no matches have different explanations and working links. Only published problems are shown. If content is archived, notes and flags remain stored privately but are absent from these screens and cannot be modified through the published-problem action until that problem is available again. There is no bulk deletion, trash bin, autosave or note export in this phase.

## 🟦 Read architecture

1. Each dynamic route awaits its searchParams, then calls `loadSaved` with a trusted collection kind.
2. The loader normalizes the title query and page number, constructs a local return URL, and verifies the viewer before obtaining the database connection.
3. `querySaved` combines published status with the authenticated owner's note/flag predicate. An administrator still queries only their own records.
4. Inside one Repeatable Read transaction it counts matches, clamps the page, and selects at most ten minimal problem records. This keeps count and page consistent during concurrent changes.
5. The returned DTO has title, slug, difficulty, public progress labels and the owner's flags. Note contents are selected only for the notes view. Bookmark/review queries do not fetch note bodies. No statement, test case, source code, seed metadata, operational user/problem ID or another owner's note is returned.
6. `SavedCollectionPage` renders the shared frame, search, pagination, cards and client action forms. The same forms are reused on problem pages.

`parseSavedFilters` removes control characters, trims and limits queries to 100 characters, rejects array values and accepts only bounded positive integer page syntax. The database count clamps the actual offset. `savedHref` uses URLSearchParams rather than interpolating raw query text. The safe-return allowlist now includes bookmarks and progress, so their confirmed sign-in flow can return to the intended local page.

All new routes are in the cookie-refresh proxy matcher. Each page separately verifies identity near the read; navigation visibility and cookie refresh are not authorization. Protected pages have noindex metadata. No cross-user or global cache is introduced.

## 🟩 Bookmark and review writes

The existing `problemChange` Zod union adds `set-bookmark` with an explicit string boolean, and `delete-note` with the last saved note content. The action copies only known form fields. Browser-supplied owner IDs, roles or internal problem IDs are ignored; the authenticated viewer supplies ownership.

`writeProblemChange` first locks the published problem row with a shared lock. An archived or missing problem returns unavailable rather than accepting the write. Flag changes reuse the existing `writeProgress` helper, which inserts the owner/problem row if needed and locks it with FOR UPDATE. It updates only the changed flag, preserving manual/verified solves, attempt/solve dates, notes and unrelated flags. Identical repeated flag requests do not change updatedAt.

Buttons submit the desired boolean rather than blindly toggling server state. Stale flag forms use last successful explicit write wins; they do not have note-style conflict detection. Their operations remain independent and repeatable.

Successful personal writes revalidate the problem detail, library, progress, dashboard and all three saved collections. Successful execution writes also refresh collection progress labels. Failed or conflicted writes do not report success or revalidate as though a save occurred.

## 🟩 Notes: save, conflict, clear and delete

A note form has two separate values: the editable draft and this tab's last confirmed saved content. The latter is sent as expectedContent. Both are limited to 10,000 characters with no null characters; whitespace is preserved. Re-rendering from unrelated progress changes does not replace the local draft or its saved baseline with another tab's content.

All note saves/deletions use a short transaction advisory lock keyed by the owner/problem pair. PostgreSQL hashes that parameterized key to a lock ID. This covers even a missing note row, where a normal row lock could not coordinate first saves with deletions. Hash collisions can serialize unrelated note writes but do not change the ownership predicate. No external provider request holds this lock.

After acquiring the lock, the helper reads the current owner note:

| Request/state | Result |
| --- | --- |
| New note with empty baseline | Create the note |
| Existing note equals expectedContent | Save the new content |
| Existing content differs from baseline | Return conflict; preserve the saved note |
| Same content saved again | Success without rewriting the timestamp |
| Delete or save empty content with a matching existing baseline | Physically remove that owner's UserNote row |
| Repeat delete/clear after the row is absent | Success without recreating a placeholder |
| Save from a stale nonempty baseline after deletion | Conflict; do not create an empty row |

Save and delete on the same baseline serialize. Either the new edit wins and the stale delete conflicts, or deletion wins and the stale edit conflicts. This replaces the earlier temporary-empty-row creation approach. It preserves the content comparison behavior while avoiding empty placeholder rows left by a losing save.

The UI explicitly labels Delete saved note. It is disabled when the local draft differs from the saved baseline. Save or Discard unsaved changes first. Discard only resets this browser's draft; it does not write to the server. A confirmed deletion resets both draft and baseline. Conflict or an unconfirmed network response retains the draft and explains how to copy it and reload before retrying. No exception details are shown.

Saving an empty note is also an explicit clear and physically removes the row. Older blank rows are simply excluded from the manager until edited/deleted through the existing problem form. Notes consisting of whitespace are preserved rather than silently normalized.

## 🟨 Files and connections

| Area | Responsibility |
| --- | --- |
| `src/features/saved/filters.ts` | Bounded title/page parsing and safe collection links |
| `src/features/saved/load.ts` | Verified viewer and owner-only query boundary |
| `src/features/saved/query.ts` | Snapshot count/page query with minimal projections |
| Three `src/app/*/page.tsx` files | Protected route entry points |
| `saved-collection.tsx` | Shared manager layout, cards, search and pagination |
| `saved-flags.tsx` | Bookmark/review forms and pending/status feedback |
| Existing personal controls/actions/writes | Shared note editor, deletion, validation, locking and revalidation |
| Existing progress writer | Independent bookmark event alongside review and solve events |
| Proxy, safe-return validation and navigation | Reachability, session refresh and valid return destinations |
| Tests and HTTP smoke | Ownership, stale writes, concurrency, pagination and route protection |

## 🟦 Run on your Mac

Use Node.js 24 and your authenticated checkout. Preserve uncommitted changes before updating:

```bash
git fetch origin
git switch main
git pull --ff-only
npm ci
```

If PR #12 is still open, switch to `algosprint/phase-11-notes-bookmarks` until the verified phase is merged. Preserve your configured `.env.local`. Only copy `.env.example` if configuration has not been created yet. Follow Phase 3 for a development PostgreSQL/Supabase project, APP_URL and confirmed email account.

Phase 11 has no new migration. A database from before Phase 9 still needs the existing migrations. Verify DATABASE_URL and any DIRECT_URL refer to the intended development database; do not reset valuable data.

```bash
npm run db:deploy
npm run db:generate
npm run db:seed
npm run dev
```

Open a problem, save a note, and click Bookmark or Review later. Visit the corresponding manager. Judge0 is not needed for notes, bookmarks or review; use the Phase 8 live-check guide before enabling execution. Later deployment must run a consistent version of the note writer across application instances so all writes follow the shared locking protocol.

## 🟨 Automated verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:smoke
```

The new loader/filter tests cover malformed pagination, bounded search, safe return URLs, administrator ownership and guest denial. Action tests validate boolean/delete inputs and ignore forged owner fields. React component tests cover confirmed deletion, draft/baseline preservation across re-renders, conflicts, unconfirmed responses, dirty-draft protection and local discard.

Six new PostgreSQL integration tests verify owner-only note/flag projections; conditional deletion and repeated clears; concurrent save/delete; verified-solve preservation and repeated bookmark timestamps; ten-item pagination/search/clamping; and archived/blank-note behavior. The existing concurrent first-save, progress, dashboard and submission tests also rerun.

`npm run test:integration` requires the established empty disposable database ending in `_test`, TEST_DATABASE_URL and migrations applied to that same database. GitHub CI supplies PostgreSQL 17, then checks migrations, seed validation/seeding, lint/types/build and both HTTP smoke scripts. The protected smoke now includes `/notes`, `/bookmarks` and `/review`, including forged guest cookies. See PR #12 for exact final head, CI and merge-tree evidence.

## 🟥 Manual verification still required

1. Sign out and visit each new route; verify redirection. Sign in with a confirmed account and check the return path, including a title query/page. Repeat with expired credentials.
2. As account A, create a note and bookmark/review a problem. As B, confirm A's lists and notes are absent. Administrators must also see only their own records.
3. Edit a note in two tabs. Save one, then attempt to save/delete the stale baseline in the other; expect conflict. Copy unsaved work before reloading.
4. Type a draft, verify deletion is disabled, discard it, then delete the saved note. Verify the manager removes the item and the problem page shows an empty note. Repeat clearing/deletion without creating a blank entry.
5. Toggle bookmark and review independently on a verified solve. Check its solve label/date remain intact. Verify dashboard/progress/review list updates.
6. With more than ten saved problems in a disposable fixture, test search, next/previous pages and deletion on the last page. Save drafts before changing filters or pages.
7. Check keyboard focus, pending controls, textarea sizing, status announcements, narrow widths and 200% zoom. Test network interruption while saving; do not assume an unconfirmed save failed on the server.
8. Recheck the existing editor/Monaco draft retention and action refresh with a configured development runner. Complete earlier live Supabase/Judge0 checks separately.

No live Supabase/Judge0 workflow, real browser visual/keyboard/screen-reader QA, production migration or deployment was performed. Component and HTTP tests do not establish those live behaviors. Archived notes remain in storage but unavailable in these published-content managers. The app has no deleted-note recovery or automatic draft persistence across navigation.

## 🟨 Common mistakes

- Treating bookmarks, review flags and solves as the same status.
- Trusting a client-supplied user ID or assuming admins should see everyone else's notes.
- Deleting a note without checking the saved baseline.
- Locking only existing note rows and forgetting concurrent creation/deletion.
- Replacing the local draft when unrelated server-rendered props refresh.
- Reporting an unconfirmed network response as a confirmed failure or success.
- Selecting all problem/user fields when a saved list needs only a small projection.
- Discarding unsaved drafts by navigating pages before saving.

## 🟩 Complete source files

The following 25 files are all source/test/script changes in Phase 11. Generated Prisma files and unchanged shared components remain in the repository. Status documents are maintained separately.

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
  for (const path of ["/dashboard", "/progress", "/profile", "/admin", "/notes", "/bookmarks", "/review"]) {
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

### `src/app/bookmarks/page.tsx`

```tsx
import type { Metadata } from "next";
import { loadSaved } from "@/features/saved/load";
import { SavedCollectionPage } from "@/components/saved/saved-collection";

export const metadata: Metadata = { title: "Your bookmarks", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const data = await loadSaved("bookmarks", await searchParams);
  return <SavedCollectionPage kind="bookmarks" {...data} />;
}
```

### `src/app/notes/page.tsx`

```tsx
import type { Metadata } from "next";
import { loadSaved } from "@/features/saved/load";
import { SavedCollectionPage } from "@/components/saved/saved-collection";

export const metadata: Metadata = { title: "Your notes", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const data = await loadSaved("notes", await searchParams);
  return <SavedCollectionPage kind="notes" {...data} />;
}
```

### `src/app/problems/[slug]/page.tsx`

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
import { CodeEditor } from "@/components/editor/code-editor";
import { ProblemNotes, ProgressControls } from "@/components/problems/personal-controls";
import { getRunnerConfig } from "@/features/submissions/config";
import { runnerSupports } from "@/features/submissions/harness";
import { loadProblem } from "@/features/problems/detail-load";

export const metadata: Metadata = { title: "Problem practice", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
      {[["statement", "Statement"], ["examples", "Examples"], ["constraints", "Constraints"], ["editor", "Code editor"], ["hints", "Hints"], ["solutions", "Solutions"], ["starter", "Starter code"], ["notes", "Notes"]].map(([id, label]) => <a key={id} href={`#${id}`} className="underline underline-offset-4">{label}</a>)}
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
        <Card id="editor"><CardTitle>Code editor</CardTitle><CodeEditor key={problem.slug} starters={problem.starterCode} examples={problem.examples} slug={problem.slug} signedIn={view.signedIn} runnerEnabled={Boolean(getRunnerConfig()) && runnerSupports(problem.slug)} /></Card>
        <Card id="hints"><CardTitle>Layered hints</CardTitle><HintReveal key={problem.slug} hints={problem.hints} /></Card>
        <Card id="solutions"><CardTitle>Guided solutions</CardTitle><SolutionTabs key={problem.slug} solutions={problem.solutions} /></Card>
      </div>
      <aside aria-label="Practice tools" className="min-w-0 space-y-6">
        <Card><CardTitle>Your progress</CardTitle>{problem.personal ? <ProgressControls slug={problem.slug} progress={problem.personal.progress} bookmarked={problem.personal.bookmarked} /> :
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

### `src/app/review/page.tsx`

```tsx
import type { Metadata } from "next";
import { loadSaved } from "@/features/saved/load";
import { SavedCollectionPage } from "@/components/saved/saved-collection";

export const metadata: Metadata = { title: "Review later", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const data = await loadSaved("review", await searchParams);
  return <SavedCollectionPage kind="review" {...data} />;
}
```

### `src/components/layout/workspace-nav.tsx`

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UserRound, ShieldCheck, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
const links = [ { href: "/problems", label: "Problems", icon: BookOpen }, { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, { href: "/progress", label: "Progress", icon: BookOpen }, { href: "/notes", label: "Notes", icon: BookOpen }, { href: "/bookmarks", label: "Bookmarks", icon: BookOpen }, { href: "/review", label: "Review later", icon: BookOpen }, { href: "/profile", label: "Profile", icon: UserRound } ];
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
```

### `src/components/problems/personal-controls.tsx`

```tsx
"use client";

import { useActionState, useId, useState } from "react";
import { updateProblem } from "@/features/problems/detail-actions";
import { NOTE_LIMIT, type ProblemActionState } from "@/features/problems/detail-validation";
import type { ProblemDetail } from "@/features/problems/detail-query";
import { SubmitButton } from "@/components/ui/submit-button";
import { progressLabel } from "@/features/progress/presentation";
import { SavedFlags } from "@/components/saved/saved-flags";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const initial: ProblemActionState = {};

export function ProgressControls({ slug, progress, bookmarked = false }: { slug: string; bookmarked?: boolean; progress: NonNullable<ProblemDetail["personal"]>["progress"] }) {
  const [state, action, pending] = useActionState(updateProblem, initial);
  const solved = progress.status === "SOLVED";
  return <div className="mt-4 space-y-4">
    <div className="flex flex-wrap gap-2"><Badge tone="accent">{progressLabel(progress)}</Badge>
      {progress.reviewLater && <Badge tone="warm">Review later</Badge>}
    </div>
    <p className="text-sm leading-7 text-muted">Manual marks record your own assessment. A verified solve requires passing the full suite for the current revision. Earlier verified solves remain in your history.</p>
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton name="operation" value="mark-attempted" variant="secondary" disabled={pending || progress.status !== "NOT_STARTED"} pendingLabel="Saving…">Mark attempted</SubmitButton>
        <SubmitButton name="operation" value={solved ? "clear-solved" : "mark-solved"} disabled={pending || (solved && !progress.selfMarked)} pendingLabel="Saving…">
          {solved ? progress.selfMarked ? "Undo manual solve" : "Solved" : "Mark solved"}
        </SubmitButton>

      </div>
    </form>
    <ActionMessage state={state} />
    <SavedFlags slug={slug} bookmarked={bookmarked} reviewLater={progress.reviewLater} />
  </div>;
}

export function ProblemNotes({ slug, note }: { slug: string; note: string }) {
  const [draft, setDraft] = useState(note);
  const [state, action, pending] = useActionState(async (previous: ProblemActionState, form: FormData) => {
    let result: ProblemActionState;
    try { result = await updateProblem(previous, form); }
    catch { return { success: false, message: "Could not confirm the save. Keep a copy of your draft, then reload to check the saved note.", savedContent: previous.savedContent }; }
    if (result.success && form.get("operation") === "delete-note") setDraft("");
    // Keep this tab's last saved baseline on errors and unrelated page refreshes.
    return { ...result, savedContent: result.success ? result.savedContent : previous.savedContent };
  }, { savedContent: note });
  const id = useId();
  return <form action={action} className="mt-4 space-y-4">
    <input type="hidden" name="slug" value={slug} />
    <input type="hidden" name="expectedContent" value={state.savedContent ?? ""} />
    <label htmlFor={id} className="block text-sm text-muted">Private notes · record an insight, a mistake, or a question to revisit.</label>
    <textarea id={id} name="content" rows={9} maxLength={NOTE_LIMIT} value={draft} readOnly={pending}
      aria-describedby={`${id}-help`} onChange={(event) => setDraft(event.target.value)}
      className="w-full resize-y rounded-xl border border-muted/60 bg-canvas p-4 text-sm leading-7 text-ink" />
    <p id={`${id}-help`} className="text-xs leading-6 text-muted">{draft.length.toLocaleString("en-US")} / 10,000 characters. Save explicitly before leaving. Save an empty note to clear it.</p>
    <div className="flex flex-wrap gap-3">
      <SubmitButton name="operation" value="save-note" pendingLabel="Saving note…" disabled={pending}>Save note</SubmitButton>
      <Button type="button" variant="secondary" disabled={pending || draft === (state.savedContent ?? "")} onClick={() => setDraft(state.savedContent ?? "")}>Discard unsaved changes</Button>
      <SubmitButton name="operation" value="delete-note" variant="secondary" pendingLabel="Deleting…" disabled={pending || !state.savedContent || draft !== state.savedContent}>Delete saved note</SubmitButton>
    </div>
    <p className="text-xs text-muted">Save or discard unsaved changes before deleting. Deletion removes the saved note.</p>
    <ActionMessage state={state} />
  </form>;
}
function ActionMessage({ state }: { state: ProblemActionState }) {
  return <p role="status" aria-atomic="true" className={`text-sm leading-7 ${state.success === false ? "text-warm" : "text-accent"}`}>{state.message ?? ""}</p>;
}
```

### `src/components/saved/saved-collection.tsx`

```tsx
import Link from "next/link";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProblemNotes } from "@/components/problems/personal-controls";
import { SavedFlags } from "./saved-flags";
import { progressLabel } from "@/features/progress/presentation";
import { savedHref, type SavedKind } from "@/features/saved/filters";
import type { SavedCollection } from "@/features/saved/query";

const labels = { notes: "Your notes", bookmarks: "Your bookmarks", review: "Review later" };
export function SavedCollectionPage({ kind, admin, collection }: { kind: SavedKind; admin: boolean; collection: SavedCollection }) {
  return <AccountFrame admin={admin}>
    <PageHeading eyebrow="Your saved practice" title={labels[kind]} description="Keep useful problems and your own learning notes close at hand. Only your saved items for published problems appear here." action={<ButtonLink href="/problems">Browse problems</ButtonLink>} />
    <nav aria-label="Saved practice collections" className="mb-6 flex flex-wrap gap-4">{(["notes", "bookmarks", "review"] as const).map((tab) => <Link key={tab} href={`/${tab}`} aria-current={kind === tab ? "page" : undefined} className="text-sm text-accent underline underline-offset-4">{labels[tab]}</Link>)}</nav>
    <form action={`/${kind}`} method="get" className="mb-6 flex flex-wrap items-end gap-3">
      <div><label htmlFor="saved-search" className="mb-2 block text-sm">Search problem titles</label><input key={collection.q} id="saved-search" name="q" defaultValue={collection.q} maxLength={100} className="max-w-full rounded-xl border border-line bg-canvas px-4 py-3" /></div>
      <Button type="submit">Search</Button>{collection.q && <ButtonLink href={`/${kind}`} variant="secondary">Clear search</ButtonLink>}
    </form>
    <p className="mb-5 text-sm text-muted">{collection.total} saved {collection.total === 1 ? "problem" : "problems"} · Page {collection.page} of {collection.pages}. Ordered by title. Save note edits before changing pages or searching.</p>
    {!collection.items.length ? <EmptyState title={collection.q ? "No matching saved problems" : "Nothing saved here yet"} description={collection.q ? "Try another title or clear the search." : kind === "notes" ? "Open a problem and save a private note. You can edit or delete saved notes here." : kind === "bookmarks" ? "Open a problem and choose Bookmark to keep it in this list." : "Open a problem and choose Review later when you want to revisit it."} action={<ButtonLink href={collection.q ? `/${kind}` : "/problems"}>{collection.q ? "Clear search" : "Choose a problem"}</ButtonLink>} />
      : <div className="space-y-6">{collection.items.map((item) => <Card key={item.slug}>
        <h2 className="text-xl font-semibold"><Link href={`/problems/${item.slug}`} className="text-accent underline underline-offset-4">{item.title}</Link></h2>
        <p className="mt-3 text-sm text-muted">{item.difficulty} · {progressLabel(item.progress)}</p>
        <SavedFlags slug={item.slug} bookmarked={item.bookmarked} reviewLater={item.progress.reviewLater} />
        {kind === "notes" && <ProblemNotes slug={item.slug} note={item.note} />}
      </Card>)}</div>}
    {collection.pages > 1 && <nav aria-label="Saved problems pages" className="mt-6 flex gap-3">
      {collection.page > 1 && <ButtonLink href={savedHref(kind, { q: collection.q, page: collection.page - 1 })} variant="secondary">Previous page</ButtonLink>}
      {collection.page < collection.pages && <ButtonLink href={savedHref(kind, { q: collection.q, page: collection.page + 1 })} variant="secondary">Next page</ButtonLink>}
    </nav>}
  </AccountFrame>;
}
```

### `src/components/saved/saved-flags.tsx`

```tsx
"use client";
import { useActionState } from "react";
import { updateProblem } from "@/features/problems/detail-actions";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ProblemActionState } from "@/features/problems/detail-validation";

export function SavedFlags({ slug, bookmarked, reviewLater }: { slug: string; bookmarked: boolean; reviewLater: boolean }) {
  const [state, action, pending] = useActionState(updateProblem, {} as ProblemActionState);
  return <div className="mt-4 space-y-3">
    <p className="text-sm text-muted">{bookmarked ? "Bookmarked" : "Not bookmarked"} · {reviewLater ? "Marked for review" : "Not marked for review"}</p>
    <form action={action} className="flex flex-wrap gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="bookmarked" value={String(!bookmarked)} />
      <input type="hidden" name="review" value={String(!reviewLater)} />
      <SubmitButton name="operation" value="set-bookmark" variant="secondary" disabled={pending} pendingLabel="Saving…">{bookmarked ? "Remove bookmark" : "Bookmark"}</SubmitButton>
      <SubmitButton name="operation" value="set-review" variant="secondary" disabled={pending} pendingLabel="Saving…">{reviewLater ? "Remove from review" : "Review later"}</SubmitButton>
    </form>
    <p role="status" aria-atomic="true" className="text-sm text-accent">{state.message ?? ""}</p>
  </div>;
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
  if (!/^\/(?:dashboard|progress|bookmarks|profile|problems|roadmaps|notes|review|admin|mock-interview)(?:\/[a-zA-Z0-9_-]+)*(?:\?[^#\\\u0000-\u001f\u007f]*)?$/.test(value)) return "/dashboard";
  return value;
}

export type AuthFormState = {
  message?: string;
  success?: boolean;
  errors?: Partial<Record<"email" | "password" | "displayName", string[]>>;
};
```

### `src/features/problems/detail-actions.ts`

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
    slug: form.get("slug"), operation: form.get("operation"), review: form.get("review"), bookmarked: form.get("bookmarked"),
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
  revalidatePath("/progress");
  revalidatePath("/dashboard");
  revalidatePath("/notes");
  revalidatePath("/bookmarks");
  revalidatePath("/review");
  if (input.data.operation === "delete-note") return { success: true, message: "Note deleted.", savedContent: "" };
  if (input.data.operation === "save-note") return { success: true, message: input.data.content ? "Note saved." : "Note cleared.", savedContent: input.data.content };
  return { success: true, message: input.data.operation === "set-bookmark" ? "Bookmark updated." : "Progress updated." };
}
```

### `src/features/problems/detail-query.ts`

```ts
import "server-only";
import { progressView } from "@/features/progress/presentation";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

// An allowlist, never include:true: hidden tests and operational fields stay server-side.
const detailSelect = {
  id: true, revision: true, slug: true, title: true, difficulty: true, kind: true, pattern: true,
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
    const { id, revision, categories, tags, related, ...content } = row;
    const relatedProblems = related.length ? related.map((item) => item.related) : await tx.problem.findMany({
      where: { status: "PUBLISHED", slug: { not: slug }, categories: { some: { category: { slug: { in: categories.map((item) => item.category.slug) } } } } },
      select: { slug: true, title: true, difficulty: true }, orderBy: { slug: "asc" }, take: 3,
    });
    const savedProgress = viewerId ? await tx.userProgress.findUnique({
      where: { userId_problemId: { userId: viewerId, problemId: id } },
      select: { status: true, reviewLater: true, selfMarked: true, verifiedRevision: true, bookmarked: true },
    }) : null;
    const personal = viewerId ? {
      progress: progressView(savedProgress, revision), bookmarked: savedProgress?.bookmarked ?? false,
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

### `src/features/problems/detail-validation.ts`

```ts
import { z } from "zod";

export const problemSlug = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const NOTE_LIMIT = 10_000;
const noteText = z.string().max(NOTE_LIMIT).refine((text) => !text.includes("\u0000"), "Remove null characters.");
export const problemChange = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("mark-attempted"), slug: problemSlug }),
  z.object({ operation: z.literal("mark-solved"), slug: problemSlug }),
  z.object({ operation: z.literal("clear-solved"), slug: problemSlug }),
  z.object({ operation: z.literal("set-review"), slug: problemSlug, review: z.enum(["true", "false"]) }),
  z.object({ operation: z.literal("set-bookmark"), slug: problemSlug, bookmarked: z.enum(["true", "false"]) }),
  z.object({ operation: z.literal("save-note"), slug: problemSlug, content: noteText, expectedContent: noteText }),
  z.object({ operation: z.literal("delete-note"), slug: problemSlug, expectedContent: noteText }),
]);
export type ProblemChange = z.infer<typeof problemChange>;
export type ProblemActionState = { success?: boolean; message?: string; savedContent?: string };
```

### `src/features/problems/detail-write.ts`

```ts
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { writeProgress } from "@/features/progress/write";
import type { ProblemChange } from "./detail-validation";

// Trusted helper: caller must validate input and verify the user before entering.
export async function writeProblemChange(db: PrismaClient, userId: string, change: ProblemChange) {
  if (!userId) throw new Error("Verified viewer required");
  return db.$transaction(async (tx) => {
    // Parameterized SQL. A shared row lock prevents archival during the write.
    const [problem] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM app."Problem" WHERE slug = ${change.slug} AND status = 'PUBLISHED' FOR SHARE
    `;
    if (!problem) return "not-found" as const;
    const owner = { userId, problemId: problem.id };
    if (change.operation === "save-note" || change.operation === "delete-note") {
      // A transaction lock also covers a missing note, so save/delete cannot race
      // through a temporary placeholder row. No external requests hold this lock.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`note:${userId}:${problem.id}`}, 0))`;
      const existing = await tx.userNote.findUnique({ where: { userId_problemId: owner }, select: { content: true } });
      const removing = change.operation === "delete-note" || change.content === "";
      if (removing && !existing) return "saved" as const;
      if ((existing?.content ?? "") !== change.expectedContent) return "conflict" as const;
      if (removing) await tx.userNote.deleteMany({ where: owner });
      else if (change.operation === "save-note" && existing?.content !== change.content) {
        await tx.userNote.upsert({ where: { userId_problemId: owner }, create: { ...owner, content: change.content }, update: { content: change.content } });
      }
      return "saved" as const;
    }
    const at = new Date();
    if (change.operation === "set-review") await writeProgress(tx, userId, problem.id, { kind: "review", value: change.review === "true", at });
    else if (change.operation === "set-bookmark") await writeProgress(tx, userId, problem.id, { kind: "bookmark", value: change.bookmarked === "true", at });
    else await writeProgress(tx, userId, problem.id, { kind: change.operation === "mark-attempted" ? "attempt" : change.operation === "mark-solved" ? "manual-solve" : "clear-manual", at });
    return "saved" as const;
  });
}
```

### `src/features/progress/write.ts`

```ts
import "server-only";
import type { Prisma } from "@/generated/prisma/client";

type ProgressEvent = { kind: "attempt" | "manual-solve" | "clear-manual"; at: Date }
  | { kind: "review" | "bookmark"; value: boolean; at: Date }
  | { kind: "verified-solve"; revision: number; at: Date };

// Trusted transaction helper. Caller locks the problem first and verifies ownership.
// The same row lock serializes runner completion with manual solve/undo/review.
export async function writeProgress(tx: Prisma.TransactionClient, userId: string, problemId: string, event: ProgressEvent) {
  const owner = { userId, problemId };
  await tx.userProgress.createMany({ data: owner, skipDuplicates: true });
  await tx.$queryRaw`SELECT 1 FROM app."UserProgress" WHERE "userId" = ${userId}::uuid AND "problemId" = ${problemId}::uuid FOR UPDATE`;
  const row = await tx.userProgress.findUniqueOrThrow({ where: { userId_problemId: owner } });
  const data: Prisma.UserProgressUpdateManyMutationInput = {};
  if (event.kind === "attempt") {
    if (!row.attemptedAt || event.at < row.attemptedAt) data.attemptedAt = event.at;
    if (row.status === "NOT_STARTED") data.status = "ATTEMPTED";
  } else if (event.kind === "manual-solve" && row.status !== "SOLVED") {
    Object.assign(data, { status: "SOLVED", selfMarked: true, solvedAt: event.at });
  } else if (event.kind === "clear-manual" && row.status === "SOLVED" && row.selfMarked) {
    Object.assign(data, { status: row.attemptedAt ? "ATTEMPTED" : "NOT_STARTED", selfMarked: false, solvedAt: null });
  } else if (event.kind === "review" && row.reviewLater !== event.value) {
    data.reviewLater = event.value;
  } else if (event.kind === "bookmark" && row.bookmarked !== event.value) {
    data.bookmarked = event.value;
  } else if (event.kind === "verified-solve" && (row.verifiedRevision ?? 0) <= event.revision) {
    if (row.status !== "SOLVED") Object.assign(data, { status: "SOLVED", solvedAt: event.at });
    if (row.selfMarked) data.selfMarked = false;
    if (row.verifiedRevision !== event.revision) Object.assign(data, { verifiedRevision: event.revision, verifiedAt: event.at });
  }
  // Repeated marks/completions must not manufacture new activity timestamps.
  if (Object.keys(data).length) await tx.userProgress.updateMany({ where: owner, data });
}
```

### `src/features/saved/filters.ts`

```ts
export type SavedKind = "notes" | "bookmarks" | "review";
export type SavedFilters = { q: string; page: number };
export function parseSavedFilters(input: Record<string, string | string[] | undefined>): SavedFilters {
  const q = typeof input.q === "string" ? input.q.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 100) : "";
  const page = typeof input.page === "string" && /^[1-9][0-9]{0,5}$/.test(input.page) ? Number(input.page) : 1;
  return { q, page };
}
export function savedHref(kind: SavedKind, { q, page }: SavedFilters) {
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (page > 1) query.set("page", String(page));
  return `/${kind}${query.size ? `?${query}` : ""}`;
}
```

### `src/features/saved/load.ts`

```ts
import "server-only";
import { requireViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { parseSavedFilters, savedHref, type SavedKind } from "./filters";
import { querySaved } from "./query";

export async function loadSaved(kind: SavedKind, search: Record<string, string | string[] | undefined>) {
  const filters = parseSavedFilters(search);
  const viewer = await requireViewer(savedHref(kind, filters));
  return { admin: viewer.role === "ADMIN", collection: await querySaved(getDatabase(), viewer.id, kind, filters) };
}
```

### `src/features/saved/query.ts`

```ts
import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { progressView } from "@/features/progress/presentation";
import type { SavedFilters, SavedKind } from "./filters";

export async function querySaved(db: PrismaClient, userId: string, kind: SavedKind, filters: SavedFilters) {
  if (!userId) throw new Error("Verified viewer required");
  return db.$transaction(async (tx) => {
    const where: Prisma.ProblemWhereInput = { status: "PUBLISHED",
      ...(filters.q ? { title: { contains: filters.q, mode: "insensitive" } } : {}),
      ...(kind === "notes" ? { notes: { some: { userId, content: { not: "" } } } }
        : { progress: { some: { userId, ...(kind === "bookmarks" ? { bookmarked: true } : { reviewLater: true }) } } }),
    };
    const total = await tx.problem.count({ where });
    const pages = Math.max(1, Math.ceil(total / 10)); const page = Math.min(filters.page, pages);
    const rows = await tx.problem.findMany({ where, orderBy: [{ title: "asc" }, { slug: "asc" }], skip: (page - 1) * 10, take: 10,
      select: { slug: true, title: true, difficulty: true, revision: true,
        progress: { where: { userId }, select: { status: true, selfMarked: true, reviewLater: true, verifiedRevision: true, bookmarked: true } },
        ...(kind === "notes" ? { notes: { where: { userId }, select: { content: true }, take: 1 } } : {}),
      },
    });
    return { total, pages, page, q: filters.q, items: rows.map((row) => ({ slug: row.slug, title: row.title, difficulty: row.difficulty,
      progress: progressView(row.progress[0], row.revision), bookmarked: row.progress[0]?.bookmarked ?? false,
      note: kind === "notes" ? row.notes?.[0]?.content ?? "" : "",
    })) };
  }, { isolationLevel: "RepeatableRead" });
}
export type SavedCollection = Awaited<ReturnType<typeof querySaved>>;
```

### `src/features/submissions/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { executionInput, type ExecutionState } from "./contracts";
import { getRunnerConfig } from "./config";
import { runSubmission } from "./service";

export async function executeCode(raw: unknown): Promise<ExecutionState> {
  const parsed = executionInput.safeParse(raw);
  if (!parsed.success) return { success: false, message: "Choose JavaScript and enter 1–20,000 characters of code." };
  try {
    const viewer = await getViewer();
    if (!viewer) return { success: false, message: "Sign in with a confirmed account to run or submit code." };
    const config = getRunnerConfig();
    if (!config) return { success: false, message: "Code execution is not configured yet. Your draft is unchanged." };
    const outcome = await runSubmission(getDatabase(), viewer.id, parsed.data, config);
    if (outcome.success) {
      revalidatePath(`/problems/${parsed.data.slug}`);
      revalidatePath("/problems"); revalidatePath("/progress"); revalidatePath("/dashboard");
      revalidatePath("/notes"); revalidatePath("/bookmarks"); revalidatePath("/review");
    }
    return outcome;
  } catch {
    return { success: false, message: "Could not finish saving the execution result. Your draft is unchanged. A retry creates a new attempt." };
  }
}
```

### `src/proxy.ts`

```ts
import type { NextRequest } from "next/server";
import { refreshAuth } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return refreshAuth(request);
}

export const config = {
  matcher: ["/login", "/register", "/auth/:path*", "/dashboard/:path*", "/progress/:path*", "/profile/:path*", "/admin/:path*", "/problems/:path*", "/notes/:path*", "/bookmarks/:path*", "/review/:path*", "/roadmaps/:path*", "/mock-interview/:path*", "/interview-results/:path*", "/api/:path*"],
};
```

### `tests/integration/saved.test.ts`

```ts
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { querySaved } from "@/features/saved/query";
import { writeProblemChange } from "@/features/problems/detail-write";
import { queryProblem } from "@/features/problems/detail-query";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
let db: ReturnType<typeof createDatabaseClient>; let owns = false; let slugs: string[] = []; let problemId: string;
const users = [randomUUID(), randomUUID()]; const slug = "relay-window"; const filters = { q: "", page: 1 };
const extras = Array.from({ length: 12 }, (_, i) => `saved-fixture-${String(i).padStart(2, "0")}`);
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use an empty disposable TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url); if (await db.problem.count()) throw new Error("Saved tests require an empty collection.");
  const seeds = await loadProblems(); slugs = seeds.map((p) => p.slug); owns = true; await seedProblems(db, seeds);
  await db.user.createMany({ data: users.map((id) => ({ id })) });
  problemId = (await db.problem.findUniqueOrThrow({ where: { slug } })).id;
  await db.problem.createMany({ data: extras.map((slug) => ({ slug, title: slug, difficulty: "EASY" as const, status: "PUBLISHED" as const, pattern: "fixture", statement: "DO-NOT-EXPOSE", constraints: ["Fixture"], estimatedMinutes: 1 })) });
}, 30000);
beforeEach(async () => {
  await db.userNote.deleteMany({ where: { userId: { in: users } } }); await db.userProgress.deleteMany({ where: { userId: { in: users } } });
  await db.problem.update({ where: { id: problemId }, data: { status: "PUBLISHED" } });
});
afterAll(async () => { if (db && owns) { await db.user.deleteMany({ where: { id: { in: users } } }); await db.problem.deleteMany({ where: { slug: { in: [...slugs, ...extras] } } }); } await db?.$disconnect(); });
const save = (content: string, expectedContent = "", userId = users[0]) => writeProblemChange(db, userId, { slug, operation: "save-note", content, expectedContent });
const remove = (expectedContent: string) => writeProblemChange(db, users[0], { slug, operation: "delete-note", expectedContent });
it("isolates owner notes, flags and private projections; non-note lists do not include note text", async () => {
  await save("A-PRIVATE"); await save("B-PRIVATE", "", users[1]);
  await writeProblemChange(db, users[0], { slug, operation: "set-bookmark", bookmarked: "true" });
  const notes = await querySaved(db, users[0], "notes", filters); const bookmarks = await querySaved(db, users[0], "bookmarks", filters);
  expect(notes.items[0].note).toBe("A-PRIVATE"); expect(bookmarks.items[0].note).toBe("");
  expect((await querySaved(db, users[1], "bookmarks", filters)).total).toBe(0);
  for (const secret of ["B-PRIVATE", '"userId"', '"problemId"', '"statement"', '"testCases"', users[0]]) expect(JSON.stringify(notes)).not.toContain(secret);
  expect((await queryProblem(db, slug, users[0]))?.personal?.bookmarked).toBe(true);
});
it("deletes only matching saved content, is repeatable, and clearing removes the row", async () => {
  await save("old"); await save("new", "old"); expect(await remove("old")).toBe("conflict");
  expect((await querySaved(db, users[0], "notes", filters)).items[0].note).toBe("new");
  expect(await remove("new")).toBe("saved"); expect(await remove("new")).toBe("saved");
  expect(await db.userNote.count({ where: { userId: users[0] } })).toBe(0);
  await save("restored"); expect(await save("", "restored")).toBe("saved");
  expect(await db.userNote.count({ where: { userId: users[0] } })).toBe(0);
});
it("serializes concurrent edit/delete without erasing a newer edit or creating empty placeholders", async () => {
  await save("baseline");
  const outcomes = await Promise.all([save("newer", "baseline"), remove("baseline")]);
  expect(outcomes.sort()).toEqual(["conflict", "saved"]);
  const row = await db.userNote.findUnique({ where: { userId_problemId: { userId: users[0], problemId } } });
  expect(row === null || row.content === "newer").toBe(true);
});
it("keeps bookmark/review changes independent of verified solves and repeat timestamps", async () => {
  const at = new Date("2026-01-01T00:00:00Z");
  await db.userProgress.create({ data: { userId: users[0], problemId, status: "SOLVED", selfMarked: false, verifiedRevision: 1, solvedAt: at, verifiedAt: at } });
  await Promise.all([writeProblemChange(db, users[0], { slug, operation: "set-bookmark", bookmarked: "true" }), writeProblemChange(db, users[0], { slug, operation: "set-review", review: "true" })]);
  const read = () => db.userProgress.findUniqueOrThrow({ where: { userId_problemId: { userId: users[0], problemId } } });
  const first = await read(); await writeProblemChange(db, users[0], { slug, operation: "set-bookmark", bookmarked: "true" });
  expect((await read()).updatedAt).toEqual(first.updatedAt);
  await writeProblemChange(db, users[0], { slug, operation: "set-bookmark", bookmarked: "false" });
  expect(await read()).toMatchObject({ bookmarked: false, reviewLater: true, status: "SOLVED", verifiedRevision: 1, solvedAt: at, verifiedAt: at });
  expect((await querySaved(db, users[0], "review", filters)).total).toBe(1);
});
it("paginates ten at a time, retains title search and clamps out-of-range pages", async () => {
  const rows = await db.problem.findMany({ where: { slug: { in: extras } } });
  await db.userProgress.createMany({ data: rows.map(({ id }) => ({ userId: users[0], problemId: id, bookmarked: true })) });
  const first = await querySaved(db, users[0], "bookmarks", filters);
  const last = await querySaved(db, users[0], "bookmarks", { q: "", page: 999999 });
  expect(first).toMatchObject({ total: 12, pages: 2, page: 1 }); expect(first.items).toHaveLength(10); expect(last.items).toHaveLength(2); expect(last.page).toBe(2);
  expect(new Set([...first.items, ...last.items].map((p) => p.slug)).size).toBe(12);
  expect((await querySaved(db, users[0], "bookmarks", { q: "FIXTURE-11", page: 2 })).items[0].slug).toBe("saved-fixture-11");
});
it("omits archived content and blank legacy notes without deleting stored private records", async () => {
  await save("kept privately"); await writeProblemChange(db, users[0], { slug, operation: "set-review", review: "true" });
  await db.problem.update({ where: { id: problemId }, data: { status: "ARCHIVED" } });
  for (const kind of ["notes", "bookmarks", "review"] as const) expect((await querySaved(db, users[0], kind, filters)).total).toBe(0);
  expect(await remove("kept privately")).toBe("not-found");
  expect(await db.userNote.count({ where: { userId: users[0] } })).toBe(1);
  await db.problem.update({ where: { id: problemId }, data: { status: "PUBLISHED" } });
  await db.userNote.updateMany({ where: { userId: users[0] }, data: { content: "" } });
  expect((await querySaved(db, users[0], "notes", filters)).total).toBe(0);
  await expect(querySaved(db, "", "notes", filters)).rejects.toThrow();
});
```

### `tests/notes-controls.test.ts`

```ts
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/features/problems/detail-actions", () => ({ updateProblem: f.update }));
import { ProblemNotes } from "@/components/problems/personal-controls";
let host: HTMLDivElement; let root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); f.update.mockReset(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
const render = (note = "saved") => act(() => root.render(createElement(ProblemNotes, { slug: "relay-window", note })));
const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label)!;
it("retains this tab's saved baseline and draft when unrelated props refresh", async () => {
  await render("initial"); await render("another tab's edit");
  expect(host.querySelector("textarea")?.value).toBe("initial");
  expect((host.querySelector('[name="expectedContent"]') as HTMLInputElement).value).toBe("initial");
});
it("deletes the saved note and resets the draft only after confirmed success", async () => {
  f.update.mockResolvedValue({ success: true, savedContent: "", message: "Note deleted." });
  await render(); await act(async () => { button("Delete saved note").click(); });
  expect(f.update).toHaveBeenCalledOnce(); expect(f.update.mock.calls[0][1].get("operation")).toBe("delete-note");
  expect(f.update.mock.calls[0][1].get("expectedContent")).toBe("saved");
  expect(host.querySelector("textarea")?.value).toBe(""); expect(button("Delete saved note").disabled).toBe(true);
});
it("keeps the draft and baseline on a failed deletion or unconfirmed network response", async () => {
  await render(); f.update.mockResolvedValue({ success: false, message: "Conflict" });
  await act(async () => { button("Delete saved note").click(); });
  expect(host.querySelector("textarea")?.value).toBe("saved");
  f.update.mockRejectedValue(new Error("private network details"));
  await act(async () => { button("Delete saved note").click(); });
  expect(host.textContent).toContain("Could not confirm"); expect(host.textContent).not.toContain("private network details");
  expect(host.querySelector("textarea")?.value).toBe("saved");
  expect((host.querySelector('[name="expectedContent"]') as HTMLInputElement).value).toBe("saved");
});
it("requires saving or discarding a dirty draft before deletion", async () => {
  await render();
  const textarea = host.querySelector("textarea")!;
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "unsaved draft");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(button("Delete saved note").disabled).toBe(true);
  await act(() => { button("Discard unsaved changes").click(); });
  expect(textarea.value).toBe("saved"); expect(button("Delete saved note").disabled).toBe(false);
  expect(f.update).not.toHaveBeenCalled();
});
```

### `tests/problem-detail-boundary.test.ts`

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
    expect(mocks.revalidate.mock.calls).toEqual([["/problems/relay-window"], ["/problems"], ["/progress"], ["/dashboard"], ["/notes"], ["/bookmarks"], ["/review"]]);
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

it("validates bookmark booleans and delete baselines; only the viewer owns the mutation", async () => {
  for (const values of [{ operation: "set-bookmark", bookmarked: "yes" }, { operation: "delete-note" }, { operation: "delete-note", expectedContent: "x".repeat(10001) }]) expect((await updateProblem({}, form(values))).success).toBe(false);
  expect(mocks.write).not.toHaveBeenCalled();
  expect((await updateProblem({}, form({ operation: "set-bookmark", bookmarked: "true", userId: "other" }))).success).toBe(true);
  expect(mocks.write).toHaveBeenLastCalledWith("trusted-db", "verified-user", { slug: "relay-window", operation: "set-bookmark", bookmarked: "true" });
  expect(await updateProblem({}, form({ operation: "delete-note", expectedContent: "saved" }))).toMatchObject({ success: true, savedContent: "", message: "Note deleted." });
});
```

### `tests/runner-actions.test.ts`

```ts
import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ viewer: vi.fn(), db: vi.fn(), config: vi.fn(), run: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ getViewer: f.viewer }));
vi.mock("@/lib/prisma", () => ({ getDatabase: f.db }));
vi.mock("@/features/submissions/config", () => ({ getRunnerConfig: f.config }));
vi.mock("@/features/submissions/service", () => ({ runSubmission: f.run }));
import { executeCode } from "@/features/submissions/actions";
const input = { slug: "relay-window", language: "JAVASCRIPT", mode: "RUN", code: "function relayWindow() { return 13; }" };
beforeEach(() => { vi.clearAllMocks(); f.viewer.mockResolvedValue({ id: "verified-owner" }); f.db.mockReturnValue("db"); f.config.mockReturnValue("server-config"); f.run.mockResolvedValue({ success: true, result: { id: "saved" } }); });
it("rejects tampered fields, unsupported languages, invalid modes and oversized code", async () => {
  for (const change of [{ userId: "forged" }, { role: "ADMIN" }, { tests: [] }, { url: "https://evil.example" }, { language: "PYTHON" }, { mode: "ACCEPTED" }, { code: " " }, { code: "x".repeat(20001) }, { slug: "../admin" }])
    expect((await executeCode({ ...input, ...change })).success).toBe(false);
  expect(f.viewer).not.toHaveBeenCalled(); expect(f.run).not.toHaveBeenCalled();
});
it("authenticates every request and fails closed when disabled or identity verification fails", async () => {
  f.viewer.mockResolvedValue(null); expect(await executeCode(input)).toMatchObject({ success: false, message: expect.stringContaining("Sign in") });
  f.viewer.mockResolvedValue({ id: "verified-owner" }); f.config.mockReturnValue(null); expect(await executeCode(input)).toMatchObject({ success: false, message: expect.stringContaining("not configured") });
  f.viewer.mockRejectedValue(new Error("private token")); expect(JSON.stringify(await executeCode(input))).not.toContain("private token");
  expect(f.run).not.toHaveBeenCalled();
});
it("uses the verified owner and never reports a failed save as successful", async () => {
  expect((await executeCode(input)).success).toBe(true);
  expect(f.run).toHaveBeenCalledWith("db", "verified-owner", input, "server-config");
  expect(f.revalidate.mock.calls).toEqual([["/problems/relay-window"], ["/problems"], ["/progress"], ["/dashboard"], ["/notes"], ["/bookmarks"], ["/review"]]);
  f.run.mockRejectedValue(new Error("database password")); expect(await executeCode(input)).toMatchObject({ success: false });
  expect(JSON.stringify(await executeCode(input))).not.toContain("password");
});
```

### `tests/saved-load.test.ts`

```ts
import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ viewer: vi.fn(), db: vi.fn(), query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ requireViewer: f.viewer }));
vi.mock("@/lib/prisma", () => ({ getDatabase: f.db }));
vi.mock("@/features/saved/query", () => ({ querySaved: f.query }));
import { loadSaved } from "@/features/saved/load";
import { parseSavedFilters, savedHref } from "@/features/saved/filters";
import { safeReturnTo } from "@/features/auth/validation";
beforeEach(() => { vi.resetAllMocks(); f.viewer.mockResolvedValue({ id: "owner", role: "ADMIN" }); f.db.mockReturnValue("db"); f.query.mockResolvedValue({ items: [] }); });
it("normalizes bounded search and rejects array, negative, decimal and oversized pages", () => {
  for (const page of [["2"], "-1", "0", "1.5", "9999999", "NaN"]) expect(parseSavedFilters({ page }).page).toBe(1);
  expect(parseSavedFilters({ q: " x\u0000 ", page: "2" })).toEqual({ q: "x", page: 2 });
  expect(parseSavedFilters({ q: "x".repeat(101) }).q).toHaveLength(100);
});
it("keeps all saved destinations local and preserves valid return/search URLs", () => {
  for (const kind of ["notes", "bookmarks", "review"] as const) {
    const url = savedHref(kind, { q: "a & b", page: 2 });
    expect(safeReturnTo(url)).toBe(url);
  }
  expect(safeReturnTo("/progress")).toBe("/progress");
  expect(safeReturnTo("//evil.test/bookmarks")).toBe("/dashboard");
});
it("uses only the authenticated owner's data even for admins and ignores supplied IDs", async () => {
  expect(await loadSaved("bookmarks", { userId: "other", q: "Relay", page: "2" })).toEqual({ admin: true, collection: { items: [] } });
  expect(f.viewer).toHaveBeenCalledWith("/bookmarks?q=Relay&page=2");
  expect(f.query).toHaveBeenCalledWith("db", "owner", "bookmarks", { q: "Relay", page: 2 });
});
it("never touches the database after a guest redirect or identity failure", async () => {
  f.viewer.mockRejectedValue(new Error("redirect"));
  await expect(loadSaved("notes", {})).rejects.toThrow(); expect(f.db).not.toHaveBeenCalled(); expect(f.query).not.toHaveBeenCalled();
});
```

## 🟪 Next phase

Stop here until the user resumes. On resume, verify PR #12 and this checkpoint, fix the publishedAt fixture setup in tests/integration/saved.test.ts, and run all six new integration tests plus the full workflow. Resolve any resulting failures before completing/reviewing Phase 11 and considering merge. Phase 12 roadmaps has not started.
