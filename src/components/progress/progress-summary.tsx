import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { progressLabel } from "@/features/progress/presentation";
import { verdictLabels } from "@/features/submissions/contracts";
import type { ProgressCounts, ProgressSummary as Summary } from "@/features/progress/query";

const timeLabel = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC";
export function ProgressSummary({ summary }: { summary: Summary }) {
  const { overall } = summary;
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[["Published problems", overall.total], ["Started", overall.started], ["Attempted", overall.attempted], ["Solved", overall.solved], ["Verified on current revision", overall.verifiedCurrent], ["Review later", overall.reviewLater]].map(([label, count]) =>
        <Card key={label}><p className="text-sm text-muted">{label}</p><p className="mt-3 text-3xl font-semibold text-accent">{count}</p></Card>)}
    </div>
    <p className="text-sm leading-7 text-muted">Started includes attempted or solved problems. Attempted records a manual attempt or a reserved run/submission, including execution failures. Solved includes {overall.manualSolved} self-marked and {overall.verifiedEarlier} verified on earlier revisions. Only accepted full-suite submissions verify a solve; visible runs do not. Counts include currently published problems only.</p>
    {!overall.started && <EmptyState title="Start your practice record" description="Open a problem, mark an attempt, or run your code when execution is configured." action={<ButtonLink href="/problems">Browse problems</ButtonLink>} />}
    <Card><CardTitle>Progress by difficulty</CardTitle><CountsTable caption="Difficulty progress" rows={Object.entries(summary.difficulty).map(([label, counts]) => ({ label, counts }))} /></Card>
    <Card><CardTitle>Progress by category</CardTitle><p className="mt-3 text-sm text-muted">A problem can belong to several categories, so category totals overlap.</p>
      {summary.categories.length ? <CountsTable caption="Category progress" rows={summary.categories.map((category) => ({ label: category.name, counts: category.counts }))} /> : <p className="mt-4 text-sm text-muted">No published categories yet.</p>}
    </Card>
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <Card><CardTitle>Recent attempts</CardTitle><p className="mt-3 text-sm text-muted">Your ten latest runs and submissions. Saved source code and test payloads are not shown here.</p>
        {summary.recentAttempts.length ? <ol className="mt-5 space-y-5">{summary.recentAttempts.map((attempt, index) => <li key={index} className="border-t border-line pt-4 text-sm">
          <Link href={`/problems/${attempt.slug}`} className="font-semibold text-accent underline underline-offset-4">{attempt.title}</Link>
          <p className="mt-2">{attempt.mode === "RUN" ? "Visible run" : "Full submission"} · {attempt.status === "QUEUED" ? "Queued" : attempt.status === "RUNNING" ? "Running" : verdictLabels[attempt.status]}</p>
          <p className="mt-1 text-muted">{attempt.completedAt ? `${attempt.passedCount}/${attempt.totalCount} passed` : "No final result yet"} · Revision {attempt.problemRevision}{attempt.problemRevision !== attempt.currentRevision ? " (earlier revision)" : ""}</p>
          <time className="mt-1 block text-xs text-muted" dateTime={attempt.createdAt}>{timeLabel(attempt.createdAt)}</time>
        </li>)}</ol> : <p className="mt-5 text-sm text-muted">No runs or submissions yet. Manual progress appears alongside this list.</p>}
      </Card>
      <Card><CardTitle>Recently updated progress</CardTitle><p className="mt-3 text-sm text-muted">Latest state for ten recently changed problems; this is not a complete event history.</p>
        {summary.recentProgress.length ? <ol className="mt-5 space-y-5">{summary.recentProgress.map((item) => <li key={item.slug} className="border-t border-line pt-4 text-sm">
          <Link href={`/problems/${item.slug}`} className="font-semibold text-accent underline underline-offset-4">{item.title}</Link>
          <p className="mt-2">{progressLabel(item.progress)}{item.progress.reviewLater ? " · Review later" : ""}</p>
          <time className="mt-1 block text-xs text-muted" dateTime={item.updatedAt}>{timeLabel(item.updatedAt)}</time>
        </li>)}</ol> : <p className="mt-5 text-sm text-muted">No progress changes yet.</p>}
      </Card>
    </div>
  </div>;
}
function CountsTable({ caption, rows }: { caption: string; rows: { label: string; counts: ProgressCounts }[] }) {
  return <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm">
    <caption className="sr-only">{caption}</caption>
    <thead><tr>{["Group", "Total", "Attempted", "Solved", "Verified current"].map((label) => <th key={label} scope="col" className="whitespace-nowrap border-b border-line px-3 py-3 font-semibold">{label}</th>)}</tr></thead>
    <tbody>{rows.map(({ label, counts }) => <tr key={label}><th scope="row" className="px-3 py-3 font-medium">{label}</th>{[counts.total, counts.attempted, counts.solved, counts.verifiedCurrent].map((count, index) => <td key={index} className="px-3 py-3 text-muted">{count}</td>)}</tr>)}</tbody>
  </table></div>;
}
