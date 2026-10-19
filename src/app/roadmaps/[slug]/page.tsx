import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { difficultyText } from "@/components/ui/badge";
import { RoadmapNext, RoadmapProgress, RoadmapSteps } from "@/components/roadmaps/roadmap-content";
import { loadRoadmap } from "@/features/roadmaps/load";

export const metadata: Metadata = { title: "Learning track", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function RoadmapPage({ params }: { params: Promise<{ slug: string }> }) {
  const view = await loadRoadmap((await params).slug);
  if (view.kind === "not-found") notFound();
  if (view.kind === "unavailable") return <AppShell>
    <PageHeading title="Roadmaps are being prepared" description="Please check back when the collection is available." />
    <ButtonLink href="/roadmaps" variant="secondary">Back to roadmaps</ButtonLink>
  </AppShell>;
  const { roadmap } = view;
  const difficulty = roadmap.difficulty[0] + roadmap.difficulty.slice(1).toLowerCase();
  return <AppShell signedIn={view.signedIn} admin={view.admin}>
    <Link href="/roadmaps" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"><ArrowLeft aria-hidden="true" size={14} />Learning tracks</Link>
    <PageHeading title={roadmap.title} description={roadmap.description} />
    <p className="mb-5 -mt-3 flex flex-wrap items-center gap-x-2 text-sm text-muted"><span className={`font-medium ${difficultyText(roadmap.difficulty)}`}>{difficulty}</span><span aria-hidden="true">·</span><span className="tabular-nums">{roadmap.steps.length} steps</span><span aria-hidden="true">·</span><span>About {roadmap.estimatedMinutes} minutes, including reflection</span></p>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <aside aria-label="Roadmap summary" className="space-y-4 lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1">
        <Card className="p-4"><CardTitle>Your roadmap progress</CardTitle><RoadmapProgress roadmap={roadmap} />
          {!view.signedIn && <div className="mt-4"><ButtonLink href={`/login?next=${encodeURIComponent(`/roadmaps/${roadmap.slug}`)}`} size="sm">Sign in to track this path</ButtonLink></div>}
        </Card>
        <RoadmapNext roadmap={roadmap} />
      </aside>
      <section aria-labelledby="track-heading" className="lg:col-start-1 lg:row-start-1">
        <h2 id="track-heading" className="mb-1 text-base font-semibold">Practice in this order</h2>
        <p className="mb-5 text-sm leading-6 text-muted">No enrollment or step locking. Solve or update progress on the problem page, then return here. Shared problems carry the same progress in every path.</p>
        <RoadmapSteps roadmap={roadmap} />
      </section>
    </div>
  </AppShell>;
}
