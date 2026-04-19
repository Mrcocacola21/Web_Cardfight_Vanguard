# Deck DB Ownership Security

## 1. Purpose

This document records the database security boundary for deck ownership.

Goal:

- the database, not only application code, must block cross-user reads and
  mutations for persisted deck data
- the full deck graph must stay owner-scoped, not only the root `decks` row

## 2. What Was Weak Before

Deck flows already had baseline RLS, but the safety story was still too easy
to misread as "the app checks ownership first".

Weak points:

- application use cases still resolved ownership explicitly for UX purposes
- child-table guarantees were not documented as the real boundary
- child rows were still directly updatable even though the product write path
  no longer needs in-place mutation
- deck ownership edges were not enforced as immutable DB invariants

## 3. Deck Ownership Model in the DB

The ownership root is `user_data.decks.owner_profile_id`.

The authenticated actor resolves through:

- `auth.uid()`
- `user_data.current_profile_id()`
- `user_data.profiles.id`

The rest of the deck graph inherits ownership from that root:

- `user_data.deck_versions.deck_id -> user_data.decks.id`
- `user_data.deck_cards.deck_version_id -> user_data.deck_versions.id`

Additional DB invariants now make that graph explicit:

- deck ownership cannot be reassigned after creation
- `deck_versions.created_by_profile_id` must match the owning deck profile
- deck versions cannot be moved to a different deck
- deck cards cannot be moved to a different deck version

## 4. Which Tables Are Protected by RLS

These tables are protected by RLS and forced RLS:

- `user_data.decks`
- `user_data.deck_versions`
- `user_data.deck_cards`

`FORCE ROW LEVEL SECURITY` keeps the deck graph under policy enforcement even
if future table-owner paths appear.

## 5. Read Policies

Read access is owner-scoped in the database:

- `decks`: only rows with `owner_profile_id = current_profile_id()`
- `deck_versions`: only rows whose parent deck is owned by the current profile
- `deck_cards`: only rows whose parent version resolves to a deck owned by the
  current profile

This also applies to aggregate RPC reads because the RPCs are
`security invoker` and therefore execute under the caller with RLS active.

## 6. Write Policies

Write access is split by intended behavior:

- `decks`: owner can insert, update metadata, and delete their own deck
- `deck_versions`: owner can insert version rows onto their own deck graph
- `deck_cards`: owner can insert card rows onto their own version graph

Authenticated direct `UPDATE` access to `deck_versions` and `deck_cards` is no
longer part of the allowed surface. The intended write path is append-only:

- create/save through `user_data.save_deck_aggregate(...)`
- root deck delete through `user_data.decks`

This keeps the persisted version/card graph from being rewritten in place.

## 7. Relationship to App-Layer Checks

App-layer ownership checks remain for:

- clearer error messages
- earlier use-case exits
- explicit business intent in application code

They are no longer the primary barrier. If application code makes a mistake,
the database still blocks foreign deck reads and mutations.

## 8. DB-Backed Test Coverage

`packages/db/scripts/test-db.mjs` now verifies:

- owner can read own deck root/version/card rows
- non-owner cannot read another user's deck root/version/card rows
- non-owner cannot mutate another user's deck root or child graph
- non-owner cannot save another user's deck through the atomic RPC
- deck ownership cannot be reassigned in the DB
- deck versions cannot create cross-owner links
- deck versions and deck cards cannot be reassigned after creation
- dense deck read RPCs stay owner-scoped under RLS

## 9. Summary

Deck security is now DB-enforced across the meaningful aggregate graph.

The authoritative ownership boundary lives in Postgres RLS plus deck-specific
DB invariants, while application checks remain only as secondary guardrails.
