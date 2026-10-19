-- Leaderboard is opt-in: every existing and future user stays hidden until they switch it on.
-- Row level security and privileges on "app"."User" are unchanged (enabled and revoked by the foundation migration).
ALTER TABLE "app"."User" ADD COLUMN "leaderboardOptIn" BOOLEAN NOT NULL DEFAULT false;

-- An opted-in user always has a public name, and no two opted-in users share one (case-insensitive).
ALTER TABLE "app"."User" ADD CONSTRAINT "User_leaderboard_name_check"
  CHECK (NOT "leaderboardOptIn" OR ("displayName" IS NOT NULL AND length(btrim("displayName")) >= 2));
CREATE UNIQUE INDEX "User_leaderboard_name_key" ON "app"."User" (lower("displayName")) WHERE "leaderboardOptIn";
