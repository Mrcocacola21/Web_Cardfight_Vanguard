# packages/social

Purpose:

- Own the social and match-record domain boundary.

Expected ownership:

- user identities and profile-facing domain types;
- friend relations;
- match-level product records and results.

Must not own:

- deck composition;
- legality decisions;
- gameplay runtime state.

Dependency expectation:

- May depend on narrow shared contracts.
- Must not depend on app-layer code or gameplay internals.
