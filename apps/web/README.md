# apps/web

Purpose:

- Own the top-level application and composition layer.
- Provide the Next.js frontend shell for the monorepo.

Expected ownership:

- route and page composition;
- app-level orchestration;
- thin API-facing entry points when introduced;
- presentation wiring across bounded packages.
- app-local UI composition and app-local utilities that do not become domain owners.

Must not own:

- catalog truth;
- deck legality semantics;
- gameplay logic;
- importer workflow logic.
- shared domain contracts that belong in packages.

Dependency expectation:

- May depend on public surfaces from packages.
- Must not become the place where domain rules are redefined locally.

Current foundation:

- Next.js with App Router;
- TypeScript;
- `src/`-based app structure;
- `@/*` alias mapped to `src/*`.
- Tailwind CSS v4;
- shadcn/ui with app-local generated components in `src/components/ui`.

Intentionally not implemented yet:

- product routes;
- auth;
- data integration;
- extraction into `packages/ui`;
- domain feature flows.
