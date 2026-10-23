import Link from "next/link";
import { ArrowLeft, Clock, SlidersHorizontal } from "lucide-react";
import { Badge, DifficultyBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { HintReveal } from "@/components/problems/hint-reveal";
import { SolutionTabs } from "@/components/problems/solution-tabs";
import { StarterCode } from "@/components/problems/starter-code";
import { WorkspaceVideoLessons } from "./video-lessons";
import { ProblemNotes, ProgressControls } from "@/components/problems/personal-controls";
import type { ProblemDetail } from "@/features/problems/detail-query";
import { progressLabel } from "@/features/progress/presentation";
import { Popover } from "./popover";
import { Snippet, formatValue } from "./snippet";
import { SubmissionsTab, type SubmissionsState } from "./submissions-list";

const heading = "text-xs font-semibold tracking-wide text-subtle uppercase";

/** Left panel of the coding workspace: header, then Description / Hints & Editorial / Submissions / Notes. */
export function ProblemPanel({ problem, submissions, loginHref }: { problem: ProblemDetail; submissions: SubmissionsState; loginHref: string }) {
  const personal = problem.personal;
  const description = <div className="space-y-6">
    <section aria-labelledby="statement-heading">
      <h2 id="statement-heading" className="sr-only">Problem statement</h2>
      <p className="text-sm leading-7 whitespace-pre-wrap text-ink/90">{problem.statement}</p>
    </section>
    {problem.examples.length > 0 && <section aria-labelledby="examples-heading" className="space-y-4">
      <h2 id="examples-heading" className={heading}>Examples</h2>
      <ol className="space-y-4">
        {problem.examples.map((example, index) => <li key={example.position} className="space-y-2.5 rounded-lg border border-line bg-surface-raised/40 p-3">
          <h3 className="text-sm font-semibold">Example {index + 1}</h3>
          <Snippet label="Input" ariaLabel={`Example ${index + 1} input`} code={formatValue(example.input)} />
          <Snippet label="Output" ariaLabel={`Example ${index + 1} expected output`} code={formatValue(example.output)} />
          {example.explanation && <p className="text-xs leading-6 text-muted"><span className="font-semibold text-ink/80">Explanation: </span>{example.explanation}</p>}
        </li>)}
      </ol>
    </section>}
    <section aria-labelledby="constraints-heading" className="space-y-2">
      <h2 id="constraints-heading" className={heading}>Constraints</h2>
      <ul className="space-y-1.5 rounded-lg border border-line border-l-2 border-l-accent-solid bg-surface-raised/40 py-3 pr-3 pl-4">
        {problem.constraints.map((constraint, index) => <li key={index} className="font-mono text-xs leading-6 text-muted [overflow-wrap:anywhere]">{constraint}</li>)}
      </ul>
    </section>
    {problem.tags.length > 0 && <section aria-labelledby="tags-heading" className="space-y-2">
      <h2 id="tags-heading" className={heading}>Tags</h2>
      <ul className="flex flex-wrap gap-1.5">{problem.tags.map((tag) => <li key={tag.slug}><Badge>{tag.name}</Badge></li>)}</ul>
    </section>}
    <section aria-labelledby="related-heading" className="space-y-2">
      <h2 id="related-heading" className={heading}>Related problems</h2>
      {problem.related.length ? <ul className="divide-y divide-line rounded-lg border border-line">
        {problem.related.map((related) => <li key={related.slug}><Link href={`/problems/${related.slug}`} className="flex h-11 items-center justify-between gap-3 px-3 text-sm transition-colors hover:bg-surface-hover">
          <span className="truncate font-medium">{related.title}</span><DifficultyBadge difficulty={related.difficulty} /></Link></li>)}
      </ul> : <p className="text-sm text-muted">No related challenges are linked yet. <Link href="/problems" className="text-accent underline underline-offset-4">Browse the library</Link>.</p>}
    </section>
  </div>;
  const hints = <div className="space-y-6">
    <section aria-labelledby="hints-heading"><h2 id="hints-heading" className={heading}>Layered hints</h2><HintReveal key={problem.slug} hints={problem.hints} /></section>
    {(problem.videos.length > 0 || problem.walkthroughs.length > 0) && <section aria-labelledby="video-heading"><h2 id="video-heading" className={heading}>Video lessons</h2><WorkspaceVideoLessons key={problem.slug} videos={problem.videos} walkthroughs={problem.walkthroughs} /></section>}
    <section aria-labelledby="solutions-heading"><h2 id="solutions-heading" className={heading}>Guided solutions</h2><SolutionTabs key={problem.slug} solutions={problem.solutions} /></section>
    <details className="rounded-lg border border-line">
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-muted hover:text-ink">Starter code reference</summary>
      <div className="px-3 pb-3"><StarterCode key={problem.slug} entries={problem.starterCode} /></div>
    </details>
  </div>;
  const attempts = <SubmissionsTab submissions={submissions} loginHref={loginHref} />;
  const notes = personal ? <ProblemNotes key={problem.slug} slug={problem.slug} note={personal.note} />
    : <div className="space-y-3 rounded-lg border border-dashed border-line px-4 py-8 text-center"><p className="text-sm text-muted">Keep your own explanation and questions in a private note.</p><ButtonLink href={loginHref} variant="secondary" size="sm">Sign in to write notes</ButtonLink></div>;
  return <>
    <header className="shrink-0 space-y-2.5 border-b border-line px-4 pt-3 pb-3">
      <div className="flex items-center justify-between gap-2">
        <Link href="/problems" className="inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-ink"><ArrowLeft aria-hidden="true" size={13} />Problems</Link>
        {personal
          ? <Popover label="Progress and bookmarks" icon={<SlidersHorizontal aria-hidden="true" size={14} />} text={progressLabel(personal.progress)} align="end" panelClassName="max-h-[70dvh] w-72 overflow-y-auto">
            <ProgressControls slug={problem.slug} progress={personal.progress} bookmarked={personal.bookmarked} />
          </Popover>
          : <ButtonLink href={loginHref} size="sm" variant="quiet" className="text-accent">Sign in to save progress</ButtonLink>}
      </div>
      <h1 className="text-lg leading-snug font-semibold tracking-tight">{problem.title}</h1>
      <div className="flex flex-wrap items-center gap-1.5">
        <DifficultyBadge difficulty={problem.difficulty} />
        {problem.categories.map((category) => <Badge key={category.slug}>{category.name}</Badge>)}
        <span className="inline-flex items-center gap-1 text-xs text-subtle"><Clock aria-hidden="true" size={12} />About {problem.estimatedMinutes} min</span>
      </div>
    </header>
    <Tabs label="Problem sections" className="min-h-0 flex-1" panelClassName="p-4 lg:overflow-y-auto" listClassName="bg-surface"
      items={[
        { id: "description", label: "Description", content: description },
        { id: "hints", label: "Hints & Editorial", content: hints },
        { id: "submissions", label: "Submissions", badge: Array.isArray(submissions) && submissions.length ? <span className="rounded bg-surface-hover px-1.5 text-[0.6875rem] text-muted tabular-nums">{submissions.length}</span> : undefined, content: attempts },
        { id: "notes", label: "Notes", content: notes },
      ]} />
  </>;
}
