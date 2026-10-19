import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";
import { PageHeading } from "@/components/ui/page-heading";
import { getViewer } from "@/features/auth/session";
import { queryLeaderboard } from "@/features/leaderboard/query";
import { getDatabase } from "@/lib/prisma";

export const metadata: Metadata = { title: "Leaderboard", description: "Learners who opted in, ranked by verified solves." };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  // Public: guests see the same board. A viewer lookup failure only hides the personal highlight.
  const viewer = await getViewer().catch(() => null);
  const data = await queryLeaderboard(getDatabase(), viewer?.id ?? null);
  return <AppShell signedIn={Boolean(viewer)} admin={viewer?.role === "ADMIN"}>
    <PageHeading eyebrow="Community" title="Leaderboard" description="Learners who chose to be listed, ranked by verified solves. Only display names and solve counts are shown." />
    <LeaderboardView data={data} signedIn={Boolean(viewer)} optedIn={Boolean(viewer?.leaderboardOptIn)} />
  </AppShell>;
}
