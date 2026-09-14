import { Brand } from "@/components/layout/brand";
import { ButtonLink } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-heading";
export default function NotFound() {
  return <main className="mx-auto max-w-2xl px-5 py-20"><div className="mb-14"><Brand /></div><PageHeading eyebrow="404 · A different path" title="This page isn’t available" description="The address may have changed, or this page may not be available to your account." /><ButtonLink href="/">Back to home</ButtonLink></main>;
}
