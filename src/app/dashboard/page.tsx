import type { Metadata } from "next";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { ButtonLink } from "@/components/ui/button";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { DashboardInsights } from "@/components/dashboard/dashboard-insights";
import { loadDashboard } from "@/features/dashboard/load";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const { displayName, admin, analytics, insights, acceptance } = await loadDashboard();
  return <AccountFrame admin={admin}>
    <PageHeading title={`Welcome, ${displayName || "learner"}.`} description="See your saved practice progress, then choose your next challenge." action={<ButtonLink href="/profile" variant="secondary">View profile</ButtonLink>} />
    <div className="space-y-4">
      <DashboardStats analytics={analytics} streak={insights.streak} acceptance={acceptance} />
      <DashboardOverview analytics={analytics} />
    </div>
    <DashboardInsights insights={insights} />
  </AccountFrame>;
}
