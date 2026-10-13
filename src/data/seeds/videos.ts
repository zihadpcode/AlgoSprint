import type { VideoSeed } from "@/lib/validators/video";

// Every video below was checked against YouTube's keyless oEmbed endpoint (HTTP 200, title and author as recorded here)
// on 2026-10-13, and every segment is a chapter published in that video's own description on the same date. Never
// add a video id, title, channel or timestamp from memory; see docs/VIDEO-SOLUTIONS.md. All videos teach a concept
// through a reference problem that differs from (or only resembles) the target problem it is attached to.
type Source = Pick<VideoSeed, "youtubeId" | "title" | "channel" | "segments">;
const seg = (startSeconds: number, endSeconds: number, label: string) => ({ startSeconds, endSeconds, label });

const longestSubstring: Source = {
  youtubeId: "wiGpQwVHdE0", channel: "NeetCode", title: "Longest Substring Without Repeating Characters - Leetcode 3 - Python",
  segments: [seg(0, 280, "Conceptual"), seg(280, 405, "Coding solution")],
};
const containerWater: Source = {
  youtubeId: "UuiTKBwPgAo", channel: "NeetCode", title: "Container with Most Water - Leetcode 11 - Python",
  segments: [seg(0, 325, "Brute force"), seg(325, 570, "Optimal solution"), seg(570, 756, "Coding the optimal solution")],
};
const binarySearch: Source = {
  youtubeId: "s4DPM8ct1pI", channel: "NeetCode", title: "Binary Search - Leetcode 704 - Python",
  segments: [seg(58, 310, "Drawing explanation"), seg(310, 579, "Coding explanation")],
};
const subarraySumK: Source = {
  youtubeId: "fFVZt-6sgyo", channel: "NeetCode", title: "Subarray Sum Equals K - Prefix Sums - Leetcode 560 - Python",
  segments: [seg(147, 791, "Drawing explanation"), seg(791, 918, "Coding explanation")],
};
const twoSum: Source = {
  youtubeId: "KLlXCFG5TnA", channel: "NeetCode", title: "Two Sum - Leetcode 1 - HashMap - Python",
  segments: [seg(0, 110, "Brute force (conceptual)"), seg(110, 414, "One pass (conceptual)"), seg(414, 506, "Coding the one pass solution")],
};
const validParentheses: Source = {
  youtubeId: "WTzjTskDFMg", channel: "NeetCode", title: "Valid Parentheses - Stack - Leetcode 20 - Python",
  segments: [seg(85, 440, "Drawing explanation"), seg(440, 643, "Coding explanation")],
};
const dailyTemperatures: Source = {
  youtubeId: "cTBiBSnjO3c", channel: "NeetCode", title: "Daily Temperatures - Monotonic Stack - Leetcode 739 - Python",
  segments: [seg(111, 565, "Drawing explanation"), seg(565, 712, "Coding explanation")],
};
const kthLargestStream: Source = {
  youtubeId: "hOjcdrqMoQ8", channel: "NeetCode", title: "Kth Largest Element in a Stream - Leetcode 703 - Python",
  segments: [seg(140, 490, "Drawing explanation"), seg(490, 677, "Coding explanation")],
};
const numberOfIslands: Source = {
  youtubeId: "pV2kpPD66nE", channel: "NeetCode", title: "NUMBER OF ISLANDS - Leetcode 200 - Python",
  segments: [seg(0, 300, "Conceptual solution"), seg(300, 701, "Coding")],
};
const courseScheduleTwo: Source = {
  youtubeId: "Akt3glAwyfY", channel: "NeetCode", title: "Course Schedule II - Topological Sort - Leetcode 210",
  segments: [seg(145, 640, "Drawing explanation"), seg(640, 1029, "Coding explanation")],
};
const redundantConnection: Source = {
  youtubeId: "FXWRE67PLL0", channel: "NeetCode", title: "Redundant Connection - Union Find - Leetcode 684 - Python",
  segments: [seg(120, 650, "Drawing explanation"), seg(650, 964, "Coding explanation")],
};
const houseRobber: Source = {
  youtubeId: "73r3KWiEvyk", channel: "NeetCode", title: "House Robber -  Leetcode 198 - Python Dynamic Programming",
  segments: [seg(0, 483, "Conceptual"), seg(483, 635, "Coding the optimal solution")],
};
const subsets: Source = {
  youtubeId: "REOH22Xwdkk", channel: "NeetCode", title: "Subsets - Backtracking - Leetcode 78",
  segments: [seg(75, 330, "Drawing explanation"), seg(330, 527, "Coding explanation")],
};
const mergeIntervals: Source = {
  youtubeId: "44H3cEC2fFM", channel: "NeetCode", title: "Merge Intervals - Sorting - Leetcode 56",
  segments: [seg(85, 340, "Drawing solution"), seg(340, 614, "Coding solution")],
};

