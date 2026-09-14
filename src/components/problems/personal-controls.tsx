"use client";

import { useActionState, useId, useState } from "react";
import { updateProblem } from "@/features/problems/detail-actions";
import { NOTE_LIMIT, type ProblemActionState } from "@/features/problems/detail-validation";
import type { ProblemDetail } from "@/features/problems/detail-query";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/ui/badge";

const initial: ProblemActionState = {};
const statuses = { NOT_STARTED: "Not started", ATTEMPTED: "Attempted", SOLVED: "Solved" };
export function ProgressControls({ slug, progress }: { slug: string; progress: NonNullable<ProblemDetail["personal"]>["progress"] }) {
  const [state, action, pending] = useActionState(updateProblem, initial);
  const solved = progress.status === "SOLVED";
  return <div className="mt-4 space-y-4">
    <div className="flex flex-wrap gap-2"><Badge tone="accent">{statuses[progress.status]}{solved && progress.selfMarked ? " · self-marked" : ""}</Badge>
      {progress.reviewLater && <Badge tone="warm">Review later</Badge>}
    </div>
    <p className="text-sm leading-7 text-muted">A manual mark records your own assessment. It does not mean code has passed tests.</p>
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="review" value={String(!progress.reviewLater)} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton name="operation" value={solved ? "clear-solved" : "mark-solved"} disabled={pending || (solved && !progress.selfMarked)} pendingLabel="Saving…">
          {solved ? progress.selfMarked ? "Undo manual solve" : "Solved" : "Mark solved"}
        </SubmitButton>
        <SubmitButton name="operation" value="set-review" variant="secondary" disabled={pending} pendingLabel="Saving…">
          {progress.reviewLater ? "Remove from review" : "Review later"}
        </SubmitButton>
      </div>
    </form>
    <ActionMessage state={state} />
  </div>;
}

export function ProblemNotes({ slug, note }: { slug: string; note: string }) {
  const [state, action, pending] = useActionState(async (previous: ProblemActionState, form: FormData) => {
    const result = await updateProblem(previous, form);
    // Keep this tab's last saved baseline on errors and unrelated page refreshes.
    return { ...result, savedContent: result.success ? result.savedContent : previous.savedContent };
  }, { savedContent: note });
  const [draft, setDraft] = useState(note);
  const id = useId();
  return <form action={action} className="mt-4 space-y-4">
    <input type="hidden" name="slug" value={slug} />
    <input type="hidden" name="operation" value="save-note" />
    <input type="hidden" name="expectedContent" value={state.savedContent ?? ""} />
    <label htmlFor={id} className="block text-sm text-muted">Private notes · record an insight, a mistake, or a question to revisit.</label>
    <textarea id={id} name="content" rows={9} maxLength={NOTE_LIMIT} value={draft} readOnly={pending}
      aria-describedby={`${id}-help`} onChange={(event) => setDraft(event.target.value)}
      className="w-full resize-y rounded-xl border border-muted/60 bg-canvas p-4 text-sm leading-7 text-ink" />
    <p id={`${id}-help`} className="text-xs leading-6 text-muted">{draft.length.toLocaleString()} / 10,000 characters. Save explicitly before leaving. Save an empty note to clear it.</p>
    <SubmitButton pendingLabel="Saving note…" disabled={pending}>Save note</SubmitButton>
    <ActionMessage state={state} />
  </form>;
}
function ActionMessage({ state }: { state: ProblemActionState }) {
  return <p role="status" aria-atomic="true" className={`text-sm leading-7 ${state.success === false ? "text-warm" : "text-accent"}`}>{state.message ?? ""}</p>;
}
