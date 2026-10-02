"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DRAFT_CLEAR_EVENT, DRAFT_CLEAR_KEY, DRAFT_OWNER_KEY, readDeviceDraft, removeDeviceDraft, writeDeviceDraft, type DeviceDraft, type DraftScope } from "@/features/drafts/storage";

type Props = { scope: DraftScope | null; value: string; dirty: boolean; baseline?: string; onRestore: (value: string) => void; onClear: () => void; disabled?: boolean; copyOnly?: boolean };
export function DeviceDraftRecovery({ scope, value, dirty, baseline = "", onRestore, onClear, disabled = false, copyOnly = false }: Props) {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [recovery, setRecovery] = useState<DeviceDraft | null>(null);
  const [message, setMessage] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const owner = scope?.owner, kind = scope?.kind, target = scope?.target, revision = scope?.revision;
  useEffect(() => {
    let mounted = true;
    // Read browser storage after hydration, never during the server render.
    async function load() {
      await Promise.resolve();
      let result;
      try { result = readDeviceDraft(window.localStorage, owner && kind && target && revision ? { owner, kind, target, revision } : null); }
      catch { result = { status: "unavailable", draft: null } as const; }
      if (!mounted) return;
      setRecovery(result.draft); setUnavailable(result.status === "unavailable"); setReady(true);
    }
    void load(); return () => { mounted = false; };
  }, [owner, kind, target, revision]);
  useEffect(() => {
    const cleared = () => { setEnabled(false); setRecovery(null); setMessage("Device drafts cleared. Recovery is off."); onClear(); };
    const storageChanged = (event: StorageEvent) => { if (event.key === DRAFT_CLEAR_KEY || event.key === null || (event.key === DRAFT_OWNER_KEY && event.newValue !== owner)) cleared(); };
    window.addEventListener(DRAFT_CLEAR_EVENT, cleared); window.addEventListener("storage", storageChanged);
    return () => { window.removeEventListener(DRAFT_CLEAR_EVENT, cleared); window.removeEventListener("storage", storageChanged); };
  }, [onClear, owner]);
  useEffect(() => {
    if (!ready || !enabled || recovery || !owner || !kind || !target || !revision || disabled) return;
    const current = { owner, kind, target, revision };
    let succeeded = false;
    try { succeeded = dirty ? writeDeviceDraft(window.localStorage, current, value, baseline) : removeDeviceDraft(window.localStorage, current); } catch { /* Blocked storage is a recoverable failure. */ }
    if (!succeeded) {
      // Queue the external storage result without blocking the editor's change handler.
      queueMicrotask(() => { setUnavailable(true); setEnabled(false); setMessage("Device storage is unavailable or this draft is too large. Copy your work before leaving."); });
    }
  }, [ready, enabled, recovery, owner, kind, target, revision, value, dirty, baseline, disabled]);
  if (!scope) return <p className="text-xs leading-6 text-muted">Guest drafts stay on this page. Sign in to enable recovery, or copy your work before leaving.</p>;
  if (copyOnly && !recovery && !unavailable) return null;
  const stale = recovery && (copyOnly || recovery.revision !== scope.revision || recovery.baseline !== baseline);
  function discard() {
    let removed = false;
    try { removed = removeDeviceDraft(window.localStorage, scope!); } catch { /* Keep the prompt if deletion fails. */ }
    if (!removed) { setUnavailable(true); setMessage("Device storage is unavailable. The saved draft could not be cleared."); return; }
    setRecovery(null); setMessage("Saved device draft discarded.");
  }
  return <div className="space-y-3 rounded-xl border border-line p-4">
    {!copyOnly && <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={enabled} disabled={!ready || unavailable || disabled} onChange={(event) => {
      const checked = event.target.checked; setEnabled(checked);
      if (!checked) {
        let removed = false;
        try { removed = removeDeviceDraft(window.localStorage, scope); } catch { /* Storage may be denied. */ }
        if (!removed) setUnavailable(true);
        setRecovery(null); setMessage(removed ? "Device recovery disabled and saved draft cleared." : "Device recovery disabled. Storage is unavailable; the previous device draft could not be cleared.");
      } else setMessage("Device recovery enabled for this page.");
    }} /><span>Keep unsaved drafts on this device for up to 7 days</span></label>}
    <p className="text-xs leading-6 text-muted">Use only on a trusted device: anyone using this browser can access local drafts. Sign out to clear them. Recovery never submits code, saves interview answers or changes your score.</p>
    {recovery && <div className="space-y-3">
      <p role="status" className="text-sm">{stale ? copyOnly ? "This interview has ended. Copy any useful unsaved text below. Only explicitly saved answers appear in the report and count toward your score." : "This device draft belongs to an older problem revision or saved answer. Copy any useful text below; your current answer will stay in place." : "An unsaved device draft is available. Restoring replaces the text on this page and enables device recovery."}</p>
      {stale && <label className="block text-sm">Device draft for copying<textarea aria-label="Device draft for copying" readOnly rows={5} value={copyText(recovery)} className="mt-2 w-full rounded-xl border border-line bg-canvas p-3 font-mono text-xs" /></label>}
      <div className="flex flex-wrap gap-3">{!stale && <Button variant="secondary" disabled={disabled} onClick={() => {
        onRestore(recovery.payload); setRecovery(null); setEnabled(true); setMessage("Draft restored locally. Review it before running code or saving an answer.");
      }}>Restore device draft</Button>}<Button variant="quiet" onClick={discard}>Discard device draft</Button></div>
    </div>}
    <p role="status" className="text-xs text-muted">{unavailable ? message || "Device storage is unavailable. Copy your work before leaving." : message || (copyOnly ? "Local drafts are excluded from saved responses in this report." : enabled ? "Unsaved changes are kept locally on this device." : "Recovery is off. Unsaved work stays on this page until you enable it.")}</p>
  </div>;
}

function copyText(draft: DeviceDraft) {
  if (draft.kind === "code") return Object.entries(JSON.parse(draft.payload) as Record<string, string>).map(([language, code]) => `${language}\n${code}`).join("\n\n");
  return (JSON.parse(draft.payload) as { reasoning: string; tradeoffs: string; checks: string }[]).map((answer, index) => `Question ${index + 1}\nReasoning and solution\n${answer.reasoning}\n\nComplexity and tradeoffs\n${answer.tradeoffs}\n\nTests and checks\n${answer.checks}`).join("\n\n");
}
