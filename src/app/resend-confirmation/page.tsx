import type { Metadata } from "next";
import { AuthPage, AccountsUnavailable } from "@/components/auth/auth-page";
import { EmailRequestForm } from "@/components/auth/recovery-form";
import { accountsConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Resend confirmation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function ResendConfirmationPage() {
  return <AuthPage title="Confirm your email" description="Request a fresh signup confirmation link. Open it in the same browser you use here.">
    {accountsConfigured() ? <EmailRequestForm mode="confirmation" /> : <AccountsUnavailable />}
  </AuthPage>;
}
