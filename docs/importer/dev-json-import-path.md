# Dev JSON Import Path

## Purpose

Provide a local developer-oriented entrypoint that feeds structured JSON into the real importer pipeline stages without requiring a production upstream parser.

## Scope

This path supports:

- tracked `import_sources` / `import_jobs` creation for a dev JSON source;
- raw product import;
- raw card-printing import;
- optional normalization and manual-review queue creation.

It does not publish into final catalog truth.

## JSON Input Contract

Top-level shape:

```json
{
  "source": {
    "key": "dev-json.sample",
    "displayName": "Dev JSON sample",
    "providerName": "local-dev",
    "originUri": "file:///optional/custom-origin",
    "snapshotKey": "sample-v1",
    "configuration": {}
  },
  "job": {
    "scopeMetadata": {}
  },
  "options": {
    "runNormalization": true,
    "normalizationVersion": "card-printing-normalizer/v1"
  },
  "products": [],
  "printings": []
}
```

Required:

- `source.key`
- `source.displayName`
- at least one item in `products` or `printings`

Product items represent raw product facts:

- `sourceProductId`
- `name`
- optional `code`, `productCategory`, `productKind`, `familyName`, `releaseDateText`, `regionCode`, `sourcePayload`

Printing items represent raw printing facts:

- `sourcePrintingId`
- `cardName`
- optional `sourceProductId`, `sourceProductCode`, `printingCode`, `rarity`, `localeCode`, `regionCode`, `cardType`, `nation`, `clan`, `triggerType`, `gradeText`, `powerText`, `criticalText`, `shieldText`, `rulesText`, `sourcePayload`

The contract is dev-focused, explicit, and intentionally narrower than a future real upstream adapter.

## How The Dev Path Enters The Pipeline

The dev path is modeled as a real tracked source with `source_type = "dev_json"`.

One run does the following:

1. Read and validate the local JSON file.
2. Upsert `import_sources`.
3. Create a new `import_jobs` row.
4. Route products through the raw product importer.
5. Route printings through the raw card-printing importer.
6. Optionally run normalization, which can also create manual-review items.
7. Finalize the job as raw-only complete, normalization complete, or blocked for review.

No step bypasses the raw layer or writes into published catalog truth.

## Job/Source Traceability

Traceability remains first-class:

- `import_sources` keep stable dev source identity by `(source_type, source_key)`;
- every run creates a new `import_jobs` row;
- `input_fingerprint` captures normalized document content;
- `scope_metadata` records dev-json execution facts such as file path and item counts;
- raw importers and normalization keep their existing job-based lineage.

## Raw Import Integration

The dev path reuses the existing importer services:

- raw product records go through the raw product importer;
- raw printing records go through the raw card-printing importer.

This avoids a second ad-hoc importer stack and preserves the same raw-layer semantics, idempotency behavior, and traceability rules.

## Optional Normalization/Review Integration

`options.runNormalization` defaults to `true`.

When enabled and printing records are present:

- the card-printing normalizer runs after raw import;
- manual-review items may be created for unresolved, ambiguous, conflicting, or exceptional cases;
- the job can end in `blocked_for_review`.

When disabled, the run stops after raw import and the job is finalized as raw-only partial completion.

## Repeated Import Behavior

Repeated runs of the same dev source:

- reuse the same `import_sources` row when `source.key` is unchanged;
- create a new `import_jobs` row per run;
- preserve raw history per job;
- remain explainable via `input_fingerprint` and `snapshotKey`.

This keeps local development reproducible without pretending that repeated imports are no-ops.

## Example Fixtures

Included fixtures:

- `packages/importer/fixtures/dev-json/sample-raw-only.json`
- `packages/importer/fixtures/dev-json/sample-standard-with-review.json`
- `packages/importer/fixtures/dev-json/content-wave-1-standard-ddz-minimal.json`

The first exercises raw import only. The second exercises raw import plus
normalization/manual-review creation. The third is the small realistic Standard
D/DZ seed wave for content-oriented importer runs.

## What This Step Explicitly Does NOT Do

- production upstream parsing or scraping
- generic source adapter framework
- admin upload UI
- scheduling/orchestration platform
- final publication into catalog truth

## Summary

The dev JSON import path is a practical local entrypoint for exercising the real importer pipeline stages before a production-grade upstream adapter exists. It is explicitly dev-only, fully traceable, and stops before publication.
