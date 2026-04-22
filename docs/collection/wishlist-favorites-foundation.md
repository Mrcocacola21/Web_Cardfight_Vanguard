# Wishlist/Favorites Foundation

## 1. Purpose

Add a private preference layer to the collector workflow without mixing it into
owned inventory.

Wishlist and favorites now sit beside collection as owner-scoped preference
state over published catalog printings.

## 2. Wishlist vs favorites semantics

- `wishlist` means the user wants to acquire this printing later
- `favorite` means the user wants to bookmark this printing as a collector
  preference

These are separate preference kinds, not ownership flags.

## 3. Target semantic level and why

Both preference kinds are printing-based.

This keeps collector intent aligned with exact printings, including alt art,
promo, rarity, and release variants. Canonical card data remains supportive
display context only.

## 4. Persistence model

Preference rows live in `user_data.collection_printing_preferences`.

Each row contains:

- `id`
- `owner_profile_id`
- `card_printing_id`
- `preference_kind`
- `created_at`
- `updated_at`

`owner_profile_id + card_printing_id + preference_kind` is unique.

## 5. Owner-only privacy model

Preferences stay private in this phase.

- only the owner can read them
- only the owner can mutate them
- RLS is enforced directly on `owner_profile_id`
- preferences are stored separately from collection ownership rows

## 6. Use-case flow

- server action resolves the authenticated owner context
- application use case resolves the persisted owner profile
- repository upserts or removes one owner-owned printing preference row

The baseline operation is explicit presence control for one exact printing and
one exact preference kind.

## 7. UI entry points

Preferences are visible and mutable in two places:

- catalog printing detail page via wishlist/favorites controls for one printing
- `/collection` via owner-only wishlist and favorite sections

This gives the feature both a write surface and a read surface without adding a
separate dashboard yet.

## 8. What is intentionally NOT implemented yet

- public/shared wishlists or favorites
- pricing, market watchlists, or trade flows
- recommendation or notification logic
- analytics or preference taxonomies
- social likes/follows
- automatic coupling between owned quantity and preference state

## 9. Summary

Wishlist and favorites now exist as a clean preference layer over published
catalog printings.

Collection remains ownership. Preferences remain preferences. Both stay
owner-only and collector-facing.
