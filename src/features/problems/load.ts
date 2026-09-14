import "server-only";
import { getViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { needsPersonalProgress, parseLibraryFilters, type SearchParams } from "./filters";
import { queryLibrary } from "./query";

export async function loadLibrary(params: SearchParams) {
  const filters = parseLibraryFilters(params);
  if (!process.env.DATABASE_URL) {
    return { kind: "unavailable" as const, filters, signedIn: false, admin: false };
  }
  // Identity comes only from a fresh provider verification, never URL parameters.
  const viewer = await getViewer();
  const account = { signedIn: Boolean(viewer), admin: viewer?.role === "ADMIN" };
  if (!viewer && needsPersonalProgress(filters)) {
    return { kind: "sign-in" as const, filters, ...account };
  }
  const result = await queryLibrary(getDatabase(), filters, viewer?.id ?? null);
  return { kind: "ready" as const, filters, result, ...account };
}
