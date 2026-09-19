import type { Metadata } from "next";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { ContentEditor } from "@/components/admin/content-editor";
import { requireAdmin } from "@/features/auth/session";
export const metadata: Metadata = { title: "Add problem", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireAdmin();
  return <AccountFrame admin><PageHeading eyebrow="Content administration" title="Add an original problem" description="Prepare the statement, examples, hints, solutions and tests together." /><ContentEditor kind="problem" /></AccountFrame>;
}
