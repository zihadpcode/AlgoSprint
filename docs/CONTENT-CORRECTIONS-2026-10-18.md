# Content corrections, 2026-10-18

Branch `algosprint/content-corrections-oct18`, based on `origin/main` 1bacb2f.

An independent audit of the 100 published problems found text errors in the seed JSON. This change applies only text corrections to 18 problem files (a second commit on this branch, described in the section "Hint-ladder corrections" below, touches 7 more files, one of which is already among the 18, so 24 in all). Test cases, schemas, pattern/category labels, tags and every other problem are untouched. The only code string that changed is the OPTIMAL solution of `first-redundant-link` (union by size added).

## WARNING: this change makes `npm run db:seed` abort

Production already holds these problems. The seeder is insert-only and compares `sha256(canonicalJson(ProblemSeed))` of each file with the `seedHash` stored for the slug. Every edit below changes that hash, so after this branch is merged `npm run db:seed` (and any other call to `seedProblems`) throws `Seed conflict for <slug>: existing content differs. No seed content was changed.` for each of the 24 slugs listed in the hash table, until production content is reconciled. That reconciliation must be a separate, reviewed transaction and is deliberately not part of this change; nothing here updates or proposes to run anything against production. Do not merge or deploy this branch together with a seed step until that is done.

## Old and new problem hashes

Computed with the repository's own `problemHash` / `canonicalJson` from `prisma/seed-data.ts`, after parsing through `problemBatchSchema` exactly as the seeder does. Old = `git show origin/main:<path>`, new = the file in this branch.

| Slug | File | Old sha256 | New sha256 |
| --- | --- | --- | --- |
| first-redundant-link | `src/data/seeds/problems/library/first-redundant-link.json` | `bd4aac8567074ed07a4b572b6b5d3267df06351566845d2b1adbc41de8b65f40` | `1b0703b7375b04f1814ff5b13d45e407ac8e4a16c705bc155a6c1fb40a5758d1` |
| balanced-canopy | `src/data/seeds/problems/library/balanced-canopy.json` | `2f00bf90f052aa58220f18046d15a1b1e2aa255a6493f8333a1d1f6a10a7fc1e` | `28467e2cca577f6a01908e4b374b41639edc6386731e4662e95c5315f343d291` |
| ledger-tree-check | `src/data/seeds/problems/library/ledger-tree-check.json` | `2e4c8332fc10a80ee6ee47e55650170a3922bdc660d75d601766cb70c6782db2` | `e40dc8c918f87a50c694418c841d45a33eb27f38a643874fec27ea388d249169` |
| watchtower-placements | `src/data/seeds/problems/library/watchtower-placements.json` | `50e32df7b06d3e894f6a1106ab0dbaf179d952ffdb08857abae3e89e19748f4d` | `f5ea183830073f580715e6902c9beb6bf3982c31f4ebca3946f9a31a2eec25f4` |
| task-order | `src/data/seeds/problems/library/task-order.json` | `38b7ed1c1d42d879ec6ac9fda8b382b18690f5e0d59f99f83a1996879003cbdd` | `ff3d197eb19a790473fafa6d77db9c57b39b70dfbd023dd8dfc24cce2ae08f34` |
| dock-threshold | `src/data/seeds/problems/foundation/dock-threshold.json` | `c6855c286767361e2d00a735b04dcdc9f65f4f104e1b9b6540e1ae732f3888a7` | `3b9bd289e82719fe5b16f70b42cac0b0a3bda65f03de2e4624c6da001bd8a8f4` |
| quiet-badge | `src/data/seeds/problems/foundation/quiet-badge.json` | `c3d90068740391a129a50961b0dfbbb81b646044d06b1f11acb871b322311519` | `b0850e761d03fa243bec0b7205cb412bd24091fa135d63c1da0b879499d5652f` |
| lantern-steps | `src/data/seeds/problems/foundation/lantern-steps.json` | `8d88e731a2cdcea1fca6564e0a555dfd88683018b724fe537c2eea90bf95b5f8` | `f97c6a5a0ea5dc2c0181ef6ef18354dd451d87c8fbe1f91318b825a13c5709f9` |
| parcel-checkpoints | `src/data/seeds/problems/foundation/parcel-checkpoints.json` | `c596267df404c25ea16fb0a4bbab4a5da13c069ce5c27ccaa8e63c2215232b1e` | `faabea85beff711aaca5fe26afc0c4713f5a5e1a3858405abf69bb6188b75975` |
| relay-window | `src/data/seeds/problems/foundation/relay-window.json` | `3d912ddb8b2aba5bac3dd3d7b31026262b5a8eb7bbbb1cba17ee1f7e06a7e737` | `8e2fe1ce345334844adf5581776d96426c8c3bac808177903927e3c24f89a5f7` |
| prefix-suggestions | `src/data/seeds/problems/library/prefix-suggestions.json` | `13ee47f4b73795f847b8998c627c1c9bbb04a260386e8b2b0aea1baa2473dc62` | `fce18cdae4fd087524f804d9ca3ca54be5539d575ef037ebf78eb4f98ac680f9` |
| peak-watch | `src/data/seeds/problems/library/peak-watch.json` | `9c1aee7b41d070c38cf33bd23c74b3daf447f000122df867320898ae249bfe4a` | `1690a197d7ac84c540edbd965caa32e7f5a66b3b7a75c7e25c0445586538995c` |
| tile-side | `src/data/seeds/problems/library/tile-side.json` | `364424f10f8eea3b34635fa77e2923d9bd7e14fb2cdaa51ac78816787b5426b8` | `ce071ae6c81be135a6794b2b6b227b3ddfb62c4bd5e32237bf26cd736b19f2fd` |
| lru-results | `src/data/seeds/problems/library/lru-results.json` | `286517f566b7b0a79c6771a931e7cd239380ff1dc0dc4960d352912a22785ccd` | `d5349cc2fbe9358321e33d30d5681476d1f1d16e17a74c741ae956f292e986b1` |
| popularity-cache | `src/data/seeds/problems/library/popularity-cache.json` | `480cfdb48dbda5f098de2998cbb9418109811f8d689cb30525e47ef33bdac045` | `1ad4dd659c07a8466894dc2e2ae90caa267635f11c6238beda7d6b8af51b25dd` |
| word-groups | `src/data/seeds/problems/library/word-groups.json` | `13b3c40c642928c0304f8522231fd97c24e59148ee7576f863e1a99cf51aba3f` | `fdc0d906ad7a8d44b4538188f133befab516068d87ab493a85381a2ab030d1c9` |
| crate-combinations | `src/data/seeds/problems/library/crate-combinations.json` | `1aeeeec0e96ef5bcd2c12f62a38fa2899511b5f67cd72668de2a1e6cb2528b23` | `db4f7b18473f6ad595a6e458d5ca435a6211be259e7eadbae8ae3077f46eeb97` |
| pattern-gate | `src/data/seeds/problems/library/pattern-gate.json` | `01360fd6aa03b8864cd8b5d60b9fd13a9291ba014123d5d165bd9595f136f796` | `2f57d9da6f5af031b8cd031bee95eca827c94e25684e54280f9906792319586b` |
| grid-turn | `src/data/seeds/problems/library/grid-turn.json` | `a4b2e22ce74ffe667b82afce5717f1f12ef7add4db071815d668bc9e47cedb30` | `89c39599b481d00edd530f909e1f18b454bb858389759618681d14b00cdbbc0d` |
| warehouse-routes | `src/data/seeds/problems/library/warehouse-routes.json` | `effb96c8ca9dd2d62405db2962e7fe8f040f2ccc87c7936d73ad8319c4d0ed13` | `c84fc289f5c0702cbd6e38451509e2ebd560827fde06947ea58315f578c45781` |
| ridge-trails | `src/data/seeds/problems/library/ridge-trails.json` | `99170ee8130760903a05d91af01087a20ce4172ad28dadbb942c6f1d037deb22` | `df7e25de12c723240f2a9878b1f384033d5f0366b20dcba0fdc542385d5bf7a1` |
| mirror-cuts | `src/data/seeds/problems/library/mirror-cuts.json` | `2209cb86c18043e8bae13c1f1f6bad4c264cd631cefd0223de92984f105605e6` | `ba40088cf824a7b69a98624cd7f45307bb3d513db34621d811e0a49bc608fa15` |
| fewest-tokens | `src/data/seeds/problems/library/fewest-tokens.json` | `e7d52ada1850d59d0a861aff499b3d4d853d7e77a4a3ab34c5c9c4fd6e5909c8` | `513e014374b26951aafcb8f70ca1de162f7db4a3df5c733ee2c34a1fd705a6d5` |
| quiet-heist | `src/data/seeds/problems/library/quiet-heist.json` | `a90dd466f6f9115d4ea7aa2bedb2e94ff5d5e4a2bef26bd231bdb3bf99ee3467` | `0ad8d68401ba436af472793f3f17d63b1ed22825be54e5e490962c206af46a9b` |

