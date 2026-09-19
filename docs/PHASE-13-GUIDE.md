# Phase 13 — Protected content administration

This phase adds structured content authoring to AlgoSprint. [PR #14](https://github.com/zihadpcode/AlgoSprint/pull/14) is merged at `5f78920812137e15284a9fddacd22c726d7fe9f8`, with saved-head CI 35409169729 passing all gates (206 tests). The later user instruction “catch up to phase 14” superseded the earlier pause. See PHASE-14-GUIDE.md and SESSION-HANDOFF.md for the current checkpoint. The source listings below preserve the Phase 13 implementation.


## 🟦 What gets built

| Route | Capability |
| --- | --- |
| `/admin` | Search problem titles, filter publication status, inspect twenty summaries per page and open existing roadmaps |
| `/admin/problems/new` | Create a complete original coding problem using structured fields |
| `/admin/problems/[slug]` | Edit content, archive it, or delete only if safe |
| `/admin/import` | Import a bounded create-only batch of version 1 problem JSON |
| `/admin/roadmaps/[slug]` | Edit an existing roadmap and add, remove or reorder associated problems |

Problem forms cover statements, constraints, estimates and resource limits, categories, tags, interview styles, related problems, public examples, five progressive hints, language starters, visible/hidden tests, multiple solution approaches and ordered explanation steps. Arrays have add/remove/move controls; hint count remains five. Input/output boxes use JSON because they represent structured values, while explanation and code fields use plain text. This is an authoring form, not a requirement to edit repository code.

The manager includes every publication status, but its table selects only summary fields. Hidden tests are fetched only for an authorized problem editor. Roadmap management lists up to 100 existing paths; it does not create new roadmaps or taxonomy. The current version 1 content schema supports the five existing pattern choices, fixed taxonomy and CODING problems. Expanding that schema, automatic generation, CSV import and runner contracts belongs to later reviewed work.

## 🟦 Development setup and administrator access

Use Node.js 24. Preserve existing environment values and configure only a development database/account for verification:

```bash
npm ci
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Accounts require the existing Supabase public URL/publishable key, application URL and database settings described in the earlier authentication guide. Register, confirm the email and sign in once so a profile exists. An authorized maintainer can then promote that development profile with the existing script:

```bash
npm run user:role -- --user-id YOUR_CONFIRMED_PROFILE_UUID --role ADMIN
```

Replace the placeholder with the exact existing profile UUID from your trusted development environment. To remove the role, use the same command with `--role USER`. The website cannot grant itself administrator access, and Supabase user metadata does not determine database roles. No account was promoted or production data changed in this phase.

Open `/admin` after signing in. A guest receives a sign-in redirect; a signed-in non-admin receives not-found. Forged cookies and URL parameters do not establish administrator access. The existing session proxy supplies private/no-store headers on all admin paths.

## 🟨 Create and edit a problem

1. Choose Add problem and enter a unique lowercase hyphenated slug. Slugs cannot change after creation; `new` is reserved for the add form route.
2. Fill the statement, difficulty, supported pattern, constraints, estimates, taxonomy and starter language/function/code.
3. Add at least two examples, exactly five ordered hints, at least four test cases including both visible and hidden cases, and brute-force plus optimal solutions. Every solution language needs matching starter code. Solution explanations require at least two ordered steps.
4. Keep the status DRAFT while reviewing. Draft saves require all required fields to be structurally complete; partial-draft autosave is not implemented. Save before leaving the page.
5. Before saving PUBLISHED content, explicitly confirm review of originality, wording, sequence and expected outputs. This is a human review assertion, not a claim that validation proved arbitrary solution correctness.
6. Save. The server returns the saved revision only after the transaction commits. A later edit uses that revision; if another tab saved first, the stale edit fails without overwriting content. Keep a copy of the draft and reload to compare versions.

The form retains values on validation errors, conflicts and unconfirmed responses. Controls are disabled while saving and a synchronous busy guard prevents duplicate calls. Unrelated server refreshes do not silently replace a local draft or its saved revision. This preserves work but means a stale tab must reload before it can overwrite a newer version intentionally. Navigating away still loses unsaved local changes; there is no autosave, draft recovery or export feature.

Code fields are stored and displayed as text. They are never evaluated in Next.js, Node VM or a local child process. New custom problem slugs are study content until a separately reviewed runner signature is added. The existing five runner-backed slugs must keep their JavaScript entry point, at most ten cases, valid input shapes and correct expected outputs according to the authored trusted reference functions. This validation calls only repository-authored functions, never submitted code. It does not prove that edited statement prose or supplied solution code is semantically correct; administrators must review those.

## 🟦 Authorization, transactions and revisions

Every page guards access. The admin layout also authenticates before rendering nested content, but loaders and actions independently verify identity near the database. The action ignores claimed identity/role by accepting a strict command shape and obtaining the actor from the verified session. Read/write helpers recheck the actor's database role inside the transaction using a shared row lock. A role revocation waits for an already-authorized transaction, and subsequent requests fail closed.

Writes take a common transaction advisory lock, then the same roadmap-seed lock introduced in Phase 12. This gives cooperating content operations one lock order and serializes admin changes with roadmap seed jobs. Problem edits/archive/delete then take an exclusive problem row lock. Existing learner writes and submission snapshots/finalization use shared problem locks, so content changes cannot interleave with their protected snapshot work. No provider request is held inside an admin transaction.

All problem child-content replacements, taxonomy assignments and related links are committed with the parent in one transaction. An error rolls everything back. The parent ID remains stable; user notes, progress, submissions, interview history and roadmap references are not rewritten. Each saved edit advances revision conservatively, even if the change is only editorial. Archiving advances revision the first time and preserves it on a repeated already-archived request. Earlier verified solves retain their old revision label. A submission reserved before an edit keeps its result/history but cannot verify the new revision when it finishes.

Admin edits clear `seedHash`. Original seed files therefore refuse to overwrite changed content on a future seed run. Roadmap seed comparison similarly refuses changed metadata, status or ordered steps. Such conflicts are deliberate: maintainers must reconcile curated edits through a reviewed workflow, not delete valuable data or reset the database to force a seed.

Publication writes assign a publication timestamp when status is PUBLISHED. Archiving hides public content and any roadmap containing it; stored learner history remains. Successful writes revalidate manager, problem, roadmap, progress, dashboard and saved pages. Unknown database/provider failures return a generic message without credentials or SQL. An interrupted response can occur after a commit; check the saved state before retrying.

## 🟨 JSON imports

The import accepts a file or pasted JSON array of 1–10 complete version 1 problem objects. The existing original seed files under `src/data/seeds/problems/foundation/` show the format; use them to learn the structure, then author new original content and unique slugs. Importing an existing slug is intentionally rejected. Imports never become an implicit bulk overwrite.

The JSON payload is limited to 400,000 UTF-8 bytes, depth 24 and 30,000 visited values. Null characters are rejected because PostgreSQL text/JSON values cannot store them. Zod then checks strict fields, supported enum/taxonomy values, consecutive ordered positions, distinct languages/solution kinds and related references. Imports must have distinct slugs, and related references can target either saved problems or other problems in the same batch.

All imported problems and their related links commit together. A conflict, missing relation, invalid row or publication review failure leaves the entire batch unchanged. No arbitrary code runs during validation. Human-reviewed custom problems may be published for reading without runner support; this is distinct from the trusted semantic checks required by the existing five execution contracts.

The input remains in the form after a failure. On a confirmed successful import it is cleared. On a lost response it remains, so inspect the manager before retrying. Existing-slug rejection prevents overwriting or duplicating a batch that already committed, but there is no general idempotency-key or exactly-once delivery guarantee.

## 🟨 Archive, safe deletion and roadmap placement

Archiving requires typing the exact slug. Save dirty local changes first; archive/delete controls are disabled while the form differs from its saved baseline. Archive preserves all learner history. Permanent deletion requires ARCHIVED status, a matching revision and confirmation slug, and zero progress, notes, submissions, roadmap steps, interview questions or outgoing/incoming related-problem references. Foreign keys remain the final protection against references created concurrently. Failure leaves the problem archived, with an explanation. There is no delete recovery or bulk delete.

For roadmap placement, open an existing path from the manager. Edit the description and estimates, add a step using an existing problem slug, write step guidance, and move steps up/down. A path must have nonempty unique steps. Published paths require every problem published and a review confirmation; draft paths may reference draft problems. A token derived from the loaded content and update timestamp detects stale roadmap edits. Changed order replaces steps transactionally, preserving the parent roadmap and shared problem progress. This editor does not create a new path; original roadmap creation remains seeded until a later authoring extension.

## 🟩 Automated verification

Local results: **145 unit/component/migration tests**, lint, TypeScript, production build and signed-out production HTTP checks passed. Ten added local tests cover read/action boundaries, strict/limited JSON, full form round-tripping, ordered fields, draft conflicts, duplicate requests and uncertain saves.

**All 61 PostgreSQL integration tests passed** in implementation CI 35408522853, including ten new admin tests alongside the existing 51. Together with the 145 local/unit/component/migration tests, this is 206 passing tests. They cover current database roles and revocation, structured creation and public hidden-data exclusion, edits/revisions/history, concurrent stale saves, in-flight runner results on old revisions, atomic create-only imports, archive/safe-delete checks, roadmap order/conflicts and seed refusal, trusted runner contract validation, and twenty-row stable filtering/pagination.

The signed-out HTTP script includes every new admin route with forged cookies. It verifies redirects and does not claim to test a live administrator session. CI additionally validates schema/migrations, seeds, lint/types/build and existing seeded public library/detail/roadmap behavior. The full implementation [CI 35408522853](https://github.com/zihadpcode/AlgoSprint/actions/runs/35408522853) passed every step on commit `97c2cce24c13ff338fc56fd9b68b4e55a9135f4c`, tree `b16e9de28f06f188420f5004a1695db6035f68b2`. PR #14 records the passed saved-head CI and subsequent Phase 13 merge.

## 🟥 Manual development checklist and limits

- With a regular account, directly open every admin route and try calling a captured action: deny access and return no hidden content. Repeat as an admin, then demote that profile and confirm subsequent reads/writes fail.
- Use a disposable original draft to edit every nested section. Reorder cases/steps, check JSON diagnostics, and verify keyboard focus, screen-reader labels, narrow screens and 200% zoom. Real browser rendering remains unverified here.
- Open the same problem in two tabs. Save one, attempt the stale save in the other, and verify the second draft remains visible without overwriting the first.
- In a development database with a solved problem and pending submission, edit it. Confirm old verification labels, preserved notes/history, and no upgrade of an earlier reserved submission to the new revision.
- Publish, archive and restore a problem referenced by a path; check public visibility and shared progress. Attempt unsafe deletion, then safely delete an archived unreferenced disposable fixture.
- Import two new drafts with an internal relation; then try duplicate slugs and one invalid member. Confirm rollback. Do not use valuable production data for these checks.

No production account changes, migrations, seed writes, deployment or purchases occurred. No schema or dependency change was required. There is no audit-log UI, edit-history restore, automatic original-content verification, taxonomy authoring, new runner contract, partial drafts, CSV import or new roadmap creation. Live Supabase/Judge0 and browser/Monaco/accessibility checks from earlier phases remain pending. Phase 14's generator is not started.

## 🟪 Complete authored source

The following 21 source/test/script files are the complete Phase 13 implementation changes. Existing schema, validators, shared controls and earlier guides remain in the repository. Status documents are maintained separately. Each listing is checked against its file before publication.


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
  for (const path of ["/dashboard", "/progress", "/profile", "/admin", "/admin/problems/new", "/admin/problems/relay-window", "/admin/import", "/admin/roadmaps/scan-store-reuse", "/notes", "/bookmarks", "/review"]) {
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

### `src/app/admin/import/page.tsx`

```tsx
import type { Metadata } from "next";
import { requireAdmin } from "@/features/auth/session";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { ButtonLink } from "@/components/ui/button";
import { ImportForm } from "@/components/admin/import-form";
export const metadata: Metadata = { title: "Import problems", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function ImportPage() {
  await requireAdmin();
  return <AccountFrame admin><PageHeading eyebrow="Content administration" title="Import original problems" description="Validate a complete batch before creating any problem." /><ImportForm /><div className="mt-6"><ButtonLink href="/admin" variant="secondary">Back to manager</ButtonLink></div></AccountFrame>;
}
```

### `src/app/admin/layout.tsx`

```tsx
import type { ReactNode } from "react";
import { requireAdmin } from "@/features/auth/session";
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return children;
}
```

### `src/app/admin/page.tsx`

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { adminHref, loadAdminIndex } from "@/features/admin/load";
export const metadata: Metadata = { title: "Content manager", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { filters, result } = await loadAdminIndex(await searchParams);
  if (filters.page !== result.page) redirect(adminHref({ ...filters, page: result.page }));
  return <AccountFrame admin><PageHeading eyebrow="Content administration" title="Problem manager" description="Author original learning content. Review examples and tests before publishing." />
    <div className="mb-6 flex flex-wrap gap-3"><ButtonLink href="/admin/problems/new">Add problem</ButtonLink><ButtonLink href="/admin/import" variant="secondary">Import JSON</ButtonLink></div>
    <form method="get" action="/admin" className="mb-6 flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 space-y-2"><span className="text-sm">Search titles</span><Input name="q" defaultValue={filters.q} maxLength={100} /></label>
      <label className="space-y-2"><span className="text-sm">Status</span><Select name="status" defaultValue={filters.status}><option value="">All statuses</option>{["DRAFT", "PUBLISHED", "ARCHIVED"].map((s) => <option key={s}>{s}</option>)}</Select></label><Button type="submit">Filter</Button><ButtonLink href="/admin" variant="secondary">Clear</ButtonLink>
    </form>
    <p className="mb-4 text-sm text-muted">{result.total} matching problems · Page {result.page} of {result.pages}</p>
    {result.problems.length ? <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full text-left text-sm"><caption className="sr-only">Managed problems</caption>
      <thead><tr>{["Problem", "Status", "Difficulty", "Revision"].map((x) => <th key={x} scope="col" className="p-4">{x}</th>)}</tr></thead>
      <tbody>{result.problems.map((p) => <tr key={p.slug} className="border-t border-line"><th scope="row" className="p-4"><Link href={`/admin/problems/${p.slug}`} className="text-accent underline underline-offset-4">{p.title}</Link><span className="mt-1 block font-normal text-muted">{p.slug}</span></th><td className="p-4">{p.status}</td><td className="p-4">{p.difficulty}</td><td className="p-4">{p.revision}</td></tr>)}</tbody>
    </table></div> : <EmptyState title="No matching problems" description="Change the filters or create a new original problem." />}
    <nav aria-label="Managed problem pages" className="my-6 flex flex-wrap gap-3">{result.page > 1 && <ButtonLink href={adminHref({ ...filters, page: result.page - 1 })} variant="secondary">Previous page</ButtonLink>}{result.page < result.pages && <ButtonLink href={adminHref({ ...filters, page: result.page + 1 })} variant="secondary">Next page</ButtonLink>}</nav>
    <h2 className="mt-10 text-xl font-semibold">Roadmap placement</h2><p className="my-3 text-sm text-muted">Edit each path to add, remove or reorder existing problems. Showing up to 100 paths.</p>
    <ul className="space-y-3">{result.roadmaps.map((r) => <li key={r.slug}><Link href={`/admin/roadmaps/${r.slug}`} className="text-accent underline underline-offset-4">{r.title}</Link><span className="ml-3 text-sm text-muted">{r.status}</span></li>)}</ul>
  </AccountFrame>;
}
```

### `src/app/admin/problems/[slug]/page.tsx`

```tsx
import type { Metadata } from "next";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { ContentEditor } from "@/components/admin/content-editor";
import { notFound } from "next/navigation";
import { loadAdminProblem } from "@/features/admin/load";
export const metadata: Metadata = { title: "Edit problem", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const row = await loadAdminProblem((await params).slug); if (!row) notFound();
  return <AccountFrame admin><PageHeading eyebrow="Content administration" title={`Edit ${row.content.title}`} description={`Revision ${row.revision}. Hidden tests are available only in this protected editor.`} /><ContentEditor key={row.content.slug} kind="problem" initial={row.content} slug={row.content.slug} revision={row.revision} /></AccountFrame>;
}
```

### `src/app/admin/problems/new/page.tsx`

```tsx
import type { Metadata } from "next";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { ContentEditor } from "@/components/admin/content-editor";
import { requireAdmin } from "@/features/auth/session";
export const metadata: Metadata = { title: "Add problem", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireAdmin();
  return <AccountFrame admin><PageHeading eyebrow="Content administration" title="Add an original problem" description="Prepare the statement, examples, hints, solutions and tests together." /><ContentEditor kind="problem" /></AccountFrame>;
}
```

### `src/app/admin/roadmaps/[slug]/page.tsx`

```tsx
import type { Metadata } from "next";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { ContentEditor } from "@/components/admin/content-editor";
import { notFound } from "next/navigation";
import { loadAdminRoadmap } from "@/features/admin/load";
export const metadata: Metadata = { title: "Edit roadmap", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const row = await loadAdminRoadmap((await params).slug); if (!row) notFound();
  return <AccountFrame admin><PageHeading eyebrow="Content administration" title={`Edit ${row.content.title}`} description="Use existing problem slugs, write step guidance, and move steps into learning order." /><ContentEditor key={row.content.slug} kind="roadmap" initial={row.content} slug={row.content.slug} token={row.token} status={row.status} /></AccountFrame>;
}
```

### `src/components/admin/content-editor.tsx`

```tsx
"use client";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ContentFields } from "./content-fields";
import { blankProblem, fromForm, problemFields, roadmapFields, toForm } from "@/features/admin/form-model";
import { administer } from "@/features/admin/actions";
import type { AdminCommand, AdminResult } from "@/features/admin/contracts";

type EditorProps = { kind: "problem" | "roadmap"; initial?: Record<string, unknown>; slug?: string; revision?: number; token?: string; status?: string };
export function ContentEditor({ kind, initial, slug, revision: initialRevision, token: initialToken, status: initialStatus }: EditorProps) {
  const fields = kind === "problem" ? problemFields : roadmapFields;
  const [draft, setDraft] = useState<Record<string, unknown>>(() => initial ? toForm(initial, fields) : blankProblem());
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const [revision, setRevision] = useState(initialRevision ?? null); const [token, setToken] = useState(initialToken ?? "");
  const [status, setStatus] = useState(initialStatus ?? "DRAFT");
  const [reviewed, setReviewed] = useState(false); const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState<AdminResult | null>(null); const [pending, setPending] = useState(false);
  const busy = useRef(false); const [, startTransition] = useTransition(); const router = useRouter();
  const dirty = JSON.stringify(draft) !== baseline;
  function send(command: AdminCommand) {
    if (busy.current) return;
    busy.current = true; setPending(true); setResult(null);
    startTransition(async () => {
      try {
        const response = await administer(command); setResult(response);
        if (response.success) {
          if (response.deleted) { router.replace("/admin"); return; }
          if (response.revision) setRevision(response.revision);
          if (response.token) setToken(response.token);
          const savedDraft = command.operation === "archive" ? { ...draft, status: "ARCHIVED" } : draft;
          setDraft(savedDraft); setBaseline(JSON.stringify(savedDraft)); setReviewed(false); setConfirmation("");
          if (!slug && response.slug) router.replace(`/admin/problems/${response.slug}`);
        }
      } catch { setResult({ success: false, message: "The response was interrupted. Your draft is retained. Copy it and reload to confirm the saved version before retrying." }); }
      finally { busy.current = false; setPending(false); }
    });
  }
  function save(event: FormEvent) {
    event.preventDefault();
    try {
      const content = fromForm(draft, fields);
      send(kind === "problem" ? { operation: "save", slug: slug ?? null, revision, payload: JSON.stringify(content), reviewed } :
        { operation: "roadmap", slug: slug!, token, payload: JSON.stringify({ content, status }), reviewed });
    } catch (error) { setResult({ success: false, message: error instanceof Error ? error.message : "Check the draft." }); }
  }
  return <div className="space-y-6">
    <p className="text-sm leading-7 text-muted">Save explicitly before leaving. All required content must be complete, even for a draft. Input and expected-output boxes use JSON; code is stored as text. {kind === "problem" && "The current taxonomy supports five patterns. Only the five original runner problems support execution; custom problems remain study content until reviewed runner support is added."}</p>
    <form onSubmit={save} className="space-y-6"><fieldset disabled={pending} className="min-w-0 space-y-6">
      <ContentFields fields={fields} value={draft} immutableSlug={Boolean(slug)} onChange={(next) => { setDraft(next); setReviewed(false); }} />
      {kind === "roadmap" && <label className="block space-y-2"><span>Publication status</span><Select value={status} onChange={(e) => { setStatus(e.target.value); setReviewed(false); }}>{["DRAFT", "PUBLISHED", "ARCHIVED"].map((s) => <option key={s}>{s}</option>)}</Select></label>}
      <label className="flex items-start gap-3 text-sm leading-7"><input type="checkbox" className="mt-2" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />I reviewed the originality, wording, sequence, examples and expected outputs. Required when saving published content.</label>
      <div className="flex flex-wrap gap-3"><Button type="submit">{pending ? "Saving…" : "Save content"}</Button><ButtonLink href="/admin" variant="secondary">Back to manager</ButtonLink></div>
    </fieldset></form>
    {result && <div role={result.success ? "status" : "alert"} className="rounded-xl border border-line p-4 text-sm leading-7"><p>{result.message}</p>{result.errors && <ul className="mt-3 list-disc pl-5">{result.errors.map((error, i) => <li key={i}>{error}</li>)}</ul>}</div>}
    {kind === "problem" && slug && revision && <fieldset disabled={pending || dirty} className="min-w-0 space-y-4 rounded-xl border border-line p-5">
      <legend className="px-2 font-semibold">Archive or safely delete</legend>
      <p className="text-sm leading-7 text-muted">Archive hides the problem and any roadmap containing it, preserving history. Deletion is permanent and allowed only after archiving, with no user history or references. Save unsaved changes first.</p>
      <label className="block space-y-2"><span className="text-sm">Type {slug} to confirm</span><Input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" /></label>
      <div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={confirmation !== slug || draft.status === "ARCHIVED"} onClick={() => send({ operation: "archive", slug, revision, confirmation })}>Archive problem</Button>
        <Button variant="danger" disabled={confirmation !== slug || draft.status !== "ARCHIVED"} onClick={() => send({ operation: "delete", slug, revision, confirmation })}>Permanently delete</Button></div>
    </fieldset>}
  </div>;
}
```

### `src/components/admin/content-fields.tsx`

```tsx
"use client";
import { useId } from "react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Field } from "@/features/admin/form-model";

export function ContentFields({ fields, value, onChange, immutableSlug = false }: { fields: Field[]; value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void; immutableSlug?: boolean }) {
  const prefix = useId();
  return <div className="space-y-5">{fields.map((f) => {
    const id = `${prefix}-${f.key}`; const current = value[f.key]; const change = (next: unknown) => onChange({ ...value, [f.key]: next });
    if (f.kind === "array") {
      const rows = current as Record<string, unknown>[];
      const move = (i: number, delta: number) => { const next = [...rows]; [next[i], next[i + delta]] = [next[i + delta], next[i]]; change(next); };
      return <fieldset key={f.key} className="min-w-0 space-y-4 rounded-xl border border-line p-4"><legend className="px-2 font-semibold">{f.label}</legend>
        {rows.map((row, i) => <details key={i} className="rounded-lg border border-line p-4" open={rows.length <= 5}>
          <summary className="cursor-pointer font-semibold">{f.label.split(" (")[0]} {i + 1}</summary>
          <div className="mt-4"><ContentFields fields={f.fields!} value={row} onChange={(next) => change(rows.map((r, index) => index === i ? next : r))} /></div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${f.label} ${i + 1} up`}>Move up</Button>
            <Button variant="secondary" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${f.label} ${i + 1} down`}>Move down</Button>
            {!f.fixed && <Button variant="danger" onClick={() => change(rows.filter((_, index) => index !== i))} aria-label={`Remove ${f.label} ${i + 1}`}>Remove</Button>}
          </div>
        </details>)}
        {!f.fixed && <Button variant="secondary" disabled={rows.length >= (f.max ?? 100)} onClick={() => change([...rows, structuredClone(f.initial!)])}>Add {f.label.split(" (")[0].toLowerCase()}</Button>}
      </fieldset>;
    }
    if (f.kind === "choices") return <fieldset key={f.key} className="min-w-0 rounded-xl border border-line p-4"><legend className="px-2 font-semibold">{f.label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{f.options!.map(([key, label]) => <label key={key} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={(current as string[]).includes(key)} onChange={(e) => change(e.target.checked ? [...current as string[], key] : (current as string[]).filter((x) => x !== key))} />{label}</label>)}</div>
    </fieldset>;
    return <div key={f.key}><label htmlFor={id} className="mb-2 block text-sm font-semibold">{f.label}</label>
      {f.kind === "select" ? <Select id={id} value={String(current)} onChange={(e) => change(e.target.value)}>{f.options!.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select> :
        ["long", "lines", "json"].includes(f.kind) ? <textarea id={id} value={String(current ?? "")} onChange={(e) => change(e.target.value)} rows={f.kind === "json" ? 5 : 3} className="w-full rounded-xl border border-muted/60 bg-canvas p-3 font-mono text-sm" /> :
          <Input id={id} type={f.kind === "number" ? "number" : "text"} readOnly={f.key === "slug" && immutableSlug} value={String(current ?? "")} onChange={(e) => change(f.kind === "number" ? Number(e.target.value) : e.target.value)} />}
    </div>;
  })}</div>;
}
```

