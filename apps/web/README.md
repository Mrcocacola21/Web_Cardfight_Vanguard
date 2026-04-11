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
- dark-first theme foundation in `src/app/globals.css`:
  - CSS variable tokens are the source of truth for color, radius, and base typography
  - Tailwind utilities resolve through semantic tokens such as `background`, `card`, `primary`, `muted`, and `success`
  - light-theme switching is intentionally not implemented yet
- layout system foundation in `src/components/layout`:
  - `PageContainer` centralizes content widths and horizontal gutters
  - `DashboardPageLayout` is the standard list/panel pattern
  - `DetailPageLayout` is the standard header + main + optional aside pattern
  - auth, profile, public profile, catalog, and decks screens now consume the shared layout primitives
- shared feedback components in `src/components/feedback`:
  - `LoadingState`, `EmptyState`, `ErrorState`, and `SuccessState`
  - route fallbacks and compact form-level success/error messages now use the same feedback surface
  - feedback components stay presentation-only and do not own retry or business logic
- shared data-display components in `src/components/data-display`:
  - `ItemCard`, `StatBlock`, and `StatGrid` standardize record summaries and compact metrics
  - `SearchBar`, `FilterBar`, `FilterSelect`, and `FilterChip` stay presentational and do not own query-state orchestration
  - badge usage remains semantic through shared variants such as `secondary`, `accent`, `success`, `warning`, and `outline`
- Supabase integration foundation in `src/lib/supabase`:
  - `browser.ts` for client-side usage
  - `server.ts` for App Router server-side usage
  - `route-handler.ts` for server-managed auth callback exchanges
  - `config.ts` for env access
- initial server-side catalog read flow:
  - `/catalog`
  - `/catalog/[cardKey]`
  - `/catalog/printings/[printingKey]`
  - `/catalog/products/[productKey]`
  - `/catalog` is now a real entity-centric card list page
  - supported list capabilities: text search, format-aware `era` / `nation` / `clan` / `type` / `trigger` / `rarity` / `set` filters, a small sort set, and URL-aware page pagination
  - search params are interpreted through `@web-vg/catalog`, then loaded through `@web-vg/db` repositories
  - format-aware filtering is first-class: `standard` keeps nation-led filtering, while `v-premium` and `premium` switch the active identity filter toward clans
  - `era` filters map to product-family lineage, while `rarity` and `set` stay printing-derived and then flow back to canonical card entities
  - data loads through repositories, not UI-level queries
  - printings remain detail-level data; the list route does not collapse card entities and printings into one surface
  - `/catalog/[cardKey]` is now a canonical-card-centric detail page
  - detail sections currently cover core stats, rules references, printings, legality facts, and related products
  - the detail route stays entity-first; printings remain subordinate concrete editions rather than becoming the page identity
  - `/catalog/printings/[printingKey]` is now an explicit printing-centric detail page
  - printing detail shows one concrete edition with release metadata, a canonical card link, and sibling printings of the same card
  - `/catalog/products/[productKey]` is now a product-centric release page
  - product detail currently covers release info and a printing list with links to both printing detail and canonical card detail
  - the product route stays release-first; printings remain subordinate concrete editions, and canonical cards stay linked from those printings
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
- protected application shell baseline:
  - applies to the protected route group
  - desktop sidebar + top header + mobile drawer navigation
  - shared navigation items: `Home`, `Catalog`, `Decks`, `Profile`
  - shell stays UI-only and does not load repository/business data
- initial decks read-side foundation:
  - `/decks`
  - `/decks/[deckId]`
  - current profile deck list via server-side repository reads
  - deck detail with explicit format attachment and sectioned composition
  - no builder writes or legality/gameplay coupling yet
- route protection baseline:
  - public routes: `/`, `/catalog`, `/catalog/[cardKey]`, `/catalog/printings/[printingKey]`, `/catalog/products/[productKey]`, `/login`, `/register`, `/auth/callback`, `/users/[profileId]`
  - protected routes: `/profile`, `/decks`, `/decks/[deckId]`
  - protection lives in App Router route-group layouts backed by server-side auth guards
  - unauthenticated access redirects to `/login`
- baseline owner-based authorization and RLS:
  - `user_data.profiles` stay owner-readable/writable at the base table
  - public profile reads resolve through a public-safe projection instead of exposing raw profile rows
  - `decks`, `collections`, `matches`, and their subordinate rows are owner-only by default
  - advanced sharing and friend-based visibility are still intentionally deferred

Environment:

- Copy `apps/web/.env.example` to `apps/web/.env.local` when you need Supabase-backed development.
- Current foundation requires only:
  - `NEXT_PUBLIC_APP_ORIGIN`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Service-role and repository-layer concerns are intentionally not part of this step.

Intentionally not implemented yet:

- write-side Supabase feature flows;
- advanced sharing and richer per-resource visibility;
- friends-only profile visibility;
- password reset flows;
- magic-link and multi-provider auth;
- avatar upload/storage;
- social graph features;
- extraction into `packages/ui`;
- domain feature flows.
