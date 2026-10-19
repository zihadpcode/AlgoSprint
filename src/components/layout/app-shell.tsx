import { Suspense, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import { MobileNav, PrimaryLinks, SearchTrigger } from "./top-nav";
import { GuestActions, ShellStatus, ShellStatusFallback } from "./shell-status";

/** Global top bar: logo, primary navigation, Cmd/Ctrl+K search, streak/solved badge and profile menu. */
export function TopBar({ signedIn = false, admin = false, wide = false }: { signedIn?: boolean; admin?: boolean; wide?: boolean }) {
  return <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur supports-[backdrop-filter]:bg-canvas/70">
    <div className={cn("mx-auto flex h-14 items-center gap-3 px-4 sm:px-6", wide ? "max-w-none" : "max-w-[1400px]")}>
      <MobileNav />
      <Brand />
      <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-line md:block" />
      <PrimaryLinks />
      <div className="ml-auto flex items-center gap-2">
        <SearchTrigger />
        {signedIn ? <Suspense fallback={<ShellStatusFallback />}><ShellStatus admin={admin} /></Suspense> : <GuestActions />}
      </div>
    </div>
  </header>;
}

/**
 * Page frame for every app page. `layout="workspace"` gives the problem IDE the full viewport width and height
 * below the bar; the default centres page content.
 */
export function AppShell({ children, admin = false, signedIn = false, layout = "page" }: { children: ReactNode; admin?: boolean; signedIn?: boolean; layout?: "page" | "workspace" }) {
  const workspace = layout === "workspace";
  return <div className="flex min-h-dvh flex-col">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-lg focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-sm">Skip to content</a>
    <TopBar signedIn={signedIn} admin={admin} wide={workspace} />
    <main id="main-content" tabIndex={-1} className={cn("min-w-0 flex-1 focus:outline-none", workspace ? "flex flex-col" : "mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8")}>{children}</main>
    {!workspace && <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-subtle sm:px-6">
        <span>One problem. One insight. Another step forward.</span>
        <span>Press <kbd className="rounded border border-line px-1 font-mono">/</kbd> or <kbd className="rounded border border-line px-1 font-mono">Ctrl K</kbd> to search</span>
      </div>
    </footer>}
  </div>;
}
