# AlgoSprint Phase 7 — complete editor workspace

## 🟦 What this phase builds

Phase 7 puts a Monaco code editor on each published problem page. It includes language selection, starter loading, independent in-memory drafts, a confirmed reset control, an output panel and a test-results panel. This completes both halves of the Phase 7 brief.

The editor supports writing code. **Nothing runs or submits code yet.** The output panel says there is no output, runtime/memory are not measured, and example cases are marked Not run. The test-results panel displays public inputs and expected outputs as reference material. The safe execution design belongs to Phase 8.

The earlier first-half guide remains a historical checkpoint. Use this guide and the current source for the completed phase.

## 🟦 Run the completed checkpoint

Use Node.js 24. For a new checkout:

```bash
git clone https://github.com/zihadpcode/AlgoSprint.git
cd AlgoSprint
git switch main
npm ci
cp .env.example .env.local
```

If PR #8 is still open, switch to `algosprint/phase-7-editor-part-1` before installing. The branch retains its original name but now includes both halves. Preserve existing work and an already configured environment file when updating an existing clone.

Configure development PostgreSQL according to Phase 2, then:

```bash
npm run db:deploy
npm run db:seed
npm run dev
```

Open `http://localhost:3000/problems/relay-window` and follow the Code editor section link. A seeded database is needed to load problems; public editing does not require sign-in. Supabase is needed for the separate notes/progress controls, as described in Phase 3.

The first half pinned these dependencies:

```bash
npm install --save-exact monaco-editor@0.56.0
npm install --save-dev --save-exact happy-dom@20.14.5
```

For the completed branch, use `npm ci`; the generated lockfile is committed. The second half adds no dependency, migration or seed change.

## 🟨 Architecture and data flow

The server detail loader still verifies publication status and reads explicit public fields. The page passes only starter records and public `ProblemExample` records into the editor. It never passes hidden `TestCase` records, submissions, other users' notes or operational identifiers.

`CodeEditor` is a Client Component containing a dynamic import with `ssr: false`. The installed Next.js guide requires this option to be inside a Client Component. The heavy Monaco surface therefore loads in the browser, while problem queries remain on the server.

