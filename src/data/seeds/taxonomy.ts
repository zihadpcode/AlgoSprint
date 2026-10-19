// Stable slugs are shared by validation, imports, and the future filter UI.
export const CATEGORIES = [
  ["arrays", "Arrays"], ["strings", "Strings"], ["hash-maps", "Hash Maps"],
  ["two-pointers", "Two Pointers"], ["sliding-window", "Sliding Window"],
  ["stack", "Stack"], ["queue", "Queue"], ["linked-list", "Linked List"],
  ["trees", "Trees"], ["binary-search-trees", "Binary Search Trees"],
  ["heaps", "Heaps / Priority Queues"], ["graphs", "Graphs"],
  ["bfs", "BFS"], ["dfs", "DFS"], ["backtracking", "Backtracking"],
  ["dynamic-programming", "Dynamic Programming"], ["greedy", "Greedy Algorithms"],
  ["binary-search", "Binary Search"], ["intervals", "Intervals"],
  ["sorting", "Sorting"], ["recursion", "Recursion"], ["bit-manipulation", "Bit Manipulation"],
  ["math", "Math"], ["tries", "Tries"], ["union-find", "Union Find"],
  ["topological-sort", "Topological Sort"], ["design", "Design Problems"],
  ["system-design", "System Design Basics"], ["sql", "SQL Problems"],
  ["object-oriented", "Object-Oriented Programming Interview Problems"],
] as const;

// One level of grouping above the leaf categories. Groups are NOT in CATEGORIES: problems link to leaves only.
// Seeding is insert-only (prisma/seed-categories.ts), so a published leaf is never moved to another group by a rerun.
// To add a group or a subcategory safely, follow docs/TAXONOMY.md. Child order is display order within the group.
export const CATEGORY_GROUPS = [
  { slug: "data-structures", name: "Data Structures", position: 1, children: [
    "arrays", "strings", "hash-maps", "stack", "queue", "linked-list", "trees", "binary-search-trees",
    "heaps", "graphs", "tries", "union-find",
  ] },
  { slug: "algorithms", name: "Algorithms", position: 2, children: [
    "two-pointers", "sliding-window", "bfs", "dfs", "backtracking", "dynamic-programming", "greedy",
    "binary-search", "intervals", "sorting", "recursion", "bit-manipulation", "math", "topological-sort",
  ] },
  { slug: "design-and-systems", name: "Design and Systems", position: 3, children: ["design", "system-design", "object-oriented"] },
  { slug: "databases", name: "Databases", position: 4, children: ["sql"] },
] as const;

export const TAGS = [
  ["prefix-sum", "Prefix Sum"], ["frequency-count", "Frequency Count"],
  ["fixed-window", "Fixed Window"], ["monotone-search", "Monotone Search"],
  ["state-transition", "State Transition"], ["linear-scan", "Linear Scan"],
  ["hashing", "Hashing"], ["pointer-pair", "Pointer Pair"], ["simulation", "Simulation"],
  ["grid", "Grid"], ["graph-traversal", "Graph Traversal"], ["priority-queue", "Priority Queue"],
  ["recursion", "Recursion"], ["memoization", "Memoization"], ["sorting", "Sorting"],
  ["bitwise", "Bitwise"], ["invariant", "Invariant"],
] as const;

export const INTERVIEW_STYLES = [["general-software", "General Software Interview"]] as const;
export const PATTERNS = [
  "prefix-sum", "frequency-count", "fixed-window", "lower-bound", "one-dimensional-dp", "two-pointers", "upper-bound",
  "linear-scan", "hash-map", "variable-window", "stack-matching", "monotonic-stack", "queue-simulation",
  "fast-slow-pointers", "tree-recursion", "bounded-recursion", "heap-greedy", "bfs", "flood-fill", "dijkstra",
  "backtracking", "two-dimensional-dp", "increasing-subsequence", "greedy", "binary-search-answer",
  "interval-merge", "union-find", "topological-sort", "trie", "xor", "sieve", "design",
  "sweep-line", "bit-counting", "gcd", "inorder-traversal", "rotated-binary-search", "stack-evaluation",
  "unbounded-knapsack", "multi-source-bfs", "top-k", "monotonic-deque", "two-heaps",
  "matrix-transform", "k-way-merge", "memoized-dfs", "bridges", "wildcard-dp",
  "sliding-log", "timestamp-binary-search", "partition-binary-search", "palindrome-dp", "fenwick-tree",
  "pointer-reversal", "boyer-moore", "binary-trie", "minimax-path", "state-space-bfs",
] as const;
