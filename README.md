# AlgoSprint

An original coding interview preparation platform built incrementally with Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, Prisma, Zod, and Supabase Auth.

## 🟩 Current checkpoint: Phase 15 mock interviews

Phase 14 generators are merged in [PR #15](https://github.com/zihadpcode/AlgoSprint/pull/15). Phase 15 adds private timed mock interviews with difficulty/topic/style selection, random original questions, saved explanations, frozen references and transparent self-assessment reports. Open `/mock-interview` after signing in.

**170 unit/component/migration and 73 PostgreSQL integration tests pass (243 total).** [Implementation CI 35426555640](https://github.com/zihadpcode/AlgoSprint/actions/runs/35426555640) passed every step. [PR #16](https://github.com/zihadpcode/AlgoSprint/pull/16) records final documentation-head checks and merge state. Read [the complete Phase 15 guide](docs/PHASE-15-GUIDE.md), with all 17 changed source/script/test files, and [the session handoff](docs/SESSION-HANDOFF.md).

Sessions enforce server deadlines, owner-only access and stale-save protection. Scores are self-assessments, not correctness grades or verified solves; this mode does not execute response code. Save each answer explicitly. Late unsaved text remains available to copy. No deployment or production writes occurred; live authenticated/browser checks remain pending. Stop after Phase 15; Phase 16 polish/deployment is unstarted.

Phase 14's five reproducible generator templates and separate draft fixture workflow remain available through `npm run problems:check`; see [the generator guide](docs/PHASE-14-GUIDE.md).

## 🟩 Run locally

Use Node.js 24 and npm:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Preserve an existing configured `.env.local` instead of overwriting it. Open [localhost:3000](http://localhost:3000).

For accounts, configure `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `APP_URL`. Use a current `sb_publishable_` key. Follow [the Phase 3 setup guide](docs/PHASE-3-GUIDE.md) for Supabase email confirmations, redirect URLs, and admin provisioning. Keep all database passwords and private keys out of Git and chat.

```bash
npm run db:deploy
npm run db:seed
```

`DIRECT_URL`, if set, is used for migration/seeding instead of the runtime connection. `SHADOW_DATABASE_URL` is optional for creating future development migrations. Do not use migration resets on valuable data.

## 🟩 Verify

```bash
npm run db:validate
npm run seed:validate
npm run problems:check
npm test
npm run lint
npm run typecheck
npm run build
npm run test:smoke
```

`npm run test:integration` requires a dedicated empty PostgreSQL database whose name ends in `_test`; set `TEST_DATABASE_URL` to it and apply migrations there first. GitHub CI supplies PostgreSQL 17 and also runs `npm run test:smoke` against a temporary production server with accounts deliberately unconfigured. These checks do not prove live Supabase email delivery or authentication; use the manual checklist in the Phase 3 guide.

## 🟨 File map

| Path | Responsibility |
| --- | --- |
| `src/app/` | Landing, authentication, protected account pages, library and problem details. |
| `src/components/layout/`, `src/components/ui/` | Shared workspace, navigation, native controls, and feedback states. |
| `src/features/problems/` | Published queries, owned notes/progress, validation and server actions. |
| `src/features/interviews/`, `src/components/interviews/` | Private timed practice, original prompts, frozen snapshots and self-assessment reports. |
| `src/features/admin/`, `src/components/admin/` | Protected content queries/actions, structured authoring, revision conflicts, atomic imports and safe lifecycle controls. |
| `src/features/roadmaps/`, `src/components/roadmaps/` | Published learning paths, owner progress and deterministic next-step suggestions. |
| `scripts/generator/`, `src/data/seeds/generated/` | Original bounded template generators, trusted references and reviewed draft fixture workflow. |
| `src/data/seeds/roadmaps.ts`, `prisma/seed-roadmaps.ts` | Original path definitions and transactional, conflict-aware seed writes. |
| `src/features/saved/`, `src/components/saved/` | Private collections, bounded filters, pagination and saved-item controls. |
| `src/features/dashboard/` | Authenticated snapshot query, topic evidence and recommendation policy. |
| `src/components/dashboard/` | Summary cards, charts, topic signals, recommendations and recent submissions. |
| `src/features/progress/` | Transactional progress updates, owner-only summaries and provenance labels. |
| `src/features/submissions/` | Validated runner action, provider adapter, test harness, quotas and saved results. |
| `src/features/auth/` | Input validation, server actions, verified sessions, profile provisioning. |
| `src/lib/supabase/` | Request-scoped SSR clients, cookie refresh, trusted configuration. |
| `src/proxy.ts` | Refresh auth cookies before server rendering. |
| `src/lib/prisma.ts` | Lazy server-only database access. |
| `prisma/` | 22 models, SQL migration, repeatable insert-only seeding. |
| `src/data/seeds/` | Five original problem JSON files and taxonomy. |
| `scripts/` | Seed validation, trusted reference algorithms, role CLI, HTTP smoke check. |
| `tests/` | Algorithms, imports, PostgreSQL constraints, auth boundaries, integration. |
| `docs/PHASE-1-GUIDE.md` | Historical project foundation and complete source. |
| `docs/PHASE-2-GUIDE.md` | Database setup, design, tests, and complete source. |
| `docs/PHASE-3-GUIDE.md` | Auth setup, design, tests, and historical source. |
| `docs/AUTH-REVIEW.md` | Integrated authentication corrections and full updated files. |
| `docs/PHASE-4-GUIDE.md` | UI setup, full authored files, design choices, and verification limits. |
| `docs/PHASE-5-GUIDE.md` | Published library, query boundaries, full source, and testing. |
| `docs/PHASE-6-GUIDE.md` | Guided problem pages, private notes/progress, full source and testing. |
| `docs/PHASE-7-PART-1-GUIDE.md` | Historical first-half editor checkpoint. |
| `docs/PHASE-7-GUIDE.md` | Complete editor/reset/output workspace, full source and verification limits. |
| `docs/PHASE-8-GUIDE.md` | Isolated runner integration, complete source, configuration and live checks. |
| `docs/PHASE-9-GUIDE.md` | Progress state, migration/backfill, protected counts/activity and complete source. |
| `docs/PHASE-10-PART-1-GUIDE.md` | Historical halfway dashboard checkpoint. |
| `docs/PHASE-10-GUIDE.md` | Complete dashboard, evidence/ranking policy, full source and verification limits. |
| `docs/PHASE-11-GUIDE.md` | Private notes/bookmarks/review managers, complete source and verification limits. |

## 🟥 Security model

Supabase owns passwords. The server verifies identity with `getUser()` and reads the role from the application database. Signup never accepts a role. Account cookies are HttpOnly and use Secure in production; there is no browser auth client. Protected data must be authorized in each server query/action, not just in a layout or navigation menu.

Tables live in private `app` with RLS and revoked untrusted-role access. The trusted Prisma owner can bypass RLS, so ownership checks remain essential. Select only public fields for browser responses; never bundle seed JSON, hidden tests, or internal submission results. Do not execute submitted code in the app server.

## 🟪 Road ahead

Phase 9 is implemented and documented; live-provider/account/browser verification remains pending. Phase 10 is implemented and documented. Phase 11 is implemented and documented; the fixture failure is resolved. Phase 12 builds original roadmaps. Roadmaps, admin authoring, generators, interviews and deployment remain later phases. Reviewed original content grows from 5 to 20 to 100 to 1,000 problems.
