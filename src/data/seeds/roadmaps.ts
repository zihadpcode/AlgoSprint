import type { RoadmapSeed } from "../../lib/validators/roadmap";

// Original short paths through the reviewed collection, not a complete DSA curriculum.
export const ROADMAPS = [
  {
    slug: "scan-store-reuse", title: "Scan, Store, Reuse", difficulty: "MEDIUM", estimatedMinutes: 75,
    description: "Turn repeated scans into reusable information. Start with counting, keep a running window, then prepare totals for many questions. Allow extra time to trace examples and explain each tradeoff.",
    steps: [
      { problemSlug: "quiet-badge", title: "Count before choosing", description: "Record letter frequencies, then preserve arrival order when choosing an answer. Explain why seeing a letter once so far is not enough." },
      { problemSlug: "relay-window", title: "Update instead of recounting", description: "Carry one window total forward by removing the outgoing load and adding the incoming one. Trace an all-negative example." },
      { problemSlug: "parcel-checkpoints", title: "Prepare totals for later questions", description: "Build cumulative totals once and subtract two checkpoints for each range. Connect this preprocessing tradeoff to the state reused in the previous steps." },
    ],
  },
  {
    slug: "boundaries-to-decisions", title: "Boundaries to Decisions", difficulty: "MEDIUM", estimatedMinutes: 65,
    description: "Practice stating what a search or recurrence means before coding it. This short path moves from a sorted boundary to the cheapest sequence of decisions; it is not a full search or dynamic programming course.",
    steps: [
      { problemSlug: "dock-threshold", title: "Keep the earliest valid boundary", description: "Use sorted capacities to narrow the first qualifying dock. State the search interval invariant and trace duplicates and an empty list." },
      { problemSlug: "lantern-steps", title: "Define the cost of reaching a state", description: "Write the meaning and base cases of each stored cost before the recurrence. Carry forward the habit of checking boundaries, then compare a table with rolling state." },
    ],
  },
] satisfies RoadmapSeed[];
