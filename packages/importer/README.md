# packages/importer

Purpose:

- Own the ingestion and normalization boundary.

Expected ownership:

- raw source acquisition;
- parsing and normalization flow;
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
