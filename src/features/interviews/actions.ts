"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { InterviewError, writeInterview } from "./store";
import type { InterviewResult } from "./contracts";
export async function interviewAction(raw: unknown): Promise<InterviewResult> {
  try {
    const viewer = await getViewer();
    if (!viewer) return { success: false, message: "Sign in to continue. Keep a copy of your draft." };
    const result = await writeInterview(getDatabase(), viewer.id, raw);
    revalidatePath("/mock-interview");
    revalidatePath("/mock-interview/[id]", "page");
    revalidatePath("/interview-results/[id]", "page");
    return result;
  } catch (error) {
    if (error instanceof InterviewError) return { success: false, message: error.message };
    if (error instanceof ZodError) return { success: false, message: "Check the interview options and answer lengths (4,000 characters per field)." };
    return { success: false, message: "Could not confirm the request. Keep a copy of your draft and reload to check the saved state before retrying." };
  }
}
