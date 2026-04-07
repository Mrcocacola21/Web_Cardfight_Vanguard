# packages/legality

Purpose:

- Own the legality domain boundary.

Expected ownership:

- restriction lists and rule contracts;
- validation context semantics;
- legality-owned type surface beyond shared published contracts.

Must not own:

- deck persistence;
- catalog ingestion;
- runtime gameplay behavior.

Dependency expectation:

- May depend on narrow shared contracts and catalog-owned inputs where justified.
- Must not depend on app-layer code or rules runtime internals.
