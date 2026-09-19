import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeading } from "@/components/ui/page-heading";
import { InterviewSession } from "@/components/interviews/session";
import { loadInterview } from "@/features/interviews/load";
export const metadata: Metadata = { title: "Interview session", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const view = await loadInterview((await params).id); if (!view) notFound();
  if (view.session.status !== "IN_PROGRESS") redirect(`/interview-results/${view.session.id}`);
  return <AppShell signedIn admin={view.viewer.role === "ADMIN"}><PageHeading eyebrow="Deliberate practice" title="Your interview session" description="Write your reasoning, code or pseudocode, tradeoffs and checks. Save each response explicitly." /><InterviewSession key={view.session.id} session={view.session} /></AppShell>;
}
