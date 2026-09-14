import { z } from "zod";

export const displayNameSchema = z.string().trim().min(2, "Use at least 2 characters.").max(80, "Use at most 80 characters.")
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Use a name without control characters.");
const email = z.string().trim().max(254).pipe(z.email("Enter a valid email address."));
export const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password.").max(128) });
export const registerSchema = z.object({
  displayName: displayNameSchema,
  email,
  // Preserve spaces; never silently trim or transform a password.
  password: z.string().min(12, "Use at least 12 characters.").max(128, "Use at most 128 characters."),
});

export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length > 1000) return "/dashboard";
  // Only known application roots and simple path segments. Query values stay local.
  if (!/^\/(?:dashboard|profile|problems|roadmaps|notes|review|admin|mock-interview)(?:\/[a-zA-Z0-9_-]+)*(?:\?[^#\\\u0000-\u001f\u007f]*)?$/.test(value)) return "/dashboard";
  return value;
}

export type AuthFormState = {
  message?: string;
  success?: boolean;
  errors?: Partial<Record<"email" | "password" | "displayName", string[]>>;
};
