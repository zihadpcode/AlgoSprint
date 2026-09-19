"use client";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="mx-auto max-w-2xl px-5 py-24"><ErrorState title="We couldn’t load this page" description="Try again in a moment. Copy any unsaved work before reloading. If the problem continues, return to the home page." action={<><Button onClick={retry}>Try again</Button><ButtonLink href="/" variant="secondary">Back to home</ButtonLink></>} /></main>;
}
