# Raw Product Importer

## 1. Purpose

This step implements the first real importer write path for product/set metadata.

It ingests raw product facts into importer-owned persistence and keeps them
traceable to `import_sources` and `import_jobs`.

It does not publish into final catalog truth.

## 2. Scope

Included:

- raw product/set metadata ingestion
- importer-owned raw persistence
- job/source linkage
- repeated-import handling inside the raw layer
- outcome reporting for created/updated/skipped records

Excluded:

- card printings
- canonical card/entity linkage
- normalization candidates
- publication into `catalog.products`
- manual review workflow

## 3. Input Contract

The importer accepts:

- `importJobId`
- `products[]`

Each product input carries:

- `sourceProductId`
- `name`
- optional raw release fields such as `code`, `productCategory`, `productKind`,
  `familyName`, `releaseDateText`, `regionCode`
- `sourcePayload` as a JSON object

The importer requires an existing `import_jobs` row and uses that job to derive
the owning source.

## 4. Raw Product Record Shape

Raw product rows live in `importer.raw_product_records`.

Stored fields:

- `import_job_id`
- `source_product_id`
- `payload_fingerprint`
- `raw_name`
- `raw_code`
- `raw_product_category`
- `raw_product_kind`
- `raw_family_name`
- `raw_release_date_text`
- `raw_region_code`
- `source_payload`
- timestamps

This is intentionally a structured/raw hybrid:

- key source-facing fields are queryable without re-parsing JSON
- the source payload is still preserved for debugging and later normalization

## 5. Job / Source Traceability

Every raw product record points to `import_jobs.id`.

Source traceability is derived through:

- `raw_product_records.import_job_id -> import_jobs.source_id -> import_sources`

This means later stages can answer:

- which source defined this import
- which job ingested this raw product
- which upstream `sourceProductId` the source provided

## 6. Repeated Import Behavior

The raw-layer policy is:

- new job for the same source => new raw record history for that job
- same `sourceProductId` inside the same job => one active raw row
- same payload within the same job => skip
- changed payload within the same job => update the same raw row

This keeps per-job history intact without allowing duplicate rows for the same
source product inside one execution.

## 7. What This Step Explicitly Does Not Do

This importer does not:

- write to `catalog.products`
- create normalized product candidates
- infer canonical product taxonomy as final truth
- ingest card printings
- create `CardEntity` or `CardPrinting` truth
- implement review queues or publication logic

## 8. Summary

The raw product importer is a job-aware importer-owned write path.

It gives the system:

- repeatable raw product ingestion
- explicit job/source provenance
- deterministic same-job dedupe/update behavior
- a clean foundation for later normalization and publication
