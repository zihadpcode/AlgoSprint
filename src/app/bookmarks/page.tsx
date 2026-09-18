import type { Metadata } from "next";
import { loadSaved } from "@/features/saved/load";
import { SavedCollectionPage } from "@/components/saved/saved-collection";

export const metadata: Metadata = { title: "Your bookmarks", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const data = await loadSaved("bookmarks", await searchParams);
  return <SavedCollectionPage kind="bookmarks" {...data} />;
}
