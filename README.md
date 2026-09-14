# AlgoSprint

An original coding interview preparation platform built incrementally with Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, Prisma, Zod, and Supabase Auth.

## 🟩 Current milestone: Phase 5 — problem library

Phases 1–4 are merged. Phase 5 is implemented in [PR #6](https://github.com/zihadpcode/AlgoSprint/pull/6) adds the published-problem library with title search, difficulty/category/tag/pattern/time filters, sorting, pagination, and verified-viewer completion/review indicators.

Visit `/problems` after configuring PostgreSQL, applying migrations, and seeding. Browsing does not require a Supabase account. Without a database, the page shows an unavailable state. Personal filters require verified sign-in. Problem statements, guided solutions, and practice tools are Phase 6 onward; cards do not link to missing pages.

The user resumed after Phase 4 on 2026-09-14. Read [the handoff](docs/SESSION-HANDOFF.md) for validation and [the complete Phase 5 guide](docs/PHASE-5-GUIDE.md) for setup, full source, and explanations. The implementation passed CI: 45 unit/migration tests, nine PostgreSQL integration tests, lint, types, build, and both production HTTP checks. The handoff identifies the verified commit; the PR records the final follow-up checks.

The interactive coding workspace and browser are unavailable this session. Changes are saved directly on the isolated GitHub branch and tested in CI. Live Supabase configuration and browser interaction/visual checks remain unverified. Nothing has been deployed.

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
| `src/app/` | Landing, auth callback, account pages, protected dashboard/admin pages. |
| `src/components/layout/`, `src/components/ui/` | Shared workspace, navigation, native controls, and feedback states. |
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

## 🟥 Security model

Supabase owns passwords. The server verifies identity with `getUser()` and reads the role from the application database. Signup never accepts a role. Account cookies are HttpOnly and use Secure in production; there is no browser auth client. Protected data must be authorized in each server query/action, not just in a layout or navigation menu.

Tables live in private `app` with RLS and revoked untrusted-role access. The trusted Prisma owner can bypass RLS, so ownership checks remain essential. Select only public fields for browser responses; never bundle seed JSON, hidden tests, or internal submission results. Do not execute submitted code in the app server.

## 🟪 Road ahead

Phase 5 delivers library browsing. The next milestone is Phase 6 problem detail and guided hints/solutions, followed by guided practice pages, Monaco, safe execution, progress, analytics, notes, roadmaps, admin authoring, generators, interviews, and deployment. Content grows from 5 to 20 to 100 to 1,000 reviewed problems. All statements, hints, explanations, roadmap names, branding, and UI must be original.
