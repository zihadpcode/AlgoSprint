"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { writeAdmin } from "./write";
import { AdminError } from "./access";
import type { AdminResult } from "./contracts";

export async function administer(raw: unknown): Promise<AdminResult> {
  try {
    const viewer = await getViewer();
    if (viewer?.role !== "ADMIN") return { success: false, message: "Administrator access is required. Your draft is unchanged." };
    const result = await writeAdmin(getDatabase(), viewer.id, raw);
    for (const path of ["/admin", "/problems", "/roadmaps", "/dashboard", "/progress", "/notes", "/bookmarks", "/review"]) revalidatePath(path);
    for (const path of ["/admin/problems/[slug]", "/admin/roadmaps/[slug]", "/problems/[slug]", "/roadmaps/[slug]"]) revalidatePath(path, "page");
    return result;
  } catch (error) {
    if (error instanceof AdminError) return { success: false, message: error.message };
    if (error instanceof ZodError) return { success: false, message: "Check the highlighted field paths. Your draft is retained.", errors: error.issues.slice(0, 20).map((issue) => `${issue.path.join(".") || "content"}: ${issue.message}`) };
    if (error instanceof SyntaxError) return { success: false, message: "Invalid JSON. Check input/output values or the import document. Your draft is retained." };
    return { success: false, message: "Could not confirm the save. Keep a copy of your draft and reload to check the saved version before retrying." };
  }
}
