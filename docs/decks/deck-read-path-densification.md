# Deck Read Path Densification

## 1. Purpose

This document records how deck aggregate reads were tightened to reduce
network chatter on the two load-bearing read paths:

- `listDecksByUser`
- `getDeckDetailById`

The goal was to move aggregate assembly closer to Postgres while keeping the
repository contract and owner-scoped semantics stable.

## 2. What Was Inefficient Before

The previous repository implementation stitched deck aggregates together with
several sequential Supabase calls:

- `listDecksByUser`: `decks` -> `formats` -> `deck_versions` -> `deck_cards`
- `getDeckDetailById`: `decks` -> `formats` -> `deck_versions` ->
  `deck_cards` -> `card_entities`

That meant 4 round-trips for the list surface and 5 round-trips for the
detail surface, plus application-side joins and normalization work.

## 3. Chosen Densification Strategy

The read boundary now lives in Postgres through two `security invoker` SQL
functions:

- `user_data.list_deck_summaries(read_owner_profile_id uuid)`
- `user_data.get_deck_detail_aggregate(read_deck_id uuid)`

The repository calls them through `client.schema('user_data').rpc(...)`.

This keeps aggregate assembly in the infrastructure layer, reduces each
load-bearing path to one DB-backed request, and preserves RLS because the
functions execute as the caller.

## 4. `listDecksByUser` Improvements

`listDecksByUser` now reads deck summaries from one DB-side projection that
joins:

- `user_data.decks`
- `legality.formats`
- current `user_data.deck_versions`
- aggregated section counts from current `user_data.deck_cards`

Round-trips:

- before: 4
- now: 1

The list RPC returns only summary fields needed by the list surface, so the
path got denser without over-fetching full deck detail.

## 5. `getDeckDetailById` Improvements

`getDeckDetailById` now loads one aggregate row from Postgres that includes:

- deck metadata
- attached format data
- current version metadata
- current version cards as JSON
- a DB-side flag for missing canonical card links

Round-trips:

- before: 5
- now: 1

The repository still maps the DB payload into the existing detail record
shape, but no longer orchestrates a chain of table fetches and in-memory
joins.

## 6. Mapping and Stale-Link Handling

Mapping remains explicit:

- DB/RPC payload shape stays inside the repository + mapper layer
- application and UI still receive deck record/detail DTOs
- raw nested payloads are not pushed upward

Stale or missing relations remain handled intentionally:

- missing format attachment still fails the read
- missing canonical card entities still fail the detail read
- missing current version rows still degrade to `currentVersion: null`

## 7. Ownership/Auth Considerations

Ownership boundaries were not relaxed:

- both read RPCs are `security invoker`
- table RLS still applies under the authenticated caller
- foreign-user reads still resolve to no rows rather than broadening access

The optimization changed the read density, not the authorization model.

## 8. Test Coverage

Repository coverage in
`packages/db/src/repositories/decks/decks.repository.test.ts` now verifies:

- one RPC-backed summary read for `listDecksByUser`
- one RPC-backed aggregate read for `getDeckDetailById`
- missing format handling on list/detail reads
- missing card entity failure on detail reads
- stale current-version fallback on detail reads

Live DB coverage in `packages/db/scripts/test-db.mjs` adds:

- owner-visible dense list/detail reads
- owner-scoped behavior under authenticated RLS
- foreign-user invisibility for both dense read RPCs

## 9. Summary

The deck read path is now materially less chatty:

- `listDecksByUser`: 4 -> 1 round-trip
- `getDeckDetailById`: 5 -> 1 round-trip

Aggregate assembly moved to Postgres, repository mapping stayed disciplined,
and owner-scoped semantics remained intact.
