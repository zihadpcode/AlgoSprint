import { z } from "zod";
import { CATEGORIES } from "@/data/seeds/taxonomy";
export const KINDS = ["CODING", "CONCEPTUAL", "DEBUGGING", "OPTIMIZATION", "BEHAVIORAL", "SYSTEM_DESIGN"] as const;
const text = z.string().max(4000).refine((s) => !s.includes("\u0000"), "Remove null characters");
export const answerSchema = z.strictObject({ reasoning: text, tradeoffs: text, checks: text, reasoningRating: z.int().min(0).max(2), tradeoffsRating: z.int().min(0).max(2), checksRating: z.int().min(0).max(2) });
export type InterviewAnswer = z.infer<typeof answerSchema>;
export const EMPTY_ANSWER: InterviewAnswer = { reasoning: "", tradeoffs: "", checks: "", reasoningRating: 0, tradeoffsRating: 0, checksRating: 0 };
export const setupSchema = z.strictObject({ duration: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]), count: z.int().min(1).max(3), difficulty: z.enum(["ANY", "EASY", "MEDIUM", "HARD"]), kind: z.enum(["ANY", ...KINDS]), topic: z.string().refine((v) => v === "" || CATEGORIES.some(([slug]) => slug === v)) });
export const interviewCommand = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("start"), setup: setupSchema }),
  z.strictObject({ operation: z.literal("save"), id: z.uuid(), questionId: z.uuid(), token: z.string().regex(/^[a-f0-9]{64}$/), answer: answerSchema }),
  z.strictObject({ operation: z.literal("finish"), id: z.uuid() }),
  z.strictObject({ operation: z.literal("abandon"), id: z.uuid() }),
]);
export type InterviewResult = { success: boolean; message: string; id?: string; token?: string; ended?: boolean };
export const snapshotSchema = z.object({ version: z.literal(1), title: z.string(), statement: z.string(), details: z.string(), reference: z.string(), revision: z.number().nullable(), slug: z.string().nullable() });
export type Snapshot = z.infer<typeof snapshotSchema>;
export type SessionView = { id: string; status: string; duration: number; remainingMs: number; score: number | null; questions: { id: string; position: number; kind: string; prompt: Omit<Snapshot, "reference">; reference?: string; answer: InterviewAnswer; token: string; score: number | null; feedback: string | null }[] };