### `src/components/admin/import-form.tsx`

```tsx
"use client";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { administer } from "@/features/admin/actions";
import { ADMIN_PAYLOAD_LIMIT, type AdminResult } from "@/features/admin/contracts";
export function ImportForm() {
  const [payload, setPayload] = useState(""); const [reviewed, setReviewed] = useState(false);
  const [result, setResult] = useState<AdminResult | null>(null); const [pending, setPending] = useState(false);
  const busy = useRef(false); const [, startTransition] = useTransition();
  function submit(event: FormEvent) {
    event.preventDefault(); if (busy.current) return;
    busy.current = true; setPending(true); setResult(null);
    startTransition(async () => {
      try { const response = await administer({ operation: "import", payload, reviewed }); setResult(response); if (response.success) { setPayload(""); setReviewed(false); } }
      catch { setResult({ success: false, message: "Import response interrupted. The JSON is retained; check the manager before retrying." }); }
      finally { busy.current = false; setPending(false); }
    });
  }
  return <form onSubmit={submit} className="space-y-5"><fieldset disabled={pending} className="min-w-0 space-y-5">
    <p className="text-sm leading-7 text-muted">Import a JSON array of 1–10 complete problem objects, below 400 KB, using the existing version 1 seed format. The whole batch succeeds or rolls back. Existing slugs are never overwritten. Publishing requires your review; validation does not prove custom solution correctness, and imported code is never executed here.</p>
    <label className="block space-y-2"><span>Choose a JSON file</span><input type="file" accept=".json,application/json" onChange={async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      if (file.size > ADMIN_PAYLOAD_LIMIT) { setResult({ success: false, message: "Choose a JSON file below 400 KB." }); return; }
      try { setPayload(await file.text()); setReviewed(false); } catch { setResult({ success: false, message: "Could not read this file. Paste the JSON below." }); }
    }} /></label>
    <label className="block space-y-2"><span>Problem JSON</span><textarea rows={18} className="w-full rounded-xl border border-muted/60 bg-canvas p-4 font-mono text-sm" value={payload} onChange={(e) => { setPayload(e.target.value); setReviewed(false); }} /></label>
    <label className="flex items-start gap-3 text-sm leading-7"><input type="checkbox" className="mt-2" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />I reviewed originality, explanations and expected outputs for every published problem.</label>
    <Button type="submit" disabled={!payload.trim()}>{pending ? "Importing…" : "Import new problems"}</Button>
  </fieldset>{result && <div role={result.success ? "status" : "alert"} className="rounded-xl border border-line p-4 text-sm leading-7"><p>{result.message}</p>{result.errors && <ul className="list-disc pl-5">{result.errors.map((x, i) => <li key={i}>{x}</li>)}</ul>}</div>}</form>;
}
```

