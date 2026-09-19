"use client";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { administer } from "@/features/admin/actions";
import { ADMIN_PAYLOAD_LIMIT, type AdminResult } from "@/features/admin/contracts";
export function ImportForm() {
  const [payload, setPayload] = useState(""); const [reviewed, setReviewed] = useState(false);
  const [result, setResult] = useState<AdminResult | null>(null); const [pending, setPending] = useState(false);
  const busy = useRef(false); const [, startTransition] = useTransition();
  function submit(event: FormEvent) {
    event.preventDefault(); if (busy.current) return;
    busy.current = true; setPending(true); setResult(null);
    startTransition(async () => {
      try { const response = await administer({ operation: "import", payload, reviewed }); setResult(response); if (response.success) { setPayload(""); setReviewed(false); } }
      catch { setResult({ success: false, message: "Import response interrupted. The JSON is retained; check the manager before retrying." }); }
      finally { busy.current = false; setPending(false); }
    });
  }
  return <form onSubmit={submit} className="space-y-5"><fieldset disabled={pending} className="min-w-0 space-y-5">
    <p className="text-sm leading-7 text-muted">Import a JSON array of 1–10 complete problem objects, below 400 KB, using the existing version 1 seed format. The whole batch succeeds or rolls back. Existing slugs are never overwritten. Publishing requires your review; validation does not prove custom solution correctness, and imported code is never executed here.</p>
    <label className="block space-y-2"><span>Choose a JSON file</span><input type="file" accept=".json,application/json" onChange={async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      if (file.size > ADMIN_PAYLOAD_LIMIT) { setResult({ success: false, message: "Choose a JSON file below 400 KB." }); return; }
      try { setPayload(await file.text()); setReviewed(false); } catch { setResult({ success: false, message: "Could not read this file. Paste the JSON below." }); }
    }} /></label>
    <label className="block space-y-2"><span>Problem JSON</span><textarea rows={18} className="w-full rounded-xl border border-muted/60 bg-canvas p-4 font-mono text-sm" value={payload} onChange={(e) => { setPayload(e.target.value); setReviewed(false); }} /></label>
    <label className="flex items-start gap-3 text-sm leading-7"><input type="checkbox" className="mt-2" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />I reviewed originality, explanations and expected outputs for every published problem.</label>
    <Button type="submit" disabled={!payload.trim()}>{pending ? "Importing…" : "Import new problems"}</Button>
  </fieldset>{result && <div role={result.success ? "status" : "alert"} className="rounded-xl border border-line p-4 text-sm leading-7"><p>{result.message}</p>{result.errors && <ul className="list-disc pl-5">{result.errors.map((x, i) => <li key={i}>{x}</li>)}</ul>}</div>}</form>;
}