Monaco uses its supported 0.56 ESM editor, features and six syntax definitions, with a bundled same-origin worker. It does not use a CDN loader or an execution service. Syntax highlighting is not compilation or a language server. Read the [Monaco changelog](https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md) and [model/editor concepts](https://github.com/microsoft/monaco-editor/blob/main/README.md) for dependency context.

## 🟨 Draft and editor lifecycle

The language map translates the database's JavaScript, TypeScript, Python, Java, C++ and SQL enum values into readable labels and Monaco IDs. The selector includes only starters actually supplied by the current problem. Tests use multiple-language fixtures without changing the original seeds.

Each language has its own draft string. On first selection, the editor uses its starter. Switching back retrieves the draft. Nullish coalescing preserves intentionally empty code; using a truthiness fallback would incorrectly restore the starter after the learner deleted everything.

The Monaco surface creates a model and editor in an effect. A content listener reports actual edits using the latest callback. A separate effect synchronizes external values only when they differ from Monaco's value. A synchronization flag prevents programmatic starter/reset updates from being reported as typing. Avoiding redundant `setValue` calls preserves ordinary typing undo behavior.

When the language changes or the component unmounts, the listener, view and model are disposed. Editor initialization failure also disposes its model. The page keys the workspace by problem slug: unrelated same-problem rerenders preserve drafts; different problem pages create new state.

Drafts live only in this page's React state. Refreshing or leaving discards them. Language switches preserve text but not cursor/undo history. There is no database, localStorage or remote draft service.

## 🟨 Deliberate reset behavior

“Reset to starter” is disabled when the active code already equals the starter, and while a reset prompt is open. Clicking it does not alter the code. It opens an inline confirmation naming the active language.

Focus moves to “Keep my code,” making cancellation the first keyboard choice. Cancel or Escape dismisses the prompt and returns focus to the language selector. Confirm replaces only the selected language's draft and announces the reset in a status message. Other-language drafts are preserved.

If the learner changes language or types newer code while a prompt is open, the prompt is dismissed. This prevents a stale confirmation from applying to an unrelated or newer draft. Reset clears that language's Monaco undo stack through the external value synchronization; it is not a persistent version-history feature.

## 🟨 Output and test-results panels

Both panels are present even when no starter or examples exist, so unavailable content has an explicit explanation.

The output panel displays “Execution unavailable,” “No output yet,” and “Not measured” for runtime and memory. It contains no invented timing or output.

The test-results panel lists only public examples. Native details controls expand an input, expected output and explanation; the actual output remains “Not run.” Expected output comes from published content, not from evaluating the draft. Input and output JSON are rendered as escaped React text, so markup inside examples cannot create HTML elements.

There is no Run/Submit button, mock acceptance, hidden-case count or result persistence. Phase 8 must connect a real isolated runner and define its result contract before these panels can report execution.

## 🟩 File map

| File | Responsibility |
| --- | --- |
| `package.json`, generated `package-lock.json` | Pinned editor and DOM-test dependencies. |
| `src/components/editor/editor-state.ts` | Language labels/IDs and empty-safe draft lookup. |
| `code-editor.tsx` | Language/draft state, dynamic loading, reset orchestration, panels. |
| `monaco-surface.tsx` | Browser-only Monaco integration, worker and model lifecycle. |
| `reset-confirmation.tsx` | Inline confirmation, keyboard cancellation and initial focus. |
| `execution-panels.tsx` | Explicitly unrun output state and public-example reference. |
| `src/app/problems/[slug]/page.tsx` | Editor section; passes public starters/examples. |
| `src/components/problems/starter-code.tsx` | Read-only starter reference. |
| `tests/editor-controls.test.ts` | Draft/reset behaviors, focus and truthful/escaped panels. |
| `tests/monaco-surface.test.ts` | Controlled updates, callback forwarding and cleanup. |
| `scripts/smoke-library.mjs` | Production detail controls and hidden-data exclusion. |

All eleven authored files are included below. The generated npm lockfile remains its complete canonical repository file; do not rebuild it from snippets. Historical guides preserve their own phase source.

## 🟩 Automated verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:smoke
```

GitHub CI also supplies a dedicated PostgreSQL 17 test database and runs schema validation, migration deployment, seed validation, 17 integration tests, final seeding and `node scripts/smoke-library.mjs`. Follow the Phase 6 guide for local disposable-database setup and ordering; do not point integration tests at valuable data.

The six new completion tests cover:
- Confirmation, safe initial focus, cancellation and Escape.
- Resetting only the selected language, status feedback and focus return.
- Deliberately empty drafts.
- Dismissing stale prompts after language/draft changes.
- Separating expected from actual output and escaping example content.
- Honest states when both starters and examples are missing.

These extend the first half's eight editor component tests. Tests use happy-dom with mocked Monaco, so they verify application state and integration lifecycle rather than real browser rendering or worker startup.

The coding environment disconnected during completion work. Final completion changes were recovered into GitHub from the verified first-half source and checked in CI. Do not claim a successful local completion test/build run. Completion commit `428ed45b7f821279b89369ba594d824864ea4ce9` passed [CI run 35008677517](https://github.com/zihadpcode/AlgoSprint/actions/runs/35008677517): all 69 unit/component/migration tests, 17 PostgreSQL integration tests, schema/seed validation, lint, types, build and both HTTP smoke scripts. PR #8 records the closing documentation checks and merge state.

## 🟨 Browser checklist still required

1. Load each seeded detail page. Verify Monaco initializes with its starter, syntax colors appear, the worker loads from the app's origin, and the console has no worker/chunk errors.
2. Type, paste, select, undo and redo. Ordinary typing should not recreate the editor or reset its undo history.
3. Use development content with two supplied languages. Edit both, switch back and forth, and verify independent drafts, including an empty draft.
4. Try reset when code is unchanged, then after editing. Verify confirmation leaves code untouched, cancellation/Escape keep it, and confirm resets only that language. Verify the status message and keyboard focus.
5. Open reset, change language or edit again, and verify the old prompt disappears. Save a private note/progress flag and check an unrelated rerender preserves the draft.
6. Inspect Output and Test results. Expand examples and confirm expected values are labeled separately from actual output; nothing is marked passed or accepted. No timings should be fabricated.
7. Refresh or change problem pages and verify drafts reset as the page warning explains.
8. Test Tab entry/exit, screen-reader labels and status announcements, 375px width, 200% zoom and a failed Monaco chunk. Copyable fallback code should be available on a caught initialization/render failure.
9. Check worker-only failures separately; emitted files and mocked DOM tests are not proof of live execution or all network-error behavior.

Real Supabase email/session/private-UI checks remain pending from Phase 3 and require configured development accounts.

## 🟥 Common mistakes

- Resetting every language would discard unrelated work. Update only the active draft key.
- A confirmation opened for old code must not survive a language switch or newer edit.
- Repeatedly setting Monaco's value during typing disrupts undo and selection.
- Leaving models/listeners mounted leaks state and resources.
- Showing an expected output as actual output misrepresents execution. Keep the labels and Not run state explicit.
- Public examples and hidden evaluation cases are different records with different access requirements.
- Never execute arbitrary user code on the application server.

## 🟪 Next phase and pause

Phase 7 is the editor workspace. Pause after its verified publication. Before Phase 8 implementation, explain and compare a limited mock runner, Judge0 and an isolated Docker service, then choose a safe MVP approach. Only then add real visible-test runs, hidden-test submission evaluation, saved results and output/timing data. No Phase 8 work is included here.

## 🟩 Complete authored source files


### package.json

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
    for (const section of ["Problem statement", "Examples", "Constraints", "Layered hints", "Reveal guided solutions", "Starter code", "Related problems", "Sign in to write notes", "Editor language", "Code execution is not available yet", "Reset to starter", "Test results", "No output yet", "Actual output: Not run", "Not measured"]) assert.ok(body.includes(section), `${slug}: ${section}`);
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
import { CodeEditor } from "@/components/editor/code-editor";
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
        <Card id="editor"><CardTitle>Code editor</CardTitle><CodeEditor key={problem.slug} starters={problem.starterCode} examples={problem.examples} /></Card>
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

### src/components/editor/code-editor.tsx

```tsx
"use client";

import dynamic from "next/dynamic";
import { Component, useId, useRef, useState, type ReactNode } from "react";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExecutionPanels, type EditorExample } from "./execution-panels";
import { ResetConfirmation } from "./reset-confirmation";
import { CodeBlock } from "@/components/problems/code-block";
import { draftFor, editorLanguages, type EditorDrafts, type EditorStarter } from "./editor-state";

