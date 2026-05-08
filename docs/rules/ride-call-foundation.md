# Ride / Call Foundation

## 1. Purpose

This step introduces the first real board-development mechanics into
`@web-vg/rules-core`.

The goal is to make `card.ride` and `card.call` part of the engine's own
transition language instead of leaving board progression inside adapters or UI
logic.

## 2. Why Ride / Call Are the Next Core Mechanics

After draw, shuffle, and mulligan, the next load-bearing gameplay transitions
are the ones that create a meaningful board:

- `ride` establishes the current vanguard
- `call` establishes rear-guard occupancy

Future battle, effects, and zone-control work needs these transitions to exist
as real engine mechanics first.

## 3. Ride Semantics

`card.ride` is now a core board-development action.

At the core reducer level it means:

- a player-controlled card piece is committed onto that player's
  `vanguard_circle`
- if a vanguard already occupies that circle, it is displaced first
- the ride piece becomes the new vanguard-circle occupant
- the transition emits `piece.moved` and `card.rode`

The core mechanic intentionally leaves source-zone legality to format policy.
Standard constrains the source to `ride_deck`; V Premium constrains it to
`hand`.

## 4. Call Semantics

`card.call` is now a core board-development action as well.

The baseline mechanic means:

- a player-controlled card piece is committed from `hand`
- the destination must be that player's `rear_guard_circle`
- the target placement must respect slot occupancy
- the transition emits `piece.moved` and `card.called`

This gives the engine a real rear-guard deployment mechanic without pretending
to already implement every superior-call variant.

## 5. Board Slot / Circle Representation

Board placement stays inside the existing `ZoneState` model.

The current baseline uses:

- `vanguard_circle` for the vanguard position
- `rear_guard_circle` for rear-guard placement surfaces
- `ZoneLocationReference.slotId` when a rear-guard zone is represented as a
  slotted surface

No separate board-geometry subsystem was added in this step.

## 6. Previous Vanguard Handling

The current documented baseline is explicit:

- when `card.ride` resolves onto an occupied `vanguard_circle`
- the previous vanguard moves immediately into that player's `soul`

This is engine-owned transition behavior, not a UI convention.

The step does not implement ride bonuses, superior ride text, or other
ride-derived effects.

## 7. Events Produced

The reducer now uses the existing event model to emit:

- `piece.moved` for displaced vanguard movement during ride
- `piece.moved` for the new ride piece entering the vanguard circle
- `card.rode` for the completed ride fact
- `piece.moved` for rear-guard deployment during call
- `card.called` for the completed call fact

This keeps board development observable for future triggers, effects, and
debugging.

## 8. Invalid / Blocked Behavior

Structured engine semantics stay intact:

- invalid ride if the destination is not a `vanguard_circle`
- invalid ride if the declared `ridingOverPieceId` does not match the current
  vanguard occupant
- invalid call if the source is not `hand`
- invalid call if the target is not a `rear_guard_circle`
- invalid call if the target slot is occupied or unknown
- blocked ride/call while a pending engine request is unresolved

No hidden partial mutation or random exception flow is used as the primary
contract.

## 9. What Is Intentionally NOT Implemented Yet

Still out of scope:

- full grade / legality enforcement
- superior ride variants
- superior call variants
- attack / boost / guard flow
- ride- or call-triggered effects
- hidden-information view projections

## 10. Summary

`ride` and `call` now exist as real core reducer mechanics.

The board state can progress through engine-owned transitions, previous
vanguards are handled explicitly, and format adapters now layer policy and
follow-up behavior on top of that core board-development foundation.
