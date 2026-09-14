import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPage, AccountsUnavailable } from "@/components/auth/auth-page";
import { AuthForm } from "@/components/auth/auth-form";
import { accountsConfigured } from "@/lib/supabase/config";
import { getViewer } from "@/features/auth/session";
import { safeReturnTo } from "@/features/auth/validation";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = safeReturnTo(query.next);
  if (await getViewer()) redirect(next);
  return <AuthPage title="Welcome back" description="Pick up your practice, one clear idea at a time.">
    {query.confirmation === "failed" && <p role="alert" className="mt-4 text-sm text-warm">That confirmation link could not be used. It may have expired or opened in a different browser. Try signing in, or request a new signup link.</p>}
    {query.signedOut === "1" && <p role="status" className="mt-4 text-sm text-accent">You have signed out of this browser.</p>}
    {accountsConfigured() ? <AuthForm mode="login" returnTo={next} /> : <AccountsUnavailable />}
  </AuthPage>;
}