const MonacoSurface = dynamic(() => import("./monaco-surface"), {
  ssr: false,
  loading: () => <p role="status" className="grid h-[420px] place-items-center rounded-xl border border-line text-sm text-muted">Loading code editor…</p>,
});

export function CodeEditor({ starters, examples = [] }: { starters: EditorStarter[]; examples?: EditorExample[] }) {
  const [selected, setSelected] = useState(starters[0]?.language);
  const [drafts, setDrafts] = useState<EditorDrafts>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState("");
  const languageSelect = useRef<HTMLSelectElement>(null);
  const id = useId();
  const starter = starters.find((entry) => entry.language === selected);
  if (!starter) return <div className="mt-4 space-y-5"><p className="text-sm text-muted">No starter code is available for this problem yet.</p><ExecutionPanels examples={examples} /></div>;
  const language = editorLanguages[starter.language];
  const value = draftFor(starter, drafts);
  return <div className="mt-4 space-y-4">
    <label htmlFor={id} className="block text-sm font-semibold">Editor language</label>
    <Select ref={languageSelect} id={id} value={starter.language} onChange={(event) => {
      const next = starters.find((entry) => entry.language === event.target.value);
      if (next) { setSelected(next.language); setConfirmReset(false); setNotice(""); }
    }}>
      {starters.map((entry) => <option key={entry.language} value={entry.language}>{editorLanguages[entry.language].label}</option>)}
    </Select>
    <Button variant="secondary" disabled={value === starter.code || confirmReset} onClick={() => setConfirmReset(true)}>Reset to starter</Button>
    {confirmReset && <ResetConfirmation language={language.label} onCancel={() => {
      setConfirmReset(false);
      // The reset trigger is disabled while the prompt is open; return to the selector.
      languageSelect.current?.focus();
    }} onConfirm={() => {
      setDrafts((previous) => ({ ...previous, [starter.language]: starter.code }));
      setConfirmReset(false);
      setNotice(language.label + " code reset to starter.");
      languageSelect.current?.focus();
    }} />}
    <p role="status" aria-atomic="true" className="text-sm text-accent">{notice}</p>
    <p className="text-xs leading-6 text-muted">Entry point: <code>{starter.entryPoint}</code>. Drafts stay only on this open page; refreshing or leaving discards them. Code execution is not available yet.</p>
    <EditorBoundary fallback={<div role="alert" className="space-y-4"><p className="text-sm text-warm">The editor could not load. Copy your current code below before reloading.</p><CodeBlock label="Current code" code={value} /></div>}>
      <MonacoSurface language={language.id} value={value} onChange={(code) => {
        setConfirmReset(false);
        setNotice("");
        setDrafts((previous) => previous[starter.language] === code ? previous : { ...previous, [starter.language]: code });
      }} />
    </EditorBoundary>
    <p className="text-xs leading-6 text-muted">Monaco supports keyboard navigation and screen readers. Use its command palette for accessibility options.</p>
    <ExecutionPanels examples={examples} />
  </div>;
}

class EditorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
```

### src/components/editor/editor-state.ts

```ts
export const editorLanguages = {
  JAVASCRIPT: { label: "JavaScript", id: "javascript" },
  TYPESCRIPT: { label: "TypeScript", id: "typescript" },
  PYTHON: { label: "Python", id: "python" },
  JAVA: { label: "Java", id: "java" },
  CPP: { label: "C++", id: "cpp" },
  SQL: { label: "SQL", id: "sql" },
} as const;
export type EditorLanguage = keyof typeof editorLanguages;
export type EditorStarter = { language: EditorLanguage; entryPoint: string; code: string };
export type EditorDrafts = Partial<Record<EditorLanguage, string>>;

export function draftFor(starter: EditorStarter, drafts: EditorDrafts) {
  // Empty code is a deliberate draft, not a request to reload the starter.
  return drafts[starter.language] ?? starter.code;
}
```

### src/components/editor/execution-panels.tsx

```tsx
import { CodeBlock } from "@/components/problems/code-block";

export type EditorExample = { position: number; input: unknown; output: unknown; explanation: string };

export function ExecutionPanels({ examples }: { examples: EditorExample[] }) {
  return <div className="space-y-5">
    <section aria-label="Output" className="rounded-xl border border-line bg-canvas p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Output</h3>
        <span className="text-xs font-semibold text-warm">Execution unavailable</span>
      </div>
      <p className="mt-4 text-sm leading-7 text-muted">No output yet. Code execution is not available yet.</p>
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-xs text-muted">
        <div><dt>Runtime</dt><dd className="mt-1">Not measured</dd></div>
        <div><dt>Memory</dt><dd className="mt-1">Not measured</dd></div>
      </dl>
    </section>
    <section aria-label="Test results" className="rounded-xl border border-line bg-canvas p-5">
      <h3 className="font-semibold">Test results</h3>
      <p className="mt-3 text-sm leading-7 text-muted">Not run. These are public examples and their expected outputs, not execution results.</p>
      {examples.length ? <ol className="mt-4 space-y-3">
        {examples.map((example, index) => <li key={example.position}>
          <details className="rounded-xl border border-line bg-surface p-4">
            <summary className="cursor-pointer text-sm font-semibold text-accent">Example {index + 1} · Not run</summary>
            <div className="mt-4 space-y-4">
              <CodeBlock label={"Test example " + (index + 1) + " input"} code={JSON.stringify(example.input, null, 2) ?? "null"} />
              <CodeBlock label={"Test example " + (index + 1) + " expected output"} code={JSON.stringify(example.output, null, 2) ?? "null"} />
              <p className="text-sm text-muted">Actual output: Not run</p>
              <p className="text-sm leading-7 text-muted">{example.explanation}</p>
            </div>
          </details>
        </li>)}
      </ol> : <p className="mt-4 text-sm text-muted">No public examples are available for this problem.</p>}
    </section>
  </div>;
}
```

### src/components/editor/monaco-surface.tsx

```tsx
"use client";

import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor/editor";
import "monaco-editor/features/register.all";
import "monaco-editor/languages/definitions/javascript/register";
import "monaco-editor/languages/definitions/typescript/register";
import "monaco-editor/languages/definitions/python/register";
import "monaco-editor/languages/definitions/java/register";
import "monaco-editor/languages/definitions/cpp/register";
import "monaco-editor/languages/definitions/sql/register";

// Bundled same-origin worker; no CDN loader and no code-execution service.
self.MonacoEnvironment = {
  getWorker() {
    return new Worker(new URL("monaco-editor/editor/editor.worker.js", import.meta.url), { type: "module" });
  },
};

