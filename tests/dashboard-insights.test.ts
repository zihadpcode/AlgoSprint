import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DashboardInsights } from "@/components/dashboard/dashboard-insights";
import type { DashboardInsights as Insights } from "@/features/dashboard/query";
const empty = (): Insights => ({ topics: [], recommendations: [], recentSubmissions: [] });
const render = (insights: Insights) => renderToStaticMarkup(createElement(DashboardInsights, { insights }));
it("states absent evidence and an untracked streak without inventing a number", () => {
  const html = render(empty());
  for (const text of ["No topic signal yet", "No next problem to suggest", "No full submissions yet", "Not tracked yet"]) expect(html).toContain(text);
  expect(html).not.toContain("0 days");
});
it("escapes titles and distinguishes pending, current and earlier revision results", () => {
  const insights = empty();
  const row = { slug: "relay-window", title: "<script>secret()</script>", status: "RUNNING" as const, problemRevision: 1, currentRevision: 2, passedCount: 0, totalCount: 2, createdAt: "2026-09-17T00:00:00.000Z", completedAt: null };
  insights.recentSubmissions = [row, { ...row, status: "ACCEPTED", passedCount: 2, problemRevision: 2, completedAt: row.createdAt }];
  const html = render(insights);
  for (const text of ["No final result yet", "earlier revision", "UTC", "2/2 passed", "&lt;script&gt;"]) expect(html).toContain(text);
  expect(html).not.toContain("0/2 passed"); expect(html).not.toContain("<script>");
});
