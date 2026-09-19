"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { interviewAction } from "@/features/interviews/actions";
import type { SessionView } from "@/features/interviews/contracts";

export function InterviewSession({ session }: { session: SessionView }) {
  const router = useRouter(); const busy = useRef(false);
  const [drafts, setDrafts] = useState(session.questions.map((q) => q.answer));
  const [tokens, setTokens] = useState(session.questions.map((q) => q.token));
  const [saved, setSaved] = useState(session.questions.map((q) => JSON.stringify(q.answer)));
  const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  const [remaining, setRemaining] = useState(session.remainingMs); const baseline = useRef<number | null>(null);
  const dirty = drafts.some((d, i) => JSON.stringify(d) !== saved[i]);
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
    busy.current = true; setPending(true);
    try {
      const result = await interviewAction(operation === "save" ? { operation, id: session.id, questionId: session.questions[index!].id, token: tokens[index!], answer: drafts[index!] } : { operation, id: session.id });
      setMessage(result.message);
      if (result.success && result.ended) { if (operation === "save") { setRemaining(0); setMessage(`${result.message} Your text remains here to copy before opening the report.`); } else router.push(`/interview-results/${session.id}`); return; }
      if (result.success && result.token && index !== undefined) { setTokens((a) => a.map((t, i) => i === index ? result.token! : t)); setSaved((a) => a.map((s, i) => i === index ? JSON.stringify(drafts[index]) : s)); }
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
        {([ ["reasoning", "reasoningRating", "Reasoning and solution / code"], ["tradeoffs", "tradeoffsRating", "Complexity and tradeoffs"], ["checks", "checksRating", "Tests, examples and checks"] ] as const).map(([field, rating, label]) => <div key={field} className="space-y-2">
          <label htmlFor={`${q.id}-${field}`} className="block text-sm font-medium">{label}</label>
          <textarea id={`${q.id}-${field}`} maxLength={4000} rows={5} className="w-full rounded-xl border border-line bg-canvas p-3 text-sm" value={drafts[index][field]} onChange={(e) => setDrafts((a) => a.map((d, i) => i === index ? { ...d, [field]: e.target.value } : d))} />
          <label className="block text-sm text-muted">Self-rating for {label.toLowerCase()}<Select value={drafts[index][rating]} onChange={(e) => setDrafts((a) => a.map((d, i) => i === index ? { ...d, [rating]: Number(e.target.value) } : d))}><option value="0">0 — Not yet explained</option><option value="1">1 — Partial explanation</option><option value="2">2 — Clear explanation with support</option></Select></label>
        </div>)}
        <Button onClick={() => send("save", index)}>{pending ? "Working…" : "Save answer"}</Button><span className="ml-3 text-xs text-muted">{JSON.stringify(drafts[index]) === saved[index] ? "No unsaved changes" : "Unsaved changes"}</span>
      </fieldset>
    </Card>)}
    <div className="flex flex-wrap gap-3"><Button disabled={pending} onClick={() => send("finish")}>{seconds === 0 ? "Open report" : "Finish and review"}</Button><Button disabled={pending} variant="secondary" onClick={() => send("abandon")}>Abandon session</Button></div>
  </div>;
}
