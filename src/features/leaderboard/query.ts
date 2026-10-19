import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { z } from "zod";
import { LEADERBOARD_LIMIT } from "./validation";

export type LeaderboardEntry = { rank: number; name: string; solved: number; easy: number; medium: number; hard: number; week: number; isViewer: boolean };
export type Leaderboard = { entries: LeaderboardEntry[]; viewerEntry: LeaderboardEntry | null };

type Row = { rank: number; name: string; solved: number; easy: number; medium: number; hard: number; week: number; mine: boolean };

/**
 * Opted-in users ranked by verified solves of PUBLISHED problems (judge-verified, not self-marked).
 * Tie-break: the earlier latest solve ranks higher, then name. The payload never carries emails or user ids;
 * rank is the client key. The viewer's own row is flagged and, if ranked below the limit, returned separately.
 */
export async function queryLeaderboard(db: PrismaClient, viewerId: string | null): Promise<Leaderboard> {
  const viewer = viewerId ? z.uuid().parse(viewerId) : null;
  const rows = await db.$queryRaw<Row[]>(Prisma.sql`
    WITH ranked AS (
      SELECT u.id, u."displayName" AS name,
        count(*)::int AS solved,
        (count(*) FILTER (WHERE pr.difficulty = 'EASY'))::int AS easy,
        (count(*) FILTER (WHERE pr.difficulty = 'MEDIUM'))::int AS medium,
        (count(*) FILTER (WHERE pr.difficulty = 'HARD'))::int AS hard,
        (count(*) FILTER (WHERE up."solvedAt" >= now() - interval '7 days'))::int AS week,
        row_number() OVER (ORDER BY count(*) DESC, max(up."solvedAt") ASC, lower(u."displayName") ASC, u.id ASC)::int AS rank
      FROM app."User" u
      JOIN app."UserProgress" up ON up."userId" = u.id AND up.status = 'SOLVED' AND NOT up."selfMarked" AND up."solvedAt" IS NOT NULL
      JOIN app."Problem" pr ON pr.id = up."problemId" AND pr.status = 'PUBLISHED'
      WHERE u."leaderboardOptIn" AND u."displayName" IS NOT NULL
      GROUP BY u.id
    )
    SELECT rank, name, solved, easy, medium, hard, week, (id = ${viewer}::uuid) AS mine
    FROM ranked
    WHERE rank <= ${LEADERBOARD_LIMIT} OR id = ${viewer}::uuid
    ORDER BY rank ASC`);
  const all = rows.map((row): LeaderboardEntry => ({ rank: row.rank, name: row.name, solved: row.solved, easy: row.easy, medium: row.medium, hard: row.hard, week: row.week, isViewer: Boolean(row.mine) }));
  return { entries: all.filter((entry) => entry.rank <= LEADERBOARD_LIMIT), viewerEntry: all.find((entry) => entry.isViewer) ?? null };
}
