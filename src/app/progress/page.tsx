import type { Metadata } from "next";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { ButtonLink } from "@/components/ui/button";
import { ProgressSummary } from "@/components/progress/progress-summary";
import { loadProgress } from "@/features/progress/load";

export const metadata: Metadata = { title: "Your progress", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function ProgressPage() {
  const { summary, admin } = await loadProgress();
  return <AccountFrame admin={admin}>
    <PageHeading eyebrow="Your practice record" title="Your progress" description="See what you have tried, what you have solved, and what you want to revisit." action={<ButtonLink href="/problems">Choose a problem</ButtonLink>} />
    <ProgressSummary summary={summary} />
  </AccountFrame>;
}
