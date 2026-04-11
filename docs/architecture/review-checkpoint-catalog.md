# Catalog Review Checkpoint

Date: 2026-04-09
Verdict: GO WITH CONDITIONS

## 1. Executive Summary

The current catalog core is architecturally coherent and already behaves like
one subsystem instead of a stack of unrelated pages. Query parsing lives in the
catalog domain module, repositories still own persistence, and the three
identity surfaces are mostly clear:

- `/catalog` stays entity-centric
- `/catalog/[cardKey]` stays canonical-card-centric
- `/catalog/printings/[printingKey]` stays printing-centric
- `/catalog/products/[productKey]` stays product-centric

There are no current blockers strong enough to justify a `HOLD`. The main risks
are readiness and semantic drift under growth:

- the list UI exposes only single-select controls even though the canonical
  query model is multi-select
- faceting contracts exist, but runtime filter options are still static rather
  than data-driven
- search currently offers a `relevance` sort contract without a real ranking
  implementation
- the filter-heavy list path will be the first query-performance pressure point
  once the dataset grows

The catalog is safe to expand, but not safe to treat as “finished core”.

## 2. Scope Reviewed

Reviewed areas:

- `packages/catalog` query model, parsing, normalization, lookup contracts
- `packages/db` catalog repositories and mapping layer
- catalog list read flow and `/catalog`
- canonical card detail flow and `/catalog/[cardKey]`
- printing detail flow and `/catalog/printings/[printingKey]`
- product detail flow and `/catalog/products/[productKey]`
- filter UI composition, search UX, pagination behavior, and shared UI reuse
- current catalog-focused tests in `packages/catalog`, `packages/db`, and
  `apps/web`

Not reviewed:

- DB indexing strategy
- importer correctness
- gameplay/rules execution behavior
- deck builder integration
- full e2e catalog browsing matrix

## 3. Query Performance Review

Status: acceptable with conditions

What looks good:

- detail flows are bounded
  - canonical card detail: one card read + one printing list + one legality
    aggregate path
  - printing detail: one printing read + one sibling printing list
  - product detail: one product read + one product printing list
- list rows are reasonably list-shaped and do not overfetch detail-only sections
  such as legality payloads
- there is no obvious page-level N+1 pattern in React

Current pressure point:

- entity list queries with format/era/rarity/set filters do multiple sequential
  resolution steps before the final card-entity query:
  - active rule profiles
  - supported product families
  - product families by era
  - products
  - printings
  - final card entity select

This is still acceptable for the current phase, but it is the first place where
catalog growth will become expensive.

## 4. Faceting Review

Status: acceptable, but not implemented beyond contracts

What is true today:

- facet contracts are well-defined in `packages/catalog`
- active filters and canonical filter normalization are real
- runtime facet counts are not implemented
- current filter options are mostly static UI option lists

This means the system is not lying with fake counts, but it is not yet a real
faceted browsing experience. The contract layer is stronger than the runtime
filter-option source.

## 5. Search UX Review

Status: acceptable with conditions

Strengths:

- search is URL-driven and survives refresh/navigation
- back/forward behavior stays predictable
- empty results are handled honestly
- pagination resets coherently because GET form submission drops the current
  page when search/filter inputs change

Weak point:

- the search flow still exposes `relevance` / `Best match`, but repository
  sorting currently falls back to alphabetical `normalized_name` ordering

This is not a broken flow, but it is a misleading label/contract.

## 6. View Consistency Review

Status: strong

The current catalog surfaces reinforce identity levels well:

- `/catalog` clearly labels itself as an entity-centric list
- canonical card detail keeps printings and products subordinate
- printing detail is explicitly printing-centric and links back to both the
  canonical card and the release container
- product detail remains release-centric and treats printings as the primary
  list content

No evidence was found of route-level identity blur such as one URL silently
changing between entity and printing semantics.

## 7. Filtering Consistency Review

Status: acceptable with conditions

What holds:

- parsing/serialization/normalization remain centralized
- format-aware nation-vs-clan behavior is still coherent
- printing-derived filters such as rarity and set still resolve back to
  canonical entity results intentionally
- invalid values are normalized out predictably

Main drift:

- the canonical query model is multi-select, but the current `/catalog` filter
  UI only renders one visible value per group

This creates a mismatch between what the URL/domain layer can express and what
the list page can honestly represent/edit.

## 8. Repository/Read-Model Boundary Review

Status: strong

Observations:

- repositories still return mapped read models rather than raw rows
- app server helpers compose page-ready view models on the server side
- pages do not own DB logic
- lookup intent remains explicit:
  - entity lookup
  - printing lookup
  - product lookup

The main caution here is not boundary leakage. It is the growing amount of
runtime catalog behavior that depends on static UI filter metadata rather than a
data-driven filter source.

