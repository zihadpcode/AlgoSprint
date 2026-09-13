-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "app";

-- CreateEnum
CREATE TYPE "app"."Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "app"."Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "app"."ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "app"."ProblemKind" AS ENUM ('CODING', 'SQL', 'CONCEPTUAL', 'OBJECT_ORIENTED');

-- CreateEnum
CREATE TYPE "app"."Language" AS ENUM ('JAVASCRIPT', 'TYPESCRIPT', 'PYTHON', 'JAVA', 'CPP', 'SQL');

-- CreateEnum
CREATE TYPE "app"."SolutionKind" AS ENUM ('BRUTE_FORCE', 'BETTER', 'OPTIMAL', 'ALTERNATIVE');

-- CreateEnum
CREATE TYPE "app"."TestVisibility" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "app"."ProgressStatus" AS ENUM ('NOT_STARTED', 'ATTEMPTED', 'SOLVED');

-- CreateEnum
CREATE TYPE "app"."SubmissionMode" AS ENUM ('RUN', 'SUBMIT');

-- CreateEnum
CREATE TYPE "app"."SubmissionStatus" AS ENUM ('QUEUED', 'RUNNING', 'ACCEPTED', 'WRONG_ANSWER', 'COMPILE_ERROR', 'RUNTIME_ERROR', 'TIME_LIMIT', 'MEMORY_LIMIT', 'INTERNAL_ERROR');

-- CreateEnum
CREATE TYPE "app"."InterviewStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "app"."QuestionKind" AS ENUM ('CODING', 'CONCEPTUAL', 'DEBUGGING', 'OPTIMIZATION', 'BEHAVIORAL', 'SYSTEM_DESIGN');

