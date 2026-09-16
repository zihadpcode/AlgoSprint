-- Preserve manual and historical solves while recording exact runner provenance.
ALTER TABLE app."UserProgress"
  ADD COLUMN "verifiedRevision" INTEGER,
  ADD COLUMN "verifiedAt" TIMESTAMPTZ(6);
ALTER TABLE app."UserProgress" ADD CONSTRAINT "Progress_verification_check"
  CHECK (("verifiedRevision" IS NULL AND "verifiedAt" IS NULL) OR
    ("verifiedRevision" IS NOT NULL AND "verifiedRevision" > 0 AND "verifiedAt" IS NOT NULL
      AND status = 'SOLVED' AND NOT "selfMarked"));

-- Phase 8 attempts already exist. Backfill first attempt dates without replacing
-- existing solve state, notes, bookmarks, review settings, or later activity dates.
INSERT INTO app."UserProgress" ("userId", "problemId", status, "attemptedAt", "createdAt", "updatedAt")
SELECT "userId", "problemId", 'ATTEMPTED', min("createdAt"), min("createdAt"), min("createdAt")
FROM app."UserSubmission" GROUP BY "userId", "problemId"
ON CONFLICT ("userId", "problemId") DO UPDATE SET
  "attemptedAt" = LEAST(app."UserProgress"."attemptedAt", EXCLUDED."attemptedAt"),
  status = CASE WHEN app."UserProgress".status = 'NOT_STARTED' THEN 'ATTEMPTED'::app."ProgressStatus" ELSE app."UserProgress".status END,
  "updatedAt" = GREATEST(app."UserProgress"."updatedAt", EXCLUDED."updatedAt");

-- A visible-only pass or a pass on an old/unpublished revision is not a verified solve.
WITH verified AS (
  SELECT s."userId", s."problemId", s."problemRevision", min(s."completedAt") AS "verifiedAt"
  FROM app."UserSubmission" s JOIN app."Problem" p ON p.id = s."problemId"
  WHERE s.mode = 'SUBMIT' AND s.status = 'ACCEPTED' AND s."completedAt" IS NOT NULL
    AND s."totalCount" > 0 AND s."passedCount" = s."totalCount"
    AND p.status = 'PUBLISHED' AND p.revision = s."problemRevision"
  GROUP BY s."userId", s."problemId", s."problemRevision"
)
UPDATE app."UserProgress" p SET status = 'SOLVED', "selfMarked" = false,
  "solvedAt" = COALESCE(p."solvedAt", v."verifiedAt"),
  "verifiedRevision" = v."problemRevision", "verifiedAt" = v."verifiedAt",
  "updatedAt" = GREATEST(p."updatedAt", v."verifiedAt")
FROM verified v WHERE p."userId" = v."userId" AND p."problemId" = v."problemId";
