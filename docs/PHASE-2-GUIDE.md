# Phase 2 — Database and original seed content

This is the Phase 2 checkpoint guide. Its source appendix records this milestone; the repository files are authoritative after later phases change them. The lockfile is supplied directly in the repository because it is generated dependency metadata.

## 🟦 What we are building

We now have 22 PostgreSQL models covering profiles, problems, examples, hints, solutions and ordered steps, starter code, tests, taxonomy joins, related problems, progress, submissions, notes, roadmaps, and mock interviews. Prisma generates typed queries from `schema.prisma`; migrations create the real database structure. Zod checks imported JSON before it reaches those queries.

The five original problems are Relay Window (fixed windows), Quiet Badge (frequency counting), Parcel Checkpoints (prefix sums), Dock Threshold (binary search), and Lantern Steps (dynamic programming). Each has two examples, five ordered hints, two complete solution explanations, JavaScript starter code, and six tests: two visible and four hidden. This is 25 hints, 10 solutions, and 30 tests in total.

## 🟨 Why this architecture

Supabase will own authentication and passwords. The application profile uses the verified Supabase UUID without storing a password or trusting a user-supplied role. There is intentionally no dependency on the provider's internal `auth` schema, so the application migration also works on ordinary PostgreSQL.

All tables live in the `app` schema. The migration enables row-level security and revokes browser-role access. The application uses a trusted server database connection; that role owns the tables and can bypass RLS. **Server authorization is still required.** In Phase 3 we will derive the user ID from Supabase, then apply ownership conditions to every personal query. This private-schema design is an application choice informed by [Supabase's Prisma integration guide](https://supabase.com/docs/guides/database/prisma).

Separate tables keep ordered hints, multilingual solutions, taxonomy, and personal activity independently queryable. Unique slugs provide stable URLs. Unique join keys stop duplicate associations. Indexes cover published status combined with difficulty, pattern, and time; taxonomy joins have reverse indexes. Search tuning can follow measured workloads.

Bookmarks and review flags are independent of completion status. A solved status requires `solvedAt`; an accepted submission requires all tests to pass and a completion timestamp. A problem with user history cannot be deleted casually: its content relations cascade, but historical references restrict deletion. Archive it instead. Deleting a user removes that user's owned records.

## 🟩 Setup and commands

Use Node.js 24. Install dependencies with `npm ci`. Generated Prisma code is ignored by Git and recreated by `db:generate` and the predev/prebuild/pretypecheck hooks.

Copy `.env.example` to `.env.local` only if you have not already configured that file. Add a PostgreSQL URL to `DATABASE_URL`. For Supabase, use **Connect** to choose a connection compatible with your network. Use the direct or session connection for migration and seeding via `DIRECT_URL` when your runtime uses a different pooler. Percent-encode special characters in the password; keep TLS certificate verification enabled. Do not share these URLs in screenshots, commits, or chat.

The migration must run as a trusted role that can create and own the `app` schema. Use a development database first. Keep `app` outside Supabase's exposed Data API schemas. You do not need a service-role API key for Prisma.

```bash
npm ci
npm run db:generate
npm run db:validate
npm run db:deploy
npm run seed:validate
npm run db:seed
npm run db:seed
```

The first seed should report `{ created: 5, skipped: 0 }`; the second should report `{ created: 0, skipped: 5 }`. The content and IDs stay stable. `db:deploy` applies existing migrations without creating a shadow database. For a future schema edit, use `npm run db:migrate -- --name descriptive_change` on a development database. If the database role cannot create databases, configure `SHADOW_DATABASE_URL` pointing to a separate disposable shadow database. Never point the shadow URL at the main database.

`npm run db:studio` opens a local data browser. `npm run db:local` optionally starts Prisma's local development database on a normal developer machine; copy its ordinary PostgreSQL URL into your environment. This optional server command is not needed in CI and may be unavailable in restricted environments.

## 🟨 How seeding works internally

1. The loader reads sorted JSON files from `src/data/seeds/problems`, with limits of 1,000 files and 1 MiB per file. It ignores symbolic links.
2. The strict Zod contract checks known categories/tags/styles, unique slugs, valid fields, ordered positions, starter languages, solution requirements, and both visible and hidden cases.
3. Trusted, allowlisted reference functions parse each problem's inputs and verify every expected output. Unknown problem families must acquire a reviewed validator before import. The importer never evaluates JavaScript stored in JSON.
4. A canonical SHA-256 content hash detects existing content. An identical record is skipped. A changed existing slug aborts before writes in the initial validation pass. Administrative updates will need an explicit revision-aware workflow later.
5. Taxonomy is upserted without overwriting names. Complete problems and their dependent content are inserted in transactions of up to 20 problems. Related-problem links are connected after all problems exist.
6. A failed later batch can leave earlier committed batches. Rerunning safely skips them and repairs missing links. The whole directory is validated up front; the entire 1,000-problem library is not one long transaction.

Add future JSON files under topic folders, then run `seed:validate` before any database write. Do not invent tests whose outputs have never been independently checked. Growth to 1,000 problems also needs editorial review, duplicate concept detection, and broader language runners; this phase supplies the import structure.

## 🟩 Tests and expected results

```bash
npm run seed:validate
npm test
npm run lint
npm run typecheck
npm run build
```

The 17 local tests cover import errors, syntax parsing without execution of stored code, canonical hashes, exhaustive bounded comparisons between optimized and brute-force algorithms, migration constraints, foreign keys, deletion rules, and denial of hidden-test access to an untrusted database role. Migration tests use [PGlite](https://pglite.dev/docs/) in process, with no socket or external credentials.

Prisma itself also needs an integration test against a disposable PostgreSQL server. Set `DATABASE_URL` and `TEST_DATABASE_URL` to the same empty database with a name ending in `_test`; unset `DIRECT_URL` or set it to that same database. Then:

```bash
npm run db:deploy
npm run test:integration
```

The integration suite tests nested writes, rerun stability, preservation of user bookmarks, conflict handling, and full-batch validation. It refuses a database with existing problems and only cleans up its own fixture IDs/slugs. GitHub Actions provides PostgreSQL 17 for this suite, installs from the lockfile, and also runs validation, lint, types, and the production build. CI has read-only repository permissions and uses ephemeral test credentials. It never deploys or contacts a production database.

The implementation passed [GitHub CI on PostgreSQL 17](https://github.com/zihadpcode/AlgoSprint/actions/runs/34775388055), including the four real Prisma seed lifecycle tests, lint, types, and the production build. That run verifies implementation commit `d0319c5d4108c60c7f323e6ac362954619e9451b`. This workspace has no Supabase project credentials; run the migration against your configured development Supabase project before using database-backed pages. See the session handoff for the current pause status.

## 🟥 Common mistakes

- Putting a PostgreSQL password behind `NEXT_PUBLIC_`, committing `.env.local`, or disabling TLS checks to hide connection errors.
- Importing the database client, seed JSON, hidden tests, or full problem objects into a Client Component. Public pages must select only public fields.
- Assuming RLS protects queries issued by the table owner. Server ownership checks are mandatory.
- Running `migrate reset` or integration cleanup on a valuable database. Use dedicated development/test databases.
- Editing an already-applied migration. Add a new migration instead.
- Changing JSON and expecting seeding to overwrite the database. Conflicts are intentional; preserve historical submissions with content revisions.
- Running `eval`, `new Function`, or submitted code in the application process. The trusted reference algorithms are authored source functions, not an execution service.
- Installing an unpinned newer Prisma CLI that disagrees with the generated client. Use the repository's npm commands.

## 🟪 Next phase

Phase 3 adds email/password registration and login, verified sessions, automatic profiles, protected routes, and server-side admin checks. GitHub OAuth can follow later. The existing schema leaves room for progress, notes, roadmaps, editor submissions, and interviews without prematurely exposing unfinished features.

## 🟩 Complete Phase 2 source

The files below connect the schema, migration, validators, original content, importer, tests, and CI. `package-lock.json` is checked into the repository. The Phase 1 UI remains documented in its own guide.

### `package.json`

```json
{
  "name": "algosprint",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --max-warnings=0",
    "typecheck": "next typegen && tsc --noEmit",
    "db:generate": "prisma generate",
    "db:validate": "prisma validate",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio",
    "db:local": "prisma dev --name algosprint",
    "seed:validate": "node --import tsx scripts/validate-seeds.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "prebuild": "prisma generate",
    "pretypecheck": "prisma generate",
    "predev": "prisma generate",
    "test:integration": "vitest run --config vitest.integration.config.mts"
  },
  "engines": {
    "node": ">=24 <25"
  },
  "dependencies": {
    "@next/env": "16.3.5",
    "@prisma/adapter-pg": "7.10.0",
    "@prisma/client": "7.10.0",
    "clsx": "2.1.1",
    "lucide-react": "1.45.0",
    "next": "16.3.5",
    "pg": "8.23.0",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "server-only": "0.0.1",
    "tailwind-merge": "3.6.0",
    "zod": "4.6.4"
  },
  "devDependencies": {
    "@electric-sql/pglite": "0.4.3",
    "@tailwindcss/postcss": "^4",
    "@types/node": "24.13.4",
    "@types/pg": "8.23.1",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.5",
    "prisma": "7.10.0",
    "tailwindcss": "^4",
    "tsx": "4.23.13",
    "typescript": "^5",
    "vitest": "5.0.0"
  }
}
```

### `.env.example`

```text
# Copy this file to .env.local without overwriting existing configuration.
# The landing page, build, and unit tests work without credentials.

# Phase 2: server-only PostgreSQL connection, including its password.
# DATABASE_URL=
# DIRECT_URL=
# DATABASE_URL is used by the server. DIRECT_URL, if set, is used by migrations
# and seeding. Copy the appropriate PostgreSQL URL from Supabase Connect.
# Keep TLS verification enabled; URL-encode special characters in passwords.
# Optional separate shadow database, only for creating new dev migrations:
# SHADOW_DATABASE_URL=
# Dedicated disposable database for integration tests (name must end in _test):
# TEST_DATABASE_URL=

# Phase 3: browser-safe Supabase project URL and publishable key.
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Phase 8: server-only runner credentials, if we choose Judge0.
# JUDGE0_API_URL=
# JUDGE0_API_KEY=

# Do not add a Supabase service-role key unless a specific server task needs it.
# Never put database passwords or private API keys behind NEXT_PUBLIC_.
```

### `.gitignore`

```text
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# env files (can opt-in for committing if needed)
.env*
!.env.example

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

# Generated database client
/src/generated/
/prisma/.cache/
```

### `eslint.config.mjs`

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
]);

export default eslintConfig;
```

### `prisma.config.ts`

```ts
import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

// Prisma CLI runs outside Next.js; explicitly load the same root .env.local.
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "node --import tsx prisma/seed.ts" },
  // An absent URL is valid for generation/build. Database commands require it.
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
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

