# packages/rules-core

Purpose:

- Provide the gameplay and runtime foundation boundary.

Expected ownership:

- gameplay-facing runtime setup foundations;
- gameplay-facing format interpretation;
- future rules-core state and runtime logic.

Must not own:

- full catalog internals;
- legality truth;
- UI logic.

Dependency expectation:

- Must consume only narrow gameplay-facing inputs and shared contracts.
- This package starts as a thin foundation, not as a full rules engine.
