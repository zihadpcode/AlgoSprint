import { getDatabase } from "@/lib/prisma";
import { searchPublishedProblems } from "@/features/problems/search";

// Public, read-only catalogue search for the command palette. Never cached across queries by intermediaries.
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!process.env.DATABASE_URL) return Response.json({ items: [] }, { status: 503, headers });
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    return Response.json({ items: await searchPublishedProblems(getDatabase(), q) }, { headers });
  } catch {
    return Response.json({ items: [] }, { status: 503, headers });
  }
}
