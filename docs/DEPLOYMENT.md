# AlgoSprint deployment guide

## 🟦 Release status

Phase 16 repository preparation is merged. The free Supabase project `wohoooueqlfrszqjuuck` (us-east-1) and Vercel Hobby project exist, their integration is connected, and the required Production variable names are present. On September 21 the production database was migrated and seeded from a trusted local checkout of `main` at `0b6fe6c` and verified through Supabase (see the release record). No Vercel deployment has yet been verified. [PR #17](https://github.com/zihadpcode/AlgoSprint/pull/17) records release validation and publication evidence. Do not present a successful local build as a deployed application.

Use the existing Next.js application and Prisma migrations. Do not create a second schema history with Supabase migration commands. The Supabase SDK handles authentication; trusted server code accesses PostgreSQL through Prisma's `pg` adapter. No Supabase service-role key is required by the application.

## 🟦 Choose the environment

Identify the intended Vercel team/project and Supabase organization/project before configuring anything. Reuse the correct project if one already exists. Confirm any new resource's plan and cost before purchasing it. Record project IDs, region and deployment URL in a private operations record; never record passwords or tokens in the repository.

Use separate Supabase projects for Preview and Production. Give the preview a stable origin for auth callbacks. Select nearby application/database regions when supported by the chosen plan. CI uses disposable PostgreSQL 17; its credentials and data must never be used for a live environment.

| Setting | Vercel web environment | Trusted migration/seed job | Exposure |
| --- | --- | --- | --- |
| `APP_URL` | Canonical HTTPS origin for this environment | Required by preflight | Server configuration |
| `NEXT_PUBLIC_SUPABASE_URL` | This environment's Supabase HTTPS origin | Required by preflight | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Matching `sb_publishable_…` key | Required by preflight | Public; never a secret key |
| `DATABASE_URL` | PostgreSQL runtime connection | Required by preflight | Private, includes password |
| `DIRECT_URL` | Omit | Migration/seed connection | Private, includes password |
| `CODE_RUNNER_ENABLED` | `false` initially | Not needed | Server flag |
| `JUDGE0_API_URL` | Only for an enabled runner | Not needed | Server configuration |
| `JUDGE0_API_KEY` | Only for an enabled runner | Not needed | Private provider credential |
| `JUDGE0_AUTH_MODE` | `token` or `rapidapi` when enabled | Not needed | Server configuration |
| `JUDGE0_JAVASCRIPT_LANGUAGE_ID` | Verified provider ID when enabled | Not needed | Server configuration |

Keep Preview and Production values scoped separately. Browser-public settings are embedded in a build, so changing them requires a new build. Do not promote an artifact built with preview auth settings into production. Build and verify a production-configured artifact for the production release.

## 🟩 Supabase database setup

1. Open the selected project's **Connect** panel. Copy its exact host, port and username. Percent-encode reserved characters in the password. For Vercel runtime connections use the transaction pooler; for migrations use direct connectivity, or the session pooler when the job has only IPv4. Do not run schema migrations through transaction pooling. [Connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres)
2. This project's production preflight requires exactly one `sslmode=verify-full` parameter; a format pass does not prove a TLS handshake. Supabase signs its Postgres endpoints with its own root CA, which Node's bundled trust store does not include. `prisma migrate deploy` completes its own handshake, but the runtime `pg` adapter used by the application and seeds fails with `self-signed certificate in certificate chain` unless that CA is trusted. `src/lib/db/connection.ts` therefore embeds the published Supabase Root 2021 CA (`src/lib/db/supabase-ca.ts`, SHA-256 `80:70:25:AD:…:E6:CA:FA`) and, only for `*.supabase.com`/`*.supabase.co` hosts with `verify-full`, passes it to `pg` alongside Node's default roots with full certificate and hostname verification. No `NODE_EXTRA_CA_CERTS` setting is needed on Vercel. Never resolve certificate errors by setting `NODE_TLS_REJECT_UNAUTHORIZED=0`, disabling SSL, or disabling certificate validation. If Supabase rotates its root, replace the embedded certificate from the dashboard's **Connect → SSL certificate** download and update the fingerprint test.
3. Check the database identity and existing migration history before writing. Back up existing valuable data. Inspect every pending SQL migration in `prisma/migrations`; Phase 16 adds none. Do not use `db push`, migration reset or a destructive re-seed to repair drift.
4. Keep the `app` schema out of Supabase's exposed Data API schemas. Existing migrations enable table RLS and revoke browser-role access. Prisma's trusted server connection relies on application authorization and can bypass those policies as the schema owner. Preserve owner checks in every loader and action; do not grant `anon` or `authenticated` access to make a server query work.
5. Configure the migration job's private values, then run the commands below from the verified release checkout. `DIRECT_URL` takes precedence for migrations and seeds; runtime code uses `DATABASE_URL`.

```bash
npm ci
npm run deploy:check -- --migrations
npm run db:validate
npm run db:deploy
npm run seed:validate
npm run db:seed
```

Prisma stores `_prisma_migrations` in the schema named by the URL's `schema` parameter, defaulting to `public`. The production database was migrated with no `schema` parameter, so its history lives in `public._prisma_migrations`; keep future `DIRECT_URL` values in that same form, because a URL with `schema=app` would make Prisma look for `app._prisma_migrations` and attempt to reapply everything.

Seeding writes the repository's curated content and roadmap definitions. Review existing-content conflicts before running it. Generated problem fixtures remain a separate reviewed draft workflow; do not publish them as part of deployment. Run seeds once in a trusted job, never on every Vercel build. Confirm migration history, published library data and roadmap reads afterward.

The current adapter allows up to five connections per application instance. Monitor aggregate connection usage under actual concurrency and tune against the project's available pool budget before increasing traffic. Verify transaction-pool compatibility against the installed adapter during live smoke testing; local PostgreSQL CI cannot prove provider pooling behavior.

## One-time setup using Vercel-held credentials

This job was not needed for the current production database, which was set up from a local checkout as recorded below; it refuses a non-empty `app` schema, so it cannot run against that database now. Note that it derives `DIRECT_URL` with `schema=app`, which places `_prisma_migrations` in `app` rather than `public`; keep later migration URLs consistent with whichever form created the history.

When the database is empty and credentials are held only as Vercel Production secrets, the reviewed `scripts/bootstrap-production.ts` can run once in the trusted production build worker. It is not part of `npm run build` or a public application endpoint.

Temporarily set the Vercel Build Command to `node --import tsx scripts/bootstrap-production.ts EXPECTED_PROJECT_REF && npm run build`, substituting the intended project reference. The job checks Production scope, matching auth/database project identity, the shared pooler address and verified TLS. It derives a session connection on port 5432 only for the child migration/seed processes; runtime DATABASE_URL stays on port 6543. No new credentials are created or disclosed.

The job takes an advisory lock and refuses to proceed if the app schema already contains objects. It runs the existing Prisma migration history and curated seeds, then verifies published problem and roadmap counts. It never resets the database or fabricates migration history. Raw command/database diagnostics are withheld from build logs to avoid leaking credentials. A failed or partial run needs inspection; do not reset or automatically rerun it.

Immediately restore the Build Command to `npm run build` after the setup attempt. Check migration history and RLS through Supabase, then finish the normal release checks. Do not use this first-time job for future migrations or repeat seeding.

## 🟩 Supabase authentication setup

Enable email/password authentication and email confirmations. Set **Site URL** to the environment's `APP_URL`; allow its exact `/auth/callback` URL. Use a separate preview project and exact preview callback. Keep localhost callbacks in development configuration. Avoid broad production wildcard redirects. [Redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls)

Check mail delivery configuration before inviting users. New Free projects using the default SMTP cannot customize confirmation templates; do not assume the dashboard permits an older guide's template workflow. Configure a suitable custom SMTP provider if customization or delivery requirements demand it, then test actual registration and confirmation. [Email template change](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier)

The app requests `${APP_URL}/auth/callback` during signup and exchanges the returned code using the browser's PKCE session. Open confirmation in the same browser that registered. Verify the configured email link reaches the callback successfully; do not invent a second callback route or expose an auth token to application logs.

After a real user signs in once, their application profile exists. Only then, if that specific person is intended to administer content, run the trusted role command with their verified UUID:

```bash
npm run user:role -- --user-id VERIFIED_USER_UUID --role ADMIN
```

The placeholder must be replaced with the actual intended user's UUID. Registration never grants admin privileges. Authorization reads the application role, not user-editable metadata. Confirm a normal account cannot open or invoke admin features.

## 🟩 Vercel setup

Import `zihadpcode/AlgoSprint` into the verified team. Select **Next.js**, repository root `.`, install command `npm ci`, build command `npm run build`, and the default Next.js output settings. `vercel.json` records the framework and install choices. The default Next.js build remains `npm run build`; the build command can be temporarily overridden for the explicit first-time setup job below. Set Node.js **24.x**, matching `.nvmrc` and `package.json`. [Supported Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

Do not deploy the project as a static export: accounts, server actions and Prisma require the server runtime. Keep migrations, seed commands and production credentials out of pull-request CI. The existing GitHub workflow validates code with its own disposable database; it does not deploy the app.

Before enabling automatic production deployment, finish production schema setup and environment configuration. If linking Git immediately creates a deployment, treat it as unverified until its configuration and live checks pass. Use the Vercel project's deployment controls to hold production changes until checks finish.

Create the preview with preview-scoped settings. Run `npm run deploy:check` with that environment loaded in a trusted job. Check build output without copying secret values. The preflight validates formats, selected TLS settings, possible browser-exposed credentials, runner configuration and Node version. It does not contact Supabase, validate project identity, prove delivery, inspect schema state, or replace a secret scanner.

Once preview checks pass, create a production-configured deployment from the same reviewed commit and verify it before directing users to it. Promotion reuses an artifact; it does not rebuild public environment values. Use production values at build time for a staged production artifact. [Promotion behavior](https://vercel.com/docs/deployments/promoting-a-deployment)

## 🟨 Required live verification

Record the date, commit, environment, account roles and actual results. Use disposable test accounts and original synthetic answers. Do not mark these complete from CI results.

- [ ] Landing, library filters, problem details, examples, constraints and roadmaps render from the live database.
- [ ] Registration, confirmation, login, refresh and logout work on the canonical origin; expired/invalid callbacks fail safely.
- [ ] Guest protected pages redirect. A normal user cannot access admin actions. Two test users cannot access each other's notes, bookmarks, progress or interview sessions by changing IDs.
- [ ] Save and reload a note, bookmark and manual progress update; verify dashboard, review queue and roadmap behavior. Manual completion remains distinct from a verified judged solve.
- [ ] Start an interview, explicitly save answers, reload, finish and read the report. Exercise expiry, a stale second tab, failed save and unsaved-text recovery. Scores are transparent self-assessments.
- [ ] With the runner disabled, execution fails clearly. Enable it only after verifying the independently operated provider, authentication and JavaScript language ID. Then verify public runs and hidden-case submission behavior using the Phase 8–9 checklists. User code must never execute on the web server.
- [ ] Complete the desktop/mobile, keyboard, zoom and capture checks in [SCREENSHOTS.md](SCREENSHOTS.md).
- [ ] Inspect runtime errors, auth failures, database connection pressure and relevant Supabase advisors after the test session. Resolve issues before inviting users.

Existing `npm run test:smoke` and `scripts/smoke-library.mjs` start local production servers for CI. They are not commands for probing an arbitrary deployed URL. Use the actual deployed browser flow for the checks above.

## 🟪 Release record and recovery

Fill in this record only from observed results:

| Field | Current evidence |
| --- | --- |
| Release commit / CI | See PR #17 for exact tested head and final merge |
| Vercel project / deployment URL | Project `algosprint` (team `zihadpcode-7061`); production domain https://algosprint-brown.vercel.app |
| Target / deployment status / build duration | Production deployments Ready for merge commits `21fb6e5` (PR #20) and `9df9791` (PR #21), about 1 minute each, plain `npm run build`, Node 24.x |
| Supabase project / migration result | `wohoooueqlfrszqjuuck` (AlgoSprint, us-east-1, Postgres 17.6). 2026-09-21: `prisma migrate deploy` applied `202609130001_foundation` and `202609160001_progress_verification` through the session pooler (5432); `prisma db seed` created 5 problems and 2 roadmaps. Verified via Supabase SQL: 22 `app` tables, all with RLS; `anon`/`authenticated` have no schema usage or table grants; 5 published problems, 2 published roadmaps, 5 roadmap steps, 30 test cases, 30 categories, 6 tags, 0 users. A repeat seed skipped 5/2. Runtime client read succeeded over the transaction pooler (6543) with `verify-full` and the embedded CA. 2026-09-21 (later): after PR #21 merged, `prisma db seed` from `main` at `9df9791` created 30 problems and skipped 5; the live library shows 35 published problems. |
| Auth, provider and browser checks | 2026-09-21: user verified registration, email confirmation, login and logout with two accounts on the production origin. Code runner remains disabled (no provider). Remaining checklist items above are still pending. |
| Production release time | Pending |

If a code release fails, restore the last known-good compatible Vercel deployment. A code rollback does not undo migrations or restore data. For a schema issue, assess compatibility and use a reviewed forward fix or an explicitly planned backup restoration; do not automatically reverse migrations. If a credential is exposed, rotate it at the provider, update scoped configuration and rebuild/redeploy as needed. Redact credentials and account data from diagnostics.

Phase 16 is complete only after live setup, deployment and the required verification are recorded. Repository preparation can be merged independently while those items remain clearly pending.
