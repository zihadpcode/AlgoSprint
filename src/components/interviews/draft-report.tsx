"use client";
import { DeviceDraftRecovery } from "@/components/drafts/device-draft-recovery";
import type { SessionView } from "@/features/interviews/contracts";
const ignore = () => {};
export function InterviewDraftReport({ session, owner }: { session: SessionView; owner: string }) {
  return <div className="my-6"><DeviceDraftRecovery scope={{ owner, kind: "interview", target: session.id, revision: JSON.stringify(session.questions.map((q) => [q.id, q.prompt.revision])) }} baseline={JSON.stringify(session.questions.map((q) => q.token))} value="[]" dirty={false} disabled copyOnly onRestore={ignore} onClear={ignore} /></div>;
}