## Changes per slug

Field paths use `solutions[KIND]` for the solution of that kind and zero-based array indexes. Finding numbers refer to the audit list (S3, S4, S8 are the low items).

### first-redundant-link

- Field: `hints[4].content` (finding 1)
- Reason: The OPTIMAL solution claimed an inverse-Ackermann bound but linked roots naively (no union by size). Added a size array and union by size so the alpha(n) claim holds.

Old:

```text
Path compression keeps representative lookups nearly constant as groups grow.
```

New:

```text
Path compression, together with attaching the smaller group under the larger one, keeps representative lookups nearly constant as groups grow.
```

- Field: `solutions[OPTIMAL].approach` (finding 1)
- Reason: The OPTIMAL solution claimed an inverse-Ackermann bound but linked roots naively (no union by size). Added a size array and union by size so the alpha(n) claim holds.

Old:

```text
Start with every station as its own representative. For each link, find both representatives; if they match the link is redundant, otherwise merge by pointing one representative at the other. Path halving during find keeps the trees flat.
```

New:

```text
Start with every station as its own representative and with a group size of 1. For each link, find both representatives; if they match the link is redundant, otherwise attach the root of the smaller group under the root of the larger one (union by size) and add the sizes. Path halving during find keeps the trees flat.
```

- Field: `solutions[OPTIMAL].pseudocode` (finding 1)
- Reason: The OPTIMAL solution claimed an inverse-Ackermann bound but linked roots naively (no union by size). Added a size array and union by size so the alpha(n) claim holds.

Old:

```text
parent[i] = i; for each (a, b): ra = find(a), rb = find(b); if ra == rb return [a, b]; parent[ra] = rb; return [].
```

New:

```text
parent[i] = i; size[i] = 1; for each (a, b): ra = find(a), rb = find(b); if ra == rb return [a, b]; attach the smaller root under the larger (union by size) and add the sizes; return [].
```

