export type ProgressView = {
  status: "NOT_STARTED" | "ATTEMPTED" | "SOLVED"; selfMarked: boolean; reviewLater: boolean;
  verification: "current" | "earlier" | null;
};
export function progressView(row: { status: ProgressView["status"]; selfMarked: boolean; reviewLater: boolean; verifiedRevision: number | null } | null | undefined, revision: number): ProgressView {
  return { status: row?.status ?? "NOT_STARTED", selfMarked: row?.selfMarked ?? false, reviewLater: row?.reviewLater ?? false,
    verification: row?.status === "SOLVED" && !row.selfMarked && row.verifiedRevision !== null ? row.verifiedRevision === revision ? "current" : "earlier" : null };
}
export function progressLabel(progress: ProgressView) {
  if (progress.status === "NOT_STARTED") return "Not started";
  if (progress.status === "ATTEMPTED") return "Attempted";
  if (progress.selfMarked) return "Solved · self-marked";
  if (progress.verification === "current") return "Solved · verified";
  if (progress.verification === "earlier") return "Solved · verified on an earlier revision";
  return "Solved · recorded";
}
