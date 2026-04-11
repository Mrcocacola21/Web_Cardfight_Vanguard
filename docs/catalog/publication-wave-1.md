# Publication Wave 1

## 1. Purpose

Record the first wave-1 publication outcome for catalog truth and confirm that
publication preserves `CardEntity` vs `CardPrinting` semantics, keeps
traceability, and excludes unresolved normalization cases.

## 2. Input (Wave-1 Normalization Outcome)

Wave-1 publication reads normalization outputs from import job `job-1`.

Input summary:

- total normalization results: `4`
- publishable: `3`
- unresolved and skipped: `1`

Canonical inputs:

- `Apex Ruler, Bastion` -> `entity-bastion`
- `Fated One of Miracles, Rezael` regular -> `entity-rezael`
- `Fated One of Miracles, Rezael` DSR -> `entity-rezael`
- `Fated One of Time, Liael=Amorta` -> unresolved

## 3. Published Records

Wave-1 publication creates:

- `3` catalog `products`
- `3` catalog `card_printings`

Published printings:

- `Apex Ruler, Bastion`
- `Fated One of Miracles, Rezael` regular
- `Fated One of Miracles, Rezael` DSR

Each published printing stores provenance:

- `source_import_job_id`
- `source_normalization_result_id`
- `source_raw_card_printing_record_id`
- `source_raw_product_record_id`

## 4. Skipped Records (`Liael`)

`Fated One of Time, Liael=Amorta` is not published.

Reason:

- normalization status is `unresolved`
- the record remains review-owned
- publication does not apply a fallback canonical attachment

## 5. Entity vs Printing Verification

Publication preserves the intended model:

- `Bastion` becomes one published printing attached to `entity-bastion`
- `Rezael` becomes two published printing rows attached to the same
  `entity-rezael`
- the two `Rezael` printings remain distinct via separate `printing_key` values

This means publication does not duplicate the canonical entity and does not
collapse printings into the entity row.

## 6. Traceability Verification

Published rows can be traced back through:

- `catalog.card_printings.source_import_job_id`
- `catalog.card_printings.source_normalization_result_id`
- `catalog.card_printings.source_raw_card_printing_record_id`
- `catalog.card_printings.source_raw_product_record_id`

Published products carry:

- `catalog.products.source_import_job_id`
- `catalog.products.source_raw_product_record_id`

This is enough to explain:

- which import job produced the catalog row
- which normalization result authorized publication
- which raw product / raw printing it came from

## 7. Idempotency Verification

Publication is idempotent.

Strategy:

- products upsert by stable catalog identity
- printings upsert by deterministic `printing_key`
- provenance is additionally protected by unique source references

Result:

- rerunning publication for `job-1` does not create duplicate products
- rerunning publication for `job-1` does not create duplicate printings

## 8. Result Summary

Wave 1 publication is now implemented as an explicit catalog write boundary:

- only publishable normalization results cross into catalog truth
- unresolved `Liael` remains out of catalog
- `Rezael` keeps two printing rows and one shared canonical entity reference
- provenance is stored on published records
- reruns converge instead of duplicating rows

This is sufficient foundation for wave-1 catalog-facing UI work, provided that
UI reads published catalog data only and does not treat unresolved importer
cases as catalog truth.