### `src/features/admin/access.ts`

```typescript
import "server-only";
import type { Prisma } from "@/generated/prisma/client";

export class AdminError extends Error {}
// Recheck database role within each read/write transaction. Role revocation waits
// for an in-flight authorized transaction; future requests then fail closed.
export async function lockAdmin(tx: Prisma.TransactionClient, userId: string) {
  const [user] = await tx.$queryRaw<{ role: string }[]>`SELECT role FROM app."User" WHERE id = ${userId}::uuid FOR SHARE`;
  if (user?.role !== "ADMIN") throw new AdminError("Administrator access is required. Your draft is unchanged.");
}
```

### `src/features/admin/actions.ts`

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { writeAdmin } from "./write";
import { AdminError } from "./access";
import type { AdminResult } from "./contracts";

export async function administer(raw: unknown): Promise<AdminResult> {
  try {
    const viewer = await getViewer();
    if (viewer?.role !== "ADMIN") return { success: false, message: "Administrator access is required. Your draft is unchanged." };
    const result = await writeAdmin(getDatabase(), viewer.id, raw);
    for (const path of ["/admin", "/problems", "/roadmaps", "/dashboard", "/progress", "/notes", "/bookmarks", "/review"]) revalidatePath(path);
    for (const path of ["/admin/problems/[slug]", "/admin/roadmaps/[slug]", "/problems/[slug]", "/roadmaps/[slug]"]) revalidatePath(path, "page");
    return result;
  } catch (error) {
    if (error instanceof AdminError) return { success: false, message: error.message };
    if (error instanceof ZodError) return { success: false, message: "Check the highlighted field paths. Your draft is retained.", errors: error.issues.slice(0, 20).map((issue) => `${issue.path.join(".") || "content"}: ${issue.message}`) };
    if (error instanceof SyntaxError) return { success: false, message: "Invalid JSON. Check input/output values or the import document. Your draft is retained." };
    return { success: false, message: "Could not confirm the save. Keep a copy of your draft and reload to check the saved version before retrying." };
  }
}
```

### `src/features/admin/contracts.ts`

```typescript
import { z } from "zod";
import { problemSchema, type ProblemSeed } from "@/lib/validators/problem";
import { roadmapSlug, roadmapBatchSchema } from "@/lib/validators/roadmap";

