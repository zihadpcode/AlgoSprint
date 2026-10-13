# Reliability and release verification

## October 13 recovery and editor checkpoint

The owner verified a fresh password reset and subsequent login with the new password after Supabase's Site URL and exact canonical callback allowlist entry were corrected. This is owner-verified live recovery; Codex did not read or enter the password. [ACCOUNT-RECOVERY.md](ACCOUNT-RECOVERY.md) records the configuration correction, installed-SDK regression checks and remaining expired/reused-link, resend and old-password checks. [PR54](https://github.com/zihadpcode/AlgoSprint/pull/54) also preserves the failed-callback alert when a browser already has a signed-in session.

[PR58](https://github.com/zihadpcode/AlgoSprint/pull/58), reviewed at `a0b51a6` and merged as `218e998`, upgrades Monaco from 0.56.0 to 0.57.0. Exact-head [CI38441101959](https://github.com/zihadpcode/AlgoSprint/actions/runs/38441101959) passed the full validation pipeline, including 83 PostgreSQL integration tests, production build, sandbox trace and both HTTP smoke suites. Independent local checks passed 33 focused editor/runner tests, lint, build/type checking and the 210-file sandbox trace. Actual Chrome checks passed editing, undo/redo, language switching with draft retention, public examples, reset cancel/confirm and keyboard exit; the observed worker asset, absence of captured warnings/errors and temporary local fixture cleanup are recorded in [SCREENSHOTS.md](SCREENSHOTS.md).

A live production check on `218e998` also passed 2/2 Canopy Layers public examples in Chrome with no captured browser warnings/errors. The browser already had a signed-in session, device recovery remained off and no account data was saved; this does not complete authenticated ownership or draft-recovery acceptance. [Production capture](screenshots/2026-10-13-monaco057-production-run.jpg).

The Vercel CLI confirmed production deployment `dpl_2FhL8tboPcAh57qtrAz8JVkUArBC` Ready at the canonical domain; GitHub's success status on merge `218e998` identifies the same deployment. The dependency change reduces Monaco/DOMPurify audit severity, but leaves two low package findings and four high Prisma-tooling package findings. [SECURITY-REVIEW.md](SECURITY-REVIEW.md) records the residual advisories and limits; the upgrade does not establish a clean audit or a trusted browser sandbox.

## October 13 path publication

The three new paths from merged [PR56](https://github.com/zihadpcode/AlgoSprint/pull/56), exact source `b680f58f0075e56e5610e545a6f98444cb9a5c93`, are published: Intervals and Sweeps (5 steps, 215 minutes), Greedy Choices (4, 160) and Heaps and Streams (4, 195, Hard). The earlier 100 problems and 15 path definitions remain unchanged. Production now contains 18 published paths and 307 steps covering all 100 published problems.

The normal repository-client seed stopped during its first read-only preflight with a closed connection; bounded retries on both pooler connections did not succeed, and no seed write occurred. The authenticated Supabase SQL connector remained available. Root used a one-off insert-only SQL transaction generated from the exact merged source and the approved October 12 snapshot, after independent review and real PostgreSQL 17 tests of first insertion, unchanged repeat, UUID/hash/path/step drift rejection and rollback of earlier inserts on a third-path conflict. The reviewed SQL SHA-256 was `cbd0cca85a8b00fa9adf43aace702a466cfda4ec1760b5f301c462e422dfbf8a`.

That fallback used the seed's advisory lock, bounded content-table locks and transaction-local timeouts. It checked all 100 existing problem IDs/statuses/source hashes and all 15 existing path IDs/metadata/ordered steps before inserts, rejected unreviewed roadmap triggers/rules, and compared full preexisting rows before/after. It inserted only three path headers and 13 steps. Independent post-seed comparison matched every prior snapshot row and all three new source definitions. A second execution left the recorded 100/18/307 snapshot unchanged. No migration, reset, update/delete, account write, privilege change or TLS bypass was performed.

Live guest HTTP checks found all 18 unique path links across pages of 12 and six, correct out-of-range pagination, no-store responses, and the three new detail pages with exact ordered problem links, step counts and estimates. The heap path renders Hard; guest responses exclude seed hashes, hidden-test fields and verified progress revisions.

## October 12 checkpoint

The October 1 starting point was `5efe69d`, with [green CI](https://github.com/zihadpcode/AlgoSprint/actions/runs/36171027927), 231 unit/component/migration tests and 76 PostgreSQL integration tests. Main has since merged account recovery, draft recovery, worker/runner hardening, the consent correction, reviewed library expansion and broader learning paths through `1c0d07a`. The repository now has 100 original problem fixtures, 18 learning paths and 46 noncoding interview prompts; the [production library](https://algosprint-brown.vercel.app/problems) has all 100 published problems and 18 paths as verified through October 13 after explicit insert-only seeding. Code deployment does not seed content.

The shared review's execution hardening and publishing clarification are implemented. [Account recovery](ACCOUNT-RECOVERY.md) and [opt-in draft protection](DRAFT-RECOVERY.md) are integrated. Merged [PR39](https://github.com/zihadpcode/AlgoSprint/pull/39) fixes consent retention when a draft component changes scope in place. Codex and Claude reviewed the content in parallel. The final batch preserves the preceding 87 problem fixtures and 12 paths; a new Capstone Mix path covers the last 13 problems. Reviewed source, merged code, deployed code and seeded production rows are separate checkpoints.

## Browser output bounds

Visible examples execute in a new browser worker for each case. They send no submitted source to the server, save no attempt and never establish a verified solve. The worker has a three-second per-case timeout imposed by its parent.

Previously, diagnostics accumulated as an unbounded array and the complete logs and return value were transferred to the page before display truncation. The revised worker:

- Accumulates at most 4,000 diagnostic characters; later logging stops inspecting values once the buffer fills. A truncation marker fits inside this bound.
- Serializes object diagnostics within the remaining budget, with a placeholder for oversized or unserializable values.
- Stops result serialization when string/key traversal or node counts exceed a 90,000-character budget, and checks the final JSON length to account for escaping.
- Rejects oversized return values with a runtime error and no result payload. Complete permitted JSON is compared structurally before the separate 4,000-character display truncation.
- Rejects malformed worker envelopes, oversized fields and non-finite/negative runtime values, and terminates the worker after a terminal result.

These limits bound the runner's retained diagnostic text, serialization traversal and ordinary result transfer. A browser worker cannot enforce an interpreter memory quota on arbitrary learner JavaScript: user code can still allocate large values or deliberately call worker APIs. Browser practice remains local feedback, not a trusted security sandbox or correctness grade.

Regression tests execute the real worker source, checking a million-character result, repeated logs, array size, `toJSON`, escaped strings, boundary-size JSON, cyclic output and malformed worker envelopes. Real Chromium also exercised the revised source: repeated logging transferred exactly 4,000 diagnostic characters; a million-character result returned `output-limit` with an empty result; a 5,002-character JSON result remained intact.

## Runnable publication contract

Executable JavaScript problems require a reviewed registry entry and trusted reference semantics. Adding arbitrary starter code or publishing a new slug does not install runner support.

The shared browser-safe runner limits are ten test cases, 2,000 ms per case, 262,144 KB per case and a 20-second total submission budget. Sandbox, Judge0 and submission reservation code consume these constants. Sandbox executes cases sequentially; its total budget is shared across them. Judge0 submits a batch and applies the overall request deadline. These are maximum budgets, not a promise that every case receives its maximum simultaneously.

Admin validation checks registered slugs on create, edit and import before content writes. Registered problems require a JavaScript starter, supported case count, time and memory limits, a matching entry point and reviewed input/output semantics. Study-only custom content retains the general authoring schema's larger limits. Admin help identifies which contract applies before saving. Existing deployed rows retain defensive provider clamps; this change does not rewrite database content.

## Verification record

Validation is tied to the recorded checkout or exact PR head:

- The 100-problem main checkpoint `a59b344` passed 455 unit/component/migration tests and 77 PostgreSQL 17 integration tests in [CI37407240434](https://github.com/zihadpcode/AlgoSprint/actions/runs/37407240434), including production build, trace and seeded HTTP smoke. PR45 landed the final content on main after PR44 had merged into the interview-bank branch; the roadmap smoke now traverses multiple pages.
- Independent final-batch review compared each of 13 trusted references against its baseline on 2,000 samples. All authored optimal solutions passed seeded cases and separate large/adversarial QuickJS probes. The final library has 25 easy, 50 medium and 25 hard problems, covered by 13 paths with 144 total steps.
- [PR46](https://github.com/zihadpcode/AlgoSprint/pull/46), reviewed at `a8fde3d` and merged as `2f95ec7`, corrects tree encoding bounds and space estimates, gives fixed-alphabet union-find its actual linear bound, and derives the puzzle baseline from grid coordinates independently of the optimal move table. Its exhaustive test covers all 720 arrangements (360 reachable, longest distance 21). [CI38335408899](https://github.com/zihadpcode/AlgoSprint/actions/runs/38335408899) passed 456 unit/component/migration tests and 77 PostgreSQL integration tests, plus lint, typecheck, production build, trace and both HTTP smokes.
- Roadmap HTTP smoke now checks rendered links and redirects against independently queried eligible rows. A 24-public-path fixture makes an unexpected extra private path cross into a new page; injected wrong-clamp, extra-page and extra-card failures were all detected. The full local production-build smoke passed and cleaned its fixtures.
- The 74-problem content head `ed6f93e` passed 400 unit/component/migration tests and 77 PostgreSQL 17 integration tests in [CI36959141124](https://github.com/zihadpcode/AlgoSprint/actions/runs/36959141124), along with lint, TypeScript, seed/generator checks, production build, sandbox trace, unconfigured-account HTTP smoke and seeded library/roadmap HTTP smoke.
- Independent review ran 2,000 baseline comparisons per new batch-three reference and actual QuickJS probes of every new optimal solution at large or maximum dimensions. All 13 passed. Existing fixtures were preserved by that batch. The 64 KB fixture-input cap still limits simultaneous maximum dimensions and value widths.
- On October 5, the two added scope-consent regressions failed on `280c764` before the fix. The locally fixed checkout passed 376 unit/component tests, lint, TypeScript and production build. Claude independently reviewed the keyed-remount fix and found no blocker; PR39 merged as `e3e7ed3`; its exact-head [CI37286786463](https://github.com/zihadpcode/AlgoSprint/actions/runs/37286786463), tested with the 74-problem base, passed 402 unit/component tests, 77 PostgreSQL integration tests and the full build/trace/smoke pipeline.
- Production guest library returned HTTP 200; browser example execution passed 2/2 on Relay Window with an original synthetic solution, saving nothing. [Guest screenshots and viewport evidence](SCREENSHOTS.md) are recorded separately.
- On October 5, the Vercel connector could list AlgoSprint project metadata, but production deployment listing and runtime-error queries returned HTTP 403. No runtime-log inspection is claimed.
- On October 5, production preflight through the repository database client used verified TLS and found all 35 existing problem hashes and both existing path definitions unchanged, with no seed conflicts. The repository already trusts the official Supabase CA; no TLS override or database configuration change was needed.
- On October 5, Supabase advisors reported the expected default-deny RLS tables without policies, one existing warning for disabled leaked-password protection, and informational unused indexes. The app accesses its private schema through trusted Prisma code and authorizes every account query. Do not remove indexes solely because this small deployment has not used them. [Password-protection configuration](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains a provider setting to review.

On October 12, interactive Claude restored the auto-paused Supabase project. During startup, Supabase reported `COMING_UP` and `/problems` returned HTTP 500; after `ACTIVE_HEALTHY`, public pages returned HTTP 200. A verified repository-client preflight found all 35 existing problem hashes and both path definitions matching source. Codex then seeded the exact merged `2f95ec708d4c9f5a4ccdbbbbe0dfee9893950813` checkout: 65 problems and 11 paths created, 35 problems and two paths skipped. A second run created nothing and skipped all 100 problems and 13 paths. Post-seed reads verified every source hash and path definition, all original IDs and content unchanged, and 144 steps covering all 100 problems. No migration, database configuration change or TLS bypass was needed.

After [PR50](https://github.com/zihadpcode/AlgoSprint/pull/50) merged, Codex seeded its exact merged checkout `657703b06d8076f3cd7db0cefd773b029cd5152b`: zero problem additions and two path additions, skipping the existing 100 problems and 13 paths. A second run skipped 100/15. All prior 100 problem rows and 13 path definitions remained unchanged. At that October 12 checkpoint, production had 15 paths and 294 total steps covering all 100 problems. Both new plan pages returned HTTP 200 with exactly 60 and 90 rendered day headings.

Live guest HTTP checks found exactly 100 unique problem links across nine pages and 15 unique path links across two pages, with correct out-of-range redirects and no-store headers. Seven corrected/new problem detail pages returned HTTP 200 without seed hashes or hidden-test fields. Forged role cookies still redirected dashboard, admin, notes and mock-interview guests to login. In Chrome, an original Canopy Layers solution passed both public examples through the live Monaco editor and browser worker, saving nothing; roadmap page two was reachable with keyboard activation. [The capture](screenshots/2026-10-12-canopy-layers-guest-run.jpg) records the passing guest run. These are guest checks, not authenticated acceptance.

The authenticated Vercel CLI independently confirmed a READY production deployment for `2f95ec7` (`algosprint-ekqmu6j55-zihadpcode-7061.vercel.app`). Its bounded production-error query for the following ten-minute window returned zero entries. Earlier logs contained four Prisma P2028 transaction-start errors during the restoration window; that timing does not establish connection exhaustion or justify changing pool settings. The connector's earlier HTTP 403 did not prevent CLI log access.

[PR49](https://github.com/zihadpcode/AlgoSprint/pull/49) adds owner-scoped UTC practice streaks, published-topic solve counts and the latest five completed interview self-assessments. Its exact-head [CI38336160156](https://github.com/zihadpcode/AlgoSprint/actions/runs/38336160156) passed 462 unit/component/migration and 81 integration tests; independent policy, rendering and load tests passed 20/20. The signed-in production view remains pending.

[PR47](https://github.com/zihadpcode/AlgoSprint/pull/47) adds a best-effort scheduled health check. Its first manual [run38337334114](https://github.com/zihadpcode/AlgoSprint/actions/runs/38337334114), on merged `1c0d07a`, passed all four public page checks; the optional direct Supabase check was skipped because its public repository variables were unset. Scheduling and GET activity do not guarantee prevention of future pauses. The Vercel CLI confirmed READY production deployment `algosprint-1w3j0ane5-zihadpcode-7061.vercel.app` at `1c0d07a`.

Fresh October 12 Supabase advisors found no ERROR notices: 23 expected default-deny RLS/no-policy INFO findings (22 app tables and migration history), one existing disabled [leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), and 13 [unused-index INFO findings](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). No schema or configuration changes followed these observations.

The merged `1c0d07a` checkpoint passed 463 unit/component/migration and 81 integration tests plus the full build/trace/seeded HTTP pipeline in [CI38337236176](https://github.com/zihadpcode/AlgoSprint/actions/runs/38337236176).

A later bounded ten-minute production log query returned three pg concurrent-query deprecation warnings recorded at error level, without additional P2028 transaction-start errors in that result. The existing pg 8 adapter also emitted the same notice during integration tests; no test failed. A dependency upgrade requires a separate compatibility review. No database reset or production migration was performed; the explicit content seed is recorded above.

## Remaining release work

| Work | Completion criterion |
| --- | --- |
| Authenticated production acceptance | Two real disposable accounts verify owner isolation, ordinary-user admin denial, refreshed/expired sessions, invalid callbacks and progress undo on the deployed commit. |
| Interview acceptance | Save/reload/finish, server expiry, stale second tab, interrupted save and local recovery all behave correctly on the deployed application. |
| Account recovery | Fresh reset and new-password login are owner-verified on October 13. Old-password rejection, signup-confirmation resend and live expired/reused-link/provider-limit cases remain open. |
| Draft protection | Opt-in, owner/revision-scoped recovery never overwrites server saves; logout/account changes and expiration remove stored private drafts. |
| Content expansion | The reviewed 100-problem / 18-path checkpoint is seeded and verified through October 13. Require the same trusted references, QuickJS checks and conflict-aware seed process for later expansion. |
| Operations | CLI runtime logs and restoration are recorded above. Advisors were refreshed; measure submission/database/query behavior before claiming scale; scheduled health checks provide best-effort monitoring. |
| Interface acceptance | Finish authenticated screenshots, keyboard, zoom, screen reader and actual mobile-browser checks in SCREENSHOTS.md. |

Use DEPLOYMENT.md for the release checklist and production evidence. Passing local tests does not complete those live checks.
