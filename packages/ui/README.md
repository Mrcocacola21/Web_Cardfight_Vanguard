# packages/ui

Purpose:

- Provide shared UI components and presentation primitives.

Expected ownership:

- visual components;
- layout primitives;
- presentation-only helpers.

Must not own:

- catalog, deck, legality, or gameplay domain logic;
- importer behavior;
- format semantics.

Dependency expectation:

- Should remain as domain-agnostic as practical.
- If it needs shared types, they must be presentation-safe and intentionally published.
