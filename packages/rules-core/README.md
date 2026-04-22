# packages/rules-core

Purpose:

- Provide the framework-agnostic gameplay rules foundation boundary and the
  home for format adapters that compose on top of that foundation.

Expected ownership:

- gameplay state contracts and identifiers;
- action, event, request, and transition contracts;
- engine/UI boundary contracts and facade;
- invariant-safe state evolution primitives;
- shared format-adapter contracts and concrete format adapters;
- future format-agnostic mechanics and effect foundations.

Must not own:

- Next.js, React, or UI logic;
- Supabase, DB repositories, or persistence concerns;
- transport/server action wiring;
- catalog importer workflow internals;
- collection, social, and match-history application concerns;
- browser/runtime helpers outside the domain boundary.

Dependency expectation:

- Must stay deterministic, pure, and testable in isolation.
- May consume only narrow shared contracts that are safe at the domain boundary.
- This package is an engine foundation, not a premature full gameplay runtime.

Current status:

- core gameplay contracts live under `src/state`, `src/actions`, `src/events`,
  `src/requests`, `src/transitions`, and `src/boundary`;
- shared format composition lives under `src/formats`;
- the first concrete adapter is `src/formats/standard`, which layers
  Standard-specific legality and ride flow on top of the generic engine.
