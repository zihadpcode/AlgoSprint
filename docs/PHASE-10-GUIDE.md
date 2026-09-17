# Phase 10 — Dashboard analytics

## 🟦 Completed scope

The dashboard now combines private summary cards, solved-by-difficulty/category charts, topics to revisit, explainable next-problem recommendations, recent full submissions, and an explicit **Not tracked yet** streak placeholder. The original brief permits a streak placeholder or implementation; this phase chooses the placeholder. No consecutive-day count is fabricated.

The halfway request was honored in the historical Part 1 checkpoint. The user subsequently resumed. This guide covers both halves and includes all 13 changed source/test files relative to Phase 9. The Part 1 guide remains a historical snapshot. Pause before Phase 11 after the verified Phase 10 merge.

## 🟨 What the numbers mean

| Display | Meaning |
| --- | --- |
| Published problems | Currently published collection size |
| Attempted | A saved first attempt date, including manual attempts or reserved executions |
| Solved | All solved records: manual, currently verified, earlier verified and legacy recorded |
| Verified on current revision | A full-suite verified solve matching current content |
| Self-marked solves | Manual solve marks without runner verification |
| Review later | Published problems the learner explicitly marked for review |

These are overlapping counts. Solved does not imply an attemptedAt date for a manual-only mark. A visible run cannot verify a solve. A revised problem can remain historically solved while ceasing to count as current verification. The provenance sentence preserves all four solve categories; the legacy count is the solved remainder after manual/current/earlier verified counts.

Each chart row uses **solved in that group / published in that group × 100**. The percentage label rounds to the nearest whole number, while exact solved/published counts remain visible. Zero denominators say No published problems. Difficulty rows are Easy, Medium, Hard. Category rows follow the shared query's name ordering. Categories overlap; adding their totals does not yield the overall collection size. Verified counts are already part of solved, so they are not stacked on top of solved.

The blue bars are decorative and hidden from assistive technology. Tables supply captions, row/column headers, exact counts and percentages. Scroll regions can receive keyboard focus at narrow widths. Labels remain understandable without distinguishing colors. No chart dependency or animation was added.

## 🟦 Server and database flow

1. The dynamic dashboard page awaits `loadDashboard()` before rendering private content.
2. The server-only loader calls `requireViewer('/dashboard')` before obtaining the database connection. The owner ID and administrator flag come from the verified server identity. Administrators see their own analytics.
3. `queryDashboard` opens one Repeatable Read transaction with a 15-second timeout. It calls the shared `readProgress(transaction, owner)` helper, reads recommendation evidence, and queries recent full submissions within that same snapshot.
4. The loader returns only the display name, admin flag, card/chart data and explicitly selected insight DTOs. It does not return operational owner IDs, email, source, result JSON, notes, test cases or provider credentials.
5. Server Components render the data. Existing progress/submission actions already revalidate `/dashboard`; no new write action or browser data-fetching path is introduced.

Phase 9's query was refactored into `readProgress` plus the original `queryProgress` transaction wrapper. Its returned shape and ownership rules remain unchanged, and existing progress tests still apply. The dashboard can now reuse that read without nesting transactions or combining inconsistent snapshots. Both entry points reject an empty owner. No cross-user/global cache is introduced.

The shared read still performs two bounded progress-page activity queries not displayed directly by the dashboard; this small existing overhead is retained rather than duplicating count logic. The recommendation query selects one latest completed full submission per published problem, scoped to the owner, ordered by reservation time descending then ID descending. It includes status and captured revision only. It does not load full submission history into memory. Recent submissions have a separate five-row query.

Collection aggregation and recommendation ranking operate on minimal rows for the planned 1,000-problem MVP. This is not an unlimited-scale analytics service. Larger collections should move appropriate aggregation/ranking to measured SQL queries and revisit indexes/query plans. There is no provider request inside the transaction.

## 🟩 Topic signals, without pretending to measure mastery

The brief's weak-topic feature is presented as **Topics to revisit**. A category qualifies if either:

- At least one published problem in that category is explicitly marked for review; or
- At least two distinct unsolved published problems have a latest completed full submission with Wrong answer on the current revision.

A repeated wrong answer on one problem counts once. Visible runs are excluded from the evidence query. Older revisions, pending results, infrastructure failures, compilation/runtime/resource errors, and solved records do not contribute to the inferred wrong-answer count. Manual, legacy and verified solves all count as solved for that exclusion. An explicit review mark still qualifies even for a solved problem.

The latest completed full submission is selected by creation time, with ID as a deterministic tie-breaker. Pending newer work does not erase the last completed evidence. If the latest completed result is an infrastructure failure or a pass, it supersedes an earlier wrong answer for this signal. Stale latest evidence is ignored; the system does not search backward for a more convenient failure.

