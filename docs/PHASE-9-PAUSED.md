# Phase 9 — paused, unfinished

The user requested **“pause and update whatever you have so far”** on 2026-09-16. Feature work and additional verification stopped. Preserve this draft unmerged. Phase 8 remains the completed implementation on main.

## 🟩 Written so far

- A schema/migration draft adds verifiedRevision and verifiedAt to UserProgress, with a relational check and backfill from existing Phase 8 submissions.
- A shared row-locked progress writer records manual attempts, manual solves/undo, review settings and verified solves while preserving unrelated fields.
- Runner reservations mark attempted progress. Completion updates the saved result and progress in one transaction; only an accepted SUBMIT matching the current published revision can verify a solve.
- A protected /progress page shows overall, difficulty and category counts, ten recent attempts and ten recently updated problem states.
- Library/detail badges distinguish manual, current verified, earlier-revision verified and legacy recorded solves.
- Navigation, auth-refresh coverage, dashboard link, revalidation and submission revision display are wired.
- New unit/migration and PostgreSQL integration tests have been written; the PostgreSQL tests have not run.

[PHASE-9-SOURCE-CHECKPOINT.md](PHASE-9-SOURCE-CHECKPOINT.md) preserves complete current files. It is a source snapshot, not the finished beginner guide.

## 🟨 Checks collected when paused

Latest local unit/component/migration run: **92 passed, 2 failed (94 tests total)**. The two failures are below. Earlier TypeScript and lint checks passed before the last new test files were added; the final paused snapshot has not been fully rechecked. Git diff whitespace checks passed.

No Phase 9 production build, production HTTP smoke, or real PostgreSQL integration run completed locally. No live Supabase/Judge0/browser checks were performed. Draft PR CI may run automatically; it does not override the unfinished status. Check its actual result on resume.

## 🟥 Known failures and remaining review

1. `tests/runner-controls.test.ts` — “captures the draft, blocks duplicate clicks and warns about edits during execution”: Submit remains enabled while a run is pending. The new startTransition wrapper defers the pending state. The busy ref still rejects duplicate execute calls, but the visible pending state is wrong. On resume, move urgent pending state outside the transition or use an appropriate transition-pending state, preserving draft capture and revalidation behavior; rerun this component test.
2. `tests/progress-migration.test.ts` — backfill timestamp assertion: the fixture's date-only SQL literal is interpreted in the environment timezone, returning `2026-01-01T04:00:00.000Z` instead of midnight UTC. Make fixture timestamps explicitly UTC, then verify backfill semantics again. Do not weaken the assertion or alter valid production timestamps to conceal the timezone assumption.

After those fixes, run the full checks, especially real PostgreSQL integration. The draft migration/backfill, concurrency and atomic progress transitions, stale-revision behavior, owner isolation, private result projection and counts need final review. Validate that repeated marks do not create false activity and that failed or visible-only runs never earn verified status. Finish the complete Phase 9 guide only after behavior is verified.

## 🟪 Resume boundary

Start from the draft branch `algosprint/phase-9-progress`, not an older partial workspace. Fix the two known failures, review the migration and new integration tests, run lint/types/build/HTTP/real PostgreSQL checks, and complete the guide/handoff before any merge. Do not start Phase 10 yet.

No production migration, deployment, provider purchase or merge was performed during this partial phase.
