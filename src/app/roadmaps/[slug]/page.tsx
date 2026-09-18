import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoadmapNext, RoadmapProgress, RoadmapSteps } from "@/components/roadmaps/roadmap-content";
import { loadRoadmap } from "@/features/roadmaps/load";

export const metadata: Metadata = { title: "Learning path", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function RoadmapPage({ params }: { params: Promise<{ slug: string }> }) {
  const view = await loadRoadmap((await params).slug);
  if (view.kind === "not-found") notFound();
  if (view.kind === "unavailable") return <AppShell>
    <PageHeading eyebrow="Learning path" title="Roadmaps are being prepared" description="Please check back when the collection is available." />
    <ButtonLink href="/roadmaps" variant="secondary">Back to roadmaps</ButtonLink>
  </AppShell>;
  const { roadmap } = view;
  return <AppShell signedIn={view.signedIn} admin={view.admin}>
    <Link href="/roadmaps" className="mb-6 inline-block text-sm font-semibold text-accent hover:underline">← Learning roadmaps</Link>
    <PageHeading eyebrow="Read · practice · connect" title={roadmap.title} description={roadmap.description} />
    <div className="mb-6 flex flex-wrap items-center gap-3"><Badge>{roadmap.difficulty}</Badge><p className="text-sm text-muted">{roadmap.steps.length} steps · About {roadmap.estimatedMinutes} minutes, including reflection</p></div>
    <div className="mb-8 grid items-start gap-6 xl:grid-cols-2">
      <Card><CardTitle>Your roadmap progress</CardTitle><RoadmapProgress roadmap={roadmap} />
        {!view.signedIn && <div className="mt-4"><ButtonLink href={`/login?next=${encodeURIComponent(`/roadmaps/${roadmap.slug}`)}`}>Sign in to track this path</ButtonLink></div>}
      </Card>
      <RoadmapNext roadmap={roadmap} />
    </div>
    <h2 className="mb-3 text-xl font-semibold">Practice in this order</h2>
    <p className="mb-6 text-sm leading-7 text-muted">No enrollment or step locking. Solve or update progress on the problem page, then return here. Shared problems carry the same progress in every path.</p>
    <RoadmapSteps roadmap={roadmap} />
  </AppShell>;
}
