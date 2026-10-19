import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { getViewer } from "@/features/auth/session";
import { getCachedTopLeaderboard } from "@/features/leaderboard/cache";
import { composeLeaderboard, queryViewerEntry } from "@/features/leaderboard/query";
import { getDatabase } from "@/lib/prisma";

export const metadata: Metadata = { title: "Leaderboard", description: "Learners who opted in, ranked by verified solves." };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  // Public: guests see the same board. A viewer lookup failure only hides the personal highlight.
  const viewer = await getViewer().catch(() => null);
  // The shared board is cached for about a minute; the viewer's own row is computed per request.
  const [top, mine] = await Promise.all([
    getCachedTopLeaderboard().catch(() => null),
    viewer?.leaderboardOptIn ? queryViewerEntry(getDatabase(), viewer.id).catch(() => null) : null,
  ]);
  return <AppShell signedIn={Boolean(viewer)} admin={viewer?.role === "ADMIN"}>
    <PageHeading eyebrow="Community" title="Leaderboard" description="Learners who chose to be listed, ranked by verified solves. Only display names and solve counts are shown." />
    {top ? <LeaderboardView data={composeLeaderboard(top, mine)} signedIn={Boolean(viewer)} optedIn={Boolean(viewer?.leaderboardOptIn)} />
      : <div role="status"><EmptyState title="The leaderboard is unavailable" description="We could not load the rankings just now. Reload in a moment; your own progress is not affected." /></div>}
  </AppShell>;
}
