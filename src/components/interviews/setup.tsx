"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { SegmentedRadio } from "./segmented";
import { CATEGORIES } from "@/data/seeds/taxonomy";
import { KINDS } from "@/features/interviews/contracts";
import { interviewAction } from "@/features/interviews/actions";
export function InterviewSetup() {
  const router = useRouter(); const busy = useRef(false); const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  return <form className="space-y-5" onSubmit={async (event) => {
    event.preventDefault(); if (busy.current) return; busy.current = true; setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      const result = await interviewAction({ operation: "start", setup: { duration: Number(data.get("duration")), count: Number(data.get("count")), difficulty: data.get("difficulty"), kind: data.get("kind"), topic: data.get("topic") } });
      setMessage(result.message); if (result.success && result.id) router.push(`/mock-interview/${result.id}`);
    } catch { setMessage("Could not confirm the start. Reload to find an existing session before retrying."); }
    finally { busy.current = false; setPending(false); }
  }}>
    <div className="grid gap-5 sm:grid-cols-2">
      <SegmentedRadio name="duration" legend="Duration" defaultValue="30" disabled={pending} options={[15, 30, 45, 60].map((n) => ({ value: String(n), label: `${n} min` }))} />
      <SegmentedRadio name="count" legend="Questions" defaultValue="2" disabled={pending} options={[1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))} />
      <SegmentedRadio name="difficulty" legend="Difficulty" defaultValue="ANY" disabled={pending} options={["ANY", "EASY", "MEDIUM", "HARD"].map((v) => ({ value: v, label: v === "ANY" ? "Any" : v[0] + v.slice(1).toLowerCase() }))} />
      <label className="block space-y-2 text-sm font-medium">Topic<Select name="topic" disabled={pending} className="font-normal"><option value="">Any topic</option>{CATEGORIES.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}</Select></label>
      <div className="sm:col-span-2"><SegmentedRadio name="kind" legend="Question style" cards defaultValue="ANY" disabled={pending} options={["ANY", ...KINDS].map((v) => ({ value: v, label: v === "ANY" ? "Any style" : v[0] + v.slice(1).toLowerCase().replaceAll("_", " ") }))} /></div>
    </div>
    <p className="text-sm leading-6 text-muted">Practice explaining a solution, writing code or pseudocode, and defending your choices. Rate your own reasoning, tradeoffs and checks. This mode does not execute code or judge correctness. The small starter collection may not cover every filter.</p>
    <Button type="submit" size="lg" disabled={pending}>{pending ? "Starting…" : "Start timed practice"}</Button>
    <p role="status" aria-live="polite" className="text-sm text-muted">{message}</p>
  </form>;
}
