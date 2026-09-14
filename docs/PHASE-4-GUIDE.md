# Phase 4 — App shell and UI system

**Partial checkpoint, paused on 2026-09-14. Final implementation and visual verification are not complete. See [PHASE-4-PAUSED.md](PHASE-4-PAUSED.md) before using or continuing this work.**

## 🟦 What we are building

The authenticated pages now share an original responsive workspace shell: a brand header, desktop sidebar, compact horizontal navigation on smaller screens, content container, footer, sign-out form, and skip link. Reusable buttons/links, cards, badges, inputs/selects, page headings, empty states, loading placeholders, and error states provide one consistent dark visual system.

This is a UI checkpoint. It does not claim to add practice analytics, saved progress, or administrator content editing. Dashboard and admin placeholders say what is available. Navigation links lead to implemented routes; the library link will be added when Phase 5 exists.

## 🟨 Why this structure

`AppShell` is presentational and can later serve public problem pages with a sign-in link. `AccountFrame` wraps it for already-verified account pages. Neither component grants access. Each protected page still calls its Phase 3 server guard before rendering, and no private user/session object is passed into navigation.

Only the active navigation, pending submit button, and existing interactive forms/error boundary need Client Components. The rest remains server-compatible. `WorkspaceNav` reads the pathname and marks the active link with `aria-current`. The same navigation becomes horizontal on small screens; there is no hidden drawer requiring custom focus trapping.

UI primitives retain native HTML behavior. `Button` defaults to `type="button"` to prevent accidental form submissions; form buttons explicitly submit. `ButtonLink` uses a real Next.js link. Cards keep semantic headings separate so callers choose a correct hierarchy. Input components forward labels, validation attributes, autocomplete, and standard browser behavior.

Color tokens centralize surfaces, borders, text, emphasis, success, and danger. Status badges include words, not color alone. Focus outlines use the warm token. Touch targets are at least 44px, text can wrap, main content uses `min-width: 0`, and animation respects reduced motion.

## 🟩 How files connect

- `src/components/layout/app-shell.tsx` composes brand, navigation, pending sign-out, main content, and footer.
- `workspace-nav.tsx` handles route highlighting only; it never imports auth/database modules.
- `src/components/ui/` contains the small native component set. The existing `cn()` helper combines conditional classes and resolves Tailwind conflicts.
- Dashboard/profile/admin now use the same headings, cards, badges, and empty states. Auth forms reuse Input and Button without changing their server actions.
- Public login/registration segments have lightweight loading fallbacks. There is intentionally no root loading boundary around protected pages: identity checks complete before they can return protected content or an HTTP redirect.
- The shared error boundary displays a fixed recovery message and retry/home actions. The not-found page supplies a usable destination without disclosing why protected admin content was denied.

## 🟩 Verification

Run `npm run lint`, `npm run typecheck`, and `npm run build`. Existing authorization tests remain the guard against accidental changes to the server boundary. CI's HTTP smoke also checks protected redirects and a real 404 response. No implementation-mirroring unit tests were added for simple style wrappers.

Manual browser checklist after account configuration:

1. At mobile and desktop widths, check the header, wrapping navigation, sidebar, cards, and long email/name text. Main content should not create horizontal page scrolling.
2. Navigate with Tab. Confirm the skip link becomes visible, all controls have clear focus, and the active page is conveyed by `aria-current` and appearance.
3. Check forms with browser autofill, keyboard submit, validation errors, pending state, and disabled controls. Sign out remains a server POST.
4. Simulate a slow login-page load and inspect the loading status. Use reduced motion and confirm pulsing is suppressed.
5. Visit a missing path and trigger a development-only error while working locally, then undo it. Confirm useful 404/retry states and no provider/connection detail exposure.
6. Use 200% zoom and a screen reader to check heading order, landmarks, button/link names, and status announcements.

The coding workspace does not permit the local server setup used for visual QA; automated build/CI checks do not substitute for this manual browser checklist.

## 🟥 Common mistakes

Do not infer permission from a displayed admin link. Do not put session data or database clients in the navigation component. Do not create dead links to unfinished features, show invented solved counts, wrap links in buttons, remove focus outlines, or use color as the only status cue. Keep error messages useful without exposing raw exceptions.

## 🟪 Next milestone

Phase 5 builds the real problem library with title search, difficulty/category/tag/pattern/time/completion filters, sorting, pagination, and a small debounced search control. It will query published problem data through an explicit public-field selection and apply personal status only for the verified viewer.

## 🟩 Complete Phase 4 source

These are the complete files introduced or updated for this UI checkpoint. Current repository files take precedence after later phases change them.

### `src/components/ui/badge.tsx`