### `prisma/migrations/migration_lock.toml`

```toml
provider = "postgresql"
```

### `prisma/migrations/202609130001_foundation/migration.sql`

```sql
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
```

### `src/lib/db/client.ts`

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Shared by trusted server code and CLI scripts. Never import into client UI.
export function createDatabaseClient(connectionString: string) {
  const url = new URL(connectionString);
  if (!["postgresql:", "postgres:"].includes(url.protocol)) {
    throw new Error("Use a PostgreSQL connection URL for the pg adapter.");
  }
  const adapter = new PrismaPg({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 1_000,
  }, { schema: "app" });
  return new PrismaClient({ adapter });
}
```

### `src/lib/prisma.ts`

```ts
import "server-only";
import { createDatabaseClient } from "@/lib/db/client";

const globalForPrisma = globalThis as unknown as {
  algosprintPrisma?: ReturnType<typeof createDatabaseClient>;
};

// Lazy construction keeps the landing page and build usable without secrets.
export function getDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Configure .env.local before using database features.");
  }
  globalForPrisma.algosprintPrisma ??= createDatabaseClient(process.env.DATABASE_URL);
  return globalForPrisma.algosprintPrisma;
}
```

### `src/data/seeds/taxonomy.ts`

```ts
// Stable slugs are shared by validation, imports, and the future filter UI.
export const CATEGORIES = [
  ["arrays", "Arrays"], ["strings", "Strings"], ["hash-maps", "Hash Maps"],
  ["two-pointers", "Two Pointers"], ["sliding-window", "Sliding Window"],
  ["stack", "Stack"], ["queue", "Queue"], ["linked-list", "Linked List"],
  ["trees", "Trees"], ["binary-search-trees", "Binary Search Trees"],
  ["heaps", "Heaps / Priority Queues"], ["graphs", "Graphs"],
  ["bfs", "BFS"], ["dfs", "DFS"], ["backtracking", "Backtracking"],
  ["dynamic-programming", "Dynamic Programming"], ["greedy", "Greedy Algorithms"],
  ["binary-search", "Binary Search"], ["intervals", "Intervals"],
  ["sorting", "Sorting"], ["recursion", "Recursion"], ["bit-manipulation", "Bit Manipulation"],
  ["math", "Math"], ["tries", "Tries"], ["union-find", "Union Find"],
  ["topological-sort", "Topological Sort"], ["design", "Design Problems"],
  ["system-design", "System Design Basics"], ["sql", "SQL Problems"],
  ["object-oriented", "Object-Oriented Programming Interview Problems"],
] as const;

export const TAGS = [
  ["prefix-sum", "Prefix Sum"], ["frequency-count", "Frequency Count"],
  ["fixed-window", "Fixed Window"], ["monotone-search", "Monotone Search"],
  ["state-transition", "State Transition"], ["linear-scan", "Linear Scan"],
] as const;

export const INTERVIEW_STYLES = [["general-software", "General Software Interview"]] as const;
export const PATTERNS = ["prefix-sum", "frequency-count", "fixed-window", "lower-bound", "one-dimensional-dp"] as const;
```

### `src/lib/validators/problem.ts`

```ts
import { z } from "zod";
import { CATEGORIES, TAGS, INTERVIEW_STYLES, PATTERNS } from "@/data/seeds/taxonomy";

const text = z.string().trim().min(1).max(30_000);
const slug = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const language = z.enum(["JAVASCRIPT", "TYPESCRIPT", "PYTHON", "JAVA", "CPP", "SQL"]);
const ordered = z.int().positive();
const uniqueList = (values: readonly (readonly [string, string])[]) =>
  z.array(slug.refine((value) => values.some(([key]) => key === value), "Unknown taxonomy slug"))
    .min(1).max(20).refine((items) => new Set(items).size === items.length, "Duplicate taxonomy slug");

export const problemSchema = z.strictObject({
  schemaVersion: z.literal(1),
  slug,
  title: z.string().trim().min(3).max(160),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  kind: z.literal("CODING"),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  pattern: z.enum(PATTERNS),
  statement: text,
  constraints: z.array(text).min(1).max(20),
  estimatedMinutes: z.int().min(1).max(240),
  timeLimitMs: z.int().min(100).max(30_000),
  memoryLimitKb: z.int().min(1024).max(1_048_576),
  categories: uniqueList(CATEGORIES),
  tags: uniqueList(TAGS),
  interviewStyles: uniqueList(INTERVIEW_STYLES),
  relatedSlugs: z.array(slug).max(20),
  examples: z.array(z.strictObject({ position: ordered, input: z.json(), output: z.json(), explanation: text })).min(2).max(20),
  hints: z.array(z.strictObject({ position: z.int().min(1).max(5), content: text })).length(5),
  starterCode: z.array(z.strictObject({ language, entryPoint: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), code: text })).min(1).max(6),
  testCases: z.array(z.strictObject({
    position: ordered, visibility: z.enum(["VISIBLE", "HIDDEN"]), input: z.json(), output: z.json(), explanation: text,
  })).min(4).max(200),
  solutions: z.array(z.strictObject({
    kind: z.enum(["BRUTE_FORCE", "BETTER", "OPTIMAL", "ALTERNATIVE"]), language,
    title: z.string().min(1).max(160), intuition: text, approach: text,
    pseudocode: text, code: text, timeComplexity: z.string().min(1).max(200), spaceComplexity: z.string().min(1).max(200),
    commonMistakes: z.array(text).min(1), interviewExplanation: text,
    steps: z.array(z.strictObject({ position: ordered, title: z.string().min(1).max(160), content: text })).min(2),
  })).min(2).max(12),
}).superRefine((p, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  for (const key of ["examples", "hints", "testCases"] as const) {
    const orderedPositions = p[key].map((item) => item.position).sort((a, b) => a - b);
    if (orderedPositions.some((position, i) => position !== i + 1)) issue([key], "Positions must be unique and consecutive from 1");
  }
  if (new Set(p.starterCode.map((s) => s.language)).size !== p.starterCode.length) issue(["starterCode"], "Duplicate language");
  if (new Set(p.solutions.map((s) => `${s.kind}:${s.language}`)).size !== p.solutions.length) issue(["solutions"], "Duplicate solution kind/language");
  for (const visibility of ["VISIBLE", "HIDDEN"] as const) {
    if (!p.testCases.some((t) => t.visibility === visibility)) issue(["testCases"], `At least one ${visibility} test is required`);
  }
  for (const kind of ["BRUTE_FORCE", "OPTIMAL"] as const) {
    if (!p.solutions.some((s) => s.kind === kind)) issue(["solutions"], `${kind} solution required`);
  }
  p.solutions.forEach((solution, i) => {
    const positions = solution.steps.map((s) => s.position).sort((a, b) => a - b);
    if (positions.some((position, index) => position !== index + 1)) issue(["solutions", i, "steps"], "Positions must be consecutive from 1");
    if (!p.starterCode.some((s) => s.language === solution.language)) issue(["solutions", i, "language"], "Solution language needs starter code");
  });
  if (new Set(p.relatedSlugs).size !== p.relatedSlugs.length || p.relatedSlugs.includes(p.slug)) issue(["relatedSlugs"], "Related problems must be unique and cannot reference self");
});

export const problemBatchSchema = z.array(problemSchema).min(1).max(1000).superRefine((problems, ctx) => {
  const seen = new Set<string>();
  for (const [index, problem] of problems.entries()) {
    if (seen.has(problem.slug)) ctx.addIssue({ code: "custom", path: [index, "slug"], message: "Duplicate problem slug" });
    seen.add(problem.slug);
  }
});

export type ProblemSeed = z.infer<typeof problemSchema>;
```

### `scripts/lib/reference-problems.ts`

```ts
import { z } from "zod";
import type { ProblemSeed } from "../../src/lib/validators/problem";

const ints = z.array(z.int().min(-1_000_000).max(1_000_000)).max(100_000);
const relayInput = z.strictObject({ loads: ints.min(1), width: z.int().positive() })
  .refine((i) => i.width <= i.loads.length, "Window must fit the input");
