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
