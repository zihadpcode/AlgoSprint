import type { Metadata } from "next";
import { requireViewer } from "@/features/auth/session";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const viewer = await requireViewer();
  return <AccountFrame admin={viewer.role === "ADMIN"}>
    <PageHeading eyebrow="Your practice space" title={`Welcome, ${viewer.displayName || "learner"}.`} description="Build an approach you understand, then carry that insight into the next challenge." action={<ButtonLink href="/profile" variant="secondary">View profile</ButtonLink>} />
    <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <Card><Badge tone="success">Account ready</Badge><CardTitle className="mt-5">A small step, taken consistently.</CardTitle><CardDescription>Start with the question, trace a simple example, and explain your approach before optimizing it. Deliberate practice starts with understanding.</CardDescription></Card>
      <Card><CardTitle>Your practice rhythm</CardTitle><ol className="mt-5 space-y-4 text-sm text-muted">{["Read the constraints and choose an example.", "Write a first approach you can explain.", "Review what changed your understanding."].map((step, index) => <li key={step} className="flex gap-3"><span className="font-mono text-accent">0{index + 1}</span><span>{step}</span></li>)}</ol></Card>
    </div>
    <section className="mt-8" aria-label="Practice activity"><EmptyState title="Your next insight starts with a problem" description="Explore the library, work through a guided explanation, and keep a private note. Your progress page records attempts, solved counts and recent activity." action={<ButtonLink href="/progress">View your progress</ButtonLink>} /></section>
  </AccountFrame>;
}
