# Phase 9 — Progress tracking

## 🟦 What we built

AlgoSprint now connects learning activity to a private progress record. A learner can mark a problem attempted, mark a manual solve, undo only a manual solve, and independently set review later. Reserving a code execution automatically records an attempt. Completing an accepted full-suite submission verifies a solve only when it matches the current published problem revision.

The new protected `/progress` page shows collection, started, attempted, solved, current verified and review counts; tables by difficulty and category; the ten most recent runs/submissions; and the latest state of ten recently updated problems. The library and detail page use the same provenance labels. Sidebar navigation and the dashboard link make the page discoverable.

This completes progress tracking for Phase 9. Charts, streaks, topic recommendations and the redesigned analytics dashboard remain Phase 10. There is still no public leaderboard, complete activity audit log, or saved-source history viewer. Original problem content and runner configuration remain unchanged.

## 🟨 Why the statuses are separate

A solve mark is a learner's assessment. It does not establish that code ran or passed a hidden suite. A visible-only run also cannot establish that the full suite passed. We retain both learning records and runner evidence without conflating them.

| Event | Attempted date | Solve state | Fields preserved |
| --- | --- | --- | --- |
| Mark attempted | Record first attempt | NOT_STARTED becomes ATTEMPTED; an existing solve stays solved | Review, bookmark, notes, solve provenance |
| Reserve Run or Submit | Record first attempt in the same transaction as the reservation | Same attempt behavior, even if execution later fails | Same unrelated fields |
| Mark solved | Unchanged | Unsolved becomes SOLVED with selfMarked=true and solvedAt | Prior attempt, review, bookmark, notes |
| Undo manual solve | Unchanged | ATTEMPTED if an attempt exists; otherwise NOT_STARTED | Review, bookmark, notes |
| Set/remove review | Unchanged | Unchanged | Attempt/solve dates and provenance |
| Accepted visible Run | Already recorded | Never grants a verified solve | Existing solves remain |
| Failed execution | Already recorded | Never grants a verified solve | Existing solves remain |
| Accepted full Submit on current published revision | Already recorded | SOLVED, selfMarked=false, verifiedRevision and verifiedAt recorded | First solved date, first attempted date, review, bookmark, notes |
| Accepted Submit after revision change/archive | Already recorded | No new verification; save the submission verdict for its captured revision | Existing progress remains |

Undo cannot erase a verified solve. Repeating a mark or a successful verification on the same revision does not change the original dates or create false recent-progress activity. Each new execution still has its own submission record, so it appears in recent attempts.

A previously verified solve remains in solved history if the problem is revised. Its badge changes to **verified on an earlier revision**, and it stops contributing to the **Verified on current revision** count. Passing the new revision updates verifiedRevision/verifiedAt but retains the original solvedAt. A legacy SOLVED record without new verification metadata is labeled **recorded**, not verified.

## 🟦 Database design and migration

Two nullable columns are added to the existing `UserProgress` model:

- `verifiedRevision`: the exact problem revision certified by a successful full submission.
- `verifiedAt`: the first verification time for that stored revision.

`solvedAt` remains the first current solve-state date. When a manual solve is later verified, its old solvedAt is preserved and verifiedAt records the separate proof date. `attemptedAt` is the first attempt date, including manual attempts. Notes remain in UserNote; review/bookmark flags remain independent fields.

The SQL migration enforces paired verification metadata: both values are null, or the revision is positive, verifiedAt is present, status is SOLVED and selfMarked is false. The earlier solved-timestamp constraint remains. All 22 models keep their existing RLS and ownership boundaries; no new table or dependency is introduced.

The migration also reconciles existing Phase 8 submissions:

1. Group saved attempts by owner/problem and backfill the earliest attemptedAt. Preserve existing solves, flags and later activity timestamps.
2. Find completed accepted SUBMIT records with positive, fully passed counts matching a currently published revision.
3. Upgrade those owner/problem progress records to verified, retaining an existing solvedAt. Visible passes, failures, archived content and stale-revision passes are not promoted.

This is a one-time Prisma migration, not a script to rerun manually. It uses parameter-free, trusted relational SQL and does not touch problem statements, solutions, test payloads, notes or submission source. Existing earlier-revision submission records remain historical evidence; the initial backfill grants current verification only for matching published revisions.

## 🟩 How concurrent writes stay consistent

`writeProgress` is a trusted transaction helper, not a server action exposed to the browser. Callers authenticate first and acquire a shared lock on the problem row. The helper inserts the owner/problem progress row if absent, then locks that row with `FOR UPDATE`, reads its state and applies only relevant changes.

The same helper handles manual controls, runner reservations and accepted completions. This prevents a simultaneous manual undo from erasing a newly verified solve, or a review update from overwriting solve fields. Unique owner/problem keys prevent duplicate progress rows. Different users never share a progress record.

Submission reservation and attempted progress commit together. Final result and verified progress also commit together. `finishSubmission` re-reads the reservation by verified owner, checks mode and test count against it, requires a RUNNING state for the one-time final write, and verifies the current published problem revision while holding its shared lock. A failed write rolls back the final verdict and solve update together. No external Judge0 request runs inside these database transactions.

The existing runner's limits, hidden-result redaction and isolation design remain intact. This phase does not evaluate any submitted code in the application process. The database tests use controlled stored verdict fixtures, not live Judge0 execution.

## 🟨 Counts and recent activity

| Display | Meaning |
| --- | --- |
| Published problems | Number of currently published problems in the collection |
| Started | Problems with ATTEMPTED or SOLVED status |
| Attempted | Problems with an attemptedAt date, including those later solved |
| Solved | SOLVED records, including manual, current verified, earlier verified and legacy recorded solves |
| Verified on current revision | Nonmanual solves whose verifiedRevision equals the problem's present revision |
| Review later | Published problems whose reviewLater flag is true |

Counts are not all disjoint. A solved problem can also count as attempted and review later. A manual solve does not automatically invent an attempt date, so it may count as Started/Solved but not Attempted. Categories overlap because a problem can belong to multiple categories; adding category totals does not yield the global problem count. Difficulty groups are separate.

All queries are scoped to the verified owner and currently published problems. Archived/draft problems and their activity are excluded from this view, while their historical database records remain. The summary reads minimal published problem/progress/category projections within one Repeatable Read transaction; it does not fetch statements, solutions, tests or notes. It aggregates in memory for the planned 1,000-problem collection. A substantially larger collection should move aggregations into dedicated SQL queries, not blindly fetch more data.

Recent attempts show only mode, status, passed/total counts, captured/current revisions and timestamps with the public problem title/slug. They do not expose code, stored result JSON, operational user IDs, hidden cases or provider tokens. Pending work says No final result yet. Recent progress shows each problem's latest state, not every historical event. Both lists are bounded to ten and have deterministic ordering. Dates are explicitly displayed in UTC.

## 🟦 Files and connections

| Location | Responsibility |
| --- | --- |
| `prisma/schema.prisma` and the new migration | Provenance fields, relational constraint and Phase 8 backfill |
| `src/features/progress/write.ts` | Shared transactional row-locked progress changes |
| `src/features/progress/presentation.ts` | Public progress shape and consistent provenance labels |
| `src/features/progress/query.ts` | Owner-scoped counts and limited recent activity |
| `src/features/progress/load.ts` | Verified-user guard before any progress query |
| `src/app/progress/` | Protected dynamic page and loading state |
| `src/components/progress/progress-summary.tsx` | Counts, accessible tables, empty states and activity lists |
| Problem features and controls | Manual attempted operation and common progress labels |
| Submission features | Attempt on reservation; atomic result/verification on completion; revision display |
| `runner-controls.tsx` | Immediate pending feedback followed by an asynchronous server-action transition |
| Navigation, dashboard link and proxy | Discovery, session refresh and private/no-store responses |
| Tests and HTTP smoke | State, migration, auth, privacy, concurrency and rendering checks |

Server actions still validate input and obtain identity from Supabase on every request. Neither the progress page nor manual action accepts a client-supplied owner, verified revision or verdict. Updates revalidate the problem, library, progress and dashboard routes. The editor retains its in-page draft during same-problem re-renders.

## 🟨 Fixes found while finishing the phase

The paused draft had 92 passing and two failing local tests. Both failures are resolved:

1. Pending feedback was inside an asynchronous React transition, so the visible disabled state was deferred. The click handler now sets its busy ref and pending state immediately, then invokes the server action inside startTransition. Duplicate requests remain blocked while the action can refresh server-rendered progress.
2. Migration test fixtures used date-only SQL literals, which depended on the environment timezone. The fixtures now use explicit UTC instants. Production timestamps and the assertion's expected instant were not changed to hide the mismatch.

The production HTTP check also caught a streaming detail: loading.tsx could send HTTP 200 before the page issued its sign-in redirect. The progress layout now verifies the viewer outside that loading boundary, producing the expected HTTP 307 before rendering. The data loader still checks identity on every read because layouts may persist during client navigation. This preserves both loading feedback and access checks.

The historical pause note and source checkpoint remain available, clearly marked as superseded. Use this guide and current source for the completed implementation.

## 🟦 Run locally on your Mac

Use Node.js 24 and a current authenticated checkout of the private repository. If starting fresh:

```bash
git clone https://github.com/zihadpcode/AlgoSprint.git
cd AlgoSprint
npm ci
```

If PR #10 is still open, use `git switch --track origin/algosprint/phase-9-progress`. After merge, use main. Preserve your own uncommitted changes when switching/updating branches.

If you do not already have `.env.local`, copy `.env.example` once:

```bash
cp .env.example .env.local
```

Keep existing configuration rather than overwriting it. Follow Phase 3 for DATABASE_URL, Supabase publishable key/project URL and APP_URL. Only a confirmed account can visit `/progress`. Judge0 configuration is optional for manual tracking; use the Phase 8 guide if you want real code execution.

Apply the new migration to your development database before running the updated app:

```bash
npm run db:deploy
npm run db:generate
npm run db:seed
npm run dev
```

`DIRECT_URL`, if configured, is the migration connection and can differ from DATABASE_URL. Verify both point to the intended development project. Do not use `migrate reset` on valuable data. No live database migration was applied during this work; CI uses disposable PostgreSQL.

For a later deployment with active execution, stop accepting new runner requests and allow existing requests to drain before migration/deployment, so an old Phase 8 process cannot finish a submission after the backfill without updating progress. Apply the migration, deploy the matching application, and then re-enable execution after checks. Production deployment remains Phase 16.

Open `/problems/relay-window`, mark an attempt or manual solve, and open `/progress` from the sidebar. The page should reflect only your own activity. You can use all manual tracking features without a Judge0 account.

## 🟩 Complete source files

The following are all 36 authored source/configuration/test files changed from Phase 8. Status documents are maintained separately in README and SESSION-HANDOFF.md. Generated Prisma client files remain generated and are not committed. No package or lockfile changed.

### `prisma/migrations/202609160001_progress_verification/migration.sql`

```sql
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
```

### `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  schemas  = ["app"]
}

enum Role {
  USER
  ADMIN

  @@schema("app")
}

enum Difficulty {
  EASY
  MEDIUM
  HARD

  @@schema("app")
}

enum ContentStatus {
  DRAFT
  PUBLISHED
  ARCHIVED

  @@schema("app")
}

enum ProblemKind {
  CODING
  SQL
  CONCEPTUAL
  OBJECT_ORIENTED

  @@schema("app")
}

enum Language {
  JAVASCRIPT
  TYPESCRIPT
  PYTHON
  JAVA
  CPP
  SQL

  @@schema("app")
}

enum SolutionKind {
  BRUTE_FORCE
  BETTER
  OPTIMAL
  ALTERNATIVE

  @@schema("app")
}

enum TestVisibility {
  VISIBLE
  HIDDEN

  @@schema("app")
}

enum ProgressStatus {
  NOT_STARTED
  ATTEMPTED
  SOLVED

  @@schema("app")
}

enum SubmissionMode {
  RUN
  SUBMIT

  @@schema("app")
}

enum SubmissionStatus {
  QUEUED
  RUNNING
  ACCEPTED
  WRONG_ANSWER
  COMPILE_ERROR
  RUNTIME_ERROR
  TIME_LIMIT
  MEMORY_LIMIT
  INTERNAL_ERROR

  @@schema("app")
}

enum InterviewStatus {
  CREATED
  IN_PROGRESS
  COMPLETED
  ABANDONED

  @@schema("app")
}

enum QuestionKind {
  CODING
  CONCEPTUAL
  DEBUGGING
  OPTIMIZATION
  BEHAVIORAL
  SYSTEM_DESIGN

  @@schema("app")
}

// The ID is supplied only after Supabase verifies the authenticated user.
// Supabase owns passwords and authentication; Prisma never stores passwords.
model User {
  id          String           @id @db.Uuid
  displayName String?          @db.VarChar(80)
  role        Role             @default(USER)
  timeZone    String           @default("UTC") @db.VarChar(80)
  createdAt   DateTime         @default(now()) @db.Timestamptz(6)
  updatedAt   DateTime         @updatedAt @db.Timestamptz(6)
  progress    UserProgress[]
  submissions UserSubmission[]
  notes       UserNote[]
  interviews  MockInterview[]

  @@schema("app")
}

model Problem {
  id                 String                  @id @default(uuid()) @db.Uuid
  slug               String                  @unique @db.VarChar(100)
  title              String                  @db.VarChar(160)
  difficulty         Difficulty
  kind               ProblemKind             @default(CODING)
  status             ContentStatus           @default(DRAFT)
  pattern            String                  @db.VarChar(100)
  statement          String                  @db.Text
  constraints        String[]
  estimatedMinutes   Int
  timeLimitMs        Int                     @default(2000)
  memoryLimitKb      Int                     @default(262144)
  revision           Int                     @default(1)
  seedHash           String?                 @db.VarChar(64)
  publishedAt        DateTime?               @db.Timestamptz(6)
  createdAt          DateTime                @default(now()) @db.Timestamptz(6)
  updatedAt          DateTime                @updatedAt @db.Timestamptz(6)
  examples           ProblemExample[]
  hints              ProblemHint[]
  solutions          ProblemSolution[]
  starterCode        StarterCode[]
  testCases          TestCase[]
  categories         ProblemCategory[]
  tags               ProblemTag[]
  interviewStyles    ProblemInterviewStyle[]
  related            ProblemRelation[]       @relation("RelatedFrom")
  relatedTo          ProblemRelation[]       @relation("RelatedTo")
  progress           UserProgress[]
  submissions        UserSubmission[]
  notes              UserNote[]
  roadmapSteps       RoadmapStep[]
  interviewQuestions MockInterviewQuestion[]

  @@index([status, difficulty, slug])
  @@index([status, pattern, slug])
  @@index([status, estimatedMinutes])
  @@schema("app")
}

model ProblemExample {
  id          String  @id @default(uuid()) @db.Uuid
  problemId   String  @db.Uuid
  position    Int
  input       Json
  output      Json
  explanation String  @db.Text
  problem     Problem @relation(fields: [problemId], references: [id], onDelete: Cascade)

  @@unique([problemId, position])
  @@schema("app")
}

model ProblemHint {
  id        String  @id @default(uuid()) @db.Uuid
  problemId String  @db.Uuid
  position  Int
  content   String  @db.Text
  problem   Problem @relation(fields: [problemId], references: [id], onDelete: Cascade)

  @@unique([problemId, position])
  @@schema("app")
}

