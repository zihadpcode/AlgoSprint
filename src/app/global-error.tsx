"use client";
import Link from "next/link";
// The root layout may be unavailable, so this boundary supplies its own document.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="en"><body style={{ margin: 0, background: "#090d16", color: "#f3f6fc", fontFamily: "system-ui, sans-serif" }}>
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "64px 24px" }}>
      <h1>AlgoSprint couldn’t open this page</h1><p style={{ lineHeight: 1.8 }}>Your connection or the service may be temporarily unavailable. Try again, or return to the home page. Copy any unsaved work before leaving.</p>
      <button onClick={retry} style={{ padding: "12px 20px", font: "inherit", cursor: "pointer" }}>Try again</button>{" "}<Link href="/" style={{ color: "#8ab4ff", padding: 12 }}>Back to home</Link>
    </main>
  </body></html>;
}
