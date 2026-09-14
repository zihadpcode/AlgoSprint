import type { Metadata } from "next";
import { requireViewer } from "@/features/auth/session";
import { AccountFrame } from "@/components/auth/account-frame";

export const metadata: Metadata = { title: "Profile", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function ProfilePage() {
  const viewer = await requireViewer("/profile");
  return <AccountFrame admin={viewer.role === "ADMIN"}>
    <p className="eyebrow text-accent">Your account</p><h1 className="mt-4 text-4xl font-semibold">Profile</h1>
    <dl className="mt-8 grid max-w-2xl gap-6 rounded-2xl border border-line bg-surface p-7 sm:grid-cols-2">
      {[ ["Display name", viewer.displayName || "Learner"], ["Email", viewer.email || "Not available"], ["Time zone", viewer.timeZone], ["Member since", viewer.createdAt.toISOString().slice(0, 10)] ].map(([label, value]) => <div key={label}><dt className="text-sm text-muted">{label}</dt><dd className="mt-2 break-words font-medium">{value}</dd></div>)}
    </dl>
  </AccountFrame>;
}
