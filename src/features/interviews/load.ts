import "server-only";
import { z } from "zod";
import { requireViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { queryInterview, queryInterviews } from "./store";
export async function loadInterviewIndex() {
  const viewer = await requireViewer("/mock-interview");
  return { viewer, items: await queryInterviews(getDatabase(), viewer.id) };
}
export async function loadInterview(id: string, report = false) {
  const viewer = await requireViewer(report ? `/interview-results/${id}` : `/mock-interview/${id}`);
  if (!z.uuid().safeParse(id).success) return null;
  const session = await queryInterview(getDatabase(), viewer.id, id);
  return session ? { viewer, session } : null;
}
