import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ClosingCta, FeatureGrid, HowItWorks } from "@/components/landing/sections";
import { WorkspacePreview } from "@/components/landing/workspace-preview";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-lg focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-sm">Skip to content</a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        <section aria-labelledby="hero-title" className="grid-backdrop relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,#6366f133,transparent_70%)]" />
          <div className="relative mx-auto max-w-[1200px] px-4 pt-14 pb-12 sm:px-6 sm:pt-20 lg:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <Badge tone="accent" className="mx-auto">Practice with purpose</Badge>
              <h1 id="hero-title" className="mt-5 text-[clamp(2.25rem,5.5vw,3.75rem)] leading-[1.05] font-semibold tracking-[-0.035em]">
                Think it through.
                <span className="block bg-gradient-to-r from-accent-strong to-info bg-clip-text text-transparent">Then make it run.</span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
                A focused place to practice original coding problems, learn from layered hints and guided solutions, follow roadmaps, and rehearse interviews.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/problems" className="action-link action-link-primary h-11 px-5">Start practicing<ArrowRight aria-hidden="true" size={16} /></Link>
                <Link href="/roadmaps" className="action-link action-link-secondary h-11 px-5">Browse roadmaps</Link>
              </div>
              <p className="mt-4 text-xs text-subtle">Free to browse without an account. Sign in to save progress and notes.</p>
            </div>
            <div className="mx-auto mt-12 max-w-4xl"><WorkspacePreview /></div>
          </div>
        </section>
        <FeatureGrid />
        <HowItWorks />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}
