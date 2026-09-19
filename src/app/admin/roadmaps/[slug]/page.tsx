import type { Metadata } from "next";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { ContentEditor } from "@/components/admin/content-editor";
import { notFound } from "next/navigation";
import { loadAdminRoadmap } from "@/features/admin/load";
export const metadata: Metadata = { title: "Edit roadmap", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const row = await loadAdminRoadmap((await params).slug); if (!row) notFound();
  return <AccountFrame admin><PageHeading eyebrow="Content administration" title={`Edit ${row.content.title}`} description="Use existing problem slugs, write step guidance, and move steps into learning order." /><ContentEditor key={row.content.slug} kind="roadmap" initial={row.content} slug={row.content.slug} token={row.token} status={row.status} /></AccountFrame>;
}