const badgeInput = z.strictObject({ badges: z.string().max(100_000).regex(/^[a-z]*$/) });
const parcelInput = z.strictObject({ parcels: ints, ranges: z.array(z.tuple([z.int().nonnegative(), z.int().nonnegative()])).max(100_000) })
  .refine((i) => i.ranges.every(([a, b]) => a <= b && b <= i.parcels.length), "Invalid half-open range");
const dockInput = z.strictObject({ capacities: ints, load: z.int().min(-1_000_000).max(1_000_000) })
  .refine((i) => i.capacities.every((n, k) => k === 0 || n >= i.capacities[k - 1]), "Capacities must be sorted");
const lanternInput = z.strictObject({ costs: z.array(z.int().min(0).max(1000)).min(2).max(100_000) });

export function relayWindow(loads: number[], width: number) {
  let total = 0;
  for (let i = 0; i < width; i++) total += loads[i];
  let best = total;
  for (let i = width; i < loads.length; i++) {
    total += loads[i] - loads[i - width];
    best = Math.max(best, total);
  }
  return best;
}

export function relayWindowBrute(loads: number[], width: number) {
  let best = -Infinity;
  for (let start = 0; start + width <= loads.length; start++) {
    let total = 0;
    for (let i = start; i < start + width; i++) total += loads[i];
    best = Math.max(best, total);
  }
  return best;
}

export function quietBadge(badges: string) {
  const counts = new Map<string, number>();
  for (const badge of badges) counts.set(badge, (counts.get(badge) ?? 0) + 1);
  for (let i = 0; i < badges.length; i++) if (counts.get(badges[i]) === 1) return i;
  return -1;
}

export function quietBadgeBrute(badges: string) {
  for (let i = 0; i < badges.length; i++) {
    let count = 0;
    for (const badge of badges) if (badge === badges[i]) count++;
    if (count === 1) return i;
  }
  return -1;
}

export function parcelCheckpoints(parcels: number[], ranges: [number, number][]) {
  const prefix = [0];
  for (const count of parcels) prefix.push(prefix[prefix.length - 1] + count);
  return ranges.map(([start, end]) => prefix[end] - prefix[start]);
}

export function parcelCheckpointsBrute(parcels: number[], ranges: [number, number][]) {
  return ranges.map(([start, end]) => {
    let sum = 0;
    for (let i = start; i < end; i++) sum += parcels[i];
    return sum;
  });
}

export function dockThreshold(capacities: number[], load: number) {
  let left = 0;
  let right = capacities.length;
  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (capacities[mid] >= load) right = mid;
    else left = mid + 1;
  }
  return left === capacities.length ? -1 : left;
}

export function dockThresholdBrute(capacities: number[], load: number) {
  for (let i = 0; i < capacities.length; i++) if (capacities[i] >= load) return i;
  return -1;
}

export function lanternSteps(costs: number[]) {
  let twoBack = 0;
  let oneBack = 0;
  for (let step = 2; step <= costs.length; step++) {
    const current = Math.min(oneBack + costs[step - 1], twoBack + costs[step - 2]);
    twoBack = oneBack;
    oneBack = current;
  }
  return oneBack;
}

// Used only for bounded differential tests, never large imported fixtures.
export function lanternStepsBrute(costs: number[]) {
  function visit(step: number): number {
    if (step >= costs.length) return 0;
    return costs[step] + Math.min(visit(step + 1), visit(step + 2));
  }
  return Math.min(visit(0), visit(1));
}

// Allowlisted, authored reference code. JSON code strings are NEVER evaluated.
export function referenceResult(slug: string, input: unknown): number | number[] {
  switch (slug) {
    case "relay-window": { const i = relayInput.parse(input); return relayWindow(i.loads, i.width); }
    case "quiet-badge": { const i = badgeInput.parse(input); return quietBadge(i.badges); }
    case "parcel-checkpoints": { const i = parcelInput.parse(input); return parcelCheckpoints(i.parcels, i.ranges); }
    case "dock-threshold": { const i = dockInput.parse(input); return dockThreshold(i.capacities, i.load); }
    case "lantern-steps": { const i = lanternInput.parse(input); return lanternSteps(i.costs); }
    default: throw new Error(`No trusted reference validator for ${slug}. Add one before seeding.`);
  }
}

export function validateProblemSemantics(problem: ProblemSeed) {
  for (const [kind, cases] of [["example", problem.examples], ["test", problem.testCases]] as const) {
    for (const item of cases) {
      const expected = referenceResult(problem.slug, item.input);
      if (JSON.stringify(expected) !== JSON.stringify(item.output)) {
        throw new Error(`${problem.slug}: ${kind} ${item.position} has an incorrect expected output.`);
      }
    }
  }
}
```

### `scripts/lib/load-problems.ts`

```ts
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { problemBatchSchema } from "../../src/lib/validators/problem";
import { validateProblemSemantics } from "./reference-problems";

export async function loadProblems(directory = join(process.cwd(), "src/data/seeds/problems")) {
  async function visit(folder: string): Promise<string[]> {
    const entries = await readdir(folder, { withFileTypes: true });
    const groups = await Promise.all(entries.map((entry) => {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) return visit(path);
      return entry.isFile() && entry.name.endsWith(".json") ? [path] : [];
    }));
    return groups.flat();
  }
  const files = (await visit(directory)).sort();
  if (files.length > 1000) throw new Error("A seed run supports at most 1,000 problem files.");
  const data: unknown[] = [];
  for (const file of files) {
    if ((await stat(file)).size > 1_000_000) throw new Error(`Seed file exceeds 1 MB: ${file}`);
    data.push(JSON.parse(await readFile(file, "utf8")));
  }
  const problems = problemBatchSchema.parse(data);
  for (const problem of problems) validateProblemSemantics(problem);
  return problems;
}
```

### `scripts/validate-seeds.ts`

```ts
import { loadProblems } from "./lib/load-problems";

async function main() {
  const problems = await loadProblems();
  console.log(`Validated ${problems.length} original problems, their examples, and all expected outputs.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed validation failed.");
  process.exitCode = 1;
});
```

### `prisma/seed-data.ts`

```ts
import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "../src/generated/prisma/client";
import { CATEGORIES, TAGS, INTERVIEW_STYLES } from "../src/data/seeds/taxonomy";
import { problemBatchSchema, type ProblemSeed } from "../src/lib/validators/problem";
import { validateProblemSemantics } from "../scripts/lib/reference-problems";

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function problemHash(problem: ProblemSeed) {
  return createHash("sha256").update(canonicalJson(problem)).digest("hex");
}

function jsonValue(value: unknown) {
  return value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
}

export async function seedProblems(db: PrismaClient, input: unknown) {
  // Validate the whole batch before any write, including callers outside the CLI.
  const problems = problemBatchSchema.parse(input);
  for (const p of problems) validateProblemSemantics(p);
  const existing = await db.problem.findMany({ select: { slug: true, seedHash: true } });
  const known = new Map(existing.map((p) => [p.slug, p.seedHash]));
  const available = new Set([...known.keys(), ...problems.map((p) => p.slug)]);
  for (const p of problems) {
    if (known.has(p.slug) && known.get(p.slug) !== problemHash(p)) {
      throw new Error(`Seed conflict for ${p.slug}: existing content differs. No seed content was changed.`);
    }
    if (p.relatedSlugs.some((slug) => !available.has(slug))) throw new Error(`Unknown related slug in ${p.slug}.`);
  }

  await db.$transaction(async (tx) => {
    for (const [slug, name] of CATEGORIES) await tx.category.upsert({ where: { slug }, create: { slug, name }, update: {} });
    for (const [slug, name] of TAGS) await tx.tag.upsert({ where: { slug }, create: { slug, name }, update: {} });
    for (const [slug, name] of INTERVIEW_STYLES) await tx.interviewStyle.upsert({ where: { slug }, create: { slug, name }, update: {} });
  }, { timeout: 30_000 });

  let created = 0;
  let skipped = 0;
  // Bounded transactions keep larger seed directories restartable.
  for (let offset = 0; offset < problems.length; offset += 20) {
    await db.$transaction(async (tx) => {
      for (const p of problems.slice(offset, offset + 20)) {
        const seedHash = problemHash(p);
        const current = await tx.problem.findUnique({ where: { slug: p.slug }, select: { seedHash: true } });
        if (current) {
          if (current.seedHash !== seedHash) throw new Error(`Concurrent seed conflict for ${p.slug}.`);
          skipped++;
          continue;
        }
        await tx.problem.create({ data: {
          slug: p.slug, title: p.title, difficulty: p.difficulty, kind: p.kind,
          status: p.status, pattern: p.pattern, statement: p.statement, constraints: p.constraints,
          estimatedMinutes: p.estimatedMinutes, timeLimitMs: p.timeLimitMs, memoryLimitKb: p.memoryLimitKb,
          seedHash, publishedAt: p.status === "PUBLISHED" ? new Date() : null,
          examples: { create: p.examples.map((e) => ({ ...e, input: jsonValue(e.input), output: jsonValue(e.output) })) },
          hints: { create: p.hints }, starterCode: { create: p.starterCode },
          testCases: { create: p.testCases.map((t) => ({ ...t, input: jsonValue(t.input), output: jsonValue(t.output) })) },
          solutions: { create: p.solutions.map((s) => ({ ...s, steps: { create: s.steps } })) },
          categories: { create: p.categories.map((slug) => ({ category: { connect: { slug } } })) },
          tags: { create: p.tags.map((slug) => ({ tag: { connect: { slug } } })) },
          interviewStyles: { create: p.interviewStyles.map((slug) => ({ style: { connect: { slug } } })) },
        } });
        created++;
      }
    }, { timeout: 60_000 });
  }
  // Resolve relations only after all new problems exist. Reruns repair a partial run.
  const ids = new Map((await db.problem.findMany({ select: { id: true, slug: true } })).map((p) => [p.slug, p.id]));
  const relations = problems.flatMap((p) => p.relatedSlugs.map((related) => ({ problemId: ids.get(p.slug)!, relatedId: ids.get(related)! })));
  if (relations.length) await db.problemRelation.createMany({ data: relations, skipDuplicates: true });
  return { created, skipped };
}
```

### `prisma/seed.ts`

```ts
import { loadEnvConfig } from "@next/env";
import { createDatabaseClient } from "../src/lib/db/client";
import { loadProblems } from "../scripts/lib/load-problems";
import { seedProblems } from "./seed-data";

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL in .env.local before seeding.");
  const problems = await loadProblems();
  const db = createDatabaseClient(url);
  try { console.log(await seedProblems(db, problems)); }
  finally { await db.$disconnect(); }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed failed.");
  process.exitCode = 1;
});
```

### `vitest.config.mts`

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/integration/**"],
    environment: "node",
  },
});
```

### `vitest.integration.config.mts`

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/integration/**/*.test.ts"], environment: "node", fileParallelism: false },
});
```

### `tests/reference-problems.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { relayWindow, relayWindowBrute, quietBadge, quietBadgeBrute, parcelCheckpoints, parcelCheckpointsBrute, dockThreshold, dockThresholdBrute, lanternSteps, lanternStepsBrute } from "../scripts/lib/reference-problems";

