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
