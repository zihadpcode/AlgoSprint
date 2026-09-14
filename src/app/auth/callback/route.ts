import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { accountsConfigured, getAppOrigin } from "@/lib/supabase/config";
import { safeReturnTo } from "@/features/auth/validation";

export async function GET(request: NextRequest) {
  if (!accountsConfigured()) return new NextResponse("Accounts are temporarily unavailable.", { status: 503, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  const origin = getAppOrigin();
  const code = request.nextUrl.searchParams.get("code");
  let destination = "/login?confirmation=failed";
  if (code && code.length <= 2048) {
    try {
      const client = await createAuthClient(true);
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) destination = safeReturnTo(request.nextUrl.searchParams.get("next"));
    } catch { /* Show a fixed message without reflecting provider errors or tokens. */ }
  }
  const response = NextResponse.redirect(new URL(destination, origin), 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
