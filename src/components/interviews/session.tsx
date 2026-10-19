"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DeviceDraftRecovery } from "@/components/drafts/device-draft-recovery";
import { interviewDraftSchema, removeDeviceDraft } from "@/features/drafts/storage";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { interviewAction } from "@/features/interviews/actions";
import { EMPTY_ANSWER, type InterviewAnswer, type SessionView } from "@/features/interviews/contracts";

const DIMENSIONS = [["reasoning", "reasoningRating", "Reasoning and solution / code"], ["tradeoffs", "tradeoffsRating", "Complexity and tradeoffs"], ["checks", "checksRating", "Tests, examples and checks"]] as const;
// A rating starts unchosen (null) so written text is never silently scored as 0. Only the saved contract uses 0–2.
type Draft = Omit<InterviewAnswer, "reasoningRating" | "tradeoffsRating" | "checksRating"> & { reasoningRating: number | null; tradeoffsRating: number | null; checksRating: number | null };
function toDraft(answer: InterviewAnswer): Draft {
  const draft: Draft = { ...answer };
  for (const [field, rating] of DIMENSIONS) if (!answer[field].trim() && answer[rating] === 0) draft[rating] = null;
  return draft;
}
export function toAnswer(draft: Draft): InterviewAnswer {
  return { ...draft, reasoningRating: draft.reasoningRating ?? 0, tradeoffsRating: draft.tradeoffsRating ?? 0, checksRating: draft.checksRating ?? 0 };
}
export function unratedAreas(draft: Draft) {
  return DIMENSIONS.filter(([field, rating]) => draft[field].trim() && draft[rating] === null).map(([, , label]) => label.toLowerCase());
}

