"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export function ResetConfirmation({ language, onCancel, onConfirm }: {
  language: string; onCancel: () => void; onConfirm: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancel.current?.focus(); }, []);
  return <div role="group" aria-label="Confirm code reset" className="space-y-3 rounded-xl border border-warm/60 bg-warm/5 p-4"
    onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onCancel(); } }}>
    <p className="text-sm leading-7">Replace your {language} draft with its starter code? Other language drafts stay unchanged.</p>
    <div className="flex flex-wrap gap-3">
      <Button ref={cancel} variant="secondary" onClick={onCancel}>Keep my code</Button>
      <Button onClick={onConfirm}>Replace with starter</Button>
    </div>
  </div>;
}
