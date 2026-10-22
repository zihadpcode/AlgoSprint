import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeading } from "@/components/ui/page-heading";
import { ButtonLink } from "@/components/ui/button";
import { CodeEditor } from "@/components/editor/code-editor";
import type { SubmissionsState } from "@/components/workspace/submissions-list";
import { ProblemPanel } from "@/components/workspace/problem-panel";
import { SplitPane } from "@/components/workspace/split-pane";
import { StudyLanguageProvider } from "@/components/workspace/study-language";
import { getRunnerConfig } from "@/features/submissions/config";
import { runnerSupports } from "@/features/submissions/harness";
import { supportedRunnerLanguages } from "@/features/submissions/runner-languages";
import { SIGNATURES } from "@/features/submissions/signatures";
import { queryProblemSubmissions } from "@/features/submissions/history-query";
import { loadProblem } from "@/features/problems/detail-load";
import { getDatabase } from "@/lib/prisma";

export const metadata: Metadata = { title: "Problem practice", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ProblemPage({ params }: { params: Promise<{ slug: string }> }) {
  const view = await loadProblem((await params).slug);
  if (view.kind === "not-found") notFound();
  if (view.kind === "unavailable") return <AppShell>
    <PageHeading eyebrow="Problem practice" title="Practice is being prepared" description="Please check back when the collection is available." />
    <ButtonLink href="/problems" variant="secondary">Back to problem library</ButtonLink>
  </AppShell>;
  const { problem } = view;
  const runnerConfig = getRunnerConfig();
  const loginHref = `/login?next=${encodeURIComponent(`/problems/${problem.slug}`)}`;
  // Owner-scoped: draftOwner is the verified session's user id; guests get no history at all.
  // A history lookup failure must not take down the problem: show "unavailable" in that tab only.
  let submissions: SubmissionsState = null;
  if (view.draftOwner) {
    try { submissions = await queryProblemSubmissions(getDatabase(), view.draftOwner, problem.slug); }
    catch { submissions = "unavailable"; }
  }
  return <AppShell signedIn={view.signedIn} admin={view.admin} layout="workspace">
    <StudyLanguageProvider key={`${view.draftOwner ?? "guest"}:${problem.slug}:${problem.revision}`} languages={problem.starterCode.map((starter) => starter.language)}>
    <SplitPane
      left={<ProblemPanel problem={problem} submissions={submissions} loginHref={loginHref} />}
      right={<CodeEditor key={`${view.draftOwner ?? "guest"}:${problem.slug}:${problem.revision}`} draftOwner={view.draftOwner} revision={problem.revision} starters={problem.starterCode} examples={problem.examples} slug={problem.slug} signedIn={view.signedIn} runnerEnabled={Boolean(runnerConfig) && runnerSupports(problem.slug)} runnerLanguages={supportedRunnerLanguages(runnerConfig)} signature={runnerSupports(problem.slug) ? SIGNATURES[problem.slug] : undefined} />} />
    </StudyLanguageProvider>
  </AppShell>;
}
