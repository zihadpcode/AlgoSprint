"use client";

import { startTransition, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { executeCode } from "@/features/submissions/actions";
import { runInBrowser } from "@/features/submissions/browser-runner";
import type { ExecutionState, RunnerSignature } from "@/features/submissions/contracts";
import { ExecutionPanels, type EditorExample } from "./execution-panels";

export function RunnerControls({ slug, code, language, enabled, signedIn, examples, signature }: {
  slug: string; code: string; language: string; enabled: boolean; signedIn: boolean; examples: EditorExample[]; signature?: RunnerSignature;
}) {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [last, setLast] = useState<{ code: string; language: string; response: ExecutionState } | null>(null);
  const validCode = code.trim().length > 0 && code.length <= 20_000;
  // Visible tests run locally in the browser for everyone; only Submit needs the provider and an account.
  const canRun = Boolean(signature) && language === "JAVASCRIPT" && examples.length > 0;
  const canSubmit = enabled && language === "JAVASCRIPT";
  function run() {
    if (busy.current || !signature) return;
    busy.current = true; setPending(true); setLast(null);
    const captured = { code, language };
    runInBrowser({ entryPoint: signature.entryPoint, keys: signature.keys, code, cases: examples.map((example) => ({ position: example.position, input: (example.input ?? {}) as Record<string, unknown>, expected: example.output })) })
      .then((result) => setLast({ ...captured, response: { success: true, result } }))
      .catch(() => setLast({ ...captured, response: { success: false, message: "The browser could not run this code. Reload the page and try again." } }))
      .finally(() => { setPending(false); busy.current = false; });
  }
  function submit() {
    if (busy.current) return;
    busy.current = true; setPending(true); setLast(null);
    // Urgent pending feedback must render before the asynchronous transition.
    // Keep the server action in a transition so revalidated progress can refresh.
    startTransition(async () => {
      let response: ExecutionState;
      try { response = await executeCode({ slug, code, language, mode: "SUBMIT" }); }
      catch { response = { success: false, message: "The connection was interrupted. The result may have been saved. Retrying creates a new attempt." }; }
      setLast({ code, language, response }); setPending(false); busy.current = false;
    });
  }
  const stale = last && (last.code !== code || last.language !== language);
  const lastBrowser = last?.response.success && last.response.result.browser;
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-3">
      <Button disabled={!canRun || pending || !validCode} onClick={run}>Run visible tests</Button>
      <Button variant="secondary" disabled={!canSubmit || !signedIn || pending || !validCode} onClick={submit}>Submit solution</Button>
    </div>
    {!signedIn && canSubmit && <ButtonLink href={`/login?next=${encodeURIComponent(`/problems/${slug}`)}`} variant="secondary">Sign in to submit solutions</ButtonLink>}
    <p className="text-xs leading-6 text-muted">
      {canRun ? "Run executes the visible examples in your browser and saves nothing. " : "Running code in the browser is not available for this problem. "}
      {canSubmit ? "Submit checks the full suite on the server, including hidden tests, and saves an attempt. Limit: 5 per minute and 30 per hour." : "Submitting for a verified result is not available yet for this workspace. You can continue editing."}
    </p>
    {code.length > 20_000 && <p className="text-sm text-warm">Code must be at most 20,000 characters.</p>}
    <p role="status" aria-live="polite" className="text-sm text-accent">{pending ? "Executing the captured draft… You can keep editing." : lastBrowser ? "Ran in your browser. Nothing was saved." : last?.response.success ? "Execution result saved." : ""}</p>
    {last && !last.response.success && <p role="alert" className="text-sm text-warm">{last.response.message}</p>}
    {stale && <p className="text-sm text-warm">This result belongs to an earlier draft or language. Run again to check your current code.</p>}
    <ExecutionPanels examples={examples} available={canRun || canSubmit} result={last?.response.success ? last.response.result : undefined} />
  </div>;
}
