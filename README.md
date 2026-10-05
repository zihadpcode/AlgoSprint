# AlgoSprint

An original coding interview preparation platform built incrementally with Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, Prisma, Zod, and Supabase Auth.

## 🟩 Current checkpoint: deployed MVP, reliability and release verification

Phases 1–16 are implemented. [AlgoSprint is deployed on Vercel](https://algosprint-brown.vercel.app) with Supabase Auth/PostgreSQL, 74 original JavaScript problem fixtures in the repository, two learning paths, private notes and saved practice, progress dashboards, content administration, reviewed draft generators and timed mock interviews. The production library still showed 35 problems on October 5; merged fixtures require a separate seed run. The September follow-ups enabled browser example execution, verified QuickJS submissions and progress undo, and protected Prisma migration history.

The consent-fix checkpoint at `09458a2`, tested with the 74-problem library, passed **402 unit/component/migration and 77 PostgreSQL integration tests (479 total)** in [GitHub CI 37286786463](https://github.com/zihadpcode/AlgoSprint/actions/runs/37286786463). Browser worker output bounds, aligned runnable authoring limits, password recovery/confirmation resend and opt-in device draft recovery are implemented. See [the reliability guide](docs/RELIABILITY-GUIDE.md) for validation and remaining live checks, and [the session handoff](docs/SESSION-HANDOFF.md) for project history.

Registration, confirmation, login/logout, saved-practice flows and accepted/failing sandbox submissions have recorded production evidence. Release acceptance remains incomplete: two-user isolation, refreshed/invalid auth sessions, interview expiry and conflicting saves, progress undo, mobile/keyboard/accessibility checks, screenshots and Vercel runtime logs still need live verification. Follow [the deployment record](docs/DEPLOYMENT.md), [screenshot checklist](docs/SCREENSHOTS.md) and [portfolio copy](docs/PORTFOLIO.md).

Mock interview scores remain self-assessments, not correctness grades or verified solves. Save answers explicitly; the interview mode does not execute response code. Visible tests run in the learner's browser and save nothing; verified submissions run either in the in-process WebAssembly sandbox (`CODE_RUNNER_PROVIDER=sandbox`) or through an external Judge0 provider; both have a configuration and verification checklist. Phase 14 generators remain a reviewed draft workflow; see [the generator guide](docs/PHASE-14-GUIDE.md).

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
| `src/data/seeds/` | 74 original problem JSON files and taxonomy; see [the problem library guide](docs/PROBLEM-LIBRARY.md). |
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

Tables live in private `app` with RLS and revoked untrusted-role access. The trusted Prisma owner can bypass RLS, so ownership checks remain essential. Select only public fields for browser responses; never bundle seed JSON, hidden tests, or internal submission results. Submitted code runs either in an external Judge0 service or in the approved QuickJS WebAssembly interpreter hosted in a server worker thread. QuickJS exposes no Node, filesystem or network access and enforces interpreter memory and execution budgets. Never evaluate submitted code directly in the application JavaScript context. Visible example runs use a worker in the learner's browser, save nothing and do not verify progress.

## 🟪 Road ahead

Complete the remaining live release checks (including password-recovery email and device-draft recovery), seed the 39 problems added since the last production seed, expand learning paths across the library, and continue the reviewed library expansion toward 100 problems. Measure submission concurrency and dashboard queries before larger expansion. JavaScript is the current execution language; additional languages, dynamic runnable authoring and 1,000 problems are later work. See [the reliability guide](docs/RELIABILITY-GUIDE.md) for completion criteria.
