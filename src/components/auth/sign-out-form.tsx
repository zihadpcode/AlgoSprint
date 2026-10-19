"use client";
import { LogOut } from "lucide-react";
import { logout } from "@/features/auth/actions";
import { clearBrowserDrafts } from "@/features/drafts/storage";
import { SubmitButton } from "@/components/ui/submit-button";
// Clearing drafts on submit keeps private code and notes off shared devices after signing out.
export function SignOutForm({ menuItem = false }: { menuItem?: boolean }) {
  return <form action={logout} onSubmit={clearBrowserDrafts}>
    {menuItem
      ? <SubmitButton variant="quiet" pendingLabel="Signing out…" className="h-9 w-full justify-start gap-2.5 rounded-md px-2.5 font-normal"><LogOut aria-hidden="true" size={15} />Sign out</SubmitButton>
      : <SubmitButton variant="secondary" pendingLabel="Signing out…">Sign out</SubmitButton>}
  </form>;
}
