"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { ProblemDetail } from "@/features/problems/detail-query";
import { CodeBlock } from "./code-block";

const kinds = { BRUTE_FORCE: "Brute force", BETTER: "Better", OPTIMAL: "Optimal", ALTERNATIVE: "Alternative" };
export function SolutionTabs({ solutions }: { solutions: ProblemDetail["solutions"] }) {
  const [active, setActive] = useState(0);
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % solutions.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + solutions.length) % solutions.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = solutions.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    buttons.current[next]?.focus();
  }
  if (!solutions.length) return <p className="mt-3 text-muted">A guided solution is being prepared.</p>;
  return <details className="mt-4">
    <summary className="cursor-pointer rounded-xl border border-line p-4 font-semibold text-accent">Reveal guided solutions</summary>
    <p className="my-5 text-sm leading-7 text-muted">Compare the tradeoffs, then explain the approach in your own words.</p>
    <div role="tablist" aria-label="Solution approaches" className="flex flex-wrap gap-2">
      {solutions.map((solution, index) => <button key={`${solution.kind}-${solution.language}`}
        ref={(element) => { buttons.current[index] = element; }}
        type="button" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`}
        aria-selected={active === index} tabIndex={active === index ? 0 : -1}
        onClick={() => setActive(index)} onKeyDown={(event) => onKeyDown(event, index)}
        className="min-h-11 rounded-xl border border-line px-4 py-3 text-sm text-muted aria-selected:border-accent aria-selected:bg-accent/10 aria-selected:text-accent">
        {kinds[solution.kind]} · {solution.language.toLowerCase()}
      </button>)}
    </div>
    {solutions.map((solution, index) => <div key={`${solution.kind}-${solution.language}`} role="tabpanel"
      id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} hidden={active !== index} tabIndex={0} className="mt-6 space-y-6">
      <h3 className="text-lg font-semibold">{solution.title}</h3>
      <TextSection title="Intuition" text={solution.intuition} />
      <TextSection title="Approach" text={solution.approach} />
      <div><h4 className="font-semibold">Walkthrough</h4><ol className="mt-3 space-y-4">
        {solution.steps.map((step, stepIndex) => <li key={step.position} className="border-l-2 border-accent/40 pl-4">
          <h5 className="text-sm font-semibold">{stepIndex + 1}. {step.title}</h5><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted">{step.content}</p>
        </li>)}
      </ol></div>
      <CodeBlock label="Pseudocode" code={solution.pseudocode} />
      <CodeBlock label={`Solution code · ${solution.language.toLowerCase()}`} code={solution.code} />
      <dl className="grid gap-3 rounded-xl bg-canvas p-4 sm:grid-cols-2">
        <div><dt className="text-sm text-muted">Time complexity</dt><dd className="mt-2 font-mono text-sm">{solution.timeComplexity}</dd></div>
        <div><dt className="text-sm text-muted">Space complexity</dt><dd className="mt-2 font-mono text-sm">{solution.spaceComplexity}</dd></div>
      </dl>
      <div><h4 className="font-semibold">Common mistakes</h4><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-muted">
        {solution.commonMistakes.map((mistake, item) => <li key={item}>{mistake}</li>)}
      </ul></div>
      <TextSection title="Explain it in an interview" text={solution.interviewExplanation} />
    </div>)}
  </details>;
}
function TextSection({ title, text }: { title: string; text: string }) {
  return <div><h4 className="font-semibold">{title}</h4><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted">{text}</p></div>;
}
