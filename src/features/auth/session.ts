import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";
import { accountsConfigured } from "@/lib/supabase/config";
import { getDatabase } from "@/lib/prisma";
import { ensureProfile } from "./profile";
import { safeReturnTo } from "./validation";

// React cache lasts for one server render; never cache this across users/requests.
export const getViewer = cache(async () => {
  if (!accountsConfigured()) return null;
  const client = await createAuthClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    if (error && (error.status === undefined || error.status >= 500)) {
      throw new Error("Accounts are temporarily unavailable. Please try again.");
    }
    return null;
  }
  const profile = await ensureProfile(getDatabase(), data.user);
  return { ...profile, email: data.user.email ?? null };
});

export async function requireViewer(returnTo = "/dashboard") {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(safeReturnTo(returnTo))}`);
  return viewer;
}

export async function requireAdmin() {
  const viewer = await requireViewer("/admin");
  if (viewer.role !== "ADMIN") notFound();
  return viewer;
}
