import Link from "next/link";
import { Flame } from "lucide-react";
import { getViewer } from "@/features/auth/session";
import { queryPracticeSummary } from "@/features/dashboard/query";
import { getDatabase } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loading-state";
import { UserMenu } from "./user-menu";

/** Right side of the top bar for a signed-in viewer: streak/solved badge and the profile menu.
 *  Streams in behind a Suspense boundary so the page never waits for it. */
export async function ShellStatus({ admin }: { admin: boolean }) {
  const viewer = await getViewer().catch(() => null);
  if (!viewer) return <GuestActions />;
  const summary = await queryPracticeSummary(getDatabase(), viewer.id).catch(() => null);
  const name = viewer.displayName || viewer.email || "Your account";
  return <div className="flex items-center gap-2">
    {summary && <Link href="/progress" title={`${summary.solved} solved · ${summary.streak}-day streak`} className="hidden h-9 items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 text-xs text-muted transition-colors hover:border-line-strong hover:text-ink sm:inline-flex">
      <span className="inline-flex items-center gap-1"><Flame aria-hidden="true" size={14} className={cn(summary.activeToday ? "text-warm" : "text-subtle")} /><span className="font-semibold text-ink tabular-nums">{summary.streak}</span><span className="sr-only">day streak</span></span>
      <span aria-hidden="true" className="h-3.5 w-px bg-line-strong" />
      <span><span className="font-semibold text-ink tabular-nums">{summary.solved}</span> solved</span>
    </Link>}
    <UserMenu name={name} email={viewer.email} admin={admin || viewer.role === "ADMIN"} />
  </div>;
}

export function GuestActions() {
  return <div className="flex items-center gap-1.5">
    <ButtonLink href="/login" variant="quiet" size="sm" className="h-9">Sign in</ButtonLink>
    <ButtonLink href="/register" size="sm" className="h-9">Get started</ButtonLink>
  </div>;
}

export function ShellStatusFallback() {
  return <div className="flex items-center gap-2"><Skeleton className="hidden h-9 w-28 rounded-lg sm:block" /><Skeleton className="h-9 w-12 rounded-lg" /></div>;
}
