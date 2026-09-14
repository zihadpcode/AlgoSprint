"use client";
import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { Button } from "./button";
export function SubmitButton({ pendingLabel = "Please wait…", children, disabled, ...props }: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <Button {...props} type="submit" disabled={disabled || pending} aria-busy={pending}>{pending ? pendingLabel : children}</Button>;
}
