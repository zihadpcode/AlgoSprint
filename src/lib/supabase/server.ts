import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { authForwardingOptions, authIpForwardingEnabled } from "./auth-forwarding";
import { authCookieOptions, getSupabaseConfig } from "./config";

export async function createAuthClient(writable = false) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Accounts are temporarily unavailable.");
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    ...authForwardingOptions(config, authIpForwardingEnabled() ? await headers() : new Headers()),
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        // Server Components only read cookies. Proxy persists refreshed tokens.
        // Actions and callbacks opt into writes, where failures must propagate.
        if (!writable) return;
        for (const { name, value, options } of values) jar.set(name, value, options);
      },
    },
  });
}
