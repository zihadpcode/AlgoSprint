import { cookies } from "next/headers";
import { TopBar } from "@/components/layout/app-shell";

// Supabase stores the session in `sb-<project>-auth-token`, split into `.0`, `.1`, ... chunks when it is large.
const AUTH_COOKIE = /^sb-.+-auth-token(?:\.\d+)?$/;

/** Whether the request carries a session cookie. Presence only: it picks which header to draw and nothing else. The
 *  signed-in header verifies the viewer itself and falls back to the guest actions when the session is not valid. */
export function hasAuthCookie(names: readonly string[]) {
  return names.some((name) => AUTH_COOKIE.test(name));
}

/** Top bar for the landing page. It renders the signed-in header for returning visitors, so "Sign in" is not offered to
 *  someone who already has a session. */
export async function SiteHeader() {
  const jar = await cookies();
  return <TopBar signedIn={hasAuthCookie(jar.getAll().map((cookie) => cookie.name))} />;
}
