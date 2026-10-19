import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { CATEGORIES } from "@/data/seeds/taxonomy";
import { answerSchema, EMPTY_ANSWER, interviewCommand, setupSchema, snapshotSchema } from "@/features/interviews/contracts";
import { assessment, readAnswer, remainingMs } from "@/features/interviews/policy";
import { INTERVIEW_QUESTIONS } from "@/features/interviews/questions";

// SHA-256 of JSON.stringify of the original five prompt objects as first published (questions.ts at 5efe69d).
const ORIGINAL_FIVE_SHA256 = "337b4b43f0ec369404a439c4bb3efa3593f4342f40603e918e363850dd9902ed";
// SHA-256 of JSON.stringify of the first 46 prompt objects (the original five plus the 41 added in the first expansion, including the
// corrected notification-service reference). Prompts may be appended after these 46, but these must never change: sessions snapshot
// them, and editing one in place would silently diverge from what saved reports show.
const FIRST_46_SHA256 = "4b3ea0c4316f11b30fb8e007dfb314ad7cd72b99c19731a2a2b8cc343e225f18";
// SHA-256 of JSON.stringify of the first 76 prompt objects (the 46 above plus the 30 added in the second expansion, including the
// review corrections). Prompts may be appended after these 76, but these must never change, for the same reason as above.
const FIRST_76_SHA256 = "55a90406e34bfc1ed03e4cc4c95d154c37060ba72998626c22a9f9b86739dc5b";
const MIN_PER_STYLE_AND_DIFFICULTY = 7;
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
  it("keeps the first 76 prompts unchanged and offers at least seven prompts for every style and difficulty", () => {
    const ids = INTERVIEW_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    // The original five prompts must stay byte-for-byte identical (IDs, kinds, difficulty, topic and full snapshot).
    expect(createHash("sha256").update(JSON.stringify(INTERVIEW_QUESTIONS.slice(0, 5))).digest("hex")).toBe(ORIGINAL_FIVE_SHA256);
    expect(INTERVIEW_QUESTIONS.length).toBeGreaterThanOrEqual(76);
    expect(createHash("sha256").update(JSON.stringify(INTERVIEW_QUESTIONS.slice(0, 46))).digest("hex")).toBe(FIRST_46_SHA256);
    expect(createHash("sha256").update(JSON.stringify(INTERVIEW_QUESTIONS.slice(0, 76))).digest("hex")).toBe(FIRST_76_SHA256);
    expect(INTERVIEW_QUESTIONS.slice(0, 5).map((q) => [q.id, q.kind, q.difficulty, q.snapshot.title])).toEqual([
      ["collection-membership", "CONCEPTUAL", "EASY", "Workshop Check-In Index"], ["last-crate", "DEBUGGING", "EASY", "The Missing Final Crate"],
      ["repeated-ledger", "OPTIMIZATION", "EASY", "Repeated Depot Totals"], ["handoff-decision", "BEHAVIORAL", "EASY", "A Handoff Under Pressure"],
      ["study-room-booking", "SYSTEM_DESIGN", "EASY", "Campus Study Room Booking"],
    ]);
    for (const kind of ["CONCEPTUAL", "DEBUGGING", "OPTIMIZATION", "BEHAVIORAL", "SYSTEM_DESIGN"] as const)
      for (const difficulty of ["EASY", "MEDIUM", "HARD"] as const)
        expect(INTERVIEW_QUESTIONS.filter((q) => q.kind === kind && q.difficulty === difficulty).length, `${kind} ${difficulty}`).toBeGreaterThanOrEqual(MIN_PER_STYLE_AND_DIFFICULTY);
    for (const q of INTERVIEW_QUESTIONS) expect(CATEGORIES.some(([slug]) => slug === q.topic), q.id).toBe(true);
    expect(new Set(INTERVIEW_QUESTIONS.map((q) => q.snapshot.title)).size).toBe(INTERVIEW_QUESTIONS.length);
  });
});
