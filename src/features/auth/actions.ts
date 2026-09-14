"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server";
import { accountsConfigured, getAppOrigin } from "@/lib/supabase/config";
import { loginSchema, registerSchema, safeReturnTo, type AuthFormState } from "./validation";

const unavailable = "Accounts are temporarily unavailable. Please try again later.";

export async function login(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  const input = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!input.success) return { errors: input.error.flatten().fieldErrors, message: "Check the highlighted fields." };
  if (!accountsConfigured()) return { message: unavailable };
  try {
    const client = await createAuthClient(true);
    const { error } = await client.auth.signInWithPassword(input.data);
    if (error) return { message: error.status === 429 ? "Too many attempts. Please wait before trying again." : "Could not sign in. Check your email, password, and email confirmation." };
  } catch { return { message: unavailable }; }
  revalidatePath("/", "layout");
  redirect(safeReturnTo(form.get("next")));
}

export async function register(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  const input = registerSchema.safeParse({ email: form.get("email"), password: form.get("password"), displayName: form.get("displayName") });
  if (!input.success) return { errors: input.error.flatten().fieldErrors, message: "Check the highlighted fields." };
  if (!accountsConfigured()) return { message: unavailable };
  let signedIn = false;
  try {
    const client = await createAuthClient(true);
    const { email, password, displayName } = input.data;
    const { data, error } = await client.auth.signUp({ email, password, options: {
      data: { display_name: displayName },
      emailRedirectTo: `${getAppOrigin()}/auth/callback`,
    } });
    if (error) return { message: error.status === 429 ? "Too many attempts. Please wait before trying again." : "We could not complete registration. Please try again, or sign in if you already have an account." };
    signedIn = Boolean(data.session);
  } catch { return { message: unavailable }; }
  if (signedIn) {
    revalidatePath("/", "layout");
    redirect(safeReturnTo(form.get("next")));
  }
  // The same response covers an existing account; do not disclose membership.
  return { success: true, message: "If your email is eligible, a confirmation link is on its way. Open it in this browser. Already registered? Sign in below." };
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
