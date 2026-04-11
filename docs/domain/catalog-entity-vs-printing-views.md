# Catalog Entity vs Printing Views

## 1. Purpose

This note fixes the read-side UI semantics for the two catalog perspectives that
already exist in the domain model:

- canonical `CardEntity`
- concrete `CardPrinting`

The goal is to keep routing, lookup contracts, filtering behavior, and page read
models explicit so the catalog does not blur gameplay identity and release
identity.

## 2. Entity View

Entity view is centered on the canonical gameplay card.

Primary use cases:

- gameplay-oriented catalog browsing
- deck- and legality-facing lookup
- seeing one gameplay identity with related printings beneath it

Current entity-view surfaces:

- `/catalog`
- `/catalog/[cardKey]`

Entity-view results stay canonical-card-centric even when some filters
originate from printings or products.

## 3. Printing View

Printing view is centered on one concrete printed or released instance.

Primary use cases:

- release-aware browsing
- product/set exploration
- collector-facing inspection of rarity, locale, and product context

Current printing-view surfaces:

- product printing lists on `/catalog/products/[productKey]`
- `/catalog/printings/[printingKey]`

Printing view does not replace canonical card identity. It links back to it.

## 4. Routing and Lookup Strategy

Routing is identity-explicit:

- canonical card detail: `/catalog/[cardKey]`
- printing detail: `/catalog/printings/[printingKey]`
- product detail: `/catalog/products/[productKey]`

Lookup contracts remain separate:

- `cardEntityLookupByCanonicalKey(...)`
- `cardPrintingLookupByPrintingKey(...)`
- `productLookupByCanonicalKey(...)`

One route never silently switches between entity and printing semantics.

## 5. Filtering/Search Implications

The main `/catalog` list remains entity-centric for now.

- search and filter interpretation still resolve to canonical card entities
- printing-originated filters such as rarity and set work by finding matching
  printings/products and then mapping back to eligible card entities
- there is no global printing-centric catalog list route yet

This keeps the existing filtering foundation coherent instead of overloading the
same query state with two incompatible list semantics.

## 6. Read-Model Implications

Entity-facing read models include:

- canonical identity
- gameplay-facing stats
- rules references
- legality facts
- related printings

Printing-facing read models include:

- printing identity
- product/set context
- rarity, locale, collector number, art/promo markers
- reference back to the canonical card entity

These read models stay separate instead of forcing one bloated “card detail”
shape to serve both perspectives.

## 7. Product/Card/Printing Relationship in UI

UI hierarchy stays explicit:

- product pages are product-centric
- canonical card pages are entity-centric
- printing pages are printing-centric

Links between them are intentional:

- canonical card detail links to printing detail and release detail
- product pages link to both printing detail and canonical card detail
- printing detail links back to both the release and the canonical card

## 8. What Is Intentionally Not Implemented Yet

Not implemented in this step:

- global printing-centric list browsing
- a universal entity/printing toggle across all catalog surfaces
- collector gallery/artwork experiences
- printing-specific filtering semantics for a standalone printing list
- deeper collector metadata beyond the current release-facing printing facts
