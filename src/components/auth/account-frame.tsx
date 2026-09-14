import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/layout/brand";
import { Container } from "@/components/layout/container";
import { logout } from "@/features/auth/actions";

export function AccountFrame({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  return <>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-canvas focus:p-4">Skip to content</a>
    <header className="border-b border-line"><Container className="flex flex-wrap items-center justify-between gap-5 py-5">
      <Brand /><nav aria-label="Account navigation" className="flex flex-wrap items-center gap-5 text-sm">
        <Link href="/dashboard" className="rounded py-3 text-accent">Dashboard</Link><Link href="/profile" className="rounded py-3 text-accent">Profile</Link>
        {admin && <Link href="/admin" className="rounded py-3 text-accent">Admin</Link>}
        <form action={logout}><button className="min-h-11 rounded-lg border border-line px-4 hover:bg-surface-raised" type="submit">Sign out</button></form>
      </nav>
    </Container></header>
    <main id="main-content"><Container className="py-12">{children}</Container></main>
  </>;
}
