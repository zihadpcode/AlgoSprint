"use client";

import { startTransition, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Info, Play, Send } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { toast } from "@/components/ui/toast";
import { Popover } from "@/components/workspace/popover";
import { executeCode } from "@/features/submissions/actions";
import { runInBrowser } from "@/features/submissions/browser-runner";
import { verdictLabels, type ExecutionResult, type ExecutionState, type RunnerSignature } from "@/features/submissions/contracts";
import { editorLanguages, type EditorLanguage } from "./editor-state";
import { ExecutionPanels, useDrawerState, verdictTone, type EditorExample } from "./execution-panels";
import { CustomInputPanel } from "./custom-input-panel";
import { resolveShortcut, shortcutIgnoresTarget } from "./shortcuts";

const noopSubscribe = () => () => {};
const detectMac = () => /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

function announce(response: ExecutionState) {
  if (!response.success) { toast("Could not complete the run", { tone: "error", description: response.message }); return; }
  const result: ExecutionResult = response.result;
  const detail = `${result.passedCount}/${result.totalCount} passed${result.runtimeMs == null ? "" : ` · ${result.runtimeMs} ms`}`;
  if (result.status === "ACCEPTED") { toast(result.mode === "SUBMIT" ? "Accepted" : "All visible tests passed", { tone: "success", description: detail }); return; }
  toast(verdictLabels[result.status], { tone: verdictTone(result.status) === "warm" ? "warning" : "error", description: detail });
}