export default function MonacoSurface({ language, value, onChange }: {
  language: string; value: string; onChange: (value: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const callback = useRef(onChange);
  const syncing = useRef(false);
  useEffect(() => { callback.current = onChange; }, [onChange]);
  useEffect(() => {
    if (!container.current) return;
    const model = monaco.editor.createModel("", language);
    let instance: monaco.editor.IStandaloneCodeEditor;
    try { instance = monaco.editor.create(container.current, {
      model, theme: "vs-dark", automaticLayout: true, tabFocusMode: true,
      ariaLabel: `${language} code editor`, accessibilitySupport: "auto",
      minimap: { enabled: false }, fontSize: 14, lineHeight: 24, tabSize: 2,
      scrollBeyondLastLine: false, wordWrap: "on", padding: { top: 16, bottom: 16 },
      fixedOverflowWidgets: true,
    }); } catch (error) { model.dispose(); throw error; }
    editor.current = instance;
    const subscription = instance.onDidChangeModelContent(() => {
      if (!syncing.current) callback.current(instance.getValue());
    });
    return () => {
      subscription.dispose();
      instance.dispose();
      model.dispose();
      editor.current = null;
    };
  }, [language]);
  useEffect(() => {
    const instance = editor.current;
    if (instance && instance.getValue() !== value) {
      syncing.current = true;
      try { instance.setValue(value); } finally { syncing.current = false; }
    }
  }, [value, language]);
  return <div ref={container} className="h-[420px] min-w-0 overflow-hidden rounded-xl border border-line" />;
}
```

### src/components/editor/reset-confirmation.tsx

```tsx
"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export function ResetConfirmation({ language, onCancel, onConfirm }: {
  language: string; onCancel: () => void; onConfirm: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancel.current?.focus(); }, []);
  return <div role="group" aria-label="Confirm code reset" className="space-y-3 rounded-xl border border-warm/60 bg-warm/5 p-4"
    onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onCancel(); } }}>
    <p className="text-sm leading-7">Replace your {language} draft with its starter code? Other language drafts stay unchanged.</p>
    <div className="flex flex-wrap gap-3">
      <Button ref={cancel} variant="secondary" onClick={onCancel}>Keep my code</Button>
      <Button onClick={onConfirm}>Replace with starter</Button>
    </div>
  </div>;
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
    <p className="text-xs leading-6 text-muted">Entry point: <code>{entry.entryPoint}</code>. Use the code editor on this page to work on your solution. This starter reference stays unchanged.</p>
  </div>;
}
```

### tests/editor-controls.test.ts

```ts
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const control = vi.hoisted(() => ({ fail: false }));
vi.mock("next/dynamic", () => ({ default: () => function FakeSurface({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  if (control.fail) throw new Error("Simulated chunk failure");
  return createElement("textarea", { "aria-label": "Mock editor", value, onChange: (event: { target: { value: string } }) => onChange(event.target.value) });
} }));
import { CodeEditor } from "@/components/editor/code-editor";
import { ExecutionPanels } from "@/components/editor/execution-panels";
import { draftFor, editorLanguages, type EditorStarter } from "@/components/editor/editor-state";

const starters: EditorStarter[] = [
  { language: "JAVASCRIPT", entryPoint: "solve", code: "function solve() {}" },
  { language: "PYTHON", entryPoint: "solve", code: "def solve():\n    pass" },
];
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  control.fail = false;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });
async function render(key = "relay-window", entries = starters) {
  await act(() => root.render(createElement(CodeEditor, { key, starters: entries })));
}
async function choose(language: string) {
  await act(() => { const select = host.querySelector("select")!; select.value = language; select.dispatchEvent(new Event("change", { bubbles: true })); });
}
async function type(code: string) {
  await act(() => {
    const field = host.querySelector("textarea")!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, code);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("loads the supplied starter and exposes only languages supplied by that problem", async () => {
  await render();
  expect(host.querySelector("textarea")?.value).toBe(starters[0].code);
  expect([...host.querySelectorAll("option")].map((option) => option.textContent)).toEqual(["JavaScript", "Python"]);
  expect(host.textContent).toContain("Code execution is not available yet");
  expect(Object.keys(editorLanguages)).toHaveLength(6);
});
it("keeps independent drafts, including intentionally empty code, when switching languages", async () => {
  await render(); await type("my JavaScript draft"); await choose("PYTHON");
  expect(host.querySelector("textarea")?.value).toBe(starters[1].code);
  await type(""); await choose("JAVASCRIPT");
  expect(host.querySelector("textarea")?.value).toBe("my JavaScript draft");
  await choose("PYTHON"); expect(host.querySelector("textarea")?.value).toBe("");
  expect(draftFor(starters[1], { PYTHON: "" })).toBe("");
});
it("preserves drafts during a same-problem rerender and resets on a different problem key", async () => {
  await render(); await type("draft survives refresh of personal controls"); await render();
  expect(host.querySelector("textarea")?.value).toBe("draft survives refresh of personal controls");
  await render("another-problem"); expect(host.querySelector("textarea")?.value).toBe(starters[0].code);
});
it("shows an honest empty state when there is no starter", async () => {
  await render("no-starter", []);
  expect(host.textContent).toContain("No starter code is available");
  expect(host.querySelector("select")).toBeNull();
});
it("keeps the current draft copyable when the editor fails", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  await render(); await type("recover this draft"); control.fail = true; await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("editor could not load");
  expect(host.querySelector("code")?.textContent).toBe("solve");
  expect(host.querySelector("pre code")?.textContent).toBe("recover this draft");
});

function button(label: string) { return [...host.querySelectorAll("button")].find((entry) => entry.textContent === label)!; }
async function click(label: string) { await act(() => button(label).click()); }

it("requires confirmation, focuses keeping code, and supports Escape", async () => {
  await render(); expect(button("Reset to starter").disabled).toBe(true);
  await type("keep this draft"); await click("Reset to starter");
  expect(host.querySelector("textarea")?.value).toBe("keep this draft");
  expect(document.activeElement).toBe(button("Keep my code"));
  await act(() => button("Keep my code").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(host.querySelector('[aria-label="Confirm code reset"]')).toBeNull();
  expect(host.querySelector("textarea")?.value).toBe("keep this draft");
  expect(document.activeElement).toBe(host.querySelector("select"));
  await click("Reset to starter"); await click("Keep my code");
  expect(host.querySelector("textarea")?.value).toBe("keep this draft");
});

it("resets only the selected language and announces success", async () => {
  await render(); await type("JavaScript draft"); await choose("PYTHON"); await type("Python draft");
  await click("Reset to starter"); await click("Replace with starter");
  expect(host.querySelector("textarea")?.value).toBe(starters[1].code);
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Python code reset to starter.");
  expect(document.activeElement).toBe(host.querySelector("select"));
  expect(button("Reset to starter").disabled).toBe(true);
  await choose("JAVASCRIPT"); expect(host.querySelector("textarea")?.value).toBe("JavaScript draft");
  expect(host.querySelector('[role="status"]')?.textContent).toBe("");
});

it("restores an intentionally empty draft only after confirmation", async () => {
  await render(); await type(""); expect(host.querySelector("textarea")?.value).toBe("");
  expect(button("Reset to starter").disabled).toBe(false);
  await click("Reset to starter"); await click("Replace with starter");
  expect(host.querySelector("textarea")?.value).toBe(starters[0].code);
});

it("cancels stale reset prompts when the language or draft changes", async () => {
  await render(); await type("js draft"); await click("Reset to starter"); await choose("PYTHON");
  expect(host.querySelector('[aria-label="Confirm code reset"]')).toBeNull();
  await choose("JAVASCRIPT"); await click("Reset to starter"); await type("newer draft");
  expect(host.querySelector('[aria-label="Confirm code reset"]')).toBeNull();
  expect(host.querySelector("textarea")?.value).toBe("newer draft");
});

it("separates public expectations from unrun output and escapes example content", async () => {
  const payload = '<img src=x onerror="alert(1)">';
  await act(() => root.render(createElement(ExecutionPanels, { examples: [{ position: 1, input: { text: payload }, output: 7, explanation: "Public explanation" }] })));
  expect(host.querySelector('[aria-label="Output"]')?.textContent).toContain("No output yet");
  expect(host.querySelector('[aria-label="Output"]')?.textContent).toContain("Not measured");
  expect(host.querySelector("summary")?.textContent).toBe("Example 1 · Not run");
  expect(host.querySelector("details")?.open).toBe(false);
  expect(host.textContent).toContain("Actual output: Not run");
  expect(host.querySelectorAll("pre code")[1].textContent).toBe("7");
  expect(host.querySelector("img")).toBeNull();
  expect(host.querySelector("pre code")?.textContent).toContain("<img");
  expect(host.textContent).not.toMatch(/Accepted|Passed|0 ms/);
});

it("keeps both panels honest when public examples and starters are missing", async () => {
  await render("empty", []);
  expect(host.querySelector('[aria-label="Output"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Test results"]')?.textContent).toContain("No public examples are available");
  expect(host.querySelector("summary")).toBeNull();
});
```

### tests/monaco-surface.test.ts

```ts
// @vitest-environment happy-dom
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), createModel: vi.fn() }));
vi.mock("monaco-editor/editor", () => ({ editor: mocks }));
vi.mock("monaco-editor/features/register.all", () => ({}));
vi.mock("monaco-editor/languages/definitions/javascript/register", () => ({}));
vi.mock("monaco-editor/languages/definitions/typescript/register", () => ({}));
vi.mock("monaco-editor/languages/definitions/python/register", () => ({}));
vi.mock("monaco-editor/languages/definitions/java/register", () => ({}));
vi.mock("monaco-editor/languages/definitions/cpp/register", () => ({}));
vi.mock("monaco-editor/languages/definitions/sql/register", () => ({}));
import MonacoSurface from "@/components/editor/monaco-surface";

