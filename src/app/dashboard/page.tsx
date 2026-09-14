import type { Metadata } from "next";
import Link from "next/link";
import { requireViewer } from "@/features/auth/session";
import { AccountFrame } from "@/components/auth/account-frame";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const viewer = await requireViewer();
  return <AccountFrame admin={viewer.role === "ADMIN"}>
    <p className="eyebrow text-accent">Your practice space</p>
    <h1 className="mt-4 text-4xl font-semibold tracking-tight">Welcome, {viewer.displayName || "learner"}.</h1>
    <section className="mt-8 max-w-2xl rounded-2xl border border-line bg-surface p-7">
      <h2 className="text-xl font-semibold">Your account is ready</h2>
      <p className="mt-3 leading-7 text-muted">This is the start of your AlgoSprint workspace. Problem practice and progress insights are being added next.</p>
      <Link href="/profile" className="action-link action-link-secondary mt-6">View your profile</Link>
    </section>
  </AccountFrame>;
}
