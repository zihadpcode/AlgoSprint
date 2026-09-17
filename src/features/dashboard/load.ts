import "server-only";
import { requireViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { queryDashboard } from "./query";

export async function loadDashboard() {
  const viewer = await requireViewer("/dashboard");
  const { analytics, insights } = await queryDashboard(getDatabase(), viewer.id);
  return { displayName: viewer.displayName, admin: viewer.role === "ADMIN", analytics, insights };
}
