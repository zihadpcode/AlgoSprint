"use client";
import { useActionState } from "react";
import { updateProblem } from "@/features/problems/detail-actions";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ProblemActionState } from "@/features/problems/detail-validation";

export function SavedFlags({ slug, bookmarked, reviewLater }: { slug: string; bookmarked: boolean; reviewLater: boolean }) {
  const [state, action, pending] = useActionState(updateProblem, {} as ProblemActionState);
  return <div className="mt-4 space-y-3">
    <p className="text-sm text-muted">{bookmarked ? "Bookmarked" : "Not bookmarked"} · {reviewLater ? "Marked for review" : "Not marked for review"}</p>
    <form action={action} className="flex flex-wrap gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="bookmarked" value={String(!bookmarked)} />
      <input type="hidden" name="review" value={String(!reviewLater)} />
      <SubmitButton name="operation" value="set-bookmark" variant="secondary" disabled={pending} pendingLabel="Saving…">{bookmarked ? "Remove bookmark" : "Bookmark"}</SubmitButton>
      <SubmitButton name="operation" value="set-review" variant="secondary" disabled={pending} pendingLabel="Saving…">{reviewLater ? "Remove from review" : "Review later"}</SubmitButton>
    </form>
    <p role="status" aria-atomic="true" className="text-sm text-accent">{state.message ?? ""}</p>
  </div>;
}
