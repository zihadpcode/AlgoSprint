# Problem library guide

The published library holds 35 original coding problems: the five foundation problems in `src/data/seeds/problems/foundation/` and thirty hand-authored problems in `src/data/seeds/problems/library/`. Every problem is a JSON seed file validated by `src/lib/validators/problem.ts`, and the seed refuses any problem whose expected outputs cannot be recomputed by trusted TypeScript code in the repository. JSON code strings are never evaluated.

## 🟦 Coverage

| Slug | Title | Difficulty | Pattern | Categories |
| --- | --- | --- | --- | --- |
| `ridge-count` | Ridge Count | Easy | linear-scan | arrays |
| `ticket-pair` | Ticket Pair | Easy | hash-map | hash-maps, arrays |
| `mirror-callsign` | Mirror Callsign | Easy | two-pointers | strings, two-pointers |
| `balanced-blueprint` | Balanced Blueprint | Easy | stack-matching | stack, strings |
| `ticket-turns` | Ticket Turns | Easy | queue-simulation | queue, arrays |
| `rank-tags` | Rank the Tags | Easy | frequency-count | sorting, hash-maps, strings |
| `lone-sensor` | Lone Sensor | Easy | xor | bit-manipulation, arrays |
| `prime-tally` | Prime Tally | Easy | sieve | math, arrays |
| `longest-clean-streak` | Longest Clean Streak | Medium | variable-window | sliding-window, strings, hash-maps |
| `warmer-wait` | Warmer Wait | Medium | monotonic-stack | stack, arrays |
| `chain-loop-start` | Chain Loop Start | Medium | fast-slow-pointers | linked-list, two-pointers |
| `balanced-canopy` | Balanced Canopy | Medium | tree-recursion | trees, recursion, dfs |
| `ledger-tree-check` | Ledger Tree Check | Medium | bounded-recursion | binary-search-trees, trees, recursion |
| `splice-cables` | Splice the Cables | Medium | heap-greedy | heaps, greedy |
| `grid-rescue-hops` | Grid Rescue Hops | Medium | bfs | bfs, graphs, queue |
| `orchard-plots` | Orchard Plots | Medium | flood-fill | dfs, graphs |
| `crate-combinations` | Crate Combinations | Medium | backtracking | backtracking, recursion |
| `fewest-tokens` | Fewest Tokens | Medium | one-dimensional-dp | dynamic-programming |
| `shared-melody` | Shared Melody | Medium | two-dimensional-dp | dynamic-programming, strings |
| `rising-marks` | Rising Marks | Medium | increasing-subsequence | dynamic-programming, binary-search, arrays |
| `charging-hops` | Charging Hops | Medium | greedy | greedy, arrays |
| `bake-batches` | Bake Batches | Medium | binary-search-answer | binary-search, greedy, arrays |
| `merge-shifts` | Merge the Shifts | Medium | interval-merge | intervals, sorting, arrays |
| `first-redundant-link` | First Redundant Link | Medium | union-find | union-find, graphs |
| `task-order` | Task Order | Medium | topological-sort | topological-sort, graphs, heaps |
| `prefix-counts` | Prefix Counts | Medium | trie | tries, strings, design |
| `lru-results` | Recently Used Cache | Medium | design | design, hash-maps, linked-list |
| `cheapest-route` | Cheapest Route | Hard | dijkstra | graphs, heaps, greedy |
| `watchtower-placements` | Watchtower Placements | Hard | backtracking | backtracking, recursion |
| `gutter-capacity` | Gutter Capacity | Hard | two-pointers | two-pointers, arrays |

Trees are passed as level-order arrays with `null` for missing children. Linked chains are passed as a `next` pointer array plus a `head` index. Grids are arrays of equal-length strings. Every problem exposes a single JavaScript entry point that takes positional arguments and returns a JSON value.

## 🟩 Adding a problem

A problem is complete only when three pieces agree:

1. **Seed JSON** in `src/data/seeds/problems/<group>/<slug>.json`. It must satisfy `problemSchema`: statement, constraints, at least two examples, exactly five progressive hints, starter code, at least four test cases with both visibilities, and at least a `BRUTE_FORCE` and an `OPTIMAL` solution with steps, complexities, common mistakes and an interview explanation. Statements, hints and explanations must be original.
2. **Runner signature** in `src/features/submissions/signatures.ts`: the entry point name and the ordered argument keys. The Judge0 harness reads test inputs by these keys, so JSON key order never matters.
3. **Trusted reference** in `scripts/lib/reference-library.ts`: a Zod input schema that rejects malformed inputs and a typed optimal implementation. `validateProblemSemantics` recomputes every example and test output with it and fails on any mismatch, both in `npm run seed:validate` and inside `seedProblems`.

Then run:

```bash
npm run seed:validate
npm test
npm run test:integration   # needs TEST_DATABASE_URL pointing to an empty database ending in _test
```

`tests/seed-validation.test.ts` asserts that every seed has a signature whose keys match the starter code and every test input, and `tests/reference-library.test.ts` checks the references against small exhaustive baselines. Seeding is insert-only: an existing slug whose content hash differs is a conflict, so edits to a published problem go through the admin editor or a deliberate content migration, never a silent reseed.

## 🟨 Seeding the production database

Seeding is repeatable and skips existing slugs, so adding files and rerunning `npm run db:seed` from a trusted checkout of `main` inserts only the new problems. Use the session pooler URL for the seed run as described in [DEPLOYMENT.md](DEPLOYMENT.md), verify the published count afterwards, and never commit credentials.
