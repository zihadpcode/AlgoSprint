import { ArrowDownRight, ArrowRight, BookOpen, Compass, NotebookPen } from "lucide-react";
import { Container } from "@/components/layout/container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { PracticePreview } from "@/components/landing/practice-preview";
import { PLANNED_FEATURES, PRACTICE_STEPS } from "@/lib/constants";

const FEATURE_ICONS = {
  collection: BookOpen,
  progress: NotebookPen,
  preparation: Compass,
} as const;

export default function HomePage() {
  return (
    <>
      <a href="#main-content" className="sr-only z-50 rounded-lg bg-warm p-4 font-semibold text-canvas focus:fixed focus:top-4 focus:left-4 focus:not-sr-only">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <Container className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-24">
          <div className="min-w-0">
            <p className="eyebrow text-accent">Coding practice, with purpose</p>
            <h1 className="mt-6 text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.1] font-bold tracking-[-0.045em]">
              Think it through.
              <span className="mt-1 block text-accent">Then make it run.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
              Build the reasoning behind the solution. AlgoSprint is taking
              shape as a home for original challenges, thoughtful explanations,
              and a practice habit that lasts.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a href="#practice-preview" className="action-link action-link-primary">
                See a practice example
                <ArrowDownRight aria-hidden="true" size={19} />
              </a>
              <a href="#approach" className="action-link action-link-secondary">Explore the approach</a>
            </div>
            <p className="mt-5 text-sm leading-6 text-muted">
              An early look. The problem library and practice tools are in development.
            </p>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-line/70 pt-6 font-mono text-sm text-muted">
              <span>Understand the pattern</span>
              <span className="text-warm">Explain the tradeoff</span>
            </div>
          </div>
          <PracticePreview />
        </Container>
        <section id="approach" aria-labelledby="approach-title" className="border-y border-line/70 bg-surface/50 py-16 sm:py-20">
          <Container>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="eyebrow text-warm">The practice loop</p>
                <h2 id="approach-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Make every attempt teach you something.
                </h2>
              </div>
              <p className="max-w-sm leading-7 text-muted">
                A repeatable way to approach a problem, even when you do not know where to start.
              </p>
            </div>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {PRACTICE_STEPS.map((step) => (
                <li key={step.number} className="rounded-2xl border border-line bg-canvas/60 p-6 transition-colors hover:border-accent/60">
                  <span className="font-mono text-sm text-warm">{step.number}</span>
                  <h3 className="mt-5 text-xl leading-7 font-semibold">{step.title}</h3>
                  <p className="mt-3 leading-7 text-muted">{step.description}</p>
                </li>
              ))}
            </ol>
          </Container>
        </section>
        <section id="path-ahead" aria-labelledby="future-title" className="py-16 sm:py-20">
          <Container>
            <p className="eyebrow text-lilac">The path ahead</p>
            <h2 id="future-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Small beginnings. Room to grow.
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-muted">
              These features are planned. This preview introduces the direction;
              the learning tools will arrive in stages.
            </p>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {PLANNED_FEATURES.map((feature) => {
                const Icon = FEATURE_ICONS[feature.id];
                return (
                  <article key={feature.id} className="border-t border-line pt-6">
                    <Icon aria-hidden="true" size={25} className="text-lilac" />
                    <h3 className="mt-4 text-xl font-semibold">{feature.title}</h3>
                    <p className="mt-3 leading-7 text-muted">{feature.description}</p>
                    <p className="mt-5 text-sm text-accent">{feature.label}</p>
                  </article>
                );
              })}
            </div>
            <a href="#practice-preview" className="mt-10 inline-flex min-h-11 items-center gap-2 rounded-md font-medium text-accent hover:text-accent-strong">
              Back to the practice example
              <ArrowRight aria-hidden="true" size={18} />
            </a>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