function arrays(values: number[], maxLength: number): number[][] {
  const result: number[][] = [[]];
  let current: number[][] = [[]];
  for (let length = 1; length <= maxLength; length++) {
    current = current.flatMap((prefix) => values.map((n) => [...prefix, n]));
    result.push(...current);
  }
  return result;
}

describe("optimized algorithms agree with independently structured brute-force baselines", () => {
  it("checks every valid window over small signed arrays", () => {
    for (const input of arrays([-2, 0, 3], 6)) {
      for (let width = 1; width <= input.length; width++) expect(relayWindow(input, width)).toBe(relayWindowBrute(input, width));
    }
  });
  it("preserves earliest uniqueness for all short badge records", () => {
    for (const input of arrays([0, 1, 2], 7)) {
      const badges = input.map((n) => "abc"[n]).join("");
      expect(quietBadge(badges)).toBe(quietBadgeBrute(badges));
    }
  });
  it("checks all half-open ranges including empty ones", () => {
    for (const input of arrays([-2, 0, 3], 5)) {
      const ranges: [number, number][] = [];
      for (let start = 0; start <= input.length; start++) for (let end = start; end <= input.length; end++) ranges.push([start, end]);
      expect(parcelCheckpoints(input, ranges)).toEqual(parcelCheckpointsBrute(input, ranges));
    }
  });
  it("finds the first qualifying dock even across duplicates", () => {
    for (const input of arrays([-2, 0, 3], 5)) {
      const sorted = [...input].sort((a, b) => a - b);
      for (let load = -3; load <= 4; load++) expect(dockThreshold(sorted, load)).toBe(dockThresholdBrute(sorted, load));
    }
  });
  it("checks rolling dynamic programming against complete route search", () => {
    for (const input of arrays([0, 1, 4], 7).filter((a) => a.length >= 2)) expect(lanternSteps(input)).toBe(lanternStepsBrute(input));
  });
});
```

### `tests/seed-validation.test.ts`

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { Script } from "node:vm";
import { loadProblems } from "../scripts/lib/load-problems";
import { validateProblemSemantics } from "../scripts/lib/reference-problems";
import { problemBatchSchema, problemSchema, type ProblemSeed } from "@/lib/validators/problem";
import { canonicalJson, problemHash } from "../prisma/seed-data";

let problems: ProblemSeed[];
beforeAll(async () => { problems = await loadProblems(); });

describe("original seed contract", () => {
  it("has five fully validated problems and complete executable-language listings", () => {
    expect(problems).toHaveLength(5);
    for (const p of problems) {
      validateProblemSemantics(p);
      const entryPoint = p.starterCode[0].entryPoint;
      for (const item of [...p.starterCode, ...p.solutions]) {
        // Compile only to detect syntax errors. Never run strings from seed JSON.
        expect(() => new Script(item.code)).not.toThrow();
        expect(item.code).toContain(`function ${entryPoint}(`);
      }
    }
  });
  it("rejects a duplicate slug across files", () => {
    expect(() => problemBatchSchema.parse([problems[0], problems[0]])).toThrow(/Duplicate problem slug/);
  });
  it("rejects misspelled fields instead of silently dropping them", () => {
    expect(problemSchema.safeParse({ ...problems[0], difficultyLevel: "EASY" }).success).toBe(false);
  });
  it("rejects invalid taxonomy references and repeated tags", () => {
    expect(problemSchema.safeParse({ ...problems[0], categories: ["not-a-category"] }).success).toBe(false);
    expect(problemSchema.safeParse({ ...problems[0], tags: ["prefix-sum", "prefix-sum"] }).success).toBe(false);
  });
  it("requires both visibility groups and a full progressive hint sequence", () => {
    expect(problemSchema.safeParse({ ...problems[0], testCases: problems[0].testCases.map((t) => ({ ...t, visibility: "VISIBLE" })) }).success).toBe(false);
    expect(problemSchema.safeParse({ ...problems[0], hints: problems[0].hints.slice(1) }).success).toBe(false);
    expect(problemSchema.safeParse({ ...problems[0], hints: problems[0].hints.map((h) => ({ ...h, position: 1 })) }).success).toBe(false);
  });
  it("rejects self-related problems and duplicate solution variants", () => {
    expect(problemSchema.safeParse({ ...problems[0], relatedSlugs: [problems[0].slug] }).success).toBe(false);
    expect(problemSchema.safeParse({ ...problems[0], solutions: [...problems[0].solutions, problems[0].solutions[0]] }).success).toBe(false);
  });
  it("rejects incorrect expected outputs and malformed algorithm inputs", () => {
    const corrupted = structuredClone(problems.find((p) => p.slug === "relay-window")!);
    corrupted.testCases[0].output = 999;
    expect(() => validateProblemSemantics(corrupted)).toThrow(/incorrect expected output/);
    corrupted.testCases[0].input = { loads: [1], width: 2 };
    expect(() => validateProblemSemantics(corrupted)).toThrow(/Window must fit/);
  });
  it("hashes JSON consistently despite object key order, while detecting content changes", () => {
    expect(canonicalJson({ z: [3, 1], a: { d: 2, c: 1 } })).toBe(canonicalJson({ a: { c: 1, d: 2 }, z: [3, 1] }));
    expect(problemHash(problems[0])).not.toBe(problemHash({ ...problems[0], title: "A revised title" }));
  });
});
```

### `tests/migration.test.ts`

```ts
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

let db: PGlite;
const problemId = "10000000-0000-4000-8000-000000000001";
const userId = "20000000-0000-4000-8000-000000000001";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(await readFile("prisma/migrations/202609130001_foundation/migration.sql", "utf8"));
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

### `tests/integration/seed.test.ts`

```ts
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/lib/db/client";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import type { ProblemSeed } from "@/lib/validators/problem";

let db: ReturnType<typeof createDatabaseClient>;
let problems: ProblemSeed[];
let ownsFixtures = false;
const userId = randomUUID();

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use TEST_DATABASE_URL pointing to a dedicated database ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Integration tests require an empty problem collection in the dedicated test database.");
  problems = await loadProblems();
  ownsFixtures = true;
}, 30_000);
afterAll(async () => {
  if (db && ownsFixtures) {
    await db.user.deleteMany({ where: { id: userId } });
    await db.problem.deleteMany({ where: { slug: { in: problems.map((p) => p.slug) } } });
  }
  await db?.$disconnect();
});

describe("real PostgreSQL seed lifecycle", () => {
  it("inserts complete related data atomically per batch", async () => {
    expect(await seedProblems(db, problems)).toEqual({ created: 5, skipped: 0 });
    expect(await db.problemHint.count()).toBe(25);
    expect(await db.problemSolution.count()).toBe(10);
    expect(await db.testCase.count()).toBe(30);
    expect(await db.category.count()).toBe(30);
  });
  it("is idempotent and preserves IDs and user data on rerun", async () => {
    const before = await db.problem.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true, updatedAt: true } });
    await db.user.create({ data: { id: userId } });
    await db.userProgress.create({ data: { userId, problemId: before[0].id, bookmarked: true } });
    expect(await seedProblems(db, problems)).toEqual({ created: 0, skipped: 5 });
    expect(await db.problem.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true, updatedAt: true } })).toEqual(before);
    expect(await db.userProgress.count({ where: { userId, bookmarked: true } })).toBe(1);
  });
  it("refuses content collisions without changing the saved problem", async () => {
    const original = await db.problem.findUniqueOrThrow({ where: { slug: problems[0].slug } });
    await expect(seedProblems(db, [{ ...problems[0], title: "Changed content" }])).rejects.toThrow(/Seed conflict/);
    expect((await db.problem.findUniqueOrThrow({ where: { slug: problems[0].slug } })).title).toBe(original.title);
  });
  it("validates the complete input before starting new writes", async () => {
    const before = await db.problem.count();
    await expect(seedProblems(db, [problems[0], problems[0]])).rejects.toThrow(/Duplicate problem slug/);
    await expect(seedProblems(db, [{ ...problems[0], relatedSlugs: ["missing-problem"] }])).rejects.toThrow();
    expect(await db.problem.count()).toBe(before);
  });
});
```

### `.github/workflows/ci.yml`

```yaml
name: Validate AlgoSprint