- Field: `solutions[OPTIMAL].code` (finding 1)
- Reason: Code changed to add a size array and union by size (the finding requires the solution still passes the QuickJS gate and matches the reference).

Old:

```text
function firstRedundantLink(stations, links) {
    const parent = Array.from({ length: stations }, (_, i) => i);
    const find = (station) => {
        while (parent[station] !== station) {
            parent[station] = parent[parent[station]];
            station = parent[station];
        }
        return station;
    };
    for (const [a, b] of links) {
        const rootA = find(a);
        const rootB = find(b);
        if (rootA === rootB)
            return [a, b];
        parent[rootA] = rootB;
    }
    return [];
}
```

New:

```text
function firstRedundantLink(stations, links) {
    const parent = Array.from({ length: stations }, (_, i) => i);
    const size = new Array(stations).fill(1);
    const find = (station) => {
        while (parent[station] !== station) {
            parent[station] = parent[parent[station]];
            station = parent[station];
        }
        return station;
    };
    for (const [a, b] of links) {
        let rootA = find(a);
        let rootB = find(b);
        if (rootA === rootB)
            return [a, b];
        if (size[rootA] < size[rootB])
            [rootA, rootB] = [rootB, rootA];
        parent[rootB] = rootA;
        size[rootA] += size[rootB];
    }
    return [];
}
```

- Field: `solutions[OPTIMAL].timeComplexity` (finding 1)
- Reason: The OPTIMAL solution claimed an inverse-Ackermann bound but linked roots naively (no union by size). Added a size array and union by size so the alpha(n) claim holds.

Old:

```text
O((stations + links) × α(stations)), effectively linear
```

New:

```text
O((stations + links) × α(stations)) with path halving and union by size, effectively linear
```

- Field: `solutions[OPTIMAL].interviewExplanation` (finding 1)
- Reason: The OPTIMAL solution claimed an inverse-Ackermann bound but linked roots naively (no union by size). Added a size array and union by size so the alpha(n) claim holds.

Old:

```text
I use union-find: each station points toward a group representative, find follows those pointers while halving the path, and union links one root under the other. A link whose endpoints already share a root closes a cycle, which is the redundancy we are asked for. With path compression the amortized cost per operation is inverse-Ackermann, so the scan is effectively linear.
```

New:

```text
I use union-find: each station points toward a group representative, find follows those pointers while halving the path, and union attaches the root of the smaller group under the root of the larger one. A link whose endpoints already share a root closes a cycle, which is the redundancy we are asked for. With path halving and union by size the amortized cost per operation is inverse-Ackermann, so the scan is effectively linear.
```

- Field: `solutions[OPTIMAL].steps[0].content` (finding 1)
- Reason: Step text updated to match the union-by-size behaviour of the new code.

Old:

```text
For links [[0,1],[1,2],[2,0],[2,3]], link 0–1 merges 0 into 1's group and link 1–2 merges into 2's group.
```

New:

```text
For links [[0,1],[1,2],[2,0],[2,3]], link 0–1 puts 1 under 0 (equal sizes) and link 1–2 puts the smaller group {2} under root 0.
```

- Field: `solutions[OPTIMAL].steps[1].content` (finding 1)
- Reason: With union by size the shared root is 0, not 2 (the old step text described the naive linking).

Old:

```text
For link 2–0, find(2) and find(0) both return 2, so [2, 0] is returned before 2–3 is considered.
```

New:

```text
For link 2–0, find(2) and find(0) both return 0, so [2, 0] is returned before 2–3 is considered.
```

### balanced-canopy

- Field: `solutions[BRUTE_FORCE].spaceComplexity` (finding 2)
- Reason: build() rebuilds the whole tree from the level-order array (O(n) nodes and queue), so O(h) alone understated the space.

Old:

```text
O(h) recursion depth
```

New:

```text
O(n) for the rebuilt nodes, plus an O(h) recursion stack
```

- Field: `solutions[OPTIMAL].spaceComplexity` (finding 2)
- Reason: build() rebuilds the whole tree from the level-order array (O(n) nodes and queue), so O(h) alone understated the space.

Old:

```text
O(h) recursion depth
```

New:

```text
O(n) for the rebuilt nodes, plus an O(h) recursion stack
```

- Field: `solutions[OPTIMAL].interviewExplanation` (finding 2)
- Reason: The text called the build linear, but build() uses queue.shift(), which is not guaranteed O(1). Stated the cost honestly; code unchanged.

Old:

```text
I traverse bottom-up, returning each subtree's height and using -1 as an imbalance signal. Each junction combines its two children in constant time, so the whole check is linear, and the sentinel lets the recursion stop as soon as any imbalance is found. Building the tree from the level-order array is also linear.
```

New:

```text
I traverse bottom-up, returning each subtree's height and using -1 as an imbalance signal. Each junction combines its two children in constant time, so the whole check is linear, and the sentinel lets the recursion stop as soon as any imbalance is found. Rebuilding the tree from the level-order array is linear apart from its queue.shift() calls, which can cost up to O(n) each on a large queue in some engines; walking an index pointer through the array instead of shifting would keep the build strictly linear.
```

### ledger-tree-check

- Field: `solutions[BRUTE_FORCE].spaceComplexity` (finding 3)
- Reason: build() rebuilds the whole tree from the level-order array (O(n) nodes and queue), so O(h) alone understated the space.

Old:

```text
O(h) recursion depth
```

New:

```text
O(n) for the rebuilt nodes, plus an O(h) recursion stack
```

- Field: `solutions[OPTIMAL].spaceComplexity` (finding 3)
- Reason: build() rebuilds the whole tree from the level-order array (O(n) nodes and queue), so O(h) alone understated the space.

Old:

```text
O(h) recursion depth
```

New:

```text
O(n) for the rebuilt nodes, plus an O(h) recursion stack
```

### watchtower-placements

- Field: `solutions[BRUTE_FORCE].spaceComplexity` (finding 4)
- Reason: permute() copies prefix and remaining on every call, so n frames each hold O(n) elements; O(n) recursion depth was wrong.

Old:

```text
O(n) recursion depth
```

New:

```text
O(n²): each recursive frame holds its own copies of prefix and remaining
```

### task-order

- Field: `solutions[BRUTE_FORCE].timeComplexity` (finding 5)
- Reason: Each of up to tasks steps scans up to tasks candidates and checks every prerequisite for each, so the worst case is tasks² × prerequisites, not tasks × (tasks + prerequisites).

Old:

```text
O(tasks × (tasks + prerequisites))
```

New:

```text
O(tasks² × prerequisites)
```

- Field: `solutions[BRUTE_FORCE].interviewExplanation` (finding 5)
- Reason: Matches the corrected time complexity.

Old:

```text
Rescanning every task and prerequisite per step is correct but quadratic. Counting pending prerequisites and keeping ready tasks in a min-heap is Kahn's algorithm with a priority queue, which produces the lexicographically smallest order in (tasks + prerequisites) log tasks time.
```

New:

```text
Rescanning every task against every prerequisite on each step is correct but slow: O(tasks² × prerequisites) in the worst case. Counting pending prerequisites and keeping ready tasks in a min-heap is Kahn's algorithm with a priority queue, which produces the lexicographically smallest order in (tasks + prerequisites) log tasks time.
```

### dock-threshold

- Field: `solutions[BRUTE_FORCE].commonMistakes` (finding 6)
- Reason: BRUTE_FORCE commonMistakes/interviewExplanation were byte-identical copies of OPTIMAL and step 3 was boilerplate; rewritten for the brute-force approach.

Old:

```text
Returning immediately on equality may select a later duplicate.,When the midpoint fails, advance to mid + 1 so the search always shrinks.
```

New:

```text
Using capacity > load instead of capacity >= load, which skips a dock whose capacity equals the load exactly.,Returning 0 or capacities.length when no dock qualifies instead of -1.
```

- Field: `solutions[BRUTE_FORCE].interviewExplanation` (finding 6)
- Reason: BRUTE_FORCE commonMistakes/interviewExplanation were byte-identical copies of OPTIMAL and step 3 was boilerplate; rewritten for the brute-force approach.

Old:

```text
This is a search for the first qualifying position, not any matching value. I keep a half-open interval around the boundary and discard half of it at every comparison. Equal values remain on the qualifying side, which preserves the first-index requirement.
```

New:

```text
I scan the docks from left to right and return the first index whose capacity is at least the load, or -1 if the scan finishes without a match. Stopping at the first qualifying dock gives the earliest index even when capacities repeat. In the worst case that is O(n) comparisons. Because the capacities are sorted, the optimal solution binary searches for the qualifying boundary instead, discarding half of the remaining docks per comparison for O(log n) time.
```

- Field: `solutions[BRUTE_FORCE].steps[2].content` (finding 6)
- Reason: BRUTE_FORCE commonMistakes/interviewExplanation were byte-identical copies of OPTIMAL and step 3 was boilerplate; rewritten for the brute-force approach.

Old:

```text
After exploring every allowed candidate, return the best valid result under the statement’s rules.
```

New:

```text
For [2,5,5,9] and load 5, the scan rejects 2 and stops at index 1. With load 10 it checks all four docks and returns -1.
```

### quiet-badge

- Field: `solutions[BRUTE_FORCE].commonMistakes` (finding 6)
- Reason: BRUTE_FORCE commonMistakes/interviewExplanation were byte-identical copies of OPTIMAL and step 3 was boilerplate; rewritten for the brute-force approach.

Old:

```text
Returning a letter before reading the whole record can miss a later duplicate.,Returning an arbitrary unique map entry can ignore the required arrival order.
```

New:

```text
Returning the first letter that has appeared only once so far, which misses a later duplicate of that letter.,Counting only the letters after position i, which treats a letter that already appeared earlier as unique.
```

- Field: `solutions[BRUTE_FORCE].interviewExplanation` (finding 6)
- Reason: BRUTE_FORCE commonMistakes/interviewExplanation were byte-identical copies of OPTIMAL and step 3 was boilerplate; rewritten for the brute-force approach.

Old:

```text
I count every badge letter first, then scan the record in its original order. This preserves the earliest-arrival requirement while avoiding a full recount for each position. Two linear scans are O(n), and the fixed alphabet bounds the map size.
```

New:

```text
For each arrival I count how often its letter occurs in the whole record and return the first position whose count is one. Scanning positions in order gives the earliest arrival for free, but every position recounts the entire string, so it costs O(n²) time with O(1) extra space. The optimal solution counts every letter once in a frequency map and then scans the positions in order, which brings the time down to O(n).
```

- Field: `solutions[BRUTE_FORCE].steps[2].content` (finding 6)
- Reason: BRUTE_FORCE commonMistakes/interviewExplanation were byte-identical copies of OPTIMAL and step 3 was boilerplate; rewritten for the brute-force approach.

