"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
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
      <label className="space-y-2">Duration<Select name="duration" defaultValue="30" disabled={pending}>{[15, 30, 45, 60].map((n) => <option key={n} value={n}>{n} minutes</option>)}</Select></label>
      <label className="space-y-2">Questions<Select name="count" defaultValue="2" disabled={pending}>{[1, 2, 3].map((n) => <option key={n}>{n}</option>)}</Select></label>
      <label className="space-y-2">Difficulty<Select name="difficulty" disabled={pending}>{["ANY", "EASY", "MEDIUM", "HARD"].map((v) => <option key={v}>{v}</option>)}</Select></label>
      <label className="space-y-2">Question style<Select name="kind" disabled={pending}>{["ANY", ...KINDS].map((v) => <option key={v} value={v}>{v.replaceAll("_", " ")}</option>)}</Select></label>
      <label className="space-y-2 sm:col-span-2">Topic<Select name="topic" disabled={pending}><option value="">Any topic</option>{CATEGORIES.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}</Select></label>
    </div>
    <p className="text-sm leading-7 text-muted">Practice explaining a solution, writing code or pseudocode, and defending your choices. Rate your own reasoning, tradeoffs and checks. This mode does not execute code or judge correctness. The small starter collection may not cover every filter.</p>
    <Button type="submit" disabled={pending}>{pending ? "Starting…" : "Start timed practice"}</Button>
    <p role="status" className="text-sm text-muted">{message}</p>
  </form>;
}