function fakeEditor() {
  let value = "";
  let listener = () => {};
  return {
    getValue: () => value,
    setValue: vi.fn((next: string) => { value = next; listener(); }),
    edit(next: string) { value = next; listener(); },
    subscription: { dispose: vi.fn() }, dispose: vi.fn(),
    onDidChangeModelContent(fn: () => void) { listener = fn; return this.subscription; },
  };
}
let host: HTMLDivElement;
let root: Root;
let instances: ReturnType<typeof fakeEditor>[];
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks(); instances = [];
  mocks.createModel.mockImplementation(() => ({ dispose: vi.fn() }));
  mocks.create.mockImplementation(() => { const instance = fakeEditor(); instances.push(instance); return instance; });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
it("loads code without reporting a user edit and forwards actual edits to the current callback", async () => {
  const first = vi.fn(), latest = vi.fn();
  await act(() => root.render(createElement(MonacoSurface, { language: "javascript", value: "starter", onChange: first })));
  expect(instances[0].getValue()).toBe("starter"); expect(first).not.toHaveBeenCalled();
  expect(mocks.create.mock.calls[0][1]).toMatchObject({ tabFocusMode: true, automaticLayout: true });
  await act(() => root.render(createElement(MonacoSurface, { language: "javascript", value: "starter", onChange: latest })));
  instances[0].edit("user draft"); expect(latest).toHaveBeenCalledWith("user draft"); expect(first).not.toHaveBeenCalled();
  await act(() => root.render(createElement(MonacoSurface, { language: "javascript", value: "user draft", onChange: latest })));
  expect(instances[0].setValue).toHaveBeenCalledTimes(1); // No setValue for a typing echo: keep undo history.
  expect(instances).toHaveLength(1);
});
it("disposes the old model, editor and listener when changing language", async () => {
  await act(() => root.render(createElement(MonacoSurface, { language: "javascript", value: "js draft", onChange: vi.fn() })));
  await act(() => root.render(createElement(MonacoSurface, { language: "python", value: "python draft", onChange: vi.fn() })));
  expect(instances[0].dispose).toHaveBeenCalledTimes(1);
  expect(instances[0].subscription.dispose).toHaveBeenCalledTimes(1);
  expect(mocks.createModel.mock.results[0].value.dispose).toHaveBeenCalledTimes(1);
  expect(instances[1].getValue()).toBe("python draft");
});
it("cleans up every Strict Mode mount without leaving an extra active model", async () => {
  await act(() => root.render(createElement(StrictMode, null, createElement(MonacoSurface, { language: "javascript", value: "starter", onChange: vi.fn() }))));
  await act(() => root.render(null));
  for (const instance of instances) { expect(instance.dispose).toHaveBeenCalledTimes(1); expect(instance.subscription.dispose).toHaveBeenCalledTimes(1); }
  for (const result of mocks.createModel.mock.results) expect(result.value.dispose).toHaveBeenCalledTimes(1);
});
```
