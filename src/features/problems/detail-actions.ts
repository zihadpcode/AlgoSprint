"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { problemChange, type ProblemActionState } from "./detail-validation";
import { writeProblemChange } from "./detail-write";

export async function updateProblem(_previous: ProblemActionState, form: FormData): Promise<ProblemActionState> {
  // Explicit fields: caller-supplied user IDs, roles and problem IDs are ignored.
  const input = problemChange.safeParse({
    slug: form.get("slug"), operation: form.get("operation"), review: form.get("review"),
    content: form.get("content"), expectedContent: form.get("expectedContent"),
  });
  if (!input.success) return { success: false, message: "Check your request. Notes must be at most 10,000 characters and contain no null characters." };
  try {
    const viewer = await getViewer();
    if (!viewer) return { success: false, message: "Sign in again before saving. Your unsaved note remains in this page." };
    const outcome = await writeProblemChange(getDatabase(), viewer.id, input.data);
    if (outcome === "not-found") return { success: false, message: "This problem is no longer available." };
    if (outcome === "conflict") return { success: false, message: "Your note changed in another tab. Copy your draft, then reload to review the saved version before trying again." };
  } catch { return { success: false, message: "Could not save your change. Please try again." }; }
  revalidatePath(`/problems/${input.data.slug}`);
  revalidatePath("/problems");
  if (input.data.operation === "save-note") return { success: true, message: input.data.content ? "Note saved." : "Note cleared.", savedContent: input.data.content };
  return { success: true, message: "Progress updated." };
}
