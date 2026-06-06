# Web_VG

Monorepo for a Cardfight!! Vanguard web client / companion platform.

The repository contains a working catalog with multi-wave Standard content, an
importer -> publication content pipeline with semantic enrichment, baseline
auth/RLS, the first real deck builder workflow, format-aware deck validation
with profile-driven baseline rules, DB-backed atomic deck persistence and
dense owner-scoped deck reads, an explicit application-layer separation across
features, a social foundation on top of the profile layer, and an owner-owned
match history / stats foundation. The gameplay stack now includes a bounded
rules runtime, local match-session prototype, hidden-information projection,
session serialization/history, and transport-facing realtime runtime contracts.

## Prerequisites

- Node.js `20.9+`
- Corepack enabled, or `pnpm 10.x` installed globally
- Git
- Docker Desktop or another container runtime if you plan to run local
  Supabase / `test:db`

If you do not have `pnpm` installed globally, use `corepack pnpm ...` in the
commands below.

## Install

```bash
git clone <repo-url>
cd Web_VG
corepack enable
corepack pnpm install
```

If you want to use the Supabase integration foundation later, copy
`apps/web/.env.example` to `apps/web/.env.local` and set:

- `NEXT_PUBLIC_APP_ORIGIN`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Run Locally

Start local Supabase, then the web app:

```bash
corepack pnpm dev:up
corepack pnpm dev
```

Open `http://localhost:3000`.

The canonical local Docker workflow is documented in
[`docs/dev/local-run.md`](docs/dev/local-run.md).

## Common Commands

```bash
# Start the web app
corepack pnpm dev

# Start local Supabase containers
corepack pnpm dev:up

# Stop local Supabase containers without deleting data
corepack pnpm dev:down

# Show local Supabase status
corepack pnpm dev:status

# Show local Supabase logs
corepack pnpm dev:logs

# Follow local Supabase logs
corepack pnpm dev:logs:follow

# Restart local Supabase containers
corepack pnpm dev:restart

# Reset the local DB to migrations + seed
corepack pnpm dev:reset

# Reset local Supabase data and recreate the stack
corepack pnpm dev:hard-reset

# Build the web app
corepack pnpm --filter @web-vg/web build

# Run repo-wide linting
corepack pnpm lint

# Run repo-wide type checking
corepack pnpm typecheck

# Format the repo
corepack pnpm format

# Check formatting without writing changes
corepack pnpm format:check

# Run package unit tests
corepack pnpm test:unit

# Run web component tests
corepack pnpm test:web

# Run the default fast test suite
corepack pnpm test

# Run DB-backed repository / RLS checkpoints against local Supabase
# starts local Supabase services and resets the local DB
corepack pnpm test:db

# Run Playwright e2e
corepack pnpm test:e2e

# Run the local auth runtime checkpoint
corepack pnpm test:auth:e2e

# Run the local deck-builder runtime checkpoint
corepack pnpm test:decks:e2e

# Seed a local dev dataset
# requires DATABASE_URL or SUPABASE_DB_URL
corepack pnpm db:seed

# Generate DB types from the current schema
# uses local Supabase DB when running, otherwise DATABASE_URL / SUPABASE_DB_URL
corepack pnpm db:types:generate

# Run the dev JSON importer path against a local fixture
corepack pnpm importer:dev-json -- ./packages/importer/fixtures/dev-json/sample-standard-with-review.json
```

## Repository Layout

- `apps/web` - Next.js frontend app
- `packages/*` - domain and infrastructure packages
- `scripts/` - pipeline runner and expansion scripts
- `supabase/` - Supabase config, migrations, seeds, and SQL snippets
- `docs/` - product, engineering, architecture, and domain documents

Current package set:

- `packages/ui`
- `packages/db`
- `packages/shared`
- `packages/catalog`
- `packages/decks`
- `packages/deck-validation`
- `packages/importer`
- `packages/legality`
- `packages/rules-core`
- `packages/match-session`
- `packages/social`

