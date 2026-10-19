import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { difficultyText } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ProblemStatus } from "./problem-status";
import type { LibraryResult } from "@/features/problems/query";

type Problem = LibraryResult["items"][number];
const difficultyName = (value: string) => value[0] + value.slice(1).toLowerCase();

/** Compact row-card used below the md breakpoint, where the directory table would not fit. */
export function ProblemCard({ problem }: { problem: Problem }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line bg-surface px-3.5 py-3 transition-colors hover:bg-surface-hover">
      <span className="mt-0.5"><ProblemStatus progress={problem.progress} /></span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-medium [overflow-wrap:anywhere]"><Link href={`/problems/${problem.slug}`} className="hover:text-accent">{problem.title}</Link></h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className={cn("font-medium", difficultyText(problem.difficulty))}>{difficultyName(problem.difficulty)}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{problem.estimatedMinutes} min</span>
          {problem.progress?.reviewLater && <Badge tone="warm" className="h-5 px-1.5">Review later</Badge>}
        </p>
        {problem.categories.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Topics">
          {problem.categories.slice(0, 3).map((category) => <Badge key={category.slug} className="h-5 px-1.5">{category.name}</Badge>)}
          {problem.categories.length > 3 && <span className="text-xs text-subtle">+{problem.categories.length - 3}</span>}
        </div>}
      </div>
    </div>
  );
}