model ProblemSolution {
  id                   String         @id @default(uuid()) @db.Uuid
  problemId            String         @db.Uuid
  kind                 SolutionKind
  language             Language
  title                String         @db.VarChar(160)
  intuition            String         @db.Text
  approach             String         @db.Text
  pseudocode           String         @db.Text
  code                 String         @db.Text
  timeComplexity       String         @db.VarChar(200)
  spaceComplexity      String         @db.VarChar(200)
  commonMistakes       String[]
  interviewExplanation String         @db.Text
  problem              Problem        @relation(fields: [problemId], references: [id], onDelete: Cascade)
  steps                SolutionStep[]

  @@unique([problemId, kind, language])
  @@schema("app")
}

model SolutionStep {
  id         String          @id @default(uuid()) @db.Uuid
  solutionId String          @db.Uuid
  position   Int
  title      String          @db.VarChar(160)
  content    String          @db.Text
  solution   ProblemSolution @relation(fields: [solutionId], references: [id], onDelete: Cascade)

  @@unique([solutionId, position])
  @@schema("app")
}

model StarterCode {
  id         String   @id @default(uuid()) @db.Uuid
  problemId  String   @db.Uuid
  language   Language
  entryPoint String   @db.VarChar(100)
  code       String   @db.Text
  problem    Problem  @relation(fields: [problemId], references: [id], onDelete: Cascade)

  @@unique([problemId, language])
  @@schema("app")
}

// Never serialize this model wholesale into an API response or client props.
model TestCase {
  id          String         @id @default(uuid()) @db.Uuid
  problemId   String         @db.Uuid
  position    Int
  visibility  TestVisibility
  input       Json
  output      Json
  explanation String?        @db.Text
  problem     Problem        @relation(fields: [problemId], references: [id], onDelete: Cascade)

  @@unique([problemId, position])
  @@index([problemId, visibility])
  @@schema("app")
}

model Category {
  id       String            @id @default(uuid()) @db.Uuid
  slug     String            @unique @db.VarChar(100)
  name     String            @unique @db.VarChar(100)
  problems ProblemCategory[]

  @@schema("app")
}

model Tag {
  id       String       @id @default(uuid()) @db.Uuid
  slug     String       @unique @db.VarChar(100)
  name     String       @unique @db.VarChar(100)
  problems ProblemTag[]

  @@schema("app")
}

model InterviewStyle {
  id       String                  @id @default(uuid()) @db.Uuid
  slug     String                  @unique @db.VarChar(100)
  name     String                  @unique @db.VarChar(100)
  problems ProblemInterviewStyle[]

  @@schema("app")
}

model ProblemCategory {
  problemId  String   @db.Uuid
  categoryId String   @db.Uuid
  problem    Problem  @relation(fields: [problemId], references: [id], onDelete: Cascade)
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)

  @@id([problemId, categoryId])
  @@index([categoryId, problemId])
  @@schema("app")
}

model ProblemTag {
  problemId String  @db.Uuid
  tagId     String  @db.Uuid
  problem   Problem @relation(fields: [problemId], references: [id], onDelete: Cascade)
  tag       Tag     @relation(fields: [tagId], references: [id], onDelete: Restrict)

  @@id([problemId, tagId])
  @@index([tagId, problemId])
  @@schema("app")
}

model ProblemInterviewStyle {
  problemId String         @db.Uuid
  styleId   String         @db.Uuid
  problem   Problem        @relation(fields: [problemId], references: [id], onDelete: Cascade)
  style     InterviewStyle @relation(fields: [styleId], references: [id], onDelete: Restrict)

  @@id([problemId, styleId])
  @@index([styleId, problemId])
  @@schema("app")
}

model ProblemRelation {
  problemId String  @db.Uuid
  relatedId String  @db.Uuid
  problem   Problem @relation("RelatedFrom", fields: [problemId], references: [id], onDelete: Cascade)
  related   Problem @relation("RelatedTo", fields: [relatedId], references: [id], onDelete: Cascade)

  @@id([problemId, relatedId])
  @@index([relatedId])
  @@schema("app")
}

model UserProgress {
  userId      String         @db.Uuid
  problemId   String         @db.Uuid
  status      ProgressStatus @default(NOT_STARTED)
  bookmarked  Boolean        @default(false)
  reviewLater Boolean        @default(false)
  selfMarked  Boolean        @default(false)
  attemptedAt DateTime?      @db.Timestamptz(6)
  solvedAt    DateTime?      @db.Timestamptz(6)
  verifiedRevision Int?
  verifiedAt DateTime? @db.Timestamptz(6)
  createdAt   DateTime       @default(now()) @db.Timestamptz(6)
  updatedAt   DateTime       @updatedAt @db.Timestamptz(6)
  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  problem     Problem        @relation(fields: [problemId], references: [id], onDelete: Restrict)

  @@id([userId, problemId])
  @@index([userId, status, updatedAt])
  @@index([userId, reviewLater])
  @@index([problemId])
  @@schema("app")
}

model UserSubmission {
  id              String           @id @default(uuid()) @db.Uuid
  userId          String           @db.Uuid
  problemId       String           @db.Uuid
  problemRevision Int
  language        Language
  mode            SubmissionMode
  status          SubmissionStatus @default(QUEUED)
  code            String           @db.Text
  passedCount     Int              @default(0)
  totalCount      Int              @default(0)
  runtimeMs       Int?
  memoryKb        Int?
  // Internal runner result; public DTOs must redact hidden-test data.
  result          Json?
  createdAt       DateTime         @default(now()) @db.Timestamptz(6)
  completedAt     DateTime?        @db.Timestamptz(6)
  user            User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  problem         Problem          @relation(fields: [problemId], references: [id], onDelete: Restrict)

  @@index([userId, createdAt])
  @@index([userId, problemId, createdAt])
  @@index([status, createdAt])
  @@index([problemId])
  @@schema("app")
}

model UserNote {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  problemId String   @db.Uuid
  content   String   @db.Text
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @db.Timestamptz(6)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  problem   Problem  @relation(fields: [problemId], references: [id], onDelete: Restrict)

  @@unique([userId, problemId])
  @@index([userId, updatedAt])
  @@index([problemId])
  @@schema("app")
}

model Roadmap {
  id               String        @id @default(uuid()) @db.Uuid
  slug             String        @unique @db.VarChar(100)
  title            String        @db.VarChar(160)
  description      String        @db.Text
  difficulty       Difficulty
  estimatedMinutes Int
  status           ContentStatus @default(DRAFT)
  createdAt        DateTime      @default(now()) @db.Timestamptz(6)
  updatedAt        DateTime      @updatedAt @db.Timestamptz(6)
  steps            RoadmapStep[]

  @@index([status, difficulty])
  @@schema("app")
}

model RoadmapStep {
  id          String  @id @default(uuid()) @db.Uuid
  roadmapId   String  @db.Uuid
  problemId   String  @db.Uuid
  position    Int
  title       String  @db.VarChar(160)
  description String? @db.Text
  roadmap     Roadmap @relation(fields: [roadmapId], references: [id], onDelete: Cascade)
  problem     Problem @relation(fields: [problemId], references: [id], onDelete: Restrict)

  @@unique([roadmapId, position])
  @@unique([roadmapId, problemId])
  @@index([problemId])
  @@schema("app")
}

model MockInterview {
  id              String                  @id @default(uuid()) @db.Uuid
  userId          String                  @db.Uuid
  status          InterviewStatus         @default(CREATED)
  durationMinutes Int
  score           Int?
  report          Json?
  startedAt       DateTime?               @db.Timestamptz(6)
  completedAt     DateTime?               @db.Timestamptz(6)
  createdAt       DateTime                @default(now()) @db.Timestamptz(6)
  user            User                    @relation(fields: [userId], references: [id], onDelete: Cascade)
  questions       MockInterviewQuestion[]

  @@index([userId, createdAt])
  @@schema("app")
}

