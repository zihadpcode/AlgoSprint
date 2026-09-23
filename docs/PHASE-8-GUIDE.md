# Phase 8 — Safe code runner

## 🟦 What this phase builds

The existing Monaco workspace gains **Run visible tests** and **Submit solution**. A confirmed, signed-in user can send a JavaScript draft to a separately configured Judge0 service. The application checks the returned value against its trusted expected values, saves the attempt in PostgreSQL, and displays a verdict, output/errors for visible runs, and measured runtime/memory when the provider supplies them.

This phase supports the five original problems: Relay Window, Quiet Badge, Parcel Checkpoints, Dock Threshold, and Lantern Steps. Other editor languages remain available when their starter records exist, but execution is currently JavaScript only. There are no schema, migration, dependency, seed or production-data changes.

**Implementation is ready for configuration, not evidence of a working live provider.** Execution is disabled by default. Automated tests use an inert HTTP stub, not an actual sandbox. A maintained Judge0 service, development Supabase accounts, and the manual checks below are required to enable the live workflow. Nothing was deployed or purchased.

## 🟨 Why Judge0

| Option | Useful for | Tradeoff |
| --- | --- | --- |
| Limited frontend mock | Demonstrating the buttons and result layout with fixed fixtures | Does not prove arbitrary user code is correct; hidden tests cannot be shipped to the browser |
| Judge0 integration (selected) | Running submitted code outside the web application in a dedicated execution service | Requires provider setup, credentials, sandbox maintenance by the operator, resource limits and live verification |
| Separate Docker sandbox | Later operational control over language images, queues and isolation | A container alone is not the whole isolation design; requires hardened hosts, network restrictions, patching, quotas and operational monitoring |

We selected Judge0 because it can execute real code without placing an interpreter for user submissions in the application process. We did not deploy our own sandbox or silently use a public demo endpoint. The operator explicitly supplies the trusted provider origin, authentication mode and JavaScript language ID.

The [official Judge0 API reference](https://ce.judge0.com/) documents submissions, asynchronous tokens, Base64 transport, status codes, language IDs and execution controls. This implementation uses those documented controls: network disabled, bounded CPU/wall time/memory/processes/output, and no callbacks or additional files. These settings are requests to the configured service; provider isolation must be independently maintained and verified. Do not assume an old self-hosted installation is safe simply because it accepts API requests.

## 🟦 Request flow and trust boundaries

```mermaid
flowchart TD
  A["Editor draft"] --> B["Authenticated server action"]
  B --> C["PostgreSQL reservation and test snapshot"]
  C --> D["Separate Judge0 sandbox"]
  D --> E["Trusted comparison and saved result"]
  E --> A
```

1. `RunnerControls` captures the current code/language and disables duplicate requests. Editing is still allowed while a request is in flight. The result warns if it describes a different draft or language.
2. `executeCode` validates a strict input object. The client can choose only a problem slug, JavaScript, Run/Submit mode and up to 20,000 code characters. It cannot supply a user ID, verdict, language ID, provider URL, limits, tests or expected outputs. Supabase `getUser()` verification and the database profile supply the owner.
3. `reserveSubmission` uses a short PostgreSQL advisory transaction lock shared by all app instances. It applies quotas, verifies the problem is published and coding, reads its revision/starter/test snapshot, and saves a RUNNING record. No network call holds this transaction open.
4. `makeProgram` builds a JavaScript source **string**; the app never evaluates it. `makeStdin` maps named input fields into an explicit argument array. JSONB object key order is not used as a function signature.
5. Judge0 receives only source and one case's arguments per sandbox job. Expected outputs remain in the trusted application. A new process/job per test prevents one test's program state from directly contaminating another.
6. The adapter creates all cases with one `/submissions/batch` request and polls their private tokens together. A provider Accepted status is not sufficient: the app parses the complete stdout as JSON and compares it to the trusted expected JSON without type coercion. Object property order does not matter; array order and types do.
7. The service constructs an explicit response DTO, then saves it with an owner-checked, one-time RUNNING-to-final transition. Only after persistence succeeds does the UI say the result was saved.

Do not replace this boundary with `eval`, `new Function`, Node's `vm`, or an application-server child process that runs the submitted code. Harness source is only transported to the separate sandbox.

## 🟩 Run versus Submit

| Behavior | Run visible tests | Submit solution |
| --- | --- | --- |
| Test selection | Only VISIBLE TestCase records | Full suite, including HIDDEN TestCase records |
| Correctness | Every returned JSON value compared on the server | Same comparison on the full suite |
| Response | Counts, verdict, metrics, visible input/expected/output/errors | Counts, verdict and metrics only; empty case list |
| Saved data | Code, owner, problem revision, mode, final summary and visible details | Code, owner, problem revision, mode and final summary; no hidden case payloads/diagnostics |
| Solved progress | No automatic update in Phase 8 | No automatic update in Phase 8; richer progress belongs to Phase 9 |

Public `ProblemExample` records remain readable before execution; the runner loads actual `TestCase` records on the server. These are separate models even when their current seed values happen to match.

A hidden-test program necessarily receives that test's input inside its execution sandbox. Hidden means the browser and saved public result never receive it. Even if the program prints its input to stdout, stderr or a thrown error, Submit discards those fields entirely. It also does not expose provider tokens, raw error responses or API keys. Aggregate pass counts and timing remain intentional feedback; rate limits reduce repeated probing, but this is not a claim that an assessment oracle leaks zero information.

Source code is saved as an attempt. This does not implement an autosaved editor draft or a submission-history screen. Results remain visible on the current page; richer private history is a later dashboard task. Refreshing still discards the unsent editor draft.

## 🟦 Setup on your Mac

Use a fresh checkout of the current repository rather than the older synthetic workspaces from earlier sessions:

```bash
git clone https://github.com/zihadpcode/AlgoSprint.git
cd AlgoSprint
npm ci
```

Use Node.js 24. The repository is private, so GitHub may ask you to authenticate. If PR #9 is still open, check out its branch with `git switch --track origin/algosprint/phase-8-runner`; after merge, use `main`.

Create `.env.local` from `.env.example` only if you do not already have one. Keep existing credentials and do not paste private values into chat or commit them.

```bash
cp .env.example .env.local
```

Follow Phase 3 for a development PostgreSQL/Supabase project, email confirmation and redirect configuration. Apply the existing migrations and seed the existing five problems:

```bash
npm run db:deploy
npm run db:seed
```

Obtain a maintained Judge0 service account or an independently operated, patched deployment. Use its documentation to find the HTTPS API origin and authentication method. Query its `/languages` endpoint through a trusted admin tool to select the **JavaScript (Node.js)** runtime ID; IDs vary by deployment, so the application does not guess one.

Edit `.env.local` with the actual values:

```dotenv
CODE_RUNNER_ENABLED=true
JUDGE0_API_URL=https://your-runner-origin.example/
JUDGE0_API_KEY=your-server-only-key
JUDGE0_AUTH_MODE=token
JUDGE0_JAVASCRIPT_LANGUAGE_ID=your-provider-numeric-id
```

The strings above are placeholders, not a live service or valid language ID. `token` sends the key in `X-Auth-Token`. For a RapidAPI provider use `JUDGE0_AUTH_MODE=rapidapi`; this sends `X-RapidAPI-Key` and the configured origin's host in `X-RapidAPI-Host`. No browser values can override either header or URL. An origin must use HTTPS, have no path/query/fragment/embedded credentials, and end at the root. Redirects are rejected so credentials cannot be forwarded to a redirected host.

Missing/malformed values or anything other than `CODE_RUNNER_ENABLED=true` leave the feature disabled. The public page receives only a boolean availability flag, never these values. Restart your development server after changing environment variables:

```bash
npm run dev
```

Open `http://localhost:3000/problems/relay-window`, sign into a confirmed development account and follow the manual checklist below. Provider outage or bad credentials must produce a failure, not an invented successful result. Turning the flag off rejects new executions; it does not cancel already accepted sandbox jobs.

## 🟨 Limits and lifecycle

| Limit | Current value |
| --- | --- |
| Code size | 1–20,000 characters; no null characters |
| Test count | 1–10 per request; Submit requires a hidden case |
| Test stdin | At most 64,000 UTF-8 bytes |
| Account concurrency | One RUNNING/QUEUED attempt per user |
| Account request quota | Five per minute; thirty per hour |
| App-wide request quota | Sixty per minute; at most twenty active attempts |
| CPU / wall time | Up to two CPU seconds and five wall seconds per test |
| Memory | Up to 262,144 KB per test, further constrained by the problem |
| Processes / output file size | At most 32 processes/threads and 64 KB files |
| Provider network | Disabled on every submitted job |
| Polling | One batch creation request for all cases, then one batch poll every second (at most 20); 20-second overall deadline. Batch endpoints keep request-metered providers such as RapidAPI affordable. |
| HTTP calls | Five-second timeout per call, no redirects or cache |
| HTTP response size | At most 128,000 bytes before JSON parsing |
| Visible output/diagnostics | Compare complete bounded output; display/store at most 4,000 characters per field |
| Abandoned request recovery | Mark unfinished records older than two minutes as INTERNAL_ERROR on the next reservation |

All attempts that obtained a reservation count toward the quota, including wrong answers, provider failures and interrupted requests. The global lock makes check-and-reserve atomic across instances. A quota denial creates no attempt and sends no provider job. Cleanup of abandoned records happens opportunistically, not on a background timer.

The server action is awaited rather than spawning a background promise. A process interruption may leave a RUNNING record until recovery. A browser connection failure may happen after a result was saved; the UI explicitly says a retry creates a new attempt. There is no exactly-once network retry/idempotency guarantee or durable job queue in this MVP. Hosts should allow the configured 60-second page/action maximum; the adapter's budget is shorter. Judge0 jobs already accepted may finish even if the app stops polling, but their CPU/wall limits remain set.

Runtime is the slowest reported test; memory is the largest reported per-test value. They include harness/runtime overhead and are not total request latency or cross-language benchmark scores. Missing metrics remain Not measured. Judge0 reports some memory failures as runtime signals rather than a distinct memory status; do not infer a precise out-of-memory diagnosis from every runtime error.

The harness expects a function with the supplied entry point and a JSON-serializable return value. `console.log` is redirected to stderr for visible debugging; the function's return value goes to stdout. Extra stdout makes the result invalid JSON. Compile/runtime errors, time limits, malformed output, wrong answers and infrastructure failures do not become accepted submissions.

## 🟩 File responsibilities

| File/group | Responsibility |
| --- | --- |
| `contracts.ts` | Strict input and browser-safe result types/labels |
| `config.ts` | Server-only, explicit provider opt-in and credential validation |
| `harness.ts` | Five reviewed signatures and remote source/stdin generation |
| `judge0.ts` | Bounded transport, polling, decoding and independent output comparison |
| `store.ts` | Shared quotas, snapshot reservation, owned final persistence |
| `service.ts` | Orchestration, infrastructure fallback and hidden-data redaction |
| `actions.ts` | Authenticated/validated server entry point |
| `runner-controls.tsx` | Captured draft, pending state, retry feedback and controls |
| `code-editor.tsx` | Connects current draft/language to the runner controls |
| `execution-panels.tsx` | Honest unrun, visible-results and hidden-summary displays |
| Problem page | Passes public content, slug and availability/auth booleans |
| `.env.example` | Safe configuration names and explanations |
| Tests / HTTP smoke | Request, provider, UI, privacy, persistence and concurrency verification |

The following section contains **every complete authored implementation/config/test file** changed for this phase. README and handoff are status documents, separately available in the repository. No lockfile or generated Prisma client changed; generated files remain generated.

## 🟩 Complete source files

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
```

### `scripts/smoke-library.mjs`

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
    for (const section of ["Problem statement", "Examples", "Constraints", "Layered hints", "Reveal guided solutions", "Starter code", "Related problems", "Sign in to write notes", "Editor language", "Code execution is not available yet", "Reset to starter", "Test results", "No output yet", "Actual output: Not run", "Not measured", "Run visible tests", "Submit solution", "Sign in to run code"]) assert.ok(body.includes(section), `${slug}: ${section}`);
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

### `src/components/editor/code-editor.tsx`

```tsx
"use client";

import dynamic from "next/dynamic";
import { Component, useId, useRef, useState, type ReactNode } from "react";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExecutionPanels, type EditorExample } from "./execution-panels";
import { RunnerControls } from "./runner-controls";
import { ResetConfirmation } from "./reset-confirmation";
import { CodeBlock } from "@/components/problems/code-block";
import { draftFor, editorLanguages, type EditorDrafts, type EditorStarter } from "./editor-state";

