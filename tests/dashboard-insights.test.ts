import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DashboardInsights } from "@/components/dashboard/dashboard-insights";
import type { DashboardInsights as Insights } from "@/features/dashboard/query";
const empty = (): Insights => ({ topics: [], recommendations: [], recentSubmissions: [], streak: { current: 0, longest: 0, activeToday: false, lastActiveDay: null, activeDays: 0 }, strongest: [], interviews: { recent: [], average: null } });
const render = (insights: Insights) => renderToStaticMarkup(createElement(DashboardInsights, { insights }));
it("states absent evidence without inventing a streak, a strongest topic or an interview score", () => {
  const html = render(empty());
  for (const text of ["No topic signal yet", "No next problem to suggest", "No full submissions yet", "No saved practice yet", "No strongest topic yet", "No completed mock interviews yet"]) expect(html).toContain(text);
  expect(html).not.toContain("0 days"); expect(html).not.toContain("Not tracked yet"); expect(html).not.toContain("Average of these");
});
it("shows the current and longest streak with correct singular and plural wording", () => {
  const streak = (changes: Partial<Insights["streak"]>) => { const insights = empty(); insights.streak = { ...insights.streak, activeDays: 5, lastActiveDay: "2026-10-12", ...changes }; return render(insights); };
  const running = streak({ current: 3, longest: 4, activeToday: true });
  for (const text of ["3 days", "You have practised today.", "Longest streak: 4 days across 5 practice days."]) expect(running).toContain(text);
  expect(streak({ current: 1, longest: 1, activeDays: 1 })).toContain(">1 day<");
  const morning = streak({ current: 2, longest: 2, activeToday: false });
  expect(morning).toContain("2 days"); expect(morning).toContain("You have not practised yet today.");
  const broken = streak({ current: 0, longest: 6, activeDays: 9 });
  expect(broken).toContain("No current streak"); expect(broken).toContain("Longest streak: 6 days"); expect(broken).not.toContain("0 days");
});
it("lists strongest topics and interview scores as practice signals with escaped text and result links", () => {
  const insights = empty();
  insights.strongest = [{ slug: "arrays", name: "<b>Arrays</b>", solved: 4, total: 9, verifiedCurrent: 3 }];
  insights.interviews = { average: 63, recent: [{ id: "11111111-1111-4111-8111-111111111111", score: 67, durationMinutes: 30, completedAt: "2026-10-01T14:05:00.000Z" }, { id: "22222222-2222-4222-8222-222222222222", score: 58, durationMinutes: 15, completedAt: "2026-09-30T09:00:00.000Z" }] };
  const html = render(insights);
  for (const text of ["4 of 9 solved · 3 verified on the current revision", "&lt;b&gt;Arrays&lt;/b&gt;", "Average of these 2: <span class=\"tabular-nums\">63%</span>", "Self-assessed score 67%", "30-minute session", "Oct 1, 2026", "UTC", "not correctness grades"]) expect(html).toContain(text);
  expect(html).toContain('href="/interview-results/11111111-1111-4111-8111-111111111111"'); expect(html).not.toContain("<b>Arrays</b>");
});
it("escapes titles and distinguishes pending, current and earlier revision results", () => {
  const insights = empty();
  const row = { slug: "relay-window", title: "<script>secret()</script>", status: "RUNNING" as const, problemRevision: 1, currentRevision: 2, passedCount: 0, totalCount: 2, createdAt: "2026-09-17T00:00:00.000Z", completedAt: null };
  insights.recentSubmissions = [row, { ...row, status: "ACCEPTED", passedCount: 2, problemRevision: 2, completedAt: row.createdAt }];
  const html = render(insights);
  for (const text of ["No final result yet", "earlier revision", "UTC", "2/2 passed", "&lt;script&gt;"]) expect(html).toContain(text);
  expect(html).not.toContain("0/2 passed"); expect(html).not.toContain("<script>");
});
