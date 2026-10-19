import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/loading-state";
import { Brand } from "./brand";
import { MobileNav, PrimaryLinks, SearchTrigger } from "./top-nav";

/**
 * Loading frame for routes whose page renders AppShell itself: the same top bar (account area as a skeleton, because
 * the session is not known yet) so navigation does not flash a bar-less page.
 */
export function ShellSkeleton({ children, layout = "page" }: { children: ReactNode; layout?: "page" | "workspace" }) {
  const workspace = layout === "workspace";
  return <div className="flex min-h-dvh flex-col">
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur supports-[backdrop-filter]:bg-canvas/70">
      <div className={cn("mx-auto flex h-14 items-center gap-3 px-4 sm:px-6", workspace ? "max-w-none" : "max-w-[1400px]")}>
        <MobileNav />
        <Brand />
        <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-line md:block" />
        <PrimaryLinks />
        <div className="ml-auto flex items-center gap-2"><SearchTrigger /><Skeleton className="h-9 w-24 rounded-lg" /></div>
      </div>
    </header>
    <div className={cn("min-w-0 flex-1", workspace ? "flex flex-col" : "mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8")}>{children}</div>
  </div>;
}
