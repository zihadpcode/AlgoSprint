import { cn } from "@/lib/utils";
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("motion-safe:animate-pulse rounded-lg bg-surface-raised", className)} />;
}
export function LoadingState({ label = "Loading your page…" }: { label?: string }) {
  return <div role="status" aria-live="polite" className="space-y-6">
    <p className="text-sm text-muted">{label}</p>
    <Skeleton className="h-9 w-2/3 max-w-md" />
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-7"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-1/2" /><Skeleton className="mt-8 h-12 w-full" /></div>
  </div>;
}
