import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BookOpen, ChartNoAxesColumn, Keyboard, Lightbulb, Mic, Route, Trophy } from "lucide-react";

type Feature = { icon: LucideIcon; title: string; description: string; href: string; label: string; tone: string };

const FEATURES: Feature[] = [
  { icon: BookOpen, title: "Problem library", description: "Original challenges filtered by difficulty, pattern and topic, each with examples, constraints and related problems.", href: "/problems", label: "Explore the problem library", tone: "text-accent" },
  { icon: Lightbulb, title: "Guided hints and editorials", description: "Reveal one hint at a time, then open guided solutions and video lessons when you are ready to compare approaches.", href: "/problems", label: "See how hints work", tone: "text-warm" },
  { icon: Route, title: "Roadmaps", description: "Ordered learning paths that build one pattern on the last and suggest the next step.", href: "/roadmaps", label: "Browse roadmaps", tone: "text-info" },
  { icon: Mic, title: "Mock interviews", description: "Timed, private sessions: explain your approach, write code or pseudocode, then rate your own reasoning.", href: "/mock-interview", label: "Start a mock interview", tone: "text-lilac" },
  { icon: ChartNoAxesColumn, title: "Progress and streaks", description: "Verified solves, daily streaks, notes and review-later lists show which topics deserve another pass.", href: "/register", label: "Create a free account", tone: "text-success" },
  { icon: Keyboard, title: "Keyboard-first workspace", description: "A browser code editor beside the statement, plus a Ctrl/Cmd K palette to jump to any problem, roadmap or page.", href: "/problems", label: "Open the workspace", tone: "text-danger" },
];

export function FeatureGrid() {
  return <section id="features" aria-labelledby="features-title" className="border-t border-line py-16 sm:py-20">
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
      <p className="eyebrow text-accent">Everything in one place</p>
      <h2 id="features-title" className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">A calm place to get better at problem solving.</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Practice, learn and review without switching tools. Browse everything without an account; sign in to save progress.</p>
      <ul className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, description, href, label, tone }) => <li key={title} className="group flex flex-col bg-surface p-5 transition-colors hover:bg-surface-raised">
          <span className="grid size-9 place-items-center rounded-lg border border-line bg-canvas"><Icon aria-hidden="true" size={17} className={tone} /></span>
          <h3 className="mt-4 text-base font-semibold">{title}</h3>
          <p className="mt-1.5 flex-1 text-sm leading-6 text-muted">{description}</p>
          <Link href={href} className="mt-4 inline-flex h-8 items-center gap-1.5 self-start rounded-md text-sm font-medium text-accent transition-colors hover:text-accent-strong">{label}<ArrowRight aria-hidden="true" size={14} className="transition-transform group-hover:translate-x-0.5" /></Link>
        </li>)}
      </ul>
    </div>
  </section>;
}

const STEPS = [
  { title: "Pick a path or a problem", description: "Start from a roadmap, or filter the library by difficulty, topic and pattern." },
  { title: "Solve it your way", description: "Read the examples, run your code, and unlock hints one layer at a time when you are stuck." },
  { title: "Review and keep going", description: "Save notes, mark problems for review, rehearse out loud in a mock interview, and watch your streak grow." },
] as const;

export function HowItWorks() {
  return <section id="how-it-works" aria-labelledby="how-title" className="border-t border-line bg-surface/40 py-16 sm:py-20">
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
      <p className="eyebrow text-accent">How it works</p>
      <h2 id="how-title" className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Three steps. Repeat daily.</h2>
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, index) => <li key={step.title} className="rounded-xl border border-line bg-canvas p-5">
          <span className="grid size-7 place-items-center rounded-md bg-accent/10 font-mono text-xs font-semibold text-accent">{index + 1}</span>
          <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
          <p className="mt-1.5 text-sm leading-6 text-muted">{step.description}</p>
        </li>)}
      </ol>
    </div>
  </section>;
}

export function ClosingCta() {
  return <section aria-labelledby="cta-title" className="border-t border-line py-16 sm:py-20">
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
      <div className="grid-backdrop rounded-xl border border-line bg-surface px-6 py-10 text-center sm:px-10">
        <Trophy aria-hidden="true" size={20} className="mx-auto text-warm" />
        <h2 id="cta-title" className="mt-4 text-2xl font-semibold tracking-tight">Solve your first problem today.</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">No account is needed to look around. Create one to save progress and, if you choose, appear on the opt-in leaderboard.</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/problems" className="action-link action-link-primary">Start practicing<ArrowRight aria-hidden="true" size={15} /></Link>
          <Link href="/leaderboard" className="action-link action-link-secondary">View the leaderboard</Link>
        </div>
      </div>
    </div>
  </section>;
}
