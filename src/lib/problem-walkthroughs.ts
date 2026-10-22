import "server-only";
import { createHash } from "node:crypto";
import entries from "@/data/seeds/problem-walkthroughs.json";

export type ProblemWalkthrough = {
  slug: string;
  language: "JAVASCRIPT" | "PYTHON";
  title: string;
  src: string;
  captionsSrc: string;
  transcriptSrc: string;
  durationSeconds: number;
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

// Only claim an exact walkthrough while the published source still matches its recording.
export function problemWalkthroughs(source: { slug: string; title: string; statement: string; examples: unknown;
  seedHash: string | null; solutions: readonly { kind: string; language: string }[] }): ProblemWalkthrough[] {
  return (entries as (ProblemWalkthrough & { sourceHash: string })[]).filter((entry) => {
    if (entry.slug !== source.slug || !source.seedHash) return false;
    const solution = source.solutions.find((solution) => solution.kind === "OPTIMAL" && solution.language === entry.language);
    if (!solution) return false;
    const content = { slug: source.slug, language: entry.language, title: source.title, statement: source.statement,
      examples: source.examples, solution, seedHash: source.seedHash };
    return createHash("sha256").update(canonicalJson(content)).digest("hex") === entry.sourceHash;
  }).map((entry) => ({
    slug: entry.slug, language: entry.language, title: entry.title, src: entry.src,
    captionsSrc: entry.captionsSrc, transcriptSrc: entry.transcriptSrc, durationSeconds: entry.durationSeconds,
  }));
}
