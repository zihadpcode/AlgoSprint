import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { checkPythonBudget, PYTHON_BUDGET_DEFAULTS, PYTHON_BUSY, PYTHON_DAILY_LIMIT, PYTHON_USER_LIMIT, pythonBudget } from "@/features/submissions/python-budget";

// A fake transaction: `active` Python attempts in flight, VMs already used today by this user and by everyone.
function tx(active: number, mine: number, all: number) {
  const calls: unknown[] = [];
  return { calls, client: {
    userSubmission: {
      count: vi.fn(async (args: unknown) => { calls.push(args); return active; }),
      aggregate: vi.fn(async (args: { where: { userId?: string } }) => { calls.push(args); return { _sum: { totalCount: args.where.userId ? mine : all } }; }),
    },
  } as never };
}
const now = new Date("2026-10-20T12:00:00Z");
const budget = { userVmsPerDay: 60, vmsPerDay: 150, maxActive: 2 };

describe("Python VM budget", () => {
  it("allows a run that fits every limit", async () => { expect(await checkPythonBudget(tx(1, 40, 100).client, "u1", now, 10, budget)).toBeNull(); });
  it("counts the run being reserved against the per-user daily budget", async () => {
    expect(await checkPythonBudget(tx(0, 50, 50).client, "u1", now, 10, budget)).toBeNull();
    expect(await checkPythonBudget(tx(0, 51, 51).client, "u1", now, 10, budget)).toBe(PYTHON_USER_LIMIT);
  });
  it("applies the global daily budget to everyone together", async () => {
    expect(await checkPythonBudget(tx(0, 0, 140).client, "u1", now, 10, budget)).toBeNull();
    expect(await checkPythonBudget(tx(0, 0, 141).client, "u1", now, 10, budget)).toBe(PYTHON_DAILY_LIMIT);
  });
  it("limits concurrent Python attempts to what the provider's concurrent sandboxes allow", async () => {
    expect(await checkPythonBudget(tx(1, 0, 0).client, "u1", now, 5, budget)).toBeNull();
    expect(await checkPythonBudget(tx(2, 0, 0).client, "u1", now, 5, budget)).toBe(PYTHON_BUSY);
  });
  it("counts only Python rows, only this user's for the personal budget, and only the last 24 hours", async () => {
    const fake = tx(0, 0, 0);
    await checkPythonBudget(fake.client, "u1", now, 3, budget);
    const text = JSON.stringify(fake.calls);
    expect(text).toContain('"language":"PYTHON"');
    expect(text).toContain('"userId":"u1"');
    expect(text).toContain(new Date(now.getTime() - 86_400_000).toISOString());
    // Failed and aborted runs consumed VMs too, so no status filter on the budget sums.
    expect((fake.calls[1] as { where: Record<string, unknown> }).where).not.toHaveProperty("status");
  });
  it("reads positive integer overrides from the environment and ignores anything else", () => {
    expect(pythonBudget({})).toEqual(PYTHON_BUDGET_DEFAULTS);
    expect(pythonBudget({ PYTHON_USER_VMS_PER_DAY: "500", PYTHON_VMS_PER_DAY: "4000", PYTHON_MAX_ACTIVE: "8" })).toEqual({ userVmsPerDay: 500, vmsPerDay: 4000, maxActive: 8 });
    for (const bad of ["", "0", "-3", "1.5", "abc", "1e9", "99999999"]) expect(pythonBudget({ PYTHON_VMS_PER_DAY: bad }).vmsPerDay, bad).toBe(PYTHON_BUDGET_DEFAULTS.vmsPerDay);
  });
});
