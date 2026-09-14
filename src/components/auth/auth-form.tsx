"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionState } from "react";
import { login, register } from "@/features/auth/actions";
import type { AuthFormState } from "@/features/auth/validation";

const initial: AuthFormState = {};
export function AuthForm({ mode, returnTo = "/dashboard" }: { mode: "login" | "register"; returnTo?: string }) {
  const registering = mode === "register";
  const [state, action, pending] = useActionState(registering ? register : login, initial);
  return (
    <form action={action} className="mt-8 space-y-5" aria-busy={pending}>
      <input type="hidden" name="next" value={returnTo} />
      {registering && <Field name="displayName" label="Display name" minLength={2} autoComplete="nickname" errors={state.errors?.displayName} maxLength={80} />}
      <Field name="email" label="Email" type="email" autoComplete="email" errors={state.errors?.email} maxLength={254} />
      <Field name="password" label="Password" type="password" autoComplete={registering ? "new-password" : "current-password"} errors={state.errors?.password} maxLength={128} minLength={registering ? 12 : 1} />
      {registering && <p className="text-sm text-muted">Use 12–128 characters. A long, unique passphrase works well.</p>}
      <div aria-live="polite" aria-atomic="true">
        {state.message && <p className="rounded-xl border border-line bg-surface-raised p-4 text-sm leading-6">{state.message}</p>}
      </div>
      <Button type="submit" disabled={pending || state.success} className="w-full">
        {pending ? "Please wait…" : registering ? "Create account" : "Sign in"}
      </Button>
      <p className="text-sm text-muted">{registering ? "Already have an account? " : "New to AlgoSprint? "}
        <Link className="rounded text-accent underline underline-offset-4" href={`${registering ? "/login" : "/register"}?next=${encodeURIComponent(returnTo)}`}>{registering ? "Sign in" : "Create an account"}</Link>
      </p>
    </form>
  );
}

function Field({ name, label, errors, ...props }: {
  name: string; label: string; errors?: string[]; type?: string; autoComplete: string; maxLength: number; minLength?: number;
}) {
  return <div>
    <label className="mb-2 block text-sm font-medium" htmlFor={name}>{label}</label>
    <Input {...props} id={name} name={name} required aria-invalid={Boolean(errors?.length)} aria-describedby={errors?.length ? `${name}-error` : undefined} />
    {errors?.length ? <p id={`${name}-error`} className="mt-2 text-sm text-warm">{errors[0]}</p> : null}
  </div>;
}