model MockInterviewQuestion {
  id          String        @id @default(uuid()) @db.Uuid
  interviewId String        @db.Uuid
  problemId   String?       @db.Uuid
  kind        QuestionKind
  position    Int
  prompt      String        @db.Text
  answer      String?       @db.Text
  score       Int?
  feedback    String?       @db.Text
  interview   MockInterview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  problem     Problem?      @relation(fields: [problemId], references: [id], onDelete: Restrict)

  @@unique([interviewId, position])
  @@index([problemId])
  @@schema("app")
}
```

### `scripts/smoke-auth.mjs`

```javascript
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const origin = "http://127.0.0.1:3100";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"], {
  env: { ...process.env, DATABASE_URL: "", DIRECT_URL: "", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", APP_URL: "", NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let diagnostic = "";
const collect = (chunk) => { diagnostic = (diagnostic + chunk.toString()).slice(-5000); };
server.stderr.on("data", collect);
server.stdout.on("data", collect);
try {
  let ready = false;
  let lastFailure = "No response yet";
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Server exited: ${diagnostic}`);
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(2000) });
      if (response.ok) { ready = true; break; }
      lastFailure = `HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`;
    } catch (error) { lastFailure = String(error); }
    await delay(200);
  }
  assert.ok(ready, `Production server must become ready: ${lastFailure}\n${diagnostic}`);
  for (const path of ["/dashboard", "/progress", "/profile", "/admin"]) {
    const response = await fetch(origin + path, { redirect: "manual", headers: { cookie: "sb-access-token=forged; role=ADMIN" } });
    assert.equal(response.status, 307, `${path}: ${diagnostic}`);
    assert.ok(response.headers.get("location")?.startsWith("/login?next="), path);
  }
  for (const path of ["/login", "/register"]) {
    const response = await fetch(origin + path); assert.equal(response.status, 200, path);
    assert.ok((await response.text()).includes("Accounts are being prepared"), path);
  }
  for (const path of ["/not-a-real-route", "/ui-check"]) {
    const missing = await fetch(origin + path);
    assert.equal(missing.status, 404, path);
    assert.ok((await missing.text()).includes("This page isn’t available"), path);
  }
  const library = await fetch(origin + "/problems");
  assert.equal(library.status, 200);
  assert.ok((await library.text()).includes("The library is being prepared"));
  const detail = await fetch(origin + "/problems/relay-window");
  assert.equal(detail.status, 200);
  assert.ok((await detail.text()).includes("Practice is being prepared"));
  assert.equal((await fetch(origin + "/problems/INVALID")).status, 404);
  const callback = await fetch(origin + "/auth/callback?code=forged", { redirect: "manual" });
  assert.equal(callback.status, 503); assert.match(callback.headers.get("cache-control") ?? "", /(?:^|,\s*)no-store(?:,|$)/);
  console.log("Production HTTP smoke passed: landing, protected redirects, missing-config forms, custom 404, and callback denial.");
} finally {
  server.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(3000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
```

### `src/app/dashboard/page.tsx`

```tsx
import type { Metadata } from "next";
import { requireViewer } from "@/features/auth/session";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const viewer = await requireViewer();
  return <AccountFrame admin={viewer.role === "ADMIN"}>
    <PageHeading eyebrow="Your practice space" title={`Welcome, ${viewer.displayName || "learner"}.`} description="Build an approach you understand, then carry that insight into the next challenge." action={<ButtonLink href="/profile" variant="secondary">View profile</ButtonLink>} />
    <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <Card><Badge tone="success">Account ready</Badge><CardTitle className="mt-5">A small step, taken consistently.</CardTitle><CardDescription>Start with the question, trace a simple example, and explain your approach before optimizing it. Deliberate practice starts with understanding.</CardDescription></Card>
      <Card><CardTitle>Your practice rhythm</CardTitle><ol className="mt-5 space-y-4 text-sm text-muted">{["Read the constraints and choose an example.", "Write a first approach you can explain.", "Review what changed your understanding."].map((step, index) => <li key={step} className="flex gap-3"><span className="font-mono text-accent">0{index + 1}</span><span>{step}</span></li>)}</ol></Card>
    </div>
    <section className="mt-8" aria-label="Practice activity"><EmptyState title="Your next insight starts with a problem" description="Explore the library, work through a guided explanation, and keep a private note. Your progress page records attempts, solved counts and recent activity." action={<ButtonLink href="/progress">View your progress</ButtonLink>} /></section>
  </AccountFrame>;
}
```

### `src/app/progress/layout.tsx`

```tsx
import type { ReactNode } from "react";
import { requireViewer } from "@/features/auth/session";

export default async function ProgressLayout({ children }: { children: ReactNode }) {
  // Authenticate before this segment's loading fallback starts streaming.
  // The data loader still authorizes each read; layouts can persist on navigation.
  await requireViewer("/progress");
  return children;
}
```

### `src/app/progress/loading.tsx`

```tsx
export default function ProgressLoading() {
  return <p role="status" className="p-8 text-sm text-muted">Loading your progress…</p>;
}
```

### `src/app/progress/page.tsx`

```tsx
import type { Metadata } from "next";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { ButtonLink } from "@/components/ui/button";
import { ProgressSummary } from "@/components/progress/progress-summary";
import { loadProgress } from "@/features/progress/load";

export const metadata: Metadata = { title: "Your progress", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function ProgressPage() {
  const { summary, admin } = await loadProgress();
  return <AccountFrame admin={admin}>
    <PageHeading eyebrow="Your practice record" title="Your progress" description="See what you have tried, what you have solved, and what you want to revisit." action={<ButtonLink href="/problems">Choose a problem</ButtonLink>} />
    <ProgressSummary summary={summary} />
  </AccountFrame>;
}
```

### `src/components/editor/execution-panels.tsx`

```tsx
import { CodeBlock } from "@/components/problems/code-block";
import { verdictLabels, type ExecutionResult } from "@/features/submissions/contracts";

export type EditorExample = { position: number; input: unknown; output: unknown; explanation: string };

export function ExecutionPanels({ examples, available = false, result }: { examples: EditorExample[]; available?: boolean; result?: ExecutionResult }) {
  return <div className="space-y-5">
    <section aria-label="Output" className="rounded-xl border border-line bg-canvas p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Output</h3>
        <span className="text-xs font-semibold text-warm">{result ? verdictLabels[result.status] : available ? "Ready to run" : "Execution unavailable"}</span>
      </div>
      <p className="mt-4 text-sm leading-7 text-muted">{result ? `${result.passedCount} of ${result.totalCount} tests passed. ${result.mode === "RUN" ? "Visible tests only; this is not a full submission verdict." : "Full suite submission; hidden details are withheld."}` : "No output yet."}</p>
      {result?.status === "INTERNAL_ERROR" && <p className="mt-3 text-sm text-warm">The service could not complete evaluation. This does not establish whether your solution is correct.</p>}
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-xs text-muted">
        <div><dt>Runtime</dt><dd className="mt-1">{result?.runtimeMs == null ? "Not measured" : `${result.runtimeMs} ms (slowest test)`}</dd></div>
        <div><dt>Memory</dt><dd className="mt-1">{result?.memoryKb == null ? "Not measured" : `${result.memoryKb} KB (peak test)`}</dd></div>
      </dl>
      {result && <p className="mt-3 break-all text-xs text-muted">Saved attempt: {result.id}{result.problemRevision !== undefined && ` · Problem revision ${result.problemRevision}`}</p>}
    </section>
    <section aria-label="Test results" className="rounded-xl border border-line bg-canvas p-5">
      <h3 className="font-semibold">Test results</h3>
      {result ? result.mode === "SUBMIT" ? <p className="mt-3 text-sm leading-7 text-muted">Only the summary is shown for submissions. Use Run visible tests to inspect output and errors without revealing hidden inputs.</p> :
        <ol className="mt-4 space-y-3">{result.cases.map((test, index) => <li key={test.position}>
          <details className="rounded-xl border border-line bg-surface p-4">
            <summary className="cursor-pointer text-sm font-semibold text-accent">Visible test {index + 1} · {verdictLabels[test.status]}</summary>
            <div className="mt-4 space-y-4">
              <CodeBlock label="Input" code={JSON.stringify(test.input, null, 2)} />
              <CodeBlock label="Expected output" code={JSON.stringify(test.expected, null, 2)} />
              <CodeBlock label="Actual output (up to 4,000 characters)" code={test.stdout || "(no output)"} />
              {test.diagnostic && <CodeBlock label="Errors / console logs (up to 4,000 characters)" code={test.diagnostic} />}
              {test.status === "WRONG_ANSWER" && <p className="text-sm text-muted">The returned JSON did not match the expected value. Check types and array order; return the result from the named function.</p>}
            </div>
          </details>
        </li>)}</ol> : <>
        <p className="mt-3 text-sm leading-7 text-muted">Not run. These are public examples and their expected outputs, not execution results.</p>
        {examples.length ? <ol className="mt-4 space-y-3">
          {examples.map((example, index) => <li key={example.position}>
            <details className="rounded-xl border border-line bg-surface p-4">
              <summary className="cursor-pointer text-sm font-semibold text-accent">Example {index + 1} · Not run</summary>
              <div className="mt-4 space-y-4">
                <CodeBlock label={"Test example " + (index + 1) + " input"} code={JSON.stringify(example.input, null, 2) ?? "null"} />
                <CodeBlock label={"Test example " + (index + 1) + " expected output"} code={JSON.stringify(example.output, null, 2) ?? "null"} />
                <p className="text-sm text-muted">Actual output: Not run</p>
                <p className="text-sm leading-7 text-muted">{example.explanation}</p>
              </div>
            </details>
          </li>)}
        </ol> : <p className="mt-4 text-sm text-muted">No public examples are available for this problem.</p>}
      </>}
    </section>
  </div>;
}
```

### `src/components/editor/runner-controls.tsx`

```tsx
"use client";

import { startTransition, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { executeCode } from "@/features/submissions/actions";
import type { ExecutionState } from "@/features/submissions/contracts";
import { ExecutionPanels, type EditorExample } from "./execution-panels";

export function RunnerControls({ slug, code, language, enabled, signedIn, examples }: {
  slug: string; code: string; language: string; enabled: boolean; signedIn: boolean; examples: EditorExample[];
}) {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [last, setLast] = useState<{ code: string; language: string; response: ExecutionState } | null>(null);
  const available = enabled && language === "JAVASCRIPT";
  function execute(mode: "RUN" | "SUBMIT") {
    if (busy.current) return;
    busy.current = true; setPending(true); setLast(null);
    // Urgent pending feedback must render before the asynchronous transition.
    // Keep the server action in a transition so revalidated progress can refresh.
    startTransition(async () => {
      let response: ExecutionState;
      try { response = await executeCode({ slug, code, language, mode }); }
      catch { response = { success: false, message: "The connection was interrupted. The result may have been saved. Retrying creates a new attempt." }; }
      setLast({ code, language, response }); setPending(false); busy.current = false;
    });
  }
  const stale = last && (last.code !== code || last.language !== language);
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-3">
      <Button disabled={!available || !signedIn || pending || !code.trim() || code.length > 20_000} onClick={() => execute("RUN")}>Run visible tests</Button>
      <Button variant="secondary" disabled={!available || !signedIn || pending || !code.trim() || code.length > 20_000} onClick={() => execute("SUBMIT")}>Submit solution</Button>
    </div>
    {!signedIn && <ButtonLink href={`/login?next=${encodeURIComponent(`/problems/${slug}`)}`} variant="secondary">Sign in to run code</ButtonLink>}
    <p className="text-xs leading-6 text-muted">{available ? "Run checks visible tests. Submit checks the full suite, including hidden tests. Both save an attempt. Limit: 5 per minute and 30 per hour." : "Code execution is not available yet for this workspace. You can continue editing."}</p>
    {code.length > 20_000 && <p className="text-sm text-warm">Code must be at most 20,000 characters.</p>}
    <p role="status" aria-live="polite" className="text-sm text-accent">{pending ? "Executing the captured draft… You can keep editing." : last?.response.success ? "Execution result saved." : ""}</p>
    {last && !last.response.success && <p role="alert" className="text-sm text-warm">{last.response.message}</p>}
    {stale && <p className="text-sm text-warm">This result belongs to an earlier draft or language. Run again to check your current code.</p>}
    <ExecutionPanels examples={examples} available={available} result={last?.response.success ? last.response.result : undefined} />
  </div>;
}
```

### `src/components/layout/workspace-nav.tsx`

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UserRound, ShieldCheck, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
const links = [ { href: "/problems", label: "Problems", icon: BookOpen }, { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, { href: "/progress", label: "Progress", icon: BookOpen }, { href: "/profile", label: "Profile", icon: UserRound } ];
export function WorkspaceNav({ admin = false }: { admin?: boolean }) {
  const pathname = usePathname();
  const items = admin ? [...links, { href: "/admin", label: "Admin", icon: ShieldCheck }] : links;
  return <nav aria-label="Workspace navigation"><ul className="flex gap-2 overflow-x-auto p-2 lg:flex-col">
    {items.map(({ href, label, icon: Icon }) => {
      const active = pathname === href || pathname.startsWith(`${href}/`);
      return <li key={href} className="shrink-0"><Link href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors", active ? "border-accent/25 bg-accent/10 text-accent" : "border-transparent text-muted hover:bg-surface-raised hover:text-ink")}><Icon aria-hidden="true" size={18} />{label}</Link></li>;
    })}
  </ul></nav>;
}
```

### `src/components/problems/personal-controls.tsx`

```tsx
"use client";

import { useActionState, useId, useState } from "react";
import { updateProblem } from "@/features/problems/detail-actions";
import { NOTE_LIMIT, type ProblemActionState } from "@/features/problems/detail-validation";
import type { ProblemDetail } from "@/features/problems/detail-query";
import { SubmitButton } from "@/components/ui/submit-button";
import { progressLabel } from "@/features/progress/presentation";
import { Badge } from "@/components/ui/badge";

const initial: ProblemActionState = {};

export function ProgressControls({ slug, progress }: { slug: string; progress: NonNullable<ProblemDetail["personal"]>["progress"] }) {
  const [state, action, pending] = useActionState(updateProblem, initial);
  const solved = progress.status === "SOLVED";
  return <div className="mt-4 space-y-4">
    <div className="flex flex-wrap gap-2"><Badge tone="accent">{progressLabel(progress)}</Badge>
      {progress.reviewLater && <Badge tone="warm">Review later</Badge>}
    </div>
    <p className="text-sm leading-7 text-muted">Manual marks record your own assessment. A verified solve requires passing the full suite for the current revision. Earlier verified solves remain in your history.</p>
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="review" value={String(!progress.reviewLater)} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton name="operation" value="mark-attempted" variant="secondary" disabled={pending || progress.status !== "NOT_STARTED"} pendingLabel="Saving…">Mark attempted</SubmitButton>
        <SubmitButton name="operation" value={solved ? "clear-solved" : "mark-solved"} disabled={pending || (solved && !progress.selfMarked)} pendingLabel="Saving…">
          {solved ? progress.selfMarked ? "Undo manual solve" : "Solved" : "Mark solved"}
        </SubmitButton>
        <SubmitButton name="operation" value="set-review" variant="secondary" disabled={pending} pendingLabel="Saving…">
          {progress.reviewLater ? "Remove from review" : "Review later"}
        </SubmitButton>
      </div>
    </form>
    <ActionMessage state={state} />
  </div>;
}

export function ProblemNotes({ slug, note }: { slug: string; note: string }) {
  const [state, action, pending] = useActionState(async (previous: ProblemActionState, form: FormData) => {
    const result = await updateProblem(previous, form);
    // Keep this tab's last saved baseline on errors and unrelated page refreshes.
    return { ...result, savedContent: result.success ? result.savedContent : previous.savedContent };
  }, { savedContent: note });
  const [draft, setDraft] = useState(note);
  const id = useId();
  return <form action={action} className="mt-4 space-y-4">
    <input type="hidden" name="slug" value={slug} />
    <input type="hidden" name="operation" value="save-note" />
    <input type="hidden" name="expectedContent" value={state.savedContent ?? ""} />
    <label htmlFor={id} className="block text-sm text-muted">Private notes · record an insight, a mistake, or a question to revisit.</label>
    <textarea id={id} name="content" rows={9} maxLength={NOTE_LIMIT} value={draft} readOnly={pending}
      aria-describedby={`${id}-help`} onChange={(event) => setDraft(event.target.value)}
      className="w-full resize-y rounded-xl border border-muted/60 bg-canvas p-4 text-sm leading-7 text-ink" />
    <p id={`${id}-help`} className="text-xs leading-6 text-muted">{draft.length.toLocaleString("en-US")} / 10,000 characters. Save explicitly before leaving. Save an empty note to clear it.</p>
    <SubmitButton pendingLabel="Saving note…" disabled={pending}>Save note</SubmitButton>
    <ActionMessage state={state} />
  </form>;
}
function ActionMessage({ state }: { state: ProblemActionState }) {
  return <p role="status" aria-atomic="true" className={`text-sm leading-7 ${state.success === false ? "text-warm" : "text-accent"}`}>{state.message ?? ""}</p>;
}
```

### `src/components/problems/problem-card.tsx`

```tsx
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LibraryResult } from "@/features/problems/query";

import { progressLabel } from "@/features/progress/presentation";
export function ProblemCard({ problem }: { problem: LibraryResult["items"][number] }) {
  return (
    <Card className="h-full">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={problem.difficulty === "HARD" ? "warm" : "accent"}>
          {problem.difficulty[0] + problem.difficulty.slice(1).toLowerCase()}
        </Badge>
        <span className="text-xs text-muted">{problem.estimatedMinutes} min</span>
      </div>
      <h2 className="mt-5 text-xl font-semibold [overflow-wrap:anywhere]"><Link href={`/problems/${problem.slug}`} className="text-accent hover:underline underline-offset-4">{problem.title}</Link></h2>
      <p className="mt-3 text-sm text-muted">Pattern: {problem.pattern.replaceAll("-", " ")}</p>
      <div className="mt-5 flex flex-wrap gap-2" aria-label="Categories">
        {problem.categories.map((category) => <Badge key={category.slug}>{category.name}</Badge>)}
      </div>
      <p className="mt-3 text-xs leading-6 text-muted">Tags: {problem.tags.map((tag) => tag.name).join(", ") || "None"}</p>
      {problem.progress && <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
        <Badge tone={problem.progress.status === "SOLVED" ? "success" : "neutral"}>
          {progressLabel(problem.progress)}
        </Badge>
        {problem.progress.reviewLater && <Badge tone="warm">Review later</Badge>}
      </div>}
    </Card>
  );
}
```

### `src/components/progress/progress-summary.tsx`

```tsx
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { progressLabel } from "@/features/progress/presentation";
import { verdictLabels } from "@/features/submissions/contracts";
import type { ProgressCounts, ProgressSummary as Summary } from "@/features/progress/query";

const timeLabel = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC";
export function ProgressSummary({ summary }: { summary: Summary }) {
  const { overall } = summary;
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[["Published problems", overall.total], ["Started", overall.started], ["Attempted", overall.attempted], ["Solved", overall.solved], ["Verified on current revision", overall.verifiedCurrent], ["Review later", overall.reviewLater]].map(([label, count]) =>
        <Card key={label}><p className="text-sm text-muted">{label}</p><p className="mt-3 text-3xl font-semibold text-accent">{count}</p></Card>)}
    </div>
    <p className="text-sm leading-7 text-muted">Started includes attempted or solved problems. Attempted records a manual attempt or a reserved run/submission, including execution failures. Solved includes {overall.manualSolved} self-marked and {overall.verifiedEarlier} verified on earlier revisions. Only accepted full-suite submissions verify a solve; visible runs do not. Counts include currently published problems only.</p>
    {!overall.started && <EmptyState title="Start your practice record" description="Open a problem, mark an attempt, or run your code when execution is configured." action={<ButtonLink href="/problems">Browse problems</ButtonLink>} />}
    <Card><CardTitle>Progress by difficulty</CardTitle><CountsTable caption="Difficulty progress" rows={Object.entries(summary.difficulty).map(([label, counts]) => ({ label, counts }))} /></Card>
    <Card><CardTitle>Progress by category</CardTitle><p className="mt-3 text-sm text-muted">A problem can belong to several categories, so category totals overlap.</p>
      {summary.categories.length ? <CountsTable caption="Category progress" rows={summary.categories.map((category) => ({ label: category.name, counts: category.counts }))} /> : <p className="mt-4 text-sm text-muted">No published categories yet.</p>}
    </Card>
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <Card><CardTitle>Recent attempts</CardTitle><p className="mt-3 text-sm text-muted">Your ten latest runs and submissions. Saved source code and test payloads are not shown here.</p>
        {summary.recentAttempts.length ? <ol className="mt-5 space-y-5">{summary.recentAttempts.map((attempt, index) => <li key={index} className="border-t border-line pt-4 text-sm">
          <Link href={`/problems/${attempt.slug}`} className="font-semibold text-accent underline underline-offset-4">{attempt.title}</Link>
          <p className="mt-2">{attempt.mode === "RUN" ? "Visible run" : "Full submission"} · {attempt.status === "QUEUED" ? "Queued" : attempt.status === "RUNNING" ? "Running" : verdictLabels[attempt.status]}</p>
          <p className="mt-1 text-muted">{attempt.completedAt ? `${attempt.passedCount}/${attempt.totalCount} passed` : "No final result yet"} · Revision {attempt.problemRevision}{attempt.problemRevision !== attempt.currentRevision ? " (earlier revision)" : ""}</p>
          <time className="mt-1 block text-xs text-muted" dateTime={attempt.createdAt}>{timeLabel(attempt.createdAt)}</time>
        </li>)}</ol> : <p className="mt-5 text-sm text-muted">No runs or submissions yet. Manual progress appears alongside this list.</p>}
      </Card>
      <Card><CardTitle>Recently updated progress</CardTitle><p className="mt-3 text-sm text-muted">Latest state for ten recently changed problems; this is not a complete event history.</p>
        {summary.recentProgress.length ? <ol className="mt-5 space-y-5">{summary.recentProgress.map((item) => <li key={item.slug} className="border-t border-line pt-4 text-sm">
          <Link href={`/problems/${item.slug}`} className="font-semibold text-accent underline underline-offset-4">{item.title}</Link>
          <p className="mt-2">{progressLabel(item.progress)}{item.progress.reviewLater ? " · Review later" : ""}</p>
          <time className="mt-1 block text-xs text-muted" dateTime={item.updatedAt}>{timeLabel(item.updatedAt)}</time>
        </li>)}</ol> : <p className="mt-5 text-sm text-muted">No progress changes yet.</p>}
      </Card>
    </div>
  </div>;
}
function CountsTable({ caption, rows }: { caption: string; rows: { label: string; counts: ProgressCounts }[] }) {
  return <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm">
    <caption className="sr-only">{caption}</caption>
    <thead><tr>{["Group", "Total", "Attempted", "Solved", "Verified current"].map((label) => <th key={label} scope="col" className="whitespace-nowrap border-b border-line px-3 py-3 font-semibold">{label}</th>)}</tr></thead>
    <tbody>{rows.map(({ label, counts }) => <tr key={label}><th scope="row" className="px-3 py-3 font-medium">{label}</th>{[counts.total, counts.attempted, counts.solved, counts.verifiedCurrent].map((count, index) => <td key={index} className="px-3 py-3 text-muted">{count}</td>)}</tr>)}</tbody>
  </table></div>;
}
```

### `src/features/problems/detail-actions.ts`

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { problemChange, type ProblemActionState } from "./detail-validation";
import { writeProblemChange } from "./detail-write";

export async function updateProblem(_previous: ProblemActionState, form: FormData): Promise<ProblemActionState> {
  // Explicit fields: caller-supplied user IDs, roles and problem IDs are ignored.
  const input = problemChange.safeParse({
    slug: form.get("slug"), operation: form.get("operation"), review: form.get("review"),
    content: form.get("content"), expectedContent: form.get("expectedContent"),
  });
  if (!input.success) return { success: false, message: "Check your request. Notes must be at most 10,000 characters and contain no null characters." };
  try {
    const viewer = await getViewer();
    if (!viewer) return { success: false, message: "Sign in again before saving. Your unsaved note remains in this page." };
    const outcome = await writeProblemChange(getDatabase(), viewer.id, input.data);
    if (outcome === "not-found") return { success: false, message: "This problem is no longer available." };
    if (outcome === "conflict") return { success: false, message: "Your note changed in another tab. Copy your draft, then reload to review the saved version before trying again." };
  } catch { return { success: false, message: "Could not save your change. Please try again." }; }
  revalidatePath(`/problems/${input.data.slug}`);
  revalidatePath("/problems");
  revalidatePath("/progress");
  revalidatePath("/dashboard");
  if (input.data.operation === "save-note") return { success: true, message: input.data.content ? "Note saved." : "Note cleared.", savedContent: input.data.content };
  return { success: true, message: "Progress updated." };
}
```

### `src/features/problems/detail-query.ts`

```typescript
import "server-only";
import { progressView } from "@/features/progress/presentation";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

// An allowlist, never include:true: hidden tests and operational fields stay server-side.
const detailSelect = {
  id: true, revision: true, slug: true, title: true, difficulty: true, kind: true, pattern: true,
  statement: true, constraints: true, estimatedMinutes: true,
  categories: { select: { category: { select: { slug: true, name: true } } }, orderBy: { category: { name: "asc" } } },
  tags: { select: { tag: { select: { slug: true, name: true } } }, orderBy: { tag: { name: "asc" } } },
  examples: { select: { position: true, input: true, output: true, explanation: true }, orderBy: { position: "asc" } },
  hints: { select: { position: true, content: true }, orderBy: { position: "asc" } },
  solutions: {
    select: {
      kind: true, language: true, title: true, intuition: true, approach: true, pseudocode: true,
      code: true, timeComplexity: true, spaceComplexity: true, commonMistakes: true, interviewExplanation: true,
      steps: { select: { position: true, title: true, content: true }, orderBy: { position: "asc" } },
    },
    orderBy: [{ kind: "asc" }, { language: "asc" }],
  },
  starterCode: { select: { language: true, entryPoint: true, code: true }, orderBy: { language: "asc" } },
  related: {
    where: { related: { status: "PUBLISHED" } }, take: 6,
    select: { related: { select: { slug: true, title: true, difficulty: true } } },
    orderBy: { related: { slug: "asc" } },
  },
} satisfies Prisma.ProblemSelect;

// viewerId is supplied only by loadProblem after provider verification.
export async function queryProblem(db: PrismaClient, slug: string, viewerId: string | null) {
  return db.$transaction(async (tx) => {
    const row = await tx.problem.findFirst({ where: { slug, status: "PUBLISHED" }, select: detailSelect });
    if (!row) return null;
    const { id, revision, categories, tags, related, ...content } = row;
    const relatedProblems = related.length ? related.map((item) => item.related) : await tx.problem.findMany({
      where: { status: "PUBLISHED", slug: { not: slug }, categories: { some: { category: { slug: { in: categories.map((item) => item.category.slug) } } } } },
      select: { slug: true, title: true, difficulty: true }, orderBy: { slug: "asc" }, take: 3,
    });
    const personal = viewerId ? {
      progress: progressView(await tx.userProgress.findUnique({
        where: { userId_problemId: { userId: viewerId, problemId: id } },
        select: { status: true, reviewLater: true, selfMarked: true, verifiedRevision: true },
      }), revision),
      note: (await tx.userNote.findUnique({
        where: { userId_problemId: { userId: viewerId, problemId: id } }, select: { content: true },
      }))?.content ?? "",
    } : null;
    return {
      ...content, categories: categories.map((item) => item.category), tags: tags.map((item) => item.tag),
      related: relatedProblems, personal,
    };
  }, { isolationLevel: "RepeatableRead" });
}
export type ProblemDetail = NonNullable<Awaited<ReturnType<typeof queryProblem>>>;
```

### `src/features/problems/detail-validation.ts`

```typescript
import { z } from "zod";

export const problemSlug = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const NOTE_LIMIT = 10_000;
const noteText = z.string().max(NOTE_LIMIT).refine((text) => !text.includes("\u0000"), "Remove null characters.");
export const problemChange = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("mark-attempted"), slug: problemSlug }),
  z.object({ operation: z.literal("mark-solved"), slug: problemSlug }),
  z.object({ operation: z.literal("clear-solved"), slug: problemSlug }),
  z.object({ operation: z.literal("set-review"), slug: problemSlug, review: z.enum(["true", "false"]) }),
  z.object({ operation: z.literal("save-note"), slug: problemSlug, content: noteText, expectedContent: noteText }),
]);
export type ProblemChange = z.infer<typeof problemChange>;
export type ProblemActionState = { success?: boolean; message?: string; savedContent?: string };
```

### `src/features/problems/detail-write.ts`

```typescript
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { writeProgress } from "@/features/progress/write";
import type { ProblemChange } from "./detail-validation";

// Trusted helper: caller must validate input and verify the user before entering.
export async function writeProblemChange(db: PrismaClient, userId: string, change: ProblemChange) {
  return db.$transaction(async (tx) => {
    // Parameterized SQL. A shared row lock prevents archival during the write.
    const [problem] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM app."Problem" WHERE slug = ${change.slug} AND status = 'PUBLISHED' FOR SHARE
    `;
    if (!problem) return "not-found" as const;
    const owner = { userId, problemId: problem.id };
    if (change.operation === "save-note") {
      // Concurrent first saves are safe; the baseline check catches stale tabs.
      await tx.userNote.createMany({ data: { ...owner, content: "" }, skipDuplicates: true });
      const updated = await tx.userNote.updateMany({
        where: { ...owner, content: change.expectedContent }, data: { content: change.content },
      });
      return updated.count ? "saved" as const : "conflict" as const;
    }
    const at = new Date();
    if (change.operation === "set-review") await writeProgress(tx, userId, problem.id, { kind: "review", value: change.review === "true", at });
    else await writeProgress(tx, userId, problem.id, { kind: change.operation === "mark-attempted" ? "attempt" : change.operation === "mark-solved" ? "manual-solve" : "clear-manual", at });
    return "saved" as const;
  });
}
```

### `src/features/problems/query.ts`

```typescript
import "server-only";
import { progressView } from "@/features/progress/presentation";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { PAGE_SIZE, literalSearch, needsPersonalProgress, type LibraryFilters } from "./filters";

