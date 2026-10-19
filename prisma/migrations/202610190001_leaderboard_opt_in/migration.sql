-- Leaderboard is opt-in: every existing and future user stays hidden until they switch it on.
-- Row level security and privileges on "app"."User" are unchanged (enabled and revoked by the foundation migration).
ALTER TABLE "app"."User" ADD COLUMN "leaderboardOptIn" BOOLEAN NOT NULL DEFAULT false;

-- Confusable skeleton of the public name (computed by the application: NFKC, case and accent folded, look-alike
-- letters mapped to Latin). Set while opted in, null otherwise.
ALTER TABLE "app"."User" ADD COLUMN "leaderboardNameKey" VARCHAR(80);

-- An opted-in user always has a public name and a name key.
ALTER TABLE "app"."User" ADD CONSTRAINT "User_leaderboard_name_check"
  CHECK (NOT "leaderboardOptIn" OR (
    "displayName" IS NOT NULL AND length(btrim("displayName")) >= 2
    AND "leaderboardNameKey" IS NOT NULL AND length(btrim("leaderboardNameKey")) >= 2));

-- No two opted-in users share a name, or a name that looks like it.
CREATE UNIQUE INDEX "User_leaderboard_name_key" ON "app"."User" ("leaderboardNameKey") WHERE "leaderboardOptIn";