const MonacoSurface = dynamic(() => import("./monaco-surface"), {
  ssr: false,
  loading: () => <p role="status" className="grid h-[420px] place-items-center rounded-xl border border-line text-sm text-muted">Loading code editor…</p>,
});

export function CodeEditor({ starters, examples = [], slug = "", runnerEnabled = false, signedIn = false }: { starters: EditorStarter[]; examples?: EditorExample[]; slug?: string; runnerEnabled?: boolean; signedIn?: boolean }) {
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
    <p className="text-xs leading-6 text-muted">Entry point: <code>{starter.entryPoint}</code>. Drafts stay only on this open page; refreshing or leaving discards them.</p>
    <EditorBoundary fallback={<div role="alert" className="space-y-4"><p className="text-sm text-warm">The editor could not load. Copy your current code below before reloading.</p><CodeBlock label="Current code" code={value} /></div>}>
      <MonacoSurface language={language.id} value={value} onChange={(code) => {
        setConfirmReset(false);
        setNotice("");
        setDrafts((previous) => previous[starter.language] === code ? previous : { ...previous, [starter.language]: code });
      }} />
    </EditorBoundary>
    <p className="text-xs leading-6 text-muted">Monaco supports keyboard navigation and screen readers. Use its command palette for accessibility options.</p>
    <RunnerControls slug={slug} code={value} language={starter.language} enabled={runnerEnabled} signedIn={signedIn} examples={examples} />
  </div>;
}

class EditorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
```

### `src/components/editor/execution-panels.tsx`

```tsx
import { CodeBlock } from "@/components/problems/code-block";
import { verdictLabels, type ExecutionResult } from "@/features/submissions/contracts";

export type EditorExample = { position: number; input: unknown; output: unknown; explanation: string };

export function ExecutionPanels({ examples, available = false, result }: { examples: EditorExample[]; available?: boolean; result?: ExecutionResult }) {
  return <div className="space-y-5">
    <section aria-label="Output" className="rounded-xl border border-line bg-canvas p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Output</h3>
        <span className="text-xs font-semibold text-warm">{result ? verdictLabels[result.status] : available ? "Ready to run" : "Execution unavailable"}</span>
      </div>
      <p className="mt-4 text-sm leading-7 text-muted">{result ? `${result.passedCount} of ${result.totalCount} tests passed. ${result.mode === "RUN" ? "Visible tests only; this is not a full submission verdict." : "Full suite submission; hidden details are withheld."}` : "No output yet."}</p>
      {result?.status === "INTERNAL_ERROR" && <p className="mt-3 text-sm text-warm">The service could not complete evaluation. This does not establish whether your solution is correct.</p>}
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-xs text-muted">
        <div><dt>Runtime</dt><dd className="mt-1">{result?.runtimeMs == null ? "Not measured" : `${result.runtimeMs} ms (slowest test)`}</dd></div>
        <div><dt>Memory</dt><dd className="mt-1">{result?.memoryKb == null ? "Not measured" : `${result.memoryKb} KB (peak test)`}</dd></div>
      </dl>
      {result && <p className="mt-3 break-all text-xs text-muted">Saved attempt: {result.id}</p>}
    </section>
    <section aria-label="Test results" className="rounded-xl border border-line bg-canvas p-5">
      <h3 className="font-semibold">Test results</h3>
      {result ? result.mode === "SUBMIT" ? <p className="mt-3 text-sm leading-7 text-muted">Only the summary is shown for submissions. Use Run visible tests to inspect output and errors without revealing hidden inputs.</p> :
        <ol className="mt-4 space-y-3">{result.cases.map((test, index) => <li key={test.position}>
          <details className="rounded-xl border border-line bg-surface p-4">
            <summary className="cursor-pointer text-sm font-semibold text-accent">Visible test {index + 1} · {verdictLabels[test.status]}</summary>
            <div className="mt-4 space-y-4">
              <CodeBlock label="Input" code={JSON.stringify(test.input, null, 2)} />
              <CodeBlock label="Expected output" code={JSON.stringify(test.expected, null, 2)} />
              <CodeBlock label="Actual output (up to 4,000 characters)" code={test.stdout || "(no output)"} />
              {test.diagnostic && <CodeBlock label="Errors / console logs (up to 4,000 characters)" code={test.diagnostic} />}
              {test.status === "WRONG_ANSWER" && <p className="text-sm text-muted">The returned JSON did not match the expected value. Check types and array order; return the result from the named function.</p>}
            </div>
          </details>
        </li>)}</ol> : <>
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
      </>}
    </section>
  </div>;
}
```

### `src/components/editor/runner-controls.tsx`

```tsx
"use client";

import { useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { executeCode } from "@/features/submissions/actions";
import type { ExecutionState } from "@/features/submissions/contracts";
import { ExecutionPanels, type EditorExample } from "./execution-panels";

export function RunnerControls({ slug, code, language, enabled, signedIn, examples }: {
  slug: string; code: string; language: string; enabled: boolean; signedIn: boolean; examples: EditorExample[];
}) {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [last, setLast] = useState<{ code: string; language: string; response: ExecutionState } | null>(null);
  const available = enabled && language === "JAVASCRIPT";
  async function execute(mode: "RUN" | "SUBMIT") {
    if (busy.current) return;
    busy.current = true; setPending(true); setLast(null);
    let response: ExecutionState;
    try { response = await executeCode({ slug, code, language, mode }); }
    catch { response = { success: false, message: "The connection was interrupted. The result may have been saved. Retrying creates a new attempt." }; }
    setLast({ code, language, response }); setPending(false); busy.current = false;
  }
  const stale = last && (last.code !== code || last.language !== language);
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-3">
      <Button disabled={!available || !signedIn || pending || !code.trim() || code.length > 20_000} onClick={() => void execute("RUN")}>Run visible tests</Button>
      <Button variant="secondary" disabled={!available || !signedIn || pending || !code.trim() || code.length > 20_000} onClick={() => void execute("SUBMIT")}>Submit solution</Button>
    </div>
    {!signedIn && <ButtonLink href={`/login?next=${encodeURIComponent(`/problems/${slug}`)}`} variant="secondary">Sign in to run code</ButtonLink>}
    <p className="text-xs leading-6 text-muted">{available ? "Run checks visible tests. Submit checks the full suite, including hidden tests. Both save an attempt. Limit: 5 per minute and 30 per hour." : "Code execution is not available yet for this workspace. You can continue editing."}</p>
    {code.length > 20_000 && <p className="text-sm text-warm">Code must be at most 20,000 characters.</p>}
    <p role="status" aria-live="polite" className="text-sm text-accent">{pending ? "Executing the captured draft… You can keep editing." : last?.response.success ? "Execution result saved." : ""}</p>
    {last && !last.response.success && <p role="alert" className="text-sm text-warm">{last.response.message}</p>}
    {stale && <p className="text-sm text-warm">This result belongs to an earlier draft or language. Run again to check your current code.</p>}
    <ExecutionPanels examples={examples} available={available} result={last?.response.success ? last.response.result : undefined} />
  </div>;
}
```

### `src/features/submissions/actions.ts`

```typescript
"use server";

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
    return await runSubmission(getDatabase(), viewer.id, parsed.data, config);
  } catch {
    return { success: false, message: "Could not finish saving the execution result. Your draft is unchanged. A retry creates a new attempt." };
  }
}
```

### `src/features/submissions/config.ts`

```typescript
import "server-only";
import { z } from "zod";

const schema = z.object({
  url: z.url().refine((value) => {
    try { const u = new URL(value); return u.protocol === "https:" && u.pathname === "/" && !u.username && !u.password && !u.search && !u.hash; }
    catch { return false; }
  }),
  key: z.string().min(1).max(512).regex(/^[\x21-\x7e]+$/),
  auth: z.enum(["token", "rapidapi"]),
  languageId: z.coerce.number().int().positive().max(10000),
});
export type RunnerConfig = z.infer<typeof schema>;
export function getRunnerConfig(): RunnerConfig | null {
  if (process.env.CODE_RUNNER_ENABLED !== "true") return null;
  const parsed = schema.safeParse({ url: process.env.JUDGE0_API_URL, key: process.env.JUDGE0_API_KEY,
    auth: process.env.JUDGE0_AUTH_MODE ?? "token", languageId: process.env.JUDGE0_JAVASCRIPT_LANGUAGE_ID });
  return parsed.success ? parsed.data : null;
}
```

### `src/features/submissions/contracts.ts`

```typescript
import { z } from "zod";
import { problemSlug } from "@/features/problems/detail-validation";

export const executionInput = z.object({
  slug: problemSlug,
  language: z.literal("JAVASCRIPT"),
  mode: z.enum(["RUN", "SUBMIT"]),
  code: z.string().min(1).max(20_000).refine((s) => s.trim().length > 0 && !s.includes("\0")),
}).strict();
export type ExecutionInput = z.infer<typeof executionInput>;
export type Verdict = "ACCEPTED" | "WRONG_ANSWER" | "COMPILE_ERROR" | "RUNTIME_ERROR" | "TIME_LIMIT" | "MEMORY_LIMIT" | "INTERNAL_ERROR";
export type CaseResult = {
  position: number; status: Verdict; input: unknown; expected: unknown;
  stdout: string; diagnostic: string; runtimeMs: number | null; memoryKb: number | null;
};
export type ExecutionResult = {
  id: string; mode: "RUN" | "SUBMIT"; status: Verdict; passedCount: number; totalCount: number;
  runtimeMs: number | null; memoryKb: number | null; cases: CaseResult[];
};
export type ExecutionState = { success: false; message: string } | { success: true; result: ExecutionResult };
export const verdictLabels: Record<Verdict, string> = {
  ACCEPTED: "Passed", WRONG_ANSWER: "Wrong answer", COMPILE_ERROR: "Compilation error",
  RUNTIME_ERROR: "Runtime error", TIME_LIMIT: "Time limit exceeded", MEMORY_LIMIT: "Memory limit exceeded",
  INTERNAL_ERROR: "Execution service unavailable",
};
```

### `src/features/submissions/harness.ts`

```typescript
import "server-only";

// Explicit argument order: PostgreSQL JSONB object key order is not a function signature.
const signatures: Record<string, { entryPoint: string; keys: string[] }> = {
  "relay-window": { entryPoint: "relayWindow", keys: ["loads", "width"] },
  "quiet-badge": { entryPoint: "quietBadge", keys: ["badges"] },
  "parcel-checkpoints": { entryPoint: "parcelCheckpoints", keys: ["parcels", "ranges"] },
  "dock-threshold": { entryPoint: "dockThreshold", keys: ["capacities", "load"] },
  "lantern-steps": { entryPoint: "lanternSteps", keys: ["costs"] },
};
export function runnerSupports(slug: string) { return Object.hasOwn(signatures, slug); }
export function makeProgram(slug: string, entryPoint: string, code: string) {
  const signature = Object.hasOwn(signatures, slug) ? signatures[slug] : undefined;
  if (!signature || signature.entryPoint !== entryPoint) throw new Error("Unsupported runner signature");
  // This is text sent to Judge0. Never evaluate it inside Next.js, Node vm, or a local child process.
  return `const __asArgs = JSON.parse(require("fs").readFileSync(0, "utf8"));
const __asWrite = process.stdout.write.bind(process.stdout);
const __asJSON = JSON.stringify.bind(JSON);
console.log = (...args) => process.stderr.write(args.map(String).join(" ") + "\\n");
const __asSolve = (() => {
${code}
;return ${signature.entryPoint};
})();
Promise.resolve(__asSolve(...__asArgs)).then(value => {
  const json = __asJSON(value);
  if (json === undefined) throw new Error("Return a JSON value from your function.");
  __asWrite(json);
}).catch(error => { console.error(error); process.exitCode = 1; });
`;
}
export function makeStdin(slug: string, input: unknown) {
  const signature = Object.hasOwn(signatures, slug) ? signatures[slug] : undefined;
  if (!signature || !input || typeof input !== "object" || Array.isArray(input)) throw new Error("Unsupported test input");
  const record = input as Record<string, unknown>;
  if (signature.keys.some((key) => !Object.hasOwn(record, key))) throw new Error("Missing test argument");
  const result = JSON.stringify(signature.keys.map((key) => record[key]));
  if (Buffer.byteLength(result) > 64_000) throw new Error("Test input exceeds MVP limit");
  return result;
}
```

### `src/features/submissions/judge0.ts`

```typescript
import "server-only";
import { isDeepStrictEqual } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import type { RunnerConfig } from "./config";
import type { Verdict } from "./contracts";

