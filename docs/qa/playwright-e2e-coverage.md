# Playwright E2E Coverage

## Scope

The Playwright suite covers user-visible app flows that exist in the current
Next.js app: public navigation, auth/protected routing, catalog browsing, deck
builder CRUD, collection inventory, social friend management, manual match
history/stats, the local match prototype, and the persisted projected match
room route.

The suite is intentionally behavior-focused. It avoids page-wide screenshots
and does not duplicate package-level rules, deck-validation, catalog, or storage
tests where a unit or integration test already owns the contract.

## Covered User Flows

- `tests/e2e/navigation/home.spec.ts`: public shell smoke and catalog entry link.
- `tests/e2e/auth/routing.spec.ts`: registration, login, logout, protected route
  redirects, and authenticated protected navigation.
- `tests/e2e/catalog/browse.spec.ts`: catalog load, search/filter application,
  empty state reset, card detail, printing detail, and product detail navigation.
- `tests/e2e/decks/deck-builder.spec.ts`: deck creation, builder edits, card
  add/remove, validation feedback, autosave persistence, list filtering,
  duplication, and deletion.
- `tests/e2e/collections/collection.spec.ts`: printing detail collection entry,
  wishlist/favorite preferences, inventory page rendering, list view, sorting,
  and removal.
- `tests/e2e/social/friends.spec.ts`: public profile search, friend request,
  accept, owner dashboard live refresh, and removal.
- `tests/e2e/matches/history-and-gameplay.spec.ts`: manual match recording,
  history filtering, stats rendering, friends match view empty state, local match
  prototype actions, persisted room access denial, deck-to-match room entry, and
  two-browser persisted room sync.

## Test Data / Auth Strategy

Local Supabase is the authoritative e2e runtime. Tests create unique users
through the UI and use generated display names/emails to avoid depending on
manual database state. Decks, collection entries, social records, and manual
matches are created by user-visible flows where practical.

Older persisted match room tests use a small service-role helper to insert a
room session after the participant profiles are created through the UI. The
product path now also exposes `/matches/start?deckId=...`, which creates a
deck-backed persisted room from an owned Standard deck and a visible opponent.

## Routes/Features Intentionally Not Covered Yet

- Hosted signup/email-confirmation behavior outside the local Supabase runtime.
- A full gameplay rules matrix in the browser. Rules behavior remains owned by
  package tests; e2e only checks visible match route wiring and one accepted
  action path.
- Browser-level raw realtime subscriptions. Current social and match app flows
  are covered through their server-mediated polling routes.
- Every catalog/deck-validation rule combination. E2E checks visible feedback;
  combinatorial rules coverage belongs in package tests.
- Full matchmaking/lobby coverage. The current room creation workflow is a
  bounded direct challenge from an owned Standard deck, not a public matchmaking
  platform.

## How To Run The Suite

Use the lightweight Playwright command for public smoke/discovery:

```bash
corepack pnpm test:e2e
```

Use the local Supabase-backed full regression suite:

```bash
corepack pnpm test:e2e:local
```

The local runner performs `corepack pnpm dev:hard-reset`, reads Supabase
connection values from `supabase status -o env`, starts Next.js through the
Playwright web server, and runs the full `tests/e2e` tree with
`PLAYWRIGHT_USE_LOCAL_SUPABASE=1`.

Targeted local checkpoints are still available:

```bash
corepack pnpm test:auth:e2e
corepack pnpm test:decks:e2e
```

## Known Limitations

The full suite is intentionally serialized against the local Supabase runtime to
avoid cross-test state races. It is not meant to run against a shared hosted
database. The local runner resets the local Supabase stack, so it should only be
used in disposable dev/test environments.

## Summary

The suite now acts as a practical regression shield for the main app surfaces:
auth boundaries, catalog navigation, protected CRUD flows, collection/social
state, manual match tracking, and visible match-room projections. It is scoped
to current product behavior and leaves deeper rules and storage guarantees to
the lower-level test suites that already own them.
