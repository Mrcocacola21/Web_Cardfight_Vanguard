# Publication Foundation for Wave 1

## 1. Purpose

Define the first explicit publication boundary between the importer pipeline and
catalog truth for wave 1.

This document is a design foundation for the next step. It does not implement
publication, does not mutate catalog truth, and does not change importer
workflow ownership.

## 2. Current Wave-1 Context

Wave-1 importer outcome already exists and is the input context for this
foundation:

- raw products: `3`
- raw printings: `4`
- normalization:
  - auto-resolved: `3`
  - unresolved: `1`
- canonical attachments:
  - `Apex Ruler, Bastion` -> `entity-bastion`
  - `Fated One of Miracles, Rezael` regular -> `entity-rezael`
  - `Fated One of Miracles, Rezael` DSR -> `entity-rezael`
  - `Fated One of Time, Liael=Amorta` -> unresolved
- review queue:
  - `1` open `unresolved_mapping` item

This means wave 1 currently has exactly three candidate printings that are
semantically eligible for publication from the entity-vs-printing correctness
perspective.

## 3. Publishable vs Non-Publishable Outcomes

### Publishable

Wave-1 publication should accept only normalization outcomes that are both:

- resolved enough to reference one canonical `CardEntity`
- explicitly marked as publication-safe by policy

Policy:

- `auto_resolved` is publishable
- `manually_resolved` is publishable once that state exists as an explicit
  publication input

Additional requirement:

- publishable input must carry a non-null canonical entity reference

### Non-Publishable

The following are not publishable:

- `unresolved`
- `ambiguous`
- `blocked_for_review`
- `superseded`
- any result that claims to be resolved but still lacks a canonical entity id

Why:

- publication must never guess through unresolved identity
- review-owned cases must remain in importer workflow until they are explicitly
  resolved

Contract artifact:

- [`isNormalizationResultPublishable`](/C:/codes/Web_VG/packages/catalog/src/publication.ts)

## 4. Publication Unit Definition

Wave-1 publication is defined as **printing-level publication**.

One publication unit equals:

- one publishable normalization result
- for one `CardPrinting`
- attached to one already-known canonical `CardEntity`
- and one already-known catalog `Product`

Important consequences:

- publication is not entity-level for wave 1
- one canonical entity may yield multiple publication units
- `Rezael` therefore produces two publication units, not one

Batching:

- the service may run per `import_job_id`
- but the write unit remains per printing

## 5. Catalog Data Model (High-Level)

### Existing catalog truth roles

- `catalog.card_entities`
  - remains the canonical gameplay identity store
  - wave-1 publication references it
  - wave-1 publication does not create new entities
- `catalog.card_printings`
  - is the main write target for wave-1 publication
  - each published row represents one concrete printing
- `catalog.products`
  - remains the product/set truth referenced by published printings

### Wave-1 publication requirement

Wave-1 publication should only publish printing rows against:

- an existing canonical `card_entity_id`
- an existing catalog `product_id`

This keeps the first implementation narrow and prevents publication from
quietly becoming product normalization or canonical entity creation.

### Traceability fields on published printings

Each published catalog printing should store stable provenance references:

- `source_import_job_id`
- `source_normalization_result_id`
- `source_raw_card_printing_record_id`
- `source_raw_product_record_id`

Optional later extension:

- a separate publication-event table if the team wants historical republish
  lineage beyond the current active provenance markers

### Product publication note

Wave-1 foundation does **not** treat raw product rows as automatically safe
catalog input.

For implementation, one of these must be made explicit:

1. the referenced products already exist in catalog truth; or
2. a separate explicit product publication substep is introduced.

Publication must not silently copy raw product rows into catalog truth.

## 6. Publication Service Design

Suggested boundary:

- `CatalogPublicationService`

Suggested input:

- `importJobId`
- optional `normalizationResultIds`
- optional `dryRun`

Suggested output:

- attempted count
- publishable count
- published printing count
- skipped results with explicit reasons

Suggested internal steps:

1. Load normalization outputs for the requested job or explicit result set.
2. Keep only publishable results by policy.
3. Reject or skip any result missing:
   - canonical entity reference
   - catalog product reference
   - deterministic printing identity
4. Build printing-level publication units.
5. Upsert `catalog.card_printings`.
6. Return a batch summary.

Boundary rule:

- the service reads publication-ready normalization outputs
- the service writes catalog truth
- the service does not mutate raw rows, normalization rows, or review items

Contract scaffold:

- [`CatalogPublicationService`](/C:/codes/Web_VG/packages/catalog/src/publication.ts)
- [`CatalogPrintingPublicationUnit`](/C:/codes/Web_VG/packages/catalog/src/publication.ts)

## 7. Review Case Handling

`Liael=Amorta` is the explicit wave-1 review case.

Current behavior:

- it stays unresolved
- it stays in the review queue
- it is excluded from publication

Publication rule:

- unresolved or review-blocked cases are skipped, not guessed through

Future path:

- once a manual review decision is materialized into an explicit resolved
  publication input, the case may become publishable as `manually_resolved`
- review queue state itself is not catalog truth and is not published directly

## 8. Traceability Model

Required publication lineage:

- published printing -> `import_job_id`
- published printing -> `normalization_result_id`
- published printing -> `raw_card_printing_id`
- published printing -> `raw_product_id` when applicable

Why these fields matter:

- auditability
- debugging bad publication outcomes
- re-import and republish safety
- ability to explain how a catalog printing entered the system

What should not cross into catalog truth:

- raw payload blobs
- parser traces
- matching heuristics
- review notes as ordinary catalog data

## 9. Idempotency Strategy

Publication must be idempotent.

Expected behavior on rerun:

- rerunning publication for the same job must not create duplicate printings
- rerunning publication for the same normalization result must converge on the
  same catalog printing row

Recommended strategy:

- deterministic catalog `printing_key`
- upsert by that stable printing identity
- unique provenance constraint on `source_normalization_result_id`

Why both are useful:

- `printing_key` protects the catalog-facing identity
- `source_normalization_result_id` protects the publication lineage path

Non-publishable results should remain deterministic too:

- they are skipped again
- they do not create partial catalog rows

## 10. Boundaries and Non-Goals

Publication foundation for wave 1 does:

- define which normalization outputs may cross into catalog truth
- define publication as printing-level
- define provenance requirements
- define idempotent batch behavior

It does not:

- implement the publication service yet
- mutate catalog truth in this step
- change importer behavior
- auto-publish review cases
- create new canonical entities from unresolved input
- treat raw product rows as implicitly publishable

## 11. Open Questions / Future Extensions

1. Product publication prerequisite
   - Should wave 1 require products to pre-exist in catalog truth, or should a
     separate explicit product publication substep be added first?
2. Manual resolution materialization
   - Should `manually_resolved` become a normalization status, or a separate
     publication-ready review output?
3. Historical publication lineage
   - Are active provenance fields enough, or is a dedicated publication-event
     log needed once re-publication becomes common?

## Summary

Wave-1 publication foundation is deliberately narrow:

- publish only printing-level results
- only from explicitly publishable normalization outcomes
- only with canonical entity reference and catalog product reference
- always with provenance
- never for unresolved or review-blocked cases

This keeps publication separate from importer, preserves entity-vs-printing
semantics, and gives the project a safe base for the next step.
