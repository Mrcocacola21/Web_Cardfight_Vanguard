# packages/shared

Purpose:

- Provide a narrow home for carefully approved cross-context contracts, shared identifiers, and other intentionally published boundary surfaces.

Expected ownership:

- stable shared contracts only;
- owner-approved cross-context contract types;
- minimal shared constants only when they are genuinely contract-level.

Must not own:

- business logic;
- catalog internals;
- deck logic;
- legality logic;
- gameplay logic;
- generic misc helpers.

Dependency expectation:

- Other packages may consume this package where a published contract exists.
- This package must not become a dumping ground for "shared everything".
