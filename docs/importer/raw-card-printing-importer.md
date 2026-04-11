# Raw Card-Printing Importer

## 1. Purpose

This step implements the raw importer write path for printing-level source
records.

It persists importer-owned raw printing facts, keeps them tied to
`import_sources` and `import_jobs`, and optionally links them to importer-owned
raw product context when that context is available in the same job.

It does not publish into final `catalog.card_printings` truth.

## 2. Scope

Included:

- raw printing-level metadata ingestion
- importer-owned raw printing persistence
- job/source linkage
- importer-layer linkage to raw product context
- repeated-import handling inside one job
- outcome reporting for created/updated/skipped and linked/unlinked printings

Excluded:

- canonical `CardEntity` matching
- normalized candidates
- publication into final catalog truth
- legality interpretation
- manual review workflow

## 3. Input Contract

The importer accepts:

- `importJobId`
- `printings[]`

Each printing input carries:

- `sourcePrintingId`
- `cardName`
- optional `sourceProductId`
- optional `sourceProductCode`
- optional printing-facing raw fields such as `printingCode`, `rarity`,
  `localeCode`, `regionCode`, `cardType`, `nation`, `clan`, `triggerType`,
  `gradeText`, `powerText`, `criticalText`, `shieldText`, `rulesText`
- `sourcePayload` as a JSON object

The importer requires an existing `import_jobs` row and derives source lineage
from that job.

## 4. Raw Printing Record Shape

Raw printing rows live in `importer.raw_card_printing_records`.

Stored fields:

- `import_job_id`
- `source_printing_id`
- `source_product_id`
- `source_product_code`
- `raw_product_record_id`
- `payload_fingerprint`
- `raw_card_name`
- `raw_printing_code`
- `raw_rarity`
- `raw_locale_code`
- `raw_region_code`
- `raw_card_type`
- `raw_nation`
- `raw_clan`
- `raw_trigger_type`
- `raw_grade_text`
- `raw_power_text`
- `raw_critical_text`
- `raw_shield_text`
- `raw_rules_text`
- `source_payload`
- timestamps

This is a structured/raw hybrid:

- key imported fields stay queryable without reparsing JSON
- raw payload is still preserved for later normalization and debugging

## 5. Relationship To Raw Product Records

Raw printing rows may link to `importer.raw_product_records` through
`raw_product_record_id`.

Linking strategy:

- first try `sourceProductId` against raw product rows in the same job
- if that is unavailable, fall back to `sourceProductCode`
- code fallback links only when exactly one raw product matches
- otherwise the printing stays unlinked at raw stage

This linkage is importer-layer context only. It is not equivalent to a
published `Product` relation.

## 6. Job / Source Traceability

Every raw printing row points to `import_jobs.id`.

Source traceability is derived through:

- `raw_card_printing_records.import_job_id -> import_jobs.source_id -> import_sources`

Per-record source traceability is preserved through:

- `source_printing_id`
- `source_product_id`
- `source_product_code`
- `payload_fingerprint`

## 7. Repeated Import Behavior

The raw-layer policy is:

- new job for the same source => new raw printing history for that job
- same `sourcePrintingId` inside one job => one active raw row
- same payload plus same resolved raw-product linkage inside one job => skip
- changed payload or changed resolved raw-product linkage inside one job =>
  update the same raw row

This preserves history per job while avoiding duplicate rows for the same
source printing inside one execution.

## 8. What This Step Explicitly Does Not Do

This importer does not:

- write to `catalog.card_printings`
- attach printings to canonical `CardEntity`
- decide reprint-vs-new-entity semantics
- publish product truth
- derive legality meaning
- create manual review workflow

## 9. Summary

The raw card-printing importer is a job-aware importer-owned write path for
printing-level source facts.

It gives the system:

- repeatable raw printing ingestion
- explicit source/job provenance
- importer-layer product-context linkage where available
- deterministic same-job dedupe/update behavior
- a clean foundation for later normalization into candidate and published
  layers