```tsx
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
const tones = { neutral: "border-line bg-surface-raised text-muted", accent: "border-accent/30 bg-accent/10 text-accent", success: "border-success/30 bg-success/10 text-success", warm: "border-warm/30 bg-warm/10 text-warm", danger: "border-danger/30 bg-danger/10 text-danger" };
export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: keyof typeof tones }) {
  return <span {...props} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", tones[tone], className)} />;
}
```

### `src/components/ui/button.tsx`

```tsx
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "quiet" | "danger";
const variants: Record<Variant, string> = {
  primary: "border-transparent bg-accent text-canvas hover:bg-accent-strong",
  secondary: "border-line bg-surface text-ink hover:border-accent hover:bg-surface-raised",
  quiet: "border-transparent text-muted hover:bg-surface-raised hover:text-ink",
  danger: "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
};
function styles(variant: Variant, className?: string) {
  return cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50", variants[variant], className);
}
export function Button({ variant = "primary", className, type = "button", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button {...props} type={type} className={styles(variant, className)} />;
}
export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link {...props} className={styles(variant, className)} />;
}
```

### `src/components/ui/card.tsx`

```tsx
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("min-w-0 rounded-2xl border border-line bg-surface p-6 sm:p-7", className)} />;
}
export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 {...props} className={cn("text-xl font-semibold tracking-tight", className)} />;
}
export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p {...props} className={cn("mt-3 text-sm leading-7 text-muted", className)} />;
}
```

### `src/components/ui/empty-state.tsx`

```tsx
import type { ReactNode } from "react";
import { Compass } from "lucide-react";
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line bg-surface/50 px-6 py-12 text-center">
    <span className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent"><Compass aria-hidden="true" size={24} /></span>
    <h2 className="text-lg font-semibold">{title}</h2><p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted">{description}</p>
    {action && <div className="mt-6">{action}</div>}
  </div>;
}
```

### `src/components/ui/error-state.tsx`

```tsx
import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
export function ErrorState({ title = "Something went wrong", description, action }: { title?: string; description: string; action?: ReactNode }) {
  return <div className="rounded-2xl border border-danger/30 bg-surface p-7">
    <CircleAlert aria-hidden="true" size={28} className="mb-5 text-danger" />
    <h1 className="text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-4 max-w-lg leading-7 text-muted">{description}</p>
    {action && <div className="mt-7 flex flex-wrap gap-3">{action}</div>}
  </div>;
}
```

### `src/components/ui/input.tsx`

```tsx
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cn("min-h-12 w-full rounded-xl border border-line bg-canvas px-4 text-sm text-ink placeholder:text-muted/70 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger", className)} />;
}
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cn("min-h-12 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink disabled:opacity-50", className)} />;
}
```

### `src/components/ui/loading-state.tsx`

```tsx
import { cn } from "@/lib/utils";
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("motion-safe:animate-pulse rounded-lg bg-surface-raised", className)} />;
}
export function LoadingState({ label = "Loading your page…" }: { label?: string }) {
  return <div role="status" aria-live="polite" className="space-y-6">
    <p className="text-sm text-muted">{label}</p>
    <Skeleton className="h-9 w-2/3 max-w-md" />
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-7"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-1/2" /><Skeleton className="mt-8 h-12 w-full" /></div>
  </div>;
}
```

### `src/components/ui/page-heading.tsx`

```tsx
import type { ReactNode } from "react";
export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
    <div className="max-w-2xl">{eyebrow && <p className="eyebrow mb-3 text-accent">{eyebrow}</p>}
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      {description && <p className="mt-4 leading-7 text-muted">{description}</p>}
    </div>{action && <div className="shrink-0">{action}</div>}
  </div>;
}
```

### `src/components/ui/submit-button.tsx`

```tsx
"use client";
import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { Button } from "./button";
export function SubmitButton({ pendingLabel = "Please wait…", children, disabled, ...props }: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <Button {...props} type="submit" disabled={disabled || pending} aria-busy={pending}>{pending ? pendingLabel : children}</Button>;
}
```

### `src/components/layout/app-shell.tsx`