Old:

```text
After exploring every allowed candidate, return the best valid result under the statement’s rules.
```

New:

```text
For abacbd, positions 0, 1 and 2 (a, b, a) each have a count of 2. Position 3 holds c, which occurs once, so the scan stops and returns 3. If no count were one, it would return -1.
```

### lantern-steps

- Field: `solutions[BRUTE_FORCE].commonMistakes` (finding 6)
- Reason: BRUTE_FORCE commonMistakes/interviewExplanation were byte-identical copies of OPTIMAL and step 3 was boilerplate; rewritten for the brute-force approach.

Old:

```text
The state is the cost to arrive before paying to leave; mixing the two meanings double-counts fees.,The exit is at index n and must not read a nonexistent costs[n].
```

New:

```text
Reading costs[n] at the exit; visit must return 0 for any position at or beyond costs.length.,Starting only from platform 0 and forgetting that platform 1 is also a free starting choice.
```

- Field: `solutions[BRUTE_FORCE].interviewExplanation` (finding 6)
- Reason: BRUTE_FORCE commonMistakes/interviewExplanation were byte-identical copies of OPTIMAL and step 3 was boilerplate; rewritten for the brute-force approach.

Old:

```text
I define the state as the minimum cost to arrive at a position. The last move comes from one of two earlier platforms, including that platform’s departure fee. Computing each state once removes repeated recursion, and keeping only two states reduces extra space to constant.
```

New:

```text
I recursively try the one-step and two-step move from each platform, add that platform’s departure fee, and take the cheaper of the two starting platforms. Many routes pass through the same platform, so the same subproblem is recomputed and the number of calls grows exponentially, O(2^n) in the worst case, with O(n) recursion depth. The optimal solution computes the minimum arrival cost of each position once and reuses it, which gives O(n) time, and keeping only the last two values needs O(1) space.
```

- Field: `solutions[BRUTE_FORCE].steps[2].content` (finding 6)
- Reason: BRUTE_FORCE commonMistakes/interviewExplanation were byte-identical copies of OPTIMAL and step 3 was boilerplate; rewritten for the brute-force approach.

Old:

```text
After exploring every allowed candidate, return the best valid result under the statement’s rules.
```

New:

```text
For [4,9,2,7], visit(2) = 2 and visit(1) = 9 + min(2, 7) = 11, so visit(0) = 4 + min(11, 2) = 6. The cheaper starting platform is 0, so the answer is 6.
```

### parcel-checkpoints

- Field: `solutions[BRUTE_FORCE].commonMistakes` (finding 6)
- Reason: BRUTE_FORCE commonMistakes/interviewExplanation were byte-identical copies of OPTIMAL and step 3 was boilerplate; rewritten for the brute-force approach.

Old:

```text
Treating end as inclusive introduces an off-by-one error.,Forgetting the leading zero makes ranges beginning at index zero harder to handle correctly.
```

New:

```text
Treating end as inclusive adds parcels[end] and, when end equals parcels.length, reads past the end of the array.,Not returning 0 for a range with start equal to end; the loop must run while i < end so an empty range adds nothing.
```

- Field: `solutions[BRUTE_FORCE].interviewExplanation` (finding 6)
- Reason: BRUTE_FORCE commonMistakes/interviewExplanation were byte-identical copies of OPTIMAL and step 3 was boilerplate; rewritten for the brute-force approach.

Old:

```text
With many overlapping queries, repeated summation wastes work. I preprocess the checkpoint changes into prefix totals and answer each query in constant time. The end-exclusive convention also makes empty ranges work without a special branch.
```

New:

```text
For each range I add up the entries from start up to but not including end. That is simple and handles empty ranges naturally, but with q ranges of up to n entries it costs O(n × q) time (plus O(q) for the answers, with O(1) working space), and overlapping ranges re-add the same entries. The optimal solution builds prefix totals once in O(n) and answers each range with one subtraction, for O(n + q) time.
```

- Field: `solutions[BRUTE_FORCE].steps[2].content` (finding 6)
- Reason: BRUTE_FORCE commonMistakes/interviewExplanation were byte-identical copies of OPTIMAL and step 3 was boilerplate; rewritten for the brute-force approach.

Old:

```text
After exploring every allowed candidate, return the best valid result under the statement’s rules.
```

New:

```text
For [4,-2,7,3], range [0,2) adds 4 and -2 to get 2, range [1,4) adds -2, 7 and 3 to get 8, and range [2,2) adds nothing and returns 0.
```

### relay-window

- Field: `solutions[BRUTE_FORCE].commonMistakes` (finding 6)
- Reason: BRUTE_FORCE commonMistakes/interviewExplanation were byte-identical copies of OPTIMAL and step 3 was boilerplate; rewritten for the brute-force approach.

Old:

```text
Initializing the best total to zero fails when every valid sum is negative.,Compare each full window, including the initial window and the last possible window.
```

New:

```text
Initializing the best total to 0, which is wrong when every window total is negative; start from -Infinity or the first window.,Getting the last start index wrong: the final valid start is loads.length - width, so the loop must include it and must not read past the array.
```

- Field: `solutions[BRUTE_FORCE].interviewExplanation` (finding 6)
- Reason: BRUTE_FORCE commonMistakes/interviewExplanation were byte-identical copies of OPTIMAL and step 3 was boilerplate; rewritten for the brute-force approach.

Old:

