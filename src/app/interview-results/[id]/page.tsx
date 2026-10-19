import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { InterviewDraftReport } from "@/components/interviews/draft-report";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeading } from "@/components/ui/page-heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { loadInterview } from "@/features/interviews/load";
export const metadata: Metadata = { title: "Interview report", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const view = await loadInterview((await params).id, true); if (!view) notFound();
  const { session } = view; if (session.status === "IN_PROGRESS") redirect(`/mock-interview/${session.id}`);
  return <AppShell signedIn admin={view.viewer.role === "ADMIN"}><PageHeading eyebrow="Reflect and improve" title="Interview report" description={session.status === "ABANDONED" ? "Session abandoned. Saved responses remain available; no score was assigned." : `Self-assessment: ${session.score ?? 0}/100. This is your rating of your explanation, not an automated correctness result.`} />
    <InterviewDraftReport session={session} owner={view.viewer.id} />
    {session.status !== "ABANDONED" && <div className="mb-6 flex items-center gap-4 rounded-xl border border-line bg-surface p-5"><p className="text-4xl font-semibold tabular-nums">{session.score ?? 0}<span className="text-base font-normal text-muted"> / 100</span></p><p className="text-sm leading-6 text-muted">Overall self-assessment across {session.questions.length} {session.questions.length === 1 ? "question" : "questions"}.</p></div>}
    <Card><h2 className="text-base font-semibold">How to read this report</h2><p className="mt-2 text-sm leading-7 text-muted">Each question has three self-rated areas worth 0–2 points: reasoning, tradeoffs and checks. Empty areas earn zero, and an area you rated 0 earns zero even if you wrote about it. A question score is its points divided by six, rounded to 100; the overall score averages all question scores, including unanswered questions. Compare your explanation with the reference below and choose one area to practice next. This session does not change problem progress or verified solves.</p></Card>
    <div className="mt-6 space-y-4">{session.questions.map((q) => <Card key={q.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-lg font-semibold tracking-tight">{q.position}. {q.prompt.title}</h2><Badge tone={q.score === null ? "neutral" : q.score >= 67 ? "success" : q.score >= 34 ? "warm" : "danger"}>{q.score === null ? "Not scored" : `Self-assessment ${q.score}/100`}</Badge></div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{q.prompt.statement}</p>
      <p className="mt-3 text-sm text-muted">{q.feedback}</p>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">{([ ["reasoning", "Reasoning and solution"], ["tradeoffs", "Complexity and tradeoffs"], ["checks", "Tests and checks"] ] as const).map(([key, label]) => <section className="min-w-0 rounded-lg border border-line bg-canvas p-3" key={key}><h3 className="text-sm font-semibold">{label}</h3><pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-muted">{q.answer[key] || "No saved response."}</pre></section>)}</div>
      <details className="mt-5 rounded-lg border border-line p-3"><summary className="cursor-pointer text-sm font-semibold">Reference discussion</summary><pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-7">{q.reference}</pre></details>
      {q.prompt.revision !== null && <p className="mt-3 text-xs text-muted">Saved problem revision {q.prompt.revision}. Later library edits do not change this report.</p>}
    </Card>)}</div><div className="mt-6"><ButtonLink href="/mock-interview">Back to interviews</ButtonLink></div>
  </AppShell>;
}
