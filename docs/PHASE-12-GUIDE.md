# Phase 12 — Original learning roadmaps

The user resumed Phase 12 after the saved pause on 2026-09-18. This guide covers the full implementation and all 23 changed source/test/script files in [PR #13](https://github.com/zihadpcode/AlgoSprint/pull/13), branch `algosprint/phase-12-roadmaps`. The prior pause is superseded; its checkpoint is preserved in the handoff history and Git history. Final-head CI and merge evidence are recorded on the PR. Phase 13 remains unstarted.

## 🟦 What this phase builds

The new `/roadmaps` page lists published learning paths, twelve per page, ordered by title then slug. `/roadmaps/[slug]` shows a description, difficulty, estimated practice time, ordered steps, links to the existing problem pages, personal progress and a suggested next step. Guests can browse the content. Signing in adds private progress; browsing does not create an attempt or mark anything solved.

The two paths are original short sequences through the existing reviewed problems:

| Path | Order | Estimated time |
| --- | --- | --- |
| Scan, Store, Reuse | Quiet Badge → Relay Window → Parcel Checkpoints | 75 minutes |
| Boundaries to Decisions | Dock Threshold → Lantern Steps | 65 minutes |

The first path connects frequency counting, a running window and prefix totals through reusable information. The second connects precise boundary reasoning to defining recurrence states. Each step gives a concrete reflection prompt. These are small starter paths, not a complete DSA curriculum or a promise of mastery. Estimates include reflection and are planning aids, not deadlines.

No enrollment, per-roadmap completion records, step locking, new problem content, roadmap authoring interface or independent roadmap reset exists. A problem carries the same progress wherever it appears. Future paths may overlap, so adding their completion totals would double-count shared problems.

## 🟦 How reads work

1. Next.js awaits route parameters and validates the slug. Malformed slugs return not-found without identity/database access. Missing database configuration shows a preparation state rather than an invented empty collection.
2. The server loader verifies the account through the existing `getViewer`. Client parameters, cookies naming a user, and claimed roles do not select an owner. Provider/database errors propagate to the existing error boundary.
3. The query requires a published roadmap, at least one step, and no linked problem whose status differs from PUBLISHED. If one step becomes draft or archived, the entire roadmap disappears from the list and its detail returns 404. This preserves the intended sequence and denominator without revealing unpublished step metadata. Empty/draft/archived roadmaps are unavailable to administrators on these public routes as well.
4. Reads run in a Repeatable Read transaction. List counts, clamped page number, ordered content and personal progress therefore share one database snapshot. Requests beyond the final page redirect to the last valid page. The page parser accepts bounded positive integer strings and rejects arrays/fractions/oversized numbers.
5. Explicit selections fetch path descriptions and problem summaries, not statements, solutions, tests, notes, submissions, source code or operational IDs. Personal relations use only the verified viewer ID. Guests use a false relation predicate and receive null personal fields, not another user's data or a fabricated zero percent.
6. DTO construction drops the raw revision/progress row and returns the existing progress presentation. Routes are dynamic; the existing `/roadmaps/:path*` session proxy applies private/no-store headers. No public or cross-user data cache is added.

## 🟨 Progress and next-step policy

The existing Phase 9 `progressView` controls meaning. SOLVED records count toward roadmap completion, including self-marked, verified-current, verified-earlier and older recorded solves. Those four counts are displayed separately. Current verification still requires the existing accepted full submission behavior; visiting a roadmap cannot verify a solve. Review flags are independent.

For signed-in viewers, completion is `round(solved steps / total steps × 100)`. The UI also shows the exact fraction and a labeled native progress element. An empty input avoids division by zero, although empty roadmaps are excluded by the query. Guests receive sign-in guidance with a safe return URL instead of a numeric personal percentage.

Suggestions use the published step order:

1. First step that is not recorded solved.
2. If every step is solved, first step flagged for review.
3. Otherwise, first step verified on an earlier problem revision.
4. Otherwise, explain that all steps are recorded solved and may be repeated.

Guests see the first step with an explanation that signing in personalizes the suggestion. Manual and older recorded solves count as completion; they do not silently become verified. A suggestion is advisory and never modifies progress. Existing problem changes and successful code execution now revalidate the roadmap list and the `/roadmaps/[slug]` page pattern so revisits can reflect updated records.

## 🟦 Seed validation and persistence

`src/data/seeds/roadmaps.ts` contains the original descriptions and ordered problem slugs. Zod validates strict objects, safe slugs, required bounded text, positive integer estimates, nonempty bounded steps, unique path slugs and unique problems within a path. Positions are assigned from array order, beginning at one.

`npm run seed:validate` loads the original problem JSON files, validates their existing semantics, and verifies all roadmap references against published problem seeds. `prisma/seed.ts` performs the same roadmap reference check before connecting for writes. It runs existing problem seeding first, then roadmap seeding.

`seedRoadmaps` validates input again and uses one transaction for the full roadmap batch. A transaction advisory lock serializes cooperating roadmap seed jobs. It looks up referenced database problems and refuses missing or unpublished references. Identical paths are skipped without replacing IDs, steps, timestamps or user records. An existing path with different metadata, status, step content, order or references causes a conflict; the whole roadmap batch rolls back. Archived paths are not silently republished. No destructive upsert or delete-and-rebuild is used.

Problem seeding and roadmap seeding are separate transactions. A roadmap conflict can occur after problem seeding already succeeded. An intentional content edit requires a reviewed future authoring/migration workflow; do not delete valuable data merely to force a seed rerun. The lock serializes seed jobs, not future independent administrator writes, which will need a deliberate coordination policy in Phase 13.

The existing Roadmap/RoadmapStep tables, uniqueness constraints, foreign keys and positive position/estimate checks are reused. No schema, migration or dependency changes were made. No production database was seeded or migrated.

## 🟩 Local setup

Use Node.js 24 and preserve any existing environment file:

```bash
npm ci
npm run db:generate
```

For a new local checkout only, copy `.env.example` to `.env.local` and configure a development database. With an existing configured development database:

```bash
npm run db:deploy
npm run seed:validate
npm run db:seed
npm run dev
```

`DIRECT_URL`, when present, is used for migrations/seeding; `DATABASE_URL` is used at runtime. Guest roadmap browsing only needs the database. Personal progress needs the existing Supabase settings and a confirmed development account. Real execution remains disabled until the earlier runner configuration and live verification requirements are satisfied. Never run reset commands on valuable data.

Open `/roadmaps`, choose a path, and follow its problem links. Save any editor or note work before navigation; roadmaps do not introduce draft autosave. Change progress on the problem page and return to the path to inspect the updated fraction and next-step suggestion.

## 🟨 Verification

Observed local results on the implementation:

- **135 unit/component/migration tests passed** across 30 test files, including twelve new roadmap tests.
- Seed validation passed for five original problems and two original roadmaps.
- Lint, TypeScript and production build passed.
- The unconfigured production HTTP smoke passed, including roadmap preparation states and malformed-slug 404 behavior.
- Whitespace checks passed.

**All 51 real PostgreSQL integration tests passed** in [CI 35406834061](https://github.com/zihadpcode/AlgoSprint/actions/runs/35406834061) on checkpoint `cc4f7a3efaba3da1eb6b62145d55029b90c8a096`. Seven new tests cover ordered/public projections, owner/admin isolation and shared progress, revision provenance and read-only behavior, unavailable path rules, stable pagination, seed reruns/concurrency, and batch rollback/conflicts. Together with the 135 unit/component/migration tests, this is **186 passing tests**.

The seeded HTTP script checks roadmap links, guest guidance, private cache headers, pagination redirects, invalid/missing detail routes and draft/archived/unpublished-step exclusion. It passed after database seeding in CI 35406834061. Every workflow step passed, including build, migrations, seed validation/seeding and both production HTTP checks. PR #13 separately records final documentation-head CI and merge evidence.

Implementation commit: `38cf4c88a80a0b2e8e9d7f94ce139891d9baf650`; tree: `10f2e531273a113ab6634770dd9c4bdb2ee0bd20`. The resumed review required no implementation change. The old pause is preserved in the handoff and Git history; Phase 13 remains the next milestone.

## 🟥 Live checks and remaining limitations

The previous pause is historical. The resumed session inspects database and production CI before completion, checks all source listings, and publishes the completed guide and handoff. PR #13 records the final tested head and merge-tree evidence. Local ancestry is synthetic; future publication must preserve the actual remote parent/tree and remote-only historical guides.

Live browser checks remain pending: narrow layout and 200% zoom, keyboard focus and link navigation, screen-reader ordered steps/progress labels, long titles, back-navigation refresh, and missing/error states. With two confirmed development accounts, verify progress isolation, review toggles, manual undo, shared problems and stale revision labels. No live Supabase/Judge0 verification, deployment or provider purchase occurred. Automated rendering uses server markup and controlled mocks, not a live authenticated browser.

## 🟪 Complete source files

The following 23 files are the complete authored source/test/script changes. Generated files, unchanged shared components, and historical guides remain outside these listings. README, project brief and handoff are maintained separately. The source listings match the implementation; verification claims above distinguish automated checks from live checks.


### `prisma/seed-roadmaps.ts`

```typescript
import type { PrismaClient } from "../src/generated/prisma/client";
import { roadmapBatchSchema, validateRoadmapReferences } from "../src/lib/validators/roadmap";
import { canonicalJson } from "./seed-data";

export async function seedRoadmaps(db: PrismaClient, input: unknown) {
  const roadmaps = roadmapBatchSchema.parse(input);
  return db.$transaction(async (tx) => {
    // Serialize cooperating seed jobs; all roadmaps in this batch commit or roll back together.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(712012::bigint)`;
    const problems = await tx.problem.findMany({ where: { slug: { in: roadmaps.flatMap((r) => r.steps.map((s) => s.problemSlug)) } }, select: { id: true, slug: true, status: true } });
    validateRoadmapReferences(roadmaps, new Set(problems.filter((p) => p.status === "PUBLISHED").map((p) => p.slug)));
    const ids = new Map(problems.map((p) => [p.slug, p.id]));
    let created = 0; let skipped = 0;
    for (const roadmap of roadmaps) {
      const { steps, ...content } = roadmap;
      const expected = { ...content, status: "PUBLISHED" as const, steps: steps.map(({ problemSlug, ...step }, i) => ({ ...step, position: i + 1, problemId: ids.get(problemSlug)! })) };
      const current = await tx.roadmap.findUnique({ where: { slug: roadmap.slug }, select: {
        slug: true, title: true, description: true, difficulty: true, estimatedMinutes: true, status: true,
        steps: { orderBy: { position: "asc" }, select: { title: true, description: true, position: true, problemId: true } },
      } });
      if (current) {
        if (canonicalJson(current) !== canonicalJson(expected)) throw new Error(`Roadmap seed conflict for ${roadmap.slug}; existing content was preserved.`);
        skipped++; continue;
      }
      await tx.roadmap.create({ data: { ...content, status: "PUBLISHED", steps: { create: expected.steps } } });
      created++;
    }
    return { created, skipped };
  }, { timeout: 30_000 });
}
```

### `prisma/seed.ts`

```typescript
import { loadEnvConfig } from "@next/env";
import { createDatabaseClient } from "../src/lib/db/client";
import { loadProblems } from "../scripts/lib/load-problems";
import { seedProblems } from "./seed-data";
import { seedRoadmaps } from "./seed-roadmaps";
import { ROADMAPS } from "../src/data/seeds/roadmaps";
import { validateRoadmapReferences } from "../src/lib/validators/roadmap";

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL in .env.local before seeding.");
  const problems = await loadProblems();
  validateRoadmapReferences(ROADMAPS, new Set(problems.filter((p) => p.status === "PUBLISHED").map((p) => p.slug)));
  const db = createDatabaseClient(url);
  try {
    console.log("Problems:", await seedProblems(db, problems));
    console.log("Roadmaps:", await seedRoadmaps(db, ROADMAPS));
  }
  finally { await db.$disconnect(); }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed failed.");
  process.exitCode = 1;
});
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
const roadmapId = randomUUID();
const roadmapSlug = "qa-roadmap-" + roadmapId;
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
  const roadmaps = await fetch(origin + "/roadmaps?userId=forged", { headers: { cookie: "role=ADMIN; sb-access-token=forged" } });
  assert.equal(roadmaps.status, 200);
  assert.match(roadmaps.headers.get("cache-control") ?? "", /no-store/);
  const roadmapHtml = await roadmaps.text();
  for (const title of ["Scan, Store, Reuse", "Boundaries to Decisions"]) assert.ok(roadmapHtml.includes(title), title);
  for (const slug of ["scan-store-reuse", "boundaries-to-decisions"]) {
    const detail = await fetch(origin + `/roadmaps/${slug}?userId=forged&role=ADMIN`);
    assert.equal(detail.status, 200); assert.match(detail.headers.get("cache-control") ?? "", /no-store/);
    const body = await detail.text();
    for (const value of ["Suggested next step", "Practice in this order", "Sign in to track this path", 'aria-label="Ordered roadmap steps"']) assert.ok(body.includes(value), value);
    for (const field of ["seedHash", "testCases", "starterCode", "verifiedRevision", "steps recorded solved ·"]) assert.ok(!body.includes(field), field);
  }
  const roadmapPage = await fetch(origin + "/roadmaps?page=999", { redirect: "manual" });
  assert.equal(roadmapPage.status, 307); assert.equal(roadmapPage.headers.get("location"), "/roadmaps");
  for (const slug of ["does-not-exist", "INVALID"]) assert.equal((await fetch(origin + `/roadmaps/${slug}`)).status, 404);
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
  await db.query(`INSERT INTO app."Roadmap" (id, slug, title, description, difficulty, "estimatedMinutes", status, "updatedAt") VALUES ($1, $2, 'UNPUBLISHED-ROADMAP-SENTINEL', 'Fixture', 'EASY', 1, 'DRAFT', now())`, [roadmapId, roadmapSlug]);
  await db.query(`INSERT INTO app."RoadmapStep" (id, "roadmapId", "problemId", position, title) VALUES ($1, $2, $3, 1, 'PRIVATE-STEP-SENTINEL')`, [randomUUID(), roadmapId, fixtureIds[1]]);
  for (const status of ["DRAFT", "PUBLISHED", "ARCHIVED"]) {
    await db.query('UPDATE app."Roadmap" SET status = $1 WHERE id = $2', [status, roadmapId]);
    const response = await fetch(origin + `/roadmaps/${roadmapSlug}?userId=${userId}`);
    assert.equal(response.status, 404, "Unavailable roadmap/step must be 404");
    const listBody = await (await fetch(origin + "/roadmaps")).text();
    for (const secret of ["UNPUBLISHED-ROADMAP-SENTINEL", "PRIVATE-STEP-SENTINEL", "PRIVATE-NOTE-SENTINEL", "HIDDEN-PAYLOAD-SENTINEL"]) assert.ok(!listBody.includes(secret));
  }
  console.log("Library/detail/roadmaps HTTP smoke passed: seeded links, filters, detail sections, collapsed solutions, guest gates, privacy headers, hidden payload exclusion and unpublished 404s.");
} finally {
  server.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(3000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
  try {
    await db.query('DELETE FROM app."Roadmap" WHERE id = $1', [roadmapId]);
    await db.query('DELETE FROM app."User" WHERE id = $1', [userId]);
    await db.query('DELETE FROM app."Problem" WHERE id = ANY($1::uuid[])', [fixtureIds]);
  } finally { await db.end(); }
}
```

### `scripts/validate-seeds.ts`

```typescript
import { loadProblems } from "./lib/load-problems";
import { ROADMAPS } from "../src/data/seeds/roadmaps";
import { validateRoadmapReferences } from "../src/lib/validators/roadmap";

async function main() {
  const problems = await loadProblems();
  const roadmaps = validateRoadmapReferences(ROADMAPS, new Set(problems.filter((p) => p.status === "PUBLISHED").map((p) => p.slug)));
  console.log(`Validated ${problems.length} original problems, their examples, and all expected outputs.`);
  console.log(`Validated ${roadmaps.length} original roadmaps and their ordered problem references.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed validation failed.");
  process.exitCode = 1;
});
```

### `src/app/roadmaps/[slug]/page.tsx`

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoadmapNext, RoadmapProgress, RoadmapSteps } from "@/components/roadmaps/roadmap-content";
import { loadRoadmap } from "@/features/roadmaps/load";

export const metadata: Metadata = { title: "Learning path", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function RoadmapPage({ params }: { params: Promise<{ slug: string }> }) {
  const view = await loadRoadmap((await params).slug);
  if (view.kind === "not-found") notFound();
  if (view.kind === "unavailable") return <AppShell>
    <PageHeading eyebrow="Learning path" title="Roadmaps are being prepared" description="Please check back when the collection is available." />
    <ButtonLink href="/roadmaps" variant="secondary">Back to roadmaps</ButtonLink>
  </AppShell>;
  const { roadmap } = view;
  return <AppShell signedIn={view.signedIn} admin={view.admin}>
    <Link href="/roadmaps" className="mb-6 inline-block text-sm font-semibold text-accent hover:underline">← Learning roadmaps</Link>
    <PageHeading eyebrow="Read · practice · connect" title={roadmap.title} description={roadmap.description} />
    <div className="mb-6 flex flex-wrap items-center gap-3"><Badge>{roadmap.difficulty}</Badge><p className="text-sm text-muted">{roadmap.steps.length} steps · About {roadmap.estimatedMinutes} minutes, including reflection</p></div>
    <div className="mb-8 grid items-start gap-6 xl:grid-cols-2">
      <Card><CardTitle>Your roadmap progress</CardTitle><RoadmapProgress roadmap={roadmap} />
        {!view.signedIn && <div className="mt-4"><ButtonLink href={`/login?next=${encodeURIComponent(`/roadmaps/${roadmap.slug}`)}`}>Sign in to track this path</ButtonLink></div>}
      </Card>
      <RoadmapNext roadmap={roadmap} />
    </div>
    <h2 className="mb-3 text-xl font-semibold">Practice in this order</h2>
    <p className="mb-6 text-sm leading-7 text-muted">No enrollment or step locking. Solve or update progress on the problem page, then return here. Shared problems carry the same progress in every path.</p>
    <RoadmapSteps roadmap={roadmap} />
  </AppShell>;
}
```

### `src/app/roadmaps/page.tsx`

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeading } from "@/components/ui/page-heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RoadmapProgress } from "@/components/roadmaps/roadmap-content";
import { loadRoadmaps, roadmapPage } from "@/features/roadmaps/load";

export const metadata: Metadata = { title: "Learning roadmaps", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const pageHref = (page: number) => page > 1 ? `/roadmaps?page=${page}` : "/roadmaps";

export default async function RoadmapsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const page = roadmapPage((await searchParams).page);
  const view = await loadRoadmaps(page);
  if (view.kind === "ready" && view.result.page !== page) redirect(pageHref(view.result.page));
  return <AppShell signedIn={view.signedIn} admin={view.admin}>
    <PageHeading eyebrow="Build on what you learn" title="Learning roadmaps" description="Short, original paths through related problems. Follow the suggested order or revisit any step." />
    {view.kind === "unavailable" ? <EmptyState title="Roadmaps are being prepared" description="Learning paths will appear when the collection is available." /> : !view.result.items.length ?
      <EmptyState title="No roadmaps available yet" description="A path appears here when it and every linked problem are published." action={<ButtonLink href="/problems">Browse problems</ButtonLink>} /> : <>
        {!view.signedIn && <p className="mb-6 text-sm leading-7 text-muted"><Link href={`/login?next=${encodeURIComponent(pageHref(page))}`} className="font-semibold text-accent underline underline-offset-4">Sign in</Link> for personal progress and a suggested next step.</p>}
        <ul aria-label="Learning roadmaps" className="grid gap-6 xl:grid-cols-2">
          {view.result.items.map((roadmap) => <li key={roadmap.slug} className="min-w-0"><Card className="h-full">
            <div className="flex flex-wrap items-center gap-3"><Badge>{roadmap.difficulty}</Badge><span className="text-xs text-muted">{roadmap.steps.length} steps · About {roadmap.estimatedMinutes} minutes</span></div>
            <h2 className="mt-4 text-xl font-semibold [overflow-wrap:anywhere]"><Link href={`/roadmaps/${roadmap.slug}`} className="text-accent hover:underline">{roadmap.title}</Link></h2>
            <p className="mt-3 text-sm leading-7 text-muted">{roadmap.description}</p>
            <RoadmapProgress roadmap={roadmap} />
            <div className="mt-5"><ButtonLink href={`/roadmaps/${roadmap.slug}`} variant="secondary">Open roadmap</ButtonLink></div>
          </Card></li>)}
        </ul>
        {view.result.pages > 1 && <nav aria-label="Roadmap pages" className="mt-8 flex flex-wrap items-center gap-4">
          {page > 1 && <ButtonLink href={pageHref(page - 1)} variant="secondary">Previous page</ButtonLink>}
          <p className="text-sm text-muted">Page {page} of {view.result.pages}</p>
          {page < view.result.pages && <ButtonLink href={pageHref(page + 1)} variant="secondary">Next page</ButtonLink>}
        </nav>}
        <p className="mt-8 text-sm leading-7 text-muted">Time estimates are planning guides, not deadlines. Progress is shared with each problem wherever it appears; totals across paths can overlap.</p>
      </>}
  </AppShell>;
}
```

### `src/components/layout/workspace-nav.tsx`

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UserRound, ShieldCheck, BookOpen, Route } from "lucide-react";
import { cn } from "@/lib/utils";
const links = [ { href: "/roadmaps", label: "Roadmaps", icon: Route }, { href: "/problems", label: "Problems", icon: BookOpen }, { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, { href: "/progress", label: "Progress", icon: BookOpen }, { href: "/notes", label: "Notes", icon: BookOpen }, { href: "/bookmarks", label: "Bookmarks", icon: BookOpen }, { href: "/review", label: "Review later", icon: BookOpen }, { href: "/profile", label: "Profile", icon: UserRound } ];
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

### `src/components/roadmaps/roadmap-content.tsx`

```tsx
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { progressLabel } from "@/features/progress/presentation";
import type { RoadmapView } from "@/features/roadmaps/query";

export function RoadmapProgress({ roadmap }: { roadmap: RoadmapView }) {
  const progress = roadmap.progress;
  if (!progress) return <p className="mt-4 text-sm leading-7 text-muted">Sign in to see your progress. Browsing a step does not mark it solved.</p>;
  return <div className="mt-4 space-y-3">
    <p className="font-semibold">{progress.solved} / {progress.total} steps recorded solved · {progress.percent}%</p>
    <progress aria-label={`${roadmap.title}: steps recorded solved`} value={progress.solved} max={Math.max(1, progress.total)} className="h-3 w-full accent-accent" />
    <p className="text-sm leading-7 text-muted">{progress.selfMarked} self-marked, {progress.verifiedCurrent} verified on current revisions, {progress.verifiedEarlier} verified on earlier revisions, and {progress.recorded} older recorded solves. {progress.reviewLater} flagged for review.</p>
    <p className="text-xs leading-6 text-muted">Completion reflects your problem records, not mastery. Earlier verification and manual marks count toward completion.</p>
  </div>;
}

export function RoadmapNext({ roadmap }: { roadmap: RoadmapView }) {
  const next = roadmap.next;
  return <Card>
    <CardTitle>Suggested next step</CardTitle>
    {next ? <div className="mt-4 space-y-4">
      <p className="text-sm leading-7 text-muted">{next.reason}</p>
      <ButtonLink href={`/problems/${next.slug}`}>Step {next.position}: {next.title}</ButtonLink>
    </div> : <p className="mt-4 text-sm leading-7 text-muted">All steps are recorded solved, with no review flags or earlier-revision verification to revisit. You can repeat any step below.</p>}
  </Card>;
}

export function RoadmapSteps({ roadmap }: { roadmap: RoadmapView }) {
  return <ol aria-label="Ordered roadmap steps" className="space-y-5">
    {roadmap.steps.map((step) => <li key={step.position}>
      <Card>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Step {step.position}</p>
        <h3 className="mt-3 text-lg font-semibold [overflow-wrap:anywhere]">{step.title}</h3>
        {step.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted">{step.description}</p>}
        <Link href={`/problems/${step.problem.slug}`} className="mt-4 inline-block font-semibold text-accent underline underline-offset-4 [overflow-wrap:anywhere]">{step.problem.title}</Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge>{step.problem.difficulty}</Badge><span className="text-xs text-muted">About {step.problem.estimatedMinutes} minutes</span>
          {step.progress && <><Badge tone="accent">{progressLabel(step.progress)}</Badge>{step.progress.reviewLater && <Badge tone="warm">Review later</Badge>}</>}
        </div>
      </Card>
    </li>)}
  </ol>;
}
```

### `src/data/seeds/roadmaps.ts`

```typescript
import type { RoadmapSeed } from "../../lib/validators/roadmap";

// Original short paths through the reviewed collection, not a complete DSA curriculum.
export const ROADMAPS = [
  {
    slug: "scan-store-reuse", title: "Scan, Store, Reuse", difficulty: "MEDIUM", estimatedMinutes: 75,
    description: "Turn repeated scans into reusable information. Start with counting, keep a running window, then prepare totals for many questions. Allow extra time to trace examples and explain each tradeoff.",
    steps: [
      { problemSlug: "quiet-badge", title: "Count before choosing", description: "Record letter frequencies, then preserve arrival order when choosing an answer. Explain why seeing a letter once so far is not enough." },
      { problemSlug: "relay-window", title: "Update instead of recounting", description: "Carry one window total forward by removing the outgoing load and adding the incoming one. Trace an all-negative example." },
      { problemSlug: "parcel-checkpoints", title: "Prepare totals for later questions", description: "Build cumulative totals once and subtract two checkpoints for each range. Connect this preprocessing tradeoff to the state reused in the previous steps." },
    ],
  },
  {
    slug: "boundaries-to-decisions", title: "Boundaries to Decisions", difficulty: "MEDIUM", estimatedMinutes: 65,
    description: "Practice stating what a search or recurrence means before coding it. This short path moves from a sorted boundary to the cheapest sequence of decisions; it is not a full search or dynamic programming course.",
    steps: [
      { problemSlug: "dock-threshold", title: "Keep the earliest valid boundary", description: "Use sorted capacities to narrow the first qualifying dock. State the search interval invariant and trace duplicates and an empty list." },
      { problemSlug: "lantern-steps", title: "Define the cost of reaching a state", description: "Write the meaning and base cases of each stored cost before the recurrence. Carry forward the habit of checking boundaries, then compare a table with rolling state." },
    ],
  },
] satisfies RoadmapSeed[];
```

### `src/features/problems/detail-actions.ts`

```typescript
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
  revalidatePath("/roadmaps"); revalidatePath("/roadmaps/[slug]", "page");
  if (input.data.operation === "delete-note") return { success: true, message: "Note deleted.", savedContent: "" };
  if (input.data.operation === "save-note") return { success: true, message: input.data.content ? "Note saved." : "Note cleared.", savedContent: input.data.content };
  return { success: true, message: input.data.operation === "set-bookmark" ? "Bookmark updated." : "Progress updated." };
}
```

### `src/features/roadmaps/load.ts`

```typescript
import "server-only";
import { getViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { roadmapSlug } from "@/lib/validators/roadmap";
import { queryRoadmap, queryRoadmaps } from "./query";

export function roadmapPage(value: string | string[] | undefined) {
  return typeof value === "string" && /^[1-9][0-9]{0,5}$/.test(value) ? Number(value) : 1;
}
export async function loadRoadmaps(page: number) {
  if (!process.env.DATABASE_URL) return { kind: "unavailable" as const, signedIn: false, admin: false };
  const viewer = await getViewer();
  return { kind: "ready" as const, signedIn: Boolean(viewer), admin: viewer?.role === "ADMIN", result: await queryRoadmaps(getDatabase(), viewer?.id ?? null, page) };
}
export async function loadRoadmap(slug: string) {
  if (!roadmapSlug.safeParse(slug).success) return { kind: "not-found" as const };
  if (!process.env.DATABASE_URL) return { kind: "unavailable" as const };
  const viewer = await getViewer();
  const roadmap = await queryRoadmap(getDatabase(), viewer?.id ?? null, slug);
  if (!roadmap) return { kind: "not-found" as const };
  return { kind: "ready" as const, signedIn: Boolean(viewer), admin: viewer?.role === "ADMIN", roadmap };
}
```

### `src/features/roadmaps/policy.ts`

```typescript
import type { ProgressView } from "@/features/progress/presentation";

export type RoadmapStepView = {
  position: number; title: string; description: string | null;
  problem: { slug: string; title: string; difficulty: "EASY" | "MEDIUM" | "HARD"; estimatedMinutes: number };
  progress: ProgressView | null;
};

export function roadmapProgress(steps: RoadmapStepView[], signedIn: boolean) {
  if (!signedIn) return null;
  const solved = steps.filter((s) => s.progress?.status === "SOLVED");
  return {
    total: steps.length, solved: solved.length,
    percent: steps.length ? Math.round(solved.length / steps.length * 100) : 0,
    selfMarked: solved.filter((s) => s.progress?.selfMarked).length,
    verifiedCurrent: solved.filter((s) => s.progress?.verification === "current").length,
    verifiedEarlier: solved.filter((s) => s.progress?.verification === "earlier").length,
    recorded: solved.filter((s) => !s.progress?.selfMarked && !s.progress?.verification).length,
    reviewLater: steps.filter((s) => s.progress?.reviewLater).length,
  };
}

// Query supplies position-ordered steps. Suggestions never write or verify progress.
export function recommendStep(steps: RoadmapStepView[], signedIn: boolean) {
  if (!steps.length) return null;
  if (!signedIn) return { position: steps[0].position, slug: steps[0].problem.slug, title: steps[0].problem.title, reason: "Start with the first step. Sign in for a personal suggestion." };
  const incomplete = steps.find((s) => s.progress?.status !== "SOLVED");
  const review = steps.find((s) => s.progress?.reviewLater);
  const earlier = steps.find((s) => s.progress?.verification === "earlier");
  const next = incomplete ?? review ?? earlier;
  if (!next) return null;
  return { position: next.position, slug: next.problem.slug, title: next.problem.title,
    reason: incomplete ? "Your first unsolved step in this path." : review ? "All steps are recorded solved. Revisit your first review flag." : "All steps are recorded solved. Recheck the first problem verified on an earlier revision." };
}
```

### `src/features/roadmaps/query.ts`

```typescript
import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { progressView } from "@/features/progress/presentation";
import { recommendStep, roadmapProgress } from "./policy";

// Keep a complete path: no partial denominators or unpublished step metadata.
const available = {
  status: "PUBLISHED", steps: { some: {}, none: { problem: { status: { not: "PUBLISHED" } } } },
} satisfies Prisma.RoadmapWhereInput;

async function readRoadmaps(tx: Prisma.TransactionClient, viewerId: string | null, where: Prisma.RoadmapWhereInput, page?: number) {
  const rows = await tx.roadmap.findMany({ where, orderBy: [{ title: "asc" }, { slug: "asc" }],
    ...(page === undefined ? {} : { skip: (page - 1) * 12, take: 12 }),
    select: { slug: true, title: true, description: true, difficulty: true, estimatedMinutes: true,
      steps: { orderBy: { position: "asc" }, select: { position: true, title: true, description: true,
        problem: { select: { slug: true, title: true, difficulty: true, estimatedMinutes: true, revision: true,
          // A false predicate prevents all personal reads for guests.
          progress: { where: viewerId ? { userId: viewerId } : { OR: [] }, select: { status: true, selfMarked: true, reviewLater: true, verifiedRevision: true } },
        } },
      } },
    },
  });
  return rows.map(({ steps: rows, ...roadmap }) => {
    const steps = rows.map(({ problem: { progress, revision, ...problem }, ...step }) => ({ ...step, problem, progress: viewerId ? progressView(progress[0], revision) : null }));
    return { ...roadmap, steps, progress: roadmapProgress(steps, Boolean(viewerId)), next: recommendStep(steps, Boolean(viewerId)) };
  });
}

export async function queryRoadmaps(db: PrismaClient, viewerId: string | null, requestedPage = 1) {
  return db.$transaction(async (tx) => {
    const total = await tx.roadmap.count({ where: available });
    const pages = Math.max(1, Math.ceil(total / 12));
    const page = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), pages);
    const items = await readRoadmaps(tx, viewerId, available, page);
    return { items, total, pages, page };
  }, { isolationLevel: "RepeatableRead" });
}

export async function queryRoadmap(db: PrismaClient, viewerId: string | null, slug: string) {
  return db.$transaction(async (tx) => (await readRoadmaps(tx, viewerId, { ...available, slug }))[0] ?? null, { isolationLevel: "RepeatableRead" });
}
export type RoadmapView = NonNullable<Awaited<ReturnType<typeof queryRoadmap>>>;
```

### `src/features/submissions/actions.ts`

```typescript
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
      revalidatePath("/roadmaps"); revalidatePath("/roadmaps/[slug]", "page");
    }
    return outcome;
  } catch {
    return { success: false, message: "Could not finish saving the execution result. Your draft is unchanged. A retry creates a new attempt." };
  }
}
```

### `src/lib/validators/roadmap.ts`

```typescript
import { z } from "zod";

export const roadmapSlug = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const text = (max: number) => z.string().trim().min(1).max(max).refine((value) => !value.includes("\u0000"));
export const roadmapBatchSchema = z.array(z.object({
  slug: roadmapSlug, title: text(160), description: text(5000),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]), estimatedMinutes: z.number().int().min(1).max(100000),
  steps: z.array(z.object({ problemSlug: roadmapSlug, title: text(160), description: text(2000) }).strict()).min(1).max(100),
}).strict()).min(1).max(100).superRefine((roadmaps, ctx) => {
  const slugs = new Set<string>();
  for (const [i, roadmap] of roadmaps.entries()) {
    if (slugs.has(roadmap.slug)) ctx.addIssue({ code: "custom", message: "Duplicate roadmap slug", path: [i, "slug"] });
    slugs.add(roadmap.slug);
    const problems = new Set<string>();
    for (const [j, step] of roadmap.steps.entries()) {
      if (problems.has(step.problemSlug)) ctx.addIssue({ code: "custom", message: "Duplicate roadmap problem", path: [i, "steps", j] });
      problems.add(step.problemSlug);
    }
  }
});
export type RoadmapSeed = z.infer<typeof roadmapBatchSchema>[number];

export function validateRoadmapReferences(input: unknown, publishedSlugs: ReadonlySet<string>) {
  const roadmaps = roadmapBatchSchema.parse(input);
  for (const roadmap of roadmaps) for (const step of roadmap.steps) {
    if (!publishedSlugs.has(step.problemSlug)) throw new Error(`Roadmap ${roadmap.slug} requires published problem ${step.problemSlug}.`);
  }
  return roadmaps;
}
```

### `tests/integration/roadmaps.test.ts`

```typescript
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { queryRoadmap, queryRoadmaps } from "@/features/roadmaps/query";
import { writeProblemChange } from "@/features/problems/detail-write";
import { ROADMAPS } from "@/data/seeds/roadmaps";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import { seedRoadmaps } from "../../prisma/seed-roadmaps";

let db: ReturnType<typeof createDatabaseClient>; let owns = false; let slugs: string[] = [];
const users = [randomUUID(), randomUUID()]; const at = new Date("2026-01-01T00:00:00Z");
const mainSlug = ROADMAPS[0].slug; const seedSlugs = ROADMAPS.map((r) => r.slug);
const fixturePrefix = `roadmap-${randomUUID()}`;
const ownedRoadmaps = () => ({ OR: [{ slug: { in: seedSlugs } }, { slug: { startsWith: fixturePrefix } }] });
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use an empty disposable TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count() || await db.roadmap.count()) throw new Error("Roadmap tests require an empty collection.");
  const seeds = await loadProblems(); slugs = seeds.map((p) => p.slug); owns = true;
  await seedProblems(db, seeds); await db.user.createMany({ data: users.map((id, i) => ({ id, role: i === 1 ? "ADMIN" as const : "USER" as const })) });
}, 30000);
beforeEach(async () => {
  await db.roadmap.deleteMany({ where: ownedRoadmaps() });
  await db.userProgress.deleteMany({ where: { userId: { in: users } } });
  await db.userNote.deleteMany({ where: { userId: { in: users } } });
  await db.problem.updateMany({ where: { slug: { in: slugs } }, data: { status: "PUBLISHED", revision: 1 } });
  await seedRoadmaps(db, ROADMAPS);
});
afterAll(async () => {
  if (db && owns) {
    await db.roadmap.deleteMany({ where: ownedRoadmaps() });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.problem.deleteMany({ where: { slug: { in: slugs } } });
  }
  await db?.$disconnect();
});
it("returns ordered public paths with no guest personal data or hidden projections", async () => {
  await writeProblemChange(db, users[0], { slug: "quiet-badge", operation: "mark-solved" });
  await writeProblemChange(db, users[0], { slug: "quiet-badge", operation: "save-note", content: "PRIVATE-ROADMAP-NOTE", expectedContent: "" });
  const result = await queryRoadmap(db, null, mainSlug);
  expect(result?.steps.map((s) => s.problem.slug)).toEqual(ROADMAPS[0].steps.map((s) => s.problemSlug));
  expect(result?.steps.map((s) => s.position)).toEqual([1, 2, 3]); expect(result?.progress).toBeNull(); expect(result?.steps.every((s) => s.progress === null)).toBe(true);
  expect(result?.next?.position).toBe(1);
  for (const secret of ["PRIVATE-ROADMAP-NOTE", users[0], "userId", "problemId", "seedHash", "testCases", "statement", "solutions", "starterCode", "sourceCode"]) expect(JSON.stringify(result)).not.toContain(secret);
});
it("isolates owners and administrators; reflects problem changes in every shared path", async () => {
  await seedRoadmaps(db, [{ ...ROADMAPS[0], slug: `${fixturePrefix}-shared` }]);
  await writeProblemChange(db, users[0], { slug: "quiet-badge", operation: "mark-solved" });
  for (const slug of [mainSlug, `${fixturePrefix}-shared`]) {
    expect((await queryRoadmap(db, users[0], slug))?.progress).toMatchObject({ solved: 1, selfMarked: 1, percent: 33 });
    expect((await queryRoadmap(db, users[1], slug))?.progress?.solved).toBe(0);
  }
  await writeProblemChange(db, users[0], { slug: "quiet-badge", operation: "clear-solved" });
  expect((await queryRoadmap(db, users[0], mainSlug))?.progress?.solved).toBe(0);
});
it("distinguishes manual and current/earlier verified progress; browsing writes nothing", async () => {
  const problems = await db.problem.findMany({ where: { slug: { in: ROADMAPS[0].steps.map((s) => s.problemSlug) } } });
  for (const p of problems) await db.userProgress.create({ data: { userId: users[0], problemId: p.id, status: "SOLVED", solvedAt: at,
    selfMarked: p.slug === "quiet-badge", verifiedRevision: p.slug === "quiet-badge" ? null : 1, verifiedAt: p.slug === "quiet-badge" ? null : at } });
  await db.problem.update({ where: { slug: "parcel-checkpoints" }, data: { revision: 2 } });
  const before = await db.userProgress.findMany({ where: { userId: users[0] }, orderBy: { problemId: "asc" } });
  const result = await queryRoadmap(db, users[0], mainSlug);
  expect(result?.progress).toMatchObject({ solved: 3, total: 3, percent: 100, selfMarked: 1, verifiedCurrent: 1, verifiedEarlier: 1 });
  expect(result?.next?.slug).toBe("parcel-checkpoints");
  expect(await db.userProgress.findMany({ where: { userId: users[0] }, orderBy: { problemId: "asc" } })).toEqual(before);
  await writeProblemChange(db, users[0], { slug: "quiet-badge", operation: "set-review", review: "true" });
  expect((await queryRoadmap(db, users[0], mainSlug))?.next?.slug).toBe("quiet-badge");
});
it("hides drafts, archived and empty paths and paths with any unavailable problem", async () => {
  for (const status of ["DRAFT", "ARCHIVED"] as const) {
    await db.roadmap.update({ where: { slug: mainSlug }, data: { status } });
    expect(await queryRoadmap(db, users[0], mainSlug)).toBeNull(); expect((await queryRoadmaps(db, null)).total).toBe(1);
  }
  await db.roadmap.update({ where: { slug: mainSlug }, data: { status: "PUBLISHED" } });
  for (const status of ["DRAFT", "ARCHIVED"] as const) {
    await db.problem.update({ where: { slug: "relay-window" }, data: { status } });
    expect(await queryRoadmap(db, null, mainSlug)).toBeNull(); expect((await queryRoadmaps(db, null)).total).toBe(1);
  }
  await db.roadmap.create({ data: { slug: `${fixturePrefix}-empty`, title: "Empty private sentinel", description: "Private", difficulty: "EASY", estimatedMinutes: 1, status: "PUBLISHED" } });
  expect(await queryRoadmap(db, null, `${fixturePrefix}-empty`)).toBeNull();
  expect(await queryRoadmap(db, null, "does-not-exist")).toBeNull();
});
it("paginates deterministically with tied titles and clamps requests", async () => {
  await seedRoadmaps(db, Array.from({ length: 13 }, (_, i) => ({ ...ROADMAPS[0], title: "AAA tied title", slug: `${fixturePrefix}-${String(i).padStart(2, "0")}` })));
  const first = await queryRoadmaps(db, null, 1); const last = await queryRoadmaps(db, null, 999999);
  expect(first).toMatchObject({ total: 15, pages: 2, page: 1 }); expect(first.items).toHaveLength(12); expect(last.items).toHaveLength(3); expect(last.page).toBe(2);
  expect(new Set([...first.items, ...last.items].map((r) => r.slug)).size).toBe(15);
  expect(first.items.map((r) => r.slug)).toEqual(Array.from({ length: 12 }, (_, i) => `${fixturePrefix}-${String(i).padStart(2, "0")}`));
});
it("reruns and concurrent seed calls preserve roadmap/step IDs and user progress", async () => {
  const read = () => db.roadmap.findMany({ orderBy: { slug: "asc" }, include: { steps: { orderBy: { position: "asc" } } } });
  const before = await read(); await writeProblemChange(db, users[0], { slug: "quiet-badge", operation: "mark-solved" });
  expect(await seedRoadmaps(db, ROADMAPS)).toEqual({ created: 0, skipped: 2 });
  const extra = [{ ...ROADMAPS[0], slug: `${fixturePrefix}-concurrent` }];
  const results = await Promise.all([seedRoadmaps(db, extra), seedRoadmaps(db, extra)]);
  expect(results.map((r) => r.created).sort()).toEqual([0, 1]);
  expect((await read()).filter((r) => seedSlugs.includes(r.slug))).toEqual(before);
  expect((await queryRoadmap(db, users[0], mainSlug))?.progress?.solved).toBe(1);
});
it("rolls back the entire roadmap batch on content conflict or unpublished references", async () => {
  const extra = { ...ROADMAPS[0], slug: `${fixturePrefix}-rollback` };
  await expect(seedRoadmaps(db, [extra, { ...ROADMAPS[0], title: "Changed" }])).rejects.toThrow(/Roadmap seed conflict/);
  expect(await db.roadmap.count()).toBe(2);
  await db.problem.update({ where: { slug: "quiet-badge" }, data: { status: "ARCHIVED" } });
  await expect(seedRoadmaps(db, [extra])).rejects.toThrow(/requires published problem/);
  expect(await db.roadmap.count()).toBe(2);
  await db.problem.update({ where: { slug: "quiet-badge" }, data: { status: "PUBLISHED" } });
  await db.roadmap.update({ where: { slug: mainSlug }, data: { status: "ARCHIVED" } });
  await expect(seedRoadmaps(db, ROADMAPS)).rejects.toThrow(/Roadmap seed conflict/);
  expect((await db.roadmap.findUniqueOrThrow({ where: { slug: mainSlug } })).status).toBe("ARCHIVED");
});
```

### `tests/problem-detail-boundary.test.ts`

```typescript
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
    expect(mocks.revalidate.mock.calls).toEqual([["/problems/relay-window"], ["/problems"], ["/progress"], ["/dashboard"], ["/notes"], ["/bookmarks"], ["/review"], ["/roadmaps"], ["/roadmaps/[slug]", "page"]]);
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

### `tests/roadmap-content.test.ts`

```typescript
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RoadmapNext, RoadmapProgress, RoadmapSteps } from "@/components/roadmaps/roadmap-content";
import type { RoadmapView } from "@/features/roadmaps/query";
import { roadmapProgress, recommendStep } from "@/features/roadmaps/policy";
import { progressView } from "@/features/progress/presentation";
const fixture = (): RoadmapView => ({ slug: "sample", title: "Original <script>path</script>", description: "Learn", difficulty: "EASY", estimatedMinutes: 10,
  steps: [{ position: 1, title: "Try <script>this</script>", description: "Compare", problem: { slug: "quiet-badge", title: "Quiet Badge", difficulty: "EASY", estimatedMinutes: 15 }, progress: null }], progress: null, next: null });
it("renders guest guidance without fabricated zero progress", () => {
  const roadmap = fixture(); roadmap.next = recommendStep(roadmap.steps, false);
  const html = renderToStaticMarkup(createElement(RoadmapProgress, { roadmap }));
  expect(html).toContain("Sign in"); expect(html).not.toContain("0%");
  expect(renderToStaticMarkup(createElement(RoadmapNext, { roadmap }))).toContain('href="/problems/quiet-badge"');
});
it("uses ordered semantic steps, real links, textual status and escaped content", () => {
  const roadmap = fixture(); roadmap.steps[0].progress = progressView({ status: "SOLVED", selfMarked: false, reviewLater: true, verifiedRevision: 1 }, 2);
  roadmap.progress = roadmapProgress(roadmap.steps, true);
  const html = renderToStaticMarkup(createElement(RoadmapSteps, { roadmap }));
  for (const value of ["<ol", "Step 1", "Solved · verified on an earlier revision", "Review later", "&lt;script&gt;", 'href="/problems/quiet-badge"']) expect(html).toContain(value);
  expect(html).not.toContain("<script>");
  const summary = renderToStaticMarkup(createElement(RoadmapProgress, { roadmap }));
  for (const value of ["1 / 1", "100%", "1 verified on earlier revisions", "<progress", "aria-label=", "not mastery"]) expect(summary).toContain(value);
});
it("describes all-solved as recorded progress, without claiming mastery or execution", () => {
  const html = renderToStaticMarkup(createElement(RoadmapNext, { roadmap: fixture() }));
  expect(html).toContain("All steps are recorded solved"); expect(html).toContain("repeat any step"); expect(html).not.toContain("mastered");
});
```

### `tests/roadmap-load.test.ts`

```typescript
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ viewer: vi.fn(), db: vi.fn(), list: vi.fn(), detail: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ getViewer: m.viewer }));
vi.mock("@/lib/prisma", () => ({ getDatabase: m.db }));
vi.mock("@/features/roadmaps/query", () => ({ queryRoadmaps: m.list, queryRoadmap: m.detail }));
import { loadRoadmaps, loadRoadmap, roadmapPage } from "@/features/roadmaps/load";
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("DATABASE_URL", "postgresql://localhost/algosprint_test"); m.viewer.mockResolvedValue(null); m.db.mockReturnValue("trusted-db"); m.list.mockResolvedValue({ items: [] }); m.detail.mockResolvedValue({ slug: "scan-store-reuse" }); });
afterEach(() => vi.unstubAllEnvs());
it("handles missing configuration and malformed slugs without reading identity or data", async () => {
  for (const slug of ["INVALID", "../private", "x".repeat(101)]) expect(await loadRoadmap(slug)).toEqual({ kind: "not-found" });
  vi.stubEnv("DATABASE_URL", ""); expect((await loadRoadmaps(1)).kind).toBe("unavailable"); expect((await loadRoadmap("scan-store-reuse")).kind).toBe("unavailable");
  expect(m.viewer).not.toHaveBeenCalled(); expect(m.db).not.toHaveBeenCalled();
});
it("allows guests and passes only the verified identity, including for admins", async () => {
  expect(await loadRoadmaps(2)).toMatchObject({ kind: "ready", signedIn: false }); expect(m.list).toHaveBeenCalledWith("trusted-db", null, 2);
  m.viewer.mockResolvedValue({ id: "verified-owner", role: "ADMIN" });
  expect(await loadRoadmap("scan-store-reuse")).toMatchObject({ kind: "ready", signedIn: true, admin: true });
  expect(m.detail).toHaveBeenCalledWith("trusted-db", "verified-owner", "scan-store-reuse");
  await loadRoadmaps(1); expect(m.list).toHaveBeenLastCalledWith("trusted-db", "verified-owner", 1);
});
it("returns not-found for unavailable paths and propagates identity/database errors", async () => {
  m.detail.mockResolvedValue(null); expect(await loadRoadmap("missing")).toEqual({ kind: "not-found" });
  m.viewer.mockRejectedValue(new Error("identity unavailable")); m.detail.mockClear();
  await expect(loadRoadmap("scan-store-reuse")).rejects.toThrow("identity unavailable"); expect(m.detail).not.toHaveBeenCalled();
  m.viewer.mockResolvedValue(null); m.list.mockRejectedValue(new Error("database unavailable"));
  await expect(loadRoadmaps(1)).rejects.toThrow("database unavailable");
});
it("bounds page inputs without coercing arrays, fractions or oversized numbers", () => {
  for (const value of [undefined, ["2"], "0", "-1", "2.5", "Infinity", "1000000"]) expect(roadmapPage(value)).toBe(1);
  expect(roadmapPage("2")).toBe(2);
});
```

### `tests/roadmap-policy.test.ts`

```typescript
import { expect, it } from "vitest";
import { roadmapProgress, recommendStep, type RoadmapStepView } from "@/features/roadmaps/policy";
import { progressView } from "@/features/progress/presentation";
const steps = (): RoadmapStepView[] => [1, 2, 3, 4].map((position) => ({ position, title: `Step ${position}`, description: null,
  problem: { slug: `problem-${position}`, title: `Problem ${position}`, difficulty: "EASY", estimatedMinutes: 10 }, progress: progressView(null, 1) }));