```tsx
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Brand } from "./brand";
import { WorkspaceNav } from "./workspace-nav";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { logout } from "@/features/auth/actions";

export function AppShell({ children, admin = false, signedIn = false }: { children: ReactNode; admin?: boolean; signedIn?: boolean }) {
  return <div className="min-h-dvh">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-canvas focus:p-4">Skip to content</a>
    <header className="border-b border-line bg-canvas"><div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
      <Brand /><div className="flex items-center gap-6"><span className="hidden text-sm text-muted sm:block">Practice with purpose.</span>
        {signedIn ? <form action={logout}><SubmitButton variant="secondary" pendingLabel="Signing out…">Sign out</SubmitButton></form> : <ButtonLink href="/login" variant="secondary">Sign in</ButtonLink>}
      </div>
    </div></header>
    <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b border-line bg-surface/40 px-4 py-3 lg:sticky lg:top-0 lg:flex lg:h-[calc(100dvh-81px)] lg:flex-col lg:border-r lg:border-b-0 lg:px-5 lg:py-8">
        <p className="eyebrow mb-4 hidden px-4 text-xs text-muted lg:block">Workspace</p>
        <WorkspaceNav admin={admin} />
        <div className="mt-auto hidden rounded-2xl border border-line bg-surface p-5 lg:block"><Sparkles aria-hidden="true" size={20} className="text-warm" /><p className="mt-3 text-sm font-medium">Keep one insight.</p><p className="mt-2 text-xs leading-6 text-muted">After each practice session, write down one thing you want to remember.</p></div>
      </aside>
      <div className="min-w-0"><main id="main-content" className="px-5 py-8 sm:px-8 lg:p-10">{children}</main>
        <footer className="px-5 pb-8 text-xs text-muted sm:px-8 lg:px-10">One problem. One insight. Another step forward.</footer>
      </div>
    </div>
  </div>;
}
```

### `src/components/layout/workspace-nav.tsx`

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UserRound, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
const links = [ { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, { href: "/profile", label: "Profile", icon: UserRound } ];
export function WorkspaceNav({ admin = false }: { admin?: boolean }) {
  const pathname = usePathname();
  const items = admin ? [...links, { href: "/admin", label: "Admin", icon: ShieldCheck }] : links;
  return <nav aria-label="Workspace navigation"><ul className="flex gap-2 overflow-x-auto p-1 lg:flex-col">
    {items.map(({ href, label, icon: Icon }) => {
      const active = pathname === href || pathname.startsWith(`${href}/`);
      return <li key={href} className="shrink-0"><Link href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors", active ? "border-accent/25 bg-accent/10 text-accent" : "border-transparent text-muted hover:bg-surface-raised hover:text-ink")}><Icon aria-hidden="true" size={18} />{label}</Link></li>;
    })}
  </ul></nav>;
}
```

### `src/components/auth/account-frame.tsx`

```tsx
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

// Presentational only: callers must verify identity before rendering this frame.
export function AccountFrame({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  return <AppShell signedIn admin={admin}>{children}</AppShell>;
}
```

### `src/components/auth/auth-form.tsx`

```tsx
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
      {registering && <Field name="displayName" label="Display name" autoComplete="nickname" errors={state.errors?.displayName} maxLength={80} />}
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
        <Link className="rounded text-accent underline underline-offset-4" href={registering ? "/login" : "/register"}>{registering ? "Sign in" : "Create an account"}</Link>
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
```

### `src/app/dashboard/page.tsx`

```tsx
import type { Metadata } from "next";
import { requireViewer } from "@/features/auth/session";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const viewer = await requireViewer();
  return <AccountFrame admin={viewer.role === "ADMIN"}>
    <PageHeading eyebrow="Your practice space" title={`Welcome, ${viewer.displayName || "learner"}.`} description="Build an approach you understand, then carry that insight into the next challenge." action={<ButtonLink href="/profile" variant="secondary">View profile</ButtonLink>} />
    <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <Card><Badge tone="success">Account ready</Badge><CardTitle className="mt-5">A small step, taken consistently.</CardTitle><CardDescription>Start with the question, trace a simple example, and explain your approach before optimizing it. Deliberate practice starts with understanding.</CardDescription></Card>
      <Card><CardTitle>Your practice rhythm</CardTitle><ol className="mt-5 space-y-4 text-sm text-muted">{["Read the constraints and choose an example.", "Write a first approach you can explain.", "Review what changed your understanding."].map((step, index) => <li key={step} className="flex gap-3"><span className="font-mono text-accent">0{index + 1}</span><span>{step}</span></li>)}</ol></Card>
    </div>
    <section className="mt-8" aria-label="Practice activity"><EmptyState title="Your practice story starts here" description="Problem practice and activity insights are being prepared. Your account is ready for the next step." /></section>
  </AccountFrame>;
}
```

### `src/app/profile/page.tsx`

```tsx
import type { Metadata } from "next";
import { requireViewer } from "@/features/auth/session";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Profile", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function ProfilePage() {
  const viewer = await requireViewer("/profile");
  return <AccountFrame admin={viewer.role === "ADMIN"}>
    <PageHeading eyebrow="Your account" title="Profile" description="The person behind the practice." />
    <Card className="max-w-3xl"><div className="mb-7 flex flex-wrap items-center gap-4"><span aria-hidden="true" className="grid size-14 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-xl font-semibold text-accent">{(viewer.displayName || "L").slice(0, 1).toUpperCase()}</span><div><h2 className="text-xl font-semibold">{viewer.displayName || "Learner"}</h2><Badge className="mt-2" tone="accent">{viewer.role === "ADMIN" ? "Administrator" : "Learner"}</Badge></div></div>
      <dl className="grid gap-6 border-t border-line pt-7 sm:grid-cols-2">{[["Email", viewer.email || "Not available"], ["Time zone", viewer.timeZone], ["Member since", viewer.createdAt.toISOString().slice(0, 10)]].map(([label, value]) => <div key={label}><dt className="text-sm text-muted">{label}</dt><dd className="mt-2 break-words font-medium">{value}</dd></div>)}</dl>
    </Card>
  </AccountFrame>;
}
```

### `src/app/admin/page.tsx`

```tsx
import type { Metadata } from "next";
import { requireAdmin } from "@/features/auth/session";
import { AccountFrame } from "@/components/auth/account-frame";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  await requireAdmin();
  return <AccountFrame admin><PageHeading eyebrow="Content administration" title="Admin workspace" description="A home for clear, original learning content." action={<Badge tone="warm">Administrator</Badge>} />
    <EmptyState title="Content tools are on the way" description="Your administrator access is verified. Authoring and content management will be available in the admin milestone." />
  </AccountFrame>;
}
```

### `src/app/error.tsx`

```tsx
"use client";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-2xl px-5 py-24"><ErrorState title="We couldn’t load this page" description="Please try again in a moment. If the problem continues, come back a little later." action={<><Button onClick={reset}>Try again</Button><ButtonLink href="/" variant="secondary">Back to home</ButtonLink></>} /></main>;
}
```

### `src/app/not-found.tsx`

```tsx
import { Brand } from "@/components/layout/brand";
import { ButtonLink } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-heading";
export default function NotFound() {
  return <main className="mx-auto max-w-2xl px-5 py-20"><div className="mb-14"><Brand /></div><PageHeading eyebrow="404 · A different path" title="This page isn’t available" description="The address may have changed, or this page may not be available to your account." /><ButtonLink href="/">Back to home</ButtonLink></main>;
}
```

### `src/app/login/loading.tsx`

```tsx
import { Brand } from "@/components/layout/brand";
import { LoadingState } from "@/components/ui/loading-state";
export default function Loading() {
  return <main className="mx-auto max-w-lg px-5 py-16"><div className="mb-10"><Brand /></div><LoadingState label="Preparing sign in…" /></main>;
}
```

### `src/app/register/loading.tsx`

```tsx
export { default } from "../login/loading";
```

### `src/app/globals.css`

```css
@import "tailwindcss";

