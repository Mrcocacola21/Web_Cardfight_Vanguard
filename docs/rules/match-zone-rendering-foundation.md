# Match Zone Rendering Foundation

## 1. Purpose

Phase 19.3 adds the first board-like rendering layer for a live match room. The
screen now shows player sides, major zones, zone occupancy, card/piece labels,
and supported piece state markers from the current engine state.

## 2. Why zones are projections of engine state

`GameState` remains the gameplay truth. The web UI builds a deterministic
projection from `room.engineState` into presentation-friendly board sides and
zones. The projection does not mutate state, validate targets, decide legal
actions, or infer gameplay outcomes.

## 3. Which zones are rendered now

The foundation board renders the stable zone subset already represented in the
prototype state:

- vanguard circle
- rear-guard circle with slots when slot ids exist
- hand
- deck
- damage
- drop
- any additional known engine zones as generic "other" zones

Missing or empty zones are displayed honestly as empty; the UI does not fake
full Vanguard board support.

## 4. How player/opponent orientation is handled

The board projection takes a `perspectivePlayerId`. That player is rendered as
the current player side, and all other engine players are rendered as opponent
sides. Ownership comes from zone and piece ownership fields in `GameState`, not
from profile/auth ids.

## 5. How pieces are rendered inside zones

Zone contents come from `ZoneState.occupants` joined with `GameState.pieces`.
Public zones show piece/card identity. Private zones show identity only when the
current perspective is allowed by the zone visibility policy; otherwise they
render as hidden cards. Slotted zones render occupied and empty slots separately.

## 6. What state markers are visualized

The board renders existing `GamePieceStatusState` markers:

- `stand`
- `rest`
- `locked`
- any additional flags as generic badges

These are visual markers only. They are not action availability or legality
calculations.

## 7. What is intentionally deferred to 19.4 / 19.5

Deferred:

- complete Vanguard zone coverage
- polished spatial battlefield layout
- drag and drop
- target selection
- available-action rendering
- client-side legality checks
- animation and final responsive polish
- full hidden-information policy beyond the current engine visibility fields

## 8. Summary

The match screen is now a summary plus board projection over the live match
room. It reads `GameState`, renders the meaningful zone subset, preserves
player/opponent orientation, shows contents and existing piece states, and keeps
gameplay decisions inside the room/engine boundary.
