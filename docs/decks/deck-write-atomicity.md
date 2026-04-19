# Deck Write Atomicity

## 1. Purpose

This document records the transactional boundary for persisted deck writes.

Goal:

- `create deck` and `save deck` must commit a complete deck aggregate or
  commit nothing.

The authoritative persisted deck state is:

- `user_data.decks`
- current `user_data.deck_versions` row
- all `user_data.deck_cards` rows for that version
- the deck row metadata update that points `current_version_id` at the new
  version

## 2. What Was Wrong Before

The previous repository write path chained separate Supabase mutations:

1. insert `decks`
2. insert `deck_versions`
3. insert `deck_cards`
4. update `decks.current_version_id`

On failure it tried to compensate with `bestEffortDelete...` cleanup helpers.

That was not a real transaction. If the process or network failed between the
write error and the cleanup attempt, partial deck state could remain in the
database.

## 3. Chosen Transactional Boundary

The deck write boundary now lives in Postgres:

- DB function: `user_data.save_deck_aggregate(...)`
- access path: `client.schema('user_data').rpc('save_deck_aggregate', ...)`
- owner: infrastructure persistence layer in
  `packages/db/src/repositories/decks/decks.repository.ts`

The function is `security invoker`, so it runs under the caller identity,
keeps RLS active, and performs the full multi-table mutation inside one
database transaction.

## 4. Which Deck Write Flows Are Now Atomic

These repository flows now use the same atomic DB-side unit:

- `createDeck`
- `saveDeck`

That covers:

- deck row creation for new decks
- deck metadata updates for existing decks
- new version creation
- full card slice insertion for the new version
- repointing `decks.current_version_id`

## 5. What Failure Behavior Now Looks Like

If any inner step fails inside `user_data.save_deck_aggregate(...)`:

- the statement fails
- Postgres rolls back the whole write unit
- no new deck row, version row, or deck card rows remain committed
- existing deck state stays unchanged for failed saves

There is no application-layer compensation delete in the deck write path
anymore.

## 6. Ownership/Auth Considerations

Authorization is still enforced by the authenticated caller context:

- the function runs as `security invoker`
- table RLS still applies
- the function also checks that `save_owner_profile_id` matches
  `user_data.current_profile_id()`

This keeps the write path honest for owner/profile semantics and does not move
authorization responsibility into UI or domain code.

## 7. Test Coverage

Repository coverage:

- `packages/db/src/repositories/decks/decks.repository.test.ts`
  - verifies one RPC-backed save path for create/save
  - verifies atomic error mapping without cleanup deletes

Live DB coverage:

- `packages/db/scripts/test-db.mjs`
  - successful atomic create/save
  - failed create leaves no committed deck/version/card graph
  - failed save leaves existing aggregate unchanged
  - forged owner writes are rejected without partial rows

## 8. Summary

Deck writes are now atomic at the database boundary.

The repository no longer pretends that several Supabase calls plus cleanup are
transactional. The real commit/rollback boundary is now the Postgres function
`user_data.save_deck_aggregate(...)`.
