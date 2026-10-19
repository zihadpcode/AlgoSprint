import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
const counts = { total: 10, started: 4, attempted: 4, solved: 4, manualSolved: 1, verifiedCurrent: 2, verifiedEarlier: 1, reviewLater: 0 };
const analytics = { overall: counts, difficulty: { EASY: counts, MEDIUM: counts, HARD: counts }, categories: [] };
const streak = { current: 3, longest: 7, activeToday: true, lastActiveDay: "2026-10-19", activeDays: 12 };
it("shows solved, acceptance, current and longest streak and active days", () => {
  const html = renderToStaticMarkup(createElement(DashboardStats, { analytics, streak, acceptance: { accepted: 3, submitted: 4, rate: 75 } }));
  for (const text of ["Solved", "/ 10", "75%", "3 of 4 full submissions", "Current streak", "Longest streak", ">7<", "Active days", ">12<", "Practised today"]) expect(html).toContain(text);
});
it("never invents an acceptance rate or a streak unit", () => {
  const html = renderToStaticMarkup(createElement(DashboardStats, { analytics, streak: { ...streak, current: 1, longest: 1, activeToday: false }, acceptance: null }));
  expect(html).toContain("—"); expect(html).toContain("No full submissions yet"); expect(html).toContain("Not yet today"); expect(html).not.toMatch(/NaN|%/);
});