## 9. Test Posture Review

Status: acceptable with conditions

What is covered:

- query parsing/normalization in `packages/catalog`
- repository filter interpretation in `packages/db`
- list-page query delegation and redirect behavior in `apps/web`
- canonical card detail, printing detail, and product detail server helpers
- targeted rendering tests for list/detail/product/printing catalog surfaces

What is still risky:

- no tests currently protect multi-value filter state at the UI surface
- no performance-shape tests exist for large filter result sets
- no runtime facet-result tests exist, because runtime facets do not exist yet

The coverage is meaningful for the current phase, but it does not yet protect
every future catalog-growth risk.

## 10. Top Findings

### MEDIUM: The list UI is single-select while the canonical query model is multi-select

- Issue:
  - `CatalogFilterModel` supports arrays for format/era/nation/clan/type/trigger/rarity/set
  - `/catalog` only renders the first active value from each group and edits it
    through single-value selects
- Why it matters:
  - multi-value URLs are valid in the domain layer but not honestly represented
    in the UI
  - submitting the form from such a URL will silently collapse extra values
- Evidence:
  - `packages/catalog/src/catalog-query.ts`
  - `apps/web/src/components/catalog/catalog-list-view.tsx`
- Recommendation:
  - either constrain the current list surface to explicit single-select
    semantics in the domain/app layer, or add real multi-select UI before
    expanding filter complexity further

### MEDIUM: Search still exposes a “relevance” contract without actual ranking

- Issue:
  - the domain/query layer defaults search-driven entity queries to `relevance`
  - the list UI exposes `Best match`
  - repository sorting currently treats that as alphabetical name order
- Why it matters:
  - users are told they are seeing best-match ranking when they are not
  - this also leaves two effectively overlapping sort states on the entity list
- Evidence:
  - `packages/catalog/src/catalog-query.ts`
  - `apps/web/src/components/catalog/catalog-list-view.tsx`
  - `packages/db/src/repositories/catalog/catalog.repository.ts`
- Recommendation:
  - either implement real search ranking or collapse the entity-list search sort
    surface to honest alphabetical behavior for now

### MEDIUM: Faceting is contract-ready, but runtime filter options are still static

- Issue:
  - facet contracts exist, but runtime filter availability is not repository- or
    facet-driven
  - set/clan/nation option sources are currently hardcoded in the web layer
- Why it matters:
  - the UI will drift from the dataset as soon as catalog breadth grows
  - the filter surface looks structured, but it is not yet data-informed
- Evidence:
  - `packages/catalog/src/catalog-query.ts`
  - `apps/web/src/features/catalog/catalog-filter-options.ts`
- Recommendation:
  - before broader catalog expansion, move at least set and major identity
    filters toward repository-backed option/facet payloads

### MEDIUM: Filter-heavy entity queries will be the first performance hotspot as data grows

- Issue:
  - format/era/rarity/set filters resolve through multiple sequential queries
    before the final `card_entities` select
  - the final entity query depends on a materialized `IN (eligible ids...)`
    style narrowing
- Why it matters:
  - current performance is probably fine for the seed dataset, but this shape
    will scale poorly before the rest of the catalog is large enough to justify
    surprise query debt
- Evidence:
  - `packages/db/src/repositories/catalog/catalog.repository.ts`
- Recommendation:
  - keep this architecture for now, but treat it as the first place to optimize
    when facet data, bigger products, or wider printing coverage arrive

### LOW: Current tests do not protect the biggest UI/query drift area

- Issue:
  - tests cover parsing, repository semantics, and targeted detail flows, but
    they do not protect multi-value list-query behavior at the rendered UI
    surface
- Why it matters:
  - the most likely future regression is at the app-layer bridge between the
    canonical query model and the current single-value filter controls
- Evidence:
  - `apps/web/src/features/catalog/catalog-list-query.test.ts`
  - `apps/web/src/components/catalog/catalog-list-view.test.tsx`
- Recommendation:
  - when the filter UI evolves next, add one focused regression test around a
    multi-value query state rather than expanding the whole test matrix

## 11. Fixes Applied

- No code changes were applied in this checkpoint.
- The current issues are real, but none justified a safe review-only patch
  without choosing new product behavior.

## 12. Final Verdict

Verdict: GO WITH CONDITIONS

Why:

- the catalog core is architecturally coherent
- entity vs printing vs product semantics are clear
- query and repository boundaries remain intact
- the current list/detail/product flows are usable and reasonably bounded

Conditions:

- do not keep calling the current search sort `relevance` if no real ranking is
  added
- resolve the single-select UI vs multi-select query-model mismatch before
  filter complexity grows much further
- move static filter options toward repository-/facet-backed data before the
  catalog breadth expands substantially
- treat the filter-heavy list query path as the first optimization target, not a
  forgotten implementation detail
