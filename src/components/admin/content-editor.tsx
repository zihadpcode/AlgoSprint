"use client";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ContentFields } from "./content-fields";
import { blankProblem, fromForm, problemFields, roadmapFields, toForm } from "@/features/admin/form-model";
import { administer } from "@/features/admin/actions";
import type { AdminCommand, AdminResult } from "@/features/admin/contracts";

type EditorProps = { kind: "problem" | "roadmap"; initial?: Record<string, unknown>; slug?: string; revision?: number; token?: string; status?: string };
export function ContentEditor({ kind, initial, slug, revision: initialRevision, token: initialToken, status: initialStatus }: EditorProps) {
  const fields = kind === "problem" ? problemFields : roadmapFields;
  const [draft, setDraft] = useState<Record<string, unknown>>(() => initial ? toForm(initial, fields) : blankProblem());
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const [revision, setRevision] = useState(initialRevision ?? null); const [token, setToken] = useState(initialToken ?? "");
  const [status, setStatus] = useState(initialStatus ?? "DRAFT");
  const [reviewed, setReviewed] = useState(false); const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState<AdminResult | null>(null); const [pending, setPending] = useState(false);
  const busy = useRef(false); const [, startTransition] = useTransition(); const router = useRouter();
  const dirty = JSON.stringify(draft) !== baseline;
  function send(command: AdminCommand) {
    if (busy.current) return;
    busy.current = true; setPending(true); setResult(null);
    startTransition(async () => {
      try {
        const response = await administer(command); setResult(response);
        if (response.success) {
          if (response.deleted) { router.replace("/admin"); return; }
          if (response.revision) setRevision(response.revision);
          if (response.token) setToken(response.token);
          const savedDraft = command.operation === "archive" ? { ...draft, status: "ARCHIVED" } : draft;
          setDraft(savedDraft); setBaseline(JSON.stringify(savedDraft)); setReviewed(false); setConfirmation("");
          if (!slug && response.slug) router.replace(`/admin/problems/${response.slug}`);
        }
      } catch { setResult({ success: false, message: "The response was interrupted. Your draft is retained. Copy it and reload to confirm the saved version before retrying." }); }
      finally { busy.current = false; setPending(false); }
    });
  }
  function save(event: FormEvent) {
    event.preventDefault();
    try {
      const content = fromForm(draft, fields);
      send(kind === "problem" ? { operation: "save", slug: slug ?? null, revision, payload: JSON.stringify(content), reviewed } :
        { operation: "roadmap", slug: slug!, token, payload: JSON.stringify({ content, status }), reviewed });
    } catch (error) { setResult({ success: false, message: error instanceof Error ? error.message : "Check the draft." }); }
  }
  return <div className="space-y-6">
    <p className="text-sm leading-7 text-muted">Save explicitly before leaving. All required content must be complete, even for a draft. Input and expected-output boxes use JSON; code is stored as text. {kind === "problem" && "The current taxonomy supports five patterns. Only the five original runner problems support execution; custom problems remain study content until reviewed runner support is added."}</p>
    <form onSubmit={save} className="space-y-6"><fieldset disabled={pending} className="min-w-0 space-y-6">
      <ContentFields fields={fields} value={draft} immutableSlug={Boolean(slug)} onChange={(next) => { setDraft(next); setReviewed(false); }} />
      {kind === "roadmap" && <label className="block space-y-2"><span>Publication status</span><Select value={status} onChange={(e) => { setStatus(e.target.value); setReviewed(false); }}>{["DRAFT", "PUBLISHED", "ARCHIVED"].map((s) => <option key={s}>{s}</option>)}</Select></label>}
      <label className="flex items-start gap-3 text-sm leading-7"><input type="checkbox" className="mt-2" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />I reviewed the originality, wording, sequence, examples and expected outputs. Required when saving published content.</label>
      <div className="flex flex-wrap gap-3"><Button type="submit">{pending ? "Saving…" : "Save content"}</Button><ButtonLink href="/admin" variant="secondary">Back to manager</ButtonLink></div>
    </fieldset></form>
    {result && <div role={result.success ? "status" : "alert"} className="rounded-xl border border-line p-4 text-sm leading-7"><p>{result.message}</p>{result.errors && <ul className="mt-3 list-disc pl-5">{result.errors.map((error, i) => <li key={i}>{error}</li>)}</ul>}</div>}
    {kind === "problem" && slug && revision && <fieldset disabled={pending || dirty} className="min-w-0 space-y-4 rounded-xl border border-line p-5">
      <legend className="px-2 font-semibold">Archive or safely delete</legend>
      <p className="text-sm leading-7 text-muted">Archive hides the problem and any roadmap containing it, preserving history. Deletion is permanent and allowed only after archiving, with no user history or references. Save unsaved changes first.</p>
      <label className="block space-y-2"><span className="text-sm">Type {slug} to confirm</span><Input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" /></label>
      <div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={confirmation !== slug || draft.status === "ARCHIVED"} onClick={() => send({ operation: "archive", slug, revision, confirmation })}>Archive problem</Button>
        <Button variant="danger" disabled={confirmation !== slug || draft.status !== "ARCHIVED"} onClick={() => send({ operation: "delete", slug, revision, confirmation })}>Permanently delete</Button></div>
    </fieldset>}
  </div>;
}
