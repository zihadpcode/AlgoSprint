import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getRecoveryUser(client: SupabaseClient) {
  // getClaims verifies the token signature and expiry. AMR is provider-issued;
  // editable user_metadata and callback query parameters cannot grant recovery.
  const { data, error } = await client.auth.getClaims();
  if (error || !data) return null;
  const now = Math.floor(Date.now() / 1000);
  const recentRecovery = data.claims.amr?.some((entry) => typeof entry === "object" && entry !== null &&
    entry.method === "recovery" && Number.isFinite(entry.timestamp) && entry.timestamp <= now && entry.timestamp > now - 3600);
  if (!recentRecovery) return null;
  const result = await client.auth.getUser();
  const user = result.data.user;
  if (result.error || !user || user.id !== data.claims.sub || user.is_anonymous || !user.email || !user.email_confirmed_at) return null;
  return user;
}
