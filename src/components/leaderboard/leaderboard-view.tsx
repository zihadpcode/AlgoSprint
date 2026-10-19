import Link from "next/link";
import { Crown, Medal, Trophy } from "lucide-react";
import type { Leaderboard, LeaderboardEntry } from "@/features/leaderboard/query";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

const podium = [
  { ring: "border-warm/40 bg-warm/5", chip: "bg-warm/15 text-warm", label: "1st place" },
  { ring: "border-line-strong bg-surface", chip: "bg-zinc-400/15 text-zinc-300", label: "2nd place" },
  { ring: "border-orange-400/30 bg-orange-400/5", chip: "bg-orange-400/15 text-orange-300", label: "3rd place" },
] as const;

function Split({ entry }: { entry: LeaderboardEntry }) {
  return <span className="inline-flex items-center gap-3 font-mono text-xs tabular-nums">
    <span className="text-success"><span className="sr-only">Easy </span>{entry.easy}</span>
    <span className="text-warm"><span className="sr-only">Medium </span>{entry.medium}</span>
    <span className="text-danger"><span className="sr-only">Hard </span>{entry.hard}</span>
  </span>;
}

function PodiumCard({ entry }: { entry: LeaderboardEntry }) {
  const style = podium[entry.rank - 1];
  const Icon = entry.rank === 1 ? Crown : Medal;
  return <li className={cn("min-w-0 rounded-xl border p-4", style.ring, entry.isViewer && "ring-2 ring-accent/60", entry.rank === 1 && "sm:order-2 sm:-mt-2", entry.rank === 2 && "sm:order-1", entry.rank === 3 && "sm:order-3")}>
    <div className="flex items-center justify-between gap-2">
      <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-semibold", style.chip)}><Icon aria-hidden="true" size={13} />{style.label}</span>
      {entry.isViewer && <Badge tone="accent">You</Badge>}
    </div>
    <p className="mt-3 truncate text-base font-semibold" title={entry.name}>{entry.name}</p>
    <p className="mt-1 flex items-baseline gap-1.5"><span className="text-2xl font-semibold tabular-nums">{entry.solved}</span><span className="text-xs text-muted">solved</span></p>
    <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-muted"><Split entry={entry} /><span className="tabular-nums">{entry.week} this week</span></div>
  </li>;
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  return <tr className={cn("h-11 transition-colors hover:bg-surface-hover", entry.isViewer && "bg-accent/10")}>
    <td className="w-14 pl-4 font-mono text-xs tabular-nums text-muted">{entry.rank}</td>
    <th scope="row" className="max-w-0 truncate py-2 pr-3 text-left text-sm font-medium" title={entry.name}>{entry.name}{entry.isViewer && <Badge tone="accent" className="ml-2 align-middle">You</Badge>}</th>
    <td className="pr-4 text-right text-sm font-semibold tabular-nums">{entry.solved}</td>
    <td className="hidden pr-4 text-right sm:table-cell"><Split entry={entry} /></td>
    <td className="hidden pr-4 text-right text-xs tabular-nums text-muted md:table-cell">{entry.week}</td>
  </tr>;
}

export function LeaderboardView({ data, signedIn, optedIn }: { data: Leaderboard; signedIn: boolean; optedIn: boolean }) {
  const top = data.entries.slice(0, 3);
  const rest = data.entries.slice(3);
  const outside = data.viewerEntry && data.viewerEntry.rank > data.entries.length ? data.viewerEntry : null;
  return <div className="space-y-6">
    {!optedIn && <aside aria-label="Join the leaderboard" className="flex flex-col gap-3 rounded-xl border border-accent/25 bg-accent/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted"><span className="font-medium text-ink">You are not on the leaderboard.</span> It is opt-in: only your chosen display name and solved counts are shown, never your email.</p>
      {signedIn ? <ButtonLink href="/profile#leaderboard" size="sm" variant="secondary">Opt in from your profile</ButtonLink>
        : <ButtonLink href="/login?next=/profile" size="sm" variant="secondary">Sign in to opt in</ButtonLink>}
    </aside>}
    {data.entries.length === 0 ? <EmptyState title="No one is on the board yet" description="Learners appear here when they opt in and have verified solves. Solve a problem and opt in from your profile to be the first." action={<ButtonLink href="/problems">Browse problems</ButtonLink>} /> : <>
      <section aria-labelledby="podium-title">
        <h2 id="podium-title" className="sr-only">Top three</h2>
        <ol className="grid gap-3 sm:grid-cols-3 sm:items-end">{top.map((entry) => <PodiumCard key={entry.rank} entry={entry} />)}</ol>
      </section>
      {(rest.length > 0 || outside) && <section aria-labelledby="rankings-title" className="overflow-hidden rounded-xl border border-line bg-surface">
        <h2 id="rankings-title" className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold"><Trophy aria-hidden="true" size={14} className="text-muted" />Rankings</h2>
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Learners ranked by verified solves of published problems</caption>
          <thead className="border-b border-line text-xs text-subtle"><tr className="h-9">
            <th scope="col" className="w-14 pl-4 text-left font-medium">Rank</th>
            <th scope="col" className="text-left font-medium">Name</th>
            <th scope="col" className="w-20 pr-4 text-right font-medium">Solved</th>
            <th scope="col" className="hidden w-32 pr-4 text-right font-medium sm:table-cell">Easy / Med / Hard</th>
            <th scope="col" className="hidden w-24 pr-4 text-right font-medium md:table-cell">This week</th>
          </tr></thead>
          <tbody className="divide-y divide-line">
            {rest.map((entry) => <Row key={entry.rank} entry={entry} />)}
            {outside && <><tr aria-hidden="true"><td colSpan={5} className="py-1 text-center text-xs text-subtle">…</td></tr><Row entry={outside} /></>}
          </tbody>
        </table>
      </section>}
    </>}
    <p className="text-xs leading-5 text-subtle">Ranked by judge-verified solves of published problems (self-marked solves do not count). Ties go to whoever reached their latest solve first. Shows the top 100. <Link href="/problems" className="text-muted underline-offset-2 hover:text-ink hover:underline">Browse problems</Link></p>
  </div>;
}
