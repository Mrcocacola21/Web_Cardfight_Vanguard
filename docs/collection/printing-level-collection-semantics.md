# Printing-Level Collection Semantics

## 1. Purpose

Protect the collector-facing invariant that collection models owned printings,
not gameplay card identity.

This step hardens collection semantics across storage, application flows, read
models, UI, tests, and documentation.

## 2. Why collection is printing-based

Collection tracks ownership of published `CardPrinting` records.

- regular and alt-art printings are different owned units
- rarity or promo variants are different owned units
- shared canonical card identity does not justify merging owned rows

Collector mode would lose meaning if ownership collapsed back to entity-level
counts.

## 3. Collection identity model

Collection item identity is:

- `owner_profile_id`
- `card_printing_id`

Not:

- `owner + card_entity`
- `owner + card name`
- `owner + product`

The exported collection types now expose this explicitly through
`CollectionOwnedPrintingIdentity`.

## 4. Relationship to canonical CardEntity

`CardEntity` remains useful display context for naming, grade, nation, and
other gameplay-oriented facts.

It is not the collection key. Decks stay entity-based. Collection stays
printing-based.

## 5. Persistence semantics

Collection persistence lives in `user_data.collection_items`.

- each row stores one owner-owned printing
- quantity belongs to that exact printing row
- uniqueness is enforced on `owner_profile_id + card_printing_id`
- the foreign key points at published `catalog.card_printings`

There is no entity-level fallback row shape in collection storage.

## 6. Read model / UI implications

Binder and list views read owner-scoped collection items plus linked catalog
printing truth.

The UI may show:

- card name
- rarity
- variant markers
- collector number
- product/set context

Those are explanatory fields around the owned printing. Two printings of the
same card must still render as two entries.

## 7. Action semantics

Collection mutations operate on printing ids.

- add/increment targets one printing id
- decrement targets one printing id
- remove targets one printing id
- exact quantity targets one printing id

Mutating one printing must not change another printing of the same card.

## 8. Tests that protect printing-level behavior

Regression coverage now checks:

- owner + printing identity in exported types and persistence
- mutation flows targeting distinct printing ids
- binder/list read paths keeping same-card printings separate
- UI rendering two owned printings as distinct entries with per-printing actions

These tests exist specifically to block drift back toward entity-centric
collection behavior.

## 9. Summary

Collection is now explicitly hardened as a printing-based subsystem end-to-end.

Decks represent gameplay identity. Collection represents owned printings. That
semantic split is intentional and protected.
