# packages/importer

Purpose:

- Own the ingestion and normalization boundary.

Expected ownership:

- raw source acquisition;
- raw import records;
- parsing and normalization flow;
- normalized candidates;
- source mappings;
- provenance;
- manual review preparation and related workflow state.

Must not own:

- canonical catalog truth after publication;
- legality policy;
- gameplay meaning.

Dependency expectation:

- May depend on shared contracts and narrow persistence support.
- Must not leak raw importer concerns into runtime packages.

Current local developer entrypoint:

- `corepack pnpm importer:dev-json -- ./packages/importer/fixtures/dev-json/sample-standard-with-review.json`

Included example fixtures:

- `packages/importer/fixtures/dev-json/sample-raw-only.json`
- `packages/importer/fixtures/dev-json/sample-standard-with-review.json`

The dev JSON path is intentionally development-only. It creates tracked import sources/jobs, routes through raw product/raw printing importers, can run normalization/manual-review creation, and does not publish into final catalog truth.
