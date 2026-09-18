import Link from "next/link";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProblemNotes } from "@/components/problems/personal-controls";
import { SavedFlags } from "./saved-flags";
import { progressLabel } from "@/features/progress/presentation";
import { savedHref, type SavedKind } from "@/features/saved/filters";
import type { SavedCollection } from "@/features/saved/query";

const labels = { notes: "Your notes", bookmarks: "Your bookmarks", review: "Review later" };
export function SavedCollectionPage({ kind, admin, collection }: { kind: SavedKind; admin: boolean; collection: SavedCollection }) {
  return <AccountFrame admin={admin}>
    <PageHeading eyebrow="Your saved practice" title={labels[kind]} description="Keep useful problems and your own learning notes close at hand. Only your saved items for published problems appear here." action={<ButtonLink href="/problems">Browse problems</ButtonLink>} />
    <nav aria-label="Saved practice collections" className="mb-6 flex flex-wrap gap-4">{(["notes", "bookmarks", "review"] as const).map((tab) => <Link key={tab} href={`/${tab}`} aria-current={kind === tab ? "page" : undefined} className="text-sm text-accent underline underline-offset-4">{labels[tab]}</Link>)}</nav>
    <form action={`/${kind}`} method="get" className="mb-6 flex flex-wrap items-end gap-3">
      <div><label htmlFor="saved-search" className="mb-2 block text-sm">Search problem titles</label><input key={collection.q} id="saved-search" name="q" defaultValue={collection.q} maxLength={100} className="max-w-full rounded-xl border border-line bg-canvas px-4 py-3" /></div>
      <Button type="submit">Search</Button>{collection.q && <ButtonLink href={`/${kind}`} variant="secondary">Clear search</ButtonLink>}
    </form>
    <p className="mb-5 text-sm text-muted">{collection.total} saved {collection.total === 1 ? "problem" : "problems"} · Page {collection.page} of {collection.pages}. Ordered by title. Save note edits before changing pages or searching.</p>
    {!collection.items.length ? <EmptyState title={collection.q ? "No matching saved problems" : "Nothing saved here yet"} description={collection.q ? "Try another title or clear the search." : kind === "notes" ? "Open a problem and save a private note. You can edit or delete saved notes here." : kind === "bookmarks" ? "Open a problem and choose Bookmark to keep it in this list." : "Open a problem and choose Review later when you want to revisit it."} action={<ButtonLink href={collection.q ? `/${kind}` : "/problems"}>{collection.q ? "Clear search" : "Choose a problem"}</ButtonLink>} />
      : <div className="space-y-6">{collection.items.map((item) => <Card key={item.slug}>
        <h2 className="text-xl font-semibold"><Link href={`/problems/${item.slug}`} className="text-accent underline underline-offset-4">{item.title}</Link></h2>
        <p className="mt-3 text-sm text-muted">{item.difficulty} · {progressLabel(item.progress)}</p>
        <SavedFlags slug={item.slug} bookmarked={item.bookmarked} reviewLater={item.progress.reviewLater} />
        {kind === "notes" && <ProblemNotes slug={item.slug} note={item.note} />}
      </Card>)}</div>}
    {collection.pages > 1 && <nav aria-label="Saved problems pages" className="mt-6 flex gap-3">
      {collection.page > 1 && <ButtonLink href={savedHref(kind, { q: collection.q, page: collection.page - 1 })} variant="secondary">Previous page</ButtonLink>}
      {collection.page < collection.pages && <ButtonLink href={savedHref(kind, { q: collection.q, page: collection.page + 1 })} variant="secondary">Next page</ButtonLink>}
    </nav>}
  </AccountFrame>;
}
