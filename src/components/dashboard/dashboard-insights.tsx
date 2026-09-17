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
      <p className="mt-3 text-sm leading-7 text-muted">Review marks first, then earlier verified revisions, wrong answers, unfinished attempts and new problems. Ties favor easier problems, then a stable slug order.</p>
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