Import boundaries are lint-enforced:

- import workspace packages only through their root API, for example
  `@web-vg/catalog`
- do not deep import through another package's `src/*`
- package-to-package dependencies must follow the bounded-context rules in the
  repo

## Commit Quality

Pre-commit uses Husky + lint-staged. On staged files, it runs:

- Prettier
- ESLint with autofix

Full repo-wide checks such as build, test, and typecheck are not part of
pre-commit.

## Test Baseline

Current test setup:

- Vitest for package/domain unit tests
- Vitest + React Testing Library for `apps/web`
- DB-backed local Supabase checkpoint verification through
  `corepack pnpm test:db`
- Playwright for local runtime/browser checkpoints

Current practical coverage is strongest around:

- catalog read-side and publication-related repository/service flows
- importer pipeline and publication lifecycle checkpoints
- auth/profile baseline
- social foundation and protected profile/public-profile flows
- deck domain, deck builder UI, autosave, and metadata flows
- deck validation core, format-aware baseline rules, and integration tests
- gameplay engine actions/transitions/effects/format adapters
- match room/session lifecycle and local playable match UI flow
- match-session projection, serialization/history, realtime command runtime,
  and timer/timeout contracts
- deck DB persistence hardening:
  - atomic write RPC coverage
  - dense summary/detail read RPC coverage
  - owner-scoped RLS and deck ownership invariant checks
- owner-owned match history, filters, and stats aggregation
- printing-level collection inventory, wishlist, and favorite workflows

The browser/runtime layer is still lighter than unit/component coverage and is
best treated as checkpoint confidence, not a full e2e matrix. The DB checkpoint
suite is stronger for persistence invariants than for end-to-end UI behavior.

## Current Status

This README reflects the current repository state, not the final product.

Available now:

- monorepo/workspace foundation
- `apps/web` app shell
- shared layout / feedback / data-display primitives
- Supabase browser/server client foundation
- SSR-friendly auth/session foundation
- baseline owner-based authorization and RLS for profiles, decks, collections,
  and matches
- protected and public profile surfaces
- social foundation:
  - public user search at `/users`
  - public profile route at `/users/[profileId]`
  - friends dashboard at `/friends`
  - explicit friend requests
  - accept / decline request lifecycle
  - explicit active friendship edges
  - controlled friendship removal
  - privacy flags baseline across public / friends / owner-only profile reads
- match history and stats foundation:
  - match history at `/matches`
  - manual match entry at `/matches/new`
  - personal stats at `/matches/stats`
  - friend-opponent stats at `/matches/friends`
  - owner-owned match records linked to persisted deck versions
  - opponent linkage through the app-facing profile surface
  - result / played date / notes storage for manual match records
  - protected list filters, personal stats, and friend-scoped stats slices
- catalog read-side:
  - `/catalog`
  - `/catalog/[cardKey]`
  - `/catalog/printings/[printingKey]`
  - `/catalog/products/[productKey]`
  - structured keyword/mechanics tags on card detail
  - printing-level variant semantics (art variant, alternate art, promo flags)
- importer stack:
  - tracked `import_sources` / `import_jobs`
  - raw import
  - normalization
  - manual review queue
  - explicit publication into catalog truth
- multi-wave Standard content expansion:
  - wave-1 seed products, entities, and printings
  - curated D / DZ Keter Sanctuary expansion
    (D-SD03, D-BT04, D-BT08, DZ-BT01, DZ-BT02, DZ-SS05)
  - additional standard products expansion (DZ-LBT01)
  - booster-by-booster expansion pipeline
  - semantic data enrichment
    (keywords, restriction provenance, printing variants)
  - canonical bootstrap SQL snippets + choice restriction overlays
- published catalog content with:
  - products
  - card entities
  - printings
  - legality/restriction data
  - keyword/mechanics data
- deck foundation:
  - deck list at `/decks`
  - create deck flow at `/decks/create`
  - deck builder at `/decks/[deckId]`
  - entity-based deck composition
  - add/remove/quantity controls
  - draft state + autosave
  - metadata editing
