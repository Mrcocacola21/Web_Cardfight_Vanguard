# Deck DB Integration Tests

## 1. Purpose

This test slice verifies the deck database boundary against a live local
Supabase/Postgres instance before Phase 15. It is intended to prove that the
critical deck guarantees now hold in the database itself, not only in mocked
repository tests.

## 2. Why Mocked Tests Were Not Enough

The mocked JS tests validate repository mapping and call shape, but they cannot
prove:

- that `user_data.save_deck_aggregate` is really atomic in PostgreSQL;
- that deck RLS policies really block cross-user reads and writes;
- that child tables (`deck_versions`, `deck_cards`) do not leak data directly;
- that failed aggregate saves leave no partial rows behind.

Those guarantees live in SQL migrations, RPC code, triggers, grants, and RLS
policies, so they need a live DB-backed harness.

## 3. DB-Backed Test Scope

The deck DB tests run through the existing `@web-vg/db` local Supabase harness
in `packages/db/scripts/test-db.mjs`. The harness:

- starts local Supabase through `corepack pnpm dev:up`;
- runs `corepack pnpm dev:reset` so every migration is replayed from zero;
- executes the tests against the real local Postgres instance;
- uses database role switching plus JWT claim injection to simulate separate
  authenticated users.

This is a real database integration target, not a mock client path.

## 4. Tested Guarantees

- `aggregate save success`: owner calls `user_data.save_deck_aggregate` on a
  live DB and the persisted `decks`, `deck_versions`, and `deck_cards` graph is
  checked after commit, including the dense detail RPC shape.
- `read RLS boundary`: owner can read their own deck graph, while a non-owner
  cannot read the parent deck, deck versions, deck cards, or dense read RPC
  payloads.
- `write RLS boundary`: owner can save their own deck and write child rows onto
  their own version graph, while a non-owner cannot update the parent deck,
  insert child rows into the foreign graph, or save through the deck aggregate
  RPC as if they were the owner.
- `rollback semantics`: failed aggregate saves triggered inside
  `user_data.save_deck_aggregate` do not leave partial `decks`,
  `deck_versions`, or `deck_cards` rows behind, and failed updates leave the
  previous valid graph unchanged.

## 5. Test Setup / Auth-Context Model

- Each scenario creates its own `auth.users` row and matching
  `user_data.profiles` row inside the test transaction.
- Owner and non-owner identities are separate auth users and separate profile
  ids.
- Auth context is applied with `set local role authenticated` and request JWT
  claims (`request.jwt.claim.sub`, `request.jwt.claim.role`,
  `request.jwt.claims`), which makes `auth.uid()` and
  `user_data.current_profile_id()` behave like real per-user requests.
- The harness keeps every scenario inside a transaction and rolls it back after
  the assertions, so the tests stay reproducible without manual cleanup.

## 6. How To Run The Tests

Exact deck DB boundary command:

```powershell
corepack pnpm --filter @web-vg/db run test:db:decks
```

What it does:

- `corepack pnpm dev:up`
- `corepack pnpm dev:reset`
- deck-only live DB boundary verification against the reset local database

The broader DB checkpoint remains available through:

```powershell
corepack pnpm --filter @web-vg/db run test:db
```

## 7. Current Limitations

- The tests require local Docker/Supabase availability.
- They verify the database boundary directly, not the HTTP/PostgREST transport
  layer.
- They cover the current owner-private deck model. If public deck sharing or
  friend-scoped deck visibility is introduced later, that policy surface will
  need additional DB-backed tests.

## 8. Summary

This deck test slice now proves that the key deck guarantees are enforced by
the live database: atomic aggregate save, owner-only reads, owner-only writes,
and rollback on failure. The deck DB boundary is no longer unverified on a real
Postgres/Supabase runtime.
