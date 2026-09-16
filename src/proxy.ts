import type { NextRequest } from "next/server";
import { refreshAuth } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return refreshAuth(request);
}

export const config = {
  matcher: ["/login", "/register", "/auth/:path*", "/dashboard/:path*", "/progress/:path*", "/profile/:path*", "/admin/:path*", "/problems/:path*", "/notes/:path*", "/review/:path*", "/roadmaps/:path*", "/mock-interview/:path*", "/interview-results/:path*", "/api/:path*"],
};
