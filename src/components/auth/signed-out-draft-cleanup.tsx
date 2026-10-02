"use client";
import { useEffect } from "react";
import { clearBrowserDrafts } from "@/features/drafts/storage";
// Also covers a server-action logout when the client submit handler did not run.
export function SignedOutDraftCleanup() { useEffect(() => { clearBrowserDrafts(); }, []); return null; }