export type RunnerCase = { stdin: string; expected: unknown };
export type RunnerOutcome = { status: Verdict; stdout: string; diagnostic: string; runtimeMs: number | null; memoryKb: number | null };
const responseSchema = z.object({
  status: z.object({ id: z.number().int().min(1).max(14) }),
  stdout: z.string().max(90000).nullable().optional(), stderr: z.string().max(90000).nullable().optional(),
  compile_output: z.string().max(90000).nullable().optional(),
  time: z.string().regex(/^\d+(\.\d+)?$/).nullable().optional(),
  memory: z.number().int().nonnegative().max(2147483647).nullable().optional(),
});

async function request(config: RunnerConfig, path: string, signal: AbortSignal, body?: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.auth === "rapidapi") {
    headers["X-RapidAPI-Key"] = config.key; headers["X-RapidAPI-Host"] = new URL(config.url).host;
  } else headers["X-Auth-Token"] = config.key;
  const response = await fetch(new URL(path, config.url), {
    method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]), cache: "no-store", redirect: "error",
  });
  if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error("Runner request failed"); }
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 128_000) throw new Error("Runner response exceeds limit");
      chunks.push(value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
function decode(value: string | null | undefined) {
  if (!value) return "";
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error("Invalid runner encoding");
  return Buffer.from(value, "base64").toString("utf8");
}
export function judgeOutcome(raw: unknown, expected: unknown): RunnerOutcome | null {
  const result = responseSchema.parse(raw);
  const id = result.status.id;
  if (id <= 2) return null;
  const stdout = decode(result.stdout);
  const diagnostic = decode(result.compile_output) || decode(result.stderr);
  let status: Verdict = id === 5 ? "TIME_LIMIT" : id === 6 ? "COMPILE_ERROR" : id >= 13 ? "INTERNAL_ERROR" : "RUNTIME_ERROR";
  if (id === 3 || id === 4) {
    status = "WRONG_ANSWER";
    try { if (id === 3 && isDeepStrictEqual(JSON.parse(stdout), expected)) status = "ACCEPTED"; } catch { /* Non-JSON output is a wrong answer. */ }
  }
  const ms = result.time == null ? null : Math.ceil(Number(result.time) * 1000);
  if (ms !== null && (!Number.isFinite(ms) || ms > 2147483647)) throw new Error("Invalid runtime");
  // Compare the complete bounded stdout first. Truncation is only for display/storage.
  return { status, stdout: stdout.slice(0, 4000), diagnostic: diagnostic.slice(0, 4000), runtimeMs: ms, memoryKb: result.memory ?? null };
}
export async function executeJudge0(config: RunnerConfig, source: string, cases: RunnerCase[], limits: { timeMs: number; memoryKb: number }): Promise<RunnerOutcome[]> {
  if (!cases.length || cases.length > 10) throw new Error("Unsupported test count");
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 20_000);
  try {
    return await Promise.all(cases.map(async (test) => {
      const created = z.object({ token: z.uuid() }).parse(await request(config, "/submissions?base64_encoded=true&wait=false", controller.signal, {
        language_id: config.languageId,
        source_code: Buffer.from(source).toString("base64"), stdin: Buffer.from(test.stdin).toString("base64"),
        // Expected values stay in this application, outside the untrusted program.
        cpu_time_limit: Math.min(limits.timeMs / 1000, 2), cpu_extra_time: 0.5,
        wall_time_limit: 5, memory_limit: Math.min(limits.memoryKb, 262144), stack_limit: 64000,
        max_file_size: 64, max_processes_and_or_threads: 32,
        enable_per_process_and_thread_time_limit: false, enable_per_process_and_thread_memory_limit: false,
        enable_network: false, number_of_runs: 1, redirect_stderr_to_stdout: false,
      }));
      for (let attempt = 0; attempt < 30; attempt++) {
        await delay(500, undefined, { signal: controller.signal });
        const raw = await request(config, `/submissions/${created.token}?base64_encoded=true&fields=status,stdout,stderr,compile_output,time,memory`, controller.signal);
        const outcome = judgeOutcome(raw, test.expected);
        if (outcome) return outcome;
      }
      throw new Error("Runner queue timed out");
    }));
  } finally { clearTimeout(deadline); controller.abort(); }
}
```

### `src/features/submissions/service.ts`

```typescript
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { RunnerConfig } from "./config";
import type { ExecutionInput, ExecutionResult, ExecutionState } from "./contracts";
import { executeJudge0 } from "./judge0";
import { reserveSubmission, finishSubmission } from "./store";

export async function runSubmission(db: PrismaClient, userId: string, input: ExecutionInput, config: RunnerConfig): Promise<ExecutionState> {
  const reservation = await reserveSubmission(db, userId, input);
  if ("error" in reservation) return { success: false, message: reservation.error! };
  let result: ExecutionResult = { id: reservation.id, mode: input.mode, status: "INTERNAL_ERROR", passedCount: 0,
    totalCount: reservation.cases.length, runtimeMs: null, memoryKb: null, cases: [] };
  try {
    const outcomes = await executeJudge0(config, reservation.source, reservation.cases.map((t) => ({ stdin: t.stdin, expected: t.output })), reservation.limits);
    const failure = outcomes.find((o) => o.status !== "ACCEPTED");
    const times = outcomes.map((o) => o.runtimeMs); const memories = outcomes.map((o) => o.memoryKb);
    result = { ...result, status: outcomes.some((o) => o.status === "INTERNAL_ERROR") ? "INTERNAL_ERROR" : failure?.status ?? "ACCEPTED",
      passedCount: outcomes.filter((o) => o.status === "ACCEPTED").length,
      runtimeMs: times.every((n) => n !== null) ? Math.max(...times as number[]) : null,
      memoryKb: memories.every((n) => n !== null) ? Math.max(...memories as number[]) : null,
      // Never return/store hidden stdout, stderr, compile output, inputs, or expected values.
      cases: input.mode === "RUN" ? outcomes.map((outcome, index) => ({ ...outcome,
        position: reservation.cases[index].position, input: reservation.cases[index].input, expected: reservation.cases[index].output })) : [],
    };
  } catch { /* Provider/queue failure is an infrastructure verdict, never an accepted solution. */ }
  await finishSubmission(db, userId, result);
  return { success: true, result };
}
```

### `src/features/submissions/store.ts`

```typescript
import "server-only";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { ExecutionInput, ExecutionResult } from "./contracts";
import { makeProgram, makeStdin } from "./harness";