export const ADMIN_PAYLOAD_LIMIT = 400_000;
const payload = z.string().max(ADMIN_PAYLOAD_LIMIT);
const revision = z.int().positive();
export const adminCommand = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("save"), slug: roadmapSlug.nullable(), revision: revision.nullable(), payload, reviewed: z.boolean() }),
  z.strictObject({ operation: z.literal("import"), payload, reviewed: z.boolean() }),
  z.strictObject({ operation: z.literal("archive"), slug: roadmapSlug, revision, confirmation: roadmapSlug }),
  z.strictObject({ operation: z.literal("delete"), slug: roadmapSlug, revision, confirmation: roadmapSlug }),
  z.strictObject({ operation: z.literal("roadmap"), slug: roadmapSlug, token: z.string().regex(/^[a-f0-9]{64}$/), payload, reviewed: z.boolean() }),
]);
export type AdminCommand = z.infer<typeof adminCommand>;
export type AdminResult = { success: boolean; message: string; errors?: string[]; slug?: string; revision?: number; token?: string; deleted?: boolean };

// Bound parsing before schema traversal. JSON code remains data, never executable.
export function parseAdminJson(text: string): unknown {
  if (new TextEncoder().encode(text).byteLength > ADMIN_PAYLOAD_LIMIT) throw new Error("Keep the JSON payload below 400 KB.");
  const value: unknown = JSON.parse(text);
  const stack: [unknown, number][] = [[value, 0]]; let count = 0;
  while (stack.length) {
    const [item, depth] = stack.pop()!;
    if (++count > 30000 || depth > 24) throw new Error("JSON is too large or deeply nested.");
    if (typeof item === "string" && item.includes("\u0000")) throw new Error("Remove null characters from text and JSON values.");
    if (item && typeof item === "object") {
      for (const [key, child] of Object.entries(item)) {
        if (key.includes("\u0000")) throw new Error("Remove null characters from JSON keys.");
        stack.push([child, depth + 1]);
      }
    }
  }
  return value;
}

export function parseAdminProblems(text: string, batch: boolean): ProblemSeed[] {
  const value = parseAdminJson(text);
  const problems = z.array(problemSchema).min(1).max(10).parse(batch ? value : [value]);
  if (new Set(problems.map((p) => p.slug)).size !== problems.length) throw new Error("Import slugs must be unique.");
  return problems;
}
export function parseAdminRoadmap(text: string) {
  const value = z.strictObject({ content: z.unknown(), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) }).parse(parseAdminJson(text));
  return { ...roadmapBatchSchema.parse([value.content])[0], status: value.status };
}
```

### `src/features/admin/form-model.ts`

```typescript
import { CATEGORIES, TAGS, INTERVIEW_STYLES, PATTERNS } from "@/data/seeds/taxonomy";

export type Field = { key: string; label: string; kind: "text" | "long" | "number" | "select" | "lines" | "choices" | "json" | "array"; options?: readonly (readonly [string, string])[]; fields?: Field[]; initial?: Record<string, unknown>; max?: number; fixed?: boolean };
const languages = ["JAVASCRIPT", "TYPESCRIPT", "PYTHON", "JAVA", "CPP", "SQL"].map((v) => [v, v] as const);
const options = (values: readonly string[]) => values.map((v) => [v, v] as const);
const example = { input: "{}", output: "null", explanation: "" };
const step = { title: "", content: "" };
const solution = { kind: "BRUTE_FORCE", language: "JAVASCRIPT", title: "", intuition: "", approach: "", pseudocode: "", code: "", timeComplexity: "", spaceComplexity: "", commonMistakes: "", interviewExplanation: "", steps: [{ ...step }, { ...step }] };
export const problemFields: Field[] = [
  { key: "slug", label: "Slug (permanent after creation)", kind: "text" }, { key: "title", label: "Title", kind: "text" },
  { key: "status", label: "Publication status", kind: "select", options: options(["DRAFT", "PUBLISHED", "ARCHIVED"]) },
  { key: "difficulty", label: "Difficulty", kind: "select", options: options(["EASY", "MEDIUM", "HARD"]) },
  { key: "pattern", label: "Pattern", kind: "select", options: options(PATTERNS) },
  { key: "statement", label: "Problem statement", kind: "long" }, { key: "constraints", label: "Constraints (one per line)", kind: "lines" },
  { key: "estimatedMinutes", label: "Estimated minutes", kind: "number" }, { key: "timeLimitMs", label: "Time limit (milliseconds)", kind: "number" }, { key: "memoryLimitKb", label: "Memory limit (KB)", kind: "number" },
  { key: "categories", label: "Categories", kind: "choices", options: CATEGORIES }, { key: "tags", label: "Tags", kind: "choices", options: TAGS },
  { key: "interviewStyles", label: "Interview styles", kind: "choices", options: INTERVIEW_STYLES }, { key: "relatedSlugs", label: "Related problem slugs (one per line)", kind: "lines" },
  { key: "examples", label: "Examples (at least two)", kind: "array", initial: example, max: 20, fields: [{ key: "input", label: "Input JSON", kind: "json" }, { key: "output", label: "Expected output JSON", kind: "json" }, { key: "explanation", label: "Explanation", kind: "long" }] },
  { key: "hints", label: "Progressive hints (exactly five)", kind: "array", initial: { content: "" }, max: 5, fixed: true, fields: [{ key: "content", label: "Hint", kind: "long" }] },
  { key: "starterCode", label: "Starter code", kind: "array", initial: { language: "JAVASCRIPT", entryPoint: "solve", code: "" }, max: 6, fields: [{ key: "language", label: "Language", kind: "select", options: languages }, { key: "entryPoint", label: "Entry function", kind: "text" }, { key: "code", label: "Starter code", kind: "long" }] },
  { key: "testCases", label: "Test cases (at least four, visible and hidden)", kind: "array", initial: { ...example, visibility: "HIDDEN" }, max: 200, fields: [{ key: "visibility", label: "Visibility", kind: "select", options: options(["VISIBLE", "HIDDEN"]) }, { key: "input", label: "Input JSON", kind: "json" }, { key: "output", label: "Expected output JSON", kind: "json" }, { key: "explanation", label: "Explanation", kind: "long" }] },
  { key: "solutions", label: "Solutions (brute force and optimal required)", kind: "array", initial: solution, max: 12, fields: [
    { key: "kind", label: "Approach kind", kind: "select", options: options(["BRUTE_FORCE", "BETTER", "OPTIMAL", "ALTERNATIVE"]) }, { key: "language", label: "Language", kind: "select", options: languages },
    ...["title", "intuition", "approach", "pseudocode", "code", "timeComplexity", "spaceComplexity", "interviewExplanation"].map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1"), kind: "long" as const })),
    { key: "commonMistakes", label: "Common mistakes (one per line)", kind: "lines" },
    { key: "steps", label: "Solution steps (at least two)", kind: "array", initial: step, max: 100, fields: [{ key: "title", label: "Step title", kind: "text" }, { key: "content", label: "Step explanation", kind: "long" }] },
  ] },
];
export const roadmapFields: Field[] = [
  { key: "slug", label: "Slug (permanent)", kind: "text" }, { key: "title", label: "Title", kind: "text" }, { key: "description", label: "Description", kind: "long" },
  { key: "difficulty", label: "Difficulty", kind: "select", options: options(["EASY", "MEDIUM", "HARD"]) }, { key: "estimatedMinutes", label: "Estimated minutes", kind: "number" },
  { key: "steps", label: "Ordered roadmap steps", kind: "array", initial: { problemSlug: "", title: "", description: "" }, max: 100, fields: [{ key: "problemSlug", label: "Existing problem slug", kind: "text" }, { key: "title", label: "Step title", kind: "text" }, { key: "description", label: "Step description", kind: "long" }] },
];
export function blankProblem() {
  return { schemaVersion: 1, kind: "CODING", slug: "", title: "", status: "DRAFT", difficulty: "EASY", pattern: PATTERNS[0], statement: "", constraints: "",
    estimatedMinutes: 20, timeLimitMs: 2000, memoryLimitKb: 262144, categories: [], tags: [], interviewStyles: ["general-software"], relatedSlugs: "",
    examples: [{ ...example }, { ...example }], hints: Array.from({ length: 5 }, () => ({ content: "" })),
    starterCode: [{ language: "JAVASCRIPT", entryPoint: "solve", code: "function solve(input) {\n  // Write your solution.\n}" }],
    testCases: Array.from({ length: 4 }, (_, i) => ({ ...example, visibility: i < 2 ? "VISIBLE" : "HIDDEN" })),
    solutions: [structuredClone(solution), { ...structuredClone(solution), kind: "OPTIMAL" }],
  };
}

