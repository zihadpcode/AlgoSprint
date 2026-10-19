import { Skeleton } from "@/components/ui/loading-state";

const frame = "mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8";

export function RoadmapSkeleton() {
  return <div role="status" aria-live="polite" className={frame}>
    <p className="sr-only">Loading learning track…</p>
    <Skeleton className="mb-4 h-4 w-28" />
    <div className="mb-6 space-y-2"><Skeleton className="h-7 w-72 max-w-full" /><Skeleton className="h-4 w-full max-w-lg" /></div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4 lg:col-start-2 lg:row-start-1"><div className="space-y-3 rounded-xl border border-line bg-surface p-4"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-1.5 w-full" /><Skeleton className="h-3 w-3/4" /></div></div>
      <div className="space-y-4 lg:col-start-1 lg:row-start-1">
        {Array.from({ length: 5 }, (_, i) => <div key={i} className="flex gap-4"><Skeleton className="mt-1 size-8 shrink-0 rounded-full" /><div className="flex-1 space-y-2 rounded-xl border border-line bg-surface p-4"><Skeleton className="h-3 w-16" /><Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-full" /></div></div>)}
      </div>
    </div>
  </div>;
}
