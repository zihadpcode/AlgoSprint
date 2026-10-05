# Problem library guide

The published library holds 87 original coding problems: the five foundation problems in `src/data/seeds/problems/foundation/` and eighty-two hand-authored problems in `src/data/seeds/problems/library/`. The library is growing toward the brief's 100-problem milestone in reviewed batches. Every problem is a JSON seed file validated by `src/lib/validators/problem.ts`, and the seed refuses any problem whose expected outputs cannot be recomputed by trusted TypeScript code in the repository. JSON code strings are never evaluated.

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
| `studio-bookings` | Studio Bookings | Medium | sweep-line | intervals, sorting, heaps |
| `slot-insert` | Slot Insert | Medium | interval-merge | intervals, arrays |
| `prefix-suggestions` | Prefix Suggestions | Medium | trie | tries, strings, binary-search |
| `radio-clusters` | Radio Clusters | Medium | union-find | union-find, graphs |
| `module-plan` | Module Plan | Medium | topological-sort | topological-sort, graphs |
| `lit-panels` | Lit Panels | Easy | bit-counting | bit-manipulation, dynamic-programming |
| `tile-side` | Tile Side | Easy | gcd | math, arrays |
| `kth-badge` | Kth Badge | Medium | inorder-traversal | binary-search-trees, trees, stack |
| `canopy-layers` | Canopy Layers | Easy | bfs | trees, bfs, queue |
| `dial-lookup` | Dial Lookup | Medium | rotated-binary-search | binary-search, arrays |
| `fuel-stretch` | Fuel Stretch | Medium | variable-window | sliding-window, arrays |
| `postfix-ledger` | Postfix Ledger | Medium | stack-evaluation | stack, math |
| `floor-tracker` | Floor Tracker | Medium | design | design, object-oriented, stack |
| `shuffled-signs` | Shuffled Signs | Easy | frequency-count | hash-maps, strings, sorting |
| `trail-gain` | Trail Gain | Easy | linear-scan | arrays, greedy |
| `middle-car` | Middle Car | Easy | fast-slow-pointers | linked-list, two-pointers |
| `fare-combinations` | Fare Combinations | Medium | unbounded-knapsack | dynamic-programming, arrays |
| `warehouse-routes` | Warehouse Routes | Medium | two-dimensional-dp | dynamic-programming, arrays |
| `mold-spread` | Mold Spread | Medium | multi-source-bfs | bfs, graphs, queue |
| `nearest-beacons` | Nearest Beacons | Medium | top-k | heaps, sorting, math |
| `balance-runs` | Balance Runs | Medium | prefix-sum | hash-maps, arrays |
| `typo-distance` | Typo Distance | Hard | two-dimensional-dp | dynamic-programming, strings |
| `peak-watch` | Peak Watch | Hard | monotonic-deque | sliding-window, queue, arrays |
| `signal-codes` | Signal Codes | Hard | bfs | bfs, graphs, strings |
| `billboard-space` | Billboard Space | Hard | monotonic-stack | stack, arrays |
| `pace-median` | Pace Median | Hard | two-heaps | heaps, design |
| `signal-flips` | Signal Flips | Easy | xor | bit-manipulation, math |
| `roster-merge` | Roster Merge | Easy | two-pointers | two-pointers, sorting, arrays |
| `tower-tiles` | Tower Tiles | Easy | one-dimensional-dp | dynamic-programming, recursion |
| `badge-subsets` | Badge Subsets | Medium | backtracking | backtracking, recursion, bit-manipulation |
| `grid-turn` | Grid Turn | Medium | matrix-transform | arrays, math |
| `charging-loop` | Charging Loop | Medium | greedy | greedy, arrays |
| `word-groups` | Word Groups | Medium | hash-map | hash-maps, strings, sorting |
| `lane-merge` | Lane Merge | Hard | k-way-merge | heaps, sorting, arrays |
| `ridge-trails` | Ridge Trails | Hard | memoized-dfs | dfs, dynamic-programming, graphs |
| `cipher-window` | Cipher Window | Hard | variable-window | sliding-window, strings, hash-maps |
| `pattern-gate` | Pattern Gate | Hard | wildcard-dp | dynamic-programming, strings, backtracking |
| `fragile-links` | Fragile Links | Hard | bridges | graphs, dfs |
| `glyph-order` | Glyph Order | Hard | topological-sort | topological-sort, graphs, strings |
| `vault-account` | Vault Account | Easy | design | object-oriented, design |
| `tally-ranges` | Tally Ranges | Easy | prefix-sum | arrays, math |
| `one-slip-mirror` | One-Slip Mirror | Easy | two-pointers | two-pointers, strings |
| `rate-gate` | Rate Gate | Medium | sliding-log | system-design, design, queue |
| `snapshot-registry` | Snapshot Registry | Medium | timestamp-binary-search | object-oriented, design, binary-search |
| `quiet-heist` | Quiet Heist | Medium | one-dimensional-dp | dynamic-programming, arrays |
| `lineup-orders` | Lineup Orders | Medium | backtracking | backtracking, recursion |
| `spiral-survey` | Spiral Survey | Medium | matrix-transform | arrays |
| `dual-median` | Dual Median | Hard | partition-binary-search | binary-search, arrays |
| `mirror-cuts` | Mirror Cuts | Hard | palindrome-dp | dynamic-programming, strings |
| `bracket-run` | Bracket Run | Hard | stack-matching | stack, strings, dynamic-programming |
| `later-lower` | Later Lower | Hard | fenwick-tree | sorting, arrays, binary-search |
| `city-skyline` | City Skyline | Hard | sweep-line | heaps, intervals, sorting |

