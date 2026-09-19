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
    <Card><h2 className="mb-5 text-xl font-semibold">Set up a session</h2><InterviewSetup /></Card>
    <h2 className="mt-8 mb-4 text-xl font-semibold">Your latest 20 sessions</h2>
    {!items.length ? <p className="text-muted">Your sessions will appear here after you start one.</p> : <ul className="space-y-3">{items.map((item) => <li key={item.id}><Card><p className="mb-3 text-sm">{item.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC · {item.durationMinutes} minutes · {item.status.replaceAll("_", " ")}{item.score !== null && ` · Self-assessment ${item.score}/100`}</p><ButtonLink href={item.status === "IN_PROGRESS" ? `/mock-interview/${item.id}` : `/interview-results/${item.id}`} variant="secondary">{item.status === "IN_PROGRESS" ? "Resume / finish" : "View report"}</ButtonLink></Card></li>)}</ul>}
    <p className="mt-6 text-sm text-muted">One active session at a time; starting again resumes it. Up to 20 new sessions per 24 hours. Scores are personal reflections, not verified solves or hiring predictions.</p>
  </AppShell>;
}
