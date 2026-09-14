import type { NextRequest } from "next/server";
import { refreshAuth } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return refreshAuth(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp)$).*)"],
};
