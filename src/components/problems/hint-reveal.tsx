"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";

const levels = ["A light clue", "Choose a tool", "Find the pattern", "Strong guidance", "Full solution direction"];
export function HintReveal({ hints }: { hints: { position: number; content: string }[] }) {
  const [shown, setShown] = useState(0);
  const id = useId();
  return <div>
    <p className="mt-3 text-sm leading-7 text-muted">Take one clue at a time. Try a small example before revealing the next.</p>
    <ol id={id} className="mt-5 space-y-3">
      {hints.slice(0, shown).map((hint, index) => <li key={hint.position} className="rounded-xl border border-line bg-canvas p-4">
        <h3 className="text-sm font-semibold text-accent">Hint {index + 1} · {levels[index] ?? "Keep exploring"}</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{hint.content}</p>
      </li>)}
    </ol>
    <p role="status" className="my-4 text-xs text-muted">{shown} of {hints.length} hints revealed{shown === hints.length ? " · all clues shown" : ""}.</p>
    <div className="flex flex-wrap gap-3">
      <Button aria-controls={id} disabled={shown >= hints.length} onClick={() => setShown((count) => Math.min(count + 1, hints.length))}>
        {shown === hints.length ? "All hints revealed" : `Reveal hint ${shown + 1}`}
      </Button>
      {shown > 0 && <Button variant="secondary" onClick={() => setShown(0)}>Hide hints</Button>}
    </div>
  </div>;
}
