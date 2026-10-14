-- Video lessons attached to problems. Insert-only seeded content; the table is private like every other app table.
CREATE TABLE "app"."ProblemVideo" (
    "id" UUID NOT NULL,
    "problemId" UUID NOT NULL,
    "youtubeId" VARCHAR(11) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "channel" VARCHAR(120) NOT NULL,
    "concept" VARCHAR(160) NOT NULL,
    "referenceProblem" VARCHAR(200) NOT NULL,
    "bridge" TEXT NOT NULL,
    "segments" JSONB NOT NULL DEFAULT '[]',
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemVideo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProblemVideo_problemId_youtubeId_key" ON "app"."ProblemVideo"("problemId", "youtubeId");
CREATE UNIQUE INDEX "ProblemVideo_problemId_position_key" ON "app"."ProblemVideo"("problemId", "position");
CREATE INDEX "ProblemVideo_problemId_idx" ON "app"."ProblemVideo"("problemId");

ALTER TABLE "app"."ProblemVideo" ADD CONSTRAINT "ProblemVideo_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "app"."Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sane values even if a future writer bypasses the application validator. Segment shape and ordering are validated
-- in the seed validator; the database guarantees the array type and a bounded size.
ALTER TABLE "app"."ProblemVideo" ADD CONSTRAINT "ProblemVideo_youtubeId_check" CHECK ("youtubeId" ~ '^[A-Za-z0-9_-]{11}$');
ALTER TABLE "app"."ProblemVideo" ADD CONSTRAINT "ProblemVideo_position_check" CHECK ("position" BETWEEN 1 AND 5);
ALTER TABLE "app"."ProblemVideo" ADD CONSTRAINT "ProblemVideo_text_check"
  CHECK (char_length(btrim("title")) > 0 AND char_length(btrim("channel")) > 0 AND char_length(btrim("concept")) > 0
    AND char_length(btrim("referenceProblem")) > 0 AND char_length(btrim("bridge")) > 0);
ALTER TABLE "app"."ProblemVideo" ADD CONSTRAINT "ProblemVideo_segments_check"
  CHECK (jsonb_typeof("segments") = 'array' AND jsonb_array_length("segments") <= 12);

-- Same defense in depth as the foundation migration: no policies, so only the table owner can read or write.
ALTER TABLE "app"."ProblemVideo" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "app"."ProblemVideo" FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "app"."ProblemVideo" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "app"."ProblemVideo" FROM authenticated;
  END IF;
END $$;
