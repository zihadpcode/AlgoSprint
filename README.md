# AlgoSprint

An original coding interview preparation platform built incrementally with Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, Prisma, Zod, and Supabase Auth.

## 🟦 Session paused — 2026-09-14

The user paused feature work. Phases 1 and 2 are merged. Authentication is in open [PR #3](https://github.com/zihadpcode/AlgoSprint/pull/3); its review and production-crash fix are in open [PR #4](https://github.com/zihadpcode/AlgoSprint/pull/4). PR #4's implementation passed CI, including PostgreSQL integration and production HTTP checks. The branches have diverged and need reconciliation before merging. Partial Phase 4 work is saved separately in [draft PR #5](https://github.com/zihadpcode/AlgoSprint/pull/5). Live Supabase integration and deployment are pending.

See [the session handoff](docs/SESSION-HANDOFF.md) for exact commits, test evidence, pending work, and resume instructions. Do not resume automatically.

## 🟦 Current milestone: Phase 3 — authentication

Phase 1 provides the original dark landing page. Phase 2 adds 22 relational models, migrations, and five reviewed original problems. Phase 3 implements email/password registration, login, logout, session refresh, profile creation, protected dashboard/profile pages, and an admin access guard.

The account routes are implemented, but **a real Supabase project has not been configured or tested in this workspace**. Without configuration, login and registration show an unavailable state, protected routes redirect to login, and the public landing page continues to work. Problem browsing and practice are the next UI milestones.

Read [the current handoff](docs/SESSION-HANDOFF.md) before continuing and [the original brief](docs/PROJECT-BRIEF.md) for the full 16-phase requirements.

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
```

`npm run test:integration` requires a dedicated empty PostgreSQL database whose name ends in `_test`; set `TEST_DATABASE_URL` to it and apply migrations there first. GitHub CI supplies PostgreSQL 17 and also runs `npm run test:smoke` against a temporary production server with accounts deliberately unconfigured. These checks do not prove live Supabase email delivery or authentication; use the manual checklist in the Phase 3 guide.

## 🟨 File map

| Path | Responsibility |
| --- | --- |
| `src/app/` | Landing, auth callback, account pages, protected dashboard/admin pages. |
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
| `docs/PHASE-3-GUIDE.md` | Auth setup, design, tests, and complete source. |

## 🟥 Security model

Supabase owns passwords. The server verifies identity with `getUser()` and reads the role from the application database. Signup never accepts a role. Account cookies are HttpOnly and use Secure in production; there is no browser auth client. Protected data must be authorized in each server query/action, not just in a layout or navigation menu.

Tables live in private `app` with RLS and revoked untrusted-role access. The trusted Prisma owner can bypass RLS, so ownership checks remain essential. Select only public fields for browser responses; never bundle seed JSON, hidden tests, or internal submission results. Do not execute submitted code in the app server.

## 🟪 Road ahead

Next are the shared app shell, searchable problem library, guided practice pages, Monaco, safe execution, progress, analytics, notes, roadmaps, admin authoring, generators, interviews, and deployment. Content grows from 5 to 20 to 100 to 1,000 reviewed problems. All statements, hints, explanations, roadmap names, branding, and UI must be original.
