import { progressView, type ProgressView } from "@/features/progress/presentation";

export type EvidenceProblem = {
  slug: string; title: string; difficulty: "EASY" | "MEDIUM" | "HARD"; revision: number;
  categories: { slug: string; name: string }[];
  progress: { status: ProgressView["status"]; selfMarked: boolean; reviewLater: boolean; verifiedRevision: number | null } | null;
  latest: { status: string; problemRevision: number } | null;
};
const difficultyRank = { EASY: 0, MEDIUM: 1, HARD: 2 };
const compareSlug = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function practiceSuggestions(problems: EvidenceProblem[]) {
  const groups = new Map<string, { slug: string; name: string; reviewCount: number; unresolvedCount: number }>();
  const evidence = problems.map((problem) => {
    const view = progressView(problem.progress, problem.revision);
    const unresolved = view.status !== "SOLVED" && problem.latest?.status === "WRONG_ANSWER" && problem.latest.problemRevision === problem.revision;
    for (const category of problem.categories) {
      const group = groups.get(category.slug) ?? { ...category, reviewCount: 0, unresolvedCount: 0 };
      if (view.reviewLater) group.reviewCount++;
      if (unresolved) group.unresolvedCount++;
      groups.set(category.slug, group);
    }
    return { problem, view, unresolved };
  });
  // Repeated failures on one problem cannot inflate this distinct-problem signal.
  const allTopics = [...groups.values()].filter((g) => g.reviewCount > 0 || g.unresolvedCount >= 2)
    .sort((a, b) => b.reviewCount - a.reviewCount || b.unresolvedCount - a.unresolvedCount || compareSlug(a.slug, b.slug));
  const focusSlugs = new Set(allTopics.map((g) => g.slug));
  const recommendations = evidence.flatMap(({ problem, view, unresolved }) => {
    let priority: number; let reason: string;
    if (view.reviewLater) { priority = 0; reason = "You marked this problem for review."; }
    else if (view.verification === "earlier") { priority = 1; reason = "Your verified solve is for an earlier revision."; }
    else if (view.status === "SOLVED") return [];
    else if (unresolved) { priority = 2; reason = "Your latest completed full submission on this revision returned Wrong answer."; }
    else if (view.status === "ATTEMPTED") { priority = 3; reason = "You have attempted this problem and have not marked it solved."; }
    else if (problem.categories.some((c) => focusSlugs.has(c.slug))) { priority = 4; reason = "A new problem in one of your topics to revisit."; }
    else { priority = 5; reason = "A published problem you have not started."; }
    return [{ slug: problem.slug, title: problem.title, difficulty: problem.difficulty, reason, priority }];
  }).sort((a, b) => a.priority - b.priority || difficultyRank[a.difficulty] - difficultyRank[b.difficulty] || compareSlug(a.slug, b.slug))
    .slice(0, 3).map(({ slug, title, difficulty, reason }) => ({ slug, title, difficulty, reason }));
  return { topics: allTopics.slice(0, 5), recommendations };
}

// ---------- Practice streak ----------

const DAY_MS = 86_400_000;
const dayNumber = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, date) / DAY_MS);
};
export const utcDay = (when: Date) => when.toISOString().slice(0, 10);

/**
 * Consecutive UTC calendar days with saved practice. `days` are YYYY-MM-DD strings in any order, duplicates allowed.
 * The current streak survives until the end of the day after the last practice day: if you have not practised yet today
 * but did yesterday, it still counts, so opening the dashboard in the morning never shows a broken streak.
 */
export function practiceStreak(days: readonly string[], now: Date) {
  const numbers = [...new Set(days.map(dayNumber))].sort((a, b) => a - b);
  const set = new Set(numbers);
  const today = dayNumber(utcDay(now));
  const activeToday = set.has(today);
  let cursor = activeToday ? today : set.has(today - 1) ? today - 1 : null;
  let current = 0;
  while (cursor !== null && set.has(cursor)) { current++; cursor--; }
  let longest = 0, run = 0;
  numbers.forEach((n, i) => { run = i > 0 && n === numbers[i - 1] + 1 ? run + 1 : 1; longest = Math.max(longest, run); });
  const last = numbers.length ? new Date(numbers[numbers.length - 1] * DAY_MS).toISOString().slice(0, 10) : null;
  return { current, longest, activeToday, lastActiveDay: last, activeDays: numbers.length };
}

// ---------- Strongest topics ----------

type CategoryCounts = { slug: string; name: string; counts: { total: number; solved: number; verifiedCurrent: number } };

/**
 * Categories where the learner has the most evidence of success: current verified solves first, then all solves, then
 * coverage. At least two solves are required so one lucky problem does not name a "strongest" topic. This is a practice
 * signal, not a skill score; categories overlap because a problem can have several.
 */
export function strongestTopics(categories: readonly CategoryCounts[], limit = 3) {
  return categories.filter(({ counts }) => counts.solved >= 2)
    .map(({ slug, name, counts }) => ({ slug, name, solved: counts.solved, total: counts.total, verifiedCurrent: counts.verifiedCurrent }))
    .sort((a, b) => b.verifiedCurrent - a.verifiedCurrent || b.solved - a.solved || b.solved / b.total - a.solved / a.total || compareSlug(a.slug, b.slug))
    .slice(0, limit);
}

// ---------- Interview score history ----------

export function interviewHistory(rows: readonly { id: string; score: number; durationMinutes: number; completedAt: string }[]) {
  const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : null;
  return { recent: rows.map((row) => ({ ...row })), average };
}
