"use client";

import { useId, useState } from "react";
import { Select } from "@/components/ui/input";
import type { ProblemDetail } from "@/features/problems/detail-query";
import { CodeBlock } from "./code-block";

export function StarterCode({ entries }: { entries: ProblemDetail["starterCode"] }) {
  const [index, setIndex] = useState(0);
  const id = useId();
  const entry = entries[index];
  if (!entry) return <p className="mt-3 text-muted">Starter code is being prepared.</p>;
  return <div className="mt-4 space-y-4">
    <label htmlFor={id} className="block text-sm font-semibold">Language</label>
    <Select id={id} value={index} onChange={(event) => setIndex(Number(event.target.value))}>
      {entries.map((item, position) => <option key={item.language} value={position}>{item.language.toLowerCase()}</option>)}
    </Select>
    <CodeBlock label={`Starter code · ${entry.language.toLowerCase()}`} code={entry.code} />
    <p className="text-xs leading-6 text-muted">Entry point: <code>{entry.entryPoint}</code>. Copy this starter into your own editor. In-app editing and execution are coming later.</p>
  </div>;
}
