# Standard Format Adapter Foundation

## 1. Purpose

This step introduces the first real gameplay format adapter on top of
`@web-vg/rules-core`.

The adapter exists to prove that format-specific runtime rules can be layered
over the common engine foundation without hardcoding Standard behavior into the
core state, reducer, or engine/UI boundary contracts.

## 2. Why Format Adapters Exist

`rules-core` owns the generic gameplay language:

- `GameState`
- actions
- events
- requests
- transition results

Format adapters own how a concrete format uses that language:

- which actions are exposed now
- which format-only legality gates apply
- which format-only transitions need custom handling

This keeps format branching out of the core reducer and out of UI code.

## 3. Why Standard Is the First Adapter

Standard is the first format with already-established domain knowledge elsewhere
in the repo:

- ride deck expectations
- Standard-only deck semantics
- Standard content baseline

That makes it the right first adapter to validate the architecture before V
Premium and Premium are added.

## 4. Adapter Contract

The shared format layer now defines a small adapter contract:

- `formatId`
- `supportedActionTypes`
- `dispatch(currentState, command)`

Internally, adapters can add:

- pre-dispatch legality evaluation
- custom transition handling for actions the core reducer does not own
- delegation back to the generic engine boundary for unchanged behavior

## 5. How It Composes With `rules-core`

The Standard adapter lives inside `packages/rules-core/src/formats/standard`.

It composes with the core through:

- the shared `EngineCommand` / `EngineDispatchResult` boundary
- generic transition helpers such as revision checks and transition-result
  constructors
- a shared pure zone-relocation primitive used by both the reducer foundation
  and the Standard ride transition

The composition rule is simple:

- Standard-specific logic handles only Standard-specific branches
- all unchanged commands delegate back to the generic engine boundary

## 6. Which Standard-Specific Semantics Are Implemented Now

This foundation step intentionally implements only a small but meaningful
subset:

- Standard format identity through `STANDARD_FORMAT_ID`
- Standard action support declaration through `STANDARD_FORMAT_ACTION_TYPES`
- Standard legality gate: `card.call` cannot use the ride deck as a normal call
  source or destination
- Standard custom transition: `card.ride`
  - requires a Standard ride deck zone
  - requires a Standard vanguard circle zone
  - requires a Standard soul zone
  - moves the previous vanguard to soul
  - moves the selected ride-deck card to the vanguard circle
  - emits `piece.moved` and `card.rode` facts

This is enough to prove the adapter pattern without pretending Standard
mechanics are broadly implemented.

## 7. What Is Intentionally NOT Implemented Yet

Still out of scope:

- full Standard legality model
- ride eligibility by grade or card metadata
- mulligan and opening setup flow
- persona ride and other card-specific mechanics
- effect resolution
- realtime authority protocol
- V Premium and Premium adapters

## 8. How This Prepares V Premium / Premium Adapters

Future adapters can reuse the same shape:

- declare format identity
- expose a bounded action surface
- add format-only legality gates
- add format-only handlers when the generic reducer should not own the logic
- delegate unchanged commands to the shared engine boundary

That keeps Standard from becoming a disguised default engine implementation.

## 9. Summary

`rules-core` now has its first real format adapter.

Standard is implemented as an explicit extension layer over the common engine,
not as `if (format === 'standard')` branches spread through the reducer or UI.
This establishes the pattern for future format adapters and later mechanics
work.
