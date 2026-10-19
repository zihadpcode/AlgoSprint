import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DifficultyBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { adminHref, loadAdminIndex } from "@/features/admin/load";
export const metadata: Metadata = { title: "Content manager", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { filters, result } = await loadAdminIndex(await searchParams);
  if (filters.page !== result.page) redirect(adminHref({ ...filters, page: result.page }));
  return <AccountFrame admin><PageHeading eyebrow="Content administration" title="Problem manager" description="Author original learning content. Review examples and tests before publishing." />
    <div className="mb-5 flex flex-wrap gap-2"><ButtonLink href="/admin/problems/new">Add problem</ButtonLink><ButtonLink href="/admin/import" variant="secondary">Import JSON</ButtonLink></div>
    <form method="get" action="/admin" className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-3">
      <label className="min-w-0 flex-1 space-y-1.5"><span className="text-xs font-medium text-muted">Search titles</span><Input name="q" defaultValue={filters.q} maxLength={100} /></label>
      <label className="space-y-1.5"><span className="block text-xs font-medium text-muted">Status</span><Select name="status" defaultValue={filters.status}><option value="">All statuses</option>{["DRAFT", "PUBLISHED", "ARCHIVED"].map((s) => <option key={s}>{s}</option>)}</Select></label><Button type="submit">Filter</Button><ButtonLink href="/admin" variant="secondary">Clear</ButtonLink>
    </form>
    <p className="mb-3 text-xs text-muted tabular-nums">{result.total} matching problems · Page {result.page} of {result.pages}</p>
    {result.problems.length ? <div className="overflow-x-auto rounded-xl border border-line bg-surface"><table className="w-full text-left text-sm"><caption className="sr-only">Managed problems</caption>
      <thead className="text-xs text-subtle"><tr className="h-9">{["Problem", "Status", "Difficulty", "Revision"].map((x) => <th key={x} scope="col" className="px-4 font-medium">{x}</th>)}</tr></thead>
      <tbody className="divide-y divide-line border-t border-line">{result.problems.map((p) => <tr key={p.slug} className="transition-colors hover:bg-surface-hover"><th scope="row" className="px-4 py-2.5"><Link href={`/admin/problems/${p.slug}`} className="font-medium text-ink hover:text-accent">{p.title}</Link><span className="mt-0.5 block font-mono text-xs font-normal text-subtle">{p.slug}</span></th><td className="px-4"><Badge tone={p.status === "PUBLISHED" ? "success" : p.status === "ARCHIVED" ? "neutral" : "warm"}>{p.status}</Badge></td><td className="px-4"><DifficultyBadge difficulty={p.difficulty} /></td><td className="px-4 tabular-nums text-muted">{p.revision}</td></tr>)}</tbody>
    </table></div> : <EmptyState title="No matching problems" description="Change the filters or create a new original problem." />}
    <nav aria-label="Managed problem pages" className="my-5 flex flex-wrap gap-2">{result.page > 1 && <ButtonLink href={adminHref({ ...filters, page: result.page - 1 })} variant="secondary">Previous page</ButtonLink>}{result.page < result.pages && <ButtonLink href={adminHref({ ...filters, page: result.page + 1 })} variant="secondary">Next page</ButtonLink>}</nav>
    <h2 className="mt-10 text-base font-semibold">Roadmap placement</h2><p className="mt-1 mb-3 text-sm text-muted">Edit each path to add, remove or reorder existing problems. Showing up to 100 paths.</p>
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">{result.roadmaps.map((r) => <li key={r.slug} className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-hover"><Link href={`/admin/roadmaps/${r.slug}`} className="min-w-0 text-sm font-medium hover:text-accent">{r.title}</Link><Badge tone={r.status === "PUBLISHED" ? "success" : r.status === "ARCHIVED" ? "neutral" : "warm"}>{r.status}</Badge></li>)}</ul>
  </AccountFrame>;
}
