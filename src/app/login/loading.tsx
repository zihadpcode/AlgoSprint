import { Brand } from "@/components/layout/brand";
import { LoadingState } from "@/components/ui/loading-state";
export default function Loading() {
  return <main className="mx-auto max-w-lg px-5 py-16"><div className="mb-10"><Brand /></div><LoadingState label="Preparing sign in…" /></main>;
}