// Caller authenticates first. A short database lock shares quotas across server instances.
export async function reserveSubmission(db: PrismaClient, userId: string, input: ExecutionInput) {
  return db.$transaction(async (tx) => {
    const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP AS now FROM pg_advisory_xact_lock(728551, 8)`;
    const now = clock.now;
    await tx.userSubmission.updateMany({ where: { status: { in: ["QUEUED", "RUNNING"] }, createdAt: { lt: new Date(now.getTime() - 120_000) } },
      data: { status: "INTERNAL_ERROR", completedAt: now } });
    const active = { status: { in: ["QUEUED", "RUNNING"] as ("QUEUED" | "RUNNING")[] } };
    const minute = new Date(now.getTime() - 60_000);
    if (await tx.userSubmission.count({ where: { userId, ...active } }) ||
        await tx.userSubmission.count({ where: { userId, createdAt: { gte: minute } } }) >= 5 ||
        await tx.userSubmission.count({ where: { userId, createdAt: { gte: new Date(now.getTime() - 3600_000) } } }) >= 30 ||
        await tx.userSubmission.count({ where: active }) >= 20 ||
        await tx.userSubmission.count({ where: { createdAt: { gte: minute } } }) >= 60) {
      return { error: "The runner is busy or your execution limit was reached. Wait a minute and try again; the hourly limit is 30 requests." } as const;
    }
    // Hold a shared row lock only while snapshotting tests and recording the reservation.
    const [locked] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM app."Problem" WHERE slug = ${input.slug} AND status = 'PUBLISHED' AND kind = 'CODING' FOR SHARE`;
    if (!locked) return { error: "This problem is no longer available for execution." } as const;
    const problem = await tx.problem.findUniqueOrThrow({ where: { id: locked.id }, select: {
      id: true, revision: true, timeLimitMs: true, memoryLimitKb: true,
      starterCode: { where: { language: "JAVASCRIPT" }, select: { entryPoint: true } },
      testCases: { where: input.mode === "RUN" ? { visibility: "VISIBLE" } : {}, orderBy: { position: "asc" }, take: 11,
        select: { position: true, visibility: true, input: true, output: true } },
    } });
    if (!problem.starterCode[0] || !problem.testCases.length || problem.testCases.length > 10 ||
        (input.mode === "SUBMIT" && !problem.testCases.some((t) => t.visibility === "HIDDEN"))) {
      return { error: "This problem does not have a supported test suite yet." } as const;
    }
    const source = makeProgram(input.slug, problem.starterCode[0].entryPoint, input.code);
    const cases = problem.testCases.map((test) => ({ ...test, stdin: makeStdin(input.slug, test.input) }));
    const submission = await tx.userSubmission.create({ data: { userId, problemId: problem.id, problemRevision: problem.revision,
      language: input.language, mode: input.mode, code: input.code, status: "RUNNING", totalCount: cases.length }, select: { id: true } });
    return { id: submission.id, problemId: problem.id, revision: problem.revision, source, cases,
      limits: { timeMs: problem.timeLimitMs, memoryKb: problem.memoryLimitKb } } as const;
  }, { timeout: 10_000 });
}

export async function finishSubmission(db: PrismaClient, userId: string, result: ExecutionResult) {
  return db.$transaction(async (tx) => {
    const saved = await tx.userSubmission.updateMany({ where: { id: result.id, userId, status: "RUNNING" }, data: {
      status: result.status, passedCount: result.passedCount, totalCount: result.totalCount,
      runtimeMs: result.runtimeMs, memoryKb: result.memoryKb, completedAt: new Date(),
      result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
    } });
    if (saved.count !== 1) throw new Error("Submission is no longer writable");
    // Progress analytics are Phase 9. Phase 8 only persists the actual runner verdict.
  });
}
```

### `tests/editor-controls.test.ts`

```typescript
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/features/submissions/actions", () => ({ executeCode: vi.fn() }));
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

### `tests/integration/submissions.test.ts`

```typescript
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { reserveSubmission, finishSubmission } from "@/features/submissions/store";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import type { ExecutionResult } from "@/features/submissions/contracts";

let db: ReturnType<typeof createDatabaseClient>;
let ownsFixtures = false;
let slugs: string[] = [];
let problemId: string;
const owners = [randomUUID(), randomUUID()];
const input = { slug: "relay-window", language: "JAVASCRIPT" as const, mode: "RUN" as const, code: "function relayWindow() { return 13; }" };
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use a disposable TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Submission tests require an empty problem collection.");
  const seeds = await loadProblems(); slugs = seeds.map((seed) => seed.slug); ownsFixtures = true;
  await seedProblems(db, seeds); await db.user.createMany({ data: owners.map((id) => ({ id })) });
  problemId = (await db.problem.findUniqueOrThrow({ where: { slug: input.slug } })).id;
}, 30_000);
beforeEach(async () => {
  await db.userSubmission.deleteMany({ where: { userId: { in: owners } } });
  await db.problem.update({ where: { id: problemId }, data: { status: "PUBLISHED" } });
});
afterAll(async () => {
  if (db && ownsFixtures) {
    await db.user.deleteMany({ where: { id: { in: owners } } });
    await db.problem.deleteMany({ where: { slug: { in: slugs } } });
  }
  await db?.$disconnect();
});
function result(id: string): ExecutionResult { return { id, mode: "RUN", status: "ACCEPTED", passedCount: 2, totalCount: 2, runtimeMs: 12, memoryKb: 1024, cases: [] }; }
async function reserve(owner = owners[0], mode: "RUN" | "SUBMIT" = "RUN") {
  const value = await reserveSubmission(db, owner, { ...input, mode });
  if ("error" in value) throw new Error(value.error);
  return value;
}
it("snapshots only visible cases for Run and the full suite for Submit", async () => {
  const run = await reserve(); expect(run.cases).toHaveLength(2);
  expect(run.cases.every((test) => test.visibility === "VISIBLE")).toBe(true);
  const submit = await reserve(owners[1], "SUBMIT"); expect(submit.cases).toHaveLength(6);
  expect(submit.cases.filter((test) => test.visibility === "HIDDEN")).toHaveLength(4);
  expect(JSON.parse(run.cases[0].stdin)).toEqual([[3, 1, 5, 2, 6, 1], 3]);
  const saved = await db.userSubmission.findUniqueOrThrow({ where: { id: run.id } });
  expect(saved).toMatchObject({ userId: owners[0], status: "RUNNING", code: input.code, problemRevision: run.revision, totalCount: 2 });
});
it("denies archived and absent problems without recording or executing an attempt", async () => {
  await db.problem.update({ where: { id: problemId }, data: { status: "ARCHIVED" } });
  expect(await reserveSubmission(db, owners[0], input)).toHaveProperty("error");
  expect(await reserveSubmission(db, owners[0], { ...input, slug: "not-present" })).toHaveProperty("error");
  expect(await db.userSubmission.count()).toBe(0);
});
it("allows one concurrent reservation per owner across database connections", async () => {
  const values = await Promise.all([reserveSubmission(db, owners[0], input), reserveSubmission(db, owners[0], input)]);
  expect(values.filter((v) => "error" in v)).toHaveLength(1);
  expect(await db.userSubmission.count({ where: { userId: owners[0] } })).toBe(1);
  expect(await reserveSubmission(db, owners[1], input)).not.toHaveProperty("error");
});
it("enforces persisted per-minute and per-hour quotas, including failed requests", async () => {
  for (const [count, age] of [[5, 10000], [30, 120000]]) {
    await db.userSubmission.deleteMany({ where: { userId: owners[0] } });
    await db.userSubmission.createMany({ data: Array.from({ length: count }, () => ({ userId: owners[0], problemId,
      problemRevision: 1, language: "JAVASCRIPT" as const, mode: "RUN" as const, code: "fixture", status: "INTERNAL_ERROR" as const,
      createdAt: new Date(Date.now() - age), completedAt: new Date() })) });
    expect(await reserveSubmission(db, owners[0], input)).toHaveProperty("error");
  }
});
it("recovers abandoned reservations after two minutes without fabricating success", async () => {
  const first = await reserve();
  await db.userSubmission.update({ where: { id: first.id }, data: { createdAt: new Date(Date.now() - 130000) } });
  await reserve();
  expect(await db.userSubmission.findUnique({ where: { id: first.id } })).toMatchObject({ status: "INTERNAL_ERROR", passedCount: 0, result: null, completedAt: expect.any(Date) });
});
it("persists a final verdict only for its owner and only once", async () => {
  const first = await reserve();
  await expect(finishSubmission(db, owners[1], result(first.id))).rejects.toThrow();
  await finishSubmission(db, owners[0], result(first.id));
  const saved = await db.userSubmission.findUniqueOrThrow({ where: { id: first.id } });
  expect(saved).toMatchObject({ status: "ACCEPTED", passedCount: 2, runtimeMs: 12, result: result(first.id), completedAt: expect.any(Date) });
  await expect(finishSubmission(db, owners[0], { ...result(first.id), status: "WRONG_ANSWER" })).rejects.toThrow();
  expect(await db.userProgress.count({ where: { userId: { in: owners } } })).toBe(0);
});

it("enforces the deployment-wide quota across different owners", async () => {
  await db.userSubmission.createMany({ data: Array.from({ length: 60 }, () => ({ userId: owners[1], problemId,
    problemRevision: 1, language: "JAVASCRIPT" as const, mode: "RUN" as const, code: "fixture", status: "INTERNAL_ERROR" as const,
    createdAt: new Date(), completedAt: new Date() })) });
  expect(await reserveSubmission(db, owners[0], input)).toHaveProperty("error");
});
```

