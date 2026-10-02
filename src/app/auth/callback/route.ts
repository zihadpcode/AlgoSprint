import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { accountsConfigured, getAppOrigin } from "@/lib/supabase/config";
import { safeReturnTo } from "@/features/auth/validation";

export async function GET(request: NextRequest) {
  if (!accountsConfigured()) return new NextResponse("Accounts are temporarily unavailable.", { status: 503, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  const origin = getAppOrigin();
  const code = request.nextUrl.searchParams.get("code");
  const flowId = request.nextUrl.searchParams.get("sb_flow_id");
  let destination = "/login?confirmation=failed";
  if (code && code.length <= 2048 && (flowId === null || /^[a-zA-Z0-9_-]{8,64}$/.test(flowId))) {
    try {
      const client = await createAuthClient(true);
      const { data, error } = flowId
        ? await client.auth.exchangeCodeForSession(code, { flowId })
        : await client.auth.exchangeCodeForSession(code);
      // The installed SDK returns this verifier-bound flow type at runtime.
      // Do not trust a posted `type=recovery` or `next=/reset-password`.
      if (!error) destination = data && "redirectType" in data && data.redirectType === "recovery"
        ? "/reset-password" : safeReturnTo(request.nextUrl.searchParams.get("next"));
    } catch { /* Show a fixed message without reflecting provider errors or tokens. */ }
  }
  const response = NextResponse.redirect(new URL(destination, origin), 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
