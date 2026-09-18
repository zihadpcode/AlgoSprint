export type SavedKind = "notes" | "bookmarks" | "review";
export type SavedFilters = { q: string; page: number };
export function parseSavedFilters(input: Record<string, string | string[] | undefined>): SavedFilters {
  const q = typeof input.q === "string" ? input.q.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 100) : "";
  const page = typeof input.page === "string" && /^[1-9][0-9]{0,5}$/.test(input.page) ? Number(input.page) : 1;
  return { q, page };
}
export function savedHref(kind: SavedKind, { q, page }: SavedFilters) {
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (page > 1) query.set("page", String(page));
  return `/${kind}${query.size ? `?${query}` : ""}`;
}
