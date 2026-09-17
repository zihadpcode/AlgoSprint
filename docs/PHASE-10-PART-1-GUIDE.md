> **Historical halfway snapshot, superseded on 2026-09-17.** The user resumed and Phase 10 is now implemented in PR #11. Use [PHASE-10-GUIDE.md](PHASE-10-GUIDE.md) and [SESSION-HANDOFF.md](SESSION-HANDOFF.md) for current source/status. The stop instructions and partial source below apply only to the earlier checkpoint.

# Phase 10, Part 1 — Dashboard foundation

## 🟦 Halfway scope and stop point

The user requested: “continue and pause at half.” This is the first of two planned Phase 10 milestones, an approximate scope boundary rather than a measured percentage of implementation time. Phase 9 is merged; this partial Phase 10 checkpoint is saved on `algosprint/phase-10-dashboard-part-1` in a draft PR. **Leave it unmerged and pause here until the user resumes.**

| First milestone — built here | Second milestone — still unbuilt |
| --- | --- |
| Authenticated dashboard data loader | Weak-topic analysis with an explicit evidence rule |
| Six live summary cards | Recommended problems with explainable selection |
| Solved-by-difficulty chart | Recent-submissions section on the dashboard |
| Solved-by-category chart | Streak implementation or a clearly labeled placeholder |
| Empty states, accessible numeric labels, tests and this guide | Integration of those sections, verification and the complete Phase 10 guide |

Recent activity remains available on the existing `/progress` page through a dashboard link. This first milestone does not add it to the dashboard itself. It does not claim to measure topic mastery from collection completion.

## 🟩 What changes for a learner

The old dashboard showed introductory account/practice text. It now shows your actual published collection and saved progress: published problems, attempted, solved, verified on the current revision, self-marked solves, and review later. The greeting and profile link remain.

Below the cards, horizontal blue bars show completion by difficulty and category. Each row also has a label, exact solved/published numbers, the current verified count, and a whole-number rounded percentage. You can understand the data without distinguishing colors. The surrounding table gives screen readers row and column headers, while the decorative bars are hidden from assistive technology. The scrollable chart region can receive keyboard focus on narrow screens. No animation or chart dependency is added.

## 🟨 How the pieces connect

1. Next.js renders `src/app/dashboard/page.tsx` as a dynamic Server Component.
2. The page awaits `loadDashboard()`. It never accepts a client-supplied owner ID.
3. The server-only loader calls `requireViewer('/dashboard')` before touching the database. Guests redirect to sign in; identity-provider failures propagate to the existing error boundary.
4. `queryProgress(database, viewer.id)` reuses Phase 9's owner-scoped, Repeatable Read snapshot. It includes only currently published problems.
5. The loader selects `overall`, `difficulty`, and `categories` for the dashboard. It returns displayName and a server-derived admin flag for the shared account frame. It does not return email, owner ID or recent activity to this view.
6. `DashboardOverview` renders cards and chart tables from this data. It does not query a database, fetch a provider or execute submitted code.

The type in `contracts.ts` uses TypeScript `Pick` to reuse the existing summary's three relevant fields. This keeps their meanings and shapes aligned rather than introducing a second analytics model. The import is type-only and is removed when compiling JavaScript.

The shared query still performs its two existing, bounded ten-row recent-activity reads, although Part 1 does not display them. This avoids duplicating the established summary query during a partial phase. Part 2 can reuse relevant activity or split a common counts query if justified. No raw code, submission result JSON, tests or private notes enter the existing summary. Counts aggregate minimal rows in memory for the planned 1,000-problem collection; this is not an unlimited-scale analytics design.

## 🟨 What each number means

| Number | Meaning |
| --- | --- |
| Published problems | Currently published problems in the collection |
| Attempted | Problems with a first attemptedAt date, including manual marks and reserved executions |
| Solved | All SOLVED progress rows: manual, current verified, earlier verified and legacy recorded |
| Verified on current revision | Runner-verified solve matching the problem's current revision |
| Self-marked solves | Manual solve marks that have not been upgraded to runner verification |
| Review later | Currently published problems with reviewLater=true |

These are not mutually exclusive buckets. A solved problem may also be attempted and marked for review. A manual solve does not invent an attempt date. Earlier verified solves remain solved history but do not count as current verification. The provenance sentence explicitly lists manual, current, earlier and older recorded counts. Older recorded count is the remainder of solved after the other three disjoint solve types.

