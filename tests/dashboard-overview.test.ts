import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import type { DashboardAnalytics } from "@/features/dashboard/contracts";
import type { ProgressCounts } from "@/features/progress/query";

const counts = (changes: Partial<ProgressCounts> = {}): ProgressCounts => ({ total: 0, started: 0, attempted: 0, solved: 0, manualSolved: 0, verifiedCurrent: 0, verifiedEarlier: 0, reviewLater: 0, ...changes });
const empty = (): DashboardAnalytics => ({ overall: counts(), difficulty: { EASY: counts(), MEDIUM: counts(), HARD: counts() }, categories: [] });
const render = (analytics: DashboardAnalytics) => renderToStaticMarkup(createElement(DashboardOverview, { analytics }));

it("distinguishes an empty collection from a learner who has not started", () => {
  const analytics = empty();
  const noCollection = render(analytics);
  expect(noCollection).toContain("The collection is getting ready");
  expect(noCollection).toContain("No published problems");
  expect(noCollection).not.toMatch(/NaN|Infinity/);
  analytics.overall.total = 3;
  analytics.difficulty.EASY.total = 3;
  const notStarted = render(analytics);
  expect(notStarted).toContain("Start your practice record");
  expect(notStarted).toContain("0% solved");
  expect(notStarted).not.toContain("The collection is getting ready");
});

it("uses each group's own denominator and keeps zero and full completion truthful", () => {
  const analytics = empty();
  analytics.overall = counts({ total: 7, solved: 4, started: 4, manualSolved: 4 });
  analytics.difficulty.EASY = counts({ total: 3, solved: 1, started: 1, manualSolved: 1 });
  analytics.difficulty.MEDIUM = counts({ total: 3, solved: 3, started: 3, manualSolved: 3 });
  analytics.difficulty.HARD = counts({ total: 1 });
  const html = render(analytics);
  for (const text of ["33% solved", "100% solved", "0% solved", "1 / 3", "3 / 3", "0 / 1"]) expect(html).toContain(text);
});

it("retains manual, current, earlier and legacy provenance without inventing attempts", () => {
  const analytics = empty();
  analytics.overall = counts({ total: 10, started: 10, solved: 10, manualSolved: 1, verifiedCurrent: 2, verifiedEarlier: 3 });
  const html = render(analytics);
  expect(html).toContain("1 self-marked, 2 verified on current revisions, 3 verified on earlier revisions, and 4 older recorded solves");
  expect(html).not.toContain("Start your practice record");
  expect(html).toContain("Visible-only runs do not verify a solve");
  expect(html).toContain('href="/progress"');
});

it("provides labeled numeric chart data and escapes category names without relying on color", () => {
  const analytics = empty();
  analytics.overall = counts({ total: 2, started: 1, solved: 1, manualSolved: 1 });
  analytics.categories = [
    { slug: "arrays", name: "Arrays <script>alert(1)</script>", counts: counts({ total: 2, solved: 1, manualSolved: 1 }) },
    { slug: "hashing", name: "Hashing", counts: counts({ total: 2, solved: 1, manualSolved: 1 }) },
  ];
  const html = render(analytics);
  for (const text of ['scope="col"', 'scope="row"', "Solved / published", "Verified current", "50% solved", "category totals overlap", "coverage, not topic mastery"]) expect(html).toContain(text);
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html.match(/50% solved/g)).toHaveLength(2);
});
