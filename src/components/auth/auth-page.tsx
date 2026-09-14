import type { ReactNode } from "react";
import Link from "next/link";
import { Brand } from "@/components/layout/brand";

export function AuthPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main id="main-content" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-12">
    <div className="mb-10"><Brand /></div>
    <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
      <p className="eyebrow mb-3 text-accent">Practice with purpose</p>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 leading-7 text-muted">{description}</p>
      {children}
    </section>
    <Link href="/" className="mt-6 self-start rounded py-2 text-sm text-muted underline underline-offset-4">Back to home</Link>
  </main>;
}
export function AccountsUnavailable() {
  return <p role="status" className="mt-6 rounded-xl border border-line p-4 text-sm leading-6 text-muted">Accounts are being prepared. Please try again later.</p>;
}
