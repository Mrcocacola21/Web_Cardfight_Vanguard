# Baseline Authorization And RLS

## 1. Purpose

Establish the minimum owner-based security floor for current user-owned data before deck, collection, social, and match features expand further.

## 2. Resources Covered

- `user_data.profiles`
- `user_data.collections`
- `user_data.collection_items`
- `user_data.decks`
- `user_data.deck_versions`
- `user_data.deck_cards`
- `social.matches`
- `social.match_participants`

## 3. Ownership Model

- Auth identity is anchored on `auth.users.id`.
- `user_data.profiles.auth_user_id` is the canonical link from auth identity to app-level profile identity.
- User-owned rows reference `user_data.profiles.id`:
  - `owner_profile_id` for collections, collection items, and decks
  - `created_by_profile_id` for deck versions
  - `recorded_by_profile_id` for matches
- RLS owner resolution uses `user_data.current_profile_id()`.

## 4. Public vs Private Access

- Base `user_data.profiles` rows are owner-only.
- Public profile reads use `user_data.public_profiles`, a public-safe projection with only:
  - `id`
  - `display_name`
  - `avatar_url`
  - `bio`
- `decks`, `collections`, `matches`, and their subordinate rows remain owner-only by default.
- Existing visibility columns on decks, collections, and matches are not treated as active sharing policy yet.

## 5. RLS Policy Model

- `profiles`: owner-only `select/insert/update/delete`
- `collections`: owner-only `select/insert/update/delete`
- `collection_items`: owner-only `select/insert/update/delete`
- `decks`, `deck_versions`, and `deck_cards`: owner-only `select/insert/update/delete`
- `matches` and `match_participants`: owner-only `select/insert/update/delete`
- Public profile access is handled by grants on the projection view, not by opening the base table.

## 6. Create / Update / Delete Guarantees

- Inserts must match the caller-owned profile identity.
- Updates are limited to rows owned by the current caller.
- Deletes are limited to rows owned by the current caller.
- Forged owner IDs are rejected at the database policy layer.

## 7. What Is Intentionally Not Implemented Yet

- friend-based visibility
- public deck sharing
- collection sharing
- public match history
- admin/moderation roles
- a full ACL or role matrix

## 8. Summary

The baseline model is now simple and explicit:

- owner-owned data is protected by database-enforced RLS
- public profile reads are separated from raw owner rows
- server-side repository flows can rely on the same ownership contract instead of UI-only hiding
