"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { interviewAction } from "@/features/interviews/actions";
import type { InterviewAnswer, SessionView } from "@/features/interviews/contracts";

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

export function InterviewSession({ session }: { session: SessionView }) {
  const router = useRouter(); const busy = useRef(false);
  const [drafts, setDrafts] = useState(session.questions.map((q) => toDraft(q.answer)));
  const [tokens, setTokens] = useState(session.questions.map((q) => q.token));
  const [saved, setSaved] = useState(session.questions.map((q) => JSON.stringify(q.answer)));
  const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  const [remaining, setRemaining] = useState(session.remainingMs); const baseline = useRef<number | null>(null);
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
      if (result.success && result.ended) { if (operation === "save") { setRemaining(0); setMessage(`${result.message} Your text remains here to copy before opening the report.`); } else router.push(`/interview-results/${session.id}`); return; }
      if (result.success && result.token && index !== undefined) { setTokens((a) => a.map((t, i) => i === index ? result.token! : t)); setSaved((a) => a.map((s, i) => i === index ? JSON.stringify(toAnswer(drafts[index])) : s)); }
    } catch { setMessage("Could not confirm the save. Copy your draft, then reload to check the saved version."); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="space-y-6">
    <Card><p className="text-lg font-semibold" role="timer" aria-label="Time remaining">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} remaining</p>
      <p className="mt-2 text-sm text-muted">The timer continues when you leave. Save each answer before the deadline. References unlock when the session ends.</p>
      {seconds === 0 && <p role="alert" className="mt-3 text-warm">Time is up. Copy any unsaved text if needed, then open the report. Only answers received before the server deadline count.</p>}
      <p role="status" className="mt-3 text-sm">{message}</p>
    </Card>
    {session.questions.map((q, index) => <Card key={q.id}>
      <p className="eyebrow text-xs text-muted">Question {q.position} · {q.kind.replaceAll("_", " ")}</p><h2 className="mt-3 text-xl font-semibold">{q.prompt.title}</h2>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{q.prompt.statement}</p><pre className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-muted">{q.prompt.details}</pre>
      <fieldset disabled={pending || seconds === 0} className="mt-5 space-y-5"><legend className="mb-3 font-semibold">Your explanation and self-assessment</legend>
        <p className="text-sm text-muted">Write your answer, then rate each area honestly. Your score comes only from the three ratings; text without a rating cannot be saved.</p>
        {DIMENSIONS.map(([field, rating, label]) => <div key={field} className="space-y-2">
          <label htmlFor={`${q.id}-${field}`} className="block text-sm font-medium">{label}</label>
          <textarea id={`${q.id}-${field}`} maxLength={4000} rows={5} className="w-full rounded-xl border border-line bg-canvas p-3 text-sm" value={drafts[index][field]} onChange={(e) => setDrafts((a) => a.map((d, i) => i === index ? { ...d, [field]: e.target.value } : d))} />
          <label className="block text-sm text-muted">Self-rating for {label.toLowerCase()}<Select value={drafts[index][rating] ?? ""} aria-invalid={Boolean(drafts[index][field].trim()) && drafts[index][rating] === null} onChange={(e) => setDrafts((a) => a.map((d, i) => i === index ? { ...d, [rating]: e.target.value === "" ? null : Number(e.target.value) } : d))}><option value="">Choose a rating</option><option value="0">0 — Not yet explained</option><option value="1">1 — Partial explanation</option><option value="2">2 — Clear explanation with support</option></Select></label>
        </div>)}
        <Button onClick={() => send("save", index)}>{pending ? "Working…" : "Save answer"}</Button><span className="ml-3 text-xs text-muted">{JSON.stringify(toAnswer(drafts[index])) === saved[index] ? "No unsaved changes" : "Unsaved changes"}</span>
      </fieldset>
    </Card>)}
    <div className="flex flex-wrap gap-3"><Button disabled={pending} onClick={() => send("finish")}>{seconds === 0 ? "Open report" : "Finish and review"}</Button><Button disabled={pending} variant="secondary" onClick={() => send("abandon")}>Abandon session</Button></div>
  </div>;
}
