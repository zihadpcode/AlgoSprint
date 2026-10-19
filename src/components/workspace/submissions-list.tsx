import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { verdictLabels, type Verdict } from "@/features/submissions/contracts";
import type { SubmissionHistoryItem } from "@/features/submissions/history-query";
import { editorLanguages, type EditorLanguage } from "@/components/editor/editor-state";
import { SUBMISSION_HISTORY_LIMIT } from "@/features/submissions/history-limit";
import { ButtonLink } from "@/components/ui/button";
import { relativeTime } from "./relative-time";

const tones = { ACCEPTED: "text-success", WRONG_ANSWER: "text-warm", TIME_LIMIT: "text-warm", MEMORY_LIMIT: "text-warm" } as Record<string, string>;

/** Read-only list of the signed-in viewer's own attempts: status, passed/total, runtime, language, when. */
export function SubmissionsList({ items, now = new Date() }: { items: SubmissionHistoryItem[]; now?: Date }) {
  if (!items.length) return <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">No attempts yet. Run or submit your code to see your history here.</p>;
  return <div className="space-y-2">
    {items.length >= SUBMISSION_HISTORY_LIMIT && <p className="text-xs text-subtle">Latest {SUBMISSION_HISTORY_LIMIT} attempts</p>}
    <ul className="divide-y divide-line rounded-lg border border-line" aria-label="Your attempts on this problem">
    {items.map((item) => {
      const label = item.status === "QUEUED" || item.status === "RUNNING" ? "In progress" : verdictLabels[item.status as Verdict] ?? item.status;
      const Icon = item.status === "ACCEPTED" ? CheckCircle2 : item.status === "QUEUED" || item.status === "RUNNING" ? CircleDashed : XCircle;
      return <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
        <span className={`inline-flex min-w-0 items-center gap-1.5 font-medium ${tones[item.status] ?? (item.status === "QUEUED" || item.status === "RUNNING" ? "text-muted" : "text-danger")}`}>
          <Icon aria-hidden="true" size={15} className="shrink-0" />{label}</span>
        <Badge>{item.mode === "SUBMIT" ? "Submit" : "Run"}</Badge>
        <span className="text-xs text-muted tabular-nums">{item.passedCount}/{item.totalCount} passed</span>
        <span className="text-xs text-muted tabular-nums">{item.runtimeMs == null ? "—" : `${item.runtimeMs} ms`}</span>
        <span className="text-xs text-muted">{editorLanguages[item.language as EditorLanguage]?.label ?? item.language}</span>
        <time dateTime={item.createdAt.toISOString()} title={item.createdAt.toISOString()} className="ml-auto text-xs text-subtle">{relativeTime(item.createdAt, now)}</time>
      </li>;
    })}
  </ul>
  </div>;
}

export type SubmissionsState = SubmissionHistoryItem[] | "unavailable" | null;

/** Submissions tab body: null is a guest, "unavailable" is a failed history lookup, an array is the viewer's list. */
export function SubmissionsTab({ submissions, loginHref }: { submissions: SubmissionsState; loginHref: string }) {
  if (submissions === "unavailable") return <p role="status" className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">History is temporarily unavailable. Your attempts are safe; reload in a moment to see them.</p>;
  if (submissions === null) return <div className="space-y-3 rounded-lg border border-dashed border-line px-4 py-8 text-center"><p className="text-sm text-muted">Sign in to keep a history of your attempts on this problem.</p><ButtonLink href={loginHref} size="sm">Sign in</ButtonLink></div>;
  return <SubmissionsList items={submissions} />;
}
