import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/loading-state";

/** Notes / bookmarks / review skeleton: tabs, search and a list of rows. */
export function SavedSkeleton({ label }: { label: string }) {
  return <AppShell signedIn>
    <div role="status" aria-live="polite">
      <p className="sr-only">{label}</p>
      <div className="mb-6 space-y-2"><Skeleton className="h-7 w-44" /><Skeleton className="h-4 w-full max-w-lg" /></div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><Skeleton className="h-9 w-56" /><Skeleton className="h-9 w-full sm:max-w-sm" /></div>
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="flex items-center justify-between gap-4 px-4 py-3"><div className="space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-32" /></div><Skeleton className="h-8 w-28" /></div>)}
      </div>
    </div>
  </AppShell>;
}