Trees are passed as level-order arrays with `null` for missing children. Linked chains are passed as a `next` pointer array plus a `head` index. Grids are arrays of equal-length strings. Every problem exposes a single JavaScript entry point that takes positional arguments and returns a JSON value.

## 🟩 Adding a problem

A problem is complete only when three pieces agree:

1. **Seed JSON** in `src/data/seeds/problems/<group>/<slug>.json`. It must satisfy `problemSchema`: statement, constraints, at least two examples, exactly five progressive hints, starter code, at least four test cases with both visibilities, and at least a `BRUTE_FORCE` and an `OPTIMAL` solution with steps, complexities, common mistakes and an interview explanation. Statements, hints and explanations must be original.
2. **Runner signature** in `src/features/submissions/signatures.ts`: the entry point name and the ordered argument keys. The Judge0 harness reads test inputs by these keys, so JSON key order never matters.
3. **Trusted reference** in `scripts/lib/reference-library.ts`: a Zod input schema that rejects malformed inputs and a typed optimal implementation. `validateProblemSemantics` recomputes every example and test output with it and fails on any mismatch, both in `npm run seed:validate` and inside `seedProblems`.

   Problems added after the first 35 put their reference in `scripts/lib/reference-expansion.ts` instead. Each entry there also carries an independent brute-force baseline and a seeded random-input sampler, and `tests/reference-expansion.test.ts` checks that the two implementations agree on 400 sampled inputs per problem.

Every published problem must also pass the execution gate in `tests/library-sandbox.test.ts`, which runs each authored JavaScript solution through the same QuickJS sandbox and harness that verified submissions use. Optimal, better and alternative solutions must be accepted on every test. A brute-force solution may hit the time limit on a large case, but it must never return a wrong answer or crash. The untouched starter code must not be accepted. Keep each problem at or below 10 test cases, the default 2000 ms and 262144 KB limits, and 64,000 bytes of input per case so it stays executable by both runner providers.

Then run:

```bash
npm run seed:validate
npm test
npm run test:integration   # needs TEST_DATABASE_URL pointing to an empty database ending in _test
```

`tests/seed-validation.test.ts` asserts that every seed has a signature whose keys match the starter code and every test input, and `tests/reference-library.test.ts` checks the references against small exhaustive baselines. Seeding is insert-only: an existing slug whose content hash differs is a conflict, so edits to a published problem go through the admin editor or a deliberate content migration, never a silent reseed.

## 🟨 Seeding the production database

Seeding is repeatable and skips existing slugs, so adding files and rerunning `npm run db:seed` from a trusted checkout of `main` inserts only the new problems. Use the session pooler URL for the seed run as described in [DEPLOYMENT.md](DEPLOYMENT.md), verify the published count afterwards, and never commit credentials.
