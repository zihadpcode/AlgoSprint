import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeading } from "@/components/ui/page-heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RoadmapProgress } from "@/components/roadmaps/roadmap-content";
import { loadRoadmaps, roadmapPage } from "@/features/roadmaps/load";

export const metadata: Metadata = { title: "Learning roadmaps", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const pageHref = (page: number) => page > 1 ? `/roadmaps?page=${page}` : "/roadmaps";

export default async function RoadmapsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const page = roadmapPage((await searchParams).page);
  const view = await loadRoadmaps(page);
  if (view.kind === "ready" && view.result.page !== page) redirect(pageHref(view.result.page));
  return <AppShell signedIn={view.signedIn} admin={view.admin}>
    <PageHeading eyebrow="Build on what you learn" title="Learning roadmaps" description="Short, original paths through related problems. Follow the suggested order or revisit any step." />
    {view.kind === "unavailable" ? <EmptyState title="Roadmaps are being prepared" description="Learning paths will appear when the collection is available." /> : !view.result.items.length ?
      <EmptyState title="No roadmaps available yet" description="A path appears here when it and every linked problem are published." action={<ButtonLink href="/problems">Browse problems</ButtonLink>} /> : <>
        {!view.signedIn && <p className="mb-6 text-sm leading-7 text-muted"><Link href={`/login?next=${encodeURIComponent(pageHref(page))}`} className="font-semibold text-accent underline underline-offset-4">Sign in</Link> for personal progress and a suggested next step.</p>}
        <ul aria-label="Learning roadmaps" className="grid gap-6 xl:grid-cols-2">
          {view.result.items.map((roadmap) => <li key={roadmap.slug} className="min-w-0"><Card className="h-full">
            <div className="flex flex-wrap items-center gap-3"><Badge>{roadmap.difficulty}</Badge><span className="text-xs text-muted">{roadmap.steps.length} steps · About {roadmap.estimatedMinutes} minutes</span></div>
            <h2 className="mt-4 text-xl font-semibold [overflow-wrap:anywhere]"><Link href={`/roadmaps/${roadmap.slug}`} className="text-accent hover:underline">{roadmap.title}</Link></h2>
            <p className="mt-3 text-sm leading-7 text-muted">{roadmap.description}</p>
            <RoadmapProgress roadmap={roadmap} />
            <div className="mt-5"><ButtonLink href={`/roadmaps/${roadmap.slug}`} variant="secondary">Open roadmap</ButtonLink></div>
          </Card></li>)}
        </ul>
        {view.result.pages > 1 && <nav aria-label="Roadmap pages" className="mt-8 flex flex-wrap items-center gap-4">
          {page > 1 && <ButtonLink href={pageHref(page - 1)} variant="secondary">Previous page</ButtonLink>}
          <p className="text-sm text-muted">Page {page} of {view.result.pages}</p>
          {page < view.result.pages && <ButtonLink href={pageHref(page + 1)} variant="secondary">Next page</ButtonLink>}
        </nav>}
        <p className="mt-8 text-sm leading-7 text-muted">Time estimates are planning guides, not deadlines. Progress is shared with each problem wherever it appears; totals across paths can overlap.</p>
      </>}
  </AppShell>;
}