/* Tailwind v4 creates utilities such as bg-canvas from these theme tokens. */
@theme {
  --color-canvas: #090d16;
  --color-surface: #101724;
  --color-surface-raised: #172235;
  --color-line: #2b3a50;
  --color-ink: #f3f6fc;
  --color-muted: #b2bdd0;
  --color-accent: #8ab4ff;
  --color-accent-strong: #bad2ff;
  --color-warm: #f2c879;
  --color-lilac: #c6b6fa;
  --color-success: #82dbb0;
  --color-danger: #ffadb6;
  --font-sans: "Avenir Next", "Segoe UI", Arial, sans-serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}

@layer base {
  html {
    color-scheme: dark;
    scroll-behavior: smooth;
    scroll-padding-top: 2rem;
  }

  body {
    @apply min-h-dvh bg-canvas font-sans text-base text-ink antialiased;
  }

  ::selection {
    @apply bg-accent text-canvas;
  }

  :focus-visible {
    outline: 3px solid var(--color-warm);
    outline-offset: 5px;
  }

  /* Respect reduced motion for native scrolling and CSS transitions. */
  @media (prefers-reduced-motion: reduce) {
    html {
      scroll-behavior: auto;
    }

    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
    }
  }
}

@layer components {
  .eyebrow {
    @apply font-mono text-sm font-medium tracking-[0.12em] uppercase;
  }

  .action-link {
    @apply inline-flex min-h-12 items-center justify-center gap-2 rounded-xl
      border border-transparent px-5 py-3 text-base font-semibold transition-colors;
  }

  .action-link-primary {
    @apply bg-accent text-canvas hover:bg-accent-strong;
  }

  .action-link-secondary {
    @apply border-line bg-surface text-ink hover:border-accent hover:bg-surface-raised;
  }

  .preview-surface {
    background:
      radial-gradient(ellipse at top right, #28457340, transparent 65%),
      var(--color-surface);
    box-shadow: 0 24px 80px #00000040;
  }
}
```