export function toForm(content: Record<string, unknown>, fields: Field[]): Record<string, unknown> {
  const result = { ...content };
  for (const f of fields) {
    if (f.kind === "json") result[f.key] = JSON.stringify(content[f.key], null, 2);
    if (f.kind === "lines") result[f.key] = (content[f.key] as string[]).join("\n");
    if (f.kind === "array") result[f.key] = (content[f.key] as Record<string, unknown>[]).map((row) => toForm(row, f.fields!));
  }
  return result;
}
export function fromForm(content: Record<string, unknown>, fields: Field[], path = ""): Record<string, unknown> {
  const result = { ...content };
  for (const f of fields) {
    if (f.kind === "json") {
      try { result[f.key] = JSON.parse(String(content[f.key])); } catch { throw new Error(`Invalid JSON at ${path}${f.key}.`); }
    }
    if (f.kind === "lines") result[f.key] = String(content[f.key]).split("\n").map((x) => x.trim()).filter(Boolean);
    if (f.kind === "array") result[f.key] = (content[f.key] as Record<string, unknown>[]).map((row, i) => {
      const value = fromForm(row, f.fields!, `${path}${f.key}.${i + 1}.`);
      if (["examples", "hints", "testCases", "steps"].includes(f.key) && !Object.hasOwn(value, "problemSlug")) value.position = i + 1;
      return value;
    });
  }
  return result;
}
```

### `src/features/admin/load.ts`

```typescript
import "server-only";
import { requireAdmin } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { roadmapSlug } from "@/lib/validators/roadmap";
import { queryAdminIndex, queryAdminProblem, queryAdminRoadmap, type AdminFilters } from "./query";
type Params = Record<string, string | string[] | undefined>;
export function adminFilters(params: Params): AdminFilters {
  const q = typeof params.q === "string" ? params.q.replaceAll("\u0000", "").trim().slice(0, 100) : "";
  const status = params.status === "DRAFT" || params.status === "PUBLISHED" || params.status === "ARCHIVED" ? params.status : "";
  const page = typeof params.page === "string" && /^[1-9][0-9]{0,5}$/.test(params.page) ? Number(params.page) : 1;
  return { q, status, page };
}
export function adminHref(filters: AdminFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q); if (filters.status) params.set("status", filters.status); if (filters.page > 1) params.set("page", String(filters.page));
  return "/admin" + (params.size ? `?${params}` : "");
}
export async function loadAdminIndex(params: Params) {
  const viewer = await requireAdmin(); const filters = adminFilters(params);
  return { filters, result: await queryAdminIndex(getDatabase(), viewer.id, filters) };
}
export async function loadAdminProblem(slug: string) {
  const viewer = await requireAdmin();
  if (!roadmapSlug.safeParse(slug).success) return null;
  return queryAdminProblem(getDatabase(), viewer.id, slug);
}
export async function loadAdminRoadmap(slug: string) {
  const viewer = await requireAdmin();
  if (!roadmapSlug.safeParse(slug).success) return null;
  return queryAdminRoadmap(getDatabase(), viewer.id, slug);
}
```

### `src/features/admin/query.ts`

```typescript
import "server-only";
import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { lockAdmin } from "./access";

export const adminProblemSelect = {
  slug: true, title: true, difficulty: true, kind: true, status: true, pattern: true,
  statement: true, constraints: true, estimatedMinutes: true, timeLimitMs: true, memoryLimitKb: true, revision: true,
  categories: { select: { category: { select: { slug: true } } } }, tags: { select: { tag: { select: { slug: true } } } },
  interviewStyles: { select: { style: { select: { slug: true } } } }, related: { select: { related: { select: { slug: true } } } },
  examples: { orderBy: { position: "asc" }, select: { position: true, input: true, output: true, explanation: true } },
  hints: { orderBy: { position: "asc" }, select: { position: true, content: true } },
  starterCode: { orderBy: { language: "asc" }, select: { language: true, entryPoint: true, code: true } },
  testCases: { orderBy: { position: "asc" }, select: { position: true, visibility: true, input: true, output: true, explanation: true } },
  solutions: { orderBy: [{ kind: "asc" }, { language: "asc" }], select: { kind: true, language: true, title: true, intuition: true, approach: true, pseudocode: true, code: true, timeComplexity: true, spaceComplexity: true, commonMistakes: true, interviewExplanation: true,
    steps: { orderBy: { position: "asc" }, select: { position: true, title: true, content: true } } } },
} satisfies Prisma.ProblemSelect;

