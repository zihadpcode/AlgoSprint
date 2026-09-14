import type { Metadata } from "next";
import { requireAdmin } from "@/features/auth/session";
import { AccountFrame } from "@/components/auth/account-frame";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  await requireAdmin();
  return <AccountFrame admin>
    <p className="eyebrow text-warm">Content administration</p><h1 className="mt-4 text-4xl font-semibold">Admin workspace</h1>
    <p className="mt-6 max-w-2xl leading-7 text-muted">Your administrator access is verified. Problem authoring and content management tools will be added in the admin milestone.</p>
  </AccountFrame>;
}
