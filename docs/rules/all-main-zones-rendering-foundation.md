# All Main Zones Rendering Foundation

## 1. Purpose

Phase 19.4 expands the live match screen from a board foundation into a full
prototype surface for the main gameplay zones supported by the current engine
state. The UI still reads the live match room and renders `GameState`; it does
not own gameplay state or legality.

## 2. Which zones are now rendered

The match board now renders these engine-backed zone roles:

- hand
- vanguard circle
- rear-guard circle / field slots
- deck
- ride deck
- G deck
- damage
- soul
- drop
- bind
- other engine zones as generic other zones

No zone is created by the UI. A zone appears because it exists in the room's
current `GameState`.

## 3. Board zones vs support/resource zones

The layout separates:

- battlefield zones: vanguard and rear-guard slots
- hand zones: rendered as a dedicated hand strip per side
- library zones: deck, ride deck, and G deck
- resource zones: damage and soul
- discard/removed zones: drop and bind

This keeps the board readable while leaving clear component seams for later
action overlays.

## 4. Player/opponent orientation

The board projection takes a `perspectivePlayerId`. That engine player is the
current side; other engine players are opponent sides. Opponent hand zones are
shown above the opponent battlefield, and the current player's hand is shown
below the current battlefield.

## 5. How zone contents are rendered

All contents come from `ZoneState.occupants` joined with `GameState.pieces`.
Slotted zones render occupied and empty slots. Hand zones render card-sized
piece summaries. Public pile/resource zones render their visible contents and
empty states.

## 6. How restricted/summary-style zones are handled

Deck, ride deck, and G deck are rendered as summary-style piles with counts and
compact entries. Piece identity is still governed by the zone visibility policy:
public zones show identity, owner-private zones show identity only to the owner
perspective, and hidden zones remain hidden.

## 7. What is intentionally deferred to 19.5+

Deferred:

- available-action overlays
- target selection and board highlights
- drag and drop
- hover stack expansion
- final hidden-information/security policy
- animation and production battlefield polish
- realtime/spectator-specific board modes

## 8. Summary

The match UI now shows the main gameplay areas for the playable prototype as a
deterministic projection of the room's `GameState`. The screen distinguishes
battlefield, hand, library, resource, and discard-style zones without moving
gameplay logic into React.