on:
  pull_request:
  push:
    branches: [main, "algosprint/**"]

permissions:
  contents: read

concurrency:
  group: validate-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: algosprint_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres -d algosprint_test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/algosprint_test
      TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/algosprint_test
      NEXT_TELEMETRY_DISABLED: "1"
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run db:generate
      - run: npm run db:validate
      - run: npm run db:deploy
      - run: npm run seed:validate
      - run: npm test
      - run: npm run test:integration
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build
```

### `src/data/seeds/problems/foundation/dock-threshold.json`

```json
{
  "schemaVersion": 1,
  "slug": "dock-threshold",
  "title": "Dock Threshold",
  "difficulty": "EASY",
  "kind": "CODING",
  "status": "PUBLISHED",
  "pattern": "lower-bound",
  "statement": "A harbor lists dock capacities in nondecreasing order. Return the zero-based index of the first dock whose capacity is at least load. If every dock is too small, or the list is empty, return -1. Several docks may have the same capacity; choose the earliest qualifying index.",
  "constraints": [
    "0 <= capacities.length <= 100000",
    "-1000000 <= capacities[i], load <= 1000000",
    "capacities is sorted in nondecreasing order."
  ],
  "estimatedMinutes": 20,
  "timeLimitMs": 2000,
  "memoryLimitKb": 262144,
  "categories": [
    "arrays",
    "binary-search"
  ],
  "tags": [
    "monotone-search"
  ],
  "interviewStyles": [
    "general-software"
  ],
  "relatedSlugs": [],
  "examples": [
    {
      "position": 1,
      "input": {
        "capacities": [
          2,
          5,
          5,
          9
        ],
        "load": 5
      },
      "output": 1,
      "explanation": "Both indices 1 and 2 have capacity 5, but index 1 is the first qualifying dock."
    },
    {
      "position": 2,
      "input": {
        "capacities": [
          2,
          5,
          9
        ],
        "load": 10
      },
      "output": -1,
      "explanation": "No capacity reaches the required load."
    }
  ],
  "hints": [
    {
      "position": 1,
      "content": "The answer divides docks that are too small from docks that qualify."
    },
    {
      "position": 2,
      "content": "Because capacities are sorted, that boundary never moves backward."
    },
    {
      "position": 3,
      "content": "Binary search can locate the first true position of the condition capacity >= load."
    },
    {
      "position": 4,
      "content": "Keep a half-open search interval. When the middle qualifies, retain its left half including the middle."
    },
    {
      "position": 5,
      "content": "Start left at zero and right at the array length. Stop when they meet; return -1 if that position is past the final dock."
    }
  ],
  "starterCode": [
    {
      "language": "JAVASCRIPT",
      "entryPoint": "dockThreshold",
      "code": "function dockThreshold(capacities, load) {\n  // Write your solution here.\n  throw new Error(\"Not implemented\");\n}"
    }
  ],
  "testCases": [
    {
      "position": 1,
      "visibility": "VISIBLE",
      "input": {
        "capacities": [
          2,
          5,
          5,
          9
        ],
        "load": 5
      },
      "output": 1,
      "explanation": "Both indices 1 and 2 have capacity 5, but index 1 is the first qualifying dock."
    },
    {
      "position": 2,
      "visibility": "VISIBLE",
      "input": {
        "capacities": [
          2,
          5,
          9
        ],
        "load": 10
      },
      "output": -1,
      "explanation": "No capacity reaches the required load."
    },
    {
      "position": 3,
      "visibility": "HIDDEN",
      "input": {
        "capacities": [],
        "load": 1
      },
      "output": -1,
      "explanation": "There are no docks."
    },
    {
      "position": 4,
      "visibility": "HIDDEN",
      "input": {
        "capacities": [
          7
        ],
        "load": 7
      },
      "output": 0,
      "explanation": "Equality qualifies."
    },
    {
      "position": 5,
      "visibility": "HIDDEN",
      "input": {
        "capacities": [
          1,
          1,
          1
        ],
        "load": 1
      },
      "output": 0,
      "explanation": "Return the earliest duplicate."
    },
    {
      "position": 6,
      "visibility": "HIDDEN",
      "input": {
        "capacities": [
          -5,
          -2,
          0
        ],
        "load": -3
      },
      "output": 1,
      "explanation": "The first qualifying capacity is -2."
    }
  ],
  "solutions": [
    {
      "kind": "BRUTE_FORCE",
      "language": "JAVASCRIPT",
      "title": "Inspect docks in order",
      "intuition": "Scanning left to right naturally finds the earliest qualifying dock.",
      "approach": "Return the first index whose capacity is at least the load. If the scan ends, return -1.",
      "pseudocode": "For each index in order: if capacity >= load return index; return -1.",
      "code": "function dockThreshold(capacities, load) {\n    for (let i = 0; i < capacities.length; i++)\n        if (capacities[i] >= load)\n            return i;\n    return -1;\n}",
      "timeComplexity": "O(n)",
      "spaceComplexity": "O(1)",
      "commonMistakes": [
        "Returning immediately on equality may select a later duplicate.",
        "When the midpoint fails, advance to mid + 1 so the search always shrinks."
      ],
      "interviewExplanation": "This is a search for the first qualifying position, not any matching value. I keep a half-open interval around the boundary and discard half of it at every comparison. Equal values remain on the qualifying side, which preserves the first-index requirement.",
      "steps": [
        {
          "position": 1,
          "title": "Step 1",
          "content": "Scanning left to right naturally finds the earliest qualifying dock."
        },
        {
          "position": 2,
          "title": "Step 2",
          "content": "Return the first index whose capacity is at least the load. If the scan ends, return -1."
        },
        {
          "position": 3,
          "title": "Step 3",
          "content": "After exploring every allowed candidate, return the best valid result under the statement’s rules."
        }
      ]
    },
    {
      "kind": "OPTIMAL",
      "language": "JAVASCRIPT",
      "title": "Find the qualifying boundary",
      "intuition": "Sorted data lets each comparison discard a region that cannot contain the first qualifying dock.",
      "approach": "Maintain [left,right). If the midpoint qualifies, move right to mid. Otherwise move left to mid + 1. At convergence, check whether the index exists.",
      "pseudocode": "left = 0; right = n; while left < right: mid = left + floor((right-left)/2); if capacities[mid] >= load: right = mid; else: left = mid+1.",
      "code": "function dockThreshold(capacities, load) {\n    let left = 0;\n    let right = capacities.length;\n    while (left < right) {\n        const mid = left + Math.floor((right - left) / 2);\n        if (capacities[mid] >= load)\n            right = mid;\n        else\n            left = mid + 1;\n    }\n    return left === capacities.length ? -1 : left;\n}",
      "timeComplexity": "O(log n)",
      "spaceComplexity": "O(1)",
      "commonMistakes": [
        "Returning immediately on equality may select a later duplicate.",
        "When the midpoint fails, advance to mid + 1 so the search always shrinks."
      ],
      "interviewExplanation": "This is a search for the first qualifying position, not any matching value. I keep a half-open interval around the boundary and discard half of it at every comparison. Equal values remain on the qualifying side, which preserves the first-index requirement.",
      "steps": [
        {
          "position": 1,
          "title": "Step 1",
          "content": "For [2,5,5,9] and load 5, the first midpoint is index 2. It qualifies, so move right to 2."
        },
        {
          "position": 2,
          "title": "Step 2",
          "content": "Index 1 also qualifies, so move right to 1. Index 0 is too small, so move left to 1."
        },
        {
          "position": 3,
          "title": "Step 3",
          "content": "The bounds meet at index 1, which is the first qualifying dock."
        }
      ]
    }
  ]
}
```

### `src/data/seeds/problems/foundation/lantern-steps.json`

```json
{
  "schemaVersion": 1,
  "slug": "lantern-steps",
  "title": "Lantern Steps",
  "difficulty": "MEDIUM",
  "kind": "CODING",
  "status": "PUBLISHED",
  "pattern": "one-dimensional-dp",
  "statement": "A trail has numbered platforms 0 through n - 1 and an exit at position n. Platform i requires costs[i] lantern tokens when you leave it. You may start on platform 0 or platform 1 without an initial fee. Each move advances one or two positions. Return the minimum total tokens required to reach the exit. The exit has no fee. You pay for every platform you leave, including your starting platform.",
  "constraints": [
    "2 <= costs.length <= 100000",
    "0 <= costs[i] <= 1000",
    "Every move advances one or two positions."
  ],
  "estimatedMinutes": 30,
  "timeLimitMs": 2000,
  "memoryLimitKb": 262144,
  "categories": [
    "arrays",
    "dynamic-programming"
  ],
  "tags": [
    "state-transition"
  ],
  "interviewStyles": [
    "general-software"
  ],
  "relatedSlugs": [],
  "examples": [
    {
      "position": 1,
      "input": {
        "costs": [
          4,
          9,
          2,
          7
        ]
      },
      "output": 6,
      "explanation": "Start at platform 0, pay 4 to move to platform 2, then pay 2 to reach exit 4."
    },
    {
      "position": 2,
      "input": {
        "costs": [
          8,
          3
        ]
      },
      "output": 3,
      "explanation": "Start at platform 1 and pay 3 to reach the exit."
    }
  ],
  "hints": [
    {
      "position": 1,
      "content": "The cost to reach a position depends on the platform you used for the final move."
    },
    {
      "position": 2,
      "content": "There are only two possible previous positions."
    },
    {
      "position": 3,
      "content": "Define dp[k] as the minimum tokens paid before arriving at position k."
    },
    {
      "position": 4,
      "content": "The starting choices give dp[0] = dp[1] = 0. For k >= 2, compare arriving from k - 1 and from k - 2, paying the departure cost."
    },
    {
      "position": 5,
      "content": "Use dp[k] = min(dp[k-1] + costs[k-1], dp[k-2] + costs[k-2]); keep only the two most recent values and return dp[n]."
    }
  ],
  "starterCode": [
    {
      "language": "JAVASCRIPT",
      "entryPoint": "lanternSteps",
      "code": "function lanternSteps(costs) {\n  // Write your solution here.\n  throw new Error(\"Not implemented\");\n}"
    }
  ],
  "testCases": [
    {
      "position": 1,
      "visibility": "VISIBLE",
      "input": {
        "costs": [
          4,
          9,
          2,
          7
        ]
      },
      "output": 6,
      "explanation": "Start at platform 0, pay 4 to move to platform 2, then pay 2 to reach exit 4."
    },
    {
      "position": 2,
      "visibility": "VISIBLE",
      "input": {
        "costs": [
          8,
          3
        ]
      },
      "output": 3,
      "explanation": "Start at platform 1 and pay 3 to reach the exit."
    },
    {
      "position": 3,
      "visibility": "HIDDEN",
      "input": {
        "costs": [
          0,
          0,
          0
        ]
      },
      "output": 0,
      "explanation": "A route through zero-cost platforms is free."
    },
    {
      "position": 4,
      "visibility": "HIDDEN",
      "input": {
        "costs": [
          5,
          1,
          1,
          5,
          1
        ]
      },
      "output": 3,
      "explanation": "Platforms 1, 2, and 4 cost one token each before exit 5."
    },
    {
      "position": 5,
      "visibility": "HIDDEN",
      "input": {
        "costs": [
          10,
          15,
          20
        ]
      },
      "output": 15,
      "explanation": "Starting at platform 1 reaches exit 3 in one two-position move."
    },
    {
      "position": 6,
      "visibility": "HIDDEN",
      "input": {
        "costs": [
          2,
          50,
          3,
          4,
          2
        ]
      },
      "output": 7,
      "explanation": "One cheapest route leaves platforms 0, 2, and 4, for a total of 7."
    }
  ],
  "solutions": [
    {
      "kind": "BRUTE_FORCE",
      "language": "JAVASCRIPT",
      "title": "Explore each route",
      "intuition": "Every route is a sequence of one-position and two-position moves from one of the two starting platforms.",
      "approach": "Recursively try both possible moves, add the departure fee, and choose the cheaper result. Compare the two starting positions.",
      "pseudocode": "visit(i) = 0 at or beyond exit; otherwise costs[i] + min(visit(i+1), visit(i+2)); return min(visit(0), visit(1)).",
      "code": "function lanternSteps(costs) {\n    function visit(step) {\n        if (step >= costs.length)\n            return 0;\n        return costs[step] + Math.min(visit(step + 1), visit(step + 2));\n    }\n    return Math.min(visit(0), visit(1));\n}",
      "timeComplexity": "O(2^n) upper bound",
      "spaceComplexity": "O(n) recursion depth",
      "commonMistakes": [
        "The state is the cost to arrive before paying to leave; mixing the two meanings double-counts fees.",
        "The exit is at index n and must not read a nonexistent costs[n]."
      ],
      "interviewExplanation": "I define the state as the minimum cost to arrive at a position. The last move comes from one of two earlier platforms, including that platform’s departure fee. Computing each state once removes repeated recursion, and keeping only two states reduces extra space to constant.",
      "steps": [
        {
          "position": 1,
          "title": "Step 1",
          "content": "Every route is a sequence of one-position and two-position moves from one of the two starting platforms."
        },
        {
          "position": 2,
          "title": "Step 2",
          "content": "Recursively try both possible moves, add the departure fee, and choose the cheaper result. Compare the two starting positions."
        },
        {
          "position": 3,
          "title": "Step 3",
          "content": "After exploring every allowed candidate, return the best valid result under the statement’s rules."
        }
      ]
    },
    {
      "kind": "OPTIMAL",
      "language": "JAVASCRIPT",
      "title": "Keep two arrival costs",
      "intuition": "Many routes reach the same platform. Once the cheapest arrival cost is known, more expensive arrivals need not be reconsidered.",
      "approach": "Build the minimum arrival cost from left to right. Only the two preceding values are needed for the next transition.",
      "pseudocode": "twoBack = oneBack = 0; for k from 2 through n: current = min(oneBack + costs[k-1], twoBack + costs[k-2]); shift the two stored costs.",
      "code": "function lanternSteps(costs) {\n    let twoBack = 0;\n    let oneBack = 0;\n    for (let step = 2; step <= costs.length; step++) {\n        const current = Math.min(oneBack + costs[step - 1], twoBack + costs[step - 2]);\n        twoBack = oneBack;\n        oneBack = current;\n    }\n    return oneBack;\n}",
      "timeComplexity": "O(n)",
      "spaceComplexity": "O(1)",
      "commonMistakes": [
        "The state is the cost to arrive before paying to leave; mixing the two meanings double-counts fees.",
        "The exit is at index n and must not read a nonexistent costs[n]."
      ],
      "interviewExplanation": "I define the state as the minimum cost to arrive at a position. The last move comes from one of two earlier platforms, including that platform’s departure fee. Computing each state once removes repeated recursion, and keeping only two states reduces extra space to constant.",
      "steps": [
        {
          "position": 1,
          "title": "Step 1",
          "content": "The free starting choices give dp[0] = 0 and dp[1] = 0. For [4,9,2,7], dp[2] = min(9,4) = 4."
        },
        {
          "position": 2,
          "title": "Step 2",
          "content": "dp[3] = min(dp[2]+2, dp[1]+9) = 6."
        },
        {
          "position": 3,
          "title": "Step 3",
          "content": "The exit is position 4: dp[4] = min(dp[3]+7, dp[2]+2) = 6."
        }
      ]
    }
  ]
}
```

### `src/data/seeds/problems/foundation/parcel-checkpoints.json`

```json
{
  "schemaVersion": 1,
  "slug": "parcel-checkpoints",
  "title": "Parcel Checkpoints",
  "difficulty": "MEDIUM",
  "kind": "CODING",
  "status": "PUBLISHED",
  "pattern": "prefix-sum",
  "statement": "A depot stores the signed change in parcel count at each checkpoint in parcels. For every pair [start, end] in ranges, return the total change from index start up to but not including index end. Return the totals in the same order as ranges. A range with start equal to end is empty and has total zero.",
  "constraints": [
    "0 <= parcels.length <= 100000",
    "-1000000 <= parcels[i] <= 1000000",
    "0 <= ranges.length <= 100000",
    "Each range satisfies 0 <= start <= end <= parcels.length."
  ],
  "estimatedMinutes": 25,
  "timeLimitMs": 2000,
  "memoryLimitKb": 262144,
  "categories": [
    "arrays"
  ],
  "tags": [
    "prefix-sum"
  ],
  "interviewStyles": [
    "general-software"
  ],
  "relatedSlugs": [],
  "examples": [
    {
      "position": 1,
      "input": {
        "parcels": [
          4,
          -2,
          7,
          3
        ],
        "ranges": [
          [
            0,
            2
          ],
          [
            1,
            4
          ],
          [
            2,
            2
          ]
        ]
      },
      "output": [
        2,
        8,
        0
      ],
      "explanation": "The requested slices are [4,-2], [-2,7,3], and an empty slice."
    },
    {
      "position": 2,
      "input": {
        "parcels": [],
        "ranges": [
          [
            0,
            0
          ]
        ]
      },
      "output": [
        0
      ],
      "explanation": "The only valid slice of an empty array is empty."
    }
  ],
  "hints": [
    {
      "position": 1,
      "content": "Solving one range by summing its entries is straightforward; many overlapping ranges repeat work."
    },
    {
      "position": 2,
      "content": "Can one stored cumulative total help answer several different ranges?"
    },
    {
      "position": 3,
      "content": "Let prefix[k] mean the sum of the first k entries."
    },
    {
      "position": 4,
      "content": "A range total is prefix[end] minus prefix[start]."
    },
    {
      "position": 5,
      "content": "Begin the prefix array with zero, accumulate every checkpoint once, and answer each range with one subtraction."
    }
  ],
  "starterCode": [
    {
      "language": "JAVASCRIPT",
      "entryPoint": "parcelCheckpoints",
      "code": "function parcelCheckpoints(parcels, ranges) {\n  // Write your solution here.\n  throw new Error(\"Not implemented\");\n}"
    }
  ],
  "testCases": [
    {
      "position": 1,
      "visibility": "VISIBLE",
      "input": {
        "parcels": [
          4,
          -2,
          7,
          3
        ],
        "ranges": [
          [
            0,
            2
          ],
          [
            1,
            4
          ],
          [
            2,
            2
          ]
        ]
      },
      "output": [
        2,
        8,
        0
      ],
      "explanation": "The requested slices are [4,-2], [-2,7,3], and an empty slice."
    },
    {
      "position": 2,
      "visibility": "VISIBLE",
      "input": {
        "parcels": [],
        "ranges": [
          [
            0,
            0
          ]
        ]
      },
      "output": [
        0
      ],
      "explanation": "The only valid slice of an empty array is empty."
    },
    {
      "position": 3,
      "visibility": "HIDDEN",
      "input": {
        "parcels": [
          5
        ],
        "ranges": [
          [
            0,
            1
          ]
        ]
      },
      "output": [
        5
      ],
      "explanation": "The end index is exclusive."
    },
    {
      "position": 4,
      "visibility": "HIDDEN",
      "input": {
        "parcels": [
          -3,
          -1,
          4
        ],
        "ranges": [
          [
            0,
            3
          ],
          [
            0,
            2
          ]
        ]
      },
      "output": [
        0,
        -4
      ],
      "explanation": "Signed totals may be zero or negative."
    },
    {
      "position": 5,
      "visibility": "HIDDEN",
      "input": {
        "parcels": [
          1,
          1,
          1
        ],
        "ranges": []
      },
      "output": [],
      "explanation": "No requested ranges means no output entries."
    },
    {
      "position": 6,
      "visibility": "HIDDEN",
      "input": {
        "parcels": [
          1000000,
          1000000
        ],
        "ranges": [
          [
            0,
            2
          ],
          [
            1,
            2
          ]
        ]
      },
      "output": [
        2000000,
        1000000
      ],
      "explanation": "Each answer uses the requested half-open range."
    }
  ],
  "solutions": [
    {
      "kind": "BRUTE_FORCE",
      "language": "JAVASCRIPT",
      "title": "Walk each requested range",
      "intuition": "Every answer can be obtained directly from the checkpoint changes included in that range.",
      "approach": "For each range, add the entries from start through end - 1 and append the result.",
      "pseudocode": "For each [start, end): set total = 0; add each included parcel change; append total.",
      "code": "function parcelCheckpoints(parcels, ranges) {\n    return ranges.map(([start, end]) => {\n        let sum = 0;\n        for (let i = start; i < end; i++)\n            sum += parcels[i];\n        return sum;\n    });\n}",
      "timeComplexity": "O(n × q) in the worst case, for n checkpoints and q ranges",
      "spaceComplexity": "O(q) for the returned answers; O(1) additional working space",
      "commonMistakes": [
        "Treating end as inclusive introduces an off-by-one error.",
        "Forgetting the leading zero makes ranges beginning at index zero harder to handle correctly."
      ],
      "interviewExplanation": "With many overlapping queries, repeated summation wastes work. I preprocess the checkpoint changes into prefix totals and answer each query in constant time. The end-exclusive convention also makes empty ranges work without a special branch.",
      "steps": [
        {
          "position": 1,
          "title": "Step 1",
          "content": "Every answer can be obtained directly from the checkpoint changes included in that range."
        },
        {
          "position": 2,
          "title": "Step 2",
          "content": "For each range, add the entries from start through end - 1 and append the result."
        },
        {
          "position": 3,
          "title": "Step 3",
          "content": "After exploring every allowed candidate, return the best valid result under the statement’s rules."
        }
      ]
    },
    {
      "kind": "OPTIMAL",
      "language": "JAVASCRIPT",
      "title": "Reuse cumulative totals",
      "intuition": "The difference of two prefix totals removes exactly the entries before the requested start.",
      "approach": "Create a prefix array of length n + 1 with prefix[0] = 0. Return prefix[end] - prefix[start] for each range.",
      "pseudocode": "Build prefix starting at zero; for each range return prefix[end] - prefix[start].",
      "code": "function parcelCheckpoints(parcels, ranges) {\n    const prefix = [0];\n    for (const count of parcels)\n        prefix.push(prefix[prefix.length - 1] + count);\n    return ranges.map(([start, end]) => prefix[end] - prefix[start]);\n}",
      "timeComplexity": "O(n + q)",
      "spaceComplexity": "O(n + q), including the returned answers",
      "commonMistakes": [
        "Treating end as inclusive introduces an off-by-one error.",
        "Forgetting the leading zero makes ranges beginning at index zero harder to handle correctly."
      ],
      "interviewExplanation": "With many overlapping queries, repeated summation wastes work. I preprocess the checkpoint changes into prefix totals and answer each query in constant time. The end-exclusive convention also makes empty ranges work without a special branch.",
      "steps": [
        {
          "position": 1,
          "title": "Step 1",
          "content": "For [4,-2,7,3], the prefix totals are [0,4,2,9,12]."
        },
        {
          "position": 2,
          "title": "Step 2",
          "content": "Range [0,2) totals prefix[2] - prefix[0] = 2; range [1,4) totals 12 - 4 = 8."
        },
        {
          "position": 3,
          "title": "Step 3",
          "content": "Range [2,2) subtracts the same prefix total from itself and returns zero."
        }
      ]
    }
  ]
}
```

### `src/data/seeds/problems/foundation/quiet-badge.json`

```json
{
  "schemaVersion": 1,
  "slug": "quiet-badge",
  "title": "Quiet Badge",
  "difficulty": "EASY",
  "kind": "CODING",
  "status": "PUBLISHED",
  "pattern": "frequency-count",
  "statement": "A workshop records the lowercase letter printed on each arriving attendee badge in the string badges. Return the zero-based position of the earliest arrival whose badge letter appears exactly once in the complete record. Return -1 if no badge letter is unique. An empty record also returns -1.",
  "constraints": [
    "0 <= badges.length <= 100000",
    "badges contains only lowercase English letters a through z."
  ],
  "estimatedMinutes": 15,
  "timeLimitMs": 2000,
  "memoryLimitKb": 262144,
  "categories": [
    "strings",
    "hash-maps"
  ],
  "tags": [
    "frequency-count",
    "linear-scan"
  ],
  "interviewStyles": [
    "general-software"
  ],
  "relatedSlugs": [],
  "examples": [
    {
      "position": 1,
      "input": {
        "badges": "abacbd"
      },
      "output": 3,
      "explanation": "a and b each appear twice. c is the earliest letter that appears once, at index 3."
    },
    {
      "position": 2,
      "input": {
        "badges": "aabb"
      },
      "output": -1,
      "explanation": "Every recorded badge letter occurs more than once."
    }
  ],
  "hints": [
    {
      "position": 1,
      "content": "A letter can look unique early in the record and appear again later."
    },
    {
      "position": 2,
      "content": "Separate learning how often letters occur from choosing the earliest arrival."
    },
    {
      "position": 3,
      "content": "Store a frequency for each badge letter."
    },
    {
      "position": 4,
      "content": "Count the complete record, then scan its positions from left to right."
    },
    {
      "position": 5,
      "content": "Return the first index whose letter has frequency one; otherwise return -1."
    }
  ],
  "starterCode": [
    {
      "language": "JAVASCRIPT",
      "entryPoint": "quietBadge",
      "code": "function quietBadge(badges) {\n  // Write your solution here.\n  throw new Error(\"Not implemented\");\n}"
    }
  ],
  "testCases": [
    {
      "position": 1,
      "visibility": "VISIBLE",
      "input": {
        "badges": "abacbd"
      },
      "output": 3,
      "explanation": "a and b each appear twice. c is the earliest letter that appears once, at index 3."
    },
    {
      "position": 2,
      "visibility": "VISIBLE",
      "input": {
        "badges": "aabb"
      },
      "output": -1,
      "explanation": "Every recorded badge letter occurs more than once."
    },
    {
      "position": 3,
      "visibility": "HIDDEN",
      "input": {
        "badges": ""
      },
      "output": -1,
      "explanation": "There are no arrivals."
    },
    {
      "position": 4,
      "visibility": "HIDDEN",
      "input": {
        "badges": "z"
      },
      "output": 0,
      "explanation": "The only arrival is unique."
    },
    {
      "position": 5,
      "visibility": "HIDDEN",
      "input": {
        "badges": "xxyzz"
      },
      "output": 2,
      "explanation": "Only y occurs once, at index 2."
    },
    {
      "position": 6,
      "visibility": "HIDDEN",
      "input": {
        "badges": "abca"
      },
      "output": 1,
      "explanation": "Both b and c are unique; b arrived earlier."
    }
  ],
  "solutions": [
    {
      "kind": "BRUTE_FORCE",
      "language": "JAVASCRIPT",
      "title": "Count around each arrival",
      "intuition": "An arrival qualifies only when its letter has exactly one occurrence in the entire record.",
      "approach": "For each position, count that position’s letter in the full string. Return the first position with count one.",
      "pseudocode": "For each index i: count occurrences of badges[i]; if count equals one return i; return -1.",
      "code": "function quietBadge(badges) {\n    for (let i = 0; i < badges.length; i++) {\n        let count = 0;\n        for (const badge of badges)\n            if (badge === badges[i])\n                count++;\n        if (count === 1)\n            return i;\n    }\n    return -1;\n}",
      "timeComplexity": "O(n²)",
      "spaceComplexity": "O(1)",
      "commonMistakes": [
        "Returning a letter before reading the whole record can miss a later duplicate.",
        "Returning an arbitrary unique map entry can ignore the required arrival order."
      ],
      "interviewExplanation": "I count every badge letter first, then scan the record in its original order. This preserves the earliest-arrival requirement while avoiding a full recount for each position. Two linear scans are O(n), and the fixed alphabet bounds the map size.",
      "steps": [
        {
          "position": 1,
          "title": "Step 1",
          "content": "An arrival qualifies only when its letter has exactly one occurrence in the entire record."
        },
        {
          "position": 2,
          "title": "Step 2",
          "content": "For each position, count that position’s letter in the full string. Return the first position with count one."
        },
        {
          "position": 3,
          "title": "Step 3",
          "content": "After exploring every allowed candidate, return the best valid result under the statement’s rules."
        }
      ]
    },
    {
      "kind": "OPTIMAL",
      "language": "JAVASCRIPT",
      "title": "Count once, choose once",
      "intuition": "The same frequency can answer the uniqueness question for every occurrence of a letter.",
      "approach": "Build one frequency map. A second scan follows arrival order and returns the first index with frequency one.",
      "pseudocode": "Count every letter in a map; scan indices in increasing order; return first letter with count one, else -1.",
      "code": "function quietBadge(badges) {\n    const counts = new Map();\n    for (const badge of badges)\n        counts.set(badge, (counts.get(badge) ?? 0) + 1);\n    for (let i = 0; i < badges.length; i++)\n        if (counts.get(badges[i]) === 1)\n            return i;\n    return -1;\n}",
      "timeComplexity": "O(n)",
      "spaceComplexity": "O(1), because there are at most 26 distinct letters",
      "commonMistakes": [
        "Returning a letter before reading the whole record can miss a later duplicate.",
        "Returning an arbitrary unique map entry can ignore the required arrival order."
      ],
      "interviewExplanation": "I count every badge letter first, then scan the record in its original order. This preserves the earliest-arrival requirement while avoiding a full recount for each position. Two linear scans are O(n), and the fixed alphabet bounds the map size.",
      "steps": [
        {
          "position": 1,
          "title": "Step 1",
          "content": "For abacbd, the frequencies are a:2, b:2, c:1, and d:1."
        },
        {
          "position": 2,
          "title": "Step 2",
          "content": "Indices 0, 1, and 2 contain repeated letters."
        },
        {
          "position": 3,
          "title": "Step 3",
          "content": "Index 3 contains c, whose count is one, so the result is 3."
        }
      ]
    }
  ]
}
```

### `src/data/seeds/problems/foundation/relay-window.json`

```json
{
  "schemaVersion": 1,
  "slug": "relay-window",
  "title": "Relay Window",
  "difficulty": "EASY",
  "kind": "CODING",
  "status": "PUBLISHED",
  "pattern": "fixed-window",
  "statement": "A relay station records an integer load for each time slot in the array loads. You may reserve exactly width consecutive slots. Return the largest total load among all such reservations. Negative values represent load returned to the station, so a valid answer can be negative. Return the total, not the starting index.",
  "constraints": [
    "1 <= loads.length <= 100000",
    "-1000000 <= loads[i] <= 1000000",
    "1 <= width <= loads.length"
  ],
  "estimatedMinutes": 15,
  "timeLimitMs": 2000,
  "memoryLimitKb": 262144,
  "categories": [
    "arrays",
    "sliding-window"
  ],
  "tags": [
    "fixed-window",
    "linear-scan"
  ],
  "interviewStyles": [
    "general-software"
  ],
  "relatedSlugs": [],
  "examples": [
    {
      "position": 1,
      "input": {
        "loads": [
          3,
          1,
          5,
          2,
          6,
          1
        ],
        "width": 3
      },
      "output": 13,
      "explanation": "Slots with zero-based indices 2 through 4 contain 5, 2, and 6; their sum is 13."
    },
    {
      "position": 2,
      "input": {
        "loads": [
          -4,
          -2,
          -7
        ],
        "width": 2
      },
      "output": -6,
      "explanation": "The two valid totals are -6 and -9. Choosing no slots is not allowed."
    }
  ],
  "hints": [
    {
      "position": 1,
      "content": "Trace every possible reservation on a short array before writing code."
    },
    {
      "position": 2,
      "content": "Neighboring reservations share most of their values."
    },
    {
      "position": 3,
      "content": "Keep the sum of a fixed-width window while moving its right edge."
    },
    {
      "position": 4,
      "content": "Subtract the departing left value and add the arriving right value."
    },
    {
      "position": 5,
      "content": "Compute the first full window, initialize the best total to that value, and update the best after each shift."
    }
  ],
  "starterCode": [
    {
      "language": "JAVASCRIPT",
      "entryPoint": "relayWindow",
      "code": "function relayWindow(loads, width) {\n  // Write your solution here.\n  throw new Error(\"Not implemented\");\n}"
    }
  ],
  "testCases": [
    {
      "position": 1,
      "visibility": "VISIBLE",
      "input": {
        "loads": [
          3,
          1,
          5,
          2,
          6,
          1
        ],
        "width": 3
      },
      "output": 13,
      "explanation": "Slots with zero-based indices 2 through 4 contain 5, 2, and 6; their sum is 13."
    },
    {
      "position": 2,
      "visibility": "VISIBLE",
      "input": {
        "loads": [
          -4,
          -2,
          -7
        ],
        "width": 2
      },
      "output": -6,
      "explanation": "The two valid totals are -6 and -9. Choosing no slots is not allowed."
    },
    {
      "position": 3,
      "visibility": "HIDDEN",
      "input": {
        "loads": [
          -8
        ],
        "width": 1
      },
      "output": -8,
      "explanation": "A single negative load must still be selected."
    },
    {
      "position": 4,
      "visibility": "HIDDEN",
      "input": {
        "loads": [
          0,
          0,
          0
        ],
        "width": 2
      },
      "output": 0,
      "explanation": "Both reservations have zero load."
    },
    {
      "position": 5,
      "visibility": "HIDDEN",
      "input": {
        "loads": [
          9,
          1,
          2
        ],
        "width": 3
      },
      "output": 12,
      "explanation": "Only the complete array fits."
    },
    {
      "position": 6,
      "visibility": "HIDDEN",
      "input": {
        "loads": [
          4,
          2,
          9,
          1
        ],
        "width": 1
      },
      "output": 9,
      "explanation": "A one-slot reservation selects the largest element."
    }
  ],
  "solutions": [
    {
      "kind": "BRUTE_FORCE",
      "language": "JAVASCRIPT",
      "title": "Recount each reservation",
      "intuition": "Each possible start produces one valid reservation. Recomputing its total establishes a simple baseline.",
      "approach": "Try each starting index whose full window fits, sum its width entries, and keep the largest sum.",
      "pseudocode": "For each valid start: sum loads[start:start+width]; keep the maximum.",
      "code": "function relayWindow(loads, width) {\n    let best = -Infinity;\n    for (let start = 0; start + width <= loads.length; start++) {\n        let total = 0;\n        for (let i = start; i < start + width; i++)\n            total += loads[i];\n        best = Math.max(best, total);\n    }\n    return best;\n}",
      "timeComplexity": "O(n × width)",
      "spaceComplexity": "O(1)",
      "commonMistakes": [
        "Initializing the best total to zero fails when every valid sum is negative.",
        "Compare each full window, including the initial window and the last possible window."
      ],
      "interviewExplanation": "I first considered recomputing each reservation in O(n × width). Adjacent windows share width - 1 entries, so I maintain one running sum and update only the entering and leaving values. The algorithm takes linear time and constant extra space.",
      "steps": [
        {
          "position": 1,
          "title": "Step 1",
          "content": "Each possible start produces one valid reservation. Recomputing its total establishes a simple baseline."
        },
        {
          "position": 2,
          "title": "Step 2",
          "content": "Try each starting index whose full window fits, sum its width entries, and keep the largest sum."
        },
        {
          "position": 3,
          "title": "Step 3",
          "content": "After exploring every allowed candidate, return the best valid result under the statement’s rules."
        }
      ]
    },
    {
      "kind": "OPTIMAL",
      "language": "JAVASCRIPT",
      "title": "Move one window",
      "intuition": "Two adjacent windows differ in exactly two positions: one leaves and one enters.",
      "approach": "Sum the first width entries once. Shift the window by removing the outgoing value and adding the incoming value. Update the maximum after every shift.",
      "pseudocode": "window = sum(first width values); best = window; for each next value: window += entering - leaving; best = max(best, window).",
      "code": "function relayWindow(loads, width) {\n    let total = 0;\n    for (let i = 0; i < width; i++)\n        total += loads[i];\n    let best = total;\n    for (let i = width; i < loads.length; i++) {\n        total += loads[i] - loads[i - width];\n        best = Math.max(best, total);\n    }\n    return best;\n}",
      "timeComplexity": "O(n)",
      "spaceComplexity": "O(1)",
      "commonMistakes": [
        "Initializing the best total to zero fails when every valid sum is negative.",
        "Compare each full window, including the initial window and the last possible window."
      ],
      "interviewExplanation": "I first considered recomputing each reservation in O(n × width). Adjacent windows share width - 1 entries, so I maintain one running sum and update only the entering and leaving values. The algorithm takes linear time and constant extra space.",
      "steps": [
        {
          "position": 1,
          "title": "Step 1",
          "content": "The first three values total 9. Initialize both the current sum and best sum to 9."
        },
        {
          "position": 2,
          "title": "Step 2",
          "content": "Move once: subtract 3 and add 2 to obtain 8. Move again: subtract 1 and add 6 to obtain 13."
        },
        {
          "position": 3,
          "title": "Step 3",
          "content": "The last shift totals 9. The best value remains 13."
        }
      ]
    }
  ]
}
```

