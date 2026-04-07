# packages/decks

Purpose:

- Own the deck domain boundary.

Expected ownership:

- deck versions;
- deck metadata;
- deck lifecycle workflows;
- deck snapshot publication.

Must not own:

- legality logic;
- restriction interpretation;
- gameplay runtime state;
- social graph logic.

Dependency expectation:

- May publish deck snapshots and consume shared contracts.
- Must not absorb legality semantics because deck flows need them.
