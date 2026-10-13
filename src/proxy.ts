import { NextResponse, type NextRequest } from "next/server";
import { canonicalAuthRedirect } from "@/lib/supabase/canonical-host";
import { refreshAuth } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Start every auth flow on the host the emailed links return to; see canonical-host.ts.
  // The Host header is what the visitor typed; request.nextUrl.host can be the server's own bind address.
  const canonical = canonicalAuthRedirect(request.nextUrl, request.method, { appUrl: process.env.APP_URL, vercelEnv: process.env.VERCEL_ENV }, request.headers.get("host") ?? request.nextUrl.host);
  if (canonical) {
    // Temporary, uncached redirect: a permanent one would outlive a change of canonical domain.
    const response = NextResponse.redirect(canonical, 307);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  return refreshAuth(request);
}

export const config = {
  matcher: ["/login", "/register", "/forgot-password", "/reset-password", "/resend-confirmation", "/auth/:path*", "/dashboard/:path*", "/progress/:path*", "/profile/:path*", "/admin/:path*", "/problems/:path*", "/notes/:path*", "/bookmarks/:path*", "/review/:path*", "/roadmaps/:path*", "/mock-interview/:path*", "/interview-results/:path*", "/api/:path*"],
};
