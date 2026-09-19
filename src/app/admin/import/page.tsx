import type { Metadata } from "next";
import { requireAdmin } from "@/features/auth/session";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { ButtonLink } from "@/components/ui/button";
import { ImportForm } from "@/components/admin/import-form";
export const metadata: Metadata = { title: "Import problems", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function ImportPage() {
  await requireAdmin();
  return <AccountFrame admin><PageHeading eyebrow="Content administration" title="Import original problems" description="Validate a complete batch before creating any problem." /><ImportForm /><div className="mt-6"><ButtonLink href="/admin" variant="secondary">Back to manager</ButtonLink></div></AccountFrame>;
}