```text
I first considered recomputing each reservation in O(n × width). Adjacent windows share width - 1 entries, so I maintain one running sum and update only the entering and leaving values. The algorithm takes linear time and constant extra space.
```

New:

```text
I try every starting index whose window fits, add up its width entries, and keep the largest total. That is easy to verify, but neighboring windows share width - 1 entries and the brute force adds them again, costing O(n × width) time with O(1) extra space. The optimal solution keeps one running sum and, for each shift, adds the entering value and subtracts the leaving value, which takes O(n) time.
```

- Field: `solutions[BRUTE_FORCE].steps[2].content` (finding 6)
- Reason: BRUTE_FORCE commonMistakes/interviewExplanation were byte-identical copies of OPTIMAL and step 3 was boilerplate; rewritten for the brute-force approach.

Old:

```text
After exploring every allowed candidate, return the best valid result under the statement’s rules.
```

New:

```text
For [3,1,5,2,6,1] and width 3, the starts 0 through 3 give totals 9, 8, 13 and 9 by re-adding three entries each time, so the best is 13.
```

### prefix-suggestions

- Field: `solutions[ALTERNATIVE].timeComplexity` (finding 7)
- Reason: String comparisons cost O(L), so both the sort and every binary-search probe pay a factor of L.

Old:

```text
O(n log n · L + m · (log n + L))
```

New:

```text
O(n log n * L + m * L * log n)
```

### peak-watch

- Field: `solutions[BRUTE_FORCE].interviewExplanation` (finding 8)
- Reason: (n - k + 1)·k with n <= 10^4 peaks near 2.5 × 10^7, not 10^8.

Old:

```text
Each window is scanned on its own, so the cost is O(n·k), up to 10^8 when k is around n/2.
```

New:

```text
Each window is scanned on its own, so the cost is O(n·k), at most about 2.5 × 10^7 element reads for n = 10^4 (the product (n - k + 1)·k peaks when k is around n/2).
```

### tile-side

- Field: `solutions[BRUTE_FORCE].commonMistakes[0]` (finding 9)
- Reason: The every(p % side === 0) check includes the shortest plank, so a larger start can never return a length that does not divide it; only the wasted-work claim is true.

Old:

```text
Starting from the longest plank, which wastes work and can return a length that does not divide the shortest plank.
```

New:

```text
Starting from the longest plank, which wastes work.
```

### lru-results

- Field: `solutions[OPTIMAL].timeComplexity` (finding S3)
- Reason: The O(1) claim depends on the engine’s Map iteration order after deletions.

Old:

```text
O(1) amortized per operation
```

New:

```text
O(1) amortized per operation, assuming Map keeps a linked insertion order (as in the judge’s QuickJS)
```

- Field: `solutions[OPTIMAL].interviewExplanation` (finding S3)
- Reason: Added an honest caveat about Map iteration after deletions.

Old:

```text
The classic design is a hash map plus a doubly linked list so lookups and recency moves are both constant time. JavaScript's Map iterates in insertion order, so deleting and re-inserting a key moves it to the most-recent end and the first iterated key is the least recently used. That gives the same O(1) behavior with far less code; in a language without ordered maps I would build the linked list explicitly.
```

New:

```text
The classic design is a hash map plus a doubly linked list so lookups and recency moves are both constant time. JavaScript's Map iterates in insertion order, so deleting and re-inserting a key moves it to the most-recent end and the first iterated key is the least recently used. That gives the same O(1) behavior with far less code; in a language without ordered maps I would build the linked list explicitly. This O(1) bound relies on the engine’s Map keeping a linked insertion order, as the judge’s QuickJS does; in engines where repeated deletions leave tombstones that iteration must skip, taking the first key can degrade, and the explicit linked list is the safe choice.
```

### popularity-cache

- Field: `solutions[OPTIMAL].timeComplexity` (finding S3)
- Reason: The O(1) claim depends on the engine’s Set iteration order after deletions.

Old:

```text
O(1) per operation
```

New:

```text
O(1) per operation, assuming Set keeps a linked insertion order (as in the judge’s QuickJS)
```

- Field: `solutions[OPTIMAL].interviewExplanation` (finding S3)
- Reason: Added an honest caveat about Set iteration after deletions.

Old:

```text
I keep a bucket of keys per use count, each an insertion-ordered Set so its first key is the least recently used at that count, plus a minFreq pointer. A use moves the key up one bucket and adjusts minFreq only if it emptied the minimum bucket. A new key always resets minFreq to 1. Everything is O(1). In languages without ordered sets, each bucket would be a doubly linked list with a map from key to node.
```

New:

```text
I keep a bucket of keys per use count, each an insertion-ordered Set so its first key is the least recently used at that count, plus a minFreq pointer. A use moves the key up one bucket and adjusts minFreq only if it emptied the minimum bucket. A new key always resets minFreq to 1. Everything is O(1). In languages without ordered sets, each bucket would be a doubly linked list with a map from key to node. This O(1) bound relies on the engine’s Set keeping a linked insertion order, as the judge’s QuickJS does; in engines where repeated deletions leave tombstones that iteration must skip, taking the first key can degrade, and the explicit linked list is the safe choice.
```

### word-groups

- Field: `solutions[OPTIMAL].timeComplexity` (finding S4)
- Reason: The final sorts compare strings of length up to L, so n log n comparisons cost O(L) each.

Old:

```text
O(n · L log L + n log n)
```

New:

```text
O(n * L log L + n * L log n)
```

### crate-combinations

