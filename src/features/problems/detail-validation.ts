import { z } from "zod";

export const problemSlug = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const NOTE_LIMIT = 10_000;
const noteText = z.string().max(NOTE_LIMIT).refine((text) => !text.includes("\u0000"), "Remove null characters.");
export const problemChange = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("mark-attempted"), slug: problemSlug }),
  z.object({ operation: z.literal("mark-solved"), slug: problemSlug }),
  z.object({ operation: z.literal("clear-solved"), slug: problemSlug }),
  z.object({ operation: z.literal("set-review"), slug: problemSlug, review: z.enum(["true", "false"]) }),
  z.object({ operation: z.literal("set-bookmark"), slug: problemSlug, bookmarked: z.enum(["true", "false"]) }),
  z.object({ operation: z.literal("save-note"), slug: problemSlug, content: noteText, expectedContent: noteText }),
  z.object({ operation: z.literal("delete-note"), slug: problemSlug, expectedContent: noteText }),
]);
export type ProblemChange = z.infer<typeof problemChange>;
export type ProblemActionState = { success?: boolean; message?: string; savedContent?: string };