const publicSelect = {
  id: true, revision: true, slug: true, title: true, difficulty: true, pattern: true, estimatedMinutes: true,
  categories: {
    select: { category: { select: { slug: true, name: true } } },
    orderBy: { category: { name: "asc" } },
  },
  tags: {
    select: { tag: { select: { slug: true, name: true } } },
    orderBy: { tag: { name: "asc" } },
  },
} satisfies Prisma.ProblemSelect;

function orderBy(sort: LibraryFilters["sort"]): Prisma.ProblemOrderByWithRelationInput[] {
  switch (sort) {
    case "newest": return [{ publishedAt: { sort: "desc", nulls: "last" } }, { slug: "asc" }];
    case "difficulty": return [{ difficulty: "asc" }, { slug: "asc" }];
    case "time": return [{ estimatedMinutes: "asc" }, { slug: "asc" }];
    default: return [{ title: "asc" }, { slug: "asc" }];
  }
}

export function libraryWhere(filters: LibraryFilters, viewerId: string | null): Prisma.ProblemWhereInput {
  if (!viewerId && needsPersonalProgress(filters)) throw new Error("Verified viewer required for personal filters.");
  const and: Prisma.ProblemWhereInput[] = [];
  if (filters.q) and.push({ title: { contains: literalSearch(filters.q), mode: "insensitive" } });
  if (filters.difficulty) and.push({ difficulty: filters.difficulty });
  if (filters.category) and.push({ categories: { some: { category: { slug: filters.category } } } });
  if (filters.tag) and.push({ tags: { some: { tag: { slug: filters.tag } } } });
  if (filters.pattern) and.push({ pattern: filters.pattern });
  if (filters.maxMinutes) and.push({ estimatedMinutes: { lte: filters.maxMinutes } });
  if (viewerId) {
    if (filters.completion === "NOT_STARTED") {
      and.push({ progress: { none: { userId: viewerId, status: { in: ["ATTEMPTED", "SOLVED"] } } } });
    } else if (filters.completion !== "ALL") {
      and.push({ progress: { some: { userId: viewerId, status: filters.completion } } });
    }
    if (filters.review) and.push({ progress: { some: { userId: viewerId, reviewLater: true } } });
  }
  return { status: "PUBLISHED", AND: and };
}

