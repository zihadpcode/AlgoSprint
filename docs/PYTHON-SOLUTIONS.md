# Python guided solutions

The Python editorial add-on covers every existing JavaScript solution approach: 264 approaches across 125 published coding problems. Open a problem's **Hints & Editorial** tab, expand **Reveal guided solutions**, then select an approach labeled **python**. The editor's language selector controls the submitted code; guided approaches have their own labeled tabs.

Three reviewed files under `src/data/seeds/languages/python-solutions-{a,b,c}.json` contain the Python code and implementation-specific explanation overrides. `loadPythonSolutions()` combines those with the corresponding original algorithm's explanation and walkthrough. Each original approach must have exactly one Python translation. Function names and argument order match the Python starter contract. The original published problem JSON, seed hashes and JavaScript solutions remain unchanged.

`tests/python-solutions.test.ts` checks complete approach coverage and validates every function's parsed Python signature, compilation and results against stored examples/tests using Python 3.12 or newer. Every approach must pass at least two bounded cases. Exhaustive brute-force approaches may exceed a short offline case budget on larger fixtures; those cases are recorded separately. Other approaches must pass all stored cases. The offline checker executes only authored, checked-in reference code; learner submissions continue to use the managed Sandbox runtime.

## Publishing

Use `npm run db:seed:python-solutions -- --slug relay-window` for a selected canary, then run without `--slug` for the full add-on. This dedicated command is separate from the ordinary problem seed. It requires matching published coding problems, exact content hashes and the correct Python starter entry point. Every existing Python approach and walkthrough must match exactly before any new row is inserted. Conflicts roll back the transaction; unchanged repeats retain row IDs.

For connector-managed production updates, `pythonSolutionRolloutSql()` produces equivalent reviewable, guarded DML with a separately obtained problem ID/revision/seed-hash fingerprint. It snapshots full Problem rows, all starters, and all existing solutions and walkthroughs, then asserts preservation and exact readback inside the transaction. The integration tests rehearse both publication paths, canary-first application, repeat, conflict rollback and source-contract drift against disposable PostgreSQL.

Neither publication path updates problem revisions, existing JavaScript editorials, starter code, submissions or verified progress. A later ordinary problem seed retains the additive editorials because the original content hashes are unchanged.
