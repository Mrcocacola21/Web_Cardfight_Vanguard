# State Flags Foundation

## 1. Purpose

This step introduces a formal state-flags layer into `@web-vg/rules-core`.

The goal is to make unit/card state part of engine truth instead of letting
rest/stand/lock semantics leak into ad hoc booleans, UI-only fields, or hidden
transition assumptions.

## 2. Why State Flags Must Be Formal Engine Concepts

Board state is already meaningful after ride/call and battle declaration work.

Without a formal status layer, the engine would quickly accumulate:

- implicit "already attacked" assumptions
- scattered lock checks
- inconsistent legality around battle participation
- silent state drift during zone movement

`stand`, `rest`, and `locked` are now modeled explicitly so future legality,
effects, and format policies can read the same engine-owned state.

## 3. Initial Flag Vocabulary

The initial vocabulary is intentionally small:

- orientation: `stand | rest`
- composable piece flag: `locked`

This is enough to support current battle development without pretending to be a
full modifier/status engine already.

## 4. Representation Model

Flags live in `GameState.pieceStates` as a sparse runtime layer:

- `GamePieceStatusState { pieceId, orientation, flags }`
- missing entry means the piece is implicitly `stand` with no additional flags

This keeps state explicit without bloating every piece fixture with default
status objects.

## 5. Mutually Exclusive vs Composable Flags

The model distinguishes two axes:

- `stand` and `rest` are mutually exclusive orientation states
- `locked` is an independent flag stored alongside orientation

That gives the reducer a clean way to enforce "already rested" and
"cannot change orientation while locked" without collapsing everything into one
string enum or one loose metadata bag.

## 6. Transition Semantics

The reducer now owns four explicit flag transitions:

- `piece.rest`
- `piece.stand`
- `piece.lock`
- `piece.unlock`

Current baseline rules:

- only pieces on `vanguard_circle` or `rear_guard_circle` can use these
  transitions
- `rest` rejects already-rested pieces
- `stand` rejects already-standing pieces
- `lock` rejects already-locked pieces
- `unlock` rejects pieces that are not locked
- orientation changes are rejected while `locked`

The reducer emits `piece.rested`, `piece.stood`, `piece.locked`, and
`piece.unlocked`.

## 7. Integration With Current Mechanics

The flags layer is already wired into current mechanics where it matters:

- attack declaration rests the attacking unit
- boost commitment rests the boosting unit
- attack/boost can no longer reuse already-rested pieces under the current
  baseline
- zone transfers preserve existing piece-state entries unless a mechanic
  explicitly changes them

This keeps state flags part of live gameplay semantics instead of a dormant
side structure.

## 8. Invalid / Blocked Behavior

Structured transition semantics remain intact:

- invalid flag changes return `invalid`, not random throws
- pending requests still block unrelated flag actions
- incompatible transitions do not partially mutate `GameState`

## 9. What Is Intentionally NOT Implemented Yet

Still out of scope:

- full modifier/buff/debuff system
- exhaustive Vanguard keyword/status coverage
- automatic stand phases / lock release timing
- format-specific flag consequences beyond current baseline
- UI rotation/lock presentation logic

## 10. Summary

`@web-vg/rules-core` now has a coherent, engine-owned state-flags foundation.

`stand`, `rest`, and `locked` are formal runtime semantics, reducer-driven
transitions emit explicit events, and current battle mechanics already depend on
the same status model that later effects and legality checks will use.
