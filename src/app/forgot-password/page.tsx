import type { Metadata } from "next";
import { AuthPage, AccountsUnavailable } from "@/components/auth/auth-page";
import { EmailRequestForm } from "@/components/auth/recovery-form";
import { accountsConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return <AuthPage title="Find your way back" description="Enter your email to request a password reset link. Open the link in the same browser you use here.">
    {accountsConfigured() ? <EmailRequestForm mode="recovery" /> : <AccountsUnavailable />}
  </AuthPage>;
}
