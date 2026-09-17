"use client";

import { useActionState, useId, useState } from "react";
import { updateProblem } from "@/features/problems/detail-actions";
import { NOTE_LIMIT, type ProblemActionState } from "@/features/problems/detail-validation";
import type { ProblemDetail } from "@/features/problems/detail-query";
import { SubmitButton } from "@/components/ui/submit-button";
import { progressLabel } from "@/features/progress/presentation";
import { SavedFlags } from "@/components/saved/saved-flags";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const initial: ProblemActionState = {};

export function ProgressControls({ slug, progress, bookmarked = false }: { slug: string; bookmarked?: boolean; progress: NonNullable<ProblemDetail["personal"]>["progress"] }) {
  const [state, action, pending] = useActionState(updateProblem, initial);
  const solved = progress.status === "SOLVED";
  return <div className="mt-4 space-y-4">
    <div className="flex flex-wrap gap-2"><Badge tone="accent">{progressLabel(progress)}</Badge>
      {progress.reviewLater && <Badge tone="warm">Review later</Badge>}
    </div>
    <p className="text-sm leading-7 text-muted">Manual marks record your own assessment. A verified solve requires passing the full suite for the current revision. Earlier verified solves remain in your history.</p>
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton name="operation" value="mark-attempted" variant="secondary" disabled={pending || progress.status !== "NOT_STARTED"} pendingLabel="Saving…">Mark attempted</SubmitButton>
        <SubmitButton name="operation" value={solved ? "clear-solved" : "mark-solved"} disabled={pending || (solved && !progress.selfMarked)} pendingLabel="Saving…">
          {solved ? progress.selfMarked ? "Undo manual solve" : "Solved" : "Mark solved"}
        </SubmitButton>

      </div>
    </form>
    <ActionMessage state={state} />
    <SavedFlags slug={slug} bookmarked={bookmarked} reviewLater={progress.reviewLater} />
  </div>;
}

export function ProblemNotes({ slug, note }: { slug: string; note: string }) {
  const [draft, setDraft] = useState(note);
  const [state, action, pending] = useActionState(async (previous: ProblemActionState, form: FormData) => {
    let result: ProblemActionState;
    try { result = await updateProblem(previous, form); }
    catch { return { success: false, message: "Could not confirm the save. Keep a copy of your draft, then reload to check the saved note.", savedContent: previous.savedContent }; }
    if (result.success && form.get("operation") === "delete-note") setDraft("");
    // Keep this tab's last saved baseline on errors and unrelated page refreshes.
    return { ...result, savedContent: result.success ? result.savedContent : previous.savedContent };
  }, { savedContent: note });
  const id = useId();
  return <form action={action} className="mt-4 space-y-4">
    <input type="hidden" name="slug" value={slug} />
    <input type="hidden" name="expectedContent" value={state.savedContent ?? ""} />
    <label htmlFor={id} className="block text-sm text-muted">Private notes · record an insight, a mistake, or a question to revisit.</label>
    <textarea id={id} name="content" rows={9} maxLength={NOTE_LIMIT} value={draft} readOnly={pending}
      aria-describedby={`${id}-help`} onChange={(event) => setDraft(event.target.value)}
      className="w-full resize-y rounded-xl border border-muted/60 bg-canvas p-4 text-sm leading-7 text-ink" />
    <p id={`${id}-help`} className="text-xs leading-6 text-muted">{draft.length.toLocaleString("en-US")} / 10,000 characters. Save explicitly before leaving. Save an empty note to clear it.</p>
    <div className="flex flex-wrap gap-3">
      <SubmitButton name="operation" value="save-note" pendingLabel="Saving note…" disabled={pending}>Save note</SubmitButton>
      <Button type="button" variant="secondary" disabled={pending || draft === (state.savedContent ?? "")} onClick={() => setDraft(state.savedContent ?? "")}>Discard unsaved changes</Button>
      <SubmitButton name="operation" value="delete-note" variant="secondary" pendingLabel="Deleting…" disabled={pending || !state.savedContent || draft !== state.savedContent}>Delete saved note</SubmitButton>
    </div>
    <p className="text-xs text-muted">Save or discard unsaved changes before deleting. Deletion removes the saved note.</p>
    <ActionMessage state={state} />
  </form>;
}
function ActionMessage({ state }: { state: ProblemActionState }) {
  return <p role="status" aria-atomic="true" className={`text-sm leading-7 ${state.success === false ? "text-warm" : "text-accent"}`}>{state.message ?? ""}</p>;
}
