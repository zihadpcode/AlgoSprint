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
