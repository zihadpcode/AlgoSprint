# AlgoSprint — Phase 1: Build the foundation

**🟦 Goal:** create a working Next.js + React + TypeScript + Tailwind project and an original dark landing page that you can run, understand, and extend.

You are learning how a web application is assembled: how a URL becomes a page, how components fit together, how styling reaches the browser, and how to check a change before building on it. This is a portfolio project, so being able to explain these decisions matters as much as getting a page to appear.

The completed source is included with this guide. Read the explanations, reproduce the setup, and compare your work with the complete files. You do not need a Supabase account, database password, or runner subscription for this phase.

## 🟦 1. What this phase builds

The result is a local application with one implemented page: `/`. It contains a header, introductory content, an original read-only practice illustration, a three-step learning approach, clearly labeled planned features, and a footer. Shared components keep the spacing and branding consistent.

The practice illustration, **Relay Window**, is landing-page content. It is not a seeded problem record or working code editor. All other application routes are reserved folders. A folder with a `.gitkeep` file is not an implemented Next.js page.

We stop here. PostgreSQL, Prisma, migrations, and seeding belong to Phase 2. Authentication belongs to Phase 3. Deployment remains in Phase 16. The long-term goal is 1,000 reviewed original problems, reached through the 5 → 20 → 100 → 1,000 stages in your brief.

## 🟦 2. Understand the stack

| Tool | Its role in this phase | Why use it here? |
| --- | --- | --- |
| Node.js 24 LTS | Runs local development tools and the Next.js server. | One agreed runtime reduces version mismatches. |
| npm | Installs packages and runs named commands. | It comes with Node.js and provides a lockfile for reproducible installs. |
| Next.js App Router | Connects the `/` URL to the home page and provides the build process. | Later phases can add server endpoints and authenticated routes within the same project. |
| React | Composes the page from reusable UI functions. | The same header, footer, and container can be reused without copying markup. |
| TypeScript | Checks types before code runs. | It catches incompatible values and imports while the project is still small. |
| Tailwind CSS v4 | Builds CSS from utility classes and shared theme tokens. | Color, spacing, and responsive behavior have consistent rules. |
| lucide-react | Supplies interface icons. | We use a maintained icon system with consistent shapes. |
| clsx | Combines class names, including optional classes. | Components can accept styling overrides without awkward string concatenation. |
| tailwind-merge | Resolves supported conflicts between Tailwind utilities. | A component override can reliably replace a default class. |
| ESLint | Checks source for problems using the Next.js rules. | We establish a repeatable quality check before features multiply. |

