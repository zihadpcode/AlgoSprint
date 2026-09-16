# AlgoSprint session handoff

**2026-09-16: PAUSED at the user's explicit request. Phase 9 is unfinished and must remain unmerged.**

Latest instruction: “pause and update whatever you have so far.” No further feature work or optional verification is authorized until resume. Standing routine approval does not override this pause.

## 🟦 Current repository state

- Repository: [zihadpcode/AlgoSprint](https://github.com/zihadpcode/AlgoSprint).
- Main remains merged Phase 8: `e41da38d55bae2f32e1e1ada77db37162374b112`, tree `6defc3e36fefd97a4b415468529ac149775abd20`.
- Phase 8 final head `d81245edd48fc19665367246cbf6e66c7b080504` passed [CI 35048202650](https://github.com/zihadpcode/AlgoSprint/actions/runs/35048202650), all 112 tests and production checks. PR #9 is merged.
- Save unfinished Phase 9 on `algosprint/phase-9-progress` as a draft PR. Its PR metadata records the final checkpoint commit and tree. Do not merge it.
- Local work remains in `algosprint-runner`; older `algosprint` and `algosprint-next` were preserved. Local ancestry is synthetic and must not be pushed as remote history. Remote commits use actual main as parent.
- AGENTS.md and installed Next.js server-action guidance were read. No new dependencies were added. A schema/migration draft was written, not applied to production.

## 🟩 Partial implementation

See [PHASE-9-PAUSED.md](PHASE-9-PAUSED.md) for the inventory and exact resume tasks. [PHASE-9-SOURCE-CHECKPOINT.md](PHASE-9-SOURCE-CHECKPOINT.md) contains all complete authored source/config/test files changed in this partial phase.

Draft behavior: reserved runs/submissions mark attempted progress; accepted full-suite SUBMIT results verify a solve only against the current published revision. New verifiedRevision/verifiedAt columns preserve provenance. The migration backfills Phase 8 attempt history and matching accepted submissions while retaining manual dates and review/bookmark flags. Shared progress row locks coordinate manual attempts, solves/undo/review and runner finalization.

A protected /progress page adds totals, difficulty/category counts, recent attempts and recently updated progress. Queries select owner-only projections and exclude submission source/results, test cases and private notes. Library/detail labels distinguish self-marked, verified-current, verified-earlier and legacy solves. Previous verified solves remain in historical solved counts after revision changes; only current matching revisions count as currently verified. Category totals overlap.

## 🟨 Collected check results

- Latest local run: **92 passed, 2 failed out of 94** unit/component/migration tests.
- Earlier typecheck and lint passed before the final new test files were added. The final snapshot has not been fully rechecked.
- Diff whitespace checks passed.
- New real PostgreSQL integration tests are written but have not run. No Phase 9 production build or HTTP smoke completed locally.
- Draft PR CI may run automatically; check its actual result on resume. Do not infer success from Phase 8 CI.

## 🟥 Known failures / next actions

1. Runner pending buttons do not disable after the new startTransition wrapper. `tests/runner-controls.test.ts` fails its pending assertion. The busy ref blocks duplicate requests but the visual state is wrong; preserve urgent pending updates while supporting action revalidation.
2. The migration fixture uses timezone-dependent date-only SQL literals. `tests/progress-migration.test.ts` gets 04:00Z rather than 00:00Z. Use explicit UTC fixture timestamps, then rerun the test.

After resuming, fix those failures, review migration/backfill and concurrent progress semantics, run new PostgreSQL integration tests and the full checks, then finish the beginner-friendly Phase 9 guide with complete source. The paused source snapshot is not a final guide or claim of phase completion. Do not start Phase 10 before Phase 9 is finished.

Live Supabase/Judge0 and browser/Monaco-worker checks remain pending from earlier phases. No production migration/data change, deployment, provider purchase or merge occurred during Phase 9.

## 🟪 Current phase ledger

| Phase | Scope | Status |
| --- | --- | --- |
| 1–2 | Foundation, database and seeds | Merged |
| 3–4 | Authentication and app shell | Merged; live account/browser QA pending |
| 5–7 | Library, problem detail and editor | Merged; real browser/worker QA pending |
| 8 | Isolated Judge0 integration | Merged PR #9; 112 tests passed; live provider setup/verification pending |
| 9 | Progress tracking | PAUSED, unfinished draft; 92/94 local tests pass; do not merge |
| 10 | Dashboard analytics | Not started |
| 11 | Notes/bookmarks manager | Models and per-problem note only |
| 12 | Roadmaps | Models only |
| 13 | Admin authoring | Guarded placeholder/models only |
| 14 | Generator | Seed/validation foundation only |
| 15 | Mock interviews | Models only |
| 16 | Polish/deployment | Not started |

**Stop here until the user resumes.** The historical Phase 8 handoff below preserves previous implementation details and evidence; its old “next phase” instructions are superseded by this pause.

---

# Historical Phase 8 handoff

**2026-09-16 checkpoint: Phase 8 implemented and documented. Pause before Phase 9.**

The user said continue after the merged Phase 7 checkpoint. The earlier request to pause at 90% usage remains a preference, but no live usage-percentage meter is available. This session is bounded to the verified Phase 8 implementation and handoff. Standing authorization covers routine verified GitHub publication and merge.

## 🟦 Repository and workspace

- Private repository: [zihadpcode/AlgoSprint](https://github.com/zihadpcode/AlgoSprint).
- Starting main: `d4f6ef7f23648e730918bd0b261c32c7ac64fd76`, merged Phase 7 PR #8; tree `6a3aad5094e3c0d668a335714ceabafb6c7ae9d6`.
- Current [PR #9](https://github.com/zihadpcode/AlgoSprint/pull/9), branch `algosprint/phase-8-runner`. PR metadata records final head, CI and merge evidence.
- Work resumed in a new `algosprint-runner` folder. Its initial tracked tree was verified byte-for-byte against merged Phase 7. Older `algosprint` and partial `algosprint-next` folders were preserved.
- The new local repo was initialized from a verified tree snapshot, so its ancestry is synthetic. Remote commits were created with the actual GitHub parent. Do not push synthetic local ancestry. Resume from current GitHub main or the open PR branch. Local/remote source trees were compared at publication.
- AGENTS.md and installed Next.js route-handler/server-action guidance were read before implementation. No dependency, schema, migration, seed, production account/data or deployment changes were made.

## 🟩 Phase 8 implementation

The code runner uses a separately configured Judge0 service. All secrets and provider settings are server-only. It is disabled unless CODE_RUNNER_ENABLED=true and URL, credentials, authentication mode and JavaScript runtime ID validate. No default public provider is called. No submitted code is evaluated or spawned by the app server.

Only the five original JavaScript problem signatures are supported. Explicit input-field mappings preserve argument order across JSONB storage. The harness is source text sent to the remote sandbox with one case's argument array in stdin. Trusted expected values remain outside that program. Structured JSON comparison, not the provider Accepted label alone, decides correctness.

Run loads only visible TestCase records. Submit loads the full suite and requires hidden tests. Submit response and stored result DTOs contain counts/verdict/metrics only; all case inputs, expected values, stdout, stderr and compile diagnostics are withheld. A program printing hidden inputs cannot return them through these fields. Provider tokens and raw provider errors never reach the browser.

A short shared PostgreSQL advisory lock serializes quota checks and reservation creation across instances. Limits: one active request per user, five per minute/thirty per hour per user, sixty per minute/twenty active app-wide. Stale active records older than two minutes become INTERNAL_ERROR on the next reservation. Published problem revision, source, mode and selected test count are saved before provider calls; final writes require the same owner and RUNNING state. No external request holds a database transaction open.

Each provider job has CPU/wall/memory/process/output limits and network disabled. Requests use HTTPS, explicit credential headers, no redirects/cache, five-second per-request timeouts, a twenty-second overall deadline and bounded response parsing. There are at most ten cases. Output must be JSON. Compare complete bounded stdout before truncating visible display/storage to 4,000 characters.

The editor captures the request's draft, blocks duplicate clicks and flags results from earlier drafts/languages. Visible results include input, expected/actual output and bounded error/log text; Submit shows only a full-suite summary. Runtime is the slowest test and memory the largest test value; missing metrics remain unmeasured. Persistence failures never show saved success. A network retry explicitly creates a new attempt.

Phase 8 persists submissions only. Accepted submissions do not yet modify manual progress; Phase 9 must connect these safely. No private submission-history screen, durable draft autosave, durable job queue or idempotent network-retry key exists.

## 🟨 Verification and documentation

Implementation head `19d15de16173f6a0f9579001df7575d5a6ce8b86`, tree `430ec32b8f205d0d39b5101c4655754f6d8a72dd`, passed [CI run 35047796766](https://github.com/zihadpcode/AlgoSprint/actions/runs/35047796766).

- 88 unit/component/migration tests and 24 real PostgreSQL integration tests: **112 total**.
- Prisma schema/migrations and seed validation, lint, TypeScript and production build.
- Unconfigured-account production HTTP smoke and seeded library/detail HTTP smoke, including disabled execution controls and hidden-data exclusion.
- New tests cover strict inputs/auth, malicious overrides, provider controls, structured comparison, output bounds, queue timeout, redaction, old-draft feedback, concurrent reservations, quotas, ownership and abandoned attempts.

Local 88 tests, lint, TypeScript, production build and unconfigured HTTP smoke passed. The initial local build failed because a temporary node_modules symlink pointed outside Turbopack's project root; copying the existing dependencies into the new workspace resolved it without changing source or dependencies. Real PostgreSQL verification came from CI, not a local PostgreSQL server.

[PHASE-8-GUIDE.md](PHASE-8-GUIDE.md) explains the three runner options, selected architecture, complete authored source, Mac setup, configuration, quotas, internal flow, tests, common mistakes, expansion and live verification checklist. Its 19 authored file listings match the final source exactly. README and the preserved brief's status preface are updated. The closing commit also fixes asynchronous React test scopes so pending result updates finish within act. Final head/CI/merge evidence is recorded on PR #9.

## 🟥 Unverified and intentional limits

No live Judge0 or Supabase credentials were supplied. Provider tests use inert HTTP stubs, so actual sandbox isolation, JavaScript runtime compatibility, network denial and real program execution are unverified. A maintained provider and development accounts must pass the guide's live checklist before enablement. Code's request flags are not proof of a provider's isolation. No service was purchased or deployed.

Real Monaco rendering/typing/worker startup, keyboard/screen-reader behavior, mobile and zoom remain unverified; happy-dom uses mocked action/Monaco boundaries. Prior live Supabase signup/confirmation/session/logout checks also remain pending.

The synchronous action is bounded and awaited. A process death can leave a RUNNING attempt until the next reservation cleans it up. An already accepted remote job may finish after local polling aborts. A disconnected browser may not receive an already saved result. Quotas include failed reserved requests; no exactly-once retry guarantee exists. Hidden summaries intentionally expose aggregate verdict/count/timing feedback, not a zero-information assessment oracle.

Resource support and semantics depend on the selected provider. Memory-related process signals can appear as generic runtime errors. Returned metrics include runtime/harness overhead. At most ten tests, 64 KB stdin and only the five reviewed JavaScript signatures are supported. Preserve these limits until expanding the design deliberately.

## 🟪 Phase ledger

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Setup and architecture | Complete; merged PR #1 |
| 2 | Database and original seeds | Complete; merged PR #2 |
| 3 | Authentication | Implemented/reconciled in merged PR #5; live checks pending |
| 4 | Workspace/UI system | Implemented in merged PR #5; browser QA pending |
| 5 | Problem library | Complete; merged PR #6, CI passed |
| 6 | Problem details and guidance | Complete; merged PR #7, CI passed |
| 7 | Monaco editor workspace | Complete; merged PR #8, CI passed; browser checks pending |
| 8 | Safe code runner | Implemented/documented in PR #9; CI passed; live provider/account checks pending |
| 9 | Progress tracking | Next phase: connect persisted submissions; manual solved/review controls already exist |
| 10 | Dashboard analytics | Not started |
| 11 | Notes and bookmarks | Models and per-problem note; manager/bookmarks not started |
| 12 | Original roadmaps | Models only |
| 13 | Admin content tools | Models and guarded placeholder only |
| 14 | Problem generator | Seed/validation foundation only |
| 15 | Mock interviews | Models only |
| 16 | Polish and deployment | Not started |

**Pause here.** On resume, verify current main/PR #9. Phase 9 should distinguish attempted, manually solved and runner-verified full-suite results, maintain timestamps and review/bookmark flags, handle concurrent/repeated writes and revised problems, and add counts/recent activity without exposing other users' submissions. Do not mark a visible-only run as a verified solve. Continue complete phase guides.

## 🟦 Phase 7 evidence

Phase 7 merged as `d4f6ef7f23648e730918bd0b261c32c7ac64fd76`. Final tested head `2c18b3d04775a8e131ba68fd6c32f2adffdb492b` passed run 35009313904, with the exact merged tree `6a3aad5094e3c0d668a335714ceabafb6c7ae9d6`. Its completion implementation passed 35008677517 with 69 unit/component/migration and 17 PostgreSQL tests.

## 🟦 Earlier evidence and unchanged content

Phase 6 merged as `362391407a5791eb83ab63a929ffb83abc5f8493`; final head `ecc299b7787d984326d46cac6a5f8dabf2366420` passed run 34906233520 and had the exact merged tree `17000d3777508dc105821bbe49d754887729cd35`.

Phase 5 merged as `d64a450288e1b9b94d81c86e3d0f28d9f39645e3`; final head `4848e1b4264f039e9fc6d333ecf5e7eb5524bcdf` passed run 34873407020. Phase 4 merged as `dc62d532ab10efd945d845f19c56039001475d69` after run 34814179876. PR #3 merged indirectly; PR #4 was closed as incorporated.

The five original problems remain Relay Window, Quiet Badge, Parcel Checkpoints, Dock Threshold and Lantern Steps: 25 hints, 10 solutions, 10 public examples and 30 cases (10 visible/20 hidden). The 22-model schema, 30 categories, six tags and one interview style are unchanged. Grow reviewed content from 5 to 20 to 100 to 1,000 later.
