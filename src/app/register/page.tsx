import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPage, AccountsUnavailable } from "@/components/auth/auth-page";
import { AuthForm } from "@/components/auth/auth-form";
import { accountsConfigured } from "@/lib/supabase/config";
import { getViewer } from "@/features/auth/session";

export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function RegisterPage() {
  if (await getViewer()) redirect("/dashboard");
  return <AuthPage title="Make room for progress" description="Create your AlgoSprint account and build a practice habit you can keep.">
    {accountsConfigured() ? <AuthForm mode="register" /> : <AccountsUnavailable />}
  </AuthPage>;
}
