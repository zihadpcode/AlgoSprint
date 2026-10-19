import Link from "next/link";
import { Search } from "lucide-react";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { difficultyText } from "@/components/ui/badge";
import { ProblemNotes } from "@/components/problems/personal-controls";
import { SavedFlags } from "./saved-flags";
import { cn } from "@/lib/utils";
import { progressLabel } from "@/features/progress/presentation";
import { savedHref, type SavedKind } from "@/features/saved/filters";
import type { SavedCollection } from "@/features/saved/query";

const labels = { notes: "Your notes", bookmarks: "Your bookmarks", review: "Review later" };
const tabLabels = { notes: "Notes", bookmarks: "Bookmarks", review: "Review" };
const difficultyName = (value: string) => value[0] + value.slice(1).toLowerCase();

export function SavedCollectionPage({ kind, admin, collection }: { kind: SavedKind; admin: boolean; collection: SavedCollection }) {
  return <AccountFrame admin={admin}>
    <PageHeading title={labels[kind]} description="Keep useful problems and your own learning notes close at hand. Only your saved items for published problems appear here." action={<ButtonLink href="/problems" variant="secondary">Browse problems</ButtonLink>} />
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Saved practice collections" className="flex gap-1 rounded-lg border border-line bg-surface p-0.5">{(["notes", "bookmarks", "review"] as const).map((tab) =>
        <Link key={tab} href={`/${tab}`} aria-current={kind === tab ? "page" : undefined} className={cn("inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors", kind === tab ? "bg-surface-hover text-ink" : "text-muted hover:text-ink")}>
          <span className="sr-only">{labels[tab]}</span><span aria-hidden="true">{tabLabels[tab]}</span></Link>)}
      </nav>
      <form action={`/${kind}`} method="get" role="search" className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="saved-search" className="sr-only">Search problem titles</label>
          <Search aria-hidden="true" size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle" />
          <Input key={collection.q} id="saved-search" name="q" type="search" defaultValue={collection.q} maxLength={100} placeholder="Search saved problems" className="h-9 pl-9" />
        </div>
        <Button type="submit" variant="secondary" className="h-9">Search</Button>{collection.q && <ButtonLink href={`/${kind}`} variant="quiet" className="h-9">Clear</ButtonLink>}
      </form>
    </div>
    <p className="mb-3 text-xs text-muted tabular-nums">{collection.total} saved {collection.total === 1 ? "problem" : "problems"} · Page {collection.page} of {collection.pages}. Ordered by title. Save note edits before changing pages or searching.</p>
    {!collection.items.length ? <EmptyState title={collection.q ? "No matching saved problems" : "Nothing saved here yet"} description={collection.q ? "Try another title or clear the search." : kind === "notes" ? "Open a problem and save a private note. You can edit or delete saved notes here." : kind === "bookmarks" ? "Open a problem and choose Bookmark to keep it in this list." : "Open a problem and choose Review later when you want to revisit it."} action={<ButtonLink href={collection.q ? `/${kind}` : "/problems"}>{collection.q ? "Clear search" : "Choose a problem"}</ButtonLink>} />
      : <ul aria-label={labels[kind]} className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">{collection.items.map((item) => <li key={item.slug} className="px-4 py-3 transition-colors hover:bg-surface-hover/50">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h2 className="text-sm font-medium [overflow-wrap:anywhere]"><Link href={`/problems/${item.slug}`} className="hover:text-accent">{item.title}</Link></h2>
            <p className="mt-0.5 text-xs text-muted"><span className={cn("font-medium", difficultyText(item.difficulty))}>{difficultyName(item.difficulty)}</span> · {progressLabel(item.progress)}</p>
          </div>
          <SavedFlags slug={item.slug} bookmarked={item.bookmarked} reviewLater={item.progress.reviewLater} />
        </div>
        {kind === "notes" && <details className="group mt-2">
          <summary className="flex cursor-pointer list-none items-baseline gap-3 text-xs text-muted hover:text-ink [&::-webkit-details-marker]:hidden"><span className="line-clamp-2 min-w-0 flex-1 [overflow-wrap:anywhere] group-open:hidden">{item.note}</span><span className="shrink-0 text-accent group-open:hidden">Edit note</span><span className="hidden text-accent group-open:inline">Hide editor</span></summary>
          <ProblemNotes slug={item.slug} note={item.note} />
        </details>}
      </li>)}</ul>}
    {collection.pages > 1 && <nav aria-label="Saved problems pages" className="mt-4 flex gap-2">
      {collection.page > 1 && <ButtonLink href={savedHref(kind, { q: collection.q, page: collection.page - 1 })} variant="secondary" size="sm">Previous page</ButtonLink>}
      {collection.page < collection.pages && <ButtonLink href={savedHref(kind, { q: collection.q, page: collection.page + 1 })} variant="secondary" size="sm">Next page</ButtonLink>}
    </nav>}
  </AccountFrame>;
}
