import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import type { DashboardAnalytics } from "@/features/dashboard/contracts";
import type { ProgressCounts } from "@/features/progress/query";

const difficultyNames = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };

export function DashboardOverview({ analytics }: { analytics: DashboardAnalytics }) {
  const { overall, difficulty, categories } = analytics;
  const recorded = overall.solved - overall.manualSolved - overall.verifiedCurrent - overall.verifiedEarlier;
  return <div className="space-y-4">
    <dl aria-label="Practice counts" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {[["Published", overall.total], ["Attempted", overall.attempted], ["Verified on current revision", overall.verifiedCurrent], ["Self-marked", overall.manualSolved], ["Review later", overall.reviewLater]].map(([label, count]) =>
        <div key={label} className="flex items-baseline gap-1.5"><dt className="text-muted">{label}</dt><dd className="font-medium tabular-nums">{count}</dd></div>)}
    </dl>
    <p className="text-xs leading-5 text-muted">Solved includes {overall.manualSolved} self-marked, {overall.verifiedCurrent} verified on current revisions, {overall.verifiedEarlier} verified on earlier revisions, and {recorded} older recorded solves without verification metadata. Visible-only runs do not verify a solve. Counts include published problems only and can overlap.</p>
    {overall.total === 0 ? <EmptyState title="The collection is getting ready" description="Published problems will appear here when they are available. There is no practice data to summarize yet." action={<ButtonLink href="/problems">Open the library</ButtonLink>} />
      : overall.started === 0 && <EmptyState title="Start your practice record" description="Choose a problem and mark an attempt, or run your code when execution is configured. Your dashboard will reflect the saved activity." action={<ButtonLink href="/problems">Choose a problem</ButtonLink>} />}
    <Card>
      <CardTitle>Solved by difficulty</CardTitle>
      <p className="mt-1.5 text-xs leading-5 text-muted">Each bar shows solved problems as a share of that difficulty’s published collection. Current verified solves are a subset of solved.</p>
      <SolvedChart caption="Solved by difficulty: counts and collection completion" groupLabel="Difficulty" rows={(Object.keys(difficultyNames) as Array<keyof typeof difficultyNames>).map((key) => ({ key, label: difficultyNames[key], counts: difficulty[key] }))} />
    </Card>
    <Card>
      <CardTitle>Solved by category</CardTitle>
      <p className="mt-1.5 text-xs leading-5 text-muted">Each bar uses that category’s published total. A problem can belong to several categories, so category totals overlap. Completion describes coverage, not topic mastery.</p>
      {categories.length ? <SolvedChart caption="Solved by category: overlapping categories" groupLabel="Category" rows={categories.map(({ slug, name, counts }) => ({ key: slug, label: name, counts }))} />
        : <p className="mt-4 text-sm text-muted">No categories with published problems yet.</p>}
    </Card>
    <div className="flex flex-wrap gap-2"><ButtonLink href="/problems">Continue practicing</ButtonLink><ButtonLink href="/progress" variant="secondary">View progress and recent activity</ButtonLink></div>
  </div>;
}

const levelBar: Record<string, string> = { Easy: "bg-success", Medium: "bg-warm", Hard: "bg-danger" };
function SolvedChart({ caption, groupLabel, rows }: {
  caption: string;
  groupLabel: string;
  rows: Array<{ key: string; label: string; counts: ProgressCounts }>;
}) {
  return <div className="mt-3 overflow-x-auto" role="region" aria-label={caption} tabIndex={0}>
    <table className="w-full min-w-[30rem] text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead><tr className="text-xs text-muted">{[groupLabel, "Solved / published", "Verified current", "Completion"].map((label) => <th key={label} scope="col" className="h-9 border-b border-line px-3 font-medium first:pl-0 last:pr-0">{label}</th>)}</tr></thead>
      <tbody className="divide-y divide-line">{rows.map(({ key, label, counts }) => {
        const percent = counts.total > 0 ? counts.solved / counts.total * 100 : 0;
        return <tr key={key} className="h-11">
          <th scope="row" className="max-w-64 break-words px-3 font-medium first:pl-0">{label}</th>
          <td className="px-3 tabular-nums">{counts.solved} / {counts.total}</td>
          <td className="px-3 tabular-nums text-muted">{counts.verifiedCurrent}</td>
          <td className="min-w-40 px-3 last:pr-0">
            <span className="text-xs tabular-nums text-muted">{counts.total > 0 ? `${Math.round(percent)}% solved` : "No published problems"}</span>
            <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-hover"><div className={`h-full rounded-full ${(groupLabel === "Difficulty" ? levelBar[label] : undefined) ?? "bg-accent-solid"}`} style={{ width: `${percent}%` }} /></div>
          </td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
