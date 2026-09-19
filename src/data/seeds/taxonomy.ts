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

export const TAGS = [
  ["prefix-sum", "Prefix Sum"], ["frequency-count", "Frequency Count"],
  ["fixed-window", "Fixed Window"], ["monotone-search", "Monotone Search"],
  ["state-transition", "State Transition"], ["linear-scan", "Linear Scan"],
] as const;

export const INTERVIEW_STYLES = [["general-software", "General Software Interview"]] as const;
export const PATTERNS = ["prefix-sum", "frequency-count", "fixed-window", "lower-bound", "one-dimensional-dp", "two-pointers", "upper-bound"] as const;
