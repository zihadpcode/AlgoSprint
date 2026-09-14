"use client";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-2xl px-5 py-24"><ErrorState title="We couldn’t load this page" description="Please try again in a moment. If the problem continues, come back a little later." action={<><Button onClick={reset}>Try again</Button><ButtonLink href="/" variant="secondary">Back to home</ButtonLink></>} /></main>;
}
