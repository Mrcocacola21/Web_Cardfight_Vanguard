# Web_VG

Monorepo for a Cardfight!! Vanguard web client / companion platform.

The repository contains a working catalog with multi-wave Standard content, an
importer → publication content pipeline with semantic enrichment, baseline
auth/RLS, the first real deck builder workflow, format-aware deck validation
with profile-driven baseline rules, an explicit application-layer separation
across features, a social foundation on top of the profile layer, and an
owner-owned match history / stats foundation.

## Prerequisites

- Node.js `20.9+`
- Corepack enabled, or `pnpm 10.x` installed globally
- Git

If you do not have `pnpm` installed globally, use `corepack pnpm ...` in the commands below.

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

Start the current web app shell:

```bash
corepack pnpm --filter @web-vg/web dev
```

Open `http://localhost:3000`.

## Common Commands

```bash
# Start the web app
corepack pnpm --filter @web-vg/web dev

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

- `apps/web` – Next.js frontend app
- `packages/*` – domain and infrastructure packages
- `scripts/` – pipeline runner and expansion scripts
- `supabase/` – Supabase config, migrations, seeds, and SQL snippets
- `docs/` – product, engineering, architecture, and domain documents

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
- `packages/social`

Import boundaries are lint-enforced:

- import workspace packages only through their root API, for example `@web-vg/catalog`
- do not deep import through another package's `src/*`
- package-to-package dependencies must follow the bounded-context rules in the repo

## Commit Quality

Pre-commit uses Husky + lint-staged. On staged files, it runs:

- Prettier
- ESLint with autofix

Full repo-wide checks such as build, test, and typecheck are not part of pre-commit.

## Test Baseline

Current test setup:

- Vitest for package/domain unit tests
- Vitest + React Testing Library for `apps/web`
- Playwright for local runtime/browser checkpoints

Current practical coverage is strongest around:

- catalog read-side and publication-related repository/service flows
- importer pipeline and publication lifecycle checkpoints
- auth/profile baseline
- social foundation and protected profile/public-profile flows
- deck domain, deck builder UI, autosave, and metadata flows
- deck validation core, format-aware baseline rules, and integration tests
- owner-owned match history, filters, and stats aggregation

The browser/runtime layer is still lighter than unit/component coverage and is
best treated as checkpoint confidence, not a full e2e matrix.

## Current Status

This README reflects the current repository state, not the final product.

Available now:

- monorepo/workspace foundation
- `apps/web` app shell
- shared layout / feedback / data-display primitives
- Supabase browser/server client foundation
- SSR-friendly auth/session foundation
- baseline owner-based authorization and RLS for profiles, decks, collections, and matches
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
  - curated D / DZ Keter Sanctuary expansion (D-SD03, D-BT04, D-BT08, DZ-BT01, DZ-BT02, DZ-SS05)
  - additional standard products expansion (DZ-LBT01)
  - booster-by-booster expansion pipeline
  - semantic data enrichment (keywords, restriction provenance, printing variants)
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
- deck validation:
  - `packages/deck-validation` with format-aware validation pipeline
  - common, standard, premium, and V-Premium rule sets
  - profile-driven format-aware baseline rules (deck size, copy limits)
  - runtime `format.profile` hydration through builder validation data
  - Premium section qualification facts (G-deck eligibility)
  - restriction-list validation
  - validation UI panel in the deck builder
  - focused integration tests for profile-aware and Premium runtime behavior
- application-layer refactoring:
  - explicit application/use-case layer split from server actions
  - DTO-to-domain mapping at feature boundaries
  - extracted authorization helpers
- importer/runtime checkpoint scripts and focused review docs
- linting, formatting, typecheck, and pre-commit checks

Not implemented yet:

- collection/binder product flow
- notifications, recommendations, and richer social graph/product workflows
- public/shared match history workflows and richer match-detail editing flows
- gameplay engine and effect system
- advanced sharing/visibility authorization beyond the current baseline model

Developer-only importer support includes the local JSON entrypoint and the
persisted pipeline runtime path:

- `corepack pnpm importer:dev-json -- <fixture>`
- `corepack pnpm pipeline:dev-json -- <fixture>`
