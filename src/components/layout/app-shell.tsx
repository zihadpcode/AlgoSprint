import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Brand } from "./brand";
import { WorkspaceNav } from "./workspace-nav";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { logout } from "@/features/auth/actions";

export function AppShell({ children, admin = false, signedIn = false }: { children: ReactNode; admin?: boolean; signedIn?: boolean }) {
  return <div className="min-h-dvh">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-canvas focus:p-4">Skip to content</a>
    <header className="border-b border-line bg-canvas"><div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
      <Brand /><div className="flex items-center gap-6"><span className="hidden text-sm text-muted sm:block">Practice with purpose.</span>
        {signedIn ? <form action={logout}><SubmitButton variant="secondary" pendingLabel="Signing out…">Sign out</SubmitButton></form> : <ButtonLink href="/login" variant="secondary">Sign in</ButtonLink>}
      </div>
    </div></header>
    <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="min-w-0 border-b border-line bg-surface/40 px-4 py-3 lg:sticky lg:top-0 lg:flex lg:h-[calc(100dvh-81px)] lg:flex-col lg:border-r lg:border-b-0 lg:px-5 lg:py-8">
        <p className="eyebrow mb-4 hidden px-4 text-xs text-muted lg:block">Workspace</p>
        <WorkspaceNav admin={admin} />
        <div className="mt-auto hidden rounded-2xl border border-line bg-surface p-5 lg:block"><Sparkles aria-hidden="true" size={20} className="text-warm" /><p className="mt-3 text-sm font-medium">Keep one insight.</p><p className="mt-2 text-xs leading-6 text-muted">After each practice session, write down one thing you want to remember.</p></div>
      </aside>
      <div className="min-w-0"><main id="main-content" tabIndex={-1} className="px-5 py-8 sm:px-8 lg:p-10">{children}</main>
        <footer className="px-5 pb-8 text-xs text-muted sm:px-8 lg:px-10">One problem. One insight. Another step forward.</footer>
      </div>
    </div>
  </div>;
}
