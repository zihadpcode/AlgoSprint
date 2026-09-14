import "server-only";
import { z } from "zod";

const configSchema = z.object({
  url: z.url().refine((value) => {
    // Refinements can run even when an earlier format check failed. Never let
    // URL construction throw out of safeParse for empty/malformed configuration.
    try {
      const url = new URL(value);
      return !url.username && !url.password && !url.search && !url.hash && url.pathname === "/" && (url.protocol === "https:" ||
        (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
    } catch { return false; }
  }),
  key: z.string().regex(/^sb_publishable_[A-Za-z0-9_-]+$/).min(25),
});

export function getSupabaseConfig() {
  const result = configSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return result.success ? result.data : null;
}

export function getAppOrigin() {
  const raw = process.env.APP_URL || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : undefined);
  if (!raw) throw new Error("APP_URL must be configured before using accounts.");
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      !(url.protocol === "https:" || (process.env.NODE_ENV !== "production" && local && url.protocol === "http:"))) {
    throw new Error("APP_URL must be a trusted site origin.");
  }
  return url.origin;
}

export function accountsConfigured() {
  if (!getSupabaseConfig() || !process.env.DATABASE_URL) return false;
  try { getAppOrigin(); return true; } catch { return false; }
}

// Authentication is handled by server actions; no browser auth client is used.
export const authCookieOptions = {
  path: "/", sameSite: "lax" as const, httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