export function InterviewSession({ session, draftOwner = null }: { session: SessionView; draftOwner?: string | null }) {
  const router = useRouter(); const busy = useRef(false);
  const [drafts, setDrafts] = useState(session.questions.map((q) => toDraft(q.answer)));
  const [tokens, setTokens] = useState(session.questions.map((q) => q.token));
  const [saved, setSaved] = useState(session.questions.map((q) => JSON.stringify(q.answer)));
  const [ended, setEnded] = useState(false);
  const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  const [remaining, setRemaining] = useState(session.remainingMs); const baseline = useRef<number | null>(null);
  const clearDrafts = useCallback(() => setDrafts(session.questions.map(() => toDraft(EMPTY_ANSWER))), [session.questions]);
  const draftScope = draftOwner ? { owner: draftOwner, kind: "interview" as const, target: session.id, revision: JSON.stringify(session.questions.map((q) => [q.id, q.prompt.revision])) } : null;
  const dirty = drafts.some((d, i) => JSON.stringify(toAnswer(d)) !== saved[i]);
  useEffect(() => {
    baseline.current = performance.now(); const wallStart = Date.now();
    const tick = () => setRemaining(Math.max(0, session.remainingMs - Math.max(Date.now() - wallStart, performance.now() - baseline.current!)));
    const timer = setInterval(tick, 500); window.addEventListener("focus", tick);
    return () => { clearInterval(timer); window.removeEventListener("focus", tick); };
  }, [session.id, session.remainingMs]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const seconds = Math.ceil(remaining / 1000);
  async function send(operation: "save" | "finish" | "abandon", index?: number) {
    if (busy.current) return;
    if (operation !== "save" && dirty && !window.confirm("Unsaved text will not be included. Copy it or cancel and save each answer first. End this session?")) return;
    if (operation === "abandon" && !window.confirm("Abandon this session without a score? Saved answers will remain in its report.")) return;
    if (operation === "save") {
      const unrated = unratedAreas(drafts[index!]);
      if (unrated.length) { setMessage(`Choose a self-rating for ${unrated.join(", ")} before saving. Only the ratings count toward your score.`); return; }
    }
    busy.current = true; setPending(true);
    try {
      const result = await interviewAction(operation === "save" ? { operation, id: session.id, questionId: session.questions[index!].id, token: tokens[index!], answer: toAnswer(drafts[index!]) } : { operation, id: session.id });
      setMessage(result.message);
      if (result.success && result.ended) { if (operation === "save") { setRemaining(0); setMessage(`${result.message} Your text remains here to copy before opening the report.`); } else {
        setEnded(true);
        try { if (draftScope) removeDeviceDraft(window.localStorage, draftScope); } catch { /* Storage can be blocked. */ }
        router.push(`/interview-results/${session.id}`);
      } return; }
      if (result.success && result.token && index !== undefined) { setTokens((a) => a.map((t, i) => i === index ? result.token! : t)); setSaved((a) => a.map((s, i) => i === index ? JSON.stringify(toAnswer(drafts[index])) : s)); }
    } catch { setMessage("Could not confirm the save. Copy your draft, then reload to check the saved version."); }
    finally { busy.current = false; setPending(false); }
  }
  const low = seconds > 0 && seconds <= 300;
  return <div className="space-y-5">
    <div className="sticky top-14 z-30 -mx-4 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p role="timer" aria-label="Time remaining" className={cn("inline-flex h-9 items-center gap-2 rounded-lg border px-3 font-mono text-sm font-semibold tabular-nums", seconds === 0 ? "border-danger/40 bg-danger/10 text-danger" : low ? "border-warm/40 bg-warm/10 text-warm" : "border-line bg-surface text-ink")}>
          <Timer aria-hidden="true" size={15} />{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} remaining</p>
        <p className="min-w-0 flex-1 text-xs leading-5 text-muted">The timer continues when you leave. Save each answer before the deadline. References unlock when the session ends.</p>
      </div>
      <p role="status" aria-live="polite" className="empty:hidden mt-2 text-sm">{message}</p>
      {seconds === 0 && <p role="alert" className="mt-2 text-sm text-warm">Time is up. Copy any unsaved text if needed, then open the report. Only answers received before the server deadline count.</p>}
    </div>
    <DeviceDraftRecovery scope={draftScope} value={JSON.stringify(drafts)} dirty={dirty} baseline={JSON.stringify(tokens)} disabled={pending || seconds === 0 || ended} onClear={clearDrafts} onRestore={(payload) => {
      const restored = interviewDraftSchema.safeParse(JSON.parse(payload));
      if (restored.success && restored.data.length === session.questions.length) setDrafts(restored.data);
    }} />
    {session.questions.map((q, index) => <section key={q.id} aria-labelledby={`${q.id}-title`} className="grid overflow-hidden rounded-xl border border-line bg-surface lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="min-w-0 space-y-3 border-b border-line p-5 lg:border-r lg:border-b-0">
        <div className="flex flex-wrap items-center gap-2"><Badge tone="accent">Question {q.position}</Badge><Badge>{q.kind.replaceAll("_", " ")}</Badge></div>
        <h2 id={`${q.id}-title`} className="text-lg font-semibold tracking-tight">{q.prompt.title}</h2>
        <p className="whitespace-pre-wrap text-sm leading-7">{q.prompt.statement}</p>
        <pre className="whitespace-pre-wrap break-words rounded-lg border border-line bg-canvas p-3 text-xs leading-6 text-muted">{q.prompt.details}</pre>
      </div>
      <fieldset disabled={pending || seconds === 0 || ended} className="min-w-0 space-y-5 p-5"><legend className="sr-only">Your explanation and self-assessment</legend>
        <p className="text-sm text-muted">Write your answer, then rate each area honestly. Your score comes only from the three ratings; text without a rating cannot be saved.</p>
        {DIMENSIONS.map(([field, rating, label]) => <div key={field} className="space-y-2">
          <label htmlFor={`${q.id}-${field}`} className="block text-sm font-medium">{label}</label>
          <Textarea id={`${q.id}-${field}`} maxLength={4000} rows={5} className="font-mono text-[0.8125rem]" value={drafts[index][field]} onChange={(e) => setDrafts((a) => a.map((d, i) => i === index ? { ...d, [field]: e.target.value } : d))} />
          <label className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted"><span>Self-rating for {label.toLowerCase()}</span><Select className="h-8 w-auto min-w-0 text-xs" value={drafts[index][rating] ?? ""} aria-invalid={Boolean(drafts[index][field].trim()) && drafts[index][rating] === null} onChange={(e) => setDrafts((a) => a.map((d, i) => i === index ? { ...d, [rating]: e.target.value === "" ? null : Number(e.target.value) } : d))}><option value="">Choose a rating</option><option value="0">0 — Not yet explained</option><option value="1">1 — Partial explanation</option><option value="2">2 — Clear explanation with support</option></Select></label>
        </div>)}
        <div className="flex flex-wrap items-center gap-3"><Button onClick={() => send("save", index)}>{pending ? "Working…" : "Save answer"}</Button><span className="text-xs text-muted">{JSON.stringify(toAnswer(drafts[index])) === saved[index] ? "No unsaved changes" : "Unsaved changes"}</span></div>
      </fieldset>
    </section>)}
    <div className="flex flex-wrap gap-3"><Button size="lg" disabled={pending} onClick={() => send("finish")}>{seconds === 0 ? "Open report" : "Finish and review"}</Button><Button size="lg" disabled={pending} variant="secondary" onClick={() => send("abandon")}>Abandon session</Button></div>
  </div>;
}
