import "server-only";
import { requireViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { queryProgress } from "./query";

export async function loadProgress() {
  const viewer = await requireViewer("/progress");
  return { admin: viewer.role === "ADMIN", summary: await queryProgress(getDatabase(), viewer.id) };
}