### `tests/runner-actions.test.ts`

```typescript
import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ viewer: vi.fn(), db: vi.fn(), config: vi.fn(), run: vi.fn() }));
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
  f.run.mockRejectedValue(new Error("database password")); expect(await executeCode(input)).toMatchObject({ success: false });
  expect(JSON.stringify(await executeCode(input))).not.toContain("password");
});
```

### `tests/runner-adapter.test.ts`

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getRunnerConfig } from "@/features/submissions/config";
import { makeProgram, makeStdin, runnerSupports } from "@/features/submissions/harness";
import { executeJudge0, judgeOutcome } from "@/features/submissions/judge0";
const config = { url: "https://runner.example/", key: "private-key", auth: "token" as const, languageId: 102 };
const b64 = (s: string) => Buffer.from(s).toString("base64");
const raw = (output: string, id = 3) => ({ status: { id }, stdout: b64(output), stderr: null, compile_output: null, time: "0.012", memory: 1234 });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("runner configuration and harness", () => {
  it("requires explicit opt-in, credentials, HTTPS origin and a configured language", () => {
    for (const [key, value] of Object.entries({ CODE_RUNNER_ENABLED: "true", JUDGE0_API_URL: config.url, JUDGE0_API_KEY: config.key,
      JUDGE0_AUTH_MODE: "token", JUDGE0_JAVASCRIPT_LANGUAGE_ID: "102" })) vi.stubEnv(key, value);
    expect(getRunnerConfig()).toEqual(config);
    for (const url of ["", "bad", "http://runner.example/", "https://runner.example/?key=x", "https://user:pass@runner.example/", "https://runner.example/path"]) {
      vi.stubEnv("JUDGE0_API_URL", url); expect(getRunnerConfig()).toBeNull();
    }
    vi.stubEnv("JUDGE0_API_URL", config.url); vi.stubEnv("CODE_RUNNER_ENABLED", "false"); expect(getRunnerConfig()).toBeNull();
    vi.stubEnv("CODE_RUNNER_ENABLED", "true"); vi.stubEnv("JUDGE0_API_KEY", ""); expect(getRunnerConfig()).toBeNull();
  });
  it("uses named argument order, rejects unsupported signatures and never embeds expected values", () => {
    expect(makeStdin("relay-window", { width: 2, loads: [4, 5] })).toBe("[[4,5],2]");
    expect(makeStdin("parcel-checkpoints", { ranges: [[0, 1]], parcels: [4, 5] })).toBe("[[4,5],[[0,1]]]");
    expect(makeStdin("dock-threshold", { load: 8, capacities: [3, 9] })).toBe("[[3,9],8]");
    expect(makeStdin("quiet-badge", { badges: "aab" })).toBe('["aab"]');
    expect(makeStdin("lantern-steps", { costs: [1, 2] })).toBe("[[1,2]]");
    for (const slug of ["unknown", "constructor", "__proto__"]) {
      expect(runnerSupports(slug)).toBe(false); expect(() => makeProgram(slug, "solve", "code")).toThrow();
    }
    expect(() => makeProgram("relay-window", "x);evil()", "code")).toThrow();
    expect(() => makeStdin("relay-window", { width: 2 })).toThrow();
    const source = makeProgram("relay-window", "relayWindow", "function relayWindow() { return 13; }");
    expect(source).toContain("return relayWindow;"); expect(source).toContain('readFileSync(0, "utf8")');
    expect(source).not.toContain("expected");
  });
});

describe("trusted verdict calculation", () => {
  it("compares structured JSON without coercion and independently of provider acceptance", () => {
    expect(judgeOutcome(raw('{"b":2,"a":1}'), { a: 1, b: 2 })?.status).toBe("ACCEPTED");
    for (const output of ['"13"', "14", "console log\n13", "undefined"]) expect(judgeOutcome(raw(output), 13)?.status).toBe("WRONG_ANSWER");
    expect(judgeOutcome(raw("[2,1]"), [1, 2])?.status).toBe("WRONG_ANSWER");
    expect(judgeOutcome(raw("13"), 13)).toMatchObject({ status: "ACCEPTED", runtimeMs: 12, memoryKb: 1234 });
    expect(judgeOutcome(raw("13", 4), 13)?.status).toBe("WRONG_ANSWER");
  });
  it("distinguishes queued, compile, runtime, timeout and infrastructure failures", () => {
    expect(judgeOutcome(raw("", 1), null)).toBeNull(); expect(judgeOutcome(raw("", 2), null)).toBeNull();
    for (const [id, status] of [[5, "TIME_LIMIT"], [6, "COMPILE_ERROR"], [11, "RUNTIME_ERROR"], [13, "INTERNAL_ERROR"], [14, "INTERNAL_ERROR"]] as const)
      expect(judgeOutcome(raw("", id), null)?.status).toBe(status);
    expect(() => judgeOutcome(raw("", 99), null)).toThrow();
    expect(() => judgeOutcome({ ...raw("13"), stdout: "invalid%" }, 13)).toThrow();
    expect(judgeOutcome({ ...raw("13"), time: null, memory: null }, 13)).toMatchObject({ runtimeMs: null, memoryKb: null });
  });
  it("compares full bounded output before truncating visible diagnostics", () => {
    const value = "x".repeat(5000);
    const result = judgeOutcome({ ...raw(JSON.stringify(value)), stderr: b64(value) }, value);
    expect(result?.status).toBe("ACCEPTED"); expect(result?.stdout).toHaveLength(4000); expect(result?.diagnostic).toHaveLength(4000);
  });
});

