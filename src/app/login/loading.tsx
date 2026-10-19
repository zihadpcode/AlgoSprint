import { Brand } from "@/components/layout/brand";
import { Skeleton } from "@/components/ui/loading-state";
export default function Loading() {
  return <div className="grid-backdrop min-h-dvh"><main className="mx-auto flex min-h-dvh max-w-[26rem] flex-col justify-center px-4 py-10">
    <div className="mb-6 flex justify-center"><Brand /></div>
    <div role="status" aria-live="polite" className="space-y-4 rounded-xl border border-line bg-surface p-6 sm:p-7">
      <p className="sr-only">Preparing sign in…</p>
      <Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-3/4" />
      <Skeleton className="mt-6 h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-11 w-full" />
    </div>
  </main></div>;
}
