import { z } from "zod";
import { problemSchema, type ProblemSeed } from "@/lib/validators/problem";
import { roadmapSlug, roadmapBatchSchema } from "@/lib/validators/roadmap";

export const ADMIN_PAYLOAD_LIMIT = 400_000;
const payload = z.string().max(ADMIN_PAYLOAD_LIMIT);
const revision = z.int().positive();
export const adminCommand = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("save"), slug: roadmapSlug.nullable(), revision: revision.nullable(), payload, reviewed: z.boolean() }),
  z.strictObject({ operation: z.literal("import"), payload, reviewed: z.boolean() }),
  z.strictObject({ operation: z.literal("archive"), slug: roadmapSlug, revision, confirmation: roadmapSlug }),
  z.strictObject({ operation: z.literal("delete"), slug: roadmapSlug, revision, confirmation: roadmapSlug }),
  z.strictObject({ operation: z.literal("roadmap"), slug: roadmapSlug, token: z.string().regex(/^[a-f0-9]{64}$/), payload, reviewed: z.boolean() }),
]);
export type AdminCommand = z.infer<typeof adminCommand>;
export type AdminResult = { success: boolean; message: string; errors?: string[]; slug?: string; revision?: number; token?: string; deleted?: boolean };

// Bound parsing before schema traversal. JSON code remains data, never executable.
export function parseAdminJson(text: string): unknown {
  if (new TextEncoder().encode(text).byteLength > ADMIN_PAYLOAD_LIMIT) throw new Error("Keep the JSON payload below 400 KB.");
  const value: unknown = JSON.parse(text);
  const stack: [unknown, number][] = [[value, 0]]; let count = 0;
  while (stack.length) {
    const [item, depth] = stack.pop()!;
    if (++count > 30000 || depth > 24) throw new Error("JSON is too large or deeply nested.");
    if (typeof item === "string" && item.includes("\u0000")) throw new Error("Remove null characters from text and JSON values.");
    if (item && typeof item === "object") {
      for (const [key, child] of Object.entries(item)) {
        if (key.includes("\u0000")) throw new Error("Remove null characters from JSON keys.");
        stack.push([child, depth + 1]);
      }
    }
  }
  return value;
}

export function parseAdminProblems(text: string, batch: boolean): ProblemSeed[] {
  const value = parseAdminJson(text);
  const problems = z.array(problemSchema).min(1).max(10).parse(batch ? value : [value]);
  if (new Set(problems.map((p) => p.slug)).size !== problems.length) throw new Error("Import slugs must be unique.");
  return problems;
}
export function parseAdminRoadmap(text: string) {
  const value = z.strictObject({ content: z.unknown(), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) }).parse(parseAdminJson(text));
  return { ...roadmapBatchSchema.parse([value.content])[0], status: value.status };
}