Topics are sorted by review count descending, then unresolved count descending, then slug, and limited to five. Each item displays both counts. Categories can share problems, so the signal counts overlap. Low collection completion alone does not identify a weak skill. The two-problem threshold is an explicit conservative product rule, not a validated assessment score.

## 🟩 Recommendation policy

Up to three distinct published problems are selected in this priority order:

| Priority | Reason shown to the learner |
| --- | --- |
| 1 | Explicitly marked for review |
| 2 | Verified solve belongs to an earlier revision |
| 3 | Latest completed full submission on current revision returned Wrong answer |
| 4 | Attempted but not marked solved |
| 5 | New problem in a qualifying topic to revisit |
| 6 | Other unstarted published problem |

Current verified, manual and legacy solved records are excluded unless explicitly marked for review. Earlier verified solves can be suggested for re-verification. Within each priority, easier difficulty comes first, then slug as a stable tie-breaker. Every recommendation includes a concrete reason and a working problem link. This is deterministic rule-based ranking; it does not claim AI personalization or proven skill improvement.

All qualifying topics, not only the five displayed, may influence new-problem ranking. An empty recommendation list says no next problem is available from the published collection. It does not claim that the learner mastered every topic.

## 🟨 Recent submissions and streak choice

The five newest full submissions are queried directly with `mode: SUBMIT`, filtered by verified owner and published problem, ordered by creation time and ID. The query includes queued/running submissions. It does not filter a mixed Run/Submit list, which could hide submissions after many newer visible runs.

Each entry shows the problem link, status, captured revision, current-revision comparison, timestamp in UTC and final counts only when completedAt exists. Pending work says No final result yet. An old accepted submission is historical feedback, not proof that the current revision is verified. Raw code/results/provider output/hidden payloads are never selected for this DTO.

The streak card explicitly says **Not tracked yet**. A first attemptedAt or latest updatedAt timestamp cannot reconstruct all practice days. A future implementation must choose an event model and UTC/local-day policy before claiming consecutive-day counts. This placeholder satisfies the brief's stated option while avoiding misleading streak data.

## 🟨 Empty states and failures

An empty collection and an unstarted learner receive different messages. A manual-only solve does not trigger the new-learner empty state. No qualifying topic, no recommendations and no full submissions have separate messages. A failed database or identity-provider request propagates to the existing error boundary rather than returning invented zeros or raw errors. Guests redirect before database work.

## 🟦 Run on your Mac

Use Node.js 24 and an authenticated repository checkout. Preserve your uncommitted changes before updating:

```bash
git fetch origin
git switch main
git pull --ff-only
npm ci
```

If PR #11 is still open, use the existing `algosprint/phase-10-dashboard-part-1` branch until merge; the branch name is retained for continuity even though this guide completes Phase 10.

Copy `.env.example` to `.env.local` only if you have not configured the project already. Follow Phase 3 for DATABASE_URL, Supabase project URL/publishable key and APP_URL. Keep passwords and keys out of source control. Use a confirmed account.

No schema, migration, dependency or seed content is changed by Phase 10. An older development database must still apply the existing Phase 9 migration. Check that DATABASE_URL and any DIRECT_URL point to the intended development project; do not reset valuable data.

```bash
npm run db:deploy
npm run db:generate
npm run db:seed
npm run dev
```

Open `/dashboard` and compare counts to `/progress`. Manual marks and recommendations work without Judge0. Configure and verify a maintained execution provider using the Phase 8 checklist before enabling real execution.

