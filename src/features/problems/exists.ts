import "server-only";
import { getDatabase } from "@/lib/prisma";
import { problemSlug } from "./detail-validation";

/**
 * Cheap existence check for the [slug] layout. It runs before the loading boundary starts streaming, so an unknown or
 * unpublished problem gets a real 404 status instead of a 200 that renders the not-found UI. Without a database the
 * page shows its own "unavailable" state, so only the slug format is checked.
 */
export async function publishedProblemExists(slug: string) {
  if (!problemSlug.safeParse(slug).success) return false;
  if (!process.env.DATABASE_URL) return true;
  return Boolean(await getDatabase().problem.findFirst({ where: { slug, status: "PUBLISHED" }, select: { id: true } }));
}
