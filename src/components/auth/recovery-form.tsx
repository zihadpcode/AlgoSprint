"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset, resendConfirmation, updatePassword } from "@/features/auth/recovery-actions";
import type { AuthFormState } from "@/features/auth/validation";

const initial: AuthFormState = {};

export function EmailRequestForm({ mode }: { mode: "recovery" | "confirmation" }) {
  const [state, action, pending] = useActionState(mode === "recovery" ? requestPasswordReset : resendConfirmation, initial);
  return <form action={action} className="mt-6 space-y-4" aria-busy={pending}>
    <RecoveryField name="email" label="Email" type="email" autoComplete="email" maxLength={254} errors={state.errors?.email} />
    <FormMessage state={state} />
    <EmailSubmit pending={pending} retryAt={state.retryAt} label={mode === "recovery" ? "Send reset link" : "Resend confirmation"} />
    <p className="border-t border-line pt-4 text-sm text-muted"><Link className="rounded text-accent underline-offset-4 hover:underline" href="/login">Back to sign in</Link></p>
  </form>;
}

// Remount for each response so the cooldown starts without copying props into state.
function EmailSubmit({ pending, retryAt, label }: { pending: boolean; retryAt?: number; label: string }) {
  return retryAt ? <CooldownSubmit key={retryAt} pending={pending} retryAt={retryAt} label={label} />
    : <Button type="submit" size="lg" disabled={pending} className="w-full">{pending ? "Please wait…" : label}</Button>;
}

function CooldownSubmit({ pending, retryAt, label }: { pending: boolean; retryAt: number; label: string }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  return <Button type="submit" size="lg" disabled={pending || remaining > 0} className="w-full">
    {pending ? "Please wait…" : remaining > 0 ? `Request again in ${remaining}s` : label}
  </Button>;
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initial);
  return <form action={action} className="mt-6 space-y-4" aria-busy={pending}>
    <RecoveryField name="password" label="New password" type="password" autoComplete="new-password" minLength={12} maxLength={128} errors={state.errors?.password} />
    <RecoveryField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" minLength={12} maxLength={128} errors={state.errors?.confirmPassword} />
    <p className="-mt-2 text-xs leading-5 text-subtle">Use 12–128 characters. A long, unique passphrase works well.</p>
    <FormMessage state={state} />
    <Button type="submit" size="lg" disabled={pending || state.success} className="w-full">{pending ? "Please wait…" : "Update password"}</Button>
    {state.success ? <ButtonLink href="/dashboard" size="lg" className="w-full">Continue practicing</ButtonLink>
      : <p className="border-t border-line pt-4 text-sm text-muted"><Link className="rounded text-accent underline-offset-4 hover:underline" href="/forgot-password">Request a new reset link</Link></p>}
  </form>;
}

function FormMessage({ state }: { state: AuthFormState }) {
  return <div aria-live="polite" aria-atomic="true">
    {state.message ? <p className="rounded-lg border border-line bg-canvas p-3 text-sm leading-6">{state.message}</p> : null}
  </div>;
}

function RecoveryField({ name, label, errors, ...props }: {
  name: string; label: string; errors?: string[]; type: string; autoComplete: string; maxLength: number; minLength?: number;
}) {
  return <div>
    <label className="mb-1.5 block text-sm font-medium" htmlFor={name}>{label}</label>
    <Input {...props} id={name} name={name} required aria-invalid={Boolean(errors?.length)} aria-describedby={errors?.length ? `${name}-error` : undefined} />
    {errors?.length ? <p id={`${name}-error`} className="mt-1.5 text-xs text-danger">{errors[0]}</p> : null}
  </div>;
}