-- CreateTable
CREATE TABLE "app"."User" (
    "id" UUID NOT NULL,
    "displayName" VARCHAR(80),
    "role" "app"."Role" NOT NULL DEFAULT 'USER',
    "timeZone" VARCHAR(80) NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Problem" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "difficulty" "app"."Difficulty" NOT NULL,
    "kind" "app"."ProblemKind" NOT NULL DEFAULT 'CODING',
    "status" "app"."ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "pattern" VARCHAR(100) NOT NULL,
    "statement" TEXT NOT NULL,
    "constraints" TEXT[],
    "estimatedMinutes" INTEGER NOT NULL,
    "timeLimitMs" INTEGER NOT NULL DEFAULT 2000,
    "memoryLimitKb" INTEGER NOT NULL DEFAULT 262144,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "seedHash" VARCHAR(64),
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ProblemExample" (
    "id" UUID NOT NULL,
    "problemId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "explanation" TEXT NOT NULL,

    CONSTRAINT "ProblemExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ProblemHint" (
    "id" UUID NOT NULL,
    "problemId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "ProblemHint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ProblemSolution" (
    "id" UUID NOT NULL,
    "problemId" UUID NOT NULL,
    "kind" "app"."SolutionKind" NOT NULL,
    "language" "app"."Language" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "intuition" TEXT NOT NULL,
    "approach" TEXT NOT NULL,
    "pseudocode" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "timeComplexity" VARCHAR(200) NOT NULL,
    "spaceComplexity" VARCHAR(200) NOT NULL,
    "commonMistakes" TEXT[],
    "interviewExplanation" TEXT NOT NULL,

    CONSTRAINT "ProblemSolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."SolutionStep" (
    "id" UUID NOT NULL,
    "solutionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "SolutionStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."StarterCode" (
    "id" UUID NOT NULL,
    "problemId" UUID NOT NULL,
    "language" "app"."Language" NOT NULL,
    "entryPoint" VARCHAR(100) NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "StarterCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."TestCase" (
    "id" UUID NOT NULL,
    "problemId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "visibility" "app"."TestVisibility" NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "explanation" TEXT,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Category" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Tag" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."InterviewStyle" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "InterviewStyle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ProblemCategory" (
    "problemId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,

    CONSTRAINT "ProblemCategory_pkey" PRIMARY KEY ("problemId","categoryId")
);

-- CreateTable
CREATE TABLE "app"."ProblemTag" (
    "problemId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "ProblemTag_pkey" PRIMARY KEY ("problemId","tagId")
);

-- CreateTable
CREATE TABLE "app"."ProblemInterviewStyle" (
    "problemId" UUID NOT NULL,
    "styleId" UUID NOT NULL,

    CONSTRAINT "ProblemInterviewStyle_pkey" PRIMARY KEY ("problemId","styleId")
);

-- CreateTable
CREATE TABLE "app"."ProblemRelation" (
    "problemId" UUID NOT NULL,
    "relatedId" UUID NOT NULL,

    CONSTRAINT "ProblemRelation_pkey" PRIMARY KEY ("problemId","relatedId")
);

-- CreateTable
CREATE TABLE "app"."UserProgress" (
    "userId" UUID NOT NULL,
    "problemId" UUID NOT NULL,
    "status" "app"."ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "bookmarked" BOOLEAN NOT NULL DEFAULT false,
    "reviewLater" BOOLEAN NOT NULL DEFAULT false,
    "selfMarked" BOOLEAN NOT NULL DEFAULT false,
    "attemptedAt" TIMESTAMPTZ(6),
    "solvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("userId","problemId")
);

-- CreateTable
CREATE TABLE "app"."UserSubmission" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "problemId" UUID NOT NULL,
    "problemRevision" INTEGER NOT NULL,
    "language" "app"."Language" NOT NULL,
    "mode" "app"."SubmissionMode" NOT NULL,
    "status" "app"."SubmissionStatus" NOT NULL DEFAULT 'QUEUED',
    "code" TEXT NOT NULL,
    "passedCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "runtimeMs" INTEGER,
    "memoryKb" INTEGER,
    "result" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "UserSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."UserNote" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "problemId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "UserNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Roadmap" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" "app"."Difficulty" NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "status" "app"."ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Roadmap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."RoadmapStep" (
    "id" UUID NOT NULL,
    "roadmapId" UUID NOT NULL,
    "problemId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,

    CONSTRAINT "RoadmapStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."MockInterview" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "app"."InterviewStatus" NOT NULL DEFAULT 'CREATED',
    "durationMinutes" INTEGER NOT NULL,
    "score" INTEGER,
    "report" JSONB,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."MockInterviewQuestion" (
    "id" UUID NOT NULL,
    "interviewId" UUID NOT NULL,
    "problemId" UUID,
    "kind" "app"."QuestionKind" NOT NULL,
    "position" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "answer" TEXT,
    "score" INTEGER,
    "feedback" TEXT,

    CONSTRAINT "MockInterviewQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Problem_slug_key" ON "app"."Problem"("slug");

-- CreateIndex
CREATE INDEX "Problem_status_difficulty_slug_idx" ON "app"."Problem"("status", "difficulty", "slug");

-- CreateIndex
CREATE INDEX "Problem_status_pattern_slug_idx" ON "app"."Problem"("status", "pattern", "slug");

-- CreateIndex
CREATE INDEX "Problem_status_estimatedMinutes_idx" ON "app"."Problem"("status", "estimatedMinutes");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemExample_problemId_position_key" ON "app"."ProblemExample"("problemId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemHint_problemId_position_key" ON "app"."ProblemHint"("problemId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemSolution_problemId_kind_language_key" ON "app"."ProblemSolution"("problemId", "kind", "language");

-- CreateIndex
CREATE UNIQUE INDEX "SolutionStep_solutionId_position_key" ON "app"."SolutionStep"("solutionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "StarterCode_problemId_language_key" ON "app"."StarterCode"("problemId", "language");

-- CreateIndex
CREATE INDEX "TestCase_problemId_visibility_idx" ON "app"."TestCase"("problemId", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "TestCase_problemId_position_key" ON "app"."TestCase"("problemId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "app"."Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "app"."Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "app"."Tag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "app"."Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewStyle_slug_key" ON "app"."InterviewStyle"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewStyle_name_key" ON "app"."InterviewStyle"("name");

-- CreateIndex
CREATE INDEX "ProblemCategory_categoryId_problemId_idx" ON "app"."ProblemCategory"("categoryId", "problemId");

-- CreateIndex
CREATE INDEX "ProblemTag_tagId_problemId_idx" ON "app"."ProblemTag"("tagId", "problemId");

-- CreateIndex
CREATE INDEX "ProblemInterviewStyle_styleId_problemId_idx" ON "app"."ProblemInterviewStyle"("styleId", "problemId");

-- CreateIndex
CREATE INDEX "ProblemRelation_relatedId_idx" ON "app"."ProblemRelation"("relatedId");

-- CreateIndex
CREATE INDEX "UserProgress_userId_status_updatedAt_idx" ON "app"."UserProgress"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "UserProgress_userId_reviewLater_idx" ON "app"."UserProgress"("userId", "reviewLater");

-- CreateIndex
CREATE INDEX "UserProgress_problemId_idx" ON "app"."UserProgress"("problemId");

-- CreateIndex
CREATE INDEX "UserSubmission_userId_createdAt_idx" ON "app"."UserSubmission"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserSubmission_userId_problemId_createdAt_idx" ON "app"."UserSubmission"("userId", "problemId", "createdAt");

-- CreateIndex
CREATE INDEX "UserSubmission_status_createdAt_idx" ON "app"."UserSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UserSubmission_problemId_idx" ON "app"."UserSubmission"("problemId");

-- CreateIndex
CREATE INDEX "UserNote_userId_updatedAt_idx" ON "app"."UserNote"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "UserNote_problemId_idx" ON "app"."UserNote"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "UserNote_userId_problemId_key" ON "app"."UserNote"("userId", "problemId");

-- CreateIndex
CREATE UNIQUE INDEX "Roadmap_slug_key" ON "app"."Roadmap"("slug");

-- CreateIndex
CREATE INDEX "Roadmap_status_difficulty_idx" ON "app"."Roadmap"("status", "difficulty");

-- CreateIndex
CREATE INDEX "RoadmapStep_problemId_idx" ON "app"."RoadmapStep"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapStep_roadmapId_position_key" ON "app"."RoadmapStep"("roadmapId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapStep_roadmapId_problemId_key" ON "app"."RoadmapStep"("roadmapId", "problemId");

-- CreateIndex
CREATE INDEX "MockInterview_userId_createdAt_idx" ON "app"."MockInterview"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MockInterviewQuestion_problemId_idx" ON "app"."MockInterviewQuestion"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "MockInterviewQuestion_interviewId_position_key" ON "app"."MockInterviewQuestion"("interviewId", "position");

-- AddForeignKey
ALTER TABLE "app"."ProblemExample" ADD CONSTRAINT "ProblemExample_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "app"."Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ProblemHint" ADD CONSTRAINT "ProblemHint_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "app"."Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ProblemSolution" ADD CONSTRAINT "ProblemSolution_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "app"."Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."SolutionStep" ADD CONSTRAINT "SolutionStep_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "app"."ProblemSolution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."StarterCode" ADD CONSTRAINT "StarterCode_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "app"."Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."TestCase" ADD CONSTRAINT "TestCase_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "app"."Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ProblemCategory" ADD CONSTRAINT "ProblemCategory_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "app"."Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ProblemCategory" ADD CONSTRAINT "ProblemCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "app"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ProblemTag" ADD CONSTRAINT "ProblemTag_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "app"."Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ProblemTag" ADD CONSTRAINT "ProblemTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "app"."Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ProblemInterviewStyle" ADD CONSTRAINT "ProblemInterviewStyle_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "app"."Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ProblemInterviewStyle" ADD CONSTRAINT "ProblemInterviewStyle_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "app"."InterviewStyle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ProblemRelation" ADD CONSTRAINT "ProblemRelation_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "app"."Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ProblemRelation" ADD CONSTRAINT "ProblemRelation_relatedId_fkey" FOREIGN KEY ("relatedId") REFERENCES "app"."Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."UserProgress" ADD CONSTRAINT "UserProgress_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "app"."Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."UserSubmission" ADD CONSTRAINT "UserSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."UserSubmission" ADD CONSTRAINT "UserSubmission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "app"."Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."UserNote" ADD CONSTRAINT "UserNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."UserNote" ADD CONSTRAINT "UserNote_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "app"."Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."RoadmapStep" ADD CONSTRAINT "RoadmapStep_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "app"."Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."RoadmapStep" ADD CONSTRAINT "RoadmapStep_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "app"."Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."MockInterview" ADD CONSTRAINT "MockInterview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."MockInterviewQuestion" ADD CONSTRAINT "MockInterviewQuestion_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "app"."MockInterview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."MockInterviewQuestion" ADD CONSTRAINT "MockInterviewQuestion_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "app"."Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Additional relational invariants not expressible in the Prisma schema.
ALTER TABLE "app"."Problem" ADD CONSTRAINT "Problem_limits_check"
  CHECK ("estimatedMinutes" BETWEEN 1 AND 240 AND "timeLimitMs" BETWEEN 100 AND 30000
    AND "memoryLimitKb" BETWEEN 1024 AND 1048576 AND "revision" >= 1);
ALTER TABLE "app"."Problem" ADD CONSTRAINT "Problem_slug_check"
  CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "app"."Problem" ADD CONSTRAINT "Problem_published_check"
  CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL);
ALTER TABLE "app"."ProblemHint" ADD CONSTRAINT "Hint_position_check" CHECK ("position" BETWEEN 1 AND 5);
ALTER TABLE "app"."ProblemExample" ADD CONSTRAINT "Example_position_check" CHECK ("position" > 0);
ALTER TABLE "app"."TestCase" ADD CONSTRAINT "TestCase_position_check" CHECK ("position" > 0);
ALTER TABLE "app"."SolutionStep" ADD CONSTRAINT "SolutionStep_position_check" CHECK ("position" > 0);
ALTER TABLE "app"."RoadmapStep" ADD CONSTRAINT "RoadmapStep_position_check" CHECK ("position" > 0);
ALTER TABLE "app"."ProblemRelation" ADD CONSTRAINT "ProblemRelation_self_check" CHECK ("problemId" <> "relatedId");
ALTER TABLE "app"."Roadmap" ADD CONSTRAINT "Roadmap_estimate_check" CHECK ("estimatedMinutes" > 0);
ALTER TABLE "app"."UserProgress" ADD CONSTRAINT "Progress_solved_check"
  CHECK (("status" = 'SOLVED') = ("solvedAt" IS NOT NULL));
ALTER TABLE "app"."UserSubmission" ADD CONSTRAINT "Submission_counts_check"
  CHECK ("problemRevision" > 0 AND "passedCount" >= 0 AND "totalCount" >= "passedCount"
    AND ("runtimeMs" IS NULL OR "runtimeMs" >= 0) AND ("memoryKb" IS NULL OR "memoryKb" >= 0));
ALTER TABLE "app"."UserSubmission" ADD CONSTRAINT "Submission_accepted_check"
  CHECK ("status" <> 'ACCEPTED' OR ("totalCount" > 0 AND "passedCount" = "totalCount" AND "completedAt" IS NOT NULL));
ALTER TABLE "app"."MockInterview" ADD CONSTRAINT "Interview_limits_check"
  CHECK ("durationMinutes" BETWEEN 1 AND 240 AND ("score" IS NULL OR "score" BETWEEN 0 AND 100));
ALTER TABLE "app"."MockInterviewQuestion" ADD CONSTRAINT "InterviewQuestion_limits_check"
  CHECK ("position" > 0 AND ("score" IS NULL OR "score" BETWEEN 0 AND 100));

-- Defense in depth: application data lives outside Supabase's public API schema.
-- Prisma runs on the trusted server as the schema owner; authorize every user query there.
REVOKE ALL ON SCHEMA "app" FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA "app" FROM PUBLIC;
DO $$
DECLARE app_table record;
BEGIN
  FOR app_table IN SELECT tablename FROM pg_tables WHERE schemaname = 'app' LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', app_table.tablename);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA "app" FROM anon;
    REVOKE ALL ON ALL TABLES IN SCHEMA "app" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA "app" FROM authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA "app" FROM authenticated;
  END IF;
END $$;
