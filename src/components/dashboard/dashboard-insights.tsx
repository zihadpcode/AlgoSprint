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
    <Card><CardTitle>Practice streak</CardTitle>
      {insights.streak.activeDays === 0 ? <p className="mt-3 font-medium">No saved practice yet</p>
        : <p className="mt-3 text-3xl font-semibold tabular-nums text-accent">{insights.streak.current === 0 ? "No current streak" : `${insights.streak.current} ${insights.streak.current === 1 ? "day" : "days"}`}</p>}
      <p className="mt-3 text-sm leading-7 text-muted">Consecutive UTC days with saved practice. A streak stays alive until the end of the day after your last practice day.
        {insights.streak.activeDays > 0 && <> {insights.streak.activeToday ? "You have practised today. " : "You have not practised yet today. "}Longest streak: {insights.streak.longest} {insights.streak.longest === 1 ? "day" : "days"} across {insights.streak.activeDays} {insights.streak.activeDays === 1 ? "practice day" : "practice days"}.</>}
      </p>
      <p className="mt-3 text-xs leading-6 text-muted">A day counts when you save a first attempt, a solve, or run or submit code on the server. Marking the same problem attempted again does not add a day, and visible-test runs in your browser are not saved.</p>
    </Card>
    <Card><CardTitle>Strongest topics</CardTitle>
      <p className="mt-3 text-sm leading-7 text-muted">Categories where you have the most current verified solves, then the most solves overall. A category needs at least two solves to appear. This is a practice signal, not a skill score, and categories overlap.</p>
      {insights.strongest.length ? <ul className="mt-5 space-y-4">{insights.strongest.map((topic) => <li key={topic.slug} className="border-t border-line pt-4">
        <p className="font-semibold">{topic.name}</p><p className="mt-2 text-sm text-muted">{topic.solved} of {topic.total} solved · {topic.verifiedCurrent} verified on the current revision</p>
      </li>)}</ul> : <p className="mt-5 text-sm text-muted">No strongest topic yet. Solve at least two problems in a category and it will appear here.</p>}
    </Card>
    <Card><CardTitle>Mock interview scores</CardTitle>
      <p className="mt-3 text-sm leading-7 text-muted">Your five latest completed mock interviews. Scores are your own ratings of your reasoning, tradeoffs and checks. They are not correctness grades and do not mark any problem solved.</p>
      {insights.interviews.recent.length ? <>
        <p className="mt-4 text-sm font-medium">Average of these {insights.interviews.recent.length}: <span className="tabular-nums">{insights.interviews.average}%</span></p>
        <ol className="mt-3 space-y-4">{insights.interviews.recent.map((item) => <li key={item.id} className="border-t border-line pt-4 text-sm">
          <Link href={`/interview-results/${item.id}`} className="font-semibold text-accent underline underline-offset-4">Self-assessed score {item.score}%</Link>
          <p className="mt-1 text-muted">{item.durationMinutes}-minute session</p>
          <time dateTime={item.completedAt} className="mt-2 block text-xs text-muted">{new Date(item.completedAt).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC</time>
        </li>)}</ol></> : <p className="mt-5 text-sm text-muted">No completed mock interviews yet. <Link href="/mock-interview" className="text-accent underline underline-offset-4">Start a timed session</Link> to build a score history.</p>}
    </Card>
  </div>;
}
