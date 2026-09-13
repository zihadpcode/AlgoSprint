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
