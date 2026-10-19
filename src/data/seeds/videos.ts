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

// Batch 2 (added 2026-10-14). Same rules as above: id, title and channel were returned by oEmbed (HTTP 200) on this date;
// segments are chapters published in the video's own description (the "Read the problem" chapter is skipped, and a
// segment ends where the next chapter starts or at the video length reported by the watch page). The Longest Common
// Subsequence video lists three chapters that are all named "Read the problem", so it carries no segments.
// Existing rows above are never edited: production seeding is insert-only.
const implementTrie: Source = {
  youtubeId: "oobqoCJlHA0", channel: "NeetCode", title: "Implement Trie (Prefix Tree) - Leetcode 208",
  segments: [seg(113, 700, "Drawing explanation"), seg(700, 1135, "Coding explanation")],
};
const networkDelay: Source = {
  youtubeId: "EaphyqKU4PQ", channel: "NeetCode", title: "Network Delay Time - Dijkstra's algorithm - Leetcode 743",
  segments: [seg(277, 877, "Drawing explanation"), seg(877, 1187, "Coding explanation")],
};
const longestCommonSubsequence: Source = {
  youtubeId: "Ua0GhsJSlWM", channel: "NeetCode", title: "Longest Common Subsequence - Dynamic Programming - Leetcode 1143",
  segments: [],
};
const coinChange: Source = {
  youtubeId: "H9bfqozjoqs", channel: "NeetCode", title: "Coin Change - Dynamic Programming Bottom Up - Leetcode 322",
  segments: [seg(90, 185, "Greedy doesn't work"), seg(185, 640, "DFS solution"), seg(640, 935, "Dynamic programming"), seg(935, 1163, "Coding solution")],
};
const coinChangeTwo: Source = {
  youtubeId: "Mjy4hd2xgrs", channel: "NeetCode", title: "Coin Change 2 - Dynamic Programming Unbounded Knapsack - Leetcode 518 - Python",
  segments: [
    seg(145, 357, "Brute force explained"), seg(357, 532, "Memoization explained"), seg(532, 820, "Naive DP explained"),
    seg(820, 1095, "Optimal space DP explained"), seg(1095, 1210, "Memoization code"), seg(1210, 1340, "O(n*m) space DP"), seg(1340, 1399, "O(n) space DP"),
  ],
};
const jumpGameTwo: Source = {
  youtubeId: "dJ7sWiOoK7g", channel: "NeetCode", title: "Jump Game II - Greedy - Leetcode 45 - Python",
  segments: [seg(126, 425, "Drawing explanation"), seg(425, 718, "Coding explanation")],
};
const linkedListCycle: Source = {
  youtubeId: "gBTe7lFR3vc", channel: "NeetCode", title: "Linked List Cycle - Floyd's Tortoise and Hare - Leetcode 141 - Python",
  segments: [seg(214, 562, "Drawing explanation"), seg(562, 643, "Coding explanation")],
};
const kokoBananas: Source = {
  youtubeId: "U2SozAs9RzA", channel: "NeetCode", title: "Koko Eating Bananas - Binary Search - Leetcode 875 - Python",
  segments: [seg(100, 415, "Intuition"), seg(415, 775, "Drawing explanation"), seg(775, 912, "Coding explanation")],
};
const numberOfOneBits: Source = {
  youtubeId: "5Km3utixwZs", channel: "NeetCode", title: "Number of 1 Bits - Leetcode 191 - Python",
  segments: [seg(70, 273, "Explain solution 1"), seg(273, 340, "Coding solution 1"), seg(340, 663, "Explain solution 2"), seg(663, 718, "Coding solution 2")],
};
const lruCache: Source = {
  youtubeId: "7ABFKPK2hD4", channel: "NeetCode", title: "LRU Cache - Twitch Interview Question - Leetcode 146",
  segments: [seg(120, 450, "Drawing solution"), seg(450, 1069, "Coding solution")],
};
const lastStoneWeight: Source = {
  youtubeId: "B-QCq79-Vfw", channel: "NeetCode", title: "Last Stone Weight - Priority Queue - Leetcode 1046 - Python",
  segments: [seg(112, 439, "Drawing explanation"), seg(439, 757, "Coding explanation")],
};
const longestIncreasingSubsequence: Source = {
  youtubeId: "cjWnW0hdF1Y", channel: "NeetCode", title: "Longest Increasing Subsequence - Dynamic Programming - Leetcode 300",
  segments: [seg(105, 178, "Brute force solution"), seg(178, 655, "DFS solution"), seg(655, 935, "Dynamic programming solution"), seg(935, 1093, "Coding solution")],
};
const palindromePartitioning: Source = {
  youtubeId: "3jvWodd7ht0", channel: "NeetCode", title: "Palindrome Partitioning - Backtracking - Leetcode 131",
  segments: [seg(100, 360, "Drawing explanation"), seg(360, 623, "Coding explanation")],
};
const regularExpressionMatching: Source = {
  youtubeId: "HAA8mgxlov8", channel: "NeetCode", title: "Regular Expression Matching - Dynamic Programming Top-Down Memoization - Leetcode 10",
  segments: [seg(235, 1140, "Drawing solution"), seg(1140, 1675, "Coding solution")],
};

