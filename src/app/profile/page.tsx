import type { Metadata } from "next";
import { requireViewer } from "@/features/auth/session";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Profile", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function ProfilePage() {
  const viewer = await requireViewer("/profile");
  return <AccountFrame admin={viewer.role === "ADMIN"}>
    <PageHeading eyebrow="Your account" title="Profile" description="The person behind the practice." />
    <Card className="max-w-3xl"><div className="mb-7 flex flex-wrap items-center gap-4"><span aria-hidden="true" className="grid size-14 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-xl font-semibold text-accent">{(viewer.displayName || "L").slice(0, 1).toUpperCase()}</span><div><h2 className="text-xl font-semibold">{viewer.displayName || "Learner"}</h2><Badge className="mt-2" tone="accent">{viewer.role === "ADMIN" ? "Administrator" : "Learner"}</Badge></div></div>
      <dl className="grid gap-6 border-t border-line pt-7 sm:grid-cols-2">{[["Email", viewer.email || "Not available"], ["Time zone", viewer.timeZone], ["Member since", viewer.createdAt.toISOString().slice(0, 10)]].map(([label, value]) => <div key={label}><dt className="text-sm text-muted">{label}</dt><dd className="mt-2 break-words font-medium">{value}</dd></div>)}</dl>
    </Card>
  </AccountFrame>;
}