## 🟨 Automated verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:smoke
```

New policy tests cover evidence thresholds, old revisions, excluded outcomes/solves, review overrides, ranking, deterministic ties, category overlap and list limits. Rendering tests cover labels, escaped titles, pending results, UTC and the honest streak placeholder. Loader tests cover verified-owner selection, administrator isolation, guest/provider failures and database failure propagation.

The PostgreSQL suite adds real-query tests for ownership/private-field exclusions, full submissions surviving a burst of visible runs, latest completed outcomes, stale revisions, archive filtering, empty owners, and distinct-problem topic thresholds. Existing progress migration/concurrency/privacy tests also rerun after the shared-read refactor.

`npm run test:integration` requires the documented disposable empty PostgreSQL database ending in `_test` and TEST_DATABASE_URL. Apply migrations to that same database first. GitHub CI supplies PostgreSQL 17 and verifies migration, seed validation/seeding, lint/types/build and both production HTTP smoke scripts. The PR records exact final head, CI and merge-tree evidence. A generated local `.next` cache cleanup failure was resolved by removing only the generated cache and rebuilding successfully.

## 🟥 Manual checks still required

1. Test confirmed sign-in and signed-out/expired-session redirects. Compare two users' cards, topics, recommendations and recent submissions; verify admin analytics remain private to the admin.
2. Mark a problem for review and confirm it moves up in recommendations. Clear the mark and check priority again. Verify manual/current/legacy solved problems are excluded unless reviewed.
3. In a disposable fixture, create current wrong answers on two distinct unsolved problems in one category. Confirm its topic signal; repeated failures on one problem alone must not qualify. Advance a revision or complete a newer pass and check the signal disappears appropriately.
4. Verify an earlier-revision solve is suggested for re-verification. Check full submissions remain visible after many visible runs, and pending results do not show final counts.
5. Check empty collection/no activity/all solved states, long titles/category names, keyboard table scrolling, screen-reader headings, narrow widths and 200% zoom. Verify labels without relying on color.
6. With a live-checked development runner, submit code and confirm dashboard/progress refresh while the editor draft is retained. Complete the earlier Monaco worker and live Supabase/Judge0 checklists.

No live Supabase/Judge0 workflow, actual browser visual QA, production migration, deployment or provider purchase was performed. Automated fixtures do not establish real sandbox isolation or browser/worker behavior.

## 🟩 Complete source files

These are all 13 source/test files changed across both halves of Phase 10. Generated clients and unchanged shared files remain in the repository. Status documents are separate from these listings.

### `src/app/dashboard/page.tsx`

```tsx
import type { Metadata } from "next";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { ButtonLink } from "@/components/ui/button";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { DashboardInsights } from "@/components/dashboard/dashboard-insights";
import { loadDashboard } from "@/features/dashboard/load";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const { displayName, admin, analytics, insights } = await loadDashboard();
  return <AccountFrame admin={admin}>
    <PageHeading eyebrow="Your practice space" title={`Welcome, ${displayName || "learner"}.`} description="See your saved practice progress, then choose your next challenge." action={<ButtonLink href="/profile" variant="secondary">View profile</ButtonLink>} />
    <DashboardOverview analytics={analytics} />
    <DashboardInsights insights={insights} />
  </AccountFrame>;
}
```

### `src/components/dashboard/dashboard-insights.tsx`

```tsx
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { verdictLabels } from "@/features/submissions/contracts";
import type { DashboardInsights as Insights } from "@/features/dashboard/query";

