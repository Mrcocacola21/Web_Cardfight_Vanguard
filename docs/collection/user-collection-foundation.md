# User Collection Foundation

## 1. Purpose

Establish the first real collector-facing inventory layer for authenticated
users.

This step adds private owned collection state for concrete `CardPrinting`
records and keeps it separate from deck-building semantics.

## 2. Why collection is printing-based

Collection rows represent ownership of physical printings, not gameplay card
identity.

- decks stay canonical-card based
- collection stays printing based
- different printings of the same canonical card stay separate owned rows

No entity-level shortcut collapses alt art, rarity variants, or promo
printings into one count.

## 3. Collection item model

Runtime inventory is stored in `user_data.collection_items`.

Each row contains:

- `id`
- `owner_profile_id`
- `card_printing_id`
- `quantity`
- `created_at`
- `updated_at`

`owner_profile_id + card_printing_id` is unique.

## 4. Quantity semantics

- quantity is an integer count of copies owned by the current user
- quantity must stay positive while the row exists
- setting quantity to `0` deletes the row
- decrementing to `0` deletes the row
- negative quantities are rejected

There are no persistent zero-quantity rows.

## 5. Owner-only model

Collection inventory is private owner data.

- only the owning profile can read its rows
- only the owning profile can mutate its rows
- RLS is enforced directly on `collection_items.owner_profile_id`
- collection item identity cannot be reassigned to another owner or another printing

## 6. Use-case flow

Transport stays thin:

- server action resolves auth context
- application use case resolves the current owner profile
- db repository executes owner-scoped collection mutation

Supported flows:

- add printing to collection
- increment owned quantity
- decrement owned quantity
- set exact quantity
- remove printing completely

Atomic DB quantity functions back the increment/decrement and exact-set paths.

## 7. UI entry point

Minimal collection controls now live on the catalog printing detail page:

- `apps/web/src/app/catalog/printings/[printingKey]/page.tsx`
- `apps/web/src/components/collections/printing-collection-panel.tsx`

The control shows current owned quantity for the exact printing plus add,
remove-one, remove-all, and set-quantity actions.

## 8. What is intentionally NOT implemented yet

- binder/list page UI
- wishlist or favorites
- public sharing or visibility
- deck-to-collection sync
- pricing or marketplace logic
- scan/import/export
- analytics or completion tracking
- entity-level ownership shortcuts

## 9. Summary

The product now has a clean owner-owned private inventory foundation built on
published catalog printings.

Decks still model gameplay identity. Collection now models owned printings.
That separation is explicit in schema, repository contracts, use cases, and the
first user-facing entry point.