// Trusted server helper. Only the load.ts boundary supplies the verified viewer ID.
// Keep count, rows, facets, and progress in one consistent database snapshot.
export async function queryLibrary(db: PrismaClient, filters: LibraryFilters, viewerId: string | null) {
  const where = libraryWhere(filters, viewerId);
  return db.$transaction(async (tx) => {
    const total = await tx.problem.count({ where });
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(filters.page, pages);
    const rows = await tx.problem.findMany({
      where, select: publicSelect, orderBy: orderBy(filters.sort),
      skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    });
    const progress = viewerId && rows.length ? await tx.userProgress.findMany({
      where: { userId: viewerId, problemId: { in: rows.map((row) => row.id) } },
      select: { problemId: true, status: true, reviewLater: true, selfMarked: true, verifiedRevision: true },
    }) : [];
    const byProblem = new Map(progress.map((entry) => [entry.problemId, entry]));
    const [categories, tags, patterns] = await Promise.all([
      tx.category.findMany({
        where: { problems: { some: { problem: { status: "PUBLISHED" } } } },
        select: { slug: true, name: true }, orderBy: { name: "asc" },
      }),
      tx.tag.findMany({
        where: { problems: { some: { problem: { status: "PUBLISHED" } } } },
        select: { slug: true, name: true }, orderBy: { name: "asc" },
      }),
      tx.problem.findMany({
        where: { status: "PUBLISHED" }, select: { pattern: true },
        distinct: ["pattern"], orderBy: { pattern: "asc" },
      }),
    ]);
    return {
      total, page, pages, pageSize: PAGE_SIZE,
      facets: { categories, tags, patterns: patterns.map((row) => row.pattern) },
      items: rows.map((row) => {
        const entry = byProblem.get(row.id);
        return {
          slug: row.slug, title: row.title, difficulty: row.difficulty,
          pattern: row.pattern, estimatedMinutes: row.estimatedMinutes,
          categories: row.categories.map((link) => link.category),
          tags: row.tags.map((link) => link.tag),
          progress: viewerId ? progressView(entry, row.revision) : null,
        };
      }),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15_000 });
}
export type LibraryResult = Awaited<ReturnType<typeof queryLibrary>>;
```

### `src/features/progress/load.ts`

```typescript
import "server-only";
import { requireViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { queryProgress } from "./query";

export async function loadProgress() {
  const viewer = await requireViewer("/progress");
  return { admin: viewer.role === "ADMIN", summary: await queryProgress(getDatabase(), viewer.id) };
}
```

### `src/features/progress/presentation.ts`

```typescript
export type ProgressView = {
  status: "NOT_STARTED" | "ATTEMPTED" | "SOLVED"; selfMarked: boolean; reviewLater: boolean;
  verification: "current" | "earlier" | null;
};
export function progressView(row: { status: ProgressView["status"]; selfMarked: boolean; reviewLater: boolean; verifiedRevision: number | null } | null | undefined, revision: number): ProgressView {
  return { status: row?.status ?? "NOT_STARTED", selfMarked: row?.selfMarked ?? false, reviewLater: row?.reviewLater ?? false,
    verification: row?.status === "SOLVED" && !row.selfMarked && row.verifiedRevision !== null ? row.verifiedRevision === revision ? "current" : "earlier" : null };
}
export function progressLabel(progress: ProgressView) {
  if (progress.status === "NOT_STARTED") return "Not started";
  if (progress.status === "ATTEMPTED") return "Attempted";
  if (progress.selfMarked) return "Solved · self-marked";
  if (progress.verification === "current") return "Solved · verified";
  if (progress.verification === "earlier") return "Solved · verified on an earlier revision";
  return "Solved · recorded";
}
```

### `src/features/progress/query.ts`

```typescript
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { progressView } from "./presentation";

const emptyCounts = () => ({ total: 0, started: 0, attempted: 0, solved: 0, manualSolved: 0, verifiedCurrent: 0, verifiedEarlier: 0, reviewLater: 0 });
export type ProgressCounts = ReturnType<typeof emptyCounts>;
// Trusted boundary supplies the verified owner. No cross-user or public caching.
export async function queryProgress(db: PrismaClient, userId: string) {
  if (!userId) throw new Error("Verified viewer required");
  return db.$transaction(async (tx) => {
    // Minimal collection projection is appropriate for the planned 1,000-problem MVP.
    // Statements, solutions, tests, notes and submission code/result never enter this DTO.
    const problems = await tx.problem.findMany({ where: { status: "PUBLISHED" }, select: {
      revision: true, difficulty: true,
      categories: { select: { category: { select: { slug: true, name: true } } } },
      progress: { where: { userId }, select: { status: true, selfMarked: true, reviewLater: true, verifiedRevision: true, attemptedAt: true } },
    } });
    const overall = emptyCounts();
    const difficulty = { EASY: emptyCounts(), MEDIUM: emptyCounts(), HARD: emptyCounts() };
    const categories = new Map<string, { slug: string; name: string; counts: ProgressCounts }>();
    for (const problem of problems) {
      const row = problem.progress[0]; const view = progressView(row, problem.revision);
      const groups = [overall, difficulty[problem.difficulty]];
      for (const { category } of problem.categories) {
        if (!categories.has(category.slug)) categories.set(category.slug, { ...category, counts: emptyCounts() });
        groups.push(categories.get(category.slug)!.counts);
      }
      for (const counts of groups) {
        counts.total++;
        if (view.status !== "NOT_STARTED") counts.started++;
        if (row?.attemptedAt) counts.attempted++;
        if (view.status === "SOLVED") counts.solved++;
        if (view.status === "SOLVED" && view.selfMarked) counts.manualSolved++;
        if (view.verification === "current") counts.verifiedCurrent++;
        if (view.verification === "earlier") counts.verifiedEarlier++;
        if (view.reviewLater) counts.reviewLater++;
      }
    }
    const recentAttempts = await tx.userSubmission.findMany({ where: { userId, problem: { status: "PUBLISHED" } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10,
      select: { mode: true, status: true, problemRevision: true, passedCount: true, totalCount: true, createdAt: true, completedAt: true,
        problem: { select: { slug: true, title: true, revision: true } } },
    });
    const recentProgress = await tx.userProgress.findMany({ where: { userId, problem: { status: "PUBLISHED" } },
      orderBy: [{ updatedAt: "desc" }, { problemId: "asc" }], take: 10,
      select: { status: true, selfMarked: true, reviewLater: true, verifiedRevision: true, updatedAt: true,
        problem: { select: { slug: true, title: true, revision: true } } },
    });
    return { overall, difficulty, categories: [...categories.values()].sort((a, b) => a.name.localeCompare(b.name)),
      recentAttempts: recentAttempts.map(({ problem, createdAt, completedAt, ...attempt }) => ({ ...attempt,
        slug: problem.slug, title: problem.title, currentRevision: problem.revision,
        createdAt: createdAt.toISOString(), completedAt: completedAt?.toISOString() ?? null })),
      recentProgress: recentProgress.map(({ problem, updatedAt, ...row }) => ({ slug: problem.slug, title: problem.title,
        progress: progressView(row, problem.revision), updatedAt: updatedAt.toISOString() })),
    };
  }, { isolationLevel: "RepeatableRead", timeout: 15_000 });
}
export type ProgressSummary = Awaited<ReturnType<typeof queryProgress>>;
```

### `src/features/progress/write.ts`

```typescript
import "server-only";
import type { Prisma } from "@/generated/prisma/client";

type ProgressEvent = { kind: "attempt" | "manual-solve" | "clear-manual"; at: Date }
  | { kind: "review"; value: boolean; at: Date }
  | { kind: "verified-solve"; revision: number; at: Date };

// Trusted transaction helper. Caller locks the problem first and verifies ownership.
// The same row lock serializes runner completion with manual solve/undo/review.
export async function writeProgress(tx: Prisma.TransactionClient, userId: string, problemId: string, event: ProgressEvent) {
  const owner = { userId, problemId };
  await tx.userProgress.createMany({ data: owner, skipDuplicates: true });
  await tx.$queryRaw`SELECT 1 FROM app."UserProgress" WHERE "userId" = ${userId}::uuid AND "problemId" = ${problemId}::uuid FOR UPDATE`;
  const row = await tx.userProgress.findUniqueOrThrow({ where: { userId_problemId: owner } });
  const data: Prisma.UserProgressUpdateManyMutationInput = {};
  if (event.kind === "attempt") {
    if (!row.attemptedAt || event.at < row.attemptedAt) data.attemptedAt = event.at;
    if (row.status === "NOT_STARTED") data.status = "ATTEMPTED";
  } else if (event.kind === "manual-solve" && row.status !== "SOLVED") {
    Object.assign(data, { status: "SOLVED", selfMarked: true, solvedAt: event.at });
  } else if (event.kind === "clear-manual" && row.status === "SOLVED" && row.selfMarked) {
    Object.assign(data, { status: row.attemptedAt ? "ATTEMPTED" : "NOT_STARTED", selfMarked: false, solvedAt: null });
  } else if (event.kind === "review" && row.reviewLater !== event.value) {
    data.reviewLater = event.value;
  } else if (event.kind === "verified-solve" && (row.verifiedRevision ?? 0) <= event.revision) {
    if (row.status !== "SOLVED") Object.assign(data, { status: "SOLVED", solvedAt: event.at });
    if (row.selfMarked) data.selfMarked = false;
    if (row.verifiedRevision !== event.revision) Object.assign(data, { verifiedRevision: event.revision, verifiedAt: event.at });
  }
  // Repeated marks/completions must not manufacture new activity timestamps.
  if (Object.keys(data).length) await tx.userProgress.updateMany({ where: owner, data });
}
```

### `src/features/submissions/actions.ts`

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { executionInput, type ExecutionState } from "./contracts";
import { getRunnerConfig } from "./config";
import { runSubmission } from "./service";

export async function executeCode(raw: unknown): Promise<ExecutionState> {
  const parsed = executionInput.safeParse(raw);
  if (!parsed.success) return { success: false, message: "Choose JavaScript and enter 1–20,000 characters of code." };
  try {
    const viewer = await getViewer();
    if (!viewer) return { success: false, message: "Sign in with a confirmed account to run or submit code." };
    const config = getRunnerConfig();
    if (!config) return { success: false, message: "Code execution is not configured yet. Your draft is unchanged." };
    const outcome = await runSubmission(getDatabase(), viewer.id, parsed.data, config);
    if (outcome.success) {
      revalidatePath(`/problems/${parsed.data.slug}`);
      revalidatePath("/problems"); revalidatePath("/progress"); revalidatePath("/dashboard");
    }
    return outcome;
  } catch {
    return { success: false, message: "Could not finish saving the execution result. Your draft is unchanged. A retry creates a new attempt." };
  }
}
```

### `src/features/submissions/contracts.ts`

```typescript
import { z } from "zod";
import { problemSlug } from "@/features/problems/detail-validation";

export const executionInput = z.object({
  slug: problemSlug,
  language: z.literal("JAVASCRIPT"),
  mode: z.enum(["RUN", "SUBMIT"]),
  code: z.string().min(1).max(20_000).refine((s) => s.trim().length > 0 && !s.includes("\0")),
}).strict();
export type ExecutionInput = z.infer<typeof executionInput>;
export type Verdict = "ACCEPTED" | "WRONG_ANSWER" | "COMPILE_ERROR" | "RUNTIME_ERROR" | "TIME_LIMIT" | "MEMORY_LIMIT" | "INTERNAL_ERROR";
export type CaseResult = {
  position: number; status: Verdict; input: unknown; expected: unknown;
  stdout: string; diagnostic: string; runtimeMs: number | null; memoryKb: number | null;
};
export type ExecutionResult = {
  id: string; problemRevision?: number; mode: "RUN" | "SUBMIT"; status: Verdict; passedCount: number; totalCount: number;
  runtimeMs: number | null; memoryKb: number | null; cases: CaseResult[];
};
export type ExecutionState = { success: false; message: string } | { success: true; result: ExecutionResult };
export const verdictLabels: Record<Verdict, string> = {
  ACCEPTED: "Passed", WRONG_ANSWER: "Wrong answer", COMPILE_ERROR: "Compilation error",
  RUNTIME_ERROR: "Runtime error", TIME_LIMIT: "Time limit exceeded", MEMORY_LIMIT: "Memory limit exceeded",
  INTERNAL_ERROR: "Execution service unavailable",
};
```

### `src/features/submissions/service.ts`

```typescript
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { RunnerConfig } from "./config";
import type { ExecutionInput, ExecutionResult, ExecutionState } from "./contracts";
import { executeJudge0 } from "./judge0";
import { reserveSubmission, finishSubmission } from "./store";

export async function runSubmission(db: PrismaClient, userId: string, input: ExecutionInput, config: RunnerConfig): Promise<ExecutionState> {
  const reservation = await reserveSubmission(db, userId, input);
  if ("error" in reservation) return { success: false, message: reservation.error! };
  let result: ExecutionResult = { id: reservation.id, problemRevision: reservation.revision, mode: input.mode, status: "INTERNAL_ERROR", passedCount: 0,
    totalCount: reservation.cases.length, runtimeMs: null, memoryKb: null, cases: [] };
  try {
    const outcomes = await executeJudge0(config, reservation.source, reservation.cases.map((t) => ({ stdin: t.stdin, expected: t.output })), reservation.limits);
    const failure = outcomes.find((o) => o.status !== "ACCEPTED");
    const times = outcomes.map((o) => o.runtimeMs); const memories = outcomes.map((o) => o.memoryKb);
    result = { ...result, status: outcomes.some((o) => o.status === "INTERNAL_ERROR") ? "INTERNAL_ERROR" : failure?.status ?? "ACCEPTED",
      passedCount: outcomes.filter((o) => o.status === "ACCEPTED").length,
      runtimeMs: times.every((n) => n !== null) ? Math.max(...times as number[]) : null,
      memoryKb: memories.every((n) => n !== null) ? Math.max(...memories as number[]) : null,
      // Never return/store hidden stdout, stderr, compile output, inputs, or expected values.
      cases: input.mode === "RUN" ? outcomes.map((outcome, index) => ({ ...outcome,
        position: reservation.cases[index].position, input: reservation.cases[index].input, expected: reservation.cases[index].output })) : [],
    };
  } catch { /* Provider/queue failure is an infrastructure verdict, never an accepted solution. */ }
  await finishSubmission(db, userId, result);
  return { success: true, result };
}
```

### `src/features/submissions/store.ts`

```typescript
import "server-only";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { ExecutionInput, ExecutionResult } from "./contracts";
import { writeProgress } from "@/features/progress/write";
import { makeProgram, makeStdin } from "./harness";

// Caller authenticates first. A short database lock shares quotas across server instances.
export async function reserveSubmission(db: PrismaClient, userId: string, input: ExecutionInput) {
  return db.$transaction(async (tx) => {
    const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP AS now FROM pg_advisory_xact_lock(728551, 8)`;
    const now = clock.now;
    await tx.userSubmission.updateMany({ where: { status: { in: ["QUEUED", "RUNNING"] }, createdAt: { lt: new Date(now.getTime() - 120_000) } },
      data: { status: "INTERNAL_ERROR", completedAt: now } });
    const active = { status: { in: ["QUEUED", "RUNNING"] as ("QUEUED" | "RUNNING")[] } };
    const minute = new Date(now.getTime() - 60_000);
    if (await tx.userSubmission.count({ where: { userId, ...active } }) ||
        await tx.userSubmission.count({ where: { userId, createdAt: { gte: minute } } }) >= 5 ||
        await tx.userSubmission.count({ where: { userId, createdAt: { gte: new Date(now.getTime() - 3600_000) } } }) >= 30 ||
        await tx.userSubmission.count({ where: active }) >= 20 ||
        await tx.userSubmission.count({ where: { createdAt: { gte: minute } } }) >= 60) {
      return { error: "The runner is busy or your execution limit was reached. Wait a minute and try again; the hourly limit is 30 requests." } as const;
    }
    // Hold a shared row lock only while snapshotting tests and recording the reservation.
    const [locked] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM app."Problem" WHERE slug = ${input.slug} AND status = 'PUBLISHED' AND kind = 'CODING' FOR SHARE`;
    if (!locked) return { error: "This problem is no longer available for execution." } as const;
    const problem = await tx.problem.findUniqueOrThrow({ where: { id: locked.id }, select: {
      id: true, revision: true, timeLimitMs: true, memoryLimitKb: true,
      starterCode: { where: { language: "JAVASCRIPT" }, select: { entryPoint: true } },
      testCases: { where: input.mode === "RUN" ? { visibility: "VISIBLE" } : {}, orderBy: { position: "asc" }, take: 11,
        select: { position: true, visibility: true, input: true, output: true } },
    } });
    if (!problem.starterCode[0] || !problem.testCases.length || problem.testCases.length > 10 ||
        (input.mode === "SUBMIT" && !problem.testCases.some((t) => t.visibility === "HIDDEN"))) {
      return { error: "This problem does not have a supported test suite yet." } as const;
    }
    const source = makeProgram(input.slug, problem.starterCode[0].entryPoint, input.code);
    const cases = problem.testCases.map((test) => ({ ...test, stdin: makeStdin(input.slug, test.input) }));
    const submission = await tx.userSubmission.create({ data: { userId, problemId: problem.id, problemRevision: problem.revision,
      language: input.language, mode: input.mode, code: input.code, status: "RUNNING", totalCount: cases.length }, select: { id: true, createdAt: true } });
    await writeProgress(tx, userId, problem.id, { kind: "attempt", at: submission.createdAt });
    return { id: submission.id, problemId: problem.id, revision: problem.revision, source, cases,
      limits: { timeMs: problem.timeLimitMs, memoryKb: problem.memoryLimitKb } } as const;
  }, { timeout: 10_000 });
}

export async function finishSubmission(db: PrismaClient, userId: string, result: ExecutionResult) {
  return db.$transaction(async (tx) => {
    const submission = await tx.userSubmission.findFirst({ where: { id: result.id, userId, status: "RUNNING" },
      select: { problemId: true, problemRevision: true, mode: true, totalCount: true, createdAt: true } });
    if (!submission || result.mode !== submission.mode || result.totalCount !== submission.totalCount) throw new Error("Submission does not match its reservation");
    const [problem] = await tx.$queryRaw<{ revision: number; status: string }[]>`SELECT revision, status FROM app."Problem" WHERE id = ${submission.problemId}::uuid FOR SHARE`;
    const completedAt = new Date();
    const saved = await tx.userSubmission.updateMany({ where: { id: result.id, userId, status: "RUNNING" }, data: {
      status: result.status, passedCount: result.passedCount, totalCount: result.totalCount,
      runtimeMs: result.runtimeMs, memoryKb: result.memoryKb, completedAt,
      result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
    } });
    if (saved.count !== 1) throw new Error("Submission is no longer writable");
    await writeProgress(tx, userId, submission.problemId, { kind: "attempt", at: submission.createdAt });
    if (submission.mode === "SUBMIT" && result.status === "ACCEPTED" && result.totalCount > 0 && result.passedCount === result.totalCount &&
        problem?.status === "PUBLISHED" && problem.revision === submission.problemRevision) {
      await writeProgress(tx, userId, submission.problemId, { kind: "verified-solve", revision: submission.problemRevision, at: completedAt });
    }
  });
}
```

### `src/proxy.ts`

```typescript
import type { NextRequest } from "next/server";
import { refreshAuth } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return refreshAuth(request);
}

export const config = {
  matcher: ["/login", "/register", "/auth/:path*", "/dashboard/:path*", "/progress/:path*", "/profile/:path*", "/admin/:path*", "/problems/:path*", "/notes/:path*", "/review/:path*", "/roadmaps/:path*", "/mock-interview/:path*", "/interview-results/:path*", "/api/:path*"],
};
```

### `tests/integration/library.test.ts`

```typescript
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { queryLibrary } from "@/features/problems/query";
import { parseLibraryFilters } from "@/features/problems/filters";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import type { ProblemSeed } from "@/lib/validators/problem";

let db: ReturnType<typeof createDatabaseClient>;
let seeds: ProblemSeed[] = [];
let ownsFixtures = false;
const users = [randomUUID(), randomUUID()];
const privateSlug = "qa-private-" + randomUUID();
const extraSlugs = ["qa-draft", "qa-archived", ...Array.from({ length: 14 }, (_, index) => "qa-page-" + String(index).padStart(2, "0"))];
const filters = parseLibraryFilters;

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use a dedicated TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Library integration tests require an empty problem collection.");
  seeds = await loadProblems();
  ownsFixtures = true;
  await seedProblems(db, seeds);
  await db.user.createMany({ data: users.map((id) => ({ id })) });
  await db.category.create({ data: { slug: privateSlug, name: privateSlug } });
  await db.tag.create({ data: { slug: privateSlug, name: privateSlug } });
  for (const status of ["DRAFT", "ARCHIVED"] as const) {
    await db.problem.create({ data: {
      slug: "qa-" + status.toLowerCase(), title: "Private unpublished sentinel", difficulty: "HARD",
      status, pattern: privateSlug, statement: "Private statement sentinel", constraints: ["Only a fixture"],
      estimatedMinutes: 1,
      categories: { create: { category: { connect: { slug: privateSlug } } } },
      tags: { create: { tag: { connect: { slug: privateSlug } } } },
    } });
  }
}, 30_000);
afterAll(async () => {
  if (db && ownsFixtures) {
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.problem.deleteMany({ where: { slug: { in: [...seeds.map((seed) => seed.slug), ...extraSlugs] } } });
    await db.category.deleteMany({ where: { slug: privateSlug } });
    await db.tag.deleteMany({ where: { slug: privateSlug } });
  }
  await db?.$disconnect();
});

describe("published library against PostgreSQL", () => {
  it("excludes draft/archive data and private-only facets from every public DTO", async () => {
    const result = await queryLibrary(db, filters({ status: "DRAFT" }), null);
    expect(result.total).toBe(5);
    expect(result.facets.categories.some((entry) => entry.slug === privateSlug)).toBe(false);
    expect(result.facets.tags.some((entry) => entry.slug === privateSlug)).toBe(false);
    expect(result.facets.patterns).not.toContain(privateSlug);
    expect(JSON.stringify(result)).not.toContain("sentinel");
    for (const item of result.items) {
      expect(Object.keys(item).sort()).toEqual(["slug", "title", "difficulty", "pattern", "estimatedMinutes", "categories", "tags", "progress"].sort());
      expect(item.progress).toBeNull();
    }
  });
  it("combines case-insensitive title, taxonomy, pattern, difficulty and time filters", async () => {
    const seed = seeds[0];
    const result = await queryLibrary(db, filters({
      q: seed.title.toUpperCase(), category: seed.categories[0], tag: seed.tags[0],
      pattern: seed.pattern, difficulty: seed.difficulty, maxMinutes: String(seed.estimatedMinutes),
    }), null);
    expect(result.items.map((item) => item.slug)).toEqual([seed.slug]);
    expect((await queryLibrary(db, filters({ q: seed.title, category: "not-a-category" }), null)).total).toBe(0);
    for (const q of ["%", "_", "\\"]) expect((await queryLibrary(db, filters({ q }), null)).total).toBe(0);
  });
  it("returns consistent ordering and keeps personal progress isolated by verified owner", async () => {
    const first = await db.problem.findUniqueOrThrow({ where: { slug: seeds[0].slug } });
    await db.userProgress.create({ data: { userId: users[0], problemId: first.id, status: "SOLVED", solvedAt: new Date(), reviewLater: true, selfMarked: true } });
    await db.userProgress.create({ data: { userId: users[1], problemId: first.id, status: "ATTEMPTED" } });
    const solved = await queryLibrary(db, filters({ completion: "SOLVED", review: "1" }), users[0]);
    expect(solved.items.map((item) => item.slug)).toEqual([first.slug]);
    expect(solved.items[0].progress).toEqual({ status: "SOLVED", reviewLater: true, selfMarked: true, verification: null });
    expect((await queryLibrary(db, filters({ completion: "SOLVED" }), users[1])).total).toBe(0);
    expect((await queryLibrary(db, filters({ review: "1" }), users[1])).total).toBe(0);
    expect((await queryLibrary(db, filters({ completion: "NOT_STARTED" }), users[1])).total).toBe(4);
    expect((await queryLibrary(db, filters({ completion: "ATTEMPTED" }), users[1])).total).toBe(1);
    await expect(queryLibrary(db, filters({ completion: "SOLVED" }), null)).rejects.toThrow("Verified viewer");
    const shortest = await queryLibrary(db, filters({ sort: "time" }), null);
    expect(shortest.items.map((item) => item.estimatedMinutes)).toEqual([...shortest.items.map((item) => item.estimatedMinutes)].sort((a, b) => a - b));
    const difficulty = await queryLibrary(db, filters({ sort: "difficulty" }), null);
    const ranks = { EASY: 0, MEDIUM: 1, HARD: 2 };
    const values = difficulty.items.map((item) => ranks[item.difficulty]);
    expect(values).toEqual([...values].sort());
  });
  it("paginates equal sort values without duplicates and clamps out-of-range pages", async () => {
    await db.problem.createMany({ data: extraSlugs.filter((slug) => slug.startsWith("qa-page-")).map((slug) => ({
      slug, title: "Pagination fixture", difficulty: "EASY" as const, status: "PUBLISHED" as const,
      pattern: "linear-scan", statement: "Only test data", constraints: ["Fixture"], estimatedMinutes: 10,
      publishedAt: new Date("2026-01-01T00:00:00Z"),
    })) });
    for (const sort of ["title", "newest", "difficulty", "time"]) {
      const first = await queryLibrary(db, filters({ q: "Pagination fixture", sort }), null);
      const last = await queryLibrary(db, filters({ q: "Pagination fixture", sort, page: "999" }), null);
      expect(first).toMatchObject({ total: 14, page: 1, pages: 2 });
      expect(first.items).toHaveLength(12);
      expect(last.page).toBe(2);
      expect(last.items).toHaveLength(2);
      expect(new Set([...first.items, ...last.items].map((item) => item.slug)).size).toBe(14);
    }
  });
});
```

### `tests/integration/progress.test.ts`

```typescript
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { writeProblemChange } from "@/features/problems/detail-write";
import { queryProblem } from "@/features/problems/detail-query";
import { queryProgress } from "@/features/progress/query";
import { reserveSubmission, finishSubmission } from "@/features/submissions/store";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import type { ExecutionResult } from "@/features/submissions/contracts";
let db: ReturnType<typeof createDatabaseClient>; let ownsFixtures = false; let slugs: string[] = []; let problemId: string;
const users = [randomUUID(), randomUUID()]; const slug = "relay-window";
const input = { slug, language: "JAVASCRIPT" as const, mode: "SUBMIT" as const, code: "SOURCE-SENTINEL" };
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use an empty disposable TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url); if (await db.problem.count()) throw new Error("Progress tests require an empty collection.");
  const seeds = await loadProblems(); slugs = seeds.map((s) => s.slug); ownsFixtures = true;
  await seedProblems(db, seeds); await db.user.createMany({ data: users.map((id) => ({ id })) });
  problemId = (await db.problem.findUniqueOrThrow({ where: { slug } })).id;
}, 30000);
beforeEach(async () => {
  await db.userSubmission.deleteMany({ where: { userId: { in: users } } });
  await db.userProgress.deleteMany({ where: { userId: { in: users } } });
  await db.userNote.deleteMany({ where: { userId: { in: users } } });
  await db.problem.update({ where: { id: problemId }, data: { revision: 1, status: "PUBLISHED" } });
});
afterAll(async () => {
  if (db && ownsFixtures) { await db.user.deleteMany({ where: { id: { in: users } } }); await db.problem.deleteMany({ where: { slug: { in: slugs } } }); }
  await db?.$disconnect();
});
const progress = () => db.userProgress.findUniqueOrThrow({ where: { userId_problemId: { userId: users[0], problemId } } });
async function reserve(mode: "RUN" | "SUBMIT" = "SUBMIT") {
  const saved = await reserveSubmission(db, users[0], { ...input, mode }); if ("error" in saved) throw new Error(saved.error); return saved;
}
function verdict(id: string, mode: "RUN" | "SUBMIT" = "SUBMIT", status: ExecutionResult["status"] = "ACCEPTED"): ExecutionResult {
  const totalCount = mode === "RUN" ? 2 : 6;
  return { id, mode, status, totalCount, passedCount: status === "ACCEPTED" ? totalCount : 0, runtimeMs: 12, memoryKb: 2000, cases: [] };
}
it("marks manual attempts once and undoes manual solves back to attempted while keeping flags", async () => {
  await writeProblemChange(db, users[0], { slug, operation: "mark-attempted" }); const first = await progress();
  await writeProblemChange(db, users[0], { slug, operation: "mark-attempted" });
  expect((await progress()).attemptedAt).toEqual(first.attemptedAt); expect((await progress()).updatedAt).toEqual(first.updatedAt);
  await writeProblemChange(db, users[0], { slug, operation: "mark-solved" });
  await writeProblemChange(db, users[0], { slug, operation: "set-review", review: "true" });
  await db.userProgress.updateMany({ where: { userId: users[0] }, data: { bookmarked: true } });
  await writeProblemChange(db, users[0], { slug, operation: "clear-solved" });
  expect(await progress()).toMatchObject({ status: "ATTEMPTED", selfMarked: false, solvedAt: null, reviewLater: true, bookmarked: true, verifiedRevision: null });
});
it("counts a reservation immediately, but visible passes and failures cannot verify a solve", async () => {
  const visible = await reserve("RUN"); expect(await progress()).toMatchObject({ status: "ATTEMPTED", attemptedAt: expect.any(Date) });
  await finishSubmission(db, users[0], verdict(visible.id, "RUN"));
  const failed = await reserve(); await finishSubmission(db, users[0], verdict(failed.id, "SUBMIT", "INTERNAL_ERROR"));
  expect(await progress()).toMatchObject({ status: "ATTEMPTED", verifiedRevision: null, solvedAt: null });
});
it("upgrades a manual solve to verified atomically, preserving dates, notes and flags", async () => {
  await writeProblemChange(db, users[0], { slug, operation: "mark-solved" }); const manual = await progress();
  await writeProblemChange(db, users[0], { slug, operation: "set-review", review: "true" });
  await writeProblemChange(db, users[0], { slug, operation: "save-note", content: "NOTE-SENTINEL", expectedContent: "" });
  await db.userProgress.updateMany({ where: { userId: users[0] }, data: { bookmarked: true } });
  const saved = await reserve(); await finishSubmission(db, users[0], verdict(saved.id));
  const verified = await progress(); expect(verified).toMatchObject({ status: "SOLVED", selfMarked: false, verifiedRevision: 1, verifiedAt: expect.any(Date), solvedAt: manual.solvedAt, reviewLater: true, bookmarked: true });
  await writeProblemChange(db, users[0], { slug, operation: "clear-solved" });
  await writeProblemChange(db, users[0], { slug, operation: "mark-solved" });
  expect((await progress()).updatedAt).toEqual(verified.updatedAt);
  expect((await queryProblem(db, slug, users[0]))?.personal).toMatchObject({ note: "NOTE-SENTINEL", progress: { verification: "current" } });
});
it("serializes a verified completion with concurrent manual undo and review writes", async () => {
  await writeProblemChange(db, users[0], { slug, operation: "mark-solved" }); const saved = await reserve();
  await Promise.all([finishSubmission(db, users[0], verdict(saved.id)), writeProblemChange(db, users[0], { slug, operation: "clear-solved" }), writeProblemChange(db, users[0], { slug, operation: "set-review", review: "true" })]);
  expect(await progress()).toMatchObject({ status: "SOLVED", selfMarked: false, verifiedRevision: 1, reviewLater: true });
});
it("rejects old-revision and archived in-flight solves while retaining their attempt results", async () => {
  const old = await reserve(); await db.problem.update({ where: { id: problemId }, data: { revision: 2 } });
  await finishSubmission(db, users[0], verdict(old.id)); expect(await progress()).toMatchObject({ status: "ATTEMPTED", verifiedRevision: null });
  const archived = await reserve(); await db.problem.update({ where: { id: problemId }, data: { status: "ARCHIVED" } });
  await finishSubmission(db, users[0], verdict(archived.id)); expect(await progress()).toMatchObject({ status: "ATTEMPTED", verifiedRevision: null });
  expect((await queryProgress(db, users[0])).recentAttempts).toEqual([]);
});
it("keeps earlier verified solves visible and can verify a new revision without erasing first solved date", async () => {
  const first = await reserve(); await finishSubmission(db, users[0], verdict(first.id)); const old = await progress();
  await db.problem.update({ where: { id: problemId }, data: { revision: 2 } });
  expect((await queryProblem(db, slug, users[0]))?.personal?.progress.verification).toBe("earlier");
  expect((await queryProgress(db, users[0])).overall).toMatchObject({ solved: 1, verifiedEarlier: 1, verifiedCurrent: 0 });
  const next = await reserve(); await finishSubmission(db, users[0], verdict(next.id));
  expect(await progress()).toMatchObject({ verifiedRevision: 2, solvedAt: old.solvedAt, attemptedAt: old.attemptedAt });
  const updated = await progress(); const repeated = await reserve(); await finishSubmission(db, users[0], verdict(repeated.id));
  expect((await progress()).verifiedAt).toEqual(updated.verifiedAt); expect((await progress()).updatedAt).toEqual(updated.updatedAt);
});
it("rejects forged completion mode/counts and rolls back invalid final writes", async () => {
  const saved = await reserve("RUN");
  await expect(finishSubmission(db, users[0], verdict(saved.id))).rejects.toThrow();
  await expect(finishSubmission(db, users[1], verdict(saved.id, "RUN"))).rejects.toThrow();
  await expect(finishSubmission(db, users[0], { ...verdict(saved.id, "RUN"), passedCount: 1 })).rejects.toThrow();
  expect(await progress()).toMatchObject({ status: "ATTEMPTED", verifiedRevision: null });
  expect(await db.userSubmission.findUnique({ where: { id: saved.id } })).toMatchObject({ status: "RUNNING", completedAt: null });
});
it("computes owner-only counts by difficulty/category without leaking code, results, notes or other users", async () => {
  const saved = await reserve(); await finishSubmission(db, users[0], verdict(saved.id));
  await writeProblemChange(db, users[0], { slug, operation: "set-review", review: "true" });
  await writeProblemChange(db, users[1], { slug: "quiet-badge", operation: "mark-solved" });
  await db.userSubmission.update({ where: { id: saved.id }, data: { result: { secret: "HIDDEN-RESULT-SENTINEL" } } });
  const summary = await queryProgress(db, users[0]);
  expect(summary.overall).toMatchObject({ total: 5, started: 1, attempted: 1, solved: 1, verifiedCurrent: 1, manualSolved: 0, reviewLater: 1 });
  expect(summary.difficulty.EASY.solved).toBe(1); expect(summary.categories.find((c) => c.slug === "arrays")?.counts.solved).toBe(1);
  expect(summary.categories.find((c) => c.slug === "sliding-window")?.counts.solved).toBe(1);
  expect(summary.recentAttempts).toHaveLength(1); expect(summary.recentProgress).toHaveLength(1);
  for (const secret of ["SOURCE-SENTINEL", "HIDDEN-RESULT-SENTINEL", users[0], users[1], '"code"', '"result"', '"userId"']) expect(JSON.stringify(summary)).not.toContain(secret);
  expect((await queryProgress(db, users[1])).overall).toMatchObject({ attempted: 0, solved: 1, manualSolved: 1, verifiedCurrent: 0 });
});
it("bounds recent attempts to ten with deterministic newest-first ordering", async () => {
  await db.userSubmission.createMany({ data: Array.from({ length: 12 }, (_, i) => ({ userId: users[0], problemId, problemRevision: 1, mode: "RUN" as const, language: "JAVASCRIPT" as const, status: "INTERNAL_ERROR" as const, code: "private", createdAt: new Date(Date.UTC(2026,0,i+1)), completedAt: new Date(Date.UTC(2026,0,i+1)) })) });
  const recent = (await queryProgress(db, users[0])).recentAttempts;
  expect(recent).toHaveLength(10); expect(recent[0].createdAt).toBe("2026-01-12T00:00:00.000Z"); expect(recent[9].createdAt).toBe("2026-01-03T00:00:00.000Z");
});
```

### `tests/integration/submissions.test.ts`

```typescript
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { reserveSubmission, finishSubmission } from "@/features/submissions/store";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import type { ExecutionResult } from "@/features/submissions/contracts";

let db: ReturnType<typeof createDatabaseClient>;
let ownsFixtures = false;
let slugs: string[] = [];
let problemId: string;
const owners = [randomUUID(), randomUUID()];
const input = { slug: "relay-window", language: "JAVASCRIPT" as const, mode: "RUN" as const, code: "function relayWindow() { return 13; }" };
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use a disposable TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Submission tests require an empty problem collection.");
  const seeds = await loadProblems(); slugs = seeds.map((seed) => seed.slug); ownsFixtures = true;
  await seedProblems(db, seeds); await db.user.createMany({ data: owners.map((id) => ({ id })) });
  problemId = (await db.problem.findUniqueOrThrow({ where: { slug: input.slug } })).id;
}, 30_000);
beforeEach(async () => {
  await db.userSubmission.deleteMany({ where: { userId: { in: owners } } });
  await db.userProgress.deleteMany({ where: { userId: { in: owners } } });
  await db.problem.update({ where: { id: problemId }, data: { status: "PUBLISHED" } });
});
afterAll(async () => {
  if (db && ownsFixtures) {
    await db.user.deleteMany({ where: { id: { in: owners } } });
    await db.problem.deleteMany({ where: { slug: { in: slugs } } });
  }
  await db?.$disconnect();
});
function result(id: string): ExecutionResult { return { id, mode: "RUN", status: "ACCEPTED", passedCount: 2, totalCount: 2, runtimeMs: 12, memoryKb: 1024, cases: [] }; }
async function reserve(owner = owners[0], mode: "RUN" | "SUBMIT" = "RUN") {
  const value = await reserveSubmission(db, owner, { ...input, mode });
  if ("error" in value) throw new Error(value.error);
  return value;
}
it("snapshots only visible cases for Run and the full suite for Submit", async () => {
  const run = await reserve(); expect(run.cases).toHaveLength(2);
  expect(run.cases.every((test) => test.visibility === "VISIBLE")).toBe(true);
  const submit = await reserve(owners[1], "SUBMIT"); expect(submit.cases).toHaveLength(6);
  expect(submit.cases.filter((test) => test.visibility === "HIDDEN")).toHaveLength(4);
  expect(JSON.parse(run.cases[0].stdin)).toEqual([[3, 1, 5, 2, 6, 1], 3]);
  const saved = await db.userSubmission.findUniqueOrThrow({ where: { id: run.id } });
  expect(saved).toMatchObject({ userId: owners[0], status: "RUNNING", code: input.code, problemRevision: run.revision, totalCount: 2 });
});
it("denies archived and absent problems without recording or executing an attempt", async () => {
  await db.problem.update({ where: { id: problemId }, data: { status: "ARCHIVED" } });
  expect(await reserveSubmission(db, owners[0], input)).toHaveProperty("error");
  expect(await reserveSubmission(db, owners[0], { ...input, slug: "not-present" })).toHaveProperty("error");
  expect(await db.userSubmission.count()).toBe(0);
});
it("allows one concurrent reservation per owner across database connections", async () => {
  const values = await Promise.all([reserveSubmission(db, owners[0], input), reserveSubmission(db, owners[0], input)]);
  expect(values.filter((v) => "error" in v)).toHaveLength(1);
  expect(await db.userSubmission.count({ where: { userId: owners[0] } })).toBe(1);
  expect(await reserveSubmission(db, owners[1], input)).not.toHaveProperty("error");
});
it("enforces persisted per-minute and per-hour quotas, including failed requests", async () => {
  for (const [count, age] of [[5, 10000], [30, 120000]]) {
    await db.userSubmission.deleteMany({ where: { userId: owners[0] } });
    await db.userSubmission.createMany({ data: Array.from({ length: count }, () => ({ userId: owners[0], problemId,
      problemRevision: 1, language: "JAVASCRIPT" as const, mode: "RUN" as const, code: "fixture", status: "INTERNAL_ERROR" as const,
      createdAt: new Date(Date.now() - age), completedAt: new Date() })) });
    expect(await reserveSubmission(db, owners[0], input)).toHaveProperty("error");
  }
});
it("recovers abandoned reservations after two minutes without fabricating success", async () => {
  const first = await reserve();
  await db.userSubmission.update({ where: { id: first.id }, data: { createdAt: new Date(Date.now() - 130000) } });
  await reserve();
  expect(await db.userSubmission.findUnique({ where: { id: first.id } })).toMatchObject({ status: "INTERNAL_ERROR", passedCount: 0, result: null, completedAt: expect.any(Date) });
});
it("persists a final verdict only for its owner and only once", async () => {
  const first = await reserve();
  await expect(finishSubmission(db, owners[1], result(first.id))).rejects.toThrow();
  await finishSubmission(db, owners[0], result(first.id));
  const saved = await db.userSubmission.findUniqueOrThrow({ where: { id: first.id } });
  expect(saved).toMatchObject({ status: "ACCEPTED", passedCount: 2, runtimeMs: 12, result: result(first.id), completedAt: expect.any(Date) });
  await expect(finishSubmission(db, owners[0], { ...result(first.id), status: "WRONG_ANSWER" })).rejects.toThrow();
  expect(await db.userProgress.findUnique({ where: { userId_problemId: { userId: owners[0], problemId } } })).toMatchObject({ status: "ATTEMPTED", verifiedRevision: null });
});

it("enforces the deployment-wide quota across different owners", async () => {
  await db.userSubmission.createMany({ data: Array.from({ length: 60 }, () => ({ userId: owners[1], problemId,
    problemRevision: 1, language: "JAVASCRIPT" as const, mode: "RUN" as const, code: "fixture", status: "INTERNAL_ERROR" as const,
    createdAt: new Date(), completedAt: new Date() })) });
  expect(await reserveSubmission(db, owners[0], input)).toHaveProperty("error");
});
```

### `tests/migration.test.ts`

```typescript
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

let db: PGlite;
const problemId = "10000000-0000-4000-8000-000000000001";
const userId = "20000000-0000-4000-8000-000000000001";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(await readFile("prisma/migrations/202609130001_foundation/migration.sql", "utf8"));
  await db.exec(await readFile("prisma/migrations/202609160001_progress_verification/migration.sql", "utf8"));
  await db.query(`INSERT INTO app."Problem" (id,slug,title,difficulty,pattern,statement,constraints,"estimatedMinutes","updatedAt") VALUES ($1,'migration-fixture','Fixture','EASY','fixed-window','Fixture',ARRAY['Fixture'],15,now())`, [problemId]);
}, 30_000);
afterAll(async () => { await db?.close(); });

describe("PostgreSQL migration invariants", () => {
  it("creates every application table with RLS enabled", async () => {
    const result = await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='app'`);
    expect(result.rows[0].count).toBe(22);
    const unprotected = await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='app' AND NOT rowsecurity`);
    expect(unprotected.rows).toEqual([]);
  });
  it("enforces slug uniqueness, check constraints, and foreign keys", async () => {
    await expect(db.query(`INSERT INTO app."Problem" (id,slug,title,difficulty,pattern,statement,constraints,"estimatedMinutes","updatedAt") VALUES (gen_random_uuid(),'migration-fixture','Duplicate','EASY','x','x',ARRAY['x'],15,now())`)).rejects.toMatchObject({ code: "23505" });
    await expect(db.query(`UPDATE app."Problem" SET "estimatedMinutes"=-1 WHERE id=$1`, [problemId])).rejects.toMatchObject({ code: "23514" });
    await expect(db.query(`INSERT INTO app."ProblemHint" (id,"problemId",position,content) VALUES (gen_random_uuid(),$1,6,'bad position')`, [problemId])).rejects.toMatchObject({ code: "23514" });
    await expect(db.query(`INSERT INTO app."ProblemHint" (id,"problemId",position,content) VALUES (gen_random_uuid(),gen_random_uuid(),1,'orphan')`)).rejects.toMatchObject({ code: "23503" });
  });
  it("requires solved timestamps and protects problems with user history", async () => {
    await db.query(`INSERT INTO app."User" (id,"updatedAt") VALUES ($1,now())`, [userId]);
    await expect(db.query(`INSERT INTO app."UserProgress" ("userId","problemId",status,"updatedAt") VALUES ($1,$2,'SOLVED',now())`, [userId, problemId])).rejects.toMatchObject({ code: "23514" });
    await db.query(`INSERT INTO app."UserProgress" ("userId","problemId",status,"solvedAt","updatedAt") VALUES ($1,$2,'SOLVED',now(),now())`, [userId, problemId]);
    await expect(db.query(`DELETE FROM app."Problem" WHERE id=$1`, [problemId])).rejects.toMatchObject({ code: "23503" });
    await db.query(`DELETE FROM app."User" WHERE id=$1`, [userId]);
    expect((await db.query(`SELECT 1 FROM app."UserProgress" WHERE "userId"=$1`, [userId])).rows).toEqual([]);
  });
  it("blocks an untrusted database role even if someone later grants table access", async () => {
    await db.query(`INSERT INTO app."TestCase" (id,"problemId",position,visibility,input,output) VALUES (gen_random_uuid(),$1,1,'HIDDEN','{}','42')`, [problemId]);
    await db.exec('CREATE ROLE algosprint_untrusted; SET ROLE algosprint_untrusted;');
    try { await expect(db.query('SELECT * FROM app."TestCase"')).rejects.toMatchObject({ code: "42501" }); }
    finally { await db.exec('RESET ROLE;'); }
    await db.exec('GRANT USAGE ON SCHEMA app TO algosprint_untrusted; GRANT SELECT ON app."TestCase" TO algosprint_untrusted; SET ROLE algosprint_untrusted;');
    try { expect((await db.query('SELECT * FROM app."TestCase"')).rows).toEqual([]); }
    finally { await db.exec('RESET ROLE;'); }
    expect((await db.query('SELECT * FROM app."TestCase"')).rows).toHaveLength(1);
  });
});
```

### `tests/problem-detail-boundary.test.ts`

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ viewer: vi.fn(), db: vi.fn(), query: vi.fn(), write: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ getViewer: mocks.viewer }));
vi.mock("@/lib/prisma", () => ({ getDatabase: mocks.db }));
vi.mock("@/features/problems/detail-query", () => ({ queryProblem: mocks.query }));
vi.mock("@/features/problems/detail-write", () => ({ writeProblemChange: mocks.write }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { loadProblem } from "@/features/problems/detail-load";
import { updateProblem } from "@/features/problems/detail-actions";

function form(values: Record<string, string | undefined> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ slug: "relay-window", operation: "mark-solved", ...values })) if (value !== undefined) data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/algosprint_test");
  mocks.viewer.mockResolvedValue({ id: "verified-user", role: "USER" });
  mocks.db.mockReturnValue("trusted-db");
  mocks.query.mockResolvedValue({ slug: "relay-window" });
  mocks.write.mockResolvedValue("saved");
});
afterEach(() => vi.unstubAllEnvs());

