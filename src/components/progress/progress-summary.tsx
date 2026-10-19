import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { progressLabel } from "@/features/progress/presentation";
import { verdictLabels } from "@/features/submissions/contracts";
import type { ProgressCounts, ProgressSummary as Summary } from "@/features/progress/query";

const timeLabel = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC";
const link = "font-medium text-ink underline decoration-line-strong underline-offset-4 hover:text-accent";
const levelBar: Record<string, string> = { Easy: "bg-success", Medium: "bg-warm", Hard: "bg-danger" };

export function ProgressSummary({ summary }: { summary: Summary }) {
  const { overall } = summary;
  return <div className="space-y-4">
    <section aria-label="Progress totals" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3 xl:grid-cols-6">
      {[["Published problems", overall.total], ["Started", overall.started], ["Attempted", overall.attempted], ["Solved", overall.solved], ["Verified on current revision", overall.verifiedCurrent], ["Review later", overall.reviewLater]].map(([label, count]) =>
        <div key={label} className="bg-surface p-4"><p className="text-xs text-muted">{label}</p><p className="mt-1.5 text-2xl font-semibold tabular-nums">{count}</p></div>)}
    </section>
    <p className="text-xs leading-5 text-muted">Started includes attempted or solved problems. Attempted records a manual attempt or a reserved run/submission, including execution failures. Solved includes {overall.manualSolved} self-marked and {overall.verifiedEarlier} verified on earlier revisions. Only accepted full-suite submissions verify a solve; visible runs do not. Counts include currently published problems only.</p>
    {!overall.started && <EmptyState title="Start your practice record" description="Open a problem, mark an attempt, or run your code when execution is configured." action={<ButtonLink href="/problems">Browse problems</ButtonLink>} />}
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card><CardTitle>Progress by difficulty</CardTitle><CountsTable caption="Difficulty progress" bars rows={Object.entries(summary.difficulty).map(([label, counts]) => ({ label: label[0] + label.slice(1).toLowerCase(), counts }))} /></Card>
      <Card><CardTitle>Progress by category</CardTitle><p className="mt-1.5 text-xs leading-5 text-muted">A problem can belong to several categories, so category totals overlap.</p>
        {summary.categories.length ? <CountsTable caption="Category progress" rows={summary.categories.map((category) => ({ label: category.name, counts: category.counts }))} /> : <p className="mt-4 text-sm text-muted">No published categories yet.</p>}
      </Card>
    </div>
    <Card><CardTitle>Recent attempts</CardTitle><p className="mt-1.5 text-xs leading-5 text-muted">Your ten latest runs and submissions. Saved source code and test payloads are not shown here.</p>
      {summary.recentAttempts.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[38rem] text-left text-sm">
        <caption className="sr-only">Recent attempts</caption>
        <thead><tr className="text-xs text-muted">{["Problem", "Type", "Result", "Passed", "When"].map((label) => <th key={label} scope="col" className="h-9 border-b border-line px-2 font-medium first:pl-0 last:pr-0">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{summary.recentAttempts.map((attempt, index) => <tr key={index} className="align-top">
          <td className="px-2 py-2.5 first:pl-0"><Link href={`/problems/${attempt.slug}`} className={link}>{attempt.title}</Link>
            <p className="mt-1 text-xs text-muted">Revision {attempt.problemRevision}{attempt.problemRevision !== attempt.currentRevision ? " (earlier revision)" : ""}</p></td>
          <td className="px-2 py-2.5 text-muted">{attempt.mode === "RUN" ? "Visible run" : "Full submission"}</td>
          <td className={cn("px-2 py-2.5 font-medium", attempt.status === "ACCEPTED" ? "text-success" : attempt.status === "QUEUED" || attempt.status === "RUNNING" ? "text-muted" : "text-danger")}>
            {attempt.status === "QUEUED" ? "Queued" : attempt.status === "RUNNING" ? "Running" : verdictLabels[attempt.status]}</td>
          <td className="px-2 py-2.5 text-muted tabular-nums">{attempt.completedAt ? `${attempt.passedCount}/${attempt.totalCount} passed` : "No final result yet"}</td>
          <td className="px-2 py-2.5 last:pr-0"><time className="text-xs text-muted" dateTime={attempt.createdAt}>{timeLabel(attempt.createdAt)}</time></td>
        </tr>)}</tbody></table></div>
        : <p className="mt-4 text-sm text-muted">No runs or submissions yet. Manual progress appears alongside this list.</p>}
    </Card>
    <Card><CardTitle>Recently updated progress</CardTitle><p className="mt-1.5 text-xs leading-5 text-muted">Latest state for ten recently changed problems; this is not a complete event history.</p>
      {summary.recentProgress.length ? <ul className="mt-3 divide-y divide-line">{summary.recentProgress.map((item) => <li key={item.slug} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm first:pt-0">
        <div className="min-w-0"><Link href={`/problems/${item.slug}`} className={link}>{item.title}</Link>
          <p className="mt-1 text-xs text-muted">{progressLabel(item.progress)}{item.progress.reviewLater ? " · Review later" : ""}</p></div>
        <time className="text-xs text-muted" dateTime={item.updatedAt}>{timeLabel(item.updatedAt)}</time>
      </li>)}</ul> : <p className="mt-4 text-sm text-muted">No progress changes yet.</p>}
    </Card>
  </div>;
}
function CountsTable({ caption, rows, bars = false }: { caption: string; rows: { label: string; counts: ProgressCounts }[]; bars?: boolean }) {
  return <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
    <caption className="sr-only">{caption}</caption>
    <thead><tr className="text-xs text-muted">{["Group", "Total", "Attempted", "Solved", "Verified current"].map((label) => <th key={label} scope="col" className="h-9 whitespace-nowrap border-b border-line px-2 font-medium first:pl-0 last:pr-0">{label}</th>)}</tr></thead>
    <tbody className="divide-y divide-line">{rows.map(({ label, counts }) => <tr key={label} className="h-11">
      <th scope="row" className="px-2 font-medium first:pl-0">{label}
        {bars && <div aria-hidden="true" className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-surface-hover"><div className={cn("h-full rounded-full", levelBar[label] ?? "bg-accent-solid")} style={{ width: `${counts.total ? counts.solved / counts.total * 100 : 0}%` }} /></div>}
      </th>
      {[counts.total, counts.attempted, counts.solved, counts.verifiedCurrent].map((count, index) => <td key={index} className="px-2 text-muted tabular-nums last:pr-0">{count}</td>)}</tr>)}</tbody>
  </table></div>;
}
