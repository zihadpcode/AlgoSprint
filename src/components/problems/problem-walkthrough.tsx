"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { studyLanguageLabel } from "@/components/workspace/study-language";
import type { ProblemWalkthrough } from "@/lib/problem-walkthroughs";
import { formatTimestamp } from "@/lib/youtube";

export function ProblemWalkthroughVideo({ walkthrough }: { walkthrough: ProblemWalkthrough }) {
  const [loaded, setLoaded] = useState(false);
  const id = useId();
  return <article aria-labelledby={`${id}-title`} className="space-y-4 rounded-xl border border-accent/40 bg-canvas p-4 sm:p-5">
    <p className="text-xs font-semibold text-accent">Exact AlgoSprint walkthrough · {studyLanguageLabel(walkthrough.language)}</p>
    <h3 id={`${id}-title`} className="font-semibold">{walkthrough.title}</h3>
    <p className="text-sm leading-7 text-muted">A narrated walkthrough of this problem&apos;s example, approach, code and complexity. Pause to study the code. Captions and a transcript are available.</p>
    {loaded ? <video className="aspect-video w-full rounded-lg border border-line bg-black" controls playsInline autoPlay preload="none"
      aria-label={`${walkthrough.title} in ${studyLanguageLabel(walkthrough.language)}`}>
      <source src={walkthrough.src} type="video/mp4" />
      <track kind="captions" src={walkthrough.captionsSrc} srcLang="en" label="English" />
      Your browser cannot play this video. <a href={walkthrough.src}>Open the walkthrough</a>.
    </video> : <div className="rounded-lg border border-dashed border-line p-4">
      <p className="text-sm text-muted">{formatTimestamp(Math.round(walkthrough.durationSeconds))} · {studyLanguageLabel(walkthrough.language)} · Narrated with captions</p>
      <Button className="mt-3" onClick={() => setLoaded(true)}>Play {studyLanguageLabel(walkthrough.language)} walkthrough</Button>
    </div>}
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-accent underline underline-offset-4">
      <a href={walkthrough.transcriptSrc} target="_blank" rel="noopener noreferrer">Read transcript</a>
      <a href={walkthrough.src} target="_blank" rel="noopener noreferrer">Open video separately</a>
    </div>
  </article>;
}
