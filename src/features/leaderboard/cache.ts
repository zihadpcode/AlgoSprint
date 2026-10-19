import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { getDatabase } from "@/lib/prisma";
import { queryTopLeaderboard } from "./query";

export const LEADERBOARD_TAG = "leaderboard";

// The shared top-100 board holds no viewer data, so every request may reuse it for up to a minute.
// Errors are never cached: a failed read throws, and the next request tries again.
export const getCachedTopLeaderboard = unstable_cache(() => queryTopLeaderboard(getDatabase()), ["leaderboard-top"], { revalidate: 60, tags: [LEADERBOARD_TAG] });

/** Opt-in, opt-out and name changes show up immediately instead of after the 60 s window. */
export function invalidateLeaderboard() {
  revalidateTag(LEADERBOARD_TAG, { expire: 0 });
}
