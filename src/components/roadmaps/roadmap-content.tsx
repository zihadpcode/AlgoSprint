import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge, difficultyText } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { progressLabel } from "@/features/progress/presentation";
import type { RoadmapView } from "@/features/roadmaps/query";

const difficultyName = (value: string) => value[0] + value.slice(1).toLowerCase();
const barClass = "h-1.5 w-full appearance-none overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-surface-hover [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-accent-solid [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-accent-solid";

/** Detailed, honest progress summary used on the roadmap page. */
export function RoadmapProgress({ roadmap }: { roadmap: RoadmapView }) {
  const progress = roadmap.progress;
  if (!progress) return <p className="mt-3 text-sm leading-6 text-muted">Sign in to see your progress. Browsing a step does not mark it solved.</p>;
  return <div className="mt-3 space-y-2.5">
    <p className="flex items-baseline justify-between text-sm font-medium tabular-nums"><span>{progress.solved} / {progress.total} steps recorded solved</span><span className="text-muted">{progress.percent}%</span></p>
    <progress aria-label={`${roadmap.title}: steps recorded solved`} value={progress.solved} max={Math.max(1, progress.total)} className={barClass} />
    <p className="text-xs leading-5 text-muted">{progress.selfMarked} self-marked, {progress.verifiedCurrent} verified on current revisions, {progress.verifiedEarlier} verified on earlier revisions, and {progress.recorded} older recorded solves. {progress.reviewLater} flagged for review.</p>
    <p className="text-xs leading-5 text-subtle">Completion reflects your problem records, not mastery. Earlier verification and manual marks count toward completion.</p>
  </div>;
}

/** Slim progress line for index cards. */
function CardProgress({ roadmap }: { roadmap: RoadmapView }) {
  const progress = roadmap.progress;
  if (!progress) return <p className="text-xs text-subtle">Sign in to track your progress.</p>;
  return <div className="space-y-1.5">
    <p className="flex items-baseline justify-between text-xs tabular-nums text-muted"><span>{progress.solved} / {progress.total} steps solved</span><span>{progress.percent}%</span></p>
    <progress aria-label={`${roadmap.title}: steps recorded solved`} value={progress.solved} max={Math.max(1, progress.total)} className={barClass} />
  </div>;
}

export function RoadmapCard({ roadmap }: { roadmap: RoadmapView }) {
  const started = (roadmap.progress?.solved ?? 0) > 0;
  const finished = roadmap.progress ? roadmap.progress.solved === roadmap.progress.total : false;
  return <Card className="flex h-full flex-col p-4 transition-colors hover:border-line-strong">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      <span className={cn("font-medium", difficultyText(roadmap.difficulty))}>{difficultyName(roadmap.difficulty)}</span>
      <span aria-hidden="true">·</span><span className="tabular-nums">{roadmap.steps.length} steps</span>
      <span aria-hidden="true">·</span><span className="tabular-nums">~{roadmap.estimatedMinutes} min</span>
    </div>
    <h2 className="mt-2 text-base font-semibold tracking-tight [overflow-wrap:anywhere]"><Link href={`/roadmaps/${roadmap.slug}`} className="hover:text-accent">{roadmap.title}</Link></h2>
    <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-muted">{roadmap.description}</p>
    <div className="mt-auto space-y-4 pt-4">
      <CardProgress roadmap={roadmap} />
      <ButtonLink href={`/roadmaps/${roadmap.slug}`} variant={started && !finished ? "primary" : "secondary"} size="sm">
        {finished ? "Review path" : started ? "Continue" : "Open roadmap"}<ArrowRight aria-hidden="true" size={14} />
      </ButtonLink>
    </div>
  </Card>;
}

export function RoadmapNext({ roadmap }: { roadmap: RoadmapView }) {
  const next = roadmap.next;
  return <Card className="p-4">
    <CardTitle>Suggested next step</CardTitle>
    {next ? <div className="mt-3 space-y-3">
      <p className="text-sm leading-6 text-muted">{next.reason}</p>
      <ButtonLink href={`/problems/${next.slug}`}>Step {next.position}: {next.title}<ArrowRight aria-hidden="true" size={14} /></ButtonLink>
    </div> : <p className="mt-3 text-sm leading-6 text-muted">All steps are recorded solved, with no review flags or earlier-revision verification to revisit. You can repeat any step below.</p>}
  </Card>;
}

/** Vertical track: one node per step, a check once solved, and the suggested next step highlighted with Continue. */
export function RoadmapSteps({ roadmap }: { roadmap: RoadmapView }) {
  const nextPosition = roadmap.next?.position;
  return <ol aria-label="Ordered roadmap steps" className="relative">
    {roadmap.steps.map((step, index) => {
      const solved = step.progress?.status === "SOLVED";
      const current = step.position === nextPosition;
      const last = index === roadmap.steps.length - 1;
      return <li key={step.position} className="relative flex gap-4 pb-4 last:pb-0">
        {!last && <span aria-hidden="true" className={cn("absolute top-8 bottom-0 left-[15px] w-px", solved ? "bg-success/40" : "bg-line")} />}
        <span aria-hidden="true" className={cn("relative z-10 mt-1 grid size-8 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums",
          solved ? "border-success/40 bg-success/15 text-success" : current ? "border-accent bg-accent-solid text-white ring-4 ring-accent/15" : "border-line-strong bg-surface-raised text-muted")}>
          {solved ? <Check size={14} strokeWidth={3} /> : step.position}
        </span>
        <div className={cn("min-w-0 flex-1 rounded-xl border p-4 transition-colors", current ? "border-accent/50 bg-accent/5" : "border-line bg-surface hover:border-line-strong")}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-xs font-semibold tracking-wide text-subtle uppercase">Step {step.position}</p>
            {current && <Badge tone="accent">{roadmap.progress ? "Up next" : "Start here"}</Badge>}
          </div>
          <h3 className="mt-1.5 text-base font-semibold [overflow-wrap:anywhere]">{step.title}</h3>
          {step.description && <p className="mt-1.5 text-sm leading-6 whitespace-pre-wrap text-muted">{step.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <Link href={`/problems/${step.problem.slug}`} className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:text-accent [overflow-wrap:anywhere]">{step.problem.title}</Link>
            <span className={cn("text-xs font-medium", difficultyText(step.problem.difficulty))}>{difficultyName(step.problem.difficulty)}</span>
            <span className="text-xs text-muted tabular-nums">About {step.problem.estimatedMinutes} minutes</span>
            {step.progress && <><Badge tone={solved ? "success" : "neutral"}>{progressLabel(step.progress)}</Badge>{step.progress.reviewLater && <Badge tone="warm">Review later</Badge>}</>}
          </div>
          {current && <div className="mt-4"><ButtonLink href={`/problems/${step.problem.slug}`} size="sm">{roadmap.progress ? "Continue" : "Start"}<ArrowRight aria-hidden="true" size={14} /></ButtonLink></div>}
        </div>
      </li>;
    })}
  </ol>;
}