describe("Judge0 transport with an inert HTTP stub", () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
  it("sends only source/stdin, forces sandbox limits, polls privately and compares output", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ token: "00000000-0000-4000-8000-000000000001" })).mockResolvedValueOnce(Response.json(raw("13")));
    const result = await executeJudge0(config, "source", [{ stdin: "[[1],1]", expected: 13 }], { timeMs: 2000, memoryKb: 262144 });
    expect(result[0].status).toBe("ACCEPTED");
    const [url, request] = fetchMock.mock.calls[0]; const body = JSON.parse(request.body);
    expect(url.toString()).toBe("https://runner.example/submissions?base64_encoded=true&wait=false");
    expect(body).toMatchObject({ enable_network: false, number_of_runs: 1, max_file_size: 64, wall_time_limit: 5, max_processes_and_or_threads: 32 });
    for (const key of ["expected_output", "callback_url", "additional_files", "compiler_options", "command_line_arguments"]) expect(body).not.toHaveProperty(key);
    expect(Buffer.from(body.source_code, "base64").toString()).toBe("source");
    expect(request.headers).toMatchObject({ "X-Auth-Token": "private-key" });
    expect(request.redirect).toBe("error"); expect(request.cache).toBe("no-store");
    expect(fetchMock.mock.calls[1][0].toString()).not.toContain("private-key");
  });
  it("supports explicit RapidAPI headers without accepting browser header/URL overrides", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ token: "00000000-0000-4000-8000-000000000002" })).mockResolvedValueOnce(Response.json(raw("0")));
    await executeJudge0({ ...config, auth: "rapidapi" }, "source", [{ stdin: "[]", expected: 0 }], { timeMs: 9000, memoryKb: 500000 });
    const req = fetchMock.mock.calls[0][1];
    expect(req.headers).toMatchObject({ "X-RapidAPI-Key": config.key, "X-RapidAPI-Host": "runner.example" });
    expect(JSON.parse(req.body)).toMatchObject({ cpu_time_limit: 2, memory_limit: 262144 });
  });
  it("fails closed on provider errors, oversized responses and invalid tokens", async () => {
    for (const response of [new Response("secret", { status: 401 }), new Response("x".repeat(128001)), Response.json({ token: "../../secret" })]) {
      fetchMock.mockResolvedValueOnce(response);
      await expect(executeJudge0(config, "source", [{ stdin: "[]", expected: 0 }], { timeMs: 2000, memoryKb: 262144 })).rejects.toThrow();
    }
  });
  it("bounds queue polling and never treats unfinished work as accepted", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(Response.json({ token: "00000000-0000-4000-8000-000000000002" }));
    fetchMock.mockImplementation(async () => Response.json(raw("", 2)));
    const promise = expect(executeJudge0(config, "source", [{ stdin: "[]", expected: 0 }], { timeMs: 2000, memoryKb: 262144 })).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(21000); await promise;
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(31);
  });
});
```

### `tests/runner-controls.test.ts`

```typescript
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/features/submissions/actions", () => ({ executeCode: f.execute }));
import { RunnerControls } from "@/components/editor/runner-controls";
import type { ExecutionState } from "@/features/submissions/contracts";
let host: HTMLDivElement; let root: Root;
const props = { slug: "relay-window", code: "function relayWindow() {}", language: "JAVASCRIPT", enabled: true, signedIn: true, examples: [] };
const response: ExecutionState = { success: true, result: { id: "saved-id", mode: "RUN", status: "WRONG_ANSWER", passedCount: 0, totalCount: 1, runtimeMs: 12, memoryKb: 3000,
  cases: [{ position: 1, status: "WRONG_ANSWER", input: [1], expected: 13, stdout: '<script>alert("output")</script>', diagnostic: "debug", runtimeMs: 12, memoryKb: 3000 }] } };
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); f.execute.mockReset(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
async function render(extra = {}) { await act(() => root.render(createElement(RunnerControls, { ...props, ...extra }))); }
function button(text: string) { return [...host.querySelectorAll("button")].find((b) => b.textContent === text)!; }
it("gates guests, disabled providers, unsupported languages and oversized code", async () => {
  for (const extra of [{ signedIn: false }, { enabled: false }, { language: "PYTHON" }, { code: "" }, { code: "x".repeat(20001) }]) {
    await render(extra); expect(button("Run visible tests").disabled).toBe(true); expect(button("Submit solution").disabled).toBe(true);
  }
  expect(f.execute).not.toHaveBeenCalled();
});
it("captures the draft, blocks duplicate clicks and warns about edits during execution", async () => {
  let finish!: (value: ExecutionState) => void;
  f.execute.mockReturnValue(new Promise<ExecutionState>((resolve) => { finish = resolve; }));
  await render(); await act(() => { button("Run visible tests").click(); button("Run visible tests").click(); });
  expect(f.execute).toHaveBeenCalledOnce(); expect(f.execute).toHaveBeenCalledWith({ slug: props.slug, code: props.code, language: props.language, mode: "RUN" });
  expect(button("Submit solution").disabled).toBe(true);
  await render({ code: "changed draft" }); await act(async () => { finish(response); });
  expect(host.textContent).toContain("earlier draft or language"); expect(host.textContent).toContain("Execution result saved");
  expect(host.textContent).toContain("12 ms (slowest test)"); expect(host.querySelector("script")).toBeNull();
});
it("shows full-suite summaries and keeps errors distinct from saved results", async () => {
  f.execute.mockResolvedValue({ ...response, result: { ...response.result, mode: "SUBMIT", cases: [] } });
  await render(); await act(async () => { button("Submit solution").click(); });
  expect(host.textContent).toContain("hidden details are withheld"); expect(host.textContent).not.toContain("Actual output");
  f.execute.mockRejectedValue(new Error("network")); await act(async () => { button("Run visible tests").click(); });
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("may have been saved");
  expect(host.textContent).not.toContain("Execution result saved"); expect(button("Run visible tests").disabled).toBe(false);
});
```

### `tests/runner-service.test.ts`

```typescript
import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ reserve: vi.fn(), finish: vi.fn(), execute: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/submissions/store", () => ({ reserveSubmission: f.reserve, finishSubmission: f.finish }));
vi.mock("@/features/submissions/judge0", () => ({ executeJudge0: f.execute }));
import { runSubmission } from "@/features/submissions/service";
import type { PrismaClient } from "@/generated/prisma/client";
const db = {} as PrismaClient;
const config = { url: "https://runner.example/", key: "private", auth: "token" as const, languageId: 102 };
const input = { slug: "relay-window", language: "JAVASCRIPT" as const, mode: "SUBMIT" as const, code: "source" };
beforeEach(() => {
  vi.clearAllMocks(); f.finish.mockResolvedValue(undefined);
  f.reserve.mockResolvedValue({ id: "own-attempt", cases: [
    { position: 1, input: "visible", output: 1, stdin: "visible" },
    { position: 2, input: "HIDDEN-INPUT", output: "HIDDEN-EXPECTED", stdin: "HIDDEN-INPUT" },
  ], source: "source", limits: { timeMs: 2000, memoryKb: 262144 } });
  f.execute.mockResolvedValue([
    { status: "ACCEPTED", stdout: "1", diagnostic: "", runtimeMs: 10, memoryKb: 100 },
    { status: "RUNTIME_ERROR", stdout: "HIDDEN-PRINT", diagnostic: "HIDDEN-ERROR", runtimeMs: 20, memoryKb: 200 },
  ]);
});
it("suppresses all hidden payloads and diagnostics in both response and stored result", async () => {
  const result = await runSubmission(db, "owner", input, config);
  expect(result).toMatchObject({ success: true, result: { passedCount: 1, totalCount: 2, status: "RUNTIME_ERROR", cases: [], runtimeMs: 20, memoryKb: 200 } });
  for (const text of [JSON.stringify(result), JSON.stringify(f.finish.mock.calls)]) expect(text).not.toContain("HIDDEN");
});
it("returns visible inputs, outputs and errors only for visible runs", async () => {
  f.reserve.mockResolvedValue({ id: "own-attempt", source: "source", limits: {}, cases: [{ position: 1, input: [1], output: 1, stdin: "[1]" }] });
  f.execute.mockResolvedValue([{ status: "WRONG_ANSWER", stdout: "2", diagnostic: "debug", runtimeMs: null, memoryKb: null }]);
  expect(await runSubmission(db, "owner", { ...input, mode: "RUN" }, config)).toMatchObject({ success: true, result: { status: "WRONG_ANSWER", cases: [{ input: [1], expected: 1, stdout: "2", diagnostic: "debug" }], runtimeMs: null } });
});
it("persists infrastructure failures without revealing provider errors or inventing results", async () => {
  f.execute.mockRejectedValue(new Error("api-key HIDDEN-INPUT"));
  const result = await runSubmission(db, "owner", input, config);
  expect(result).toMatchObject({ success: true, result: { status: "INTERNAL_ERROR", passedCount: 0, runtimeMs: null, cases: [] } });
  expect(JSON.stringify(result)).not.toContain("api-key"); expect(f.finish).toHaveBeenCalledOnce();
});
it("never calls the provider when a reservation is denied and surfaces failed persistence", async () => {
  f.reserve.mockResolvedValue({ error: "Limit reached" });
  expect(await runSubmission(db, "owner", input, config)).toEqual({ success: false, message: "Limit reached" }); expect(f.execute).not.toHaveBeenCalled();
  f.reserve.mockResolvedValue({ id: "own-attempt", cases: [], limits: {}, source: "" }); f.finish.mockRejectedValue(new Error("DB failed"));
  await expect(runSubmission(db, "owner", input, config)).rejects.toThrow("DB failed");
});
```

## 🟨 Automated checks

```bash
npm run db:validate
npm run seed:validate
npm test
npm run lint
npm run typecheck
npm run build
npm run test:smoke
```

`npm test` includes inert provider fixtures: no user code is executed and no external runner is called. Transport tests inspect credentials, resource controls, output comparison, bounded polling, malformed responses and failures. Component tests mock the action and Monaco, covering guest/disabled states, duplicate clicks, edits during execution, escaped output and connection failures. Server-action tests reject identity/URL/test overrides and unconfirmed sessions. Service tests check that hidden sentinel strings never enter responses or saved DTOs.

PostgreSQL integration requires a separate, empty database ending in `_test`. Configure `TEST_DATABASE_URL`; apply migrations to that same disposable database using `DATABASE_URL` (and ensure `DIRECT_URL` does not redirect migration elsewhere). Then run:

```bash
npm run db:deploy
npm run test:integration
npm run db:seed
node scripts/smoke-library.mjs
```

The CI workflow supplies PostgreSQL 17, performs these steps in the right order, and cleans up owned test fixtures. Integration tests reserve visible/full suites, deny archived content, exercise simultaneous requests, enforce quotas, recover abandoned attempts and reject another owner's or duplicate final writes. The existing HTTP smoke confirms published pages contain disabled Run/Submit controls and guest sign-in guidance while excluding hidden payloads.

Read SESSION-HANDOFF.md and PR #9 for actual final check results. Passing mocked transport tests does not verify a real Judge0 installation, Node runtime, network isolation or live account session.

## 🟥 Live development checklist before enabling real users

1. Verify the provider is maintained and appropriately isolated from the app/database network. Use development-only credentials and provider-side quotas. Confirm the configured runtime is JavaScript/Node with CommonJS `require` support.
2. Sign in with a confirmed development account. Check guests and expired sessions cannot invoke either action, even with a manually constructed request.
3. Open each of the five problems. Copy its original optimal solution from the solution panel. Run visible tests, then Submit. Expect the current seeds to yield 2/2 visible and 6/6 full-suite results.
4. Try a wrong return value, a syntax error, a thrown error and an infinite loop on the development runner. Confirm each gives an appropriate failure and never hangs the application server. Check runtime/memory against the provider response.
5. Add `console.log` and inspect visible output/error panels. In Submit mode, attempt to print arguments or throw an error containing them; only the summary may reach the browser or the stored result JSON.
6. Within the isolated development provider, verify network access is actually disabled. Do not treat the presence of `enable_network: false` in a request as a live network-isolation test.
7. Edit while a request runs, reset the draft and switch languages. Old results must be identified as earlier-draft results. Pending controls prevent duplicate clicks; a network interruption leaves your draft available.
8. Test quotas in the development environment and inspect rows with Prisma Studio as a trusted developer. Confirm owner, exact submitted code, revision, mode and final status. A hidden submission's `result.cases` must be empty. Do not expose Studio or the database owner to browsers.
9. Check keyboard-only interaction, screen-reader announcements, output wrapping, mobile width and 200% zoom. Also complete Phase 7's real Monaco-worker checklist.
10. Disable the runner, break its credentials, or simulate an outage. No fallback should evaluate code locally or report success. Restore configuration only after checking the failure behavior.

## 🟨 Common mistakes

- Supplying a user ID or test suite from the client: both must come from trusted server lookups.
- Relying on a hidden button for authorization: every server action authenticates independently.
- Sending expected output in source or stdin: the untrusted solution could read its own answer key.
- Treating provider Accepted as an AlgoSprint pass: compare the returned JSON yourself.
- Returning hidden stderr to explain a failure: the program can print its hidden input there.
- Sorting JSON object fields and using their values as arguments: explicit signatures preserve parameter order.
- Marking a visible run as a verified solve: it never tested the hidden suite.
- Saving a successful UI state before the database commit: persistence failures must remain failures.
- Removing the database reservation lock: independent app instances could exceed quotas concurrently.
- Claiming mock/provider-stub tests prove live execution: they validate application behavior only.

## 🟪 Next phase and expansion

Pause after this checkpoint. Phase 9 connects attempts and accepted full-suite submissions to progress while preserving manual/verified provenance, review flags, dates and concurrency safety. The Phase 8 runner intentionally leaves existing manual progress unchanged.

Later work can add a private submission-history UI, idempotent request keys, durable queued jobs and a worker, cancellation, provider cleanup/retention controls, reviewed signatures for more languages/problems, better language-aware diagnostics, and stronger operational monitoring. More than ten cases, 64 KB stdin, SQL execution, package imports, arbitrary runtime options and custom sandbox deployment need a separate reviewed design. Do not silently widen these limits as the seed collection grows.

## 🟦 In-process sandbox provider (September 22 follow-up)

Because no hosted free execution service remains, the runner gained a second provider selected with `CODE_RUNNER_PROVIDER=sandbox`: the harness program runs inside a QuickJS interpreter compiled to WebAssembly (`quickjs-emscripten-core` with the single-file variant), hosted in a Node worker thread (`src/features/submissions/sandbox.ts`).

**This is a deliberate, user-approved exception to the brief's rule that user code never executes on the web server.** The trade was made on 2026-09-22 so that verified submissions work without a paid or self-hosted provider. What makes it acceptable:

- The interpreter is a separate WebAssembly realm with no access to Node, the filesystem, the network or the host process. The only host surface is the tiny Node-like prelude the harness needs: `require("fs").readFileSync(0)` returning the case's stdin, `process.stdout/stderr.write`, `process.exitCode` and `console`. `require` of anything else throws; `process` is not a global.
- Every case runs in a fresh runtime with a memory cap (the problem's limit, at most 256 MB), a 4 MB interpreter stack (about 21,000 frames; a deeper recursion is a runtime error, never a host crash), and a wall-clock interrupt at the problem's time limit (at most 2 s plus 0.5 s grace). Output is capped at 90 KB. A 20-second budget covers the whole submission, and the main thread terminates the worker 5 s after that if it is wedged.
- Exactly the same program text as the Judge0 path is executed (`makeProgram` / `makeStdin`), so verdict semantics, hidden-test privacy, quotas, stored results and verified solves are unchanged: the app still parses stdout as JSON and compares it to the trusted expected value itself. Interrupts map to `TIME_LIMIT`, out-of-memory to `MEMORY_LIMIT`, syntax errors to `COMPILE_ERROR`, everything else to `RUNTIME_ERROR`. Worker death or an unparsable message fails closed as `INTERNAL_ERROR`.
- `quickjs-emscripten-core` and the variant are `serverExternalPackages`, so the worker (an `eval` worker with plain `require`) loads them from `node_modules` in the deployment, resolving from the working directory (the function root on Vercel). Because only the worker's source string requires them, build tracing cannot see them: `outputFileTracingIncludes` in `next.config.ts` adds both packages and `@jitl/quickjs-ffi-types` to the problem page's trace. Without it, the deployed function lacks QuickJS and every Submit fails closed as `INTERNAL_ERROR`, although local `next start` works. `npm run test:trace` (CI, after the build) copies only the page's traced `node_modules` into an empty directory and runs a real submission from there.

What it does not do: it does not isolate CPU time from the serving process beyond the interrupt deadline, so the existing per-user quotas (5 per minute, 30 per hour, plus the deployment-wide cap) remain the abuse control. The problem page declares `maxDuration = 60` so a slow submission cannot be cut off by the platform default. Switching back to an external provider is a configuration change (`CODE_RUNNER_PROVIDER=judge0` plus the Judge0 variables).

Tests: `tests/sandbox-runner.test.ts` runs hostile programs through the real worker (infinite loop, memory bomb, deep recursion, output flood, host-surface probes, worker death) and `tests/integration/submissions.test.ts` verifies a full submission end to end against PostgreSQL, including the recorded verified solve.

## 🟦 Browser execution of visible tests (September 21 follow-up)

Hosted free code-execution APIs no longer exist (RapidAPI meters Judge0 from the first call, Judge0's Sulu marketplace closed, and Piston's public API became whitelist-only in February 2026). To keep the editor useful without a provider, **Run visible tests** now executes in the learner's own browser:

- `src/features/submissions/browser-runner.ts` starts one Web Worker per public example from a Blob URL. The worker mirrors the Judge0 harness contract: positional arguments in signature order, the JSON-serialized return value as output, console output captured as diagnostics, `SyntaxError` reported as a compilation error, other throws as runtime errors. Network and `importScripts` are removed from the worker scope, each case has a 3-second wall-clock limit enforced by `terminate()`, output is compared structurally before truncation, and the result carries `browser: true`.
- The problem page passes the problem's runner signature (entry point and argument order) from `signatures.ts`, so the client never infers argument order from JSON key order.
- Run is available to everyone, including guests, and saves nothing: no submission row, no rate-limit reservation, no progress change. The panels say "Ran in your browser" instead of "Saved attempt". Runtime is wall-clock time on the learner's machine; memory is not measured.
- **Submit** still requires the configured external provider and an account, because hidden tests never leave the server and a browser result cannot be trusted for a verified solve. The server RUN mode remains in the action contract for API and integration coverage but the interface no longer uses it.

The browser sandbox protects the page from infinite loops and keeps the code the learner wrote on their own machine; it is not a security boundary against code the learner chooses to run, which is the same trust model as a browser devtools console. `tests/browser-runner.test.ts` executes the real worker script in a `vm` context to check the contract.
