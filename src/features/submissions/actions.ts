"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { executionInput, type ExecutionState } from "./contracts";
import { getRunnerConfig } from "./config";
import { runSubmission } from "./service";

export async function executeCode(raw: unknown): Promise<ExecutionState> {
  const parsed = executionInput.safeParse(raw);
  if (!parsed.success) return { success: false, message: "Choose JavaScript and enter 1–20,000 characters of code." };
  try {
    const viewer = await getViewer();
    if (!viewer) return { success: false, message: "Sign in with a confirmed account to run or submit code." };
    const config = getRunnerConfig();
    if (!config) return { success: false, message: "Code execution is not configured yet. Your draft is unchanged." };
    const outcome = await runSubmission(getDatabase(), viewer.id, parsed.data, config);
    if (outcome.success) {
      revalidatePath(`/problems/${parsed.data.slug}`);
      revalidatePath("/problems"); revalidatePath("/progress"); revalidatePath("/dashboard");
      revalidatePath("/notes"); revalidatePath("/bookmarks"); revalidatePath("/review");
      revalidatePath("/roadmaps"); revalidatePath("/roadmaps/[slug]", "page");
    }
    return outcome;
  } catch {
    return { success: false, message: "Could not finish saving the execution result. Your draft is unchanged. A retry creates a new attempt." };
  }
}
