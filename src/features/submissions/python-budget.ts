import "server-only";
import type { Prisma } from "@/generated/prisma/client";

// Python costs one Sandbox VM per test case, so the submission-count limits in store.ts (which also cover JavaScript) are far too
// loose for it: one Submit can start 10 VMs. These are VM budgets, counted from the rows already stored (language + totalCount),
// failed and aborted runs included because they still created VMs. Defaults suit the Vercel Hobby plan (5,000 creations a month,
// 10 concurrent sandboxes); raise them with the environment variables below on a larger plan.
export type PythonBudget = { userVmsPerDay: number; vmsPerDay: number; maxActive: number };
export const PYTHON_BUDGET_DEFAULTS: PythonBudget = { userVmsPerDay: 60, vmsPerDay: 150, maxActive: 2 };

const positive = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 1_000_000 ? parsed : fallback;
};
export function pythonBudget(env: Record<string, string | undefined> = process.env): PythonBudget {
  return {
    userVmsPerDay: positive(env.PYTHON_USER_VMS_PER_DAY, PYTHON_BUDGET_DEFAULTS.userVmsPerDay),
    vmsPerDay: positive(env.PYTHON_VMS_PER_DAY, PYTHON_BUDGET_DEFAULTS.vmsPerDay),
    maxActive: positive(env.PYTHON_MAX_ACTIVE, PYTHON_BUDGET_DEFAULTS.maxActive),
  };
}

export const PYTHON_BUSY = "Python runs are busy right now. Wait a moment and try again, or use JavaScript.";
export const PYTHON_USER_LIMIT = "You have used today's Python run allowance. It renews within 24 hours; JavaScript is not affected.";
export const PYTHON_DAILY_LIMIT = "Python runs have reached today's capacity. Please try again later; JavaScript is not affected.";

// Call inside the reservation transaction (it holds the advisory lock), after the test cases are known, so `vms` is exact.
export async function checkPythonBudget(tx: Prisma.TransactionClient, userId: string, now: Date, vms: number, budget: PythonBudget = pythonBudget()): Promise<string | null> {
  const day = new Date(now.getTime() - 86_400_000);
  const active = await tx.userSubmission.count({ where: { language: "PYTHON", status: { in: ["QUEUED", "RUNNING"] } } });
  if (active >= budget.maxActive) return PYTHON_BUSY;
  const [mine, all] = await Promise.all([
    tx.userSubmission.aggregate({ where: { language: "PYTHON", userId, createdAt: { gte: day } }, _sum: { totalCount: true } }),
    tx.userSubmission.aggregate({ where: { language: "PYTHON", createdAt: { gte: day } }, _sum: { totalCount: true } }),
  ]);
  if ((mine._sum.totalCount ?? 0) + vms > budget.userVmsPerDay) return PYTHON_USER_LIMIT;
  if ((all._sum.totalCount ?? 0) + vms > budget.vmsPerDay) return PYTHON_DAILY_LIMIT;
  return null;
}
