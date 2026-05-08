# V Premium Format Adapter Foundation

## 1. Purpose

This step adds the second concrete format adapter on top of
`@web-vg/rules-core`.

The goal is to prove that format-specific gameplay logic scales through
adapters, not through Standard-only branching inside the core reducer or UI.

## 2. Why V Premium Is the Second Adapter

Standard already established the first adapter pattern.

V Premium is the right second proof point because it is close enough to reuse
the same engine contracts, while still different enough to require distinct
runtime semantics.

## 3. Relationship to the Standard Adapter

Standard and V Premium are siblings over the same format extension model:

- both declare a `formatId`
- both publish the same `dispatch(currentState, command)` boundary
- both expose bounded `supportedActionTypes`
- both can apply pre-dispatch legality gates
- both can add small format-specific continuations while delegating unchanged
  commands back to the generic engine boundary

V Premium is not a fork of Standard and not a second engine.

## 4. Adapter Contract Reused / Extended

The shared adapter contract now carries:

- `formatId`
- `constructionBasis`
- `gameplayMarkers`
- `supportedActionTypes`
- `dispatch(currentState, command)`

This keeps format metadata and reducer composition in one coherent contract
without pushing format logic into `GameState`, the core reducer, or UI code.

## 5. Which V Premium-Specific Semantics Are Implemented Now

This foundation step implements a small but real subset:

- `V_PREMIUM_FORMAT_ID`
- `constructionBasis: 'clan-based'`
- `gameplayMarkers` including `imaginary-gift`
- ride-deck rejection
  - V Premium does not treat ride deck references as part of its baseline
    runtime surface
- V Premium ride policy over the core `card.ride` mechanic
  - requires rides to originate from hand
  - reuses the core vanguard-to-soul handling and emitted `card.rode` events
- imaginary gift continuation request
  - if an imaginary gift zone exists, the ride transition produces an
    engine-owned `choose.zone` request instead of pushing that choice into UI

## 6. How It Composes With `rules-core`

The adapter lives in `packages/rules-core/src/formats/v-premium`.

It composes with the core through:

- the shared `EngineCommand` / `EngineDispatchResult` boundary
- the generic reducer for lifecycle and board-development commands
- shared format guard hooks and zone lookup helpers
- adapter-owned gift continuation layered on the core ride result

The composition rule stays explicit:

- V Premium-specific guards and gift flow live in the adapter
- generic transition behavior still belongs to the core engine

## 7. What Is Intentionally NOT Implemented Yet

Still out of scope:

- full V Premium legality model
- clan gating for runtime rides and calls
- imaginary gift effect resolution after the request is answered
- gifts, markers, and card-specific mechanics as a full subsystem
- Premium adapter
- common mechanics hooks beyond the small shared helper layer added here

## 8. How This Prepares the Premium Adapter and Common Hooks

This step makes the next format work easier in two ways:

- Premium can reuse the same adapter contract instead of inventing a third
  format integration style
- Standard and V Premium now expose the first shared format helper layer,
  which can grow into common hooks only where duplication is real

That keeps later shared mechanics honest and prevents `rules-core` from
collapsing into `switch(format)` logic.

## 9. Summary

`rules-core` now has two real format adapters using the same extension model.

V Premium proves that the architecture scales past the first adapter: the core
engine stays format-agnostic, while format-specific legality and transition
behavior are layered on through explicit adapters.
