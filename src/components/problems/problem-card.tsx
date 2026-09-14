import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LibraryResult } from "@/features/problems/query";

const statusLabels = { NOT_STARTED: "Not started", ATTEMPTED: "Attempted", SOLVED: "Solved" };
export function ProblemCard({ problem }: { problem: LibraryResult["items"][number] }) {
  return (
    <Card className="h-full">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={problem.difficulty === "HARD" ? "warm" : "accent"}>
          {problem.difficulty[0] + problem.difficulty.slice(1).toLowerCase()}
        </Badge>
        <span className="text-xs text-muted">{problem.estimatedMinutes} min</span>
      </div>
      <h2 className="mt-5 text-xl font-semibold [overflow-wrap:anywhere]"><Link href={`/problems/${problem.slug}`} className="text-accent hover:underline underline-offset-4">{problem.title}</Link></h2>
      <p className="mt-3 text-sm text-muted">Pattern: {problem.pattern.replaceAll("-", " ")}</p>
      <div className="mt-5 flex flex-wrap gap-2" aria-label="Categories">
        {problem.categories.map((category) => <Badge key={category.slug}>{category.name}</Badge>)}
      </div>
      <p className="mt-3 text-xs leading-6 text-muted">Tags: {problem.tags.map((tag) => tag.name).join(", ") || "None"}</p>
      {problem.progress && <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
        <Badge tone={problem.progress.status === "SOLVED" ? "success" : "neutral"}>
          {statusLabels[problem.progress.status]}{problem.progress.status === "SOLVED" && problem.progress.selfMarked ? " · self-marked" : ""}
        </Badge>
        {problem.progress.reviewLater && <Badge tone="warm">Review later</Badge>}
      </div>}
    </Card>
  );
}
