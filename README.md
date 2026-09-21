# AlgoSprint

An original coding interview preparation platform built incrementally with Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, Prisma, Zod, and Supabase Auth.

## 🟩 Current checkpoint: Phase 16 release preparation

Phases 1–15 are merged, including private timed interviews in [PR #16](https://github.com/zihadpcode/AlgoSprint/pull/16). Phase 16 polishes the landing page, mobile form sizing, guarded loading and error recovery, adds deployment configuration checks and prepares the release documentation in [PR #17](https://github.com/zihadpcode/AlgoSprint/pull/17).

**176 unit/component/migration and 73 PostgreSQL integration tests pass (249 total).** [Implementation CI 35461544519](https://github.com/zihadpcode/AlgoSprint/actions/runs/35461544519) passed every gate. PR #17 records final-head validation and merge evidence. Read [the complete Phase 16 source guide](docs/PHASE-16-GUIDE.md) and [the session handoff](docs/SESSION-HANDOFF.md).

Live Supabase/Vercel setup, deployment, authenticated/provider verification and browser captures remain pending. Both plugins are connected, but their account tools were not exposed in the working session. No live URL or production readiness is claimed. Follow [the deployment guide](docs/DEPLOYMENT.md), [screenshot checklist](docs/SCREENSHOTS.md) and [portfolio copy](docs/PORTFOLIO.md).

Mock interview scores remain self-assessments, not correctness grades or verified solves. Save answers explicitly; the interview mode does not execute response code. Visible tests run in the learner's browser and save nothing; verified submissions need the optional external coding runner, which has a separate configuration and verification checklist. Phase 14 generators remain a reviewed draft workflow; see [the generator guide](docs/PHASE-14-GUIDE.md).

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
| `src/data/seeds/` | 35 original problem JSON files and taxonomy; see [the problem library guide](docs/PROBLEM-LIBRARY.md). |
| `scripts/` | Seed validation, trusted reference algorithms for every published problem, role CLI, HTTP smoke check. |
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
