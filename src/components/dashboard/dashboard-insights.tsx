import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { difficultyText } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { verdictLabels } from "@/features/submissions/contracts";
import type { DashboardInsights as Insights } from "@/features/dashboard/query";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" });
const note = "mt-1.5 text-xs leading-5 text-muted";
const empty = "mt-4 text-sm text-muted";
const row = "border-t border-line pt-3 first:border-t-0 first:pt-0";
const link = "font-medium text-ink underline decoration-line-strong underline-offset-4 hover:text-accent";
const difficultyName = (value: string) => value[0] + value.slice(1).toLowerCase();

export function DashboardInsights({ insights }: { insights: Insights }) {
  return <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
    <Card><CardTitle>Recommended next problems</CardTitle>
      <p className={note}>Your review marks come first, followed by revised problems, unresolved wrong answers and unfinished attempts. New problems in topics to revisit come next. Within each group, easier problems appear first.</p>
      {insights.recommendations.length ? <ol className="mt-4 space-y-3">{insights.recommendations.map((item) => <li key={item.slug} className={row}>
        <div className="flex items-baseline justify-between gap-3"><Link href={`/problems/${item.slug}`} className={link}>{item.title}</Link>
          <span className={cn("shrink-0 text-xs font-medium", difficultyText(item.difficulty))}>{difficultyName(item.difficulty)}</span></div>
        <p className="mt-1 text-xs leading-5 text-muted">{item.reason}</p>
      </li>)}</ol> : <p className={empty}>No next problem to suggest from the published collection. You can revisit a solved problem from the library or mark it for review.</p>}
    </Card>
    <Card><CardTitle>Topics to revisit</CardTitle>
      <p className={note}>Prioritized from your review flags or at least two distinct unsolved problems whose latest completed full submission returned Wrong answer on the current revision. These are practice signals, not a skill score. Categories can overlap.</p>
      {insights.topics.length ? <ul className="mt-4 space-y-3">{insights.topics.map((topic) => <li key={topic.slug} className={row}>
        <p className="text-sm font-medium">{topic.name}</p><p className="mt-1 text-xs text-muted">{topic.reviewCount} marked for review · {topic.unresolvedCount} unresolved wrong-answer problems</p>
      </li>)}</ul> : <p className={empty}>No topic signal yet. Mark a problem for review when you want to revisit it; low completion alone does not identify a weak topic.</p>}
    </Card>
    <Card className="lg:col-span-2"><CardTitle>Recent full submissions</CardTitle>
      <p className={note}>Your five latest full-suite submissions for published problems. Visible-only runs are on your progress page.</p>
      {insights.recentSubmissions.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[34rem] text-left text-sm">
        <caption className="sr-only">Recent full submissions</caption>
        <thead><tr className="text-xs text-muted">{["Problem", "Result", "Passed", "Submitted"].map((label) => <th key={label} scope="col" className="h-9 border-b border-line px-2 font-medium first:pl-0 last:pr-0">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{insights.recentSubmissions.map((item, index) => <tr key={index} className="align-top">
          <td className="px-2 py-2.5 first:pl-0">
            <Link href={`/problems/${item.slug}`} className={link}>{item.title}</Link>
            <p className="mt-1 text-xs text-muted">Revision {item.problemRevision}{item.problemRevision !== item.currentRevision ? " (earlier revision)" : ""}</p>
          </td>
          <td className={cn("px-2 py-2.5 font-medium", item.status === "ACCEPTED" ? "text-success" : item.status === "QUEUED" || item.status === "RUNNING" ? "text-muted" : "text-danger")}>
            {item.status === "QUEUED" ? "Queued" : item.status === "RUNNING" ? "Running" : verdictLabels[item.status]}</td>
          <td className="px-2 py-2.5 text-muted tabular-nums">{item.completedAt ? `${item.passedCount}/${item.totalCount} passed` : "No final result yet"}</td>
          <td className="px-2 py-2.5 last:pr-0"><time dateTime={item.createdAt} className="text-xs text-muted">{when(item.createdAt)} UTC</time></td>
        </tr>)}</tbody></table>
        <p className="mt-2 text-xs text-subtle">A submission result does not replace the current solve label.</p></div>
        : <p className={empty}>No full submissions yet. Manual solve marks and visible runs do not create full submissions.</p>}
    </Card>
    <Card><CardTitle>Practice streak</CardTitle>
      {insights.streak.activeDays === 0 ? <p className="mt-3 text-sm font-medium">No saved practice yet</p>
        : <p className="mt-3 text-2xl font-semibold tabular-nums text-accent">{insights.streak.current === 0 ? "No current streak" : `${insights.streak.current} ${insights.streak.current === 1 ? "day" : "days"}`}</p>}
      <p className={note}>Consecutive UTC days with saved practice. A streak stays alive until the end of the day after your last practice day.
        {insights.streak.activeDays > 0 && <> {insights.streak.activeToday ? "You have practised today. " : "You have not practised yet today. "}Longest streak: {insights.streak.longest} {insights.streak.longest === 1 ? "day" : "days"} across {insights.streak.activeDays} {insights.streak.activeDays === 1 ? "practice day" : "practice days"}.</>}
      </p>
      <p className="mt-2 text-xs leading-5 text-subtle">A day counts when you save a first attempt, a solve, or run or submit code on the server. Marking the same problem attempted again does not add a day, and visible-test runs in your browser are not saved.</p>
    </Card>
    <Card><CardTitle>Strongest topics</CardTitle>
      <p className={note}>Categories where you have the most current verified solves, then the most solves overall. A category needs at least two solves to appear. This is a practice signal, not a skill score, and categories overlap.</p>
      {insights.strongest.length ? <ul className="mt-4 space-y-3">{insights.strongest.map((topic) => <li key={topic.slug} className={row}>
        <p className="text-sm font-medium">{topic.name}</p><p className="mt-1 text-xs text-muted">{topic.solved} of {topic.total} solved · {topic.verifiedCurrent} verified on the current revision</p>
      </li>)}</ul> : <p className={empty}>No strongest topic yet. Solve at least two problems in a category and it will appear here.</p>}
    </Card>
    <Card className="lg:col-span-2"><CardTitle>Mock interview scores</CardTitle>
      <p className={note}>Your five latest completed mock interviews. Scores are your own ratings of your reasoning, tradeoffs and checks. They are not correctness grades and do not mark any problem solved.</p>
      {insights.interviews.recent.length ? <>
        <p className="mt-3 text-sm font-medium">Average of these {insights.interviews.recent.length}: <span className="tabular-nums">{insights.interviews.average}%</span></p>
        <ol className="mt-3 space-y-3">{insights.interviews.recent.map((item) => <li key={item.id} className={cn(row, "text-sm")}>
          <Link href={`/interview-results/${item.id}`} className={link}>Self-assessed score {item.score}%</Link>
          <p className="mt-1 text-xs text-muted">{item.durationMinutes}-minute session</p>
          <time dateTime={item.completedAt} className="mt-1 block text-xs text-subtle">{when(item.completedAt)} UTC</time>
        </li>)}</ol></> : <p className={empty}>No completed mock interviews yet. <Link href="/mock-interview" className="text-accent underline underline-offset-4">Start a timed session</Link> to build a score history.</p>}
    </Card>
  </div>;
}