export const adminRoadmapSelect = { slug: true, title: true, description: true, difficulty: true, estimatedMinutes: true, status: true, updatedAt: true,
  steps: { orderBy: { position: "asc" }, select: { position: true, title: true, description: true, problem: { select: { slug: true } } } },
} satisfies Prisma.RoadmapSelect;
export function roadmapToken(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

export async function queryAdminProblem(db: PrismaClient, userId: string, slug: string) {
  return db.$transaction(async (tx) => {
    await lockAdmin(tx, userId);
    const row = await tx.problem.findUnique({ where: { slug }, select: adminProblemSelect });
    if (!row) return null;
    const { revision, categories, tags, interviewStyles, related, ...content } = row;
    return { revision, content: { ...content, schemaVersion: 1 as const, categories: categories.map((x) => x.category.slug).sort(), tags: tags.map((x) => x.tag.slug).sort(),
      interviewStyles: interviewStyles.map((x) => x.style.slug).sort(), relatedSlugs: related.map((x) => x.related.slug).sort(), testCases: content.testCases.map((x) => ({ ...x, explanation: x.explanation ?? "" })) } };
  }, { isolationLevel: "RepeatableRead" });
}
export async function queryAdminRoadmap(db: PrismaClient, userId: string, slug: string) {
  return db.$transaction(async (tx) => {
    await lockAdmin(tx, userId);
    const row = await tx.roadmap.findUnique({ where: { slug }, select: adminRoadmapSelect });
    if (!row) return null;
    const { steps, status } = row;
    const content = { slug: row.slug, title: row.title, description: row.description, difficulty: row.difficulty, estimatedMinutes: row.estimatedMinutes };
    return { token: roadmapToken(row), status, content: { ...content, steps: steps.map((s) => ({ problemSlug: s.problem.slug, title: s.title, description: s.description ?? "" })) } };
  }, { isolationLevel: "RepeatableRead" });
}

export type AdminFilters = { q: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | ""; page: number };
export async function queryAdminIndex(db: PrismaClient, userId: string, filters: AdminFilters) {
  return db.$transaction(async (tx) => {
    await lockAdmin(tx, userId);
    const where = { ...(filters.status ? { status: filters.status } : {}), ...(filters.q ? { title: { contains: filters.q, mode: "insensitive" as const } } : {}) };
    const total = await tx.problem.count({ where }); const pages = Math.max(1, Math.ceil(total / 20)); const page = Math.min(Math.max(filters.page, 1), pages);
    const problems = await tx.problem.findMany({ where, orderBy: [{ title: "asc" }, { slug: "asc" }], skip: (page - 1) * 20, take: 20,
      select: { slug: true, title: true, status: true, difficulty: true, revision: true } });
    const roadmaps = await tx.roadmap.findMany({ orderBy: [{ title: "asc" }, { slug: "asc" }], take: 100, select: { slug: true, title: true, status: true } });
    return { problems, roadmaps, total, pages, page };
  }, { isolationLevel: "RepeatableRead" });
}
```

### `src/features/admin/write.ts`

```typescript
import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { ProblemSeed } from "@/lib/validators/problem";
import { validateProblemSemantics } from "../../../scripts/lib/reference-problems";
import { makeProgram, runnerSupports } from "@/features/submissions/harness";
import { AdminError, lockAdmin } from "./access";
import { adminCommand, parseAdminProblems, parseAdminRoadmap, type AdminResult } from "./contracts";
import { adminRoadmapSelect, roadmapToken } from "./query";

const json = (value: unknown) => value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
function contentData(p: ProblemSeed) {
  return { title: p.title, difficulty: p.difficulty, kind: p.kind, status: p.status, pattern: p.pattern,
    statement: p.statement, constraints: p.constraints, estimatedMinutes: p.estimatedMinutes, timeLimitMs: p.timeLimitMs, memoryLimitKb: p.memoryLimitKb,
    seedHash: null, publishedAt: p.status === "PUBLISHED" ? new Date() : null };
}
function relations(p: ProblemSeed) {
  return {
    examples: p.examples.map((e) => ({ ...e, input: json(e.input), output: json(e.output) })), hints: p.hints,
    starterCode: p.starterCode, testCases: p.testCases.map((t) => ({ ...t, input: json(t.input), output: json(t.output) })),
    solutions: p.solutions.map((s) => ({ ...s, steps: { create: s.steps } })),
    categories: p.categories.map((slug) => ({ category: { connect: { slug } } })), tags: p.tags.map((slug) => ({ tag: { connect: { slug } } })),
    interviewStyles: p.interviewStyles.map((slug) => ({ style: { connect: { slug } } })),
  };
}
function checkProblem(p: ProblemSeed, reviewed: boolean) {
  if (p.slug === "new") throw new AdminError("Choose a slug other than the reserved word new.");
  if (p.status === "PUBLISHED" && !reviewed) throw new AdminError("Confirm that you reviewed originality, explanations and expected outputs before publishing.");
  if (runnerSupports(p.slug)) {
    const js = p.starterCode.find((s) => s.language === "JAVASCRIPT");
    if (!js || p.testCases.length > 10) throw new AdminError("Existing runner problems require JavaScript and at most ten test cases.");
    try { makeProgram(p.slug, js.entryPoint, ""); validateProblemSemantics(p); }
    catch { throw new AdminError("An existing runner problem has an invalid signature, input or expected output. Keep its reviewed contract intact."); }
  }
}

// Input is validated again here; caller must supply an identity from provider verification.
export async function writeAdmin(db: PrismaClient, userId: string, raw: unknown): Promise<AdminResult> {
  const command = adminCommand.parse(raw);
  return db.$transaction(async (tx) => {
    await lockAdmin(tx, userId);
    // One order across content operations; the roadmap lock also coordinates with seeds.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(713013::bigint)`;
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(712012::bigint)`;
    if (command.operation === "roadmap") {
      const p = parseAdminRoadmap(command.payload);
      if (p.slug !== command.slug) throw new AdminError("Roadmap slugs cannot change.");
      await tx.$queryRaw`SELECT id FROM app."Roadmap" WHERE slug = ${p.slug} FOR UPDATE`;
      const current = await tx.roadmap.findUnique({ where: { slug: p.slug }, select: adminRoadmapSelect });
      if (!current || roadmapToken(current) !== command.token) throw new AdminError("This roadmap changed. Copy your draft and reload before saving.");
      if (p.status === "PUBLISHED" && !command.reviewed) throw new AdminError("Confirm the roadmap sequence was reviewed before publishing.");
      const problems = await tx.problem.findMany({ where: { slug: { in: p.steps.map((s) => s.problemSlug) } }, select: { slug: true, id: true, status: true } });
      if (problems.length !== p.steps.length || (p.status === "PUBLISHED" && problems.some((x) => x.status !== "PUBLISHED"))) throw new AdminError("Every step must exist; published roadmaps require published problems.");
      const ids = new Map(problems.map((x) => [x.slug, x.id]));
      await tx.roadmap.update({ where: { slug: p.slug }, data: { title: p.title, description: p.description, difficulty: p.difficulty, estimatedMinutes: p.estimatedMinutes, status: p.status,
        steps: { deleteMany: {}, create: p.steps.map((s, i) => ({ problemId: ids.get(s.problemSlug)!, position: i + 1, title: s.title, description: s.description })) } } });
      const saved = await tx.roadmap.findUniqueOrThrow({ where: { slug: p.slug }, select: adminRoadmapSelect });
      return { success: true, message: "Roadmap saved.", slug: p.slug, token: roadmapToken(saved) };
    }
    if (command.operation === "archive" || command.operation === "delete") {
      if (command.confirmation !== command.slug) throw new AdminError("Type the exact problem slug to confirm.");
      const [row] = await tx.$queryRaw<{ id: string; revision: number; status: string }[]>`SELECT id, revision, status FROM app."Problem" WHERE slug = ${command.slug} FOR UPDATE`;
      if (!row || row.revision !== command.revision) throw new AdminError("This problem changed. Reload before trying again.");
      if (command.operation === "delete") {
        const counts = await tx.problem.findUniqueOrThrow({ where: { id: row.id }, select: { _count: { select: { progress: true, notes: true, submissions: true, roadmapSteps: true, interviewQuestions: true, related: true, relatedTo: true } } } });
        if (row.status !== "ARCHIVED" || Object.values(counts._count).some((count) => count > 0)) throw new AdminError("Only archived problems with no user history, roadmap, interview or related-problem references can be deleted. Keep this problem archived.");
        await tx.problem.delete({ where: { id: row.id } });
        return { success: true, message: "Problem deleted.", deleted: true };
      }
      const revision = row.status === "ARCHIVED" ? row.revision : row.revision + 1;
      if (row.status !== "ARCHIVED") await tx.problem.update({ where: { id: row.id }, data: { status: "ARCHIVED", revision, seedHash: null } });
      return { success: true, message: "Problem archived. User history is preserved.", slug: command.slug, revision };
    }
    const problems = parseAdminProblems(command.payload, command.operation === "import");
    for (const problem of problems) checkProblem(problem, command.reviewed);
    const editing = command.operation === "save" && command.slug !== null;
    if (command.operation === "save" && ((command.slug === null) !== (command.revision === null))) throw new AdminError("Invalid create/edit version.");
    if (editing && problems[0].slug !== command.slug) throw new AdminError("Problem slugs cannot change after creation.");
    let existing: { id: string; revision: number } | undefined;
    if (editing) {
      [existing] = await tx.$queryRaw<{ id: string; revision: number }[]>`SELECT id, revision FROM app."Problem" WHERE slug = ${command.slug} FOR UPDATE`;
      if (!existing || existing.revision !== command.revision) throw new AdminError("This problem changed in another tab. Copy your draft and reload before saving.");
    } else if (await tx.problem.count({ where: { slug: { in: problems.map((p) => p.slug) } } })) throw new AdminError("A problem slug already exists. Imports create new problems only; no existing content was changed.");
    const relatedSlugs = [...new Set(problems.flatMap((p) => p.relatedSlugs))];
    const related = await tx.problem.findMany({ where: { slug: { in: relatedSlugs } }, select: { slug: true, id: true } });
    const available = new Set([...related.map((p) => p.slug), ...problems.map((p) => p.slug)]);
    if (relatedSlugs.some((slug) => !available.has(slug))) throw new AdminError("A related problem slug does not exist in the collection or this import.");
    const ids = new Map(related.map((p) => [p.slug, p.id]));
    for (const p of problems) {
      const r = relations(p);
      const created = existing ? await tx.problem.update({ where: { id: existing.id }, data: { ...contentData(p), revision: existing.revision + 1,
        examples: { deleteMany: {}, create: r.examples }, hints: { deleteMany: {}, create: r.hints }, starterCode: { deleteMany: {}, create: r.starterCode },
        testCases: { deleteMany: {}, create: r.testCases }, solutions: { deleteMany: {}, create: r.solutions }, categories: { deleteMany: {}, create: r.categories },
        tags: { deleteMany: {}, create: r.tags }, interviewStyles: { deleteMany: {}, create: r.interviewStyles },
      }, select: { id: true } }) : await tx.problem.create({ data: { ...contentData(p), slug: p.slug,
        examples: { create: r.examples }, hints: { create: r.hints }, starterCode: { create: r.starterCode }, testCases: { create: r.testCases }, solutions: { create: r.solutions },
        categories: { create: r.categories }, tags: { create: r.tags }, interviewStyles: { create: r.interviewStyles },
      }, select: { id: true } });
      ids.set(p.slug, created.id);
    }
    for (const p of problems) {
      const problemId = ids.get(p.slug)!;
      await tx.problemRelation.deleteMany({ where: { problemId } });
      if (p.relatedSlugs.length) await tx.problemRelation.createMany({ data: p.relatedSlugs.map((slug) => ({ problemId, relatedId: ids.get(slug)! })) });
    }
    return command.operation === "import" ? { success: true, message: `Imported ${problems.length} problems. No existing content was overwritten.` } :
      { success: true, message: "Problem saved. Previous solves retain their recorded revision.", slug: problems[0].slug, revision: existing ? existing.revision + 1 : 1 };
  }, { timeout: 30_000 });
}
```

### `tests/admin-boundaries.test.ts`

```typescript
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ viewer: vi.fn(), admin: vi.fn(), db: vi.fn(), write: vi.fn(), problem: vi.fn(), roadmap: vi.fn(), index: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ getViewer: m.viewer, requireAdmin: m.admin }));
vi.mock("@/lib/prisma", () => ({ getDatabase: m.db }));
vi.mock("@/features/admin/write", () => ({ writeAdmin: m.write }));
vi.mock("@/features/admin/query", () => ({ queryAdminProblem: m.problem, queryAdminRoadmap: m.roadmap, queryAdminIndex: m.index }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
import { administer } from "@/features/admin/actions";
import { loadAdminIndex, loadAdminProblem, loadAdminRoadmap, adminFilters, adminHref } from "@/features/admin/load";
import { AdminError } from "@/features/admin/access";
beforeEach(() => { vi.clearAllMocks(); m.viewer.mockResolvedValue({ id: "verified-admin", role: "ADMIN" }); m.admin.mockResolvedValue({ id: "verified-admin" }); m.db.mockReturnValue("db"); m.write.mockResolvedValue({ success: true, message: "Saved" }); });
it("denies guests, ordinary users and provider failures before parsing or writing", async () => {
  for (const viewer of [null, { id: "user", role: "USER" }]) { m.viewer.mockResolvedValue(viewer); expect((await administer({ role: "ADMIN", payload: "hidden" })).success).toBe(false); }
  m.viewer.mockRejectedValue(new Error("private provider token")); expect(JSON.stringify(await administer({}))).not.toContain("private provider");
  expect(m.write).not.toHaveBeenCalled(); expect(m.db).not.toHaveBeenCalled(); expect(m.revalidate).not.toHaveBeenCalled();
});
it("uses the verified actor and revalidates only after a confirmed save", async () => {
  const raw = { operation: "save" }; await administer(raw); expect(m.write).toHaveBeenCalledWith("db", "verified-admin", raw);
  expect(m.revalidate).toHaveBeenCalledWith("/problems/[slug]", "page"); expect(m.revalidate).toHaveBeenCalledWith("/admin/roadmaps/[slug]", "page");
  m.revalidate.mockClear(); m.write.mockRejectedValue(new AdminError("Stale revision"));
  expect(await administer(raw)).toMatchObject({ success: false, message: "Stale revision" }); expect(m.revalidate).not.toHaveBeenCalled();
  m.write.mockRejectedValue(new Error("postgresql://secret")); expect(JSON.stringify(await administer(raw))).not.toContain("secret");
});
it("guards all sensitive reads before database access", async () => {
  m.admin.mockRejectedValue(new Error("NOT_FOUND"));
  await expect(loadAdminProblem("quiet-badge")).rejects.toThrow("NOT_FOUND"); await expect(loadAdminRoadmap("scan-store-reuse")).rejects.toThrow("NOT_FOUND"); await expect(loadAdminIndex({ userId: "forged" })).rejects.toThrow("NOT_FOUND");
  expect(m.db).not.toHaveBeenCalled(); expect(m.problem).not.toHaveBeenCalled(); expect(m.roadmap).not.toHaveBeenCalled(); expect(m.index).not.toHaveBeenCalled();
});
it("validates read parameters and ignores user-supplied roles and owners", async () => {
  expect(await loadAdminProblem("../hidden")).toBeNull(); expect(m.problem).not.toHaveBeenCalled();
  await loadAdminIndex({ q: "  title\u0000  ", status: "PUBLISHED", page: "3", userId: "forged", role: "ADMIN" });
  expect(m.index).toHaveBeenCalledWith("db", "verified-admin", { q: "title", status: "PUBLISHED", page: 3 });
  expect(adminFilters({ page: ["3"], status: "FORGED" })).toEqual({ q: "", page: 1, status: "" });
  expect(adminHref({ q: "A&B", page: 2, status: "DRAFT" })).toBe("/admin?q=A%26B&status=DRAFT&page=2");
});
```

### `tests/admin-content.test.ts`

```typescript
import { expect, it } from "vitest";
import { adminCommand, parseAdminJson, parseAdminProblems } from "@/features/admin/contracts";
import { fromForm, toForm, problemFields, roadmapFields } from "@/features/admin/form-model";
import { loadProblems } from "../scripts/lib/load-problems";
import { ROADMAPS } from "@/data/seeds/roadmaps";
it("round-trips the full original content through structured fields", async () => {
  for (const problem of await loadProblems()) expect(fromForm(toForm(problem, problemFields), problemFields)).toEqual(problem);
  for (const roadmap of ROADMAPS) expect(fromForm(toForm(roadmap, roadmapFields), roadmapFields)).toEqual(roadmap);
});
it("reindexes reordered cases and reports the exact JSON field without executing code", async () => {
  const problem = (await loadProblems())[0]; const form = toForm(problem, problemFields);
  const examples = form.examples as Record<string, unknown>[]; form.examples = [...examples].reverse();
  const output = fromForm(form, problemFields); expect((output.examples as { position: number }[]).map((e) => e.position)).toEqual([1, 2]);
  examples[0].input = "function evil() {}"; form.examples = examples;
  expect(() => fromForm(form, problemFields)).toThrow("Invalid JSON at examples.1.input");
});
it("rejects oversized/deep/null JSON, duplicate imports and untrusted command fields", async () => {
  expect(() => parseAdminJson(JSON.stringify("x".repeat(400001)))).toThrow(/400 KB/);
  expect(() => parseAdminJson('"\\u0000"')).toThrow(/null characters/);
  expect(() => parseAdminJson('['.repeat(26)+'0'+']'.repeat(26))).toThrow(/deeply/);
  const p = (await loadProblems())[0]; expect(() => parseAdminProblems(JSON.stringify([p, p]), true)).toThrow(/unique/);
  expect(() => parseAdminProblems(JSON.stringify(Array(11).fill(p)), true)).toThrow();
  expect(adminCommand.safeParse({ operation: "delete", slug: p.slug, revision: 1, confirmation: p.slug, userId: "forged" }).success).toBe(false);
});
```

### `tests/admin-editor.test.ts`

```typescript
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ save: vi.fn(), replace: vi.fn() }));
vi.mock("@/features/admin/actions", () => ({ administer: m.save }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: m.replace }) }));
import { ContentEditor } from "@/components/admin/content-editor";
import { loadProblems } from "../scripts/lib/load-problems";
let host: HTMLDivElement; let root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
async function render(revision = 1) { const p = (await loadProblems())[0]; await act(() => root.render(createElement(ContentEditor, { kind: "problem", initial: p, slug: p.slug, revision }))); }
const submit = () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
it("retains drafts and stale baseline after conflicts or unrelated server refreshes", async () => {
  await render(); const input = [...host.querySelectorAll("input")].find((x) => x.id.endsWith("-title"))!;
  await act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "My unsaved title"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  m.save.mockResolvedValue({ success: false, message: "Stale revision" }); await act(async () => { submit(); });
  expect(input.value).toBe("My unsaved title"); expect(host.textContent).toContain("Stale revision");
  await render(2); await act(async () => { submit(); }); expect(m.save.mock.calls[1][0].revision).toBe(1);
  expect((host.querySelectorAll("fieldset")[host.querySelectorAll("fieldset").length - 1] as HTMLFieldSetElement).disabled).toBe(true);
});
it("blocks duplicate requests while pending and advances revision only after confirmed success", async () => {
  await render(); let resolve!: (value: unknown) => void; m.save.mockImplementation(() => new Promise((r) => { resolve = r; }));
  await act(() => { submit(); submit(); }); expect(m.save).toHaveBeenCalledOnce(); expect(host.querySelector("fieldset")!.disabled).toBe(true);
  await act(async () => { resolve({ success: true, message: "Saved", revision: 2 }); });
  m.save.mockResolvedValue({ success: false, message: "Conflict" }); await act(async () => { submit(); });
  expect(m.save.mock.calls[1][0].revision).toBe(2);
});
it("keeps content on unconfirmed responses without exposing transport details", async () => {
  await render(); m.save.mockRejectedValue(new Error("secret transport")); await act(async () => { submit(); });
  expect(host.textContent).toContain("draft is retained"); expect(host.textContent).not.toContain("secret transport"); expect(host.querySelector("textarea")!.value).not.toBe("");
});
```

### `tests/integration/admin.test.ts`

```typescript
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { writeAdmin } from "@/features/admin/write";
import { queryAdminIndex, queryAdminProblem, queryAdminRoadmap } from "@/features/admin/query";
import { queryProblem } from "@/features/problems/detail-query";
import { writeProblemChange } from "@/features/problems/detail-write";
import { reserveSubmission, finishSubmission } from "@/features/submissions/store";
import { queryRoadmap } from "@/features/roadmaps/query";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import { seedRoadmaps } from "../../prisma/seed-roadmaps";
import { ROADMAPS } from "@/data/seeds/roadmaps";
import type { ProblemSeed } from "@/lib/validators/problem";
let db: ReturnType<typeof createDatabaseClient>; let owns = false; let seeds: ProblemSeed[] = [];
const admin = randomUUID(), user = randomUUID(); const prefix = `admin-${randomUUID()}`;
const filter = { q: "", status: "" as const, page: 1 };
const ownedProblems = () => ({ OR: [{ slug: { in: seeds.map((p) => p.slug) } }, { slug: { startsWith: prefix } }] });
async function clear() {
  await db.roadmap.deleteMany({ where: { slug: { in: ROADMAPS.map((r) => r.slug) } } });
  await db.userSubmission.deleteMany({ where: { userId: { in: [admin, user] } } });
  await db.userProgress.deleteMany({ where: { userId: { in: [admin, user] } } });
  await db.userNote.deleteMany({ where: { userId: { in: [admin, user] } } });
  await db.problem.deleteMany({ where: ownedProblems() });
}
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use an empty disposable TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url); if (await db.problem.count() || await db.roadmap.count()) throw new Error("Admin tests require an empty collection.");
  seeds = await loadProblems(); owns = true; await db.user.createMany({ data: [{ id: admin, role: "ADMIN" }, { id: user }] });
}, 30000);
beforeEach(async () => { await clear(); await db.user.update({ where: { id: admin }, data: { role: "ADMIN" } }); await seedProblems(db, seeds); }, 30000);
afterAll(async () => { if (db && owns) { await clear(); await db.user.deleteMany({ where: { id: { in: [admin, user] } } }); } await db?.$disconnect(); });
const custom = (suffix: string, changes: Partial<ProblemSeed> = {}): ProblemSeed => ({ ...structuredClone(seeds[0]), slug: `${prefix}-${suffix}`, title: `Admin fixture ${suffix}`, relatedSlugs: [], status: "DRAFT", ...changes });
const save = (p: ProblemSeed, revision: number | null = null, reviewed = false) => writeAdmin(db, admin, { operation: "save", slug: revision === null ? null : p.slug, revision, payload: JSON.stringify(p), reviewed });
const lifecycle = (slug: string, revision: number, operation: "archive" | "delete") => writeAdmin(db, admin, { operation, slug, revision, confirmation: slug });
it("rechecks database authorization for reads/writes and rejects revoked administrator sessions", async () => {
  for (const id of [user, randomUUID()]) {
    await expect(queryAdminProblem(db, id, "relay-window")).rejects.toThrow(/Administrator/);
    await expect(queryAdminIndex(db, id, filter)).rejects.toThrow(/Administrator/);
    await expect(writeAdmin(db, id, { operation: "import", payload: "[]", reviewed: false })).rejects.toThrow(/Administrator/);
  }
  await db.user.update({ where: { id: admin }, data: { role: "USER" } });
  await expect(save(custom("revoked"))).rejects.toThrow(/Administrator/); expect(await db.problem.count()).toBe(5);
});
it("creates complete structured content and keeps hidden tests out of public projections", async () => {
  const p = custom("complete", { status: "PUBLISHED" }); p.testCases.find((x) => x.visibility === "HIDDEN")!.explanation = "PRIVATE-ADMIN-TEST";
  await expect(save(p)).rejects.toThrow(/reviewed/); expect((await save(p, null, true)).revision).toBe(1);
  const row = await queryAdminProblem(db, admin, p.slug); expect(row?.content.testCases).toHaveLength(p.testCases.length);
  expect(JSON.stringify(row)).toContain("PRIVATE-ADMIN-TEST"); expect(JSON.stringify(await queryProblem(db, p.slug, null))).not.toContain("PRIVATE-ADMIN-TEST");
  expect(await db.problem.findUniqueOrThrow({ where: { slug: p.slug } })).toMatchObject({ seedHash: null, revision: 1, status: "PUBLISHED", publishedAt: expect.any(Date) });
});
it("updates content atomically, advances revisions and retains all user history and seed conflicts", async () => {
  const p = structuredClone(seeds.find((x) => x.slug === "relay-window")!);
  const problem = await db.problem.findUniqueOrThrow({ where: { slug: p.slug } }); const at = new Date("2026-01-01T00:00:00Z");
  await db.userProgress.create({ data: { userId: user, problemId: problem.id, status: "SOLVED", solvedAt: at, verifiedRevision: 1, verifiedAt: at, bookmarked: true, reviewLater: true } });
  await writeProblemChange(db, user, { operation: "save-note", slug: p.slug, content: "PRIVATE-HISTORY", expectedContent: "" });
  p.title = "Revised Relay Window"; p.hints[0].content = "Revised guidance";
  expect((await save(p, 1, true)).revision).toBe(2);
  expect((await queryAdminProblem(db, admin, p.slug))?.content.hints[0].content).toBe("Revised guidance");
  expect((await queryProblem(db, p.slug, user))?.personal).toMatchObject({ note: "PRIVATE-HISTORY", bookmarked: true, progress: { verification: "earlier", reviewLater: true } });
  expect((await db.problem.findUniqueOrThrow({ where: { slug: p.slug } })).id).toBe(problem.id);
  await expect(seedProblems(db, seeds)).rejects.toThrow(/Seed conflict/);
});
it("serializes stale editors so exactly one concurrent save succeeds", async () => {
  const p = custom("concurrent"); await save(p);
  const result = await Promise.allSettled([save({ ...p, title: "First editor" }, 1), save({ ...p, title: "Second editor" }, 1)]);
  expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await queryAdminProblem(db, admin, p.slug))?.revision).toBe(2);
  await expect(save(p, 1)).rejects.toThrow(/another tab/);
});
it("preserves in-flight attempt history without verifying an outdated edited revision", async () => {
  const p = structuredClone(seeds.find((x) => x.slug === "relay-window")!);
  const reserved = await reserveSubmission(db, user, { slug: p.slug, language: "JAVASCRIPT", mode: "SUBMIT", code: "SOURCE-RETAINED" });
  if (!("id" in reserved)) throw new Error("Expected reservation");
  await save({ ...p, title: "Edited during execution" }, 1, true);
  await finishSubmission(db, user, { id: reserved.id!, mode: "SUBMIT", status: "ACCEPTED", passedCount: reserved.cases!.length, totalCount: reserved.cases!.length, runtimeMs: 1, memoryKb: 10, cases: [] });
  expect((await queryProblem(db, p.slug, user))?.personal?.progress).toMatchObject({ status: "ATTEMPTED", verification: null });
  expect((await db.userSubmission.findUniqueOrThrow({ where: { id: reserved.id } })).code).toBe("SOURCE-RETAINED");
});
it("imports create-only batches with internal links and rolls back every new row on any failure", async () => {
  const a = custom("import-a"), b = custom("import-b"); a.relatedSlugs = [b.slug];
  await writeAdmin(db, admin, { operation: "import", payload: JSON.stringify([a, b]), reviewed: false });
  expect((await queryAdminProblem(db, admin, a.slug))?.content.relatedSlugs).toEqual([b.slug]);
  await expect(writeAdmin(db, admin, { operation: "import", payload: JSON.stringify([custom("rollback"), a]), reviewed: false })).rejects.toThrow(/already exists/);
  expect(await db.problem.count({ where: { slug: custom("rollback").slug } })).toBe(0);
  await expect(writeAdmin(db, admin, { operation: "import", payload: JSON.stringify([custom("rollback"), custom("bad", { relatedSlugs: ["missing-problem"] })]), reviewed: false })).rejects.toThrow(/related problem/);
  expect(await db.problem.count()).toBe(7);
});
it("archives with stale checks and only deletes unreferenced archived problems", async () => {
  const p = custom("deletion"); await save(p); await expect(lifecycle(p.slug, 1, "delete")).rejects.toThrow(/Only archived/);
  await lifecycle(p.slug, 1, "archive"); await expect(lifecycle(p.slug, 1, "delete")).rejects.toThrow(/changed/);
  await lifecycle(p.slug, 2, "delete"); expect(await queryAdminProblem(db, admin, p.slug)).toBeNull();
  await writeProblemChange(db, user, { slug: "quiet-badge", operation: "mark-solved" }); await lifecycle("quiet-badge", 1, "archive");
  await expect(lifecycle("quiet-badge", 2, "delete")).rejects.toThrow(/history/);
  expect(await db.userProgress.count({ where: { userId: user } })).toBe(1);
  await expect(writeAdmin(db, admin, { operation: "archive", slug: "dock-threshold", revision: 1, confirmation: "wrong" })).rejects.toThrow(/exact problem slug/);
});
it("edits ordered roadmap placement with conflict tokens and preserves existing seed protection", async () => {
  await seedRoadmaps(db, ROADMAPS); const slug = ROADMAPS[0].slug;
  const row = (await queryAdminRoadmap(db, admin, slug))!;
  const content = { ...row.content, steps: [...row.content.steps].reverse() };
  const command = { operation: "roadmap", slug, token: row.token, payload: JSON.stringify({ content, status: "PUBLISHED" }), reviewed: true };
  await writeAdmin(db, admin, command);
  expect((await queryRoadmap(db, null, slug))?.steps.map((s) => s.problem.slug)).toEqual(content.steps.map((s) => s.problemSlug));
  await expect(writeAdmin(db, admin, command)).rejects.toThrow(/roadmap changed/);
  await expect(seedRoadmaps(db, ROADMAPS)).rejects.toThrow(/seed conflict/);
  await lifecycle("quiet-badge", 1, "archive"); expect(await queryRoadmap(db, null, slug)).toBeNull();
});
it("protects runner contracts and rejects reserved slugs before writing", async () => {
  const p = structuredClone(seeds.find((x) => x.slug === "relay-window")!); p.testCases[0].output = 9999999;
  await expect(save(p, 1, true)).rejects.toThrow(/expected output/);
  expect((await queryAdminProblem(db, admin, p.slug))?.revision).toBe(1);
  await expect(save(custom("reserved", { slug: "new" }))).rejects.toThrow(/reserved/);
});
it("lists twenty safe summaries per page with stable title search and status filters", async () => {
  for (let start = 0; start < 21; start += 10) await writeAdmin(db, admin, { operation: "import", payload: JSON.stringify(Array.from({ length: Math.min(10, 21-start) }, (_, i) => custom(`page-${String(start+i).padStart(2,"0")}`, { title: "AAA Admin tie" }))), reviewed: false });
  const first = await queryAdminIndex(db, admin, { ...filter, q: "aaa", status: "DRAFT" }); const last = await queryAdminIndex(db, admin, { ...filter, q: "AAA", page: 999 });
  expect(first.problems).toHaveLength(20); expect(last.problems).toHaveLength(1); expect(last.page).toBe(2);
  expect(new Set([...first.problems, ...last.problems].map((p) => p.slug)).size).toBe(21);
  expect(JSON.stringify(first)).not.toMatch(/testCases|statement|code|seedHash/);
});
```