Use the current [Node.js 24 LTS installer](https://nodejs.org/en/download) for your Mac. The project deliberately targets the 24 major version. Next.js documents its installation requirements in the [official installation guide](https://nextjs.org/docs/app/getting-started/installation).

## 🟩 3. Choose your starting route

**Route A is the learning path: create the project from scratch. Route B runs the completed starter. Choose one; do not run the initializer over an existing project.**

### Route A — create the project yourself

Open Terminal. Check the tools:

```bash
node --version
npm --version
git --version
```

Node should report `v24.x.x`. If `node` or `npm` is missing, install Node.js 24 LTS and reopen Terminal. On macOS, `git --version` may offer to install Apple's Command Line Tools if Git is missing. Complete that normal installation before the optional Git step below.

Create a parent folder and initialize a **new** project:

```bash
mkdir -p ~/Developer
cd ~/Developer
npx --yes create-next-app@16.3.5 algosprint --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-react-compiler --skip-install --disable-git --yes
cd algosprint
npm install --save-exact lucide-react@1.45.0 clsx@2.1.1 tailwind-merge@3.6.0
```

`mkdir -p` creates a folder if necessary; `cd` changes your current folder. `npx` runs the named scaffolding package. The framework version is explicit so the starter matches this walkthrough. The subsequent `npm install` installs the scaffold's existing dependencies along with the three extra UI utilities.

| Initializer option | Meaning |
| --- | --- |
| `--typescript` | Generate TypeScript application files. |
| `--tailwind` | Set up Tailwind's stylesheet pipeline. |
| `--eslint` | Generate a lint configuration. |
| `--app` | Use the App Router. |
| `--src-dir` | Keep application source beneath `src/`. |
| `--import-alias "@/*"` | Allow imports such as `@/lib/constants`. |
| `--use-npm` | Use npm and its lockfile consistently. |
| `--no-react-compiler` | Keep compiler configuration outside this first learning phase. |
| `--skip-install` | Let the next command install dependencies once. |
| `--disable-git` | Leave the first Git commit for you to review. |
| `--yes` | Accept the remaining scaffold defaults. |

Next, replace the generated files with their **complete versions in the source appendix**, and create the additional files at their listed paths. Alternatively, copy those source files from the completed archive. Do not paste React code directly into Terminal; edit the appropriate file in VS Code.

Open the folder with VS Code's **File → Open Folder**. If you already enabled its shell command, you can use:

```bash
code .
```

The project uses local system fonts, so remove the unused scaffold artwork and favicon as part of replacing the generated page. Run these only inside this newly created `algosprint` folder:

```bash
rm -f public/next.svg public/vercel.svg public/file.svg public/window.svg public/globe.svg src/app/favicon.ico
```

The complete source includes an original replacement at `src/app/icon.svg`.

After replacing `package.json` and the configuration files:

```bash
npm install
cp .env.example .env.local
```

`npm install` updates the lockfile to match intentional package changes. The first local environment file contains only comments. If your project already has real configuration, preserve it instead of overwriting it. Exact transitive versions can change during a fresh install; the supplied archive's lockfile is the authoritative record of the version checked here.

### Route B — run the completed starter

Extract `AlgoSprint-Phase-1.zip`, open its `algosprint` folder in VS Code, and open a terminal in that folder. Then run:

```bash
node --version
npm --version
npm ci
cp .env.example .env.local
npm run dev
```

`npm ci` installs the dependency tree recorded in `package-lock.json`. It expects that file and `package.json` to agree. It replaces the installed dependency directory, not your application source. The archive intentionally excludes installed packages and build output, so this installation step is required.

## 🟦 4. Set up folders with clear responsibilities

For Route A, these commands establish the reserved structure. The archive already includes it:

```bash
mkdir -p prisma public scripts docs src/types src/data/seeds
mkdir -p src/components/{layout,landing,ui,problems,editor,dashboard,roadmaps,admin}
mkdir -p src/features/{auth,problems,progress,roadmaps,submissions,admin}
mkdir -p src/lib/{supabase,validators}
mkdir -p src/app/{login,register,dashboard,mock-interview,interview-results,notes,profile,api}
mkdir -p 'src/app/problems/[slug]' 'src/app/roadmaps/[slug]'
mkdir -p 'src/app/admin/problems/new' 'src/app/admin/problems/[id]/edit'
```

The quotes around bracketed paths prevent your shell from interpreting square brackets as filename patterns. The braces expand into several folder names in macOS zsh and bash.

The archive uses empty `.gitkeep` files to preserve reserved folders when Git or an archive would otherwise omit them. They have no application behavior. If you create folders yourself, add an empty `.gitkeep` only where you need to preserve an otherwise empty folder. Do not add placeholder `page.tsx` files just to make every future URL load.

| Folder or file | What belongs here |
| --- | --- |
| `src/app/` | Next.js routes, layouts, page metadata, and global styles. |
| `src/components/layout/` | Branding and reusable page layout pieces. |
| `src/components/landing/` | Presentation specific to the home page. |
| `src/components/ui/` | Reserved for the full reusable UI system in Phase 4. |
| `src/features/` | Later domain logic grouped by feature, such as submissions or progress. |
| `src/lib/` | Shared configuration constants and small utilities. |
| `src/lib/supabase/` | Reserved for future browser/server Supabase clients. |
| `src/lib/validators/` | Reserved for future Zod schemas. |
| `src/types/` | Reserved for types shared across modules when they become necessary. |
| `prisma/` | Reserved for the database schema, migration history, and seed entry point. |
| `src/data/seeds/` | Reserved for original problem JSON, not UI component code. |
| `scripts/` | Reserved for future import, validation, and generation commands. |
| `public/` | Public static files, served directly from the URL root. |
| `.env.local` | Local environment values, never committed. |
| `.env.example` | Safe names and comments that explain configuration. |
| `docs/` | Explanations and milestone documentation. |

This structure gives later work a home without implementing it early. A folder is an organizational decision, not evidence that a feature exists.

## 🟨 5. Understand how the files connect

When you visit `/`, Next.js selects `src/app/page.tsx` and places its output inside the `children` position in `src/app/layout.tsx`. The root layout provides the HTML document, title, description, and global stylesheet. The page composes the header, content container, practice illustration, and footer.

| Module | Connects to | Reason for the connection |
| --- | --- | --- |
| `layout.tsx` | `constants.ts`, `globals.css` | Set site metadata and styles for every future route. |
| `page.tsx` | Layout components, practice preview, constants | Assemble the home page without repeating shared presentation. |
| `site-header.tsx` | Brand, container, navigation constants | Keep branding, page width, and links consistent. |
| `site-footer.tsx` | Brand and container | Reuse the same visual identity and spacing. |
| `container.tsx` | `utils.ts` | Merge a standard width and padding with caller-supplied classes. |
| `practice-preview.tsx` | `utils.ts`, Lucide icons | Render the fixed example with conditional highlighting. |
| `postcss.config.mjs` | Tailwind's PostCSS plugin | Transform the Tailwind import and theme declarations during the build. |

The public header and footer live in the home page rather than the root layout because a future dashboard needs its own app shell. The root layout remains a simple shared document wrapper.

All authored React components in this phase use the Server Component default. The page does not need React state, click handlers, or browser storage. The framework can therefore prepare its content during the build. Native links still scroll and navigate, and Next.js may ship JavaScript for framework components such as `Link`. We will add a focused client boundary when an actual feature needs state. See the [Next.js Server and Client Components guide](https://nextjs.org/docs/app/getting-started/server-and-client-components).

## 🟨 6. Read the implementation like an engineer

**`layout.tsx`: document-level behavior.** `Metadata` checks the shape of the title and description. The title template makes future page titles consistent. `ReactNode` describes values React can render as children. Importing `globals.css` here applies it throughout the application.

**`page.tsx`: composition.** The exported function returns JSX. JSX describes the UI; it is not an HTML string assembled by hand. Constants are rendered with `.map()`, and stable keys identify list items. The feature icon map is keyed by feature ID so reordering the content does not assign the wrong icon.

**`constants.ts`: public display data.** The name, navigation, approach, and planned features are defined in one place. `as const` gives the compiler readonly properties and specific literal types; it does not freeze an object at runtime. These arrays are landing-page copy, not the future database model or a substitute for validated seed files.

**`utils.ts`: class composition.** `cn()` passes its inputs through `clsx`, then `twMerge`. Conditional values can be omitted, and recognized conflicting utilities can be resolved. Tailwind class names appear in full in the source so its scanner can discover them. Avoid generating partial class names from string fragments.

**`container.tsx`: a reusable wrapper.** `ComponentPropsWithoutRef<"div">` lets the component accept the ordinary props of a `div`. Destructuring separates `className` and `children`; the remaining props are forwarded. Its standard maximum width and horizontal padding keep separate page sections aligned.

**Header and footer: semantic layout.** Native `header`, `nav`, and `footer` elements explain the page structure. The brand uses a Next.js `Link` to `/`; same-page navigation uses normal anchors with matching section IDs. Nothing points to an unimplemented login, dashboard, or problem route.

**`practice-preview.tsx`: one original illustration.** The fixed values are `[3, 1, 5, 2, 6, 1]`. The highlighted three-slot window starts at array index 2, which is human-readable slot 3. Its total is 13. The code block is an escaped React text value, displayed inside `pre` and `code`; it is never evaluated. The caption explains the selected slots with text, so color is not the only signal. Using an index as a key is acceptable for this fixed, never-reordered illustration; editable problem lists will use stable database IDs.

**`globals.css`: the visual system.** Dark surfaces, blue accents, amber focus outlines, and readable muted text are declared centrally. Tailwind v4 uses `@import "tailwindcss"` and CSS theme variables; the PostCSS plugin builds the final stylesheet. This project does not need a v3-style `tailwind.config.js` or `tailwindcss init -p` command. See [Tailwind's Next.js setup](https://tailwindcss.com/docs/installation/framework-guides/nextjs) and [theme variables](https://tailwindcss.com/docs/theme).

The baseline layout is a single column. Responsive classes introduce more columns and spacing as the viewport grows. `min-w-0`, wrapping navigation, and wrapping code text reduce overflow risk. Main body text starts at 16px; smaller text is limited to labels and secondary metadata. System fonts avoid an extra font service or font download during the build. Font appearance will vary slightly between operating systems.

The skip link lets a keyboard user move directly to the main content. Focus outlines make the current link visible. Decorative icons are hidden from assistive technology when adjacent text already explains them. Reduced-motion preferences disable smooth scrolling and transitions. These are implemented accessibility choices; the local browser checklist still needs to be performed on your device.

**Configuration files: shared expectations.** `tsconfig.json` enables strict checking, keeps application source in TypeScript, and defines the `@/` alias. TypeScript does not validate untrusted data at runtime; Zod will address that later. `eslint.config.mjs` keeps the scaffold's matching Next.js rules. `next.config.ts` deliberately keeps the normal server-capable defaults for the future full-stack app.

`package.json` names dependencies and executable scripts. `.nvmrc` identifies the agreed Node major version for version managers; `engines` documents the runtime expectation for package tools. `package-lock.json` records resolved packages. The scaffold's compatible development dependency ranges are preserved, and the lockfile records exactly what was used here.

## 🟥 7. Environment variables and boundaries

For Phase 1, `.env.local` can contain only the comments copied from `.env.example`. The landing page reads no environment variables. The future names are documented to establish conventions; leave them commented out until their phase needs them.

Place environment files beside `package.json`, outside `src/`. `.gitignore` excludes `.env*` and then explicitly permits `.env.example`. That exception keeps the safe template shareable while keeping actual local values out of Git.

Values prefixed with `NEXT_PUBLIC_` can be included in browser code. Such a prefix is a decision to make a value public, not a way to make a secret work. Keep database passwords, private tokens, service-role keys, and runner keys server-side. Also avoid passing those values through rendered props, API responses, or logs. Next.js documents the loading rules and public-variable behavior in its [environment variable guide](https://nextjs.org/docs/app/guides/environment-variables).

Prisma's command-line tools run outside the Next.js application runtime. In Phase 2, we must explicitly configure their environment loading; we cannot assume a future Prisma command automatically reads `.env.local` just because `next dev` does.

No code execution is implemented in this phase. In Phase 8 we will compare a clearly limited simulation, Judge0, and a separately isolated sandbox before choosing an implementation. `eval`, `new Function`, and a Web Worker alone are not an acceptable security boundary for arbitrary submitted code.

## 🟩 8. Run and check locally

From the project folder:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The terminal stays open while the server runs. Saving a file should refresh the page. Press **Control+C** in that terminal to stop it.

Run the quality checks:

```bash
npm run lint
npm run typecheck
npm run build
```

The typecheck script first generates Next.js route types, so it also works on a clean checkout before a build. The lint command invokes ESLint directly. A successful production build proves that the framework can compile and prerender this version; it does not prove every browser interaction works.

After the build succeeds, stop the development server and run:

```bash
npm run start
```

Open the same local address to inspect production mode. This serves your built application locally; it does not publish it. Stop it with Control+C when finished.

### Browser checklist

| Check | Expected result |
| --- | --- |
| Open `/` | AlgoSprint appears instead of the Next.js starter. |
| Inspect the browser tab | Title reads “AlgoSprint | Practice with purpose” and the chevron favicon appears. |
| Click each navigation and call-to-action link | It scrolls to its labeled section or returns home. |
| Read the practice illustration | It says it is static; the selected total is 13. |
| Resize to 320px and 390px widths | Text and controls remain usable, and the whole page does not scroll sideways. |
| Resize to tablet and desktop widths | Columns expand without collisions or clipped text. |
| Zoom to 200% | Navigation, labels, and body text remain readable and reachable. |
| Use Tab and Enter | The skip link appears on focus, outlines remain visible, and links activate. |
| Enable reduced motion in your OS | Navigation scrolls without the smooth animation. |
| Open browser developer tools | Investigate any application errors or missing files. |
| Visit an unimplemented route such as `/login` | A 404 is expected at this milestone. |

Do not add a test framework merely to assert that static text exists. When we introduce validation, authorization, or progress calculations, automated tests will have specific behavior to protect.

## 🟥 9. Common mistakes and fixes

| Symptom or mistake | What to do |
| --- | --- |
| `node: command not found` | Install Node.js 24 LTS and reopen Terminal. |
| npm says it cannot find `package.json` | Change into the actual `algosprint` folder. |
| `Module not found` after extracting the archive | Run `npm ci` in the project folder. |
| `npm ci` reports a lockfile mismatch after your edits | If your dependency changes are intentional, run `npm install` and commit the updated lockfile. |
| Port 3000 is busy | Stop your other server with Control+C or use `npm run dev -- --port 3001`. |
| The editor flags `@theme` as unknown CSS | Check the actual build result; Tailwind's directives need editor support. Do not replace the v4 setup with v3 instructions. |
| You added `useState` to a Server Component | Put the interactive part in a focused file with a client boundary; learn that boundary before changing the whole page. |
| You put `.env.local` inside `src/` | Move your local values beside `package.json` and restart the development server. |
| A future feature card looks clickable but has no action | Keep it as clearly labeled informational content until that feature exists. |
| You want to fill every reserved folder immediately | Complete the current milestone before adding another system to debug. |
| You are about to copy a platform's question or explanation | Write original content and test it independently instead. |

For a different development port:

```bash
npm run dev -- --port 3001
```

Then open [http://localhost:3001](http://localhost:3001).

## 🟩 10. Save your first Git checkpoint

This step creates a local history; it does not upload anything to GitHub. From the project folder:

```bash
git init -b main
git add .
git diff --cached --name-only
```

Review the staged filenames. You should see `.env.example`, application source, configuration, documentation, and the lockfile. You should not see `.env.local`, `node_modules`, or `.next`. If they appear, fix your ignore rules and unstage those files before committing.

Then create the checkpoint:

```bash
git commit -m "Build AlgoSprint Phase 1 foundation"
```

If Git asks you to configure your author identity, use your own name and preferred commit email. The scaffold's `AGENTS.md` and `CLAUDE.md` explain its installed Next.js conventions for coding assistants; keep them with the source.

## 🟪 11. Completion and the next phase

Phase 1 is complete locally when you can run the page, explain the file connections, use the navigation on desktop and mobile, and pass the three quality commands. To check your understanding, change the tagline in `APP_CONFIG`, observe the browser title, and explain why `layout.tsx` uses that value. Then change a theme token and identify the UI elements that reuse it.

The next learning milestone will be Phase 2: design the PostgreSQL/Prisma model, constraints, relationships, migrations, and the first validated original seed data. We have not built it in this deliverable.

## 🟩 12. Complete files

The following appendix contains the full contents of every application source file and authored configuration file, plus the README starter and generated scaffold instruction files. No application implementation is abbreviated. The complete `package-lock.json` is supplied as a file inside the project archive; npm generated it, so do not rewrite it by hand. Empty `.gitkeep` files contain no code. `.env.local` is intentionally excluded from the archive and is created using the copy command above.

### package.json

The package manifest and command definitions.

````json
{
  "name": "algosprint",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --max-warnings=0",
    "typecheck": "next typegen && tsc --noEmit"
  },
  "engines": {
    "node": ">=24 <25"
  },
  "dependencies": {
    "clsx": "2.1.1",
    "lucide-react": "1.45.0",
    "next": "16.3.5",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "tailwind-merge": "3.6.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.5",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
````

### tsconfig.json

TypeScript compiler settings and the source alias.

````json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
````

### eslint.config.mjs

The generated Next.js lint rules, retained for this version.

````javascript
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
````

### postcss.config.mjs

The Tailwind v4 PostCSS integration.

````javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
````

### next.config.ts

Normal Next.js defaults, ready for future server features.

````typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
````

### .nvmrc

The Node.js major version used by version managers.

````text
24
````

### .gitignore

Exclude local configuration, generated files, and installed dependencies.

````gitignore
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# env files (can opt-in for committing if needed)
.env*
!.env.example

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
````

### .env.example

A shareable template. Copy it to .env.local; no variables are required now.

````dotenv
# Phase 1 runs without credentials. Copy this file to .env.local.
# No environment variables are required by the landing page.
# Future names are documented here; leave them commented out for now.

# Phase 2: server-only PostgreSQL connection, including its password.
# DATABASE_URL=

# Phase 3: browser-safe Supabase project URL and publishable key.
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Phase 8: server-only runner credentials, if we choose Judge0.
# JUDGE0_API_URL=
# JUDGE0_API_KEY=

# Do not add a Supabase service-role key unless a specific server task needs it.
# Never put database passwords or private API keys behind NEXT_PUBLIC_.
````

### src/lib/constants.ts

Public app metadata and landing-page content.

````typescript
// Public display content only. Never import secrets into this module.
export const APP_CONFIG = {
  name: "AlgoSprint",
  tagline: "Practice with purpose",
  description:
    "An early preview of AlgoSprint: an original coding interview preparation platform built around deliberate practice and clear explanations.",
} as const;

// These links point to real sections on the current landing page.
export const LANDING_NAV = [
  { label: "The approach", href: "#approach" },
  { label: "Practice preview", href: "#practice-preview" },
  { label: "What's next", href: "#path-ahead" },
] as const;

export const PRACTICE_STEPS = [
  {
    number: "01",
    title: "Find the question inside the question.",
    description:
      "Start with the inputs, the constraints, and a small example. Understand what a correct answer needs to do.",
  },
  {
    number: "02",
    title: "Build an approach you can explain.",
    description:
      "Write down a first solution. Trace it by hand, spot repeated work, and look for a pattern that makes it simpler.",
  },
  {
    number: "03",
    title: "Carry the lesson forward.",
    description:
      "Check edge cases, explain the tradeoffs, and revisit what challenged you. Make the next unfamiliar problem feel more familiar.",
  },
] as const;

export const PLANNED_FEATURES = [
  {
    id: "collection",
    title: "An original problem collection",
    description:
      "Begin with five carefully checked challenges, then grow the collection as the content and testing tools mature.",
    label: "Planned · problems and hints",
  },
  {
    id: "progress",
    title: "A record of how you learn",
    description:
      "Keep notes, revisit tricky questions, and see which topics deserve another practice session.",
    label: "Planned · accounts and progress",
  },
  {
    id: "preparation",
    title: "Preparation with direction",
    description:
      "Follow original learning paths and, later, put your reasoning into words in timed interview practice.",
    label: "Planned · roadmaps and interviews",
  },
] as const;
````

### src/lib/utils.ts

Reusable Tailwind class composition.

````typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// clsx handles conditional classes; twMerge resolves conflicting utilities.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
````

### src/components/layout/container.tsx

Consistent page width and padding.

````tsx
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export function Container({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12", className)}
      {...props}
    >
      {children}
    </div>
  );
}
````

### src/components/layout/brand.tsx

The reusable brand and home link.

````tsx
import Link from "next/link";
import { ChevronsRight } from "lucide-react";
import { APP_CONFIG } from "@/lib/constants";

export function Brand() {
  return (
    <Link
      href="/"
      aria-label={`${APP_CONFIG.name} home`}
      className="inline-flex min-h-11 shrink-0 items-center gap-3 rounded-lg"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-accent text-canvas">
        <ChevronsRight aria-hidden="true" size={25} strokeWidth={2.5} />
      </span>
      <span className="text-xl font-bold tracking-tight">{APP_CONFIG.name}</span>
    </Link>
  );
}
````

### src/components/layout/site-header.tsx

Responsive navigation to actual page sections.

````tsx
import { Brand } from "@/components/layout/brand";
import { Container } from "@/components/layout/container";
import { LANDING_NAV } from "@/lib/constants";

export function SiteHeader() {
  return (
    <header className="border-b border-line/70">
      <Container className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-5">
        <Brand />
        <span className="rounded-full border border-line px-3 py-1.5 font-mono text-xs text-muted lg:order-last">
          EARLY PREVIEW
        </span>
        <nav aria-label="Main navigation" className="flex w-full flex-wrap gap-x-5 gap-y-1 lg:w-auto lg:gap-x-8">
          {LANDING_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 items-center rounded-md text-sm text-muted transition-colors hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </Container>
    </header>
  );
}
````

### src/components/layout/site-footer.tsx

Shared footer branding.

````tsx
import { Brand } from "@/components/layout/brand";
import { Container } from "@/components/layout/container";

export function SiteFooter() {
  return (
    <footer className="border-t border-line/70 py-8">
      <Container className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
        <Brand />
        <p className="text-sm text-muted">One problem. One insight. Another step forward.</p>
      </Container>
    </footer>
  );
}
````

### src/components/landing/practice-preview.tsx

A static, original practice example; no execution or database logic.

````tsx
import { Braces, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";

// An original, fixed illustration for the landing page, not a database record.
const RELAY_LOADS = [3, 1, 5, 2, 6, 1] as const;
const WINDOW_START = 2;
const WINDOW_WIDTH = 3;
const EXAMPLE_CODE = `const loads = [3, 1, 5, 2, 6, 1];
const width = 3;

// Which three consecutive relays
// carry the largest total load?`;

export function PracticePreview() {
  return (
    <section
      id="practice-preview"
      aria-labelledby="preview-title"
      className="preview-surface min-w-0 rounded-3xl border border-line"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-7">
        <span className="inline-flex items-center gap-2 font-mono text-sm text-muted">
          <Braces aria-hidden="true" size={18} />
          A closer look
        </span>
        <span className="text-xs text-muted">Static practice example</span>
      </div>
      <div className="p-5 sm:p-7">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1 text-accent">
            Easy
          </span>
          <span className="text-muted">Arrays / Sliding window</span>
        </div>
        <h2 id="preview-title" className="text-2xl font-semibold tracking-tight">Relay Window</h2>
        <p className="mt-3 leading-7 text-muted">
          A relay station records a load for each time slot. Find the largest
          total load across any three consecutive slots.
        </p>
        <figure className="mt-6">
          <div className="grid grid-cols-6 gap-1.5 sm:gap-2" aria-hidden="true">
            {RELAY_LOADS.map((load, index) => {
              const inWindow = index >= WINDOW_START && index < WINDOW_START + WINDOW_WIDTH;
              return (
                <div
                  key={index}
                  className={cn(
                    "grid aspect-square place-items-center rounded-lg border border-line bg-canvas font-mono text-lg text-muted sm:text-xl",
                    inWindow && "border-accent bg-accent/15 font-semibold text-accent",
                  )}
                >
                  {load}
                </div>
              );
            })}
          </div>
          <figcaption className="mt-3 flex items-start gap-2 text-sm leading-6 text-accent">
            <ScanLine aria-hidden="true" size={18} className="mt-1 shrink-0" />
            <span>
              <span className="sr-only">Loads: 3, 1, 5, 2, 6, 1. </span>
              Best window: slots 3–5. Total: 5 + 2 + 6 = 13.
            </span>
          </figcaption>
        </figure>
        <div className="mt-6 min-w-0 rounded-xl border border-line bg-canvas">
          <div className="border-b border-line px-4 py-2.5 font-mono text-xs text-muted">
            relay-window.ts · read-only
          </div>
          <pre className="whitespace-pre-wrap break-words p-4 font-mono text-sm leading-7 text-ink">
            <code>{EXAMPLE_CODE}</code>
          </pre>
        </div>
        <p className="mt-5 border-l-2 border-warm pl-4 text-sm leading-6 text-muted">
          A question to carry with you: when the window moves one slot, which values actually change?
        </p>
      </div>
    </section>
  );
}
````

### src/app/globals.css

Global theme, focus treatment, and responsive component styles.

````css
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
````

### src/app/layout.tsx

The document wrapper and site metadata.

````tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { APP_CONFIG } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${APP_CONFIG.name} | ${APP_CONFIG.tagline}`,
    template: `%s | ${APP_CONFIG.name}`,
  },
  description: APP_CONFIG.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
````

### src/app/page.tsx

The complete landing page.

````tsx
import { ArrowDownRight, ArrowRight, BookOpen, Compass, NotebookPen } from "lucide-react";
import { Container } from "@/components/layout/container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { PracticePreview } from "@/components/landing/practice-preview";
import { PLANNED_FEATURES, PRACTICE_STEPS } from "@/lib/constants";

const FEATURE_ICONS = {
  collection: BookOpen,
  progress: NotebookPen,
  preparation: Compass,
} as const;

export default function HomePage() {
  return (
    <>
      <a href="#main-content" className="sr-only z-50 rounded-lg bg-warm p-4 font-semibold text-canvas focus:fixed focus:top-4 focus:left-4 focus:not-sr-only">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <Container className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-24">
          <div className="min-w-0">
            <p className="eyebrow text-accent">Coding practice, with purpose</p>
            <h1 className="mt-6 text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.1] font-bold tracking-[-0.045em]">
              Think it through.
              <span className="mt-1 block text-accent">Then make it run.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
              Build the reasoning behind the solution. AlgoSprint is taking
              shape as a home for original challenges, thoughtful explanations,
              and a practice habit that lasts.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a href="#practice-preview" className="action-link action-link-primary">
                See a practice example
                <ArrowDownRight aria-hidden="true" size={19} />
              </a>
              <a href="#approach" className="action-link action-link-secondary">Explore the approach</a>
            </div>
            <p className="mt-5 text-sm leading-6 text-muted">
              An early look. The problem library and practice tools are in development.
            </p>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-line/70 pt-6 font-mono text-sm text-muted">
              <span>Understand the pattern</span>
              <span className="text-warm">Explain the tradeoff</span>
            </div>
          </div>
          <PracticePreview />
        </Container>
        <section id="approach" aria-labelledby="approach-title" className="border-y border-line/70 bg-surface/50 py-16 sm:py-20">
          <Container>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="eyebrow text-warm">The practice loop</p>
                <h2 id="approach-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Make every attempt teach you something.
                </h2>
              </div>
              <p className="max-w-sm leading-7 text-muted">
                A repeatable way to approach a problem, even when you do not know where to start.
              </p>
            </div>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {PRACTICE_STEPS.map((step) => (
                <li key={step.number} className="rounded-2xl border border-line bg-canvas/60 p-6 transition-colors hover:border-accent/60">
                  <span className="font-mono text-sm text-warm">{step.number}</span>
                  <h3 className="mt-5 text-xl leading-7 font-semibold">{step.title}</h3>
                  <p className="mt-3 leading-7 text-muted">{step.description}</p>
                </li>
              ))}
            </ol>
          </Container>
        </section>
        <section id="path-ahead" aria-labelledby="future-title" className="py-16 sm:py-20">
          <Container>
            <p className="eyebrow text-lilac">The path ahead</p>
            <h2 id="future-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Small beginnings. Room to grow.
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-muted">
              These features are planned. This preview introduces the direction;
              the learning tools will arrive in stages.
            </p>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {PLANNED_FEATURES.map((feature) => {
                const Icon = FEATURE_ICONS[feature.id];
                return (
                  <article key={feature.id} className="border-t border-line pt-6">
                    <Icon aria-hidden="true" size={25} className="text-lilac" />
                    <h3 className="mt-4 text-xl font-semibold">{feature.title}</h3>
                    <p className="mt-3 leading-7 text-muted">{feature.description}</p>
                    <p className="mt-5 text-sm text-accent">{feature.label}</p>
                  </article>
                );
              })}
            </div>
            <a href="#practice-preview" className="mt-10 inline-flex min-h-11 items-center gap-2 rounded-md font-medium text-accent hover:text-accent-strong">
              Back to the practice example
              <ArrowRight aria-hidden="true" size={18} />
            </a>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
````

### src/app/icon.svg

The simple site-specific favicon.

````svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="18" fill="#8ab4ff" />
  <path d="m15 19 13 13-13 13m20-26 13 13-13 13" fill="none" stroke="#090d16" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
</svg>
````

### next-env.d.ts

Generated by Next.js. Included for completeness; let the framework manage it.

````typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />
import "./.next/types/routes.d.ts";
import "./.next/types/root-params.d.ts";

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
````

### AGENTS.md

Generated scaffold guidance for coding assistants; preserved unchanged.

````markdown
<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
````

### CLAUDE.md

Generated reference to the shared scaffold guidance; preserved unchanged.

````markdown
@AGENTS.md
````

### README.md

The complete project README starter.

````markdown
# AlgoSprint

An original coding interview preparation platform, built incrementally with Next.js, React, TypeScript, and Tailwind CSS.

## 🟦 Current milestone: Phase 1

This version implements the local project foundation and landing page. It includes shared layout components, a dark theme, responsive CSS, keyboard navigation, a static original practice illustration, public constants, environment documentation, and reserved folders for later phases.

Only `/` is an implemented application page. The favicon is generated from `src/app/icon.svg`. Other feature folders are empty reservations; they do not create working routes. The practice illustration cannot accept or execute code. No accounts, database, user progress, or production deployment exist in this version.

## 🟩 Run locally

Install Node.js 24 LTS with npm from [Node.js](https://nodejs.org/en/download). From this project folder:

```bash
node --version
npm --version
npm ci
cp .env.example .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000). Keep the terminal running; press Control+C to stop it. If you already have a configured `.env.local`, keep it instead of copying over it. An empty `.env.local` is also valid in Phase 1.

For a fresh bootstrap without this archive, use the exact commands in `docs/PHASE-1-GUIDE.md`.

## 🟩 Check the project

```bash
npm run lint
npm run typecheck
npm run build
npm run start
```

Run `start` after a successful `build`, with any development server on port 3000 stopped. It runs the production build locally; it does not deploy the project.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server with automatic refresh. |
| `npm run lint` | Check source using the Next.js ESLint rules; reject lint warnings. |
| `npm run typecheck` | Generate Next.js route types and check TypeScript without emitting JavaScript. |
| `npm run build` | Create an optimized production build. |
| `npm run start` | Serve the completed production build locally. |

Check navigation links, visible keyboard focus, the skip link, small screens, and 200% browser zoom. The full manual checklist is in the phase guide.

## 🟨 How the code is organized

| Path | Responsibility |
| --- | --- |
| `src/app/layout.tsx` | HTML document, global stylesheet, and shared page metadata. |
| `src/app/page.tsx` | Compose the landing page from components and display constants. |
| `src/app/globals.css` | Tailwind v4 theme tokens, base accessibility styles, and reusable link styles. |
| `src/app/icon.svg` | Original simple favicon matching the site colors. |
| `src/components/layout/` | Brand, content container, header, and footer. |
| `src/components/landing/` | Read-only landing-page practice illustration. |
| `src/lib/constants.ts` | Public app name, navigation, and landing-page copy. |
| `src/lib/utils.ts` | `cn()` for composing Tailwind class names. |
| `src/features/` | Reserved domain folders for future application logic. |
| `prisma/` | Reserved for Phase 2 schema, migrations, and seed code. |
| `src/data/seeds/` | Reserved for validated original seed content. |
| `scripts/` | Reserved for future import and content tools. |
| `docs/PHASE-1-GUIDE.md` | Complete walkthrough, source listings, commands, and local checks. |

The public header and footer are composed in the landing page, so future dashboard layouts can use their own app shell. The root layout stays shared. Application source uses TypeScript and the `@/` alias maps to `src/`.

## 🟨 Dependencies

Runtime dependencies are `next`, `react`, `react-dom`, `lucide-react`, `clsx`, and `tailwind-merge`. Development dependencies are TypeScript, the React/Node type packages, ESLint with the matching Next.js configuration, Tailwind CSS, and its PostCSS plugin.

`package-lock.json` records the resolved dependency tree. Commit it. Use `npm ci` when reproducing this version and `npm install` when intentionally changing dependencies. `.nvmrc` and `package.json` align this project on Node.js 24.

Prisma, Supabase, Zod, Monaco, charts, and a runner will be installed in the phases that first use them.

## 🟥 Environment and security

- `.env.local` belongs at the project root and is ignored by Git.
- `.env.example` is a shareable, credential-free template and is explicitly allowed by `.gitignore`.
- Phase 1 requires no environment variables. All future names in the template are commented out.
- `NEXT_PUBLIC_` values may be exposed to the browser. Never use this prefix for database passwords, service-role keys, or runner secrets.
- Server-only naming does not stop a developer from accidentally exposing a secret through a response or prop; review those boundaries when backend work begins.
- Do not run untrusted code with `eval`, `new Function`, or child processes on the application server. A browser mock will not be treated as a security sandbox.
- Supabase authentication and server-side authorization will be implemented in Phase 3. Empty admin folders provide no authorization and are not working admin pages.

## 🟪 Next milestone

Phase 2 will define the PostgreSQL/Prisma data model, relationships, constraints, migrations, and initial validated seed content. Complete the Phase 1 local checklist before starting it. Deployment remains in Phase 16.

The content target grows from 5 to 20 to 100 and eventually 1,000 reviewed problems. Those are future targets, not counts of content currently implemented.

## 🟥 Content provenance

The AlgoSprint page copy, layout, Relay Window wording, and theme were authored for this project. General algorithmic concepts may be shared with other learning resources; do not copy another platform's statements, hints, explanations, roadmap structure, branding, or interface. Dependencies retain their own licenses.
````

## 🟩 13. Validation record

The delivered source was checked in the build environment using Node.js 24.19.0. These are completed checks, separate from the browser checklist you will perform locally.

| Check | Result | What it establishes |
| --- | --- | --- |
| ESLint | Passed with no lint warnings | The source satisfies the configured framework lint rules. |
| TypeScript and generated route types | Passed | The checked code and routes typecheck. |
| Production build | Passed | Next.js successfully compiles and prerenders the home page. |
| Generated HTML inspection | Passed | One main heading, unique IDs, and seven valid section links. |
| Static illustration arithmetic | Passed | The largest three-slot total in the displayed input is 13. |
| Lockfile consistency | Passed | The root dependency declarations and Node engine match the lockfile. |
| Desktop/mobile browser interaction | Not run here | Perform the local checklist; compilation is not visual verification. |

The build lists `/`, the framework's not-found page, and `/icon.svg`. Empty feature folders are not implemented routes. A live browser preview and production deployment are not included in Phase 1.

### Resolved direct dependencies in this version

| Package | Installed version |
| --- | --- |
| `clsx` | `2.1.1` |
| `lucide-react` | `1.45.0` |
| `next` | `16.3.5` |
| `react` | `19.2.8` |
| `react-dom` | `19.2.8` |
| `tailwind-merge` | `3.6.0` |
| `@tailwindcss/postcss` | `4.3.3` |
| `@types/node` | `20.19.43` |
| `@types/react` | `19.3.0` |
| `@types/react-dom` | `19.3.0` |
| `eslint` | `9.39.5` |
| `eslint-config-next` | `16.3.5` |
| `tailwindcss` | `4.3.3` |
| `typescript` | `5.9.3` |

### Reserved folders

Each listed folder contains an empty `.gitkeep` file and no implementation. Parent paths may also contain the active files described above.

| Reserved path | Current state |
| --- | --- |
| `prisma/` | Reserved |
| `public/` | Reserved |
| `scripts/` | Reserved |
| `src/app/admin/problems/[id]/edit/` | Reserved |
| `src/app/admin/problems/new/` | Reserved |
| `src/app/api/` | Reserved |
| `src/app/dashboard/` | Reserved |
| `src/app/interview-results/` | Reserved |
| `src/app/login/` | Reserved |
| `src/app/mock-interview/` | Reserved |
| `src/app/notes/` | Reserved |
| `src/app/problems/[slug]/` | Reserved |
| `src/app/profile/` | Reserved |
| `src/app/register/` | Reserved |
| `src/app/roadmaps/[slug]/` | Reserved |
| `src/components/admin/` | Reserved |
| `src/components/dashboard/` | Reserved |
| `src/components/editor/` | Reserved |
| `src/components/problems/` | Reserved |
| `src/components/roadmaps/` | Reserved |
| `src/components/ui/` | Reserved |
| `src/data/seeds/` | Reserved |
| `src/features/admin/` | Reserved |
| `src/features/auth/` | Reserved |
| `src/features/problems/` | Reserved |
| `src/features/progress/` | Reserved |
| `src/features/roadmaps/` | Reserved |
| `src/features/submissions/` | Reserved |
| `src/lib/supabase/` | Reserved |
| `src/lib/validators/` | Reserved |
| `src/types/` | Reserved |