it("guests have no fabricated progress; empty collections avoid invalid percentages", () => {
  expect(roadmapProgress(steps(), false)).toBeNull();
  expect(recommendStep(steps(), false)).toMatchObject({ position: 1, reason: expect.stringContaining("Sign in") });
  expect(roadmapProgress([], true)).toMatchObject({ total: 0, solved: 0, percent: 0 }); expect(recommendStep([], true)).toBeNull();
});
it("retains manual, current, earlier and legacy solves with exact denominators", () => {
  const rows = steps();
  rows[0].progress = progressView({ status: "SOLVED", selfMarked: true, reviewLater: true, verifiedRevision: null }, 2);
  rows[1].progress = progressView({ status: "SOLVED", selfMarked: false, reviewLater: false, verifiedRevision: 2 }, 2);
  rows[2].progress = progressView({ status: "SOLVED", selfMarked: false, reviewLater: false, verifiedRevision: 1 }, 2);
  rows[3].progress = progressView({ status: "SOLVED", selfMarked: false, reviewLater: false, verifiedRevision: null }, 2);
  expect(roadmapProgress(rows, true)).toEqual({ total: 4, solved: 4, percent: 100, selfMarked: 1, verifiedCurrent: 1, verifiedEarlier: 1, recorded: 1, reviewLater: 1 });
});
it("prioritizes first incomplete step, then review, then earlier verification", () => {
  const rows = steps();
  for (const row of rows) row.progress = progressView({ status: "SOLVED", selfMarked: true, reviewLater: false, verifiedRevision: null }, 1);
  rows[0].progress = progressView({ status: "SOLVED", selfMarked: false, reviewLater: false, verifiedRevision: 1 }, 2);
  rows[1].progress!.reviewLater = true;
  rows[3].progress!.status = "ATTEMPTED";
  expect(recommendStep(rows, true)?.position).toBe(4);
  rows[3].progress!.status = "SOLVED";
  expect(recommendStep(rows, true)).toMatchObject({ position: 2, reason: expect.stringContaining("review flag") });
  rows[1].progress!.reviewLater = false;
  expect(recommendStep(rows, true)).toMatchObject({ position: 1, reason: expect.stringContaining("earlier revision") });
  rows[0].progress!.verification = "current";
  expect(recommendStep(rows, true)).toBeNull();
});
```

### `tests/roadmap-seeds.test.ts`

```typescript
import { expect, it } from "vitest";
import { ROADMAPS } from "@/data/seeds/roadmaps";
import { roadmapBatchSchema, validateRoadmapReferences } from "@/lib/validators/roadmap";
import { loadProblems } from "../scripts/lib/load-problems";
it("validates original paths against all five published reviewed problems", async () => {
  const problems = await loadProblems();
  expect(validateRoadmapReferences(ROADMAPS, new Set(problems.filter((p) => p.status === "PUBLISHED").map((p) => p.slug)))).toHaveLength(2);
  expect(new Set(ROADMAPS.flatMap((r) => r.steps.map((s) => s.problemSlug))).size).toBe(5);
});
it("rejects duplicate slugs, repeated steps, empty paths and invalid estimates before seeding", () => {
  for (const input of [[ROADMAPS[0], ROADMAPS[0]], [{ ...ROADMAPS[0], steps: [ROADMAPS[0].steps[0], ROADMAPS[0].steps[0]] }], [{ ...ROADMAPS[0], steps: [] }], [{ ...ROADMAPS[0], estimatedMinutes: 0 }], [{ ...ROADMAPS[0], slug: "../private" }]]) expect(roadmapBatchSchema.safeParse(input).success).toBe(false);
  expect(() => validateRoadmapReferences(ROADMAPS, new Set(["quiet-badge"]))).toThrow(/requires published problem/);
});
```

### `tests/runner-actions.test.ts`

```typescript
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
  expect(f.revalidate.mock.calls).toEqual([["/problems/relay-window"], ["/problems"], ["/progress"], ["/dashboard"], ["/notes"], ["/bookmarks"], ["/review"], ["/roadmaps"], ["/roadmaps/[slug]", "page"]]);
  f.run.mockRejectedValue(new Error("database password")); expect(await executeCode(input)).toMatchObject({ success: false });
  expect(JSON.stringify(await executeCode(input))).not.toContain("password");
});
```
