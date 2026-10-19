import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeading } from "@/components/ui/page-heading";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { InterviewSetup } from "@/components/interviews/setup";
import { loadInterviewIndex } from "@/features/interviews/load";
export const metadata: Metadata = { title: "Mock interviews", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function InterviewPage() {
  const { viewer, items } = await loadInterviewIndex();
  return <AppShell signedIn admin={viewer.role === "ADMIN"}><PageHeading eyebrow="Explain your thinking" title="Mock interviews" description="Timed, private practice with original questions and a self-assessment report." />
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card className="p-5 sm:p-6"><h2 className="mb-5 text-base font-semibold">Set up a session</h2><InterviewSetup /></Card>
      <section aria-labelledby="recent-title" className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface">
        <h2 id="recent-title" className="border-b border-line px-4 py-3 text-sm font-semibold">Your latest 20 sessions</h2>
        {!items.length ? <p className="px-4 py-8 text-center text-sm text-muted">Your sessions will appear here after you start one.</p> : <ul className="divide-y divide-line">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-surface-hover">
          <div className="min-w-0 text-sm"><p className="tabular-nums">{item.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC · {item.durationMinutes} minutes · {item.status.replaceAll("_", " ")}</p>
            {item.score !== null && <p className="mt-0.5 text-xs text-muted">Self-assessment {item.score}/100</p>}</div>
          <ButtonLink href={item.status === "IN_PROGRESS" ? `/mock-interview/${item.id}` : `/interview-results/${item.id}`} variant="secondary" size="sm">{item.status === "IN_PROGRESS" ? "Resume / finish" : "View report"}</ButtonLink>
        </li>)}</ul>}
      </section>
    </div>
    <p className="mt-6 text-xs leading-5 text-subtle">One active session at a time; starting again resumes it. Up to 20 new sessions per 24 hours. Scores are personal reflections, not verified solves or hiring predictions.</p>
  </AppShell>;
}