- Field: `solutions[OPTIMAL].timeComplexity` (finding S8)
- Reason: Each recorded set is copied (up to n elements), which the old O(2^n) bound ignored.

Old:

```text
O(2^n) in the worst case, typically far less due to pruning
```

New:

```text
O(n * 2^n) counting the copy of each recorded set, typically far less due to pruning
```

- Field: `solutions[BRUTE_FORCE].timeComplexity` (finding S8)
- Reason: The old bound ignored the final lexicographic sort of the matching sets.

Old:

```text
O(2^n × n)
```

New:

```text
O(2^n × n) to enumerate and sum the subsets, plus the final sort of the matching sets (up to O(n² × 2^n) in the worst case)
```

### pattern-gate

- Field: `solutions[BRUTE_FORCE].spaceComplexity` (finding S8)
- Reason: Each frame advances the pattern index by one, so recursion depth is at most |p| + 1 and does not depend on |t|.

Old:

```text
O(|t| + |p|) recursion
```

New:

```text
O(|p|) recursion depth (at most |p| + 1 frames)
```

## Hint-ladder corrections (second commit)

A hint audit found hints that gave away the approach too early (hint 1 or 2 of 5 stating the full mapping or recurrence). Hints must escalate: hint 1 nudges toward the right question or observation, later hints reveal more, and only the last may state the full approach. This commit rewrites only the over-revealing hints. Hint counts, order and positions are unchanged, and the final hint of every problem is as strong as before (the only edit to a final hint is the grid-turn H5 claim below). Test cases, starter code, schemas, patterns, tags and code are untouched, except that the grid-turn texts were corrected as described. Hash rows for the 7 affected slugs are in the hash table above (watchtower-placements was already in it from the first commit; its New sha256 was updated to the value after this commit, its Old value is still origin/main).

The script audit of the other 99 problems (flagging hints 1 to 3 that contain a formula or recurrence, or share most of their words with the OPTIMAL approach text, then reading every flagged hint and the whole hint list) found one further clear case, `quiet-heist` H2. Remaining flagged hints (for example the gutter-capacity H1 observation, shared-mentor H2/H3, balance-runs H3, signal-flips H3, tower-tiles H3/H4, rising-marks H2) were judged borderline or acceptable and were not changed.

Hint indexes are zero-based `hints[i]` (position = i + 1).

### grid-turn

- Field: `hints[0].content`
- Reason: H1 gave the full index mapping (r, c) -> (c, n - 1 - r) as the very first hint. It is now a nudge: follow the corner pixels of a small example and notice how row and column change.

Old:

```text
Track where one pixel goes: the pixel at row r, column c moves to row c, column n - 1 - r.
```

New:

```text
Follow the four corner pixels of a small 3 x 3 image through the turn. How do the row and the column of a pixel change?
```

- Field: `hints[1].content`
- Reason: H2 only said that building a matrix from the formula is straightforward, which was an empty step after the old H1. It now carries the mapping in words (new row = old column, new column counted from the right using the old row), so the ladder escalates nudge, mapping, two-move decomposition (H3), transpose (H4), transpose + reverse (H5).

Old:

```text
Building a new matrix from that formula is straightforward.
```

New:

```text
A pixel's new row comes from its old column, and its new column is counted from the right-hand end using its old row. That is enough to fill a fresh matrix in one pass.
```

- Field: `hints[4].content`
- Reason: The final hint claimed the transpose-and-reverse shows how to rotate in place with O(1) extra memory, but the solution copies the input and the statement forbids mutation. The hint now says to apply both moves to a copy. The rotation recipe itself is unchanged.

Old:

```text
A transpose followed by reversing each row is a clockwise rotation. On a copy, that also shows how to rotate in place with O(1) extra memory.
```

New:

```text
A transpose followed by reversing each row is a clockwise rotation. Apply both moves to a copy of the input, because the input must not change.
```

- Field: `solutions[BRUTE_FORCE].interviewExplanation`
- Reason: The BRUTE_FORCE and OPTIMAL solutions have the same O(n²) time and space. They are two different constructions (direct index mapping vs. transpose then reverse), so the BRUTE solution was not replaced; adding one sentence that says the costs are equal is the honest fix. No genuinely different and simpler approach exists that would not be contrived, so the BRUTE_FORCE label and its code were kept; only the false impression of a cost difference was removed.

Old:

```text
Reading each output cell from its source cell is the most direct approach. It's already linear in the number of pixels; the only cost is the separate output matrix.
```

New:

```text
Reading each output cell from its source cell is the most direct approach. It is already linear in the number of pixels and has the same O(n²) time and space as the transpose-and-reverse solution; the two differ in how the result is built, not in cost.
```

- Field: `solutions[OPTIMAL].spaceComplexity`
- Reason: OPTIMAL claimed 'O(1) extra if rotating in place', but the code copies the input (O(n²) extra) and the statement forbids modifying the input. The in-place variant is now described as an unimplemented variant in the interview text only.

Old:

```text
O(n²) for the copy; O(1) extra if rotating in place
```

New:

```text
O(n²) for the copy
```

- Field: `solutions[OPTIMAL].interviewExplanation`
- Reason: OPTIMAL claimed 'O(1) extra if rotating in place', but the code copies the input (O(n²) extra) and the statement forbids modifying the input. The in-place variant is now described as an unimplemented variant in the interview text only.

Old:

