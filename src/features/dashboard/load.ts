import "server-only";
import { requireViewer } from "@/features/auth/session";
import { queryPracticeStats } from "@/features/problems/stats";
import { getDatabase } from "@/lib/prisma";
import { queryDashboard } from "./query";

export async function loadDashboard() {
  const viewer = await requireViewer("/dashboard");
  const db = getDatabase();
  const { analytics, insights } = await queryDashboard(db, viewer.id);
  // Owner-scoped counts only; the acceptance card simply shows an empty value if this extra read fails.
  const stats = await queryPracticeStats(db, viewer.id).catch(() => null);
  const acceptance = stats ? { accepted: stats.accepted, submitted: stats.submitted, rate: stats.acceptance } : null;
  return { displayName: viewer.displayName, admin: viewer.role === "ADMIN", analytics, insights, acceptance };
}
