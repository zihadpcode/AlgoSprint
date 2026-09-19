import { describe, expect, it } from "vitest";
import { answerSchema, EMPTY_ANSWER, interviewCommand, setupSchema, snapshotSchema } from "@/features/interviews/contracts";
import { assessment, readAnswer, remainingMs } from "@/features/interviews/policy";
import { INTERVIEW_QUESTIONS } from "@/features/interviews/questions";
describe("interview boundaries and self-assessment", () => {
  it("bounds setup, rejects forged fields and unknown selection values", () => {
    const valid = { duration: 30, count: 2, difficulty: "ANY", kind: "ANY", topic: "" };
    expect(setupSchema.safeParse(valid).success).toBe(true);
    for (const patch of [{ duration: 0 }, { count: 4 }, { kind: "SQL" }, { topic: "unknown" }, { difficulty: "IMPOSSIBLE" }, { userId: "someone" }]) expect(setupSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
    expect(interviewCommand.safeParse({ operation: "finish", id: "bad" }).success).toBe(false);
  });
  it("bounds answer lengths/ratings and rejects nulls and client scores", () => {
    for (const patch of [{ reasoning: "x".repeat(4001) }, { reasoning: "a\u0000b" }, { checksRating: 3 }, { checksRating: 1.5 }, { score: 100 }]) expect(answerSchema.safeParse({ ...EMPTY_ANSWER, ...patch }).success).toBe(false);
  });
  it("scores only documented self-rated areas, with empty fields worth zero", () => {
    expect(assessment({ ...EMPTY_ANSWER, reasoningRating: 2, tradeoffsRating: 2, checksRating: 2 }).score).toBe(0);
    expect(assessment({ ...EMPTY_ANSWER, reasoning: "My reasoning", reasoningRating: 2 }).score).toBe(33);
    expect(assessment({ reasoning: "A", tradeoffs: "B", checks: "C", reasoningRating: 2, tradeoffsRating: 2, checksRating: 2 }).score).toBe(100);
    expect(assessment(EMPTY_ANSWER).feedback).toContain("reasoning, tradeoffs, checks");
  });
  it("uses an absolute deadline and clamps before start or after expiry", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    expect(remainingMs(start, 15, new Date(start.getTime() - 1000))).toBe(900000);
    expect(remainingMs(start, 15, new Date(start.getTime() + 899999))).toBe(1);
    expect(remainingMs(start, 15, new Date(start.getTime() + 900000))).toBe(0);
    expect(remainingMs(start, 15, new Date(start.getTime() + 1900000))).toBe(0);
  });
  it("restores validated answers and has original prompts for every noncoding style", () => {
    expect(readAnswer(null)).toEqual(EMPTY_ANSWER);
    expect(() => readAnswer('{"score":100}')).toThrow();
    expect(new Set(INTERVIEW_QUESTIONS.map((q) => q.kind)).size).toBe(5);
    for (const q of INTERVIEW_QUESTIONS) { expect(snapshotSchema.safeParse(q.snapshot).success).toBe(true); expect(q.snapshot.reference.length).toBeGreaterThan(100); }
  });
});
