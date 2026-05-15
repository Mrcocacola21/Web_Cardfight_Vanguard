# Board Semantics Hardening

## 1. Purpose

This step makes battlefield layout an engine-owned concept. Combat, boost, and intercept now rely on deterministic board queries instead of local string checks in individual transition handlers.

## 2. Why the old board model needed hardening

The engine already had vanguard and rear-guard zones, and `ZoneState` already supported slotted occupancy. The weak point was that battle code inferred front/back behavior ad hoc. Boost could be committed from almost any rear-guard circle, and intercept used a local `front` substring check.

That was enough for fixture-era movement, but not enough for Vanguard combat, future targeting, gifts, stride, or board-attached objects.

## 3. Current battlefield layout model

The canonical storage remains `GameState.zones`.

- `vanguard_circle` is the front-center vanguard circle for its owner.
- `rear_guard_circle` is a battlefield circle surface.
- Slotted rear-guard zones use slot ids containing row and column coordinates, such as `p1:front-left`, `p1:back-left`, `p1:back-center`, `p1:front-right`, and `p1:back-right`.
- Separate single-circle rear-guard zones can also be resolved when their zone id carries the same coordinates, such as `zone-p1-front-left`.

The canonical gameplay contract is the derived `BoardPosition`: player, circle kind, row, column, zone, and optional slot.

## 4. Front Row Vs Back Row Semantics

Front row positions can attack and can intercept when the card also satisfies intercept rules. Back row rear-guards are support positions and can boost a matching front-row unit in the same column.

The vanguard is always front-center. Rear-guard rows are resolved from board coordinates, not from UI placement.

## 5. Column Semantics

The supported columns are `left`, `center`, and `right`.

- The center column contains the vanguard front position and a possible `back-center` rear-guard booster.
- Left and right columns contain the matching front and back rear-guard circles.
- Column membership is derived by `resolveBoardColumn` and `resolveBoardPositionForPiece`.

Malformed rear-guard positions fail resolution instead of being guessed.

## 6. Boost Relation Semantics

Boost is legal only when:

- the attacker resolves to a front-row battlefield position;
- the booster resolves to a back-row rear-guard position;
- both positions belong to the same battlefield owner;
- both positions share the same column.

`battle.commit_boost` and combat math both use this relation, so committed boost state and resolved attack power cannot drift apart.

## 7. Future Extension Seams (Gifts / Stride / Board Objects)

This step does not add gifts or stride, but it leaves explicit seams:

- circle metadata can be represented by slots or future board-attached state;
- gift markers can target resolved board positions;
- stride can continue to use the vanguard circle as the center front anchor;
- future extra circles can extend board queries without moving layout truth into UI code.

## 8. What Is Intentionally NOT Implemented Yet

This step does not implement gift placement, stride/G-zone lifecycle, G-guard, full board object persistence, or format-specific extra circles. It also does not rewrite the UI board renderer.

## 9. Summary

The engine now has one board-semantics contract for battlefield positions, rows, columns, boost relations, and intercept row legality. Current battle and guard flow sit on that contract, while the underlying state model remains compatible with existing session serialization.
