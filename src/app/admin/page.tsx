import type { Metadata } from "next";
import { requireAdmin } from "@/features/auth/session";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  await requireAdmin();
  return <AccountFrame admin><PageHeading eyebrow="Content administration" title="Admin workspace" description="A home for clear, original learning content." action={<Badge tone="warm">Administrator</Badge>} />
    <EmptyState title="Content tools are on the way" description="Your administrator access is verified. Authoring and content management will be available in the admin milestone." />
  </AccountFrame>;
}
