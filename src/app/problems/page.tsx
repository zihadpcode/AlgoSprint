import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { LibraryFiltersForm } from "@/components/problems/library-filters";
import { ProblemCard } from "@/components/problems/problem-card";
import { loadLibrary } from "@/features/problems/load";
import { libraryHref, type SearchParams } from "@/features/problems/filters";

export const metadata: Metadata = { title: "Problem library", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ProblemsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const view = await loadLibrary(await searchParams);
  if (view.kind === "ready" && view.result.page !== view.filters.page) {
    redirect(libraryHref({ ...view.filters, page: view.result.page }));
  }
  return (
    <AppShell signedIn={view.signedIn} admin={view.admin}>
      <PageHeading eyebrow="Choose your next challenge" title="Problem library"
        description="Find an original problem that fits your time and the pattern you want to practice." />
      {view.kind === "unavailable" ? (
        <EmptyState title="The library is being prepared" description="Published problems will appear here when the collection is available. Please check back later." />
      ) : view.kind === "sign-in" ? (
        <EmptyState title="Sign in to filter your progress" description="Completion and review filters belong to your account."
          action={<div className="flex flex-wrap justify-center gap-3"><ButtonLink href={"/login?next=" + encodeURIComponent(libraryHref(view.filters))}>Sign in</ButtonLink><ButtonLink href="/problems" variant="secondary">Browse all problems</ButtonLink></div>} />
      ) : (
        <>
          <LibraryFiltersForm filters={view.filters} facets={view.result.facets} signedIn={view.signedIn} />
          <p role="status" aria-live="polite" aria-atomic="true" className="mb-5 text-sm text-muted">
            {view.result.total === 0 ? "No matching problems" : "Showing " + ((view.result.page - 1) * view.result.pageSize + 1) + "–" + Math.min(view.result.page * view.result.pageSize, view.result.total) + " of " + view.result.total + " published problems"}
          </p>
          {view.result.items.length ? (
            <ul aria-label="Problems" className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {view.result.items.map((problem) => <li key={problem.slug} className="min-w-0"><ProblemCard problem={problem} /></li>)}
            </ul>
          ) : (
            <EmptyState title="No matches yet" description="Try a shorter search or clear some filters."
              action={<ButtonLink href="/problems" variant="secondary">Clear filters</ButtonLink>} />
          )}
          {view.result.total > 0 && <nav aria-label="Problem pages" className="mt-8 flex flex-wrap items-center justify-between gap-4">
            {view.result.page > 1 ? <ButtonLink variant="secondary" href={libraryHref({ ...view.filters, page: view.result.page - 1 })}>Previous page</ButtonLink> : <span aria-disabled="true" className="text-sm text-muted">Previous page</span>}
            <p className="text-sm text-muted">Page {view.result.page} of {view.result.pages}</p>
            {view.result.page < view.result.pages ? <ButtonLink variant="secondary" href={libraryHref({ ...view.filters, page: view.result.page + 1 })}>Next page</ButtonLink> : <span aria-disabled="true" className="text-sm text-muted">Next page</span>}
          </nav>}
          <p className="mt-8 text-sm leading-7 text-muted">Browse the collection now. Problem pages and practice tools are coming next.</p>
        </>
      )}
    </AppShell>
  );
}
