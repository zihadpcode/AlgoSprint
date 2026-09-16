"use client";

import { startTransition, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { executeCode } from "@/features/submissions/actions";
import type { ExecutionState } from "@/features/submissions/contracts";
import { ExecutionPanels, type EditorExample } from "./execution-panels";

export function RunnerControls({ slug, code, language, enabled, signedIn, examples }: {
  slug: string; code: string; language: string; enabled: boolean; signedIn: boolean; examples: EditorExample[];
}) {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [last, setLast] = useState<{ code: string; language: string; response: ExecutionState } | null>(null);
  const available = enabled && language === "JAVASCRIPT";
  async function execute(mode: "RUN" | "SUBMIT") {
    if (busy.current) return;
    busy.current = true; setPending(true); setLast(null);
    let response: ExecutionState;
    try { response = await executeCode({ slug, code, language, mode }); }
    catch { response = { success: false, message: "The connection was interrupted. The result may have been saved. Retrying creates a new attempt." }; }
    setLast({ code, language, response }); setPending(false); busy.current = false;
  }
  const stale = last && (last.code !== code || last.language !== language);
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-3">
      <Button disabled={!available || !signedIn || pending || !code.trim() || code.length > 20_000} onClick={() => startTransition(async () => { await execute("RUN"); })}>Run visible tests</Button>
      <Button variant="secondary" disabled={!available || !signedIn || pending || !code.trim() || code.length > 20_000} onClick={() => startTransition(async () => { await execute("SUBMIT"); })}>Submit solution</Button>
    </div>
    {!signedIn && <ButtonLink href={`/login?next=${encodeURIComponent(`/problems/${slug}`)}`} variant="secondary">Sign in to run code</ButtonLink>}
    <p className="text-xs leading-6 text-muted">{available ? "Run checks visible tests. Submit checks the full suite, including hidden tests. Both save an attempt. Limit: 5 per minute and 30 per hour." : "Code execution is not available yet for this workspace. You can continue editing."}</p>
    {code.length > 20_000 && <p className="text-sm text-warm">Code must be at most 20,000 characters.</p>}
    <p role="status" aria-live="polite" className="text-sm text-accent">{pending ? "Executing the captured draft… You can keep editing." : last?.response.success ? "Execution result saved." : ""}</p>
    {last && !last.response.success && <p role="alert" className="text-sm text-warm">{last.response.message}</p>}
    {stale && <p className="text-sm text-warm">This result belongs to an earlier draft or language. Run again to check your current code.</p>}
    <ExecutionPanels examples={examples} available={available} result={last?.response.success ? last.response.result : undefined} />
  </div>;
}
