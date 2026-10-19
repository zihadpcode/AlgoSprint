import { Skeleton } from "@/components/ui/loading-state";

export default function Loading() {
  return <div role="status" aria-live="polite" className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
    <p className="sr-only">Loading the leaderboard…</p>
    <div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-7 w-48" /></div>
    <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="rounded-xl border border-line bg-surface p-4"><Skeleton className="h-5 w-20" /><Skeleton className="mt-4 h-5 w-32" /><Skeleton className="mt-3 h-8 w-12" /></div>)}</div>
    <div className="space-y-2 rounded-xl border border-line bg-surface p-4">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
  </div>;
}
