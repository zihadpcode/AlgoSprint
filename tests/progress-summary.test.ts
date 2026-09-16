import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ProgressSummary } from "@/components/progress/progress-summary";
import { progressLabel, progressView } from "@/features/progress/presentation";
import type { ProgressSummary as Summary } from "@/features/progress/query";
const counts = { total: 0, started: 0, attempted: 0, solved: 0, manualSolved: 0, verifiedCurrent: 0, verifiedEarlier: 0, reviewLater: 0 };
const empty = (): Summary => ({ overall: { ...counts }, difficulty: { EASY: { ...counts }, MEDIUM: { ...counts }, HARD: { ...counts } }, categories: [], recentAttempts: [], recentProgress: [] });
it("shows a truthful empty state with accessible table headings", () => {
  const html = renderToStaticMarkup(createElement(ProgressSummary, { summary: empty() }));
  for (const text of ["Start your practice record", "No runs or submissions yet", "No progress changes yet", "No published categories yet", "Difficulty progress", 'scope="col"', 'scope="row"']) expect(html).toContain(text);
});
it("distinguishes manual, legacy and current/earlier verified solves", () => {
  const row = { status: "SOLVED" as const, selfMarked: false, reviewLater: false, verifiedRevision: 1 };
  expect(progressLabel(progressView(row, 1))).toBe("Solved · verified");
  expect(progressLabel(progressView(row, 2))).toContain("earlier revision");
  expect(progressLabel(progressView({ ...row, verifiedRevision: null }, 1))).toBe("Solved · recorded");
  expect(progressLabel(progressView({ ...row, selfMarked: true, verifiedRevision: null }, 1))).toBe("Solved · self-marked");
  expect(progressLabel(progressView(null, 1))).toBe("Not started");
});
it("escapes titles and labels pending/old-revision attempts without inventing final counts", () => {
  const summary = empty();
  summary.recentAttempts = [{ mode: "RUN", status: "RUNNING", problemRevision: 1, currentRevision: 2, passedCount: 0, totalCount: 2, createdAt: "2026-01-01T00:00:00.000Z", completedAt: null, slug: "relay-window", title: "<script>private()</script>" }];
  const html = renderToStaticMarkup(createElement(ProgressSummary, { summary }));
  expect(html).toContain("Visible run"); expect(html).toContain("Running"); expect(html).toContain("No final result yet");
  expect(html).toContain("earlier revision"); expect(html).toContain("UTC");
  expect(html).not.toContain("<script>"); expect(html).not.toContain("0/2 passed");
});
