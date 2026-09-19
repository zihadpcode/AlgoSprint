import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { adminHref, loadAdminIndex } from "@/features/admin/load";
export const metadata: Metadata = { title: "Content manager", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { filters, result } = await loadAdminIndex(await searchParams);
  if (filters.page !== result.page) redirect(adminHref({ ...filters, page: result.page }));
  return <AccountFrame admin><PageHeading eyebrow="Content administration" title="Problem manager" description="Author original learning content. Review examples and tests before publishing." />
    <div className="mb-6 flex flex-wrap gap-3"><ButtonLink href="/admin/problems/new">Add problem</ButtonLink><ButtonLink href="/admin/import" variant="secondary">Import JSON</ButtonLink></div>
    <form method="get" action="/admin" className="mb-6 flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 space-y-2"><span className="text-sm">Search titles</span><Input name="q" defaultValue={filters.q} maxLength={100} /></label>
      <label className="space-y-2"><span className="text-sm">Status</span><Select name="status" defaultValue={filters.status}><option value="">All statuses</option>{["DRAFT", "PUBLISHED", "ARCHIVED"].map((s) => <option key={s}>{s}</option>)}</Select></label><Button type="submit">Filter</Button><ButtonLink href="/admin" variant="secondary">Clear</ButtonLink>
    </form>
    <p className="mb-4 text-sm text-muted">{result.total} matching problems · Page {result.page} of {result.pages}</p>
    {result.problems.length ? <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full text-left text-sm"><caption className="sr-only">Managed problems</caption>
      <thead><tr>{["Problem", "Status", "Difficulty", "Revision"].map((x) => <th key={x} scope="col" className="p-4">{x}</th>)}</tr></thead>
      <tbody>{result.problems.map((p) => <tr key={p.slug} className="border-t border-line"><th scope="row" className="p-4"><Link href={`/admin/problems/${p.slug}`} className="text-accent underline underline-offset-4">{p.title}</Link><span className="mt-1 block font-normal text-muted">{p.slug}</span></th><td className="p-4">{p.status}</td><td className="p-4">{p.difficulty}</td><td className="p-4">{p.revision}</td></tr>)}</tbody>
    </table></div> : <EmptyState title="No matching problems" description="Change the filters or create a new original problem." />}
    <nav aria-label="Managed problem pages" className="my-6 flex flex-wrap gap-3">{result.page > 1 && <ButtonLink href={adminHref({ ...filters, page: result.page - 1 })} variant="secondary">Previous page</ButtonLink>}{result.page < result.pages && <ButtonLink href={adminHref({ ...filters, page: result.page + 1 })} variant="secondary">Next page</ButtonLink>}</nav>
    <h2 className="mt-10 text-xl font-semibold">Roadmap placement</h2><p className="my-3 text-sm text-muted">Edit each path to add, remove or reorder existing problems. Showing up to 100 paths.</p>
    <ul className="space-y-3">{result.roadmaps.map((r) => <li key={r.slug}><Link href={`/admin/roadmaps/${r.slug}`} className="text-accent underline underline-offset-4">{r.title}</Link><span className="ml-3 text-sm text-muted">{r.status}</span></li>)}</ul>
  </AccountFrame>;
}
