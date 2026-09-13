# AlgoSprint

An original coding interview preparation platform built with Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, Prisma, and Zod.

## 🟦 Session paused — Phase 2 checkpoint

Work is paused at the user’s request. Phase 1 is merged; [Phase 2 is saved in PR #2](https://github.com/zihadpcode/AlgoSprint/pull/2) with passing implementation CI. Authentication has not been implemented. Read [the session handoff](docs/SESSION-HANDOFF.md) before resuming and [the original brief](docs/PROJECT-BRIEF.md) for the full requirements.

## 🟦 Current milestone: Phase 2

Phase 1 supplies the original dark landing page. Phase 2 adds the database foundation: 22 related models, a versioned PostgreSQL migration, private data access, validated taxonomy, and five original JavaScript coding problems. Accounts and interactive problem pages begin in the next phases. The landing page works without credentials.

## 🟩 Run locally

Use Node.js 24 and npm. From the repository root:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Keep an existing configured `.env.local` instead of overwriting it. Open [localhost:3000](http://localhost:3000).

To enable the database, set `DATABASE_URL` in `.env.local` using a development PostgreSQL database you control. For Supabase, use the appropriate URL from **Connect** and follow [the Phase 2 guide](docs/PHASE-2-GUIDE.md). If migrations require a different connection, set `DIRECT_URL` as well.

```bash
npm run db:deploy
npm run db:seed
```

`db:deploy` applies committed migrations. `db:migrate` creates future development migrations and may require a separate shadow database. Do not use development migration resets against a database containing valuable data.

## 🟩 Validate

```bash
npm run db:validate
npm run seed:validate
npm test
npm run lint
npm run typecheck
npm run build
```

The unit suite includes embedded PostgreSQL migration checks and differential algorithm tests. Real Prisma integration tests run separately against a **dedicated empty database whose name ends in `_test`**:

```bash
# Set DATABASE_URL and TEST_DATABASE_URL to the same disposable test database.
# Leave DIRECT_URL unset or point it at that same test database.
npm run db:deploy
npm run test:integration
```

GitHub Actions supplies its own disposable PostgreSQL service and runs these checks. Check the PR's actual Actions result before treating integration as verified.

## 🟨 File map

| Path | Purpose |
| --- | --- |
| `src/app/`, `src/components/` | Next.js pages and original UI. |
| `prisma/schema.prisma` | Relational models, enums, indexes, and deletion behavior. |
| `prisma/migrations/` | Committed schema, integrity constraints, and RLS. |
| `prisma.config.ts` | Prisma 7 connection and CLI configuration. |
| `src/lib/prisma.ts` | Lazy server-only database entry point. |
| `src/data/seeds/` | Original problem JSON and taxonomy. |
| `src/lib/validators/problem.ts` | Strict import contract. |
| `scripts/lib/reference-problems.ts` | Trusted validators for expected outputs. |
| `prisma/seed-data.ts` | Bounded, repeatable, insert-only seeding. |
| `tests/` | Validation, algorithms, migration, and integration checks. |
| `docs/PHASE-1-GUIDE.md` | Historical foundation walkthrough and source. |
| `docs/PHASE-2-GUIDE.md` | Database walkthrough, commands, source, and pitfalls. |

## 🟥 Data boundaries

- Secrets belong in ignored `.env.local`; `.env.example` contains names only.
- Only browser-safe Supabase configuration will use `NEXT_PUBLIC_`.
- Database tables live in private `app`, with RLS and no grants to `PUBLIC`, `anon`, or `authenticated`.
- The trusted Prisma connection owns this schema and can bypass RLS. Every future user-facing read and write must enforce identity and ownership on the server.
- Hidden test cases are internal database content. Never serialize an entire problem record into client props or APIs.
- Seed code strings are stored as content. They are never executed by the importer. Trusted, allowlisted algorithms validate fixtures.
- Re-running the same seed preserves IDs and progress. A changed existing slug is rejected instead of silently replacing content.

## 🟪 Growth plan

Proceed through authentication, the app shell, problem browsing, guided solutions, the editor, safe execution, progress, analytics, roadmaps, admin tools, and interviews. Deployment is a later milestone. The content target grows from 5 to 20 to 100 and eventually 1,000 reviewed problems.

All AlgoSprint statements, hints, explanations, roadmap names, branding, and UI must be original. General algorithmic concepts are shared knowledge; other platforms' written content and designs are not source material.
