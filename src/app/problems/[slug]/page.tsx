import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CodeBlock } from "@/components/problems/code-block";
import { HintReveal } from "@/components/problems/hint-reveal";
import { SolutionTabs } from "@/components/problems/solution-tabs";
import { StarterCode } from "@/components/problems/starter-code";
import { CodeEditor } from "@/components/editor/code-editor";
import { ProblemNotes, ProgressControls } from "@/components/problems/personal-controls";
import { loadProblem } from "@/features/problems/detail-load";

export const metadata: Metadata = { title: "Problem practice", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ProblemPage({ params }: { params: Promise<{ slug: string }> }) {
  const view = await loadProblem((await params).slug);
  if (view.kind === "not-found") notFound();
  if (view.kind === "unavailable") return <AppShell>
    <PageHeading eyebrow="Problem practice" title="Practice is being prepared" description="Please check back when the collection is available." />
    <ButtonLink href="/problems" variant="secondary">Back to problem library</ButtonLink>
  </AppShell>;
  const { problem } = view;
  const loginHref = `/login?next=${encodeURIComponent(`/problems/${problem.slug}`)}`;
  return <AppShell signedIn={view.signedIn} admin={view.admin}>
    <Link href="/problems" className="mb-6 inline-block text-sm font-semibold text-accent hover:underline">← Problem library</Link>
    <PageHeading eyebrow="Read · reason · explain" title={problem.title}
      description={`Practice ${problem.pattern.replaceAll("-", " ")}. Allow about ${problem.estimatedMinutes} minutes.`} />
    <div className="mb-6 flex flex-wrap gap-2"><Badge tone={problem.difficulty === "HARD" ? "warm" : "accent"}>{problem.difficulty}</Badge>
      {problem.categories.map((category) => <Badge key={category.slug}>{category.name}</Badge>)}
    </div>
    <nav aria-label="Problem sections" className="mb-8 flex flex-wrap gap-x-5 gap-y-3 text-sm text-accent">
      {[["statement", "Statement"], ["examples", "Examples"], ["constraints", "Constraints"], ["editor", "Code editor"], ["hints", "Hints"], ["solutions", "Solutions"], ["starter", "Starter code"], ["notes", "Notes"]].map(([id, label]) => <a key={id} href={`#${id}`} className="underline underline-offset-4">{label}</a>)}
    </nav>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,1fr)]">
      <div className="min-w-0 space-y-6">
        <Card id="statement"><CardTitle>Problem statement</CardTitle><p className="mt-4 whitespace-pre-wrap leading-8 text-muted">{problem.statement}</p>
          {problem.tags.length > 0 && <p className="mt-5 text-xs text-muted">Tags: {problem.tags.map((tag) => tag.name).join(", ")}</p>}
        </Card>
        <Card id="examples"><CardTitle>Examples</CardTitle><ol className="mt-5 space-y-7">
          {problem.examples.map((example, index) => <li key={example.position} className="space-y-4">
            <h3 className="font-semibold text-accent">Example {index + 1}</h3>
            <CodeBlock label={`Example ${index + 1} input`} code={JSON.stringify(example.input, null, 2)} />
            <CodeBlock label={`Example ${index + 1} expected output`} code={JSON.stringify(example.output, null, 2)} />
            <p className="text-sm leading-7 text-muted">{example.explanation}</p>
          </li>)}
        </ol></Card>
        <Card id="constraints"><CardTitle>Constraints</CardTitle><ul className="mt-4 list-disc space-y-3 pl-5 font-mono text-sm leading-7 text-muted">
          {problem.constraints.map((constraint, index) => <li key={index} className="[overflow-wrap:anywhere]">{constraint}</li>)}
        </ul></Card>
        <Card id="editor"><CardTitle>Code editor</CardTitle><CodeEditor key={problem.slug} starters={problem.starterCode} examples={problem.examples} /></Card>
        <Card id="hints"><CardTitle>Layered hints</CardTitle><HintReveal key={problem.slug} hints={problem.hints} /></Card>
        <Card id="solutions"><CardTitle>Guided solutions</CardTitle><SolutionTabs key={problem.slug} solutions={problem.solutions} /></Card>
      </div>
      <aside aria-label="Practice tools" className="min-w-0 space-y-6">
        <Card><CardTitle>Your progress</CardTitle>{problem.personal ? <ProgressControls slug={problem.slug} progress={problem.personal.progress} /> :
          <div className="mt-4 space-y-4"><p className="text-sm leading-7 text-muted">Sign in to mark a problem solved or save it for review.</p><ButtonLink href={loginHref}>Sign in to save progress</ButtonLink></div>}
        </Card>
        <Card id="starter"><CardTitle>Starter code</CardTitle><StarterCode key={problem.slug} entries={problem.starterCode} /></Card>
        <Card id="notes"><CardTitle>Your notes</CardTitle>{problem.personal ? <ProblemNotes key={problem.slug} slug={problem.slug} note={problem.personal.note} /> :
          <div className="mt-4 space-y-4"><p className="text-sm leading-7 text-muted">Keep your own explanation and questions in a private note.</p><ButtonLink href={loginHref} variant="secondary">Sign in to write notes</ButtonLink></div>}
        </Card>
        <Card><CardTitle>Related problems</CardTitle><p className="mt-3 text-xs leading-6 text-muted">Linked challenges or problems that share a topic.</p>{problem.related.length ? <ul className="mt-4 space-y-4">
          {problem.related.map((related) => <li key={related.slug}><Link href={`/problems/${related.slug}`} className="font-semibold text-accent underline underline-offset-4">{related.title}</Link><p className="mt-1 text-xs text-muted">{related.difficulty}</p></li>)}
        </ul> : <div className="mt-4"><EmptyState title="Keep exploring" description="No related challenges are linked yet." action={<ButtonLink href="/problems" variant="secondary">Browse the library</ButtonLink>} /></div>}</Card>
      </aside>
    </div>
  </AppShell>;
}
