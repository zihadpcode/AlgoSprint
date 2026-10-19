"use client";
import Link from "next/link";
// The root layout may be unavailable, so this boundary supplies its own document and inline styles (zinc palette).
const button = { display: "inline-flex", alignItems: "center", height: 40, padding: "0 16px", font: "inherit", fontSize: 14, fontWeight: 500, borderRadius: 8, border: "1px solid transparent", background: "#6366f1", color: "#fff", cursor: "pointer", textDecoration: "none" } as const;
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="en"><body style={{ margin: 0, background: "#09090b", color: "#fafafa", fontFamily: "Inter, system-ui, sans-serif" }}>
    <main id="main-content" style={{ maxWidth: 520, margin: "0 auto", padding: "96px 20px" }}>
      <div style={{ border: "1px solid #27272a", background: "#111113", borderRadius: 10, padding: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, letterSpacing: "-0.01em" }}>AlgoSprint couldn’t open this page</h1>
        <p style={{ lineHeight: 1.7, color: "#a1a1aa", fontSize: 14 }}>Your connection or the service may be temporarily unavailable. Try again, or return to the home page. Copy any unsaved work before leaving.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 20 }}>
          <button onClick={retry} style={button}>Try again</button>
          <Link href="/" style={{ ...button, background: "#18181b", border: "1px solid #27272a", color: "#fafafa" }}>Back to home</Link>
        </div>
      </div>
    </main>
  </body></html>;
}