describe("problem page read boundary", () => {
  it("rejects malformed slugs before any identity or database calls", async () => {
    for (const slug of ["../admin", "UPPER", "x".repeat(101), "a/b", "bad--slug"]) expect((await loadProblem(slug)).kind).toBe("not-found");
    expect(mocks.viewer).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("handles missing configuration without accessing data", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect((await loadProblem("relay-window")).kind).toBe("unavailable");
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("gets identity and roles from the verified session and supports guests", async () => {
    expect(await loadProblem("relay-window")).toMatchObject({ kind: "ready", signedIn: true, admin: false });
    expect(mocks.query).toHaveBeenLastCalledWith("trusted-db", "relay-window", "verified-user");
    mocks.viewer.mockResolvedValue(null);
    expect(await loadProblem("relay-window")).toMatchObject({ kind: "ready", signedIn: false });
    expect(mocks.query).toHaveBeenLastCalledWith("trusted-db", "relay-window", null);
  });
  it("maps missing/unpublished data to not-found and fails closed on provider errors", async () => {
    mocks.query.mockResolvedValue(null);
    expect((await loadProblem("relay-window")).kind).toBe("not-found");
    mocks.query.mockClear();
    mocks.viewer.mockRejectedValue(new Error("Provider unavailable"));
    await expect(loadProblem("relay-window")).rejects.toThrow("Provider unavailable");
    expect(mocks.query).not.toHaveBeenCalled();
  });
});

describe("personal problem action boundary", () => {
  it("validates operations, values and note limits before any writes", async () => {
    for (const values of [
      { operation: "delete-problem" }, { slug: "../admin" }, { operation: "set-review", review: "yes" },
      { operation: "save-note", content: "x".repeat(10_001), expectedContent: "" },
      { operation: "save-note", content: "bad\u0000text", expectedContent: "" },
      { operation: "save-note", content: "new" },
    ]) expect((await updateProblem({}, form(values))).success).toBe(false);
    expect(mocks.viewer).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("denies anonymous or expired sessions even when IDs and roles are forged", async () => {
    mocks.viewer.mockResolvedValue(null);
    expect((await updateProblem({}, form({ userId: "another", role: "ADMIN" }))).message).toContain("Sign in again");
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("uses only the verified owner and revalidates the affected public routes after success", async () => {
    expect((await updateProblem({}, form({ userId: "another", problemId: "another", role: "ADMIN" }))).success).toBe(true);
    expect(mocks.write).toHaveBeenCalledWith("trusted-db", "verified-user", { slug: "relay-window", operation: "mark-solved" });
    expect(mocks.revalidate.mock.calls).toEqual([["/problems/relay-window"], ["/problems"], ["/progress"], ["/dashboard"]]);
  });
  it("does not falsely report or revalidate missing problems and stale saves", async () => {
    mocks.write.mockResolvedValue("not-found");
    expect((await updateProblem({}, form())).message).toContain("no longer available");
    mocks.write.mockResolvedValue("conflict");
    expect((await updateProblem({}, form({ operation: "save-note", content: "new", expectedContent: "old" }))).message).toContain("another tab");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("preserves note whitespace, supports clearing, and returns only the saved note", async () => {
    for (const content of ["  reasoning\n", "", "x".repeat(10_000)]) {
      const result = await updateProblem({}, form({ operation: "save-note", content, expectedContent: "" }));
      expect(result).toMatchObject({ success: true, savedContent: content });
      expect(Object.keys(result).sort()).toEqual(["message", "savedContent", "success"]);
    }
  });
  it("masks provider/database details and never reports a failed write as saved", async () => {
    mocks.write.mockRejectedValue(new Error("private database secret"));
    expect(await updateProblem({}, form())).toEqual({ success: false, message: "Could not save your change. Please try again." });
    mocks.viewer.mockRejectedValue(new Error("private token"));
    expect((await updateProblem({}, form())).message).not.toContain("private");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
```

### `tests/progress-load.test.ts`

```typescript
import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ viewer: vi.fn(), db: vi.fn(), query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ requireViewer: f.viewer }));
vi.mock("@/lib/prisma", () => ({ getDatabase: f.db }));
vi.mock("@/features/progress/query", () => ({ queryProgress: f.query }));
import { loadProgress } from "@/features/progress/load";
beforeEach(() => { vi.clearAllMocks(); f.viewer.mockResolvedValue({ id: "verified-owner", role: "USER" }); f.db.mockReturnValue("db"); f.query.mockResolvedValue({ overall: {} }); });
it("loads only the verified owner's progress and uses the progress return URL", async () => {
  expect(await loadProgress()).toEqual({ admin: false, summary: { overall: {} } });
  expect(f.viewer).toHaveBeenCalledWith("/progress"); expect(f.query).toHaveBeenCalledWith("db", "verified-owner");
});
it("performs no query on a guest redirect or identity-provider failure", async () => {
  f.viewer.mockRejectedValue(new Error("redirect or provider failure"));
  await expect(loadProgress()).rejects.toThrow(); expect(f.db).not.toHaveBeenCalled(); expect(f.query).not.toHaveBeenCalled();
});
```

### `tests/progress-migration.test.ts`

```typescript
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
let db: PGlite;
const user = "30000000-0000-4000-8000-000000000001";
const other = "30000000-0000-4000-8000-000000000002";
const ids = Array.from({ length: 6 }, (_, i) => `40000000-0000-4000-8000-00000000000${i}`);
beforeAll(async () => {
  db = new PGlite(); await db.exec(await readFile("prisma/migrations/202609130001_foundation/migration.sql", "utf8"));
  for (const id of [user, other]) await db.query('INSERT INTO app."User" (id,"updatedAt") VALUES ($1,now())', [id]);
  for (const [i,id] of ids.entries()) await db.query(`INSERT INTO app."Problem" (id,slug,title,difficulty,status,pattern,statement,constraints,"estimatedMinutes","publishedAt",revision,"updatedAt") VALUES ($1,$2,'Fixture','EASY',$3,'fixture','Fixture',ARRAY['Fixture'],10,now(),$4,now())`, [id, `progress-migration-${i}`, i === 3 ? "ARCHIVED" : "PUBLISHED", i === 2 ? 2 : 1]);
  for (const [owner,id] of [[user,ids[0]], [user,ids[5]], [other,ids[0]]]) await db.query(`INSERT INTO app."UserProgress" ("userId","problemId",status,"selfMarked","reviewLater",bookmarked,"solvedAt","updatedAt") VALUES ($1,$2,'SOLVED',true,true,true,'2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`, [owner,id]);
  for (let i = 0; i < 5; i++) await db.query(`INSERT INTO app."UserSubmission" (id,"userId","problemId","problemRevision",language,mode,status,code,"passedCount","totalCount","createdAt","completedAt") VALUES (gen_random_uuid(),$1,$2,1,'JAVASCRIPT',$3,$4,'private-code',$5,6,'2026-02-01T00:00:00Z','2026-02-02T00:00:00Z')`, [user,ids[i],i === 1 ? "RUN" : "SUBMIT",i === 4 ? "INTERNAL_ERROR" : "ACCEPTED",i === 4 ? 0 : 6]);
  await db.exec(await readFile("prisma/migrations/202609160001_progress_verification/migration.sql", "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });
async function row(id: string, owner = user) { return (await db.query<Record<string, unknown>>('SELECT * FROM app."UserProgress" WHERE "userId"=$1 AND "problemId"=$2', [owner,id])).rows[0]; }
it("backfills current full-suite solves and first attempt dates while preserving manual date and flags", async () => {
  expect(await row(ids[0])).toMatchObject({ status: "SOLVED", selfMarked: false, reviewLater: true, bookmarked: true, verifiedRevision: 1 });
  const saved = await row(ids[0]);
  expect(new Date(saved.solvedAt as string).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  expect(new Date(saved.attemptedAt as string).toISOString()).toBe("2026-02-01T00:00:00.000Z");
  expect(new Date(saved.verifiedAt as string).toISOString()).toBe("2026-02-02T00:00:00.000Z");
});
it("does not verify visible passes, stale revisions, archived content or infrastructure errors", async () => {
  for (const id of ids.slice(1,5)) expect(await row(id)).toMatchObject({ status: "ATTEMPTED", verifiedRevision: null, verifiedAt: null });
});
it("preserves manual-only progress and another owner's independent record", async () => {
  for (const saved of [await row(ids[5]), await row(ids[0], other)]) expect(saved).toMatchObject({ status: "SOLVED", selfMarked: true, reviewLater: true, bookmarked: true, attemptedAt: null, verifiedRevision: null });
});
it("rejects partial, nonpositive, attempted or self-marked verification at the database boundary", async () => {
  for (const assignment of ['"verifiedRevision"=0', '"verifiedAt"=NULL', '"selfMarked"=true', 'status=\'ATTEMPTED\',"solvedAt"=NULL']) {
    await expect(db.query(`UPDATE app."UserProgress" SET ${assignment} WHERE "userId"=$1 AND "problemId"=$2`, [user,ids[0]])).rejects.toMatchObject({ code: "23514" });
  }
  await expect(db.query('UPDATE app."UserProgress" SET "verifiedAt"=now() WHERE "userId"=$1 AND "problemId"=$2', [user,ids[1]])).rejects.toMatchObject({ code: "23514" });
});
```

### `tests/progress-summary.test.ts`

```typescript
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ProgressSummary } from "@/components/progress/progress-summary";
import { progressLabel, progressView } from "@/features/progress/presentation";
import type { ProgressSummary as Summary } from "@/features/progress/query";
const counts = { total: 0, started: 0, attempted: 0, solved: 0, manualSolved: 0, verifiedCurrent: 0, verifiedEarlier: 0, reviewLater: 0 };
const empty = (): Summary => ({ overall: { ...counts }, difficulty: { EASY: { ...counts }, MEDIUM: { ...counts }, HARD: { ...counts } }, categories: [], recentAttempts: [], recentProgress: [] });
it("shows a truthful empty state with accessible table headings", () => {
  const html = renderToStaticMarkup(createElement(ProgressSummary, { summary: empty() }));
  for (const text of ["Start your practice record", "No runs or submissions yet", "No progress changes yet", "No published categories yet", "Difficulty progress", 'scope="col"', 'scope="row"']) expect(html).toContain(text);
});
it("distinguishes manual, legacy and current/earlier verified solves", () => {
  const row = { status: "SOLVED" as const, selfMarked: false, reviewLater: false, verifiedRevision: 1 };
  expect(progressLabel(progressView(row, 1))).toBe("Solved · verified");
  expect(progressLabel(progressView(row, 2))).toContain("earlier revision");
  expect(progressLabel(progressView({ ...row, verifiedRevision: null }, 1))).toBe("Solved · recorded");
  expect(progressLabel(progressView({ ...row, selfMarked: true, verifiedRevision: null }, 1))).toBe("Solved · self-marked");
  expect(progressLabel(progressView(null, 1))).toBe("Not started");
});
it("escapes titles and labels pending/old-revision attempts without inventing final counts", () => {
  const summary = empty();
  summary.recentAttempts = [{ mode: "RUN", status: "RUNNING", problemRevision: 1, currentRevision: 2, passedCount: 0, totalCount: 2, createdAt: "2026-01-01T00:00:00.000Z", completedAt: null, slug: "relay-window", title: "<script>private()</script>" }];
  const html = renderToStaticMarkup(createElement(ProgressSummary, { summary }));
  expect(html).toContain("Visible run"); expect(html).toContain("Running"); expect(html).toContain("No final result yet");
  expect(html).toContain("earlier revision"); expect(html).toContain("UTC");
  expect(html).not.toContain("<script>"); expect(html).not.toContain("0/2 passed");
});
```

### `tests/runner-actions.test.ts`

```typescript
import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ viewer: vi.fn(), db: vi.fn(), config: vi.fn(), run: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ getViewer: f.viewer }));
vi.mock("@/lib/prisma", () => ({ getDatabase: f.db }));
vi.mock("@/features/submissions/config", () => ({ getRunnerConfig: f.config }));
vi.mock("@/features/submissions/service", () => ({ runSubmission: f.run }));
import { executeCode } from "@/features/submissions/actions";
const input = { slug: "relay-window", language: "JAVASCRIPT", mode: "RUN", code: "function relayWindow() { return 13; }" };
beforeEach(() => { vi.clearAllMocks(); f.viewer.mockResolvedValue({ id: "verified-owner" }); f.db.mockReturnValue("db"); f.config.mockReturnValue("server-config"); f.run.mockResolvedValue({ success: true, result: { id: "saved" } }); });
it("rejects tampered fields, unsupported languages, invalid modes and oversized code", async () => {
  for (const change of [{ userId: "forged" }, { role: "ADMIN" }, { tests: [] }, { url: "https://evil.example" }, { language: "PYTHON" }, { mode: "ACCEPTED" }, { code: " " }, { code: "x".repeat(20001) }, { slug: "../admin" }])
    expect((await executeCode({ ...input, ...change })).success).toBe(false);
  expect(f.viewer).not.toHaveBeenCalled(); expect(f.run).not.toHaveBeenCalled();
});
it("authenticates every request and fails closed when disabled or identity verification fails", async () => {
  f.viewer.mockResolvedValue(null); expect(await executeCode(input)).toMatchObject({ success: false, message: expect.stringContaining("Sign in") });
  f.viewer.mockResolvedValue({ id: "verified-owner" }); f.config.mockReturnValue(null); expect(await executeCode(input)).toMatchObject({ success: false, message: expect.stringContaining("not configured") });
  f.viewer.mockRejectedValue(new Error("private token")); expect(JSON.stringify(await executeCode(input))).not.toContain("private token");
  expect(f.run).not.toHaveBeenCalled();
});
it("uses the verified owner and never reports a failed save as successful", async () => {
  expect((await executeCode(input)).success).toBe(true);
  expect(f.run).toHaveBeenCalledWith("db", "verified-owner", input, "server-config");
  expect(f.revalidate.mock.calls).toEqual([["/problems/relay-window"], ["/problems"], ["/progress"], ["/dashboard"]]);
  f.run.mockRejectedValue(new Error("database password")); expect(await executeCode(input)).toMatchObject({ success: false });
  expect(JSON.stringify(await executeCode(input))).not.toContain("password");
});
```

## 🟨 Automated verification

```bash
npm run db:validate
npm run seed:validate
npm test
npm run lint
npm run typecheck
npm run build
npm run test:smoke
```

Unit/component tests exercise the authenticated loading boundary, provenance labels, truthful empty/pending displays, escaped titles and immediate runner pending state. Embedded PostgreSQL migration tests exercise the Phase 8 backfill, preservation of owner/flags/dates, excluded visible/stale/archived/failing attempts, and invalid provenance constraints.

Real PostgreSQL integration uses an empty disposable database whose name ends in `_test`. Set TEST_DATABASE_URL and migrate that same database; ensure DATABASE_URL and any DIRECT_URL point to it during the migration step. Then run:

```bash
npm run db:deploy
npm run test:integration
```

The GitHub CI workflow supplies PostgreSQL 17 and runs integration tests before the final seed. Integration exercises simultaneous manual undo/review and runner completion, ownership, atomic failure rollback, revision/archive races, repeated marks, earliest dates, category/difficulty counts, source/result redaction and the ten-row activity limit. The production HTTP smoke checks reject forged guest requests to `/progress`; the seeded library smoke checks public content and hidden-payload boundaries.

Read the handoff and PR #10 for the actual final head, test totals and CI evidence. These automated checks do not prove a configured live Supabase/Judge0 workflow or real-browser styling/Monaco worker behavior.

## 🟥 Manual verification with development accounts

1. Open `/progress` while signed out. Confirm redirect to sign in, then return to `/progress` after a confirmed account signs in. Repeat with expired credentials.
2. As account A, mark Relay Window attempted twice. The count should increase once. Mark solved, set review, then undo the manual solve: it should return to Attempted and retain review. Repeat an identical mark; it should not create new recent-progress activity.
3. As account B, confirm A's counts, attempts and private notes are absent. A's profile ID in a URL/query string must not change B's view.
4. If the separately configured development runner has passed Phase 8 live checks, run a correct visible solution: it records an attempt, not verified success. Submit the correct full solution: the detail/library label and current verified count should update after the result saves.
5. Verify a manual solve through the runner. Confirm the original solvedAt remains and verifiedAt is separate. Later incorrect runs must not erase that solve or its review/bookmark flags.
6. In a disposable database fixture, advance the problem revision. The earlier verified label must appear and the current verified count must drop, while solved history remains. Re-submitting successfully should verify the new revision. Future admin edits must advance revisions for substantive changes.
7. Start a request and edit the draft. The old result must remain labeled as an earlier draft. The Run/Submit buttons disable immediately and become available again after completion/failure.
8. Compare overall and per-difficulty totals. Expect overlapping category totals. Confirm timestamps say UTC, lists show at most ten entries and pending attempts do not show fabricated final counts.
9. Check keyboard navigation, table headings, horizontal scrolling at narrow widths, 200% zoom and screen-reader announcements. Complete the existing real Monaco/worker checks separately.

## 🟨 Common mistakes

- Updating progress after the submission transaction commits: failures could leave the verdict and progress inconsistent.
- Letting browser input mark a solve verified: only trusted completion/migration logic may set provenance.
- Using an accepted visible run to verify a solve: it did not test hidden cases.
- Forgetting revision checks: a solution for an older problem version is not evidence for new content.
- Replacing an entire progress record: that can erase review/bookmark flags, manual dates and other independent state.
- Rewriting timestamps on every retry: repeated marks should not appear as fresh activity.
- Returning raw submission records: code, stored result JSON and hidden payloads do not belong in the summary DTO.
- Treating category totals as disjoint or Attempted/Solved as mutually exclusive.
- Treating recently updated progress as a full activity audit log.
- Running the new app before its migration or changing the checksum of an already applied migration in an existing database.

## 🟪 Next phase

Pause at this completed checkpoint before Phase 10. Dashboard work can reuse the existing owner-scoped progress/query semantics, then add charts, weak topics, recommendations and a precisely defined streak policy. Preserve manual/current/earlier verified distinctions, authentication and result redaction. Do not infer a verified solve from browser-supplied state.

Later scaling can move collection aggregation into SQL, add pagination to private history, and introduce an explicit activity-event model if a complete audit history is needed. Those changes should preserve existing dates and independently stored flags.

## 🟦 Undoing any progress mark (September 24 follow-up)

After testing live, the user asked to be able to undo a verified solve and an attempt, not only a manual solve. Every state now has an undo on the problem page, and each undo names the state it clears:

| Current state | Buttons | Operation | Result |
| --- | --- | --- | --- |
| Not started | Mark attempted · Mark solved | `mark-attempted` / `mark-solved` | Unchanged |
| Attempted | **Undo attempted** · Mark solved | `clear-attempted` | Not started; `attemptedAt` cleared |
| Solved · self-marked | Mark attempted (disabled) · Undo manual solve | `clear-solved` | Unchanged: attempted if a prior attempt exists, else not started |
| Solved · verified (or recorded) | Mark attempted (disabled) · **Undo verified solve** / **Undo solve** | `clear-verified` | Attempted if a prior attempt exists, else not started; `solvedAt`, `verifiedRevision` and `verifiedAt` cleared |

Undo operations are explicit rather than a single "clear whatever is there" command, so a stale form cannot remove more than the learner saw: `clear-solved` still ignores a verified solve that landed concurrently, `clear-verified` ignores a manual solve, and `clear-attempted` does nothing while the problem is solved. Repeated undos write nothing. Bookmarks, review flags and notes are preserved. Submission history (`UserSubmission`) is never deleted, so recent attempts still list earlier runs, and passing the full suite again records a new verified solve. Undoing an attempt does not stop the next Run or Submit from marking the problem attempted again. No migration was needed: the existing `Progress_verification_check` and `Progress_solved_check` constraints already allow these states.

Tests: two integration tests in `tests/integration/progress.test.ts` (verified undo then attempt undo with history, flags and note kept, followed by re-verification; manual solves unaffected by `clear-verified` and repeated undos idempotent) and `tests/progress-controls.test.ts` for the button labels and operations in each state.
