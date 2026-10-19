import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeading } from "@/components/ui/page-heading";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RoadmapCard } from "@/components/roadmaps/roadmap-content";
import { loadRoadmaps, roadmapPage } from "@/features/roadmaps/load";

export const metadata: Metadata = { title: "Learning tracks", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const pageHref = (page: number) => page > 1 ? `/roadmaps?page=${page}` : "/roadmaps";

export default async function RoadmapsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const page = roadmapPage((await searchParams).page);
  const view = await loadRoadmaps(page);
  if (view.kind === "ready" && view.result.page !== page) redirect(pageHref(view.result.page));
  return <AppShell signedIn={view.signedIn} admin={view.admin}>
    <PageHeading title="Learning tracks" description="Short, original paths through related problems. Follow the suggested order or revisit any step." />
    {view.kind === "unavailable" ? <EmptyState title="Roadmaps are being prepared" description="Learning paths will appear when the collection is available." /> : !view.result.items.length ?
      <EmptyState title="No roadmaps available yet" description="A path appears here when it and every linked problem are published." action={<ButtonLink href="/problems">Browse problems</ButtonLink>} /> : <>
        {!view.signedIn && <p className="mb-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted"><Link href={`/login?next=${encodeURIComponent(pageHref(page))}`} className="font-medium text-accent underline underline-offset-4">Sign in</Link> for personal progress and a suggested next step.</p>}
        <ul aria-label="Learning roadmaps" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {view.result.items.map((roadmap) => <li key={roadmap.slug} className="min-w-0"><RoadmapCard roadmap={roadmap} /></li>)}
        </ul>
        {view.result.pages > 1 && <nav aria-label="Roadmap pages" className="mt-6 flex flex-wrap items-center gap-4">
          {page > 1 && <ButtonLink href={pageHref(page - 1)} variant="secondary" size="sm">Previous page</ButtonLink>}
          <p className="text-xs text-muted tabular-nums">Page {page} of {view.result.pages}</p>
          {page < view.result.pages && <ButtonLink href={pageHref(page + 1)} variant="secondary" size="sm">Next page</ButtonLink>}
        </nav>}
        <p className="mt-6 text-xs leading-6 text-subtle">Time estimates are planning guides, not deadlines. Progress is shared with each problem wherever it appears; totals across paths can overlap.</p>
      </>}
  </AppShell>;
}