export function DashboardInsights({ insights }: { insights: Insights }) {
  return <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
    <Card><CardTitle>Topics to revisit</CardTitle>
      <p className="mt-3 text-sm leading-7 text-muted">Prioritized from your review flags or at least two distinct unsolved problems whose latest completed full submission returned Wrong answer on the current revision. These are practice signals, not a skill score. Categories can overlap.</p>
      {insights.topics.length ? <ul className="mt-5 space-y-4">{insights.topics.map((topic) => <li key={topic.slug} className="border-t border-line pt-4">
        <p className="font-semibold">{topic.name}</p><p className="mt-2 text-sm text-muted">{topic.reviewCount} marked for review · {topic.unresolvedCount} unresolved wrong-answer problems</p>
      </li>)}</ul> : <p className="mt-5 text-sm text-muted">No topic signal yet. Mark a problem for review when you want to revisit it; low completion alone does not identify a weak topic.</p>}
    </Card>
    <Card><CardTitle>Recommended next problems</CardTitle>
      <p className="mt-3 text-sm leading-7 text-muted">Your review marks come first, followed by revised problems, unresolved wrong answers and unfinished attempts. New problems in topics to revisit come next. Within each group, easier problems appear first.</p>
      {insights.recommendations.length ? <ol className="mt-5 space-y-4">{insights.recommendations.map((item) => <li key={item.slug} className="border-t border-line pt-4">
        <Link href={`/problems/${item.slug}`} className="font-semibold text-accent underline underline-offset-4">{item.title}</Link>
        <p className="mt-2 text-xs text-muted">{item.difficulty}</p><p className="mt-2 text-sm leading-6 text-muted">{item.reason}</p>
      </li>)}</ol> : <p className="mt-5 text-sm text-muted">No next problem to suggest from the published collection. You can revisit a solved problem from the library or mark it for review.</p>}
    </Card>
    <Card><CardTitle>Recent full submissions</CardTitle>
      <p className="mt-3 text-sm leading-7 text-muted">Your five latest full-suite submissions for published problems. Visible-only runs are on your progress page.</p>
      {insights.recentSubmissions.length ? <ol className="mt-5 space-y-4">{insights.recentSubmissions.map((item, index) => <li key={index} className="border-t border-line pt-4 text-sm">
        <Link href={`/problems/${item.slug}`} className="font-semibold text-accent underline underline-offset-4">{item.title}</Link>
        <p className="mt-2">{item.status === "QUEUED" ? "Queued" : item.status === "RUNNING" ? "Running" : verdictLabels[item.status]} · {item.completedAt ? `${item.passedCount}/${item.totalCount} passed` : "No final result yet"}</p>
        <p className="mt-1 text-muted">Revision {item.problemRevision}{item.problemRevision !== item.currentRevision ? " (earlier revision)" : ""}. A submission result does not replace the current solve label.</p>
        <time dateTime={item.createdAt} className="mt-2 block text-xs text-muted">{new Date(item.createdAt).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC</time>
      </li>)}</ol> : <p className="mt-5 text-sm text-muted">No full submissions yet. Manual solve marks and visible runs do not create full submissions.</p>}
    </Card>
    <Card><CardTitle>Practice streak</CardTitle><p className="mt-3 font-medium">Not tracked yet</p>
      <p className="mt-3 text-sm leading-7 text-muted">Your attempts and solves are saved, but this dashboard does not calculate consecutive practice days. Keep building a routine at your own pace.</p>
    </Card>
  </div>;
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
import { queryDashboard } from "./query";

export async function loadDashboard() {
  const viewer = await requireViewer("/dashboard");
  const { analytics, insights } = await queryDashboard(getDatabase(), viewer.id);
  return { displayName: viewer.displayName, admin: viewer.role === "ADMIN", analytics, insights };
}
```

### `src/features/dashboard/policy.ts`

```ts
import { progressView, type ProgressView } from "@/features/progress/presentation";

export type EvidenceProblem = {
  slug: string; title: string; difficulty: "EASY" | "MEDIUM" | "HARD"; revision: number;
  categories: { slug: string; name: string }[];
  progress: { status: ProgressView["status"]; selfMarked: boolean; reviewLater: boolean; verifiedRevision: number | null } | null;
  latest: { status: string; problemRevision: number } | null;
};
const difficultyRank = { EASY: 0, MEDIUM: 1, HARD: 2 };
const compareSlug = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function practiceSuggestions(problems: EvidenceProblem[]) {
  const groups = new Map<string, { slug: string; name: string; reviewCount: number; unresolvedCount: number }>();
  const evidence = problems.map((problem) => {
    const view = progressView(problem.progress, problem.revision);
    const unresolved = view.status !== "SOLVED" && problem.latest?.status === "WRONG_ANSWER" && problem.latest.problemRevision === problem.revision;
    for (const category of problem.categories) {
      const group = groups.get(category.slug) ?? { ...category, reviewCount: 0, unresolvedCount: 0 };
      if (view.reviewLater) group.reviewCount++;
      if (unresolved) group.unresolvedCount++;
      groups.set(category.slug, group);
    }
    return { problem, view, unresolved };
  });
  // Repeated failures on one problem cannot inflate this distinct-problem signal.
  const allTopics = [...groups.values()].filter((g) => g.reviewCount > 0 || g.unresolvedCount >= 2)
    .sort((a, b) => b.reviewCount - a.reviewCount || b.unresolvedCount - a.unresolvedCount || compareSlug(a.slug, b.slug));
  const focusSlugs = new Set(allTopics.map((g) => g.slug));
  const recommendations = evidence.flatMap(({ problem, view, unresolved }) => {
    let priority: number; let reason: string;
    if (view.reviewLater) { priority = 0; reason = "You marked this problem for review."; }
    else if (view.verification === "earlier") { priority = 1; reason = "Your verified solve is for an earlier revision."; }
    else if (view.status === "SOLVED") return [];
    else if (unresolved) { priority = 2; reason = "Your latest completed full submission on this revision returned Wrong answer."; }
    else if (view.status === "ATTEMPTED") { priority = 3; reason = "You have attempted this problem and have not marked it solved."; }
    else if (problem.categories.some((c) => focusSlugs.has(c.slug))) { priority = 4; reason = "A new problem in one of your topics to revisit."; }
    else { priority = 5; reason = "A published problem you have not started."; }
    return [{ slug: problem.slug, title: problem.title, difficulty: problem.difficulty, reason, priority }];
  }).sort((a, b) => a.priority - b.priority || difficultyRank[a.difficulty] - difficultyRank[b.difficulty] || compareSlug(a.slug, b.slug))
    .slice(0, 3).map(({ slug, title, difficulty, reason }) => ({ slug, title, difficulty, reason }));
  return { topics: allTopics.slice(0, 5), recommendations };
}
```

### `src/features/dashboard/query.ts`

```ts
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { readProgress } from "@/features/progress/query";
import { practiceSuggestions } from "./policy";

export async function queryDashboard(db: PrismaClient, userId: string) {
  if (!userId) throw new Error("Verified viewer required");
  return db.$transaction(async (tx) => {
    const { overall, difficulty, categories } = await readProgress(tx, userId);
    const problems = await tx.problem.findMany({ where: { status: "PUBLISHED" }, select: {
      slug: true, title: true, difficulty: true, revision: true,
      categories: { select: { category: { select: { slug: true, name: true } } } },
      progress: { where: { userId }, select: { status: true, selfMarked: true, reviewLater: true, verifiedRevision: true } },
      submissions: { where: { userId, mode: "SUBMIT", completedAt: { not: null } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1,
        select: { status: true, problemRevision: true } },
    } });
    const suggestions = practiceSuggestions(problems.map(({ categories, progress, submissions, ...problem }) => ({ ...problem,
      categories: categories.map(({ category }) => category), progress: progress[0] ?? null, latest: submissions[0] ?? null,
    })));
    // Query SUBMIT directly: filtering ten mixed runs could hide recent full submissions.
    const recent = await tx.userSubmission.findMany({ where: { userId, mode: "SUBMIT", problem: { status: "PUBLISHED" } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 5,
      select: { status: true, problemRevision: true, passedCount: true, totalCount: true, createdAt: true, completedAt: true,
        problem: { select: { slug: true, title: true, revision: true } } },
    });
    return { analytics: { overall, difficulty, categories }, insights: { ...suggestions,
      recentSubmissions: recent.map(({ problem, createdAt, completedAt, ...submission }) => ({ ...submission,
        slug: problem.slug, title: problem.title, currentRevision: problem.revision,
        createdAt: createdAt.toISOString(), completedAt: completedAt?.toISOString() ?? null,
      })),
    } };
  }, { isolationLevel: "RepeatableRead", timeout: 15_000 });
}
export type DashboardInsights = Awaited<ReturnType<typeof queryDashboard>>["insights"];
```

### `src/features/progress/query.ts`

```ts
import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { progressView } from "./presentation";

const emptyCounts = () => ({ total: 0, started: 0, attempted: 0, solved: 0, manualSolved: 0, verifiedCurrent: 0, verifiedEarlier: 0, reviewLater: 0 });
export type ProgressCounts = ReturnType<typeof emptyCounts>;
// Trusted boundary supplies the verified owner. No cross-user or public caching.
export async function queryProgress(db: PrismaClient, userId: string) {
  if (!userId) throw new Error("Verified viewer required");
  return db.$transaction((tx) => readProgress(tx, userId), { isolationLevel: "RepeatableRead", timeout: 15_000 });
}

// Shared by progress and dashboard inside their own consistent transaction.
export async function readProgress(tx: Prisma.TransactionClient, userId: string) {
  if (!userId) throw new Error("Verified viewer required");
    // Minimal collection projection is appropriate for the planned 1,000-problem MVP.
    // Statements, solutions, tests, notes and submission code/result never enter this DTO.
    const problems = await tx.problem.findMany({ where: { status: "PUBLISHED" }, select: {
      revision: true, difficulty: true,
      categories: { select: { category: { select: { slug: true, name: true } } } },
      progress: { where: { userId }, select: { status: true, selfMarked: true, reviewLater: true, verifiedRevision: true, attemptedAt: true } },
    } });
    const overall = emptyCounts();
    const difficulty = { EASY: emptyCounts(), MEDIUM: emptyCounts(), HARD: emptyCounts() };
    const categories = new Map<string, { slug: string; name: string; counts: ProgressCounts }>();
    for (const problem of problems) {
      const row = problem.progress[0]; const view = progressView(row, problem.revision);
      const groups = [overall, difficulty[problem.difficulty]];
      for (const { category } of problem.categories) {
        if (!categories.has(category.slug)) categories.set(category.slug, { ...category, counts: emptyCounts() });
        groups.push(categories.get(category.slug)!.counts);
      }
      for (const counts of groups) {
        counts.total++;
        if (view.status !== "NOT_STARTED") counts.started++;
        if (row?.attemptedAt) counts.attempted++;
        if (view.status === "SOLVED") counts.solved++;
        if (view.status === "SOLVED" && view.selfMarked) counts.manualSolved++;
        if (view.verification === "current") counts.verifiedCurrent++;
        if (view.verification === "earlier") counts.verifiedEarlier++;
        if (view.reviewLater) counts.reviewLater++;
      }
    }
    const recentAttempts = await tx.userSubmission.findMany({ where: { userId, problem: { status: "PUBLISHED" } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10,
      select: { mode: true, status: true, problemRevision: true, passedCount: true, totalCount: true, createdAt: true, completedAt: true,
        problem: { select: { slug: true, title: true, revision: true } } },
    });
    const recentProgress = await tx.userProgress.findMany({ where: { userId, problem: { status: "PUBLISHED" } },
      orderBy: [{ updatedAt: "desc" }, { problemId: "asc" }], take: 10,
      select: { status: true, selfMarked: true, reviewLater: true, verifiedRevision: true, updatedAt: true,
        problem: { select: { slug: true, title: true, revision: true } } },
    });
    return { overall, difficulty, categories: [...categories.values()].sort((a, b) => a.name.localeCompare(b.name)),
      recentAttempts: recentAttempts.map(({ problem, createdAt, completedAt, ...attempt }) => ({ ...attempt,
        slug: problem.slug, title: problem.title, currentRevision: problem.revision,
        createdAt: createdAt.toISOString(), completedAt: completedAt?.toISOString() ?? null })),
      recentProgress: recentProgress.map(({ problem, updatedAt, ...row }) => ({ slug: problem.slug, title: problem.title,
        progress: progressView(row, problem.revision), updatedAt: updatedAt.toISOString() })),
    };
}
export type ProgressSummary = Awaited<ReturnType<typeof queryProgress>>;
```

### `tests/dashboard-insights.test.ts`

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DashboardInsights } from "@/components/dashboard/dashboard-insights";
import type { DashboardInsights as Insights } from "@/features/dashboard/query";
const empty = (): Insights => ({ topics: [], recommendations: [], recentSubmissions: [] });
const render = (insights: Insights) => renderToStaticMarkup(createElement(DashboardInsights, { insights }));
it("states absent evidence and an untracked streak without inventing a number", () => {
  const html = render(empty());
  for (const text of ["No topic signal yet", "No next problem to suggest", "No full submissions yet", "Not tracked yet"]) expect(html).toContain(text);
  expect(html).not.toContain("0 days");
});
it("escapes titles and distinguishes pending, current and earlier revision results", () => {
  const insights = empty();
  const row = { slug: "relay-window", title: "<script>secret()</script>", status: "RUNNING" as const, problemRevision: 1, currentRevision: 2, passedCount: 0, totalCount: 2, createdAt: "2026-09-17T00:00:00.000Z", completedAt: null };
  insights.recentSubmissions = [row, { ...row, status: "ACCEPTED", passedCount: 2, problemRevision: 2, completedAt: row.createdAt }];
  const html = render(insights);
  for (const text of ["No final result yet", "earlier revision", "UTC", "2/2 passed", "&lt;script&gt;"]) expect(html).toContain(text);
  expect(html).not.toContain("0/2 passed"); expect(html).not.toContain("<script>");
});
```

### `tests/dashboard-load.test.ts`

```ts
import { beforeEach, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({ viewer: vi.fn(), db: vi.fn(), query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ requireViewer: f.viewer }));
vi.mock("@/lib/prisma", () => ({ getDatabase: f.db }));
vi.mock("@/features/dashboard/query", () => ({ queryDashboard: f.query }));
import { loadDashboard } from "@/features/dashboard/load";

beforeEach(() => {
  vi.resetAllMocks();
  f.viewer.mockResolvedValue({ id: "verified-owner", role: "USER", displayName: "Learner", email: "private@example.test" });
  f.db.mockReturnValue("db");
  f.query.mockResolvedValue({ analytics: { overall: { solved: 2 }, difficulty: {}, categories: [] }, insights: { topics: [], recommendations: [], recentSubmissions: [] } });
});

it("uses the verified owner and returns only the dashboard projection", async () => {
  expect(await loadDashboard()).toEqual({ displayName: "Learner", admin: false, analytics: { overall: { solved: 2 }, difficulty: {}, categories: [] }, insights: { topics: [], recommendations: [], recentSubmissions: [] } });
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

### `tests/dashboard-policy.test.ts`

```ts
import { expect, it } from "vitest";
import { practiceSuggestions, type EvidenceProblem } from "@/features/dashboard/policy";
const problem = (slug: string, changes: Partial<EvidenceProblem> = {}): EvidenceProblem => ({ slug, title: slug, difficulty: "EASY", revision: 2, categories: [{ slug: "arrays", name: "Arrays" }], progress: null, latest: null, ...changes });
const attempted = { status: "ATTEMPTED" as const, selfMarked: false, reviewLater: false, verifiedRevision: null };
const wrong = { status: "WRONG_ANSWER", problemRevision: 2 };
it("does not infer weakness from no activity, coverage, or just one failed problem", () => {
  expect(practiceSuggestions([problem("a"), problem("b")]).topics).toEqual([]);
  expect(practiceSuggestions([problem("a", { latest: wrong })]).topics).toEqual([]);
  expect(practiceSuggestions([problem("a", { latest: wrong }), problem("b", { latest: wrong })]).topics[0].unresolvedCount).toBe(2);
});
it("ignores stale, infrastructure, visible-query-excluded and solved evidence", () => {
  const inputs = [problem("a", { latest: { ...wrong, problemRevision: 1 } }), problem("b", { latest: { ...wrong, status: "INTERNAL_ERROR" } }), problem("c", { progress: { ...attempted, status: "SOLVED", selfMarked: true }, latest: wrong })];
  expect(practiceSuggestions(inputs).topics).toEqual([]);
});
it("honors a single explicit review mark even on a currently verified solve", () => {
  const result = practiceSuggestions([problem("a", { progress: { ...attempted, status: "SOLVED", verifiedRevision: 2, reviewLater: true } })]);
  expect(result.topics[0]).toMatchObject({ reviewCount: 1, unresolvedCount: 0 });
  expect(result.recommendations[0].reason).toContain("marked this problem for review");
});
it("prioritizes review, revised verification and wrong answers before fresh practice", () => {
  const inputs = [problem("fresh"), problem("wrong", { latest: wrong }), problem("revision", { progress: { ...attempted, status: "SOLVED", verifiedRevision: 1 } }), problem("review", { progress: { ...attempted, reviewLater: true } })];
  expect(practiceSuggestions(inputs).recommendations.map((p) => p.slug)).toEqual(["review", "revision", "wrong"]);
});
it("excludes manual/current/legacy solves unless reviewed and sorts ties deterministically", () => {
  const inputs = [problem("z-hard", { difficulty: "HARD" }), problem("b"), problem("a"), problem("manual", { progress: { ...attempted, status: "SOLVED", selfMarked: true } }), problem("legacy", { progress: { ...attempted, status: "SOLVED" } }), problem("verified", { progress: { ...attempted, status: "SOLVED", verifiedRevision: 2 } })];
  expect(practiceSuggestions(inputs).recommendations.map((p) => p.slug)).toEqual(["a", "b", "z-hard"]);
  expect(practiceSuggestions([...inputs].reverse())).toEqual(practiceSuggestions(inputs));
});
it("favors an unfinished attempt before a new problem in a focus topic", () => {
  const inputs = [problem("a-review", { progress: { ...attempted, reviewLater: true } }), problem("z-attempt", { progress: attempted, categories: [] }), problem("b-focus"), problem("a-other", { categories: [] })];
  expect(practiceSuggestions(inputs).recommendations.map((p) => p.slug)).toEqual(["a-review", "z-attempt", "b-focus"]);
});
it("bounds overlapping topic signals and recommendations", () => {
  const categories = Array.from({ length: 8 }, (_, i) => ({ slug: `cat-${i}`, name: `Category ${i}` }));
  const result = practiceSuggestions(Array.from({ length: 8 }, (_, i) => problem(`p-${i}`, { categories, progress: { ...attempted, reviewLater: true } })));
  expect(result.topics).toHaveLength(5); expect(result.recommendations).toHaveLength(3);
  expect(result.topics[0].reviewCount).toBe(8);
});
```

### `tests/integration/dashboard.test.ts`

```ts
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { queryDashboard } from "@/features/dashboard/query";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
let db: ReturnType<typeof createDatabaseClient>; let owns = false; let slugs: string[] = []; let ids: string[];
const users = [randomUUID(), randomUUID()];
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use an empty disposable TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url); if (await db.problem.count()) throw new Error("Dashboard tests require an empty collection.");
  const seeds = await loadProblems(); slugs = seeds.map((p) => p.slug); owns = true;
  await seedProblems(db, seeds); await db.user.createMany({ data: users.map((id) => ({ id })) });
  ids = (await db.problem.findMany({ orderBy: { slug: "asc" }, select: { id: true } })).map((p) => p.id);
}, 30000);
beforeEach(async () => {
  await db.userSubmission.deleteMany({ where: { userId: { in: users } } });
  await db.userProgress.deleteMany({ where: { userId: { in: users } } });
  await db.problem.updateMany({ where: { id: { in: ids } }, data: { status: "PUBLISHED", revision: 1 } });
});
afterAll(async () => {
  if (db && owns) { await db.user.deleteMany({ where: { id: { in: users } } }); await db.problem.deleteMany({ where: { slug: { in: slugs } } }); }
  await db?.$disconnect();
});
const submission = (problemId: string, userId = users[0]) => ({ problemId, userId, mode: "SUBMIT" as const, language: "JAVASCRIPT" as const, status: "WRONG_ANSWER" as const, problemRevision: 1, passedCount: 0, totalCount: 2, code: "PRIVATE-CODE", result: { secret: "PRIVATE-RESULT" }, createdAt: new Date("2026-09-01T00:00:00Z"), completedAt: new Date("2026-09-16T00:00:00Z") });
it("keeps counts, review signals and submissions owner-only and excludes private DTO fields", async () => {
  await db.userProgress.create({ data: { userId: users[0], problemId: ids[0], reviewLater: true } });
  await db.userSubmission.create({ data: submission(ids[0]) });
  await db.userSubmission.create({ data: submission(ids[1], users[1]) });
  const a = await queryDashboard(db, users[0]); const b = await queryDashboard(db, users[1]);
  expect(a.analytics.overall.reviewLater).toBe(1); expect(b.analytics.overall.reviewLater).toBe(0);
  expect(a.insights.recommendations[0].reason).toContain("marked this problem for review");
  expect(a.insights.recentSubmissions).toHaveLength(1); expect(b.insights.recentSubmissions).toHaveLength(1);
  for (const secret of [users[0], users[1], "PRIVATE-CODE", "PRIVATE-RESULT", '"code"', '"result"', '"userId"']) expect(JSON.stringify(a)).not.toContain(secret);
});
it("returns the five latest full submissions even after many newer visible runs", async () => {
  await db.userSubmission.createMany({ data: Array.from({ length: 8 }, (_, i) => ({ ...submission(ids[0]), createdAt: new Date(Date.UTC(2026, 8, i + 1)) })) });
  await db.userSubmission.createMany({ data: Array.from({ length: 12 }, () => ({ ...submission(ids[0]), mode: "RUN" as const, createdAt: new Date("2026-09-15T00:00:00Z") })) });
  const recent = (await queryDashboard(db, users[0])).insights.recentSubmissions;
  expect(recent).toHaveLength(5); expect(recent[0].createdAt).toBe("2026-09-08T00:00:00.000Z"); expect(recent[4].createdAt).toBe("2026-09-04T00:00:00.000Z");
});
it("uses the latest completed full result and ignores stale revisions for wrong-answer recommendations", async () => {
  await db.userSubmission.create({ data: { ...submission(ids[0]), createdAt: new Date("2026-09-01T00:00:00Z") } });
  expect((await queryDashboard(db, users[0])).insights.recommendations[0].reason).toContain("Wrong answer");
  await db.userSubmission.create({ data: { ...submission(ids[0]), status: "INTERNAL_ERROR", createdAt: new Date("2026-09-02T00:00:00Z") } });
  expect(JSON.stringify((await queryDashboard(db, users[0])).insights.recommendations)).not.toContain("Wrong answer");
  await db.userSubmission.deleteMany({ where: { userId: users[0], status: "INTERNAL_ERROR" } });
  await db.problem.update({ where: { id: ids[0] }, data: { revision: 2 } });
  expect(JSON.stringify((await queryDashboard(db, users[0])).insights.recommendations)).not.toContain("Wrong answer");
});
it("omits archived problems from every dashboard section and rejects an empty owner", async () => {
  await db.userProgress.create({ data: { userId: users[0], problemId: ids[0], reviewLater: true } });
  await db.userSubmission.create({ data: submission(ids[0]) });
  const archived = await db.problem.update({ where: { id: ids[0] }, data: { status: "ARCHIVED" } });
  const summary = await queryDashboard(db, users[0]);
  expect(summary.analytics.overall.total).toBe(4); expect(summary.insights.recentSubmissions).toEqual([]);
  expect(summary.insights.topics).toEqual([]); expect(JSON.stringify(summary)).not.toContain(archived.slug);
  await expect(queryDashboard(db, "")).rejects.toThrow("Verified viewer required");
});

it("requires distinct unresolved full-submission problems for inferred topic signals", async () => {
  const arrayProblems = await db.problem.findMany({ where: { categories: { some: { category: { slug: "arrays" } } } }, take: 2, orderBy: { slug: "asc" } });
  expect(arrayProblems).toHaveLength(2);
  await db.userSubmission.createMany({ data: arrayProblems.map((p) => ({ ...submission(p.id), mode: "RUN" as const })) });
  expect((await queryDashboard(db, users[0])).insights.topics).toEqual([]);
  await db.userSubmission.createMany({ data: arrayProblems.map((p) => submission(p.id)) });
  expect((await queryDashboard(db, users[0])).insights.topics.find((t) => t.slug === "arrays")?.unresolvedCount).toBe(2);
  await db.userSubmission.createMany({ data: Array.from({ length: 4 }, () => submission(arrayProblems[0].id)) });
  await db.userSubmission.create({ data: { ...submission(arrayProblems[1].id), createdAt: new Date("2026-09-02T00:00:00Z"), status: "ACCEPTED", passedCount: 2 } });
  expect((await queryDashboard(db, users[0])).insights.topics).toEqual([]);
});
```

## 🟪 Next phase

Pause before Phase 11. On resume, verify main and PR #11, then build the private notes/bookmarks manager and review-later page, reusing existing ownership checks and preserving progress fields. A real streak and broader analytics can be future enhancements; no Phase 11 code is included here.
