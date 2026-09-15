# AlgoSprint

An original coding interview preparation platform built incrementally with Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, Prisma, Zod, and Supabase Auth.

## 🟩 Current checkpoint: Phase 7 first half — paused

Phases 1–6 are merged into `main`. The requested first half of Phase 7 is saved separately in [draft PR #8](https://github.com/zihadpcode/AlgoSprint/pull/8), branch `algosprint/phase-7-editor-part-1`. The PR stays open at this pause; main remains the Phase 6 baseline.

This checkpoint adds Monaco editing, selection among a problem's supplied languages, and starter-code loading. Small in-memory drafts preserve code when switching languages, including deliberately empty code. Refreshing or leaving discards drafts. Reset controls and output/test-results panels are deferred to the second half; execution is Phase 8.

Read [the complete first-half guide](docs/PHASE-7-PART-1-GUIDE.md) for all nine authored files, dependency/setup commands, design explanations and browser checks. The generated lockfile is committed alongside the source. [The handoff](docs/SESSION-HANDOFF.md) and PR #8 identify validation and the exact pause boundary.

Local 63 tests, lint, TypeScript, production build and unconfigured HTTP smoke passed. Implementation [CI passed](https://github.com/zihadpcode/AlgoSprint/actions/runs/35006464039), including all 80 tests and seeded production HTTP routes. Actual Monaco/browser/worker behavior and live Supabase checks remain pending. Nothing is deployed.

To run this checkpoint, check out `algosprint/phase-7-editor-part-1` before the commands below. To run the last fully merged phase, use `main` and the [Phase 6 guide](docs/PHASE-6-GUIDE.md).

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
| `docs/PHASE-7-PART-1-GUIDE.md` | Paused editor checkpoint, full authored files and validation limits. |

## 🟥 Security model

Supabase owns passwords. The server verifies identity with `getUser()` and reads the role from the application database. Signup never accepts a role. Account cookies are HttpOnly and use Secure in production; there is no browser auth client. Protected data must be authorized in each server query/action, not just in a layout or navigation menu.

Tables live in private `app` with RLS and revoked untrusted-role access. The trusted Prisma owner can bypass RLS, so ownership checks remain essential. Select only public fields for browser responses; never bundle seed JSON, hidden tests, or internal submission results. Do not execute submitted code in the app server.

## 🟪 Road ahead

Resume with the second half of Phase 7 only when requested: reset controls and output/test-results panels. Phase 8 introduces isolated execution, followed by richer progress, analytics, notes/bookmarks management, roadmaps, admin authoring, generators, interviews and deployment. Reviewed original content grows from 5 to 20 to 100 to 1,000 problems.
