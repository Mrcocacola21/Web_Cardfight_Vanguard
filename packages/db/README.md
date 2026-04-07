# packages/db

Purpose:

- Provide narrow persistence-facing and database-related foundations when implementation begins.

Expected ownership:

- low-level database bootstrap and infrastructure helpers;
- persistence plumbing that is intentionally shared.

Must not own:

- domain truth;
- canonical catalog meaning;
- legality or gameplay semantics;
- shared domain storage models across contexts.

Dependency expectation:

- This package should stay infrastructure-only.
- It must not become the real architecture owner through convenience.
