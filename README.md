# Web_VG

Monorepo for a Cardfight!! Vanguard web client / companion platform.

The repository contains a working catalog with multi-wave Standard content, an
importer -> publication content pipeline with semantic enrichment, baseline
auth/RLS, the first real deck builder workflow, format-aware deck validation
with profile-driven baseline rules, DB-backed atomic deck persistence and
dense owner-scoped deck reads, an explicit application-layer separation across
features, a social foundation on top of the profile layer, and an owner-owned
match history / stats foundation. The gameplay stack now includes a bounded
rules runtime, authoritative match-session boundary, hidden-information
projection, session serialization/history, DB-backed persisted match-session
storage, an authenticated server-route command baseline, and a persisted
projection-backed match play route with bounded authenticated polling sync for
match rooms plus bounded live friends-dashboard refresh. Pre-Phase 21 work adds
a bounded six-deck Standard QA slice, local/dev catalog + deck bootstrap, a
deck-backed invite/lobby path into persisted rooms, and a playmat-oriented
projected match UI. Full realtime fanout, production reconnect/recovery, and
exact competitive coverage for every Standard card remain in progress.

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

For Supabase-backed development, copy `apps/web/.env.example` to
`apps/web/.env.local` and set:

- `NEXT_PUBLIC_APP_ORIGIN`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` for server-only gameplay persistence and
  authenticated match route operations

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
  `corepack pnpm test:db`, including gameplay persistence and RLS posture
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
- bounded Pre-Phase 21 Standard slice fixtures, effects, activated-effect
  transitions, deck bootstrap, and full-match integration checkpoints
- deck-to-match and invite/lobby use cases for persisted projected rooms
- playmat-style projected match rendering, hidden-information checks, and card
  inspection surfaces
- match-session projection, serialization/history, DB-backed persisted session
  storage, authenticated server-route transport, and timer/timeout contracts
- projected persisted match room route and participant-safe multiplayer client
  state
- gameplay DB persistence and RLS:
  - canonical room tables remain server-owned
  - room snapshots, accepted room events, and pending choices persist through
    DB-backed storage
  - gameplay RLS and storage checks run against live local Supabase in
    `test:db`
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

Current Phase 20 posture remains **GO WITH CONDITIONS**. The project is no
longer only a local gameplay prototype: rules/session/projection foundations
are strong, canonical match room truth can be persisted and restored,
participant commands have an authenticated server route baseline, and
`/matches/play/[roomId]` loads persisted room truth before rendering a
participant-safe projection. The first bounded 20.1 match-room sync loop runs
through authenticated polling and projected snapshot replacement. The 20.2
social realtime scope is limited to owner-safe `/friends` dashboard snapshots.

Pre-Phase 21 status: a bounded Standard product slice now exists for local QA.
It covers six fixed decks (Reguregnus, Heartluru, Youthberk, Prison, Vyrgilla,
and Kairi), creates local/dev QA catalog rows and saved decks, lets users invite
another visible profile into a lobby, choose saved Standard decks, ready up,
start a persisted authoritative room, and play through the projected match UI.
This is still a curated QA slice, not a claim that the exact competitive
DeckLog lists and every card-specific branch are complete.

Fanout, reconnect/recovery, presence, optimistic reconciliation, production
invite notifications, and production multiplayer UX are not done.

Available now:

- monorepo/workspace foundation
- `apps/web` app shell
- shared layout / feedback / data-display primitives
- Supabase browser/server client foundation
- SSR-friendly auth/session foundation
- baseline owner-based authorization and RLS for profiles, decks, collections,
  and match records
- server-owned RLS posture for canonical gameplay room persistence
- protected and public profile surfaces
- social foundation:
  - public user search at `/users`
  - public profile route at `/users/[profileId]`
  - friends dashboard at `/friends`
  - bounded live refresh for `/friends` active friendships and pending requests
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
  - local/dev QA bootstrap for the six Pre-Phase 21 Standard slice decks when
    `ENABLE_STANDARD_SLICE_QA_BOOTSTRAP=true`
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
  - deterministic two-player Standard bootstrap for manual testing
  - match board projection across main zones, hand, deck, ride deck, G deck,
    damage, soul, drop, and bind
  - available action panel backed by room/engine validation probes
  - pending request handling, local event log, and closed-room feedback
- Pre-Phase 21 Standard product slice:
  - canonical six-deck target roster documented under `docs/rules`
  - bounded Standard slice card definitions and runtime handlers in
    `packages/rules-core`
  - activated effect transition path and card-specific QA slice coverage
  - deck-backed match bootstrap in `packages/match-session`
  - local/dev QA deck creation from `/decks`
  - manual test guide at `docs/qa/manual-standard-slice-test-guide.md`
- match product flow:
  - direct deck-to-match route at `/matches/start?deckId=...`
  - primary human invite path at `/matches/lobby`
  - accepted lobby deck selection, ready state, and persisted room start
  - deck list/detail CTAs that send users into the match flow without manual
    room ids
  - playmat-oriented projected match board with visible card faces, hidden card
    backs, battle/request emphasis, and card inspection
- match-session runtime hardening for realtime prep:
  - room-owned canonical engine state and participant-to-player bindings
  - player-visible projections that mask private hands, decks, hidden requests,
    and sensitive event payloads
  - versioned snapshot-plus-history serialization and restore validation
  - transport-facing client command wrapper that rejects stale room revisions
    and client-submitted system actions
  - projected state push contracts for participant-specific realtime updates
  - session-owned clock/deadline state and authoritative timeout resolution
- Phase 20 realtime foundation:
  - DB-backed `PersistedMatchSessionStorage` for canonical room snapshots,
    accepted room events, lifecycle metadata, and pending-choice mirrors
  - authenticated `GET`/`POST`
    `/api/matches/rooms/[roomId]/realtime` server route wired to
    `createServerRouteRealtimeTransport`
  - participant command -> authoritative session runtime -> projected update
    path with accepted-only persistence semantics
  - persisted `/matches/play/[roomId]` page that resolves the authenticated
    participant and renders the persisted projected match room sync client
  - bounded 20.1 browser sync loop:
    - authenticated short-interval polling for participant-safe snapshots
    - browser command submission with `expectedRoomRevision`
    - full projected snapshot replacement for submitter and observer
      convergence
  - bounded 20.2 social dashboard sync:
    - authenticated `GET /api/social/friends/realtime`
    - owner-safe full snapshot replacement for active friends, incoming
      requests, and outgoing requests
  - local prototype kept separate at `/matches/play/local`
  - live `test:db` checkpoint for gameplay persistence and RLS confidence
- application-layer refactoring:
  - explicit application/use-case layer split from server actions
  - DTO-to-domain mapping at feature boundaries
  - extracted authorization helpers
- importer/runtime checkpoint scripts, DB verification checkpoints, and focused
  review docs
- linting, formatting, typecheck, DB checkpoints, and pre-commit checks

Not implemented yet:

- notifications, recommendations, invite delivery, and richer social
  graph/product workflows
- realtime user search, profile/privacy editor state, and presence
- public/shared match history workflows and richer match-detail editing flows
- production websocket / Supabase Realtime fanout, presence, and subscription
  transport
- reconnect/recovery UI and protocol on top of persisted session truth
- optimistic client reconciliation against authoritative match-session state
- duplicate command idempotency, distributed room locking, and production
  multiplayer scaling/observability
- full Vanguard gameplay coverage, exact competitive text for every Standard
  slice branch, official image ingestion, and a complete card-specific effect
  library
- matchmaking queues, rematches, spectators, chat, tournaments, and bot/solo AI
- advanced sharing/visibility authorization beyond the current baseline model

Developer-only importer support includes the local JSON entrypoint and the
persisted pipeline runtime path:

- `corepack pnpm importer:dev-json -- <fixture>`
- `corepack pnpm pipeline:dev-json -- <fixture>`
