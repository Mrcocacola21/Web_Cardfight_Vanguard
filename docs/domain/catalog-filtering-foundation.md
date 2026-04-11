# Catalog Filtering Foundation

## 1. Purpose

This foundation keeps catalog filtering coherent before the catalog surface grows into a large faceted UI.

It exists to make:

- format-aware filtering first-class;
- URL query state canonical and shareable;
- repository inputs normalized before persistence logic runs;
- card list pages consume one predictable filtering model instead of page-local glue.

## 2. What the filtering foundation owns

The filtering foundation owns:

- normalized catalog filter/query state;
- format-aware filter applicability;
- canonical search-param parsing and serialization;
- active-filter/query helpers;
- page-reset semantics when non-window query state changes.

It does not own:

- a full faceting engine;
- every possible catalog filter group beyond the current baseline;
- advanced relevance ranking;
- entity-vs-printing dual-view UX;
- client-side query-state orchestration outside catalog.

## 3. Format-aware filtering

Format filtering is modeled explicitly in `packages/catalog`.

Current format-aware behavior:

- `standard` is treated as `nation-based`;
- `v-premium` and `premium` are treated as `clan-based`;
- when a single active format is selected, incompatible identity filters are dropped during normalization;
- the card list UI uses the same applicability rules to disable the non-applicable identity control.

Repository-side format filtering remains server-driven:

- selected formats resolve active rule profiles;
- rule profiles resolve supported product families;
- product families resolve products and printings;
- eligible card entities are filtered from those printing relationships.

Supported filter groups on top of this foundation now are:

- `era`
- `nation`
- `clan`
- `type`
- `trigger`
- `rarity`
- `set`

`era` is product-lineage-facing rather than intrinsic card metadata:

- `d` -> `standard-lineage`
- `v` -> `v-lineage`
- `premium` -> `premium-lineage`
- `cross` -> `cross-lineage`

## 4. Shared query/filter behavior

Shared rules:

- URL params are parsed once through `parseCatalogSearchParams(...)`;
- defaults are applied centrally through `normalizeCatalogQuery(...)`;
- invalid values are dropped predictably;
- active query state is determined centrally, not in individual controls;
- entity-centric list routes still force `card-entity` perspective explicitly.

For the current entity-centric list route:

- `nation` / `clan` remain canonical-card identity filters;
- `era`, `rarity`, and `set` are printing/product-side filters that narrow the eligible printing pool first;
- a card entity stays in the result set when at least one published printing satisfies those printing-side filters.

## 5. Serialization and normalization

Canonical round-trip:

- raw params -> `parseCatalogSearchParams(...)`
- normalized query -> `catalogQueryToSearchParams(...)`

Current URL conventions:

- `format`
- `era`
- `nation`
- `clan`
- `type`
- `trigger`
- `rarity`
- `set`

Normalization currently covers:

- search text cleanup;
- supported sort fallback;
- page/pageSize bounds;
- filter deduplication;
- format-aware identity filter cleanup;
- supported era validation;
- canonical `set` serialization, while still accepting legacy `product` params on read.

## 6. Interaction with search, sorting, and pagination

Shared behavior:

- search, filters, and sort all participate in the same query model;
- `relevance` only survives when search text exists;
- pagination is window state, not part of active filter semantics;
- non-window query changes are treated as pagination-reset triggers through `shouldResetCatalogPagination(...)`.

Current `/catalog` flow keeps page numbers in the URL and uses classic pagination links.

## 7. Repository boundary

Repositories do not receive raw route params.

They receive normalized query/filter inputs, including:

- `formatIds`
- `eras`
- `nations`
- `clans`
- `cardTypes`
- `triggerTypes`
- `rarities`
- `productKeys`
- `sort`
- `page`
- `pageSize`

Persistence-specific resolution of format, era, rarity, and set filters stays inside `packages/db`.

## 8. What is intentionally not implemented yet

Not implemented in this step:

- full facet counts for every filter group;
- exhaustive format-specific filter groups;
- printing-centric list mode;
- global query-state framework outside catalog;
- advanced search or ranking behavior.