// serverLanguages lists the languages the configured runner can execute on the server (see supportedRunnerLanguages).
// JavaScript visible tests always run in the browser; every other language needs the server, an account and the rate limit.
export function RunnerControls({ slug, code, language, enabled, signedIn, examples, signature, serverLanguages = ["JAVASCRIPT"] }: {
  slug: string; code: string; language: string; enabled: boolean; signedIn: boolean; examples: EditorExample[]; signature?: RunnerSignature; serverLanguages?: readonly string[];
}) {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [last, setLast] = useState<{ code: string; language: string; response: ExecutionState } | null>(null);
  const drawer = useDrawerState();
  const { setTab, setOpen } = drawer;
  const mac = useSyncExternalStore(noopSubscribe, detectMac, () => false);
  const validCode = code.trim().length > 0 && code.length <= 20_000;
  const browserRun = language === "JAVASCRIPT";
  const serverReady = enabled && serverLanguages.includes(language);
  // JavaScript visible tests run locally in the browser for everyone; only Submit needs the provider and an account.
  // Other languages run their visible tests on the server in RUN mode, which needs an account and shares the rate limit.
  const canRun = examples.length > 0 && (browserRun ? Boolean(signature) : serverReady && signedIn);
  const canSubmit = serverReady;
  const runDisabled = !canRun || pending || !validCode;
  const submitDisabled = !canSubmit || !signedIn || pending || !validCode;
  const languageName = editorLanguages[language as EditorLanguage]?.label ?? language;
  const finish = useCallback((captured: { code: string; language: string }, response: ExecutionState) => {
    setLast({ ...captured, response }); setPending(false); busy.current = false; announce(response);
  }, []);
  function begin() { busy.current = true; setPending(true); setLast(null); setTab("result"); setOpen(true); }
  function run() {
    if (busy.current) return;
    if (!browserRun) { execute("RUN"); return; }
    if (!signature) return;
    begin();
    const captured = { code, language };
    runInBrowser({ entryPoint: signature.entryPoint, keys: signature.keys, code, cases: examples.map((example) => ({ position: example.position, input: (example.input ?? {}) as Record<string, unknown>, expected: example.output })) })
      .then((result) => finish(captured, { success: true, result }))
      .catch(() => finish(captured, { success: false, message: "The browser could not run this code. Reload the page and try again." }));
  }
  function submit() { if (!busy.current) execute("SUBMIT"); }
  function execute(mode: "RUN" | "SUBMIT") {
    begin();
    // Urgent pending feedback must render before the asynchronous transition.
    // Keep the server action in a transition so revalidated progress can refresh.
    startTransition(async () => {
      let response: ExecutionState;
      try { response = await executeCode({ slug, code, language, mode }); }
      catch { response = { success: false, message: "The connection was interrupted. The result may have been saved. Retrying creates a new attempt." }; }
      finish({ code, language }, response);
    });
  }
  // The listener runs in the capture phase on window, so it also fires while focus is inside Monaco, which would
  // otherwise consume Ctrl/Cmd+Enter. Disabled actions fall through untouched.
  const latest = useRef({ run, submit, runDisabled, submitDisabled });
  useEffect(() => { latest.current = { run, submit, runDisabled, submitDisabled }; });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (shortcutIgnoresTarget(event.target as Element | null)) return;
      const state = latest.current;
      const action = resolveShortcut(event, { run: !state.runDisabled, submit: !state.submitDisabled });
      if (!action) return;
      event.preventDefault(); event.stopPropagation();
      if (action === "run") state.run(); else state.submit();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
  const stale = last && (last.code !== code || last.language !== language);
  const lastBrowser = last?.response.success && last.response.result.browser;
  const mod = mac ? "⌘" : "Ctrl";
  const customAvailable = browserRun && Boolean(signature);
  return <>
    <ExecutionPanels examples={examples} available={canRun || canSubmit} pending={pending} result={last?.response.success ? last.response.result : undefined} drawer={drawer} customAvailable={customAvailable}
      custom={signature ? <CustomInputPanel code={code} signature={signature} firstExample={examples[0]?.input} validCode={customAvailable && validCode} /> : undefined} />
    <div className="shrink-0 space-y-1.5 border-t border-line bg-surface px-3 py-2">
      <div className="space-y-1 empty:hidden">
        {code.length > 20_000 && <p className="text-xs text-warm">Code must be at most 20,000 characters.</p>}
        {last && !last.response.success && <p role="alert" className="text-xs text-warm">{last.response.message}</p>}
        {stale && <p className="text-xs text-warm">This result belongs to an earlier draft or language. Run again to check your current code.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Popover label="How running and submitting work" icon={<Info aria-hidden="true" size={15} />} align="start" direction="up" panelClassName="w-[min(26rem,calc(100vw-2rem))] space-y-2 text-xs leading-5 text-muted">
          <p>
            {browserRun
              ? <>{canRun ? "Run executes the visible examples in your browser and saves nothing. " : "Running code in the browser is not available for this problem. "}</>
              : serverReady
                ? <>Run executes the visible examples on the server, saves an attempt and requires you to sign in. </>
                : <>{languageName} code cannot be run on this server yet, so Run and Submit are disabled. You can keep editing. </>}
            {canSubmit ? `Submit checks the full suite on the server, including hidden tests, and saves an attempt. Limit: 5 per minute and 30 per hour${browserRun ? "." : ", shared with Run."}` : browserRun ? "Submitting for a verified result is not available yet for this workspace. You can continue editing." : ""}
          </p>
          {serverReady && <p>After a server Run or Submit is saved, code and detailed results from attempts older than 30 days may be removed. Your attempt history stays. Older data may remain if you stop using the server runner.</p>}
        </Popover>
        <p role="status" aria-live="polite" className="min-w-0 flex-1 truncate text-xs text-accent">{pending ? "Executing the captured draft… You can keep editing." : lastBrowser ? "Ran in your browser. Nothing was saved." : last?.response.success ? "Execution result saved." : ""}</p>
        {!signedIn && serverReady && <ButtonLink size="sm" href={`/login?next=${encodeURIComponent(`/problems/${slug}`)}`} variant="quiet" className="text-accent">{browserRun ? "Sign in to submit solutions" : `Sign in to run ${languageName} code`}</ButtonLink>}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="secondary" aria-label="Run visible tests" aria-keyshortcuts="Control+Enter Meta+Enter" disabled={runDisabled} onClick={run}>
            <Play aria-hidden="true" size={13} />Run<span aria-hidden="true" className="ml-0.5 hidden items-center gap-0.5 sm:inline-flex"><Kbd>{mod}</Kbd><Kbd>↵</Kbd></span>
          </Button>
          <Button size="sm" variant="success" aria-label="Submit solution" aria-keyshortcuts="Control+Shift+Enter Meta+Shift+Enter" disabled={submitDisabled} onClick={submit}>
            <Send aria-hidden="true" size={13} />Submit<span aria-hidden="true" className="ml-0.5 hidden items-center gap-0.5 sm:inline-flex"><Kbd className="border-emerald-950/30 bg-emerald-950/15 text-emerald-950">{mod}</Kbd><Kbd className="border-emerald-950/30 bg-emerald-950/15 text-emerald-950">⇧</Kbd><Kbd className="border-emerald-950/30 bg-emerald-950/15 text-emerald-950">↵</Kbd></span>
          </Button>
        </div>
      </div>
    </div>
  </>;
}
