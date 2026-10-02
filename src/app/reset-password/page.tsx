import type { Metadata } from "next";
import Link from "next/link";
import { AuthPage, AccountsUnavailable } from "@/components/auth/auth-page";
import { ResetPasswordForm } from "@/components/auth/recovery-form";
import { accountsConfigured } from "@/lib/supabase/config";
import { createAuthClient } from "@/lib/supabase/server";
import { getRecoveryUser } from "@/features/auth/recovery-session";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  let verified = false;
  if (accountsConfigured()) {
    try { verified = Boolean(await getRecoveryUser(await createAuthClient())); }
    catch { /* Missing or expired recovery access must not render the mutation form. */ }
  }
  return <AuthPage title="Choose a new password" description="Use a unique password to secure your AlgoSprint account.">
    {!accountsConfigured() ? <AccountsUnavailable /> : verified ? <ResetPasswordForm /> : <div className="mt-6 space-y-4 text-sm leading-6">
      <p role="alert">Open a recent password reset link in this browser before choosing a new password.</p>
      <Link href="/forgot-password" className="inline-block rounded text-accent underline underline-offset-4">Request a new reset link</Link>
    </div>}
  </AuthPage>;
}
