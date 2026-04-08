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
- Supabase integration foundation in `src/lib/supabase`:
  - `browser.ts` for client-side usage
  - `server.ts` for App Router server-side usage
  - `route-handler.ts` for server-managed auth callback exchanges
  - `config.ts` for env access
- initial server-side catalog read flow:
  - `/catalog`
  - `/catalog/[cardKey]`
  - data loads through `@web-vg/db` repositories, not UI-level queries
- initial profile read/write foundation:
  - `/profile`
  - protected own-profile page
  - current profile read via server-side session lookup
  - profile save via server action + repository layer
  - supported fields: `display_name`, `avatar_url`, `bio`, `visibility`
  - visibility control supports `public` and `private`
  - new profiles now default to `private`
- initial public profile foundation:
  - `/users/[profileId]`
  - public server-side read through repository layer
  - public fields only: `display_name`, `avatar_url`, `bio`
  - non-public profiles resolve through Next.js not-found handling for non-owners
  - owners can still resolve their own profile through the public route for parity checks
  - future extension slots reserved for friends, decks, and activity
- initial auth/session foundation:
  - `/login`
  - `/register`
  - `/auth/callback`
  - email/password sign in and registration via Supabase Auth
  - SSR-friendly current-user lookup through server helpers
  - `proxy.ts` refresh path for App Router cookie/session consistency
  - email confirmation redirects complete through the server-side callback path
  - minimal sign-out action from the profile page
  - authenticated users are redirected away from auth pages to `/profile`
  - registration auto-creates the application profile baseline
- initial decks read-side foundation:
  - `/decks`
  - `/decks/[deckId]`
  - current profile deck list via server-side repository reads
  - deck detail with explicit format attachment and sectioned composition
  - no builder writes or legality/gameplay coupling yet
- route protection baseline:
  - public routes: `/`, `/catalog`, `/catalog/[cardKey]`, `/login`, `/register`, `/auth/callback`, `/users/[profileId]`
  - protected routes: `/profile`, `/decks`, `/decks/[deckId]`
  - protection lives in App Router route-group layouts backed by server-side auth guards
  - unauthenticated access redirects to `/login`

Environment:

- Copy `apps/web/.env.example` to `apps/web/.env.local` when you need Supabase-backed development.
- Current foundation requires only:
  - `NEXT_PUBLIC_APP_ORIGIN`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Service-role and repository-layer concerns are intentionally not part of this step.

Intentionally not implemented yet:

- write-side Supabase feature flows;
- per-resource authorization;
- friends-only profile visibility;
- password reset flows;
- magic-link and multi-provider auth;
- avatar upload/storage;
- social graph features;
- extraction into `packages/ui`;
- domain feature flows.
