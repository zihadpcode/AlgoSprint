import { Compass } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { ButtonLink } from "@/components/ui/button";
export default function NotFound() {
  return <div className="grid-backdrop min-h-dvh"><main id="main-content" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 py-16 text-center">
    <Brand />
    <span className="mt-10 grid size-12 place-items-center rounded-xl border border-line bg-surface text-accent"><Compass aria-hidden="true" size={22} /></span>
    <p className="eyebrow mt-5 text-accent">404 · A different path</p>
    <h1 className="mt-2 text-2xl font-semibold tracking-tight">This page isn’t available</h1>
    <p className="mt-2 text-sm leading-6 text-muted">The address may have changed, or this page may not be available to your account.</p>
    <div className="mt-6 flex flex-wrap justify-center gap-2"><ButtonLink href="/">Back to home</ButtonLink><ButtonLink href="/problems" variant="secondary">Browse problems</ButtonLink></div>
  </main></div>;
}
