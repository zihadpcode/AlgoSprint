"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server";
import { accountsConfigured, getAppOrigin } from "@/lib/supabase/config";
import { emailRequestSchema, resetPasswordSchema, type AuthFormState } from "./validation";
import { getRecoveryUser } from "./recovery-session";

const unavailable = "Accounts are temporarily unavailable. Please try again later.";

async function requestEmail(form: FormData, mode: "recovery" | "confirmation"): Promise<AuthFormState> {
  const input = emailRequestSchema.safeParse({ email: form.get("email") });
  if (!input.success) return { errors: input.error.flatten().fieldErrors, message: "Check the highlighted fields." };
  if (!accountsConfigured()) return { message: unavailable };
  try {
    const client = await createAuthClient(true);
    const callback = `${getAppOrigin()}/auth/callback`;
    if (mode === "recovery") await client.auth.resetPasswordForEmail(input.data.email, { redirectTo: callback });
    else await client.auth.resend({ type: "signup", email: input.data.email, options: { emailRedirectTo: callback } });
  } catch { /* Keep account eligibility, provider failures, and throttling indistinguishable. */ }
  // Supabase enforces shared provider-side IP/project/email limits across app instances.
  // This timestamp only controls UI retry feedback; never trust previous form state as a limiter.
  return {
    success: true,
    retryAt: Date.now() + 60_000,
    message: mode === "recovery"
      ? "If your email is eligible, a password reset link is on its way. Open the newest link in this browser. Please wait at least a minute before requesting another link."
      : "If your email is eligible, a signup confirmation link is on its way. Open the newest link in this browser. Please wait at least a minute before requesting another link.",
  };
}

export async function requestPasswordReset(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  return requestEmail(form, "recovery");
}

export async function resendConfirmation(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  return requestEmail(form, "confirmation");
}

export async function updatePassword(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  const input = resetPasswordSchema.safeParse({ password: form.get("password"), confirmPassword: form.get("confirmPassword") });
  if (!input.success) return { errors: input.error.flatten().fieldErrors, message: "Check the highlighted fields." };
  if (!accountsConfigured()) return { message: unavailable };
  try {
    const client = await createAuthClient(true);
    // Verify with the provider immediately before the mutation; never trust cookie claims or a posted user ID.
    if (!await getRecoveryUser(client)) {
      return { message: "Your session could not be verified. Request a new password reset link and open it in this browser." };
    }
    const result = await client.auth.updateUser({ password: input.data.password });
    if (result.error) return { message: result.error.status === 429
      ? "Too many attempts. Please wait before trying again."
      : "Could not update your password. Choose a different password, or request a fresh reset link and try again." };
  } catch { return { message: unavailable }; }
  revalidatePath("/", "layout");
  return { success: true, message: "Your password has been updated. You can continue practicing." };
}
