import { ShellSkeleton } from "@/components/layout/shell-skeleton";
import { Skeleton } from "@/components/ui/loading-state";

// Mirrors the workspace split so opening a problem does not flash the directory layout.
export default function Loading() {
  return <ShellSkeleton layout="workspace">
    <div role="status" aria-live="polite" className="flex min-h-0 flex-1 flex-col lg:h-[calc(100dvh-3.5rem)] lg:flex-none lg:flex-row">
      <p className="sr-only">Loading problem…</p>
      <div className="space-y-4 border-b border-line bg-surface p-4 lg:w-[45%] lg:border-r lg:border-b-0">
        <Skeleton className="h-3 w-20" /><Skeleton className="h-6 w-1/2" />
        <div className="flex gap-2"><Skeleton className="h-6 w-14" /><Skeleton className="h-6 w-20" /><Skeleton className="h-6 w-24" /></div>
        <div className="flex gap-4 border-b border-line pb-3 pt-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-24" /></div>
        <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-4/5" /><Skeleton className="mt-4 h-24 w-full" />
      </div>
      <div className="flex min-h-[420px] flex-1 flex-col bg-canvas">
        <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2"><Skeleton className="h-8 w-28" /><Skeleton className="ml-auto h-8 w-24" /></div>
        <div className="flex-1 space-y-2.5 p-4"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-4 w-3/5" /><Skeleton className="h-4 w-1/3" /></div>
        <div className="h-48 border-t border-line bg-surface" />
        <div className="flex justify-end gap-2 border-t border-line bg-surface px-3 py-2"><Skeleton className="h-8 w-20" /><Skeleton className="h-8 w-24" /></div>
      </div>
    </div>
  </ShellSkeleton>;
}
