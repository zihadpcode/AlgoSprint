# AlgoSprint

An original coding interview preparation platform built incrementally with Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, Prisma, Zod, and Supabase Auth.

## 🟨 Current checkpoint: Phase 11 paused and unfinished

Phase 10 is merged in [PR #11](https://github.com/zihadpcode/AlgoSprint/pull/11), with all 152 tests and CI checks passing. It remains the completed milestone on main.

Phase 11 is saved in [draft PR #12](https://github.com/zihadpcode/AlgoSprint/pull/12), branch `algosprint/phase-11-notes-bookmarks`. Implemented so far: private notes/bookmarks/review pages, title search and pagination, bookmark/review controls, inline note editing/deletion, saved-content conflict checks and navigation/revalidation updates.

**Paused at the user's request; do not merge.** CI passed 123 unit/component/migration tests and 38 existing PostgreSQL integration tests. The new integration suite failed during fixture creation because publishedAt was omitted for PUBLISHED test problems; six new tests were skipped. Fix and verify on resume. Earlier local lint/types/build and protected HTTP checks passed; this is not a completed Phase 11 release.

Read [the paused guide with all 25 complete source/test files](docs/PHASE-11-GUIDE.md) and [the session handoff](docs/SESSION-HANDOFF.md). No schema/dependency/seed-content changes or deployment occurred. Live account/provider/browser checks remain pending.

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
| `src/features/saved/`, `src/components/saved/` | Draft Phase 11 private collections, filters and controls. |
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
| `docs/PHASE-11-GUIDE.md` | Paused implementation, all source files, known fixture failure and resume steps. |

## 🟥 Security model

Supabase owns passwords. The server verifies identity with `getUser()` and reads the role from the application database. Signup never accepts a role. Account cookies are HttpOnly and use Secure in production; there is no browser auth client. Protected data must be authorized in each server query/action, not just in a layout or navigation menu.

Tables live in private `app` with RLS and revoked untrusted-role access. The trusted Prisma owner can bypass RLS, so ownership checks remain essential. Select only public fields for browser responses; never bundle seed JSON, hidden tests, or internal submission results. Do not execute submitted code in the app server.

## 🟪 Road ahead

Phase 9 is implemented and documented; live-provider/account/browser verification remains pending. Phase 10 is implemented and documented. Phase 11 is paused with its integration fixture failure documented; finish and verify it on resume. Roadmaps, admin authoring, generators, interviews and deployment remain later phases. Reviewed original content grows from 5 to 20 to 100 to 1,000 problems.
