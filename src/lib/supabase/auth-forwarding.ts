import "server-only";
import { isIP } from "node:net";

// Only end-user Auth operations may use the forwarding credential. In particular,
// a caller using this client for Data APIs or Auth admin APIs keeps the publishable key.
const userAuthPaths = new Set(["token", "signup", "recover", "resend", "user", "logout"].map((path) => `/auth/v1/${path}`));

export function authIpForwardingEnabled() {
  const flag = process.env.SUPABASE_AUTH_IP_FORWARDING;
  if (flag === undefined || flag === "false") return false;
  if (flag !== "true") throw new Error("Auth IP forwarding is misconfigured.");
  return true;
}

export function authForwardingOptions(config: { url: string; key: string }, headers: Pick<Headers, "get">) {
  if (!authIpForwardingEnabled()) return {};
  const secret = process.env.SUPABASE_AUTH_FORWARDING_SECRET_KEY;
  const ip = headers.get("x-vercel-forwarded-for");
  if (process.env.VERCEL !== "1" || !secret || !/^sb_secret_[A-Za-z0-9_-]{16,}$/.test(secret) || !ip || !isIP(ip)) {
    throw new Error("Auth IP forwarding is misconfigured.");
  }
  const origin = new URL(config.url).origin;
  const transport = globalThis.fetch;
  const authFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin !== origin || !userAuthPaths.has(url.pathname)) {
      return transport(request);
    }
    const forwarded = new Headers(request.headers);
    forwarded.set("apikey", secret);
    // Keep the verified user's bearer token for session-bound operations.
    if (!forwarded.has("authorization") || forwarded.get("authorization") === `Bearer ${config.key}`) {
      forwarded.set("authorization", `Bearer ${secret}`);
    }
    forwarded.set("sb-forwarded-for", ip);
    // Never send the credential onward through a provider redirect.
    return transport(new Request(request, { headers: forwarded, redirect: "error" }));
  };
  return { global: { fetch: authFetch } };
}
