import type { DashboardAnalytics } from "@/features/dashboard/contracts";
import type { DashboardInsights } from "@/features/dashboard/query";

type Acceptance = { accepted: number; submitted: number; rate: number | null } | null;

/** Minimal stat cards: solved, acceptance, current and longest streak, active days. */
export function DashboardStats({ analytics, streak, acceptance }: { analytics: DashboardAnalytics; streak: DashboardInsights["streak"]; acceptance: Acceptance }) {
  const { overall } = analytics;
  const cards = [
    { label: "Solved", value: String(overall.solved), unit: `/ ${overall.total}`, detail: "Recorded solves, including self-marked" },
    { label: "Acceptance", value: acceptance?.rate == null ? "—" : `${acceptance.rate}%`, unit: "", detail: acceptance && acceptance.submitted > 0 ? `${acceptance.accepted} of ${acceptance.submitted} full submissions` : "No full submissions yet" },
    { label: "Current streak", value: String(streak.current), unit: streak.current === 1 ? "day" : "days", detail: streak.activeToday ? "Practised today" : "Not yet today" },
    { label: "Longest streak", value: String(streak.longest), unit: streak.longest === 1 ? "day" : "days", detail: "Consecutive UTC days" },
    { label: "Active days", value: String(streak.activeDays), unit: "", detail: "Days with saved practice" },
  ];
  return <section aria-label="Practice totals" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3 xl:grid-cols-5">
    {cards.map(({ label, value, unit, detail }) => <div key={label} className="bg-surface p-4">
      <h2 className="text-xs font-medium text-muted">{label}</h2>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}{unit && <span className="ml-1 text-sm font-normal text-subtle">{unit}</span>}</p>
      <p className="mt-1 text-xs text-subtle">{detail}</p>
    </div>)}
  </section>;
}
