import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPage, AccountsUnavailable } from "@/components/auth/auth-page";
import { SignedOutDraftCleanup } from "@/components/auth/signed-out-draft-cleanup";
import { AuthForm } from "@/components/auth/auth-form";
import { accountsConfigured } from "@/lib/supabase/config";
import { getViewer } from "@/features/auth/session";
import { safeReturnTo } from "@/features/auth/validation";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = safeReturnTo(query.next);
  const linkFailed = query.confirmation === "failed";
  // A failed email callback must remain visible even if this browser already
  // has a session. Showing the fixed alert does not grant password recovery.
  if (!linkFailed && await getViewer().catch(() => null)) redirect(next);
  return <AuthPage title="Welcome back" description="Pick up your practice, one clear idea at a time.">
    {linkFailed && <p role="alert" className="mt-4 rounded-lg border border-warm/30 bg-warm/10 p-3 text-sm leading-6 text-warm">That email link could not be used. It may have expired, been opened already, or been opened in a different browser or on a different site address than the one you requested it from. Request a new link (signup confirmation or password reset) and open it in the same browser.</p>}
    {query.signedOut === "1" && <><SignedOutDraftCleanup /><p role="status" className="mt-4 rounded-lg border border-accent/25 bg-accent/10 p-3 text-sm text-accent">You have signed out of this browser.</p></>}
    {accountsConfigured() ? <AuthForm mode="login" returnTo={next} /> : <AccountsUnavailable />}
  </AuthPage>;
}