// Batch 3 (added 2026-10-18). Same rules as above: id, title and channel were returned by oEmbed (HTTP 200) on this date;
// segments are chapters published in the video's own description (the "Read the problem" chapter is skipped, and a
// segment ends where the next chapter starts or at the video length reported by the watch page).
// Existing rows above are never edited: production seeding is insert-only.
const singleNumber: Source = {
  youtubeId: "qMPX1AOa83k", channel: "NeetCode", title: "Single Number - Leetcode 136 - Python",
  segments: [seg(38, 85, "O(n) Memory Solution"), seg(85, 376, "O(1) Memory Solution"), seg(376, 428, "Coding Solution")],
};

// Batch 4 (added 2026-10-18). Same rules as above: id, title and channel were returned by oEmbed (HTTP 200) on this date;
// segments are chapters published in the video's own description (the "Read the problem" chapter is skipped, and a
// segment ends where the next chapter starts or at the video length reported by the watch page).
// Existing rows above are never edited: production seeding is insert-only.
const permutations: Source = {
  youtubeId: "s7AvT7cGdSo", channel: "NeetCode", title: "Backtracking: Permutations - Leetcode 46 - Python",
  segments: [seg(0, 372, "Drawing explanation"), seg(372, 583, "Coding solution")],
};
const climbingStairs: Source = {
  youtubeId: "Y0lT9Fck7qI", channel: "NeetCode", title: "Climbing Stairs - Dynamic Programming - Leetcode 70 - Python",
  segments: [seg(235, 480, "Brute Force"), seg(480, 665, "Memoization"), seg(665, 1009, "Dynamic Programming"), seg(1009, 1087, "Coding DP")],
};
const gasStation: Source = {
  youtubeId: "lJwbPZGo05A", channel: "NeetCode", title: "Gas Station - Greedy - Leetcode 134 - Python",
  segments: [seg(100, 735, "Drawing Explanation"), seg(735, 947, "Coding Explanation")],
};
const topKFrequent: Source = {
  youtubeId: "YPTqKIgVk-k", channel: "NeetCode", title: "Top K Frequent Elements - Bucket Sort - Leetcode 347 - Python",
  segments: [seg(178, 582, "Drawing Explanation"), seg(582, 793, "Coding Explanation")],
};
const alienDictionary: Source = {
  youtubeId: "6kTZYvNNyps", channel: "NeetCode", title: "Alien Dictionary - Topological Sort - Leetcode 269 - Python",
  segments: [seg(286, 946, "Drawing Explanation"), seg(946, 1325, "Coding Explanation")],
};
const uniquePaths: Source = {
  youtubeId: "IlEsdxuD4lY", channel: "NeetCode", title: "Unique Paths - Dynamic Programming - Leetcode 62",
  segments: [seg(55, 500, "Drawing solution"), seg(500, 648, "Coding Solution")],
};
const groupAnagrams: Source = {
  youtubeId: "vzdNOK2oB2E", channel: "NeetCode", title: "Group Anagrams - Categorize Strings by Count - Leetcode 49",
  segments: [seg(0, 275, "Drawing solution"), seg(275, 491, "Coding solution")],
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

  // Batch 2 (added 2026-10-14).
  video("prefix-counts", implementTrie, "Trie (prefix tree)", "Implement Trie (Prefix Tree) (LeetCode 208)",
    "The video stores words as paths of letters in a prefix tree, so looking up a prefix means walking the same path letter by letter. Your task asks for a count rather than a yes or no: words can repeat, the empty prefix matches every word, and you answer a whole list of queries. Decide what each node should record, for example how many words pass through it, and what a prefix whose path leaves the tree should return."),
  video("prefix-suggestions", implementTrie, "Trie (prefix tree)", "Implement Trie (Prefix Tree) (LeetCode 208)",
    "The video stores words as paths in a prefix tree and follows one letter at a time, which is also how you follow what the visitor types. The answer at each step differs: instead of yes or no you report up to three words, the alphabetically smallest ones, that start with the typed letters so far. Think about whether to keep a short ordered list at each node or to collect words below the node in alphabetical order, and what to report once the typed prefix no longer matches any path."),
  video("cheapest-route", networkDelay, "Dijkstra's shortest path", "Network Delay Time (LeetCode 743)",
    "This problem is a close variant of the video's example: both ask for the cheapest travel cost from a source through a weighted network, which is the job of Dijkstra's algorithm, and tolls here are not negative either. What you must adapt is the question and the roads: you need the cost to one target stop, or -1 when it cannot be reached, instead of a single value summarizing every node as in the video's reference problem; your roads are two-way, the same two stops may be joined by several roads with different tolls, and a toll may be 0."),
  video("typo-distance", longestCommonSubsequence, "Dynamic programming over prefixes of two strings", "Longest Common Subsequence (LeetCode 1143)",
    "The video applies dynamic programming to two strings, deciding for prefixes of both whether their last letters match. Typo distance has the same two-string shape but a different goal and different transitions: it counts edits, and a mismatch is not a dead end because you can replace, insert or delete a letter, each costing 1. Work out what each of the three edits means for which prefixes you move to, and what the answers are when one of the words is empty, which costs the length of the other."),
  video("fare-combinations", coinChange, "Unbounded knapsack over amounts", "Coin Change (LeetCode 322)",
    "The video works with an unlimited supply of each coin value and builds answers for amounts up to the target. Your ferry also has unlimited tickets of each value, but you count combinations instead of finding the fewest tickets. Combinations are unordered, so two of value 1 plus one of value 2 must be counted once; how you nest the loops over ticket values and over amounts decides whether different orderings are counted separately. The amount 0 has exactly one way, and the count is taken modulo 1000000007."),
  video("fewest-tokens", coinChangeTwo, "Unbounded knapsack over amounts", "Coin Change II (LeetCode 518)",
    "The video's reference problem counts the combinations of coins that make an amount when each value has an unlimited supply, building answers from smaller amounts. Fewest Tokens has the same unlimited supply but asks for the smallest number of tokens, so each entry stores a minimum instead of a number of ways. The reference problem is about unordered combinations, whereas for a minimum only the count of tokens matters. Decide how to represent an amount that cannot be formed so that it is reported as -1, and note that the amount 0 needs zero tokens."),
  video("charging-hops", jumpGameTwo, "Greedy reach along an array of jump lengths", "Jump Game II (LeetCode 45)",
    "The video's reference problem also gives, for each position, how far you can jump forward, and its title names a greedy approach. There the task is the fewest jumps. Here you only need a yes or no: can the scooter reach the last station at all? A range of 0 can leave the scooter stuck short of the end, so decide how to detect that from the farthest station reached so far. A road with a single station is already reachable."),
  video("middle-car", linkedListCycle, "Fast and slow pointers on a linked chain", "Linked List Cycle (LeetCode 141)",
    "The video moves two pointers along a linked list at different speeds. The same pair finds the middle car: when the faster pointer, moving two cars at a time, runs off the end of the chain, the slower pointer, moving one car at a time, is at the middle. The video looks for a loop; your chain always ends at -1 and visits every car exactly once, so the stopping condition is the end of the chain rather than the pointers meeting. Check the even-length rule, since you want the second of the two middle cars, which depends on exactly when you stop."),
  video("chain-loop-start", linkedListCycle, "Fast and slow pointers on a linked chain", "Linked List Cycle (LeetCode 141)",
    "This problem is a close variant of the video's example: the chain is a linked list where next[i] is the link, and the first question, whether the chain ends at -1 or loops forever, is the one the video's pointers answer. What you must adapt is the result: the video's reference problem only asks whether a loop exists, while you return the index of the first station on the loop, or -1 when the chain ends, including when head is -1. The place where the two pointers meet is not in general the start of the loop, so think about how to find the start from there while keeping constant extra memory."),
  video("bake-batches", kokoBananas, "Binary search on the answer", "Koko Eating Bananas (LeetCode 875)",
    "The video does not search through the input but through the possible answers: pick a candidate eating speed, check whether it is fast enough, and narrow the range accordingly. Here the unknown is the oven capacity, and the check is different: the trays must stay in order and go into consecutive blocks, so for a candidate capacity you walk through the trays, start a new day when the next tray would overflow, and compare the days used with days. Think about the range to search: the capacity cannot be smaller than the heaviest tray and never needs to exceed the total weight."),
  video("lit-panels", numberOfOneBits, "Counting set bits", "Number of 1 Bits (LeetCode 191)",
    "The video counts the 1 bits of a single number, and its chapters present two different solutions. Your board needs that count for every number from 0 through count, so applying a per-number count to each one works, but you can also reuse answers you have already computed for smaller numbers. Look at how the count for a number relates to the count for the number you get by dropping its lowest bit. Remember that entry 0 is 0 and the array has count + 1 entries."),
  video("signal-flips", numberOfOneBits, "Counting set bits", "Number of 1 Bits (LeetCode 191)",
    "The video counts how many bits of one number are 1. The toggles to flip between a and b are exactly the bit positions where the two numbers differ, so the task reduces to producing one number whose 1 bits mark those positions and then counting its 1 bits as in the video. Ask which bitwise operation turns a position where the bits differ into 1 and a position where they agree into 0. Equal inputs give 0 flips."),
  video("popularity-cache", lruCache, "Cache design with an eviction order", "LRU Cache (LeetCode 146)",
    "The video designs a cache of fixed capacity that evicts the least recently used key and keeps both get and put fast. Yours also evicts when full, but the first rule is the use count: the least frequently used key goes, and only among keys tied on the lowest count does the recency rule from the video decide. Both a get of a present key and every put, including an update of an existing key, count as a use, so you need to keep track of each key's count and, per count, the order in which keys were used, plus a way to know the lowest count."),
  video("splice-cables", lastStoneWeight, "Priority queue that repeatedly combines two items", "Last Stone Weight (LeetCode 1046)",
    "The video keeps its items in a priority queue, repeatedly takes two of them out, combines them and puts a result back. Your crew also repeatedly takes two pieces and puts one combined piece back, but the rule differs: you must decide which two pieces to take so that the total labor stays as small as possible, and instead of keeping only a leftover you add a + b to a running total each time you join. No pieces or a single piece costs nothing, so check that your loop condition handles those cases."),
  video("nested-crates", longestIncreasingSubsequence, "Longest increasing subsequence", "Longest Increasing Subsequence (LeetCode 300)",
    "The video finds the longest strictly increasing subsequence of one list of numbers. A crate has two dimensions, so the first step is to order the crates so that the question becomes an increasing subsequence in one dimension, for example by width and then looking at heights. Strictness matters in both dimensions: crates with the same width can never nest, so decide how to order crates of equal width so that two of them cannot both end up in one increasing chain of heights. With up to 10000 crates, check the time limit against the approach you pick."),
  video("mirror-cuts", palindromePartitioning, "Palindrome partitioning", "Palindrome Partitioning (LeetCode 131)",
    "The video cuts a string into pieces that are all palindromes, trying each possible first piece and continuing with the rest of the string. You want only the smallest number of cuts rather than every way to split, and the text can be 2000 letters long, so listing every split is too slow. What carries over is testing whether a stretch of the text is a palindrome and choosing where the next piece ends. Think about how to remember the best result for each position so that nothing is recomputed, and how to avoid testing the same stretch repeatedly."),
  video("pattern-gate", regularExpressionMatching, "Dynamic programming over text and pattern positions", "Regular Expression Matching (LeetCode 10)",
    "The video matches a text against a pattern using dynamic programming over positions in both, where in its reference problem . matches any single character and * repeats the element before it. Your pattern language differs: ? matches any one letter, as . does there, but * stands alone and matches any run of letters, including an empty run, instead of modifying the preceding letter. The transitions for * therefore have to be rewritten. The whole text must be matched by the whole pattern, so check empty text and patterns made only of *."),

  // Batch 3 (added 2026-10-18).
  video("signal-flips", singleNumber, "Bitwise operations on integers", "Single Number (LeetCode 136)",
    "This problem is related to the video's reference problem, Single Number, through bitwise operations on integers, but the task is different. There you start from a list of numbers; here you compare two integers a and b, each stored as 31 toggles, and return how many bit positions differ. Which bitwise operation on a and b marks the positions where the bits differ? Once you have that, what would you do to turn it into a count? Check that equal inputs give 0."),

  // Batch 4 (added 2026-10-18).
  video("badge-subsets", subsets, "Backtracking for subsets", "Subsets (LeetCode 78)",
    "This problem is closely related to the video's reference problem, Subsets: both list every selection from a set of distinct numbers, including the empty one. The main new element here is the required order of the output: each selection is written in increasing order and the list is ordered by size first, then lexicographically. The badges arrive unsorted, so decide where ordering has to happen to produce exactly the order shown in the first example."),
  video("lineup-orders", permutations, "Backtracking for orderings", "Permutations (LeetCode 46)",
    "This problem is closely related to the video's reference problem, Permutations: both list every ordering of a set of distinct numbers. The main new element here is the required output order: the statement lists the orderings lexicographically by number, and the jersey numbers arrive in no particular order. What would you need to arrange so that your output matches the first example exactly?"),
  video("lantern-steps", climbingStairs, "Dynamic programming over positions", "Climbing Stairs (LeetCode 70)",
    "This problem is related to the video's reference problem, Climbing Stairs: each move here also advances one or two positions. The question differs: instead of the number of ways to get there, you want the minimum total tokens to reach the exit. Read the statement for what is paid and when: a platform's cost is paid when you leave it, the exit is free, and you may start on platform 0 or platform 1. What should you record for each position?"),
  video("tower-tiles", climbingStairs, "Counting ways with dynamic programming", "Climbing Stairs (LeetCode 70)",
    "This problem is related to the video's reference problem, Climbing Stairs, because both ask you to count the number of ways to build up to a given size. Here nothing lists the allowed moves: you count tilings of a strip of a given width with 1 x 2 tiles. Work out the counts for length 1, 2 and 3 by hand, and look for how counts for different lengths are connected. The answer is taken modulo 1000000007."),
  video("charging-loop", gasStation, "Circular route with gains and costs", "Gas Station (LeetCode 134)",
    "This problem is closely related to the video's reference problem, Gas Station: a vehicle goes around a circular route, gaining at each stop and spending to reach the next. The main thing to check in this statement is that you must return the smallest starting station that works, or -1. Can more than one start work here, and does your approach return the smallest of them? Also note that gain and cost can be 0."),
  video("rank-tags", topKFrequent, "Counting values and ordering by frequency", "Top K Frequent Elements (LeetCode 347)",
    "This problem is related to the video's reference problem, Top K Frequent Elements, since both need how often each value occurs. The differences are in what you return: here it is every distinct tag, not only the top few, ordered from most to least frequent. Tags with the same frequency are ordered alphabetically, so decide how that second ordering rule fits into your approach. Tags are strings, and an empty list gives an empty result."),
  video("glyph-order", alienDictionary, "Topological sort of ordering constraints", "Alien Dictionary (LeetCode 269)",
    "This problem is closely related to the video's reference problem, Alien Dictionary: a list of words sorted in an unknown alphabet, from which you recover an order of the glyphs. The main new element in this statement is the tie-break: when several orders are consistent, you must return the one that is smallest in ordinary a-z order. How do you decide which glyph to place next so that the result is that one? The second example shows an inconsistent input, which gives an empty string."),
  video("warehouse-routes", uniquePaths, "Grid path counting with dynamic programming", "Unique Paths (LeetCode 62)",
    "This problem is related to the video's reference problem, Unique Paths: a robot moves only right or down from the top-left to the bottom-right of a grid. The difference is that some cells here are shelves the robot cannot enter. How many routes pass through a shelf cell, and how does that affect the cells next to it? The statement also says there are no routes when the start or the destination is a shelf, and the count is taken modulo 1000000007."),
  video("word-groups", groupAnagrams, "Grouping words that use the same letters", "Group Anagrams (LeetCode 49)",
    "This problem is related to the video's reference problem, Group Anagrams, whose title mentions categorizing strings by count: both put words that use the same letters into groups. The main new element here is the fixed output order: inside each group the words are listed alphabetically, with repeats kept, and the groups are ordered by their first word. Grouping alone is therefore not the finished answer. Check the first example for the exact order, and note that the list of words may be empty."),
];
