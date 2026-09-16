import type { ProgressSummary } from "@/features/progress/query";

// Reuse the established meaning of solved, attempted, and current verification.
export type DashboardAnalytics = Pick<ProgressSummary, "overall" | "difficulty" | "categories">;