No new solve writes are introduced. Existing problem/submission actions already revalidate `/dashboard`, so this page uses their saved state. A real browser should still verify the complete edit-submit-refresh path and draft retention.

## 🟦 Chart arithmetic

For each difficulty or category:

```text
completion percentage = solved in this group / published in this group × 100
```

The text rounds to the nearest whole percent; the bar uses the original ratio. Exact counts remain visible, so rounding does not hide the denominator. For example, 1/3 is displayed as 33% solved. This is collection coverage, not a passing-test percentage or an estimate of mastery.

When a group has zero published problems, the bar has width zero and the label says “No published problems”; it does not divide by zero or display a misleading completion rate. The three difficulty rows stay in Easy, Medium, Hard order. Category rows reuse the name ordering from the shared query.

Categories overlap: a solved array/sliding-window problem contributes once to each category. Do not add the category totals to obtain the collection total. Verification is a subset of solved, so the chart shows it as an exact separate count rather than stacking it on top of solved.

## 🟩 Empty and failure states

An empty collection says “The collection is getting ready.” A published collection with no started progress says “Start your practice record.” An existing manual solve prevents a false new-user empty state even if no attempt date exists. A category list with no published entries gets its own empty message.

A failed database request is not an empty record. The loader throws and the existing application error boundary offers a retry without displaying fake zero progress or raw database errors. No database connection is opened after a guest redirect or authentication failure. An administrator sees their own progress, not everyone else's.

## 🟦 Run this checkpoint on your Mac

Use Node.js 24. In an authenticated checkout, preserve your own uncommitted changes before switching branches:

```bash
git fetch origin
git switch --track origin/algosprint/phase-10-dashboard-part-1
npm ci
```

If that local branch already exists, use `git switch algosprint/phase-10-dashboard-part-1` instead. The branch is intentionally not merged into main at this halfway pause.

Copy `.env.example` to `.env.local` only if you have not configured the project already. Keep existing settings and secrets. Follow the Phase 3 guide for Supabase project URL/publishable key, database URL and APP_URL. Confirm the account email before signing in.

This partial phase adds no schema, migration, dependency or seed content. A database coming from an older phase must still receive the existing Phase 9 migration before running the app. Check that DATABASE_URL and any DIRECT_URL refer to your intended development project; do not reset valuable data.

```bash
npm run db:deploy
npm run db:generate
npm run db:seed
npm run dev
```

Open `/dashboard`, sign in, and compare its totals to `/progress`. Judge0 is not required for manual progress and charts. Follow the Phase 8 live-provider checklist before enabling execution.

## 🟨 Verification

The local suite passed 105 unit/component/migration tests, plus lint, TypeScript, a production build and the existing unconfigured-account HTTP smoke. Eight new tests cover authenticated owner selection, administrator ownership, guest/provider failures, database failure propagation, collection/new-learner empty states, per-group denominators, solve provenance, escaping and labeled numeric chart output. A subsequent small accessibility edit makes the chart region keyboard-focusable; final branch CI verifies the published source.

