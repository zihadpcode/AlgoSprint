import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/layout/brand";

export function AuthPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="grid-backdrop relative min-h-dvh overflow-hidden">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,#6366f126,transparent_70%)]" />
    <main id="main-content" tabIndex={-1} className="relative mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center px-4 py-10 focus:outline-none">
      <div className="mb-6 flex justify-center"><Brand /></div>
      <section aria-labelledby="auth-title" className="rounded-xl border border-line bg-surface p-6 shadow-pop sm:p-7">
        <h1 id="auth-title" className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-sm leading-6 text-muted">{description}</p>
        {children}
      </section>
      <Link href="/" className="mx-auto mt-5 inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-muted transition-colors hover:text-ink"><ArrowLeft aria-hidden="true" size={14} />Back to home</Link>
    </main>
  </div>;
}
export function AccountsUnavailable() {
  return <p role="status" className="mt-6 rounded-lg border border-line bg-canvas p-3.5 text-sm leading-6 text-muted">Accounts are being prepared. Please try again later.</p>;
}
