# Draw / Shuffle / Mulligan Foundation

## 1. Purpose

This step introduces the first real gameplay mechanics on top of `rules-core`: deterministic shuffle, reusable draw, and engine-owned mulligan flow.

## 2. Why These Are the First Core Mechanics

They are the smallest load-bearing match operations needed to start a real game loop. Without them, opening-hand flow, early turn setup, and later effect-driven card movement remain fake or UI-owned.

## 3. Shuffle Semantics

- `zone.shuffle` is a formal engine action.
- It only applies to ordered multi-occupancy zones.
- The action carries the resolved post-shuffle piece order explicitly.
- The reducer validates that the order is a real permutation of the current zone contents and emits `zone.shuffled`.

## 4. Draw Semantics

- `zone.draw` is a formal engine action.
- Drawing moves the top `N` pieces from an ordered source zone into a destination zone.
- The reducer emits per-piece `piece.moved` events and one aggregate `cards.drawn` event.
- Insufficient source cards stay a structured invalid result for now; deck-out loss handling is not implemented yet.

## 5. Mulligan Flow

- `system.begin_mulligan` starts an engine-owned mulligan request.
- The engine enters `awaiting_choice` with a `mulligan.select_cards` pending request.
- The responder returns selected hand pieces and a resolved shuffled deck order through `answer.mulligan`.
- The engine then:
  - returns selected cards from hand to deck
  - shuffles the deck deterministically
  - draws replacement cards
  - clears the pending request
  - emits `mulligan.completed`

## 6. Determinism and Shuffle Design Choice

`rules-core` does not call `Math.random()` or hide entropy inside the reducer. Shuffle is deterministic because the resolved deck order is supplied explicitly by the action or mulligan response. This keeps replay, authoritative runtime, and future multiplayer synchronization possible.

## 7. Events and Requests Involved

- Actions:
  - `zone.shuffle`
  - `zone.draw`
  - `system.begin_mulligan`
- Events:
  - `zone.shuffled`
  - `cards.drawn`
  - `mulligan.started`
  - `mulligan.completed`
  - existing `piece.moved`
- Requests:
  - `mulligan.select_cards`
- Responses:
  - `answer.mulligan`

## 8. Invalid / Blocked Behavior

- invalid shuffle order returns structured invalid results
- invalid draw count or insufficient deck returns structured invalid results
- mulligan outside the intended opening flow returns structured invalid results
- unrelated actions stay blocked while the mulligan request is pending
- mismatched mulligan responses return `request_response_mismatch`

## 9. What Is Intentionally NOT Implemented Yet

- opening hand draw orchestration for the whole match
- deck-out / lose-condition handling
- per-format startup differences
- hidden-information projections
- battle, ride, call, and effect systems beyond existing foundations

## 10. Summary

`rules-core` now has the first genuine gameplay loop primitives. Shuffle remains deterministic, draw is reusable as a core movement mechanic, and mulligan proves that request-aware engine flow is real rather than UI-owned.
