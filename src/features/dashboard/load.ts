import "server-only";
import { requireViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { queryProgress } from "@/features/progress/query";
import type { DashboardAnalytics } from "./contracts";

export async function loadDashboard() {
  const viewer = await requireViewer("/dashboard");
  const { overall, difficulty, categories } = await queryProgress(getDatabase(), viewer.id);
  const analytics: DashboardAnalytics = { overall, difficulty, categories };
  return { displayName: viewer.displayName, admin: viewer.role === "ADMIN", analytics };
}
