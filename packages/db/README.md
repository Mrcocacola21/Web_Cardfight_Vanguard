# packages/db

Purpose:

- Provide narrow persistence-facing and database-related foundations when implementation begins.

Expected ownership:

- low-level database bootstrap and infrastructure helpers;
- persistence plumbing that is intentionally shared.
- SQL schema and migration assets for the shared physical datastore.
- generated database types derived from the real Supabase/Postgres schema.

Must not own:

- domain truth;
- canonical catalog meaning;
- legality or gameplay semantics;
- shared domain storage models across contexts.

Dependency expectation:

- This package should stay infrastructure-only.
- It must not become the real architecture owner through convenience.
- Supabase/Postgres schema artifacts may live outside `src/` when that keeps runtime code and database assets clearly separated.
- DB types should be generated into `src/generated`, not handwritten into runtime modules.
- Multi-table write atomicity should be handled through DB-side transactional
  units called by repositories, not by UI or ad-hoc chained queries.
