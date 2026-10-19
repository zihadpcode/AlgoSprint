import { cn } from "@/lib/utils";
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("motion-safe:animate-pulse rounded-md bg-surface-hover", className)} />;
}
export function LoadingState({ label = "Loading your page…" }: { label?: string }) {
  return <div role="status" aria-live="polite" className="space-y-5">
    <p className="sr-only">{label}</p>
    <div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-7 w-2/3 max-w-md" /></div>
    <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="rounded-xl border border-line bg-surface p-4"><Skeleton className="h-3 w-20" /><Skeleton className="mt-3 h-6 w-14" /></div>)}</div>
    <div className="space-y-3 rounded-xl border border-line bg-surface p-5"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2" /><Skeleton className="mt-6 h-9 w-full" /></div>
  </div>;
}
