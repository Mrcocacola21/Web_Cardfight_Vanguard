# Catalog Tests Checkpoint

Date: 2026-04-09
Verdict: GO WITH CONDITIONS

## 1. Scope of This Checkpoint

This checkpoint validates the current catalog core at the boundary levels that
actually carry semantics today:

- domain query parsing and normalization
- filter semantics
- list loader/query path
- canonical card detail flow
- product/set detail flow
- printing detail flow
- entity-vs-printing lookup and route semantics

Included:

- search params parsing / serialization
- format-aware filter normalization
- list-page query interpretation
- repository-side filter mapping
- server-side detail loaders
- route-level not-found and error handling for catalog detail pages

Intentionally not included:

- full browser e2e matrix
- performance benchmarking
- exhaustive UI interaction coverage
- facet-count runtime behavior, because runtime facets are not implemented yet

## 2. What Was Tested

Current catalog coverage now spans three practical layers:

- `packages/catalog`
  - canonical query model
  - search params parsing / serialization
  - lookup contracts
- `packages/db`
  - repository filter interpretation
  - mapped read models for list/detail/product/printing flows
- `apps/web`
  - page-level query delegation
  - server-side loader composition
  - route-level not-found and error behavior
  - targeted rendering of list/detail/product/printing catalog surfaces

Strengthened in this checkpoint:

- multi-value search-param round-trip protection
- list-route canonicalization tests for entity-centric `/catalog`
- route tests for:
  - `/catalog/[cardKey]`
  - `/catalog/products/[productKey]`
  - `/catalog/printings/[printingKey]`

## 3. Search Params Coverage

Covered:

- valid parsing of `q`, `perspective`, `sort`, `page`, `pageSize`
- parsing of repeated and comma-separated filter params
- default values for missing params
- invalid/unknown param normalization
- format-aware nation/clan normalization during parsing
- canonical serialization back into stable search params
- legacy `product` param normalization back to canonical `set`
- multi-value filter round-trips through parse/serialize

Main files:

- `packages/catalog/src/catalog-search-params.test.ts`
- `packages/catalog/src/catalog-query.test.ts`
- `apps/web/src/features/catalog/catalog-list-query.test.ts`

## 4. Filter Coverage

Covered:

- format-aware filter behavior
  - `standard` keeps nation-led filtering
  - `premium` / `v-premium` switch toward clan-led filtering
- normalization of:
  - era
  - nation
  - clan
  - type
  - trigger
  - rarity
  - set/product
- repository interpretation of printing-derived filters:
  - format
  - era
  - rarity
  - set
- preservation of multi-value filter state in the canonical query layer

Main files:

- `packages/catalog/src/catalog-query.test.ts`
- `packages/catalog/src/catalog-search-params.test.ts`
- `packages/db/src/repositories/catalog/catalog.repository.test.ts`
- `apps/web/src/features/catalog/catalog-list-query.test.ts`

## 5. Loader / List Flow Coverage

Covered:

- `/catalog` search params are interpreted through the catalog query module
- list loader receives normalized entity-centric query input
- oversized page numbers redirect back to the last valid page
- list view renders active search/filter state from canonical query state
- empty list results produce an explicit resettable empty state

Main files:

- `apps/web/src/app/catalog/page.test.tsx`
- `apps/web/src/components/catalog/catalog-list-view.test.tsx`
- `apps/web/src/features/catalog/server/catalog-read.test.ts`

## 6. Detail Flow Coverage

Covered:

- canonical card detail:
  - invalid key -> null before persistence
  - mapped read model assembly
  - route-level not-found behavior
  - route-level error state
- product detail:
  - invalid key -> null before persistence
  - mapped release/printing summary assembly
  - route-level not-found behavior
  - route-level error state
- printing detail:
  - invalid key -> null before persistence
  - mapped printing + sibling-printings assembly
  - route-level not-found behavior
  - route-level error state

Main files:

- `apps/web/src/features/catalog/server/catalog-read.test.ts`
- `apps/web/src/features/catalog/server/catalog-product-read.test.ts`
- `apps/web/src/features/catalog/server/catalog-printing-read.test.ts`
- `apps/web/src/app/catalog/[cardKey]/page.test.tsx`
- `apps/web/src/app/catalog/products/[productKey]/page.test.tsx`
- `apps/web/src/app/catalog/printings/[printingKey]/page.test.tsx`

## 7. Entity vs Printing Coverage

Covered:

- explicit lookup distinction between:
  - `CardEntity`
  - `CardPrinting`
  - `Product`
- canonical entity detail remains entity-centric
- printing detail remains printing-centric
- product detail remains product-centric
- `/catalog` route canonicalizes back to entity-centric semantics even when the
  raw URL tries to introduce printing perspective

Main files:

- `packages/catalog/src/catalog-lookups.test.ts`
- `packages/catalog/src/catalog-query.test.ts`
- `apps/web/src/features/catalog/catalog-list-query.test.ts`
- `apps/web/src/features/catalog/server/catalog-printing-read.test.ts`
- `apps/web/src/components/catalog/catalog-card-detail-view.test.tsx`
- `apps/web/src/components/catalog/catalog-printing-detail-view.test.tsx`
- `apps/web/src/components/catalog/catalog-product-detail-view.test.tsx`

## 8. What Is Still Not Covered

- no browser-level catalog e2e flow currently validates search/filter/back-forward
  behavior in a real running app
- no runtime facet-result tests exist, because runtime facet counts/options are
  not implemented yet
- no performance-shape tests or large-dataset query regression tests exist
- the current UI/query mismatch around multi-value filters is now visible in
  tests at the domain/app helper layer, but there is still no rendered UI test
  for how a real multi-value URL should be surfaced to the user

## 9. Current Risks

### Issue: Browser-level catalog journey coverage is still absent

- Severity: MEDIUM
- Why it matters: URL-driven search/filter behavior is heavily tested at the
  domain/app boundary, but not yet exercised through a real browser flow.
- Recommendation: add one small catalog e2e smoke later, focused on `/catalog`
  search + filter + back/forward behavior.

### Issue: Multi-value filter semantics are protected in the query layer more than in the rendered UI

- Severity: MEDIUM
- Why it matters: the canonical model supports multi-value filters, while the
  current `/catalog` UI is still single-select-oriented.
- Recommendation: when the list filter UI evolves next, add one regression test
  that starts from a multi-value URL and asserts the intended UI policy.

### Issue: Faceting contracts are covered as contracts, not as runtime behavior

- Severity: LOW
- Why it matters: the model is test-protected, but there are no live facet
  payloads to validate yet.
- Recommendation: once runtime facets exist, add repository + server-helper
  coverage specifically for facet counts and selected-state accuracy.

## 10. Verdict

`GO WITH CONDITIONS`

Why:

- the current catalog semantics are materially protected by tests at the right
  layers
- search params, filters, loaders, and detail flows now have meaningful
  boundary coverage
- entity-vs-printing distinctions are no longer protected only by intent and UI
  wording

Conditions:

- do not overclaim browser/e2e coverage that does not exist yet
- keep future filter UI work aligned with the already-tested canonical query
  model
- add a small real browser catalog smoke only when the next expansion makes the
  user journey itself load-bearing
