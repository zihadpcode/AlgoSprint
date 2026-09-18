import "server-only";
import { requireViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { parseSavedFilters, savedHref, type SavedKind } from "./filters";
import { querySaved } from "./query";

export async function loadSaved(kind: SavedKind, search: Record<string, string | string[] | undefined>) {
  const filters = parseSavedFilters(search);
  const viewer = await requireViewer(savedHref(kind, filters));
  return { admin: viewer.role === "ADMIN", collection: await querySaved(getDatabase(), viewer.id, kind, filters) };
}
