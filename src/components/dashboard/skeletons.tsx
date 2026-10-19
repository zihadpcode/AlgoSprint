import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/loading-state";

function Panel({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3 rounded-xl border border-line bg-surface p-5"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-full max-w-md" />{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>;
}
function Stats({ count }: { count: number }) {
  return <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3 xl:grid-cols-5">
    {Array.from({ length: count }, (_, i) => <div key={i} className="space-y-3 bg-surface p-4"><Skeleton className="h-3 w-16" /><Skeleton className="h-7 w-14" /><Skeleton className="h-3 w-24" /></div>)}
  </div>;
}

/** Dashboard / progress skeleton. Both routes require a signed-in viewer, so the shell is shown signed in. */
export function DashboardSkeleton({ label, stats = 5 }: { label: string; stats?: number }) {
  return <AppShell signedIn>
    <div role="status" aria-live="polite" className="space-y-4">
      <p className="sr-only">{label}</p>
      <div className="mb-2 space-y-2"><Skeleton className="h-7 w-64" /><Skeleton className="h-4 w-full max-w-md" /></div>
      <Stats count={stats} />
      <Panel rows={3} />
      <div className="grid gap-4 lg:grid-cols-2"><Panel /><Panel /></div>
    </div>
  </AppShell>;
}
