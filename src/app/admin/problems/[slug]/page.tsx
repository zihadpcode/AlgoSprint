import type { Metadata } from "next";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { ContentEditor } from "@/components/admin/content-editor";
import { notFound } from "next/navigation";
import { loadAdminProblem } from "@/features/admin/load";
export const metadata: Metadata = { title: "Edit problem", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const row = await loadAdminProblem((await params).slug); if (!row) notFound();
  return <AccountFrame admin><PageHeading eyebrow="Content administration" title={`Edit ${row.content.title}`} description={`Revision ${row.revision}. Hidden tests are available only in this protected editor.`} /><ContentEditor key={row.content.slug} kind="problem" initial={row.content} slug={row.content.slug} revision={row.revision} /></AccountFrame>;
}
