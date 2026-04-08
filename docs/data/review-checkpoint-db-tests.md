# DB Tests Checkpoint

## 1. Scope of This Checkpoint

This checkpoint verifies the minimum database foundation needed before wider
implementation work grows on top of persistence.

Included:

- local migration replay from zero
- seed replay on top of migrations
- a small set of load-bearing schema constraints
- a meaningful repository subset at the repository boundary

Intentionally not included:

- exhaustive schema constraint coverage
- performance testing
- legality engine or gameplay runtime behavior
- full PostgREST / RLS / auth integration coverage

## 2. What Was Verified

- local Supabase DB can be started and reset reproducibly
- all migrations apply in dependency order
- configured dev seeds apply after migrations
- key relational and uniqueness constraints fail when they should
- repository methods return mapped read models and sensible `null` / success
  behavior

## 3. Migration Verification

Verified through:

- `corepack pnpm test:db`

That command now runs:

1. `supabase start`
2. `supabase db reset --local`
3. seeded baseline smoke checks against the local Postgres instance
4. `@web-vg/db` repository tests

What this proves:

- migration ordering is valid
- migrations are replayable from a clean local database
- the configured seed dataset is compatible with the current schema

## 4. Constraint Verification

The checkpoint now verifies these live DB invariants against local Postgres:

- canonical card identity uniqueness on `catalog.card_entities.canonical_key`
- `catalog.card_printings.card_entity_id` foreign-key integrity
- `user_data.deck_cards` uniqueness for
  `(deck_version_id, section_key, card_entity_id)`
- unordered friend-pair uniqueness in `social.friend_relationships`
- room-local composite linkage for `gameplay.room_events.actor_room_player_id`

Why these were chosen:

- they are load-bearing for card normalization
- they protect deck composition integrity
- they protect social graph consistency
- they protect gameplay room isolation

## 5. Repository Verification

Repository verification is currently boundary-level, not live REST integration.

Verified repository methods:

- catalog:
  - `listCardEntities`
  - `getCardEntityByCanonicalKey`
- profiles:
  - `getProfileByAuthUserId`
  - `upsertProfileByAuthUserId`
- decks:
  - `listDecksByOwner`
  - `getDeckDetailById`

What these tests check:

- mapped output shape
- no raw DB row leakage
- correct success-path behavior
- correct `not found` behavior where relevant
- correct repository-side query intent for the current methods

## 6. What Is Still Not Covered

- live repository integration against a running local PostgREST / Supabase API
- RLS policy behavior
- transaction-backed multi-table write verification
- full coverage for every FK, check constraint, and unique index
- gameplay snapshot / pending-choice payload semantics

## 7. Risks Still Open

- multi-table writes are still the biggest open reliability risk; this
  checkpoint does not solve transaction design by itself
- repository tests validate repository boundaries honestly, but they are still
  not end-to-end API integration tests
- DB tests currently assume the local Supabase DB path is available through the
  CLI

## 8. Verdict

`GO WITH CONDITIONS`

Why:

- migration replay and seed replay are now reproducibly verified
- critical relational invariants are no longer only "trusted by inspection"
- repository boundary behavior for the current foundation methods is tested

Conditions:

- do not present this as full persistence integration coverage
- keep using DB-side transactional units for future multi-table write-heavy
  flows
- add live repository integration coverage later if local REST/RLS behavior
  becomes part of the delivery risk surface
