# Rules Core Tests Checkpoint

## 1. Scope of This Checkpoint

This checkpoint protects the load-bearing Phase 15 foundation inside `packages/rules-core`.

The intended protected surface is:

- package purity basics where testable
- state model coherence
- action, event, and request semantic separation
- reducer determinism
- valid, invalid, and blocked transition semantics
- zone move foundation
- identity consistency across transitions
- pending request behavior
- engine/UI boundary contract basics

This is not a mechanics-completeness checkpoint.

## 2. State Model Coverage

Current state-model tests cover:

- gameplay identity separation from collection printings
- generic zone metadata instead of format-specific fields
- base `GameState` coherence
- slotted-zone occupant invariants
- no duplicate piece placement across zones
- ownership drift between `PlayerState.ownedZoneIds` and `ZoneState.ownerPlayerId`

This gives the state model meaningful structural protection for future engine work.

## 3. Action/Event/Request Coverage

Current contract tests cover:

- action vocabulary and actor semantics
- event vocabulary and fact semantics
- request vocabulary and response compatibility
- separation between action, event, request, UI, and persistence concerns
- gameplay-safe references for players, pieces, zones, and targets

The semantic boundary between intent, fact, and prompt is protected explicitly.

## 4. Reducer/Transition Coverage

Current reducer tests cover:

- deterministic `match.start`
- deterministic zone movement for identical input
- structured `applied`, `invalid`, and `blocked` result branches
- stale revision rejection
- pending-request blocking
- ordered choice-response consumption
- structured invalid result for mismatched choice responses

This is enough to protect the transition contract foundation introduced in Phase 15.

## 5. Zone Move Coverage

Zone move coverage now includes:

- valid cross-zone move updates source and destination correctly
- movement emits `piece.moved`
- no duplication or loss of moved entities
- invalid move to an occupied slot returns structured failure without mutation
- invalid move from the wrong source reference returns structured failure without corruption
- blocked move while a request is pending preserves current state

## 6. Pending Request Coverage

Pending request coverage now includes:

- request state integrated into `GameState`
- blocked transitions while a request is pending
- head-of-queue choice-response continuation
- out-of-order choice-response blocking
- mismatched choice-response invalid handling
- engine/UI boundary surfacing of pending requests

What is not covered yet is request generation from a newly applied gameplay transition, because the current foundation does not yet implement request-producing mechanics.

## 7. Engine/UI Boundary Coverage

Boundary tests currently cover:

- UI-facing commands are limited to `action` and `choice_response`
- accepted engine results expose state, events, and pending requests
- invalid and blocked engine results are structured
- pending requests remain engine-owned through boundary normalization
- UI/browser-oriented fields do not appear in the engine boundary contract

## 8. Fixture Strategy

The checkpoint uses small realistic fixtures embedded directly in the relevant test files:

- minimal structural state fixture for pure state invariant tests
- two-player match fixtures for reducer and boundary scenarios
- valid move scenario
- invalid move scenarios
- awaiting-choice scenario

This keeps test layering explicit without introducing a premature fixture framework.

## 9. Remaining Gaps

Remaining acceptable gaps:

- no request-producing transition scenarios yet
- no mechanics-specific legality coverage beyond the foundation subset
- no hidden-information/view-projection tests
- no format-adapter tests
- no property-based transition fuzzing

These gaps are acceptable for closing Phase 15, but they must not remain unowned once mechanics and adapters begin landing.

## 10. Risks

Main residual risks:

- the first request-producing mechanics could outgrow current request tests if they land without new transition scenarios
- multiplayer-safe visibility boundaries are still untested because that layer does not exist yet
- unsupported actions are currently foundation-level invalids, so future implementation work must add tests alongside new action support

## 11. Final Verdict

**GO WITH CONDITIONS**

Reasoning:

- the current Phase 15 foundation is meaningfully protected
- load-bearing state and transition semantics are under test
- zone move and pending request behavior are no longer lightly covered
- remaining gaps are mostly future-scope areas, not reasons to hold Phase 15 open

Phase 15 can be closed if Phase 16 continues the current discipline: every newly implemented mechanic, request-producing flow, and visibility boundary must land with scenario-level tests, not just contract types.
