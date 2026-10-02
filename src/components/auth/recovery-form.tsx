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
  return <form action={action} className="mt-8 space-y-5" aria-busy={pending}>
    <RecoveryField name="email" label="Email" type="email" autoComplete="email" maxLength={254} errors={state.errors?.email} />
    <FormMessage state={state} />
    <EmailSubmit pending={pending} retryAt={state.retryAt} label={mode === "recovery" ? "Send reset link" : "Resend confirmation"} />
    <p className="text-sm text-muted"><Link className="rounded text-accent underline underline-offset-4" href="/login">Back to sign in</Link></p>
  </form>;
}

// Remount for each response so the cooldown starts without copying props into state.
function EmailSubmit({ pending, retryAt, label }: { pending: boolean; retryAt?: number; label: string }) {
  return retryAt ? <CooldownSubmit key={retryAt} pending={pending} retryAt={retryAt} label={label} />
    : <Button type="submit" disabled={pending} className="w-full">{pending ? "Please wait…" : label}</Button>;
}

function CooldownSubmit({ pending, retryAt, label }: { pending: boolean; retryAt: number; label: string }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  return <Button type="submit" disabled={pending || remaining > 0} className="w-full">
    {pending ? "Please wait…" : remaining > 0 ? `Request again in ${remaining}s` : label}
  </Button>;
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initial);
  return <form action={action} className="mt-8 space-y-5" aria-busy={pending}>
    <RecoveryField name="password" label="New password" type="password" autoComplete="new-password" minLength={12} maxLength={128} errors={state.errors?.password} />
    <RecoveryField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" minLength={12} maxLength={128} errors={state.errors?.confirmPassword} />
    <p className="text-sm text-muted">Use 12–128 characters. A long, unique passphrase works well.</p>
    <FormMessage state={state} />
    <Button type="submit" disabled={pending || state.success} className="w-full">{pending ? "Please wait…" : "Update password"}</Button>
    {state.success ? <ButtonLink href="/dashboard" className="w-full">Continue practicing</ButtonLink>
      : <p className="text-sm text-muted"><Link className="rounded text-accent underline underline-offset-4" href="/forgot-password">Request a new reset link</Link></p>}
  </form>;
}

function FormMessage({ state }: { state: AuthFormState }) {
  return <div aria-live="polite" aria-atomic="true">
    {state.message ? <p className="rounded-xl border border-line bg-surface-raised p-4 text-sm leading-6">{state.message}</p> : null}
  </div>;
}

function RecoveryField({ name, label, errors, ...props }: {
  name: string; label: string; errors?: string[]; type: string; autoComplete: string; maxLength: number; minLength?: number;
}) {
  return <div>
    <label className="mb-2 block text-sm font-medium" htmlFor={name}>{label}</label>
    <Input {...props} id={name} name={name} required aria-invalid={Boolean(errors?.length)} aria-describedby={errors?.length ? `${name}-error` : undefined} />
    {errors?.length ? <p id={`${name}-error`} className="mt-2 text-sm text-warm">{errors[0]}</p> : null}
  </div>;
}
