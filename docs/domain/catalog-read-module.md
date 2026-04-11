# Catalog Read Module

## 1. Purpose

`@web-vg/catalog` now exposes a catalog read/domain module for application-facing catalog querying.

It exists to keep:

- query logic out of `apps/web` pages and components;
- URL search-param parsing out of UI code;
- read-side catalog contracts separate from `packages/db` repository implementation.

This module is a domain/application read foundation, not a DB query layer and not a UI feature bundle.

## 2. Query Model

The core contract is `CatalogQuery`.

It includes:

- `searchText`
- `perspective`
  - `card-entity`
  - `card-printing`
- `filters`
  - `formatIds`
  - `eras`
  - `nations`
  - `clans`
  - `cardTypes`
  - `triggerTypes`
  - `rarities`
  - `productKeys`
- `sort`
- `window`
  - `page`
  - `pageSize`

The query model is not:

- raw URL params
- a Supabase query object
- a page-local React state blob

## 3. Search Params Parsing

`parseCatalogSearchParams(...)` converts raw URL-ish input into a normalized `CatalogQuery`.

Current supported params:

- `q`
- `perspective`
- `sort`
- `page`
- `pageSize`
- repeated or comma-separated filter params:
  - `format`
  - `era`
  - `nation`
  - `clan`
  - `type`
  - `trigger`
  - `rarity`
  - `product`

Normalization rules:

- empty values are dropped
- repeated values are deduplicated
- categorical filters normalize to trimmed lowercase tokens
- invalid `perspective`, `sort`, paging values, unsupported card types, and unsupported trigger types fall back safely

`catalogQueryToSearchParams(...)` serializes the normalized query back into stable params.

## 4. Filter Model

The filter model is intentionally small and domain-oriented.

It distinguishes:

- playable environment filters: `formatIds`
- historical/content classification: `eras`
- card metadata filters: `nations`, `clans`, `cardTypes`, `triggerTypes`
- release/catalog filters: `rarities`, `productKeys`

It does not encode widget state or UI layout choices.

## 5. Sorting Model

Supported sort options are deliberately bounded:

- `relevance`
- `name-asc`
- `grade-asc`
- `release-date-desc`

Default behavior:

- `relevance` when search text is present
- otherwise `name-asc` for `card-entity`
- otherwise `release-date-desc` for `card-printing`

## 6. Faceting Contracts

Faceting is represented through:

- `CatalogFacetValue`
- `CatalogFacet`
- `CatalogFacetResult`

Facet values carry:

- `value`
- `label`
- `count`
- `selected`

This is a read-model boundary for future list UX. It is not a full faceting engine and not a DB schema concept.

## 7. Card Lookup Contracts

Lookup contracts are explicit and target-specific:

- `CatalogCardEntityLookup`
  - by `id`
  - by `canonical-key`
- `CatalogCardPrintingLookup`
  - by `id`
  - by `printing-key`
- `CatalogProductLookup`
  - by `id`
  - by `canonical-key`

This keeps entity, printing, and product lookup semantics separate instead of collapsing everything into a generic string lookup.

## 8. Entity vs Printing Perspective

The module models entity vs printing as `perspective` inside `CatalogQuery`.

That means:

- list/search/filter contracts can already express whether the read surface is centered on canonical cards or printings
- UI does not need to invent that distinction page by page
- repositories can later accept one stable read-side vocabulary

This does not force a UI toggle yet. It just makes the distinction explicit at the read-model level.

## 9. What Is Intentionally Not Implemented Yet

- repository query execution
- faceting backend implementation
- search relevance implementation
- UI query-state management
- product page orchestration
- full catalog list/detail integration with this module
