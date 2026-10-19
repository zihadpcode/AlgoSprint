import { Flame } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import type { PracticeStats } from "@/features/problems/stats";

const percent = (part: number, whole: number) => whole > 0 ? Math.min(100, part / whole * 100) : 0;
const LEVELS = [
  { key: "EASY", label: "Easy", text: "text-success", bar: "bg-success" },
  { key: "MEDIUM", label: "Medium", text: "text-warm", bar: "bg-warm" },
  { key: "HARD", label: "Hard", text: "text-danger", bar: "bg-danger" },
] as const;

/** Compact progress bar with a text value; `label` is read to assistive technology via the meter role. */
function Meter({ label, value, max, barClass }: { label: string; value: number; max: number; barClass: string }) {
  return <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={Math.max(1, max)} aria-valuenow={value} aria-valuetext={`${value} of ${max}`} className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
    <div className={`h-full rounded-full ${barClass}`} style={{ width: `${percent(value, max)}%` }} />
  </div>;
}

export function PracticeStatsStrip({ stats }: { stats: PracticeStats }) {
  return (
    <section aria-label="Your practice" className="mb-4 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-[1fr_2fr_auto_auto]">
      <div className="bg-surface p-4">
        <p className="text-xs text-muted">Solved</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{stats.solved}<span className="text-base font-normal text-subtle"> / {stats.total}</span></p>
        <div className="mt-2.5"><Meter label="Solved problems" value={stats.solved} max={stats.total} barClass="bg-accent-solid" /></div>
      </div>
      <div className="grid grid-cols-3 gap-4 bg-surface p-4 sm:col-span-1">
        {LEVELS.map((level) => {
          const row = stats.difficulty[level.key];
          return <div key={level.key} className="min-w-0">
            <p className={`text-xs font-medium ${level.text}`}>{level.label}</p>
            <p className="mt-1 text-sm tabular-nums">{row.solved}<span className="text-subtle"> / {row.total}</span></p>
            <div className="mt-2.5"><Meter label={`${level.label} problems solved`} value={row.solved} max={row.total} barClass={level.bar} /></div>
          </div>;
        })}
      </div>
      <div className="bg-surface p-4 lg:min-w-32">
        <p className="text-xs text-muted">Acceptance</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{stats.acceptance === null ? "—" : `${stats.acceptance}%`}</p>
        <p className="mt-1 text-xs text-subtle tabular-nums">{stats.submitted > 0 ? `${stats.accepted} of ${stats.submitted} submissions` : "No submissions yet"}</p>
      </div>
      <div className="bg-surface p-4 lg:min-w-32">
        <p className="text-xs text-muted">Streak</p>
        <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold tabular-nums">
          <Flame aria-hidden="true" size={18} className={stats.streak > 0 ? "text-warm" : "text-subtle"} />{stats.streak}<span className="text-sm font-normal text-subtle">{stats.streak === 1 ? "day" : "days"}</span>
        </p>
        <p className="mt-1 text-xs text-subtle">{stats.activeToday ? "Practised today" : "Not yet today"}</p>
      </div>
    </section>
  );
}

/** Gentle prompt for guests; browsing the directory needs no account. */
export function GuestPrompt({ href }: { href: string }) {
  return (
    <section aria-label="Track your progress" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-sm text-muted">Sign in to track solved problems, your streak and acceptance rate.</p>
      <ButtonLink href={href} variant="secondary" size="sm">Sign in</ButtonLink>
    </section>
  );
}