```text
Rotation decomposes into a transpose and a row reversal, both easy to do in place. Here I copy first because the input must not change, but if in-place were allowed this uses O(1) extra space, which is the usual interview follow-up. Swapping only above the diagonal is the key detail.
```

New:

```text
Rotation decomposes into a transpose and a row reversal. The input must not change, so I copy it first and apply both moves to the copy, which costs O(n²) extra space. The same two moves applied directly to a mutable matrix would need only O(1) extra space, but that variant is not implemented here because this problem forbids modifying the input. Swapping only above the diagonal is the key detail.
```

### warehouse-routes

- Field: `hints[0].content`
- Reason: H1 stated that every route comes from the cell above or the left, and H2 then wrote the full recurrence. H1 is now a question about the last step of a route.

Old:

```text
Every route into a cell arrives either from the cell above or from the cell to the left.
```

New:

```text
Look at the very last step of any route into a cell. Which cells could that step have started from?
```

- Field: `hints[1].content`
- Reason: H2 was the full recurrence routes(r, c) = routes(r - 1, c) + routes(r, c - 1) at hint 2 of 5. It now states only which cells can be entered from where (and that shelves cannot be entered) and asks how the counts of those cells help. H3 to H5 (count instead of enumerate, row-by-row table, single row) are unchanged.

Old:

```text
So routes(r, c) = routes(r - 1, c) + routes(r, c - 1) for an open cell, and 0 for a shelf.
```

New:

```text
A cell can only be entered from the cell above or from the cell to its left, and a shelf can never be entered. How could the route counts of those two cells help you count the routes into this one?
```

### watchtower-placements

- Field: `hints[0].content`
- Reason: H1 gave the whole row-by-row search skeleton (exactly one tower per row, decide rows one at a time). It is now a question about how many towers a row can hold. H2 (choose a column for each row) is unchanged and now is the hint that introduces the row-by-row search.

Old:

```text
Because size towers must avoid sharing rows, every row holds exactly one tower; decide rows one at a time.
```

New:

```text
No two towers may share a row, and there are exactly size towers. What does that tell you about how many towers each row holds?
```

### ridge-trails

- Field: `hints[1].content`
- Reason: H2 was the full recurrence longest(cell) = 1 + max(longest(neighbor)). It now asks how the longest trail from a cell relates to the longest trails from its higher neighbors. H3 to H5 (no cycles, cache, topological order) are unchanged.

Old:

```text
longest(cell) = 1 + the maximum of longest(neighbor) over neighbors that are strictly higher.
```

New:

```text
Look at one cell and its strictly higher neighbors. How does the longest trail starting at the cell relate to the longest trails starting at those neighbors?
```

### mirror-cuts

- Field: `hints[1].content`
- Reason: H2 gave the recurrence cuts[i] = cuts[j] + 1 when text[j..i) is a palindrome. It still defines cuts[i] (H4 and H5 use it) but now only asks what remains in front of a palindromic last piece. H4 still holds the update rule and H5 the initialisation.

Old:

```text
Let cuts[i] be the fewest cuts for the first i letters. If text[j..i) is a palindrome, cuts[i] can be cuts[j] + 1.
```

New:

```text
Let cuts[i] be the fewest cuts for the first i letters. In the best split of those letters, the last piece is a palindrome; what remains in front of it?
```

### fewest-tokens

- Field: `hints[1].content`
- Reason: H2 gave the full recurrence (one more than the fewest tokens for amount minus a token value). It now asks what is left, and what is known about it, after removing one token from an optimal payout.

Old:

```text
The fewest tokens for an amount is one more than the fewest tokens for amount minus some token value.
```

New:

```text
Look at one token in an optimal payout. If you take it away, what is left, and what do you know about the payout of that smaller amount?
```

- Field: `hints[2].content`
- Reason: H3 began with 'That recurrence', which referred to the old H2. Reworded so it stands alone ('Trying each token as the last one revisits the same smaller amounts'); the memoisation advice is unchanged.

Old:

```text
That recurrence revisits the same amounts many times, so store the answer for each amount.
```

New:

```text
Trying each token as the last one revisits the same smaller amounts many times, so store the answer for each amount.
```

### quiet-heist

- Field: `hints[1].content`
- Reason: H2 was the full DP recurrence best(i) = max(best(i - 1), best(i - 2) + houses[i]) at hint 2 of 5, the same kind of give-away as the six audited problems. Found by the script audit. It now only names the use-it-or-not choice and asks what each choice leaves available. H3 to H5 are unchanged.

Old:

```text
On a line: best(i) = max(best(i - 1), best(i - 2) + houses[i]).
```

New:

```text
Take the line version first. For house i there are only two choices, use it or not. What does each choice leave you free to use among the earlier houses?
```

## Notes

- All findings were re-verified against the JSON and code before editing and all were applied; none was rejected.
- Findings 2 and 3: the BRUTE and OPTIMAL `timeComplexity` fields of balanced-canopy and ledger-tree-check were left as they were. They describe the traversal; the `queue.shift()` caveat is stated in the balanced-canopy interview text only, because ledger-tree-check's text never called the build linear.
- No test pinned any of the old strings, so no test was changed. The existing QuickJS sandbox gate (`tests/library-sandbox.test.ts`) runs every authored solution, including the new first-redundant-link OPTIMAL code.
- Older phase guides under `docs/` quote earlier seed text; they are historical and were not edited.
- Second commit: the seed hash of the 7 slugs in the hint-ladder section differs from production in the same way as the first 18; the same reconciliation and the same `db:seed` warning apply to all 24.
