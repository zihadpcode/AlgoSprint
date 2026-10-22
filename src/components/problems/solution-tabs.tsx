"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { ProblemDetail } from "@/features/problems/detail-query";
import { CodeBlock } from "./code-block";
import { studyLanguageLabel, useStudyLanguage } from "@/components/workspace/study-language";

const kinds = { BRUTE_FORCE: "Brute force", BETTER: "Better", OPTIMAL: "Optimal", ALTERNATIVE: "Alternative" };
export function SolutionTabs({ solutions }: { solutions: ProblemDetail["solutions"] }) {
  const study = useStudyLanguage();
  const [activeChoice, setActiveChoice] = useState({ kind: solutions[0]?.kind, language: solutions[0]?.language });
  const visible = study?.language ? solutions.filter((solution) => solution.language === study.language) : solutions;
  const exact = visible.findIndex((solution) => solution.kind === activeChoice.kind && solution.language === activeChoice.language);
  const active = exact >= 0 ? exact : Math.max(0, visible.findIndex((solution) => solution.kind === activeChoice.kind));
  const setActive = (index: number) => { if (visible[index]) setActiveChoice({ kind: visible[index].kind, language: visible[index].language }); };
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % visible.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + visible.length) % visible.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = visible.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    buttons.current[next]?.focus();
  }
  if (!solutions.length) return <p className="mt-3 text-muted">A guided solution is being prepared.</p>;
  return <details className="mt-4">
    <summary className="cursor-pointer rounded-xl border border-line p-4 font-semibold text-accent">Reveal guided solutions</summary>
    <p className="my-5 text-sm leading-7 text-muted">Compare the tradeoffs, then explain the approach in your own words.</p>
    {study && <label className="mb-4 flex flex-wrap items-center gap-3 text-sm font-medium">Solution language
      <select className="min-h-11 rounded-xl border border-line bg-canvas px-3 py-2" value={study.language} onChange={(event) => study.selectLanguage(event.target.value)}>
        {study.languages.map((language) => <option key={language} value={language}>{studyLanguageLabel(language)}</option>)}
      </select>
    </label>}
    {!visible.length && <p className="text-sm text-muted">A guided solution in {studyLanguageLabel(study?.language ?? "this language")} is not available yet.</p>}
    {visible.length > 0 && <div role="tablist" aria-label="Solution approaches" className="flex flex-wrap gap-2">
      {visible.map((solution, index) => <button key={`${solution.kind}-${solution.language}`}
        ref={(element) => { buttons.current[index] = element; }}
        type="button" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`}
        aria-selected={active === index} tabIndex={active === index ? 0 : -1}
        onClick={() => setActive(index)} onKeyDown={(event) => onKeyDown(event, index)}
        className="min-h-11 rounded-xl border border-line px-4 py-3 text-sm text-muted aria-selected:border-accent aria-selected:bg-accent/10 aria-selected:text-accent">
        {kinds[solution.kind]} · {solution.language.toLowerCase()}
      </button>)}
    </div>}
    {visible.map((solution, index) => <div key={`${solution.kind}-${solution.language}`} role="tabpanel"
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
