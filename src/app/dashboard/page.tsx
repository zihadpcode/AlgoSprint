import type { Metadata } from "next";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { ButtonLink } from "@/components/ui/button";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { loadDashboard } from "@/features/dashboard/load";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const { displayName, admin, analytics } = await loadDashboard();
  return <AccountFrame admin={admin}>
    <PageHeading eyebrow="Your practice space" title={`Welcome, ${displayName || "learner"}.`} description="See your saved practice progress, then choose your next challenge." action={<ButtonLink href="/profile" variant="secondary">View profile</ButtonLink>} />
    <DashboardOverview analytics={analytics} />
  </AccountFrame>;
}
