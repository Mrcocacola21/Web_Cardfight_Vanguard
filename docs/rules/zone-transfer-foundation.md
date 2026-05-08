# Zone Transfer Foundation

## 1. Purpose

This step introduces a unified engine-level model for moving runtime card instances between gameplay zones. Zone transfers are now a formal part of `rules-core`, not ad hoc array mutation inside unrelated mechanics.

## 2. Why zone transfers need a unified model

`draw`, `mulligan`, `ride`, `call`, `guard`, `drive check`, and `damage check` already move pieces between zones. Without a shared transfer layer, those mechanics would keep duplicating source/destination validation, identity handling, and `piece.moved` event wiring.

## 3. Transfer contract

The public transfer contract is:

- `ZoneTransferIntent`
- `ZoneTransferRecord`
- `ZoneTransferReason`

Each transfer is instance-based and carries:

- `pieceId`
- `from`
- `to`
- `reason`

The moved object is always an in-match runtime piece, never a collection printing or persistence row.

## 4. Supported zones

The transfer foundation now cleanly supports representative movement touching:

- `soul`
- `drop`
- `bind`
- `damage`
- `ride_deck`
- `g_deck`

The transfer layer stays generic over zone kinds; format adapters still decide whether a given format allows a specific movement pattern.

## 5. Generic vs zone-specific semantics

The transfer layer owns the structural move:

- validate source presence
- validate destination occupancy/slot rules
- preserve piece identity
- update zones deterministically
- emit `piece.moved` with an explicit reason

Zone-specific meaning stays above it:

- `ride` decides that displaced Vanguard goes to `soul`
- `guard` decides that defending cards go to `guardian_circle`
- format adapters decide whether `ride_deck` or `g_deck` references are allowed in their runtime model

## 6. Reducer integration

Transfers are integrated into the reducer through:

- `zone.move_piece` as the generic engine transfer action
- `resolveZoneTransfer(...)`
- `resolveZoneTransferSequence(...)`
- `createPieceMovedEvents(...)`

Load-bearing mechanics were refactored onto this layer where it already mattered:

- draw / mulligan
- ride / call
- guard commitments
- drive check / damage check
- Premium stride-like overlay play through shared format hooks

## 7. Events produced

Transfers emit `piece.moved` as the canonical movement fact. The event now includes `reason`, so downstream systems can distinguish movement categories like:

- `draw`
- `mulligan_return`
- `mulligan_draw`
- `ride`
- `ride_displacement`
- `call`
- `guard`
- `drive_check`
- `damage_check`
- `retire`
- `bind`
- `soul`
- `format`

Higher-level mechanics still emit their own semantic events such as `card.rode`, `card.called`, `battle.guard_declared`, or `battle.damage_checked`.

## 8. Invalid / blocked behavior

Transfers stay inside the existing reducer contract:

- `applied` when the move is valid
- `invalid` for wrong source, missing piece, invalid slot, or illegal occupancy
- `blocked` when pending engine requests prevent progression

No hidden partial mutation occurs on invalid or blocked paths.

## 9. What is intentionally NOT implemented yet

This step does not add:

- full effect-driven transfer replacement/prevention
- exhaustive format-specific transfer legality
- every future zone keyword interaction
- full battle cleanup or effect timing around transfers
- viewer-specific hidden-information projection

## 10. Summary

`rules-core` now has a real transfer primitive for runtime card movement. Existing mechanics already reuse it, `piece.moved` facts are uniform, key zone kinds are covered, and future mechanics/effects can build on one movement model instead of inventing their own.
