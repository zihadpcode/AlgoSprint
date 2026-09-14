"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-xl px-5 py-24">
    <h1 className="text-3xl font-semibold">We couldn’t load this page</h1>
    <p className="mt-4 leading-7 text-muted">Please try again in a moment. If the problem continues, come back a little later.</p>
    <div className="mt-7 flex flex-wrap gap-4"><button onClick={reset} className="action-link action-link-primary">Try again</button><Link href="/" className="action-link action-link-secondary">Back to home</Link></div>
  </main>;
}