function video(problemSlug: string, source: Source, concept: string, referenceProblem: string, bridge: string): VideoSeed {
  return { problemSlug, ...source, concept, referenceProblem, bridge };
}

export const VIDEOS: VideoSeed[] = [
  video("cipher-window", longestSubstring, "Variable-size sliding window", "Longest Substring Without Repeating Characters (LeetCode 3)",
    "The video grows a window one character at a time and moves its left edge forward to restore a rule about what the window may contain. Here the rule is reversed: the window must contain every letter of the pattern, repeats included, so you track which letters are still missing as the right edge grows. The video looks for the longest valid window while you want the shortest, so the moment at which you record an answer and shrink from the left is different."),
  video("gutter-capacity", containerWater, "Two pointers moving inward from both ends", "Container with Most Water (LeetCode 11)",
    "The video starts one pointer at each end of the heights and moves the pointer on the shorter side inward, because the shorter side is what limits the container. Water on a roof also depends on the lower of the walls on either side, so asking which side is currently the limit tells you which pointer can safely advance. What you accumulate differs: the video keeps the best single container, while this problem adds up the water held above every block as the pointers close in."),
  video("dock-threshold", binarySearch, "Binary search on a sorted array", "Binary Search (LeetCode 704)",
    "The video repeatedly halves a sorted range using a low and a high pointer and a midpoint. The dock capacities are sorted as well, so the same halving applies; the change is the question you ask at the midpoint. Instead of stopping at an exact match you want the earliest index whose capacity is at least the load, so a qualifying midpoint is a candidate to remember while the search continues to its left, which matters when capacities repeat."),
  video("parcel-checkpoints", subarraySumK, "Prefix sums", "Subarray Sum Equals K (LeetCode 560)",
    "The video builds a running total of the array and reasons about the difference between two running totals to get the sum of a stretch. Each of your ranges is exactly such a stretch: its total is the running total before the end index minus the running total before the start index. The video pairs prefix sums with a hash map to count matching stretches; here you only need the prefix totals themselves, built once and then read once per range."),
  video("ticket-pair", twoSum, "Hash map lookup of a complement", "Two Sum (LeetCode 1)",
    "This problem is a close variant of the video's example: for each price you ask whether the amount that would complete the budget was already seen, and a hash map answers that without rescanning. The part the video does not cover is the tie-break rule that decides which valid pair to return, so check what your map stores for repeated prices against that rule. You also need to return [-1, -1] when no pair matches."),
  video("bracket-run", validParentheses, "Stack of unmatched openers", "Valid Parentheses (LeetCode 20)",
    "The video pushes opening brackets onto a stack and checks every closing bracket against the top of the stack. Your string has only two kinds of bracket, so the matching itself is simpler, but you need more than a yes or no: the answer is the length of the longest well-formed stretch. Think about what the stack should remember, such as positions instead of characters, so that when a closing bracket matches you can tell how long the valid stretch ending there is."),
  video("billboard-space", dailyTemperatures, "Monotonic stack", "Daily Temperatures (LeetCode 739)",
    "The video keeps a stack of indices whose answers are still unknown and pops them when a value that settles them arrives, so each index is pushed and popped once. For each building the question here is how far a billboard can extend before meeting a shorter building, which is a similar next-smaller-value question with the comparison reversed. When the incoming height is lower than the one on top, the popped building's reach is settled, and the indices that remain on the stack give you its width."),
  video("nearest-beacons", kthLargestStream, "Fixed-size heap of the best k items", "Kth Largest Element in a Stream (LeetCode 703)",
    "The video keeps only the k most relevant values in a heap and evicts the one that no longer qualifies, so the work stays proportional to k instead of the whole input. Here the values are beacons ranked by distance from the origin and you want the k closest, so the item to evict is the farthest one kept so far. The video reads a single value off the heap; you return all k beacons in the order the statement requires, with its tie-break rules, so the final ordering is still your job."),
  video("mold-spread", numberOfIslands, "Grid traversal over connected cells", "Number of Islands (LeetCode 200)",
    "The video visits the cells of a grid by moving up, down, left and right and marks each visited cell so it is never processed twice. Mold uses the same four-direction neighbors, but exploring from one cell is not enough: every spoiled loaf starts spreading in the same minute, so you start from all of them together and count rounds. The video counts separate groups of land; you count how many minutes the spread needs, and fresh bread that is never reached means -1."),
  video("grid-rescue-hops", numberOfIslands, "Grid traversal over connected cells", "Number of Islands (LeetCode 200)",
    "The video moves through a grid to the four orthogonal neighbors and remembers visited cells, which is the movement model you need here: no diagonals, no entering shelves, no leaving the floor. The video asks how many separate regions exist, while this problem asks for the fewest hops from S to T, so you must explore in order of distance from the start and record how many hops had been taken when T is reached. Return -1 if the exploration ends without reaching T."),
  video("module-plan", courseScheduleTwo, "Topological ordering and cycle detection", "Course Schedule II (LeetCode 210)",
    "The video turns prerequisites into a directed graph and decides whether every course can be ordered after what it needs, which fails exactly when the graph has a cycle. Your pairs describe the same kind of graph, and you only need a yes or no for whether a valid order exists, so showing that no cycle exists is enough. The video also produces an actual order, which this problem does not ask for."),
  video("task-order", courseScheduleTwo, "Topological ordering and cycle detection", "Course Schedule II (LeetCode 210)",
    "The video builds a graph from prerequisite pairs and produces an order that respects them, returning nothing when a cycle makes that impossible; this problem has the same two outcomes. Note the direction of each pair: here [before, after] lists the earlier task first, the opposite reading of the video's course pairs. The extra rule is that among all valid orders you must always run the smallest-numbered ready task, so you need a way to keep the ready tasks ordered rather than taking them in any order."),
  video("radio-clusters", redundantConnection, "Union-find (disjoint set union)", "Redundant Connection (LeetCode 684)",
    "The video gives every node a group and merges the groups of the two ends of each edge, using find to ask which group a node belongs to. Starting with every tower as its own cluster, a link that joins two different clusters reduces the cluster count by one, while a link inside one cluster changes nothing. The video stops at the first edge that closes a loop; you process every link and report how many clusters remain."),
  video("ledger-equalities", redundantConnection, "Union-find (disjoint set union)", "Redundant Connection (LeetCode 684)",
    "The video's union-find structure answers whether two items are already connected. The equal-to facts connect accounts into groups that hold the same amount, so merge those first. Each not-equal-to fact is then a check on the finished groups: it contradicts the ledger if both accounts ended up in the same group. In the video an edge between already connected nodes is the answer; here the connection test is applied after all merges."),
  video("quiet-heist", houseRobber, "One-dimensional dynamic programming", "House Robber (LeetCode 198)",
    "The video solves the straight-line version: at each house you either skip it or take it together with the best total from earlier houses, and only the last two results need to be kept. This problem is the same decision with one twist, because the first and last houses are neighbors and cannot both be taken. Think about how the circle changes which houses may be chosen together and how to reduce it to the straight-line problem the video solves; a circle of one house needs separate care."),
  video("crate-combinations", subsets, "Backtracking over include-or-skip choices", "Subsets (LeetCode 78)",
    "The video builds every subset by deciding for each element in turn whether to include it, recursing, and then undoing the choice. Crate combinations walks the same decision tree, but you keep only the sets whose weights add up to exactly the target. Because every weight is positive, a branch whose running total already passes the target can be abandoned, and sorting the weights first helps produce the required output order."),
  video("quiet-hours", mergeIntervals, "Sorting then sweeping intervals", "Merge Intervals (LeetCode 56)",
    "The video sorts intervals by start and sweeps through them, extending the current block while the next one overlaps. The free time you want is the space between those merged blocks, so merge first and then read off the gaps. Mind the boundary rule: here a block is [start, end), so a block that begins exactly when the previous one ends leaves no gap."),
  video("slot-insert", mergeIntervals, "Sorting then sweeping intervals", "Merge Intervals (LeetCode 56)",
    "The video merges overlapping intervals while sweeping through a list ordered by start. Your calendar is already sorted and disjoint, so no sorting is needed: slots that end before the new slot starts stay as they are, slots that overlap it fold into one growing block, and the remaining slots follow unchanged. The overlap test is the same idea as in the video, and both endpoints count here, so touching at a single minute is an overlap."),
];
