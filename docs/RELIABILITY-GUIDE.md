# Reliability and release verification

## October 1 checkpoint

The published starting point is `5efe69d`, with [green CI](https://github.com/zihadpcode/AlgoSprint/actions/runs/36171027927), 231 unit/component/migration tests and 76 PostgreSQL integration tests. The [production application](https://algosprint-brown.vercel.app) has 35 published original problems and two learning paths. The repository's earlier statements that deployment, roadmaps, administration and interviews were all future work are superseded.

This work implements the shared review's execution hardening and publishing clarification. Account recovery and draft protection are being developed in isolated worktrees; content expansion is a separate Claude-owned lane. Do not count worktree drafts as merged, deployed or seeded.

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

Checks are recorded against the local work; published CI above proves only the starting commit. Final validation results will be recorded after the isolated changes are integrated.

- Node 24.21.0: worker regression tests and the full initial unit/component suite passed (236 tests after the worker changes).
- PostgreSQL 17: all three existing migrations applied to a fresh disposable local `_test` database; all 76 initial integration tests passed, including owner isolation, concurrency, quotas, interrupted/stale submissions, interview deadlines and admin writes.
- Initial lint, TypeScript, production build and sandbox trace checks passed. Final combined checks remain required after the parallel changes.
- Production guest library returned HTTP 200; browser example execution passed 2/2 on Relay Window with an original synthetic solution, saving nothing. [Guest screenshots and viewport evidence](SCREENSHOTS.md) are recorded separately.
- The Vercel runtime-error query returned HTTP 403. The `get_project` connector currently rejects its documented arguments with an `idOrName` input error. No runtime-log inspection is claimed.

The existing pg 8 adapter emitted a concurrent-query deprecation notice during integration tests; no test failed. A dependency upgrade requires a separate compatibility review. No database reset, production migration or seed belongs to this code change.

## Remaining release work

| Work | Completion criterion |
| --- | --- |
| Authenticated production acceptance | Two real disposable accounts verify owner isolation, ordinary-user admin denial, refreshed/expired sessions, invalid callbacks and progress undo on the deployed commit. |
| Interview acceptance | Save/reload/finish, server expiry, stale second tab, interrupted save and local recovery all behave correctly on the deployed application. |
| Account recovery | Generic recovery/resend responses, provider throttling, verified recovery flow and same-browser email links pass tests and an actual mail-delivery check. |
| Draft protection | Opt-in, owner/revision-scoped recovery never overwrites server saves; logout/account changes and expiration remove stored private drafts. |
| Content expansion | Reviewed original fixtures pass trusted references and actual QuickJS execution; paths cover the existing library before larger growth. Seed only the exact tested merged content through the repeatable insert-only workflow. |
| Operations | Inspect Vercel runtime logs with project access, repeat advisors, document recovery and measure submission/database/query behavior before claiming scale. |
| Interface acceptance | Finish authenticated screenshots, keyboard, zoom, screen reader and actual mobile-browser checks in SCREENSHOTS.md. |

Use DEPLOYMENT.md for the release checklist and production evidence. Passing local tests does not complete those live checks.