- deck persistence infrastructure:
  - atomic create/save through `user_data.save_deck_aggregate(...)`
  - dense deck summary/detail reads through DB-backed aggregate RPCs
  - DB-enforced owner-scoped deck root/version/card access
  - immutable ownership/version-link invariants at the Postgres layer
- deck validation:
  - `packages/deck-validation` with format-aware validation pipeline
  - common, standard, premium, and V-Premium rule sets
  - profile-driven format-aware baseline rules (deck size, copy limits)
  - runtime `format.profile` hydration through builder validation data
  - Premium section qualification facts (G-deck eligibility)
  - restriction-list validation
  - validation UI panel in the deck builder
  - focused integration tests for profile-aware and Premium runtime behavior
- gameplay rules foundation:
  - `packages/rules-core` as a clean domain-first gameplay engine package
  - explicit `GameState` / `PlayerState` / `ZoneState` contracts
  - action, event, request, and deterministic transition foundation
  - engine/UI validation boundary with structured accepted/invalid/blocked results
  - Standard, Premium, and V-Premium format adapters with shared hook support
  - zone transfers, runtime piece flag lifecycle, draw/shuffle/mulligan,
    ride/call, attack/boost/guard, drive/damage checks, deck-out loss,
    damage defeat, combat math, and battle completion
  - effect registry, resolution queue, event-triggered resolution, and first
    core effect definitions
  - runtime effect handler dispatch, trigger choice interruption/resume, and
    trigger resolution foundations for critical/draw/front/heal/stand/over
  - keyword mechanics registry with baseline keyword/effect bindings
- collection / binder foundation:
  - collection route at `/collection`
  - owner-owned printing inventory
  - printing-level add/remove/quantity mutations
  - wishlist and favorite printing preferences
  - collection inventory and preference repository/use-case layers
  - DB-enforced owner-scoped collection item and preference access
- local gameplay prototype:
  - `packages/match-session` room/session boundary over `rules-core`
  - local route at `/matches/play/local`
  - room-id route at `/matches/play/[roomId]`
  - deterministic two-player Standard bootstrap for manual testing
  - match board projection across main zones, hand, deck, ride deck, G deck,
    damage, soul, drop, and bind
  - available action panel backed by room/engine validation probes
  - pending request handling, local event log, and closed-room feedback
- match-session runtime hardening for realtime prep:
  - room-owned canonical engine state and participant-to-player bindings
  - player-visible projections that mask private hands, decks, hidden requests,
    and sensitive event payloads
  - versioned snapshot-plus-history serialization and restore validation
  - transport-facing client command wrapper that rejects stale room revisions
    and client-submitted system actions
  - projected state push contracts for participant-specific realtime updates
  - session-owned clock/deadline state and authoritative timeout resolution
- application-layer refactoring:
  - explicit application/use-case layer split from server actions
  - DTO-to-domain mapping at feature boundaries
  - extracted authorization helpers
- importer/runtime checkpoint scripts, DB verification checkpoints, and focused
  review docs
- linting, formatting, typecheck, DB checkpoints, and pre-commit checks

Not implemented yet:

- notifications, recommendations, and richer social graph/product workflows
- public/shared match history workflows and richer match-detail editing flows
- production websocket / Supabase Realtime transport adapter
- DB-backed production match-session persistence adapter for canonical
  snapshot/history writes
- reconnect/recovery UI and protocol on top of persisted session truth
- optimistic client reconciliation against authoritative match-session state
- full Vanguard gameplay coverage, card-specific effect library, and polished
  product-facing match UX
- production-grade gameplay room RLS / authorization expansion beyond the
  current non-realtime baseline
- advanced sharing/visibility authorization beyond the current baseline model

Developer-only importer support includes the local JSON entrypoint and the
persisted pipeline runtime path:

- `corepack pnpm importer:dev-json -- <fixture>`
- `corepack pnpm pipeline:dev-json -- <fixture>`
