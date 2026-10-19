import { Skeleton } from "@/components/ui/loading-state";

const frame = "mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8";
function Heading() {
  return <div className="mb-6 space-y-2"><Skeleton className="h-7 w-40" /><Skeleton className="h-4 w-full max-w-lg" /></div>;
}

/** Practice directory: stats strip, toolbar, table (md+) or compact cards. */
export function PracticeSkeleton() {
  return <div role="status" aria-live="polite" className={frame}>
    <p className="sr-only">Loading problems…</p>
    <Heading />
    <div className="mb-4 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-[1fr_2fr_auto_auto]">
      {[0, 1, 2, 3].map((i) => <div key={i} className="space-y-3 bg-surface p-4"><Skeleton className="h-3 w-16" /><Skeleton className="h-7 w-20" /><Skeleton className="h-1.5 w-full" /></div>)}
    </div>
    <div className="mb-3 flex flex-wrap gap-2"><Skeleton className="h-9 min-w-56 flex-1" />{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-24" />)}</div>
    <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
      <div className="h-9 border-b border-line bg-surface-raised/50" />
      {Array.from({ length: 10 }, (_, i) => <div key={i} className="flex h-12 items-center gap-6 border-b border-line px-3 last:border-0"><Skeleton className="size-4 rounded-full" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-4 w-16" /><Skeleton className="ml-auto h-4 w-12" /></div>)}
    </div>
    <div className="space-y-2 md:hidden">{Array.from({ length: 6 }, (_, i) => <div key={i} className="space-y-2 rounded-lg border border-line bg-surface p-3.5"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div>)}</div>
  </div>;
}
