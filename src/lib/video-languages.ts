import sources from "@/data/seeds/video-sources.json";

export const VIDEO_LANGUAGES = ["JAVASCRIPT", "PYTHON"] as const;
export type VideoLanguage = typeof VIDEO_LANGUAGES[number];
const supported = new Set<string>(VIDEO_LANGUAGES);
const languagesById = new Map<string, readonly VideoLanguage[]>((sources as { youtubeId: string; languages: string[] }[])
  .map((source) => [source.youtubeId, source.languages.filter((language): language is VideoLanguage => supported.has(language))]));

// Explicitly verified implementation languages only; titles and transferable concepts are not language evidence.
export function videoLanguages(youtubeId: string): readonly VideoLanguage[] { return languagesById.get(youtubeId) ?? []; }
