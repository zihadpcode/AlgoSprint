import { z } from "zod";

export const LEADERBOARD_NAME_MIN = 2;
export const LEADERBOARD_NAME_MAX = 40;
export const LEADERBOARD_LIMIT = 100;

// Control characters, zero-width and bidirectional formatting characters can disguise or reorder a public name.
const hidden = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/;
// A public name must not carry contact details or advertising: no @, scheme, www or domain-like text.
const linkLike = /@|:\/\/|\bwww\.|[a-z0-9-]\.[a-z]{2,}/i;

export const leaderboardNameSchema = z.string().trim()
  .min(LEADERBOARD_NAME_MIN, `Use at least ${LEADERBOARD_NAME_MIN} characters.`)
  .max(LEADERBOARD_NAME_MAX, `Use at most ${LEADERBOARD_NAME_MAX} characters.`)
  .refine((value) => !hidden.test(value), "Use a name without control or invisible characters.")
  .refine((value) => !linkLike.test(value), "Use a name without links or email addresses.");

export const leaderboardSettingsSchema = z.discriminatedUnion("optIn", [
  z.object({ optIn: z.literal(true), displayName: leaderboardNameSchema }),
  z.object({ optIn: z.literal(false) }),
]);

export type LeaderboardSettings = z.infer<typeof leaderboardSettingsSchema>;
export type LeaderboardFormState = { success?: boolean; message?: string; errors?: { displayName?: string[] } };
