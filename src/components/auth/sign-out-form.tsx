"use client";
import { logout } from "@/features/auth/actions";
import { clearBrowserDrafts } from "@/features/drafts/storage";
import { SubmitButton } from "@/components/ui/submit-button";
export function SignOutForm() {
  return <form action={logout} onSubmit={clearBrowserDrafts}><SubmitButton variant="secondary" pendingLabel="Signing out…">Sign out</SubmitButton></form>;
}