GitHub CI also reruns the 33 real PostgreSQL integration tests that cover the reused summary's ownership, privacy, counts and revision behavior. Read the checkpoint PR for its exact head, CI result, and final test totals. Do not substitute a previous phase's successful CI for this branch's result.

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:smoke
```

To run `npm run test:integration`, use the existing documented disposable empty PostgreSQL database ending in `_test`, apply migrations to that database, and set TEST_DATABASE_URL. Never run integration fixture cleanup against valuable data.

## 🟥 Manual browser/account checklist — still pending

1. As a guest, visit `/dashboard` and confirm sign-in redirection. After confirmed sign-in, confirm the greeting and private counts.
2. As account A, mark one problem attempted and solved; compare dashboard and progress counts. Clear only the manual solve and check both pages again.
3. As account B, confirm A's activity is absent. Repeat with an administrator: admin status must not turn this into a global report.
4. Check empty, manual-only, current verified, earlier verified and legacy states in a disposable development fixture. A revision change should affect current verification, not erase solve history.
5. At narrow widths, keyboard focus and scroll each chart region. Test 200% zoom, long category names and a screen reader's table navigation. Confirm count and percentage labels are readable without color.
6. Where the development runner is configured and live-checked, submit a correct full solution and confirm refresh behavior. Verify the editor draft remains intact. Complete earlier Monaco worker and Supabase account checklists as well.

No live Supabase/Judge0 workflow, real browser visual QA, production migration or deployment was performed. Rendered-markup tests are not a replacement for these checks.

## 🟨 Common mistakes to avoid

- Treating all solved marks as runner verification.
- Adding current verified counts to solved totals, although they are already included.
- Summing overlapping categories or using the whole collection as every row's denominator.
- Calling low completion a weak skill without evidence; the second half must define this carefully.
- Converting an unavailable database into zero-valued cards.
- Trusting a browser-supplied user ID or giving administrators all users' analytics.
- Showing invented streaks, sample recommendations or provider success in an unfinished section.

## 🟩 Complete authored source

The six files below are all source/test changes in this partial phase. They are complete files, not patches. Shared Phase 9 queries, UI components and authentication remain in the repository and are documented in the earlier guides.

### `src/app/dashboard/page.tsx`

```tsx
import type { Metadata } from "next";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { ButtonLink } from "@/components/ui/button";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { loadDashboard } from "@/features/dashboard/load";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const { displayName, admin, analytics } = await loadDashboard();
  return <AccountFrame admin={admin}>
    <PageHeading eyebrow="Your practice space" title={`Welcome, ${displayName || "learner"}.`} description="See your saved practice progress, then choose your next challenge." action={<ButtonLink href="/profile" variant="secondary">View profile</ButtonLink>} />
    <DashboardOverview analytics={analytics} />
  </AccountFrame>;
}
```

### `src/components/dashboard/dashboard-overview.tsx`

```tsx
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import type { DashboardAnalytics } from "@/features/dashboard/contracts";
import type { ProgressCounts } from "@/features/progress/query";

const difficultyNames = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };

export function DashboardOverview({ analytics }: { analytics: DashboardAnalytics }) {
  const { overall, difficulty, categories } = analytics;
  const recorded = overall.solved - overall.manualSolved - overall.verifiedCurrent - overall.verifiedEarlier;
  return <div className="space-y-6">
    <section aria-label="Practice totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[
        { label: "Published problems", count: overall.total, detail: "The collection available to practice." },
        { label: "Attempted", count: overall.attempted, detail: "Manual attempts and reserved runs or submissions." },
        { label: "Solved", count: overall.solved, detail: "All recorded solves, including self-marked solves." },
        { label: "Verified on current revision", count: overall.verifiedCurrent, detail: "Accepted full-suite submissions for current content." },
        { label: "Self-marked solves", count: overall.manualSolved, detail: "Your own solve marks without runner verification." },
        { label: "Review later", count: overall.reviewLater, detail: "Published problems you want to revisit." },
      ].map(({ label, count, detail }) => <Card key={label}>
        <h2 className="text-sm font-medium text-muted">{label}</h2>
        <p className="mt-3 text-3xl font-semibold tabular-nums text-accent">{count}</p>
        <p className="mt-3 text-xs leading-6 text-muted">{detail}</p>
      </Card>)}
    </section>
    <p className="text-sm leading-7 text-muted">Solved includes {overall.manualSolved} self-marked, {overall.verifiedCurrent} verified on current revisions, {overall.verifiedEarlier} verified on earlier revisions, and {recorded} older recorded solves without verification metadata. Visible-only runs do not verify a solve. Counts include published problems only and can overlap.</p>
    {overall.total === 0 ? <EmptyState title="The collection is getting ready" description="Published problems will appear here when they are available. There is no practice data to summarize yet." action={<ButtonLink href="/problems">Open the library</ButtonLink>} />
      : overall.started === 0 && <EmptyState title="Start your practice record" description="Choose a problem and mark an attempt, or run your code when execution is configured. Your dashboard will reflect the saved activity." action={<ButtonLink href="/problems">Choose a problem</ButtonLink>} />}
    <Card>
      <CardTitle>Solved by difficulty</CardTitle>
      <p className="mt-3 text-sm leading-7 text-muted">Each bar shows solved problems as a share of that difficulty’s published collection. Current verified solves are a subset of solved.</p>
      <SolvedChart caption="Solved by difficulty: counts and collection completion" groupLabel="Difficulty" rows={(Object.keys(difficultyNames) as Array<keyof typeof difficultyNames>).map((key) => ({ key, label: difficultyNames[key], counts: difficulty[key] }))} />
    </Card>
    <Card>
      <CardTitle>Solved by category</CardTitle>
      <p className="mt-3 text-sm leading-7 text-muted">Each bar uses that category’s published total. A problem can belong to several categories, so category totals overlap. Completion describes coverage, not topic mastery.</p>
      {categories.length ? <SolvedChart caption="Solved by category: overlapping categories" groupLabel="Category" rows={categories.map(({ slug, name, counts }) => ({ key: slug, label: name, counts }))} />
        : <p className="mt-5 text-sm text-muted">No categories with published problems yet.</p>}
    </Card>
    <div className="flex flex-wrap gap-3"><ButtonLink href="/problems">Continue practicing</ButtonLink><ButtonLink href="/progress" variant="secondary">View progress and recent activity</ButtonLink></div>
  </div>;
}

