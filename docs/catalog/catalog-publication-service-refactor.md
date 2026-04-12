# Catalog Publication Service Refactor

## 1. Purpose

Reduce `CatalogPublicationService` from a God Service into an explicit publication coordinator while preserving the existing importer -> publication -> catalog boundary and current publication behavior.

## 2. What was wrong with the previous service shape

The previous service mixed publication orchestration, product identity resolution, product/printing normalization, canonical key generation, and persistence payload shaping inside one file. The workflow was correct, but the implementation buried it under low-level transformation logic.

## 3. New responsibility split

- `catalog-publication.service.ts`: orchestration and final catalog writes
- `catalog-publication-unit-preparer.ts`: product/printing publication unit preparation and skip classification
- `catalog-publication-identity.ts`: product family inference and canonical product identity keying
- `catalog-publication-key-builder.ts`: canonical product key building, printing key building, and printing code parsing
- `catalog-publication-normalization.ts`: low-level string/date/locale/region/rarity normalization

## 4. What remains in `CatalogPublicationService`

`CatalogPublicationService` remains the single publication entrypoint. It loads raw publication inputs, runs the product publication step, runs the printing publication step, persists catalog records through the store, and returns the final publication summary.

## 5. What was extracted

The refactor extracted:

- product publication unit normalization and deduplication
- printing publication unit preparation and skip-reason classification
- product family resolution and product identity key creation
- canonical key / printing key generation
- low-level string and code normalization helpers

## 6. Behavioral compatibility

The refactor is intended to be behavior-preserving. Publication still publishes products before printings, uses product identity to preserve idempotent upserts, publishes only publishable normalization results, skips missing product / missing printing identity cases with the same reasons, and keeps card entity, printing, product, and traceability semantics intact.

## 7. Test impact

Existing publication integration coverage remains in place. Focused tests were added for extracted identity resolution and publication unit preparation so low-level behavior can be validated without going through the full service orchestration path.

## 8. Summary

This change removes hidden complexity from the publication entrypoint without changing the architecture. The publication boundary stays explicit, while identity resolution, normalization, and key shaping now live in dedicated modules that are easier to reason about and test in isolation.
