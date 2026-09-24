import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The sandbox worker thread requires these at runtime from node_modules; keep them out of the server bundle.
  serverExternalPackages: ["quickjs-emscripten-core", "@jitl/quickjs-singlefile-cjs-release-sync"],
  // Only the worker's source string requires them, so file tracing cannot see them. Ship them with the problem page,
  // whose Submit action runs the sandbox; scripts/check-sandbox-trace.mjs verifies the traced set can load them.
  outputFileTracingIncludes: {
    "/problems/\\[slug\\]": [
      "./node_modules/quickjs-emscripten-core/**/*",
      "./node_modules/@jitl/quickjs-singlefile-cjs-release-sync/**/*",
      "./node_modules/@jitl/quickjs-ffi-types/**/*",
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
};
export default nextConfig;
