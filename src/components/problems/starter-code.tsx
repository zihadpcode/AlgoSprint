"use client";

import { useId, useState } from "react";
import { Select } from "@/components/ui/input";
import type { ProblemDetail } from "@/features/problems/detail-query";
import { CodeBlock } from "./code-block";
import { studyLanguageLabel, useStudyLanguage } from "@/components/workspace/study-language";

export function StarterCode({ entries }: { entries: ProblemDetail["starterCode"] }) {
  const [localLanguage, setLocalLanguage] = useState(entries[0]?.language);
  const study = useStudyLanguage();
  const id = useId();
  const selected = study?.language ?? localLanguage;
  const entry = entries.find((item) => item.language === selected);
  if (!entry) return <p className="mt-3 text-muted">Starter code is being prepared.</p>;
  return <div className="mt-4 space-y-4">
    <label htmlFor={id} className="block text-sm font-semibold">Starter reference language</label>
    <Select id={id} value={entry.language} onChange={(event) => {
      const next = entries.find((item) => item.language === event.target.value);
      if (next) { setLocalLanguage(next.language); study?.selectLanguage(next.language); }
    }}>
      {entries.map((item) => <option key={item.language} value={item.language}>{studyLanguageLabel(item.language)}</option>)}
    </Select>
    <CodeBlock label={`Starter code · ${entry.language.toLowerCase()}`} code={entry.code} />
    <p className="text-xs leading-6 text-muted">Entry point: <code>{entry.entryPoint}</code>. Use the code editor on this page to work on your solution. This starter reference stays unchanged.</p>
  </div>;
}
