# packages/catalog

Purpose:

- Own the catalog domain boundary.

Expected ownership:

- canonical cards;
- printings;
- product and set metadata;
- catalog-facing read models and projections.

Must not own:

- raw importer workflow state;
- legality semantics;
- gameplay runtime logic.

Dependency expectation:

- May depend on narrow shared contracts and later on persistence plumbing.
- Must not depend on app-layer code or gameplay internals.
