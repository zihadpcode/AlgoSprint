import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { LibraryFiltersForm } from "@/components/problems/library-filters";
import { ActiveFilters } from "@/components/problems/active-filters";
import { ProblemCard } from "@/components/problems/problem-card";
import { ProblemTable } from "@/components/problems/problem-table";
import { GuestPrompt, PracticeStatsStrip } from "@/components/problems/practice-stats";
import { loadLibrary } from "@/features/problems/load";
import { libraryHref, type SearchParams } from "@/features/problems/filters";

export const metadata: Metadata = { title: "Practice", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ProblemsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const view = await loadLibrary(await searchParams);
  if (view.kind === "ready" && view.result.page !== view.filters.page) {
    redirect(libraryHref({ ...view.filters, page: view.result.page }));
  }
  return (
    <AppShell signedIn={view.signedIn} admin={view.admin}>
      <PageHeading title="Practice" description="Original problems with layered hints and guided solutions. Pick a pattern, filter by your progress, and keep a streak going." />
      {view.kind === "unavailable" ? (
        <EmptyState title="The library is being prepared" description="Published problems will appear here when the collection is available. Please check back later." />
      ) : view.kind === "sign-in" ? (
        <EmptyState title="Sign in to filter your progress" description="Completion and review filters belong to your account."
          action={<div className="flex flex-wrap justify-center gap-3"><ButtonLink href={"/login?next=" + encodeURIComponent(libraryHref(view.filters))}>Sign in</ButtonLink><ButtonLink href="/problems" variant="secondary">Browse all problems</ButtonLink></div>} />
      ) : (
        <>
          {view.stats ? <PracticeStatsStrip stats={view.stats} /> : !view.signedIn && <GuestPrompt href={"/login?next=" + encodeURIComponent(libraryHref(view.filters))} />}
          <LibraryFiltersForm filters={view.filters} facets={view.result.facets} signedIn={view.signedIn} />
          <ActiveFilters filters={view.filters} facets={view.result.facets} />
          <p role="status" aria-live="polite" aria-atomic="true" className="mb-3 text-xs text-muted tabular-nums">
            {view.result.total === 0 ? "No matching problems" : "Showing " + ((view.result.page - 1) * view.result.pageSize + 1) + "–" + Math.min(view.result.page * view.result.pageSize, view.result.total) + " of " + view.result.total + " published problems"}
          </p>
          {view.result.items.length ? (
            <>
              <div className="hidden md:block"><ProblemTable problems={view.result.items} filters={view.filters} /></div>
              <ul aria-label="Problems" className="space-y-2 md:hidden">
                {view.result.items.map((problem) => <li key={problem.slug} className="min-w-0"><ProblemCard problem={problem} /></li>)}
              </ul>
            </>
          ) : (
            <EmptyState title="No matches yet" description="Try a shorter search or clear some filters."
              action={<ButtonLink href="/problems" variant="secondary">Clear filters</ButtonLink>} />
          )}
          {view.result.total > 0 && <nav aria-label="Problem pages" className="mt-5 flex items-center justify-between gap-4">
            {view.result.page > 1 ? <ButtonLink variant="secondary" size="sm" href={libraryHref({ ...view.filters, page: view.result.page - 1 })}><ChevronLeft aria-hidden="true" size={14} />Previous<span className="sr-only"> page</span></ButtonLink> : <span aria-disabled="true" className="inline-flex h-8 items-center gap-1.5 px-2.5 text-xs text-subtle"><ChevronLeft aria-hidden="true" size={14} />Previous<span className="sr-only"> page</span></span>}
            <p className="text-xs text-muted tabular-nums">Page {view.result.page} of {view.result.pages}</p>
            {view.result.page < view.result.pages ? <ButtonLink variant="secondary" size="sm" href={libraryHref({ ...view.filters, page: view.result.page + 1 })}>Next<span className="sr-only"> page</span><ChevronRight aria-hidden="true" size={14} /></ButtonLink> : <span aria-disabled="true" className="inline-flex h-8 items-center gap-1.5 px-2.5 text-xs text-subtle">Next<span className="sr-only"> page</span><ChevronRight aria-hidden="true" size={14} /></span>}
          </nav>}
        </>
      )}
    </AppShell>
  );
}