function SolvedChart({ caption, groupLabel, rows }: {
  caption: string;
  groupLabel: string;
  rows: Array<{ key: string; label: string; counts: ProgressCounts }>;
}) {
  return <div className="mt-5 overflow-x-auto" role="region" aria-label={caption} tabIndex={0}>
    <table className="w-full text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead><tr>{[groupLabel, "Solved / published", "Verified current", "Completion"].map((label) => <th key={label} scope="col" className="border-b border-line px-3 py-3 font-semibold">{label}</th>)}</tr></thead>
      <tbody>{rows.map(({ key, label, counts }) => {
        const percent = counts.total > 0 ? counts.solved / counts.total * 100 : 0;
        return <tr key={key}>
          <th scope="row" className="max-w-64 break-words px-3 py-4 font-medium">{label}</th>
          <td className="px-3 py-4 tabular-nums">{counts.solved} / {counts.total}</td>
          <td className="px-3 py-4 tabular-nums">{counts.verifiedCurrent}</td>
          <td className="min-w-40 px-3 py-4">
            <span className="text-xs tabular-nums text-muted">{counts.total > 0 ? `${Math.round(percent)}% solved` : "No published problems"}</span>
            <div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-full border border-line bg-canvas"><div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} /></div>
          </td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
```

### `src/features/dashboard/contracts.ts`

```ts
import type { ProgressSummary } from "@/features/progress/query";

// Reuse the established meaning of solved, attempted, and current verification.
export type DashboardAnalytics = Pick<ProgressSummary, "overall" | "difficulty" | "categories">;
```

### `src/features/dashboard/load.ts`

```ts
import "server-only";
import { requireViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { queryProgress } from "@/features/progress/query";
import type { DashboardAnalytics } from "./contracts";

export async function loadDashboard() {
  const viewer = await requireViewer("/dashboard");
  const { overall, difficulty, categories } = await queryProgress(getDatabase(), viewer.id);
  const analytics: DashboardAnalytics = { overall, difficulty, categories };
  return { displayName: viewer.displayName, admin: viewer.role === "ADMIN", analytics };
}
```

### `tests/dashboard-load.test.ts`

```ts
import { beforeEach, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({ viewer: vi.fn(), db: vi.fn(), query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ requireViewer: f.viewer }));
vi.mock("@/lib/prisma", () => ({ getDatabase: f.db }));
vi.mock("@/features/progress/query", () => ({ queryProgress: f.query }));
import { loadDashboard } from "@/features/dashboard/load";

beforeEach(() => {
  vi.resetAllMocks();
  f.viewer.mockResolvedValue({ id: "verified-owner", role: "USER", displayName: "Learner", email: "private@example.test" });
  f.db.mockReturnValue("db");
  f.query.mockResolvedValue({ overall: { solved: 2 }, difficulty: {}, categories: [], recentAttempts: ["not-in-this-view"], recentProgress: [] });
});

it("uses the verified owner and returns only the dashboard projection", async () => {
  expect(await loadDashboard()).toEqual({ displayName: "Learner", admin: false, analytics: { overall: { solved: 2 }, difficulty: {}, categories: [] } });
  expect(f.viewer).toHaveBeenCalledWith("/dashboard");
  expect(f.query).toHaveBeenCalledWith("db", "verified-owner");
});

it("keeps administrator analytics scoped to that administrator's own progress", async () => {
  f.viewer.mockResolvedValue({ id: "admin-owner", role: "ADMIN", displayName: null });
  expect(await loadDashboard()).toMatchObject({ admin: true, displayName: null });
  expect(f.query).toHaveBeenCalledWith("db", "admin-owner");
});

it("does not touch the database after a guest redirect or provider failure", async () => {
  for (const message of ["guest redirect", "identity provider unavailable"]) {
    f.viewer.mockRejectedValue(new Error(message));
    await expect(loadDashboard()).rejects.toThrow(message);
    expect(f.db).not.toHaveBeenCalled();
    expect(f.query).not.toHaveBeenCalled();
  }
});

it("propagates a database failure instead of displaying fabricated zero progress", async () => {
  f.query.mockRejectedValue(new Error("database unavailable"));
  await expect(loadDashboard()).rejects.toThrow("database unavailable");
});
```

### `tests/dashboard-overview.test.ts`

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import type { DashboardAnalytics } from "@/features/dashboard/contracts";
import type { ProgressCounts } from "@/features/progress/query";

const counts = (changes: Partial<ProgressCounts> = {}): ProgressCounts => ({ total: 0, started: 0, attempted: 0, solved: 0, manualSolved: 0, verifiedCurrent: 0, verifiedEarlier: 0, reviewLater: 0, ...changes });
const empty = (): DashboardAnalytics => ({ overall: counts(), difficulty: { EASY: counts(), MEDIUM: counts(), HARD: counts() }, categories: [] });
const render = (analytics: DashboardAnalytics) => renderToStaticMarkup(createElement(DashboardOverview, { analytics }));

it("distinguishes an empty collection from a learner who has not started", () => {
  const analytics = empty();
  const noCollection = render(analytics);
  expect(noCollection).toContain("The collection is getting ready");
  expect(noCollection).toContain("No published problems");
  expect(noCollection).not.toMatch(/NaN|Infinity/);
  analytics.overall.total = 3;
  analytics.difficulty.EASY.total = 3;
  const notStarted = render(analytics);
  expect(notStarted).toContain("Start your practice record");
  expect(notStarted).toContain("0% solved");
  expect(notStarted).not.toContain("The collection is getting ready");
});

it("uses each group's own denominator and keeps zero and full completion truthful", () => {
  const analytics = empty();
  analytics.overall = counts({ total: 7, solved: 4, started: 4, manualSolved: 4 });
  analytics.difficulty.EASY = counts({ total: 3, solved: 1, started: 1, manualSolved: 1 });
  analytics.difficulty.MEDIUM = counts({ total: 3, solved: 3, started: 3, manualSolved: 3 });
  analytics.difficulty.HARD = counts({ total: 1 });
  const html = render(analytics);
  for (const text of ["33% solved", "100% solved", "0% solved", "1 / 3", "3 / 3", "0 / 1"]) expect(html).toContain(text);
});

it("retains manual, current, earlier and legacy provenance without inventing attempts", () => {
  const analytics = empty();
  analytics.overall = counts({ total: 10, started: 10, solved: 10, manualSolved: 1, verifiedCurrent: 2, verifiedEarlier: 3 });
  const html = render(analytics);
  expect(html).toContain("1 self-marked, 2 verified on current revisions, 3 verified on earlier revisions, and 4 older recorded solves");
  expect(html).not.toContain("Start your practice record");
  expect(html).toContain("Visible-only runs do not verify a solve");
  expect(html).toContain('href="/progress"');
});

it("provides labeled numeric chart data and escapes category names without relying on color", () => {
  const analytics = empty();
  analytics.overall = counts({ total: 2, started: 1, solved: 1, manualSolved: 1 });
  analytics.categories = [
    { slug: "arrays", name: "Arrays <script>alert(1)</script>", counts: counts({ total: 2, solved: 1, manualSolved: 1 }) },
    { slug: "hashing", name: "Hashing", counts: counts({ total: 2, solved: 1, manualSolved: 1 }) },
  ];
  const html = render(analytics);
  for (const text of ['scope="col"', 'scope="row"', "Solved / published", "Verified current", "50% solved", "category totals overlap", "coverage, not topic mastery"]) expect(html).toContain(text);
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html.match(/50% solved/g)).toHaveLength(2);
});
```

## 🟪 Resume plan for Part 2

On the next resume, read the draft PR and current handoff before editing. Finish the four remaining dashboard features: evidence-based topic prioritization, explainable recommended problems, recent submissions, and an explicitly defined streak or honest placeholder. Establish whether a streak counts UTC execution days, local calendar days, or another recorded activity; do not infer daily history from a single latest progress timestamp. Reuse owner-scoped data and preserve manual/current/earlier verification labels. Then extend meaningful tests, run CI, write the complete Phase 10 guide, and review the whole phase before merging.

**Stop at this checkpoint now. Do not start Part 2 or Phase 11 until the user resumes.**
