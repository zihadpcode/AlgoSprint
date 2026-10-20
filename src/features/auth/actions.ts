"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server";
import { accountsConfigured, getAppOrigin } from "@/lib/supabase/config";
import { loginSchema, registerSchema, safeReturnTo, type AuthFormState } from "./validation";

const unavailable = "Accounts are temporarily unavailable. Please try again later.";

// Bounded, string-only echo of the non-secret fields so a failed attempt keeps what the person typed.
function echo(form: FormData): NonNullable<AuthFormState["values"]> {
  const text = (name: string, max: number) => { const value = form.get(name); return typeof value === "string" ? value.slice(0, max) : undefined; };
  return { email: text("email", 254), displayName: text("displayName", 80) };
}

export async function login(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = echo(form);
  const input = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!input.success) return { errors: input.error.flatten().fieldErrors, message: "Check the highlighted fields.", values };
  if (!accountsConfigured()) return { message: unavailable, values };
  try {
    const client = await createAuthClient(true);
    const { error } = await client.auth.signInWithPassword(input.data);
    if (error) {
      if (error.status === 429) return { message: "Too many attempts. Please wait before trying again.", values };
      // The provider only reports this once the password was correct, so naming it discloses nothing the sender lacks.
      if (error.code === "email_not_confirmed") return { message: "Your email address is not confirmed yet. Open the link we emailed you, or resend it below.", values };
      return { message: "Could not sign in. Check your email, password, and email confirmation.", values };
    }
  } catch { return { message: unavailable, values }; }
  revalidatePath("/", "layout");
  redirect(safeReturnTo(form.get("next")));
}

export async function register(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = echo(form);
  const input = registerSchema.safeParse({ email: form.get("email"), password: form.get("password"), displayName: form.get("displayName") });
  if (!input.success) return { errors: input.error.flatten().fieldErrors, message: "Check the highlighted fields.", values };
  if (!accountsConfigured()) return { message: unavailable, values };
  let signedIn = false;
  try {
    const client = await createAuthClient(true);
    const { email, password, displayName } = input.data;
    const { data, error } = await client.auth.signUp({ email, password, options: {
      data: { display_name: displayName },
      emailRedirectTo: `${getAppOrigin()}/auth/callback`,
    } });
    if (error) return { message: error.status === 429 ? "Too many attempts. Please wait before trying again." : "We could not complete registration. Please try again, or sign in if you already have an account.", values };
    signedIn = Boolean(data.session);
  } catch { return { message: unavailable, values }; }
  if (signedIn) {
    revalidatePath("/", "layout");
    redirect(safeReturnTo(form.get("next")));
  }
  // The same response covers an existing account; do not disclose membership.
  return { success: true, values, message: "If your email is eligible, a confirmation link is on its way. Open it in this browser. Already registered? Sign in below." };
}

export async function logout(): Promise<void> {
  try {
    const client = await createAuthClient(true);
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw new Error("Sign-out failed.");
  } catch { throw new Error("Could not sign out. Please try again."); }
  revalidatePath("/", "layout");
  redirect("/login?signedOut=1");
}
