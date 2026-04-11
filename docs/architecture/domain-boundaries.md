## Purpose

This note fixes the core domain boundaries that the project already follows so later phases do not drift into mixed semantics or shortcut write paths.

## Core Domain Concepts

### CardEntity

- Canonical gameplay identity.
- Used by deck building, legality, validation, and future gameplay logic.

### CardPrinting

- Concrete printed instance of a card.
- Carries release/product context and collectible identity.

### Product

- Release container for published printings.
- Drives product/set pages and release-oriented catalog surfaces.

## Deck Model

- Decks are canonical-card based.
- `DeckEntry.cardId` uses `CardId`, not `CardPrintingId`.
- Persisted deck composition uses `user_data.deck_cards.card_entity_id`.
- Deck logic may read catalog printings for display, but the deck model itself must stay entity-based.

## Collection Model

- Collections are printing-based inventory.
- Persisted collection ownership uses `user_data.collection_items.card_printing_id`.
- Collection logic must not collapse distinct printings into a single entity-owned item.

## Catalog Model

- Catalog is the only source of truth for published `card_entities`, `card_printings`, and `products`.
- User-facing reads go through catalog read repositories, not importer tables.
- Deck, collection, and UI layers may depend on catalog truth, but must not create parallel truth stores for card identity.

## Importer Model

- Importer owns `raw`, `normalization`, and `review` workflow state.
- Importer may read catalog entities as normalization targets.
- Importer must not write catalog truth directly.

## Publication Boundary

- Publication is the only allowed write bridge from importer workflow state into catalog truth.
- Allowed flow:
  - `importer.raw -> importer.normalization -> importer.review -> publication -> catalog`
- Publication writes printing-level catalog rows and preserves provenance back to import jobs and raw records.

## Entity vs Printing Semantics

- `CardEntity` is gameplay meaning.
- `CardPrinting` is collectible/release representation.
- Decks use entities.
- Collections use printings.
- Product pages list published printings inside a product.
- Multiple printings may share one canonical entity without erasing printing identity.

## Allowed Data Flows

- UI/server read flows -> catalog read layer -> `catalog.*`
- Deck builder -> catalog card entities for card truth
- Collection flows -> catalog card printings for owned inventory truth
- Importer normalization -> catalog entities as read-only matching input
- Publication -> catalog write-side

## Forbidden Flows

- Deck persistence storing `printingId` as deck truth
- Collection persistence storing `cardEntityId` as owned inventory truth
- Importer writing directly into `catalog.*`
- UI or server routes reading raw/normalization/review tables as catalog truth
- Publication bypass through ad hoc helpers or feature-layer writes

## Summary

The stable contract is:

- Deck -> `CardEntity`
- Collection -> `CardPrinting`
- Catalog -> published source of truth
- Importer -> workflow state only
- Publication -> only bridge into catalog truth

If a future feature cannot fit inside these boundaries, the default response should be to challenge the feature design, not to blur the model.
