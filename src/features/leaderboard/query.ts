import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { z } from "zod";
import { LEADERBOARD_LIMIT } from "./validation";

export type LeaderboardEntry = { rank: number; name: string; solved: number; easy: number; medium: number; hard: number; week: number; isViewer: boolean };
export type Leaderboard = { entries: LeaderboardEntry[]; viewerEntry: LeaderboardEntry | null };

type Row = { rank: number; name: string; solved: number; easy: number; medium: number; hard: number; week: number };

/**
 * Opted-in users ranked by verified solves of PUBLISHED problems (judge-verified, not self-marked).
 * Tie-break: the earlier latest solve ranks higher, then name. Rows never carry emails or user ids; rank is the key.
 */
function rankedRows(db: PrismaClient, filter: Prisma.Sql) {
  return db.$queryRaw<Row[]>(Prisma.sql`
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
    SELECT rank, name, solved, easy, medium, hard, week FROM ranked WHERE ${filter} ORDER BY rank ASC`);
}
const entry = (row: Row, isViewer: boolean): LeaderboardEntry => ({ rank: row.rank, name: row.name, solved: row.solved, easy: row.easy, medium: row.medium, hard: row.hard, week: row.week, isViewer });

/** The global board: top rows only, no viewer data, so it is safe to cache and share between requests. */
export async function queryTopLeaderboard(db: PrismaClient): Promise<LeaderboardEntry[]> {
  return (await rankedRows(db, Prisma.sql`rank <= ${LEADERBOARD_LIMIT}`)).map((row) => entry(row, false));
}

/** The viewer's own ranked row (any rank), or null when they are not opted in or have no verified solves. */
export async function queryViewerEntry(db: PrismaClient, viewerId: string): Promise<LeaderboardEntry | null> {
  const id = z.uuid().parse(viewerId);
  const [row] = await rankedRows(db, Prisma.sql`id = ${id}::uuid`);
  return row ? entry(row, true) : null;
}

/** Joins the shared board with the viewer's own row, highlighting it when it is in the list. */
export function composeLeaderboard(top: LeaderboardEntry[], viewerEntry: LeaderboardEntry | null): Leaderboard {
  const entries = top.map((item) => ({ ...item, isViewer: Boolean(viewerEntry) && item.rank === viewerEntry!.rank && item.name === viewerEntry!.name }));
  return { entries, viewerEntry };
}

export async function queryLeaderboard(db: PrismaClient, viewerId: string | null): Promise<Leaderboard> {
  const [top, mine] = await Promise.all([queryTopLeaderboard(db), viewerId ? queryViewerEntry(db, viewerId) : null]);
  return composeLeaderboard(top, mine);
}
