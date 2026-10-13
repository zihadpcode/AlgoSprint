// Auth cookies, including the one-time PKCE code verifier that an emailed confirmation or password-reset link needs, are
// stored per hostname. The links Supabase emails always return to the canonical APP_URL origin, so a flow that starts on
// any other hostname for the same deployment (for example the team-scoped *.vercel.app alias) can never finish: the
// callback finds no verifier, fails silently, and the single-use link is already spent.

// Only the pages where a sign-in, confirmation or reset flow starts or ends. Other pages keep working on any host, which
// keeps per-deployment URLs usable for inspection.
const AUTH_ENTRY_PATHS = new Set(["/login", "/register", "/forgot-password", "/reset-password", "/resend-confirmation"]);

export type CanonicalHostEnv = { appUrl: string | undefined; vercelEnv: string | undefined };

// Added to the redirect target. A request that already carries it is never redirected again, so even if the host were
// misdetected the worst outcome is one extra hop, never a redirect loop on the sign-in pages.
export const CANONICAL_MARKER = "_ch";

/**
 * Returns the canonical URL to redirect to, or null when no redirect applies. `requestHost` is the host the visitor used
 * (the Host header). The target never comes from the request: its origin is always APP_URL, so this cannot be turned into
 * an open redirect.
 */
export function canonicalAuthRedirect(requestUrl: URL, method: string, env: CanonicalHostEnv, requestHost: string = requestUrl.host): URL | null {
  // Preview and development deployments legitimately run on their own hostnames.
  if (env.vercelEnv !== "production") return null;
  if (method !== "GET" && method !== "HEAD") return null;
  const path = requestUrl.pathname.replace(/\/+$/, "") || "/";
  if (!AUTH_ENTRY_PATHS.has(path)) return null;
  let canonical: URL;
  try { canonical = new URL(env.appUrl ?? ""); } catch { return null; }
  // Mirror getAppOrigin(): a plain https origin, with no credentials, path, query or fragment.
  if (canonical.protocol !== "https:" || canonical.username || canonical.password || canonical.pathname !== "/" || canonical.search || canonical.hash) return null;
  if (requestHost.trim().toLowerCase() === canonical.host) return null;
  if (requestUrl.searchParams.has(CANONICAL_MARKER)) return null;
  const target = new URL(path + requestUrl.search, canonical.origin);
  target.searchParams.set(CANONICAL_MARKER, "1");
  return target;
}
