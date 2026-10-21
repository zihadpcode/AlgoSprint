"use client";
import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { saveLeaderboardSettings } from "@/features/leaderboard/actions";
import { LEADERBOARD_NAME_MAX, type LeaderboardFormState } from "@/features/leaderboard/validation";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

export function LeaderboardSettingsForm({ optedIn, initialName }: { optedIn: boolean; initialName: string }) {
  const [state, action] = useActionState<LeaderboardFormState, FormData>(saveLeaderboardSettings, {});
  // The switch is uncontrolled and `defaultChecked` follows the state: React resets a form after its action finishes, and a reset
  // restores `defaultChecked`. A controlled `checked` would snap back to the initial value and silently flip what is saved next.
  const [checked, setChecked] = useState(optedIn);
  const id = useId();
  const [name, setName] = useState(initialName);
  const error = state.errors?.displayName?.[0];
  return <form action={action} id="leaderboard" className="scroll-mt-20 space-y-5" aria-labelledby={`${id}-title`}>
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 id={`${id}-title`} className="flex items-center gap-2 text-base font-semibold"><Trophy aria-hidden="true" size={16} className="text-warm" />Leaderboard</h2>
        <p id={`${id}-copy`} className="mt-1.5 text-sm leading-6 text-muted">Off by default. When on, other learners, signed in or not, can see your display name and your solved counts on the <Link href="/leaderboard" className="text-accent hover:underline">leaderboard</Link>. Your email and everything else stay private. The display name is account-wide: it is also the name shown in the header menu and on your dashboard, so changing it here changes it everywhere.</p>
      </div>
      <label className="relative mt-0.5 inline-flex shrink-0 cursor-pointer items-center">
        <span className="sr-only">Show me on the leaderboard</span>
        <input type="checkbox" role="switch" name="optIn" defaultChecked={checked} onChange={(event) => setChecked(event.target.checked)} aria-describedby={`${id}-copy`} className="peer sr-only" />
        <span aria-hidden="true" className="h-6 w-11 rounded-full border border-line-strong bg-surface-raised transition-colors peer-checked:border-transparent peer-checked:bg-accent-solid peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
        <span aria-hidden="true" className="pointer-events-none absolute left-0.5 size-5 rounded-full bg-zinc-300 transition-transform peer-checked:translate-x-5 peer-checked:bg-white" />
      </label>
    </div>
    <div className={cn("space-y-1.5", !checked && "opacity-60")}>
      <label htmlFor={`${id}-name`} className="text-sm font-medium">Public display name</label>
      <Input id={`${id}-name`} name="displayName" value={name} onChange={(event) => setName(event.target.value)} maxLength={LEADERBOARD_NAME_MAX * 2} autoComplete="nickname" disabled={!checked} aria-invalid={error ? true : undefined} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} />
      <p id={`${id}-hint`} className="text-xs text-subtle">2 to {LEADERBOARD_NAME_MAX} characters. No links or email addresses. Must be unique on the leaderboard.</p>
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-danger">{error}</p>}
    </div>
    <div className="flex items-center gap-3"><SubmitButton pendingLabel="Saving…">Save</SubmitButton><span role="status" aria-live="polite" className={cn("text-sm", state.success ? "text-success" : "text-danger")}>{state.message}</span></div>
  </form>;
}
