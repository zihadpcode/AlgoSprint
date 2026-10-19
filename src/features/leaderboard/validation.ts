import { z } from "zod";

export const LEADERBOARD_NAME_MIN = 2;
export const LEADERBOARD_NAME_MAX = 40;
export const LEADERBOARD_LIMIT = 100;

// Characters that render as nothing (or nearly nothing) yet are not caught by the Unicode categories below.
// Hangul fillers, braille blank, combining grapheme joiner, Khmer inherent vowels, variation selectors, object replacement.
const blank = /[ᅟᅠㅤﾠ⠀͏឴឵︀-️￼\u{e0100}-\u{e01ef}]/u;
// Control, format (soft hyphen, bidi, zero width, tags), line/paragraph separators, private use, surrogates, unassigned.
const invisible = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cs}\p{Cn}]/u;
const markRun = /\p{M}{3,}/u;

// Visual look-alikes folded onto Latin for the uniqueness key and the reserved-name check. Applied after NFD, Latin diacritic
// stripping and lower-casing, so only lowercase forms are needed.
const HOMOGLYPHS: Record<string, string> = {
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x", і: "i", ї: "i", ј: "j", ѕ: "s", ԁ: "d", ԛ: "q", ԝ: "w", ѵ: "v", һ: "h", ӏ: "l", ү: "y", ᴀ: "a", ᴄ: "c", ᴅ: "d", ᴇ: "e", ᴋ: "k", ᴍ: "m", ᴏ: "o", ᴘ: "p", ᴛ: "t", ᴜ: "u", ᴠ: "v", ᴡ: "w", ᴢ: "z",
  α: "a", β: "b", γ: "y", ε: "e", ι: "i", κ: "k", μ: "u", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x", η: "n", ϲ: "c", ϳ: "j",
  ɡ: "g", ı: "i", ȷ: "j", ɑ: "a", ʏ: "y", ѻ: "o", ø: "o", ł: "l", đ: "d", ð: "d", ħ: "h", ß: "ss", æ: "ae", œ: "oe", "0": "o", "1": "l", "|": "l",
};

/** NFKC, collapsed whitespace, trimmed. Applied before validating AND storing, so fullwidth and compatibility forms cannot hide. */
export function normalizeName(raw: string) {
  return raw.normalize("NFKC").replace(/\s+/g, " ").trim();
}

/** Confusable skeleton: names with the same skeleton look alike to a reader and may not coexist on the leaderboard. */
export function nameSkeleton(name: string) {
  const folded = name.normalize("NFKC").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().normalize("NFKC");
  let out = "";
  for (const ch of folded) out += HOMOGLYPHS[ch] ?? ch;
  return out.replace(/\s+/g, " ").trim();
}

const RESERVED = ["admin", "administrator", "algosprint", "official", "moderator", "support", "system", "root", "staff", "null", "undefined", "anonymous", "deleted"];
const alnumSkeleton = (name: string) => nameSkeleton(name).replace(/[^a-z0-9]/g, "");
const isReserved = (name: string) => { const key = alnumSkeleton(name); return RESERVED.includes(key) || key.includes("algosprint"); };

const TLD = "com|net|org|io|dev|app|co|me|ai|gg|xyz|info|biz|us|uk|de|ru|cn|tv|ly|sh|so|to|cc|ws|edu|gov|page|site|online|link|club|top|tk|ml|ga|cf|gq|fm|im|fyi";
const DOTS = /[。｡․‧﹒·•∙⋅・]/g;
const linkLike = (name: string) => {
  // Look at the NFKC form with ideographic dots mapped to "." and spaces around dots removed ("example . com").
  const text = name.toLowerCase().replace(DOTS, ".").replace(/\s*\.\s*/g, ".");
  return /@|:\/\/|(^|[^a-z0-9])www\./.test(text)
    || /\b(https?|ftp|mailto)\s*:/.test(text)
    || new RegExp(`[a-z0-9]\\.(${TLD})(?![a-z0-9])`).test(text)
    || /[(\[{<]\s*(at|dot)\s*[)\]}>]/.test(text)
    || (/\bat\b/.test(text) && /\bdot\b/.test(text))
    || new RegExp(`\\bdot\\s*(${TLD})\\b`).test(text);
};

const script = (ch: string) => /\p{Script=Latin}/u.test(ch) ? "latin" : /\p{Script=Cyrillic}/u.test(ch) ? "cyrillic" : /\p{Script=Greek}/u.test(ch) ? "greek" : null;
// A word that mixes Latin with Cyrillic or Greek is the classic look-alike trick ("Аdmin" with a Cyrillic А).
const mixedScript = (name: string) => name.split(" ").some((word) => { const found = new Set([...word].map(script).filter(Boolean)); return found.has("latin") && (found.has("cyrillic") || found.has("greek")); });

// Invisible characters are checked on the NFKC form BEFORE whitespace is collapsed, so line separators, tabs and
// zero-width characters are rejected instead of silently turned into spaces.
export const leaderboardNameSchema = z.string().max(400, "Use at most 40 characters.")
  .transform((value) => value.normalize("NFKC"))
  .pipe(z.string().refine((value) => !invisible.test(value) && !blank.test(value), "Use a name without control or invisible characters."))
  .transform(normalizeName)
  .pipe(z.string()
    .min(LEADERBOARD_NAME_MIN, `Use at least ${LEADERBOARD_NAME_MIN} characters.`)
    .max(LEADERBOARD_NAME_MAX, `Use at most ${LEADERBOARD_NAME_MAX} characters.`)
    .refine((value) => !markRun.test(value), "Use a name without stacked accent marks.")
    .refine((value) => [...value].filter((ch) => /[\p{L}\p{N}]/u.test(ch)).length >= LEADERBOARD_NAME_MIN, "Use at least 2 letters or numbers.")
    .refine((value) => !linkLike(value), "Use a name without links or email addresses.")
    .refine((value) => !mixedScript(value), "Use one alphabet within each word.")
    .refine((value) => !isReserved(value), "That name is reserved. Choose another."));

export const leaderboardSettingsSchema = z.discriminatedUnion("optIn", [
  z.object({ optIn: z.literal(true), displayName: leaderboardNameSchema }),
  z.object({ optIn: z.literal(false) }),
]);

export type LeaderboardSettings = z.infer<typeof leaderboardSettingsSchema>;
export type LeaderboardFormState = { success?: boolean; message?: string; errors?: { displayName?: string[] } };
