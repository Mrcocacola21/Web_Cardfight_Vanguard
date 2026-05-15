# Engine Lookup/Perf Hardening

## 1. Purpose

This step introduces `GameStateIndex`, a deterministic indexed read model over canonical `GameState`, and moves hot runtime code away from repeated ad hoc scans and duplicated lookup helpers.

## 2. Why repeated linear scans and duplicated queries had to be addressed

The engine had many local copies of the same reads: player by id, zone by id, piece by id, owned zone by kind, and piece location. Those copies were correct enough in isolation, but they made transition code noisier, paid repeated scan costs in hot paths, and created drift risk as combat, trigger, effect, and lifecycle flows grew.

## 3. Role of `GameStateIndex`

`GameStateIndex` is a derived access structure. It does not replace `GameState`, does not mutate gameplay state, and is not serialized as authoritative session truth. Runtime code builds it from the current immutable state and discards it when moving to the next state.

The canonical source of truth remains `GameState`.

## 4. What the index contains

The index currently contains:

- players by `PlayerId`
- zones by `ZoneId`
- pieces by `PieceId`
- piece status by `PieceId`
- piece location by `PieceId`
- owned zones grouped by player and zone kind

For malformed duplicate data, indexed lookups preserve previous first-match semantics where the old code used `Array.find`.

## 5. Shared state query layer

The shared query layer provides canonical helpers for:

- `findPlayerById`
- `findZoneById`
- `findPieceById`
- `findPieceStateById`
- `findPieceLocation`
- `findOwnedZoneByKind`
- `listOwnedZonesByKind`
- current vanguard lookup
- primary opponent lookup

These helpers live with state/index code and keep transition/effect code focused on domain decisions.

## 6. Which hot paths were migrated

The first migrated paths are the runtime-heavy seams:

- board position and boost relation resolution
- attack, boost, guard, and intercept runtime
- combat math
- drive and damage check runtime
- trigger consequence runtime
- first keyword/declarative effects
- resource effect operations
- battle completion cleanup
- turn draw/stand and turn cleanup support
- ride/call preparation and baseline legality helpers

## 7. Error/invalid-state lookup semantics

Query helpers return `undefined` or an empty list for missing relations. Transition/effect code remains responsible for converting those lookup misses into structured invalid results when the operation requires the relation.

The index intentionally does not validate the whole state. Invariants still belong to `assertGameStateInvariant` and related state validation.

## 8. What is intentionally NOT optimized yet

This step does not convert the engine to a mutable ECS, does not introduce long-lived caches, and does not rewrite every cold projection/test helper. Some rare reads can remain direct if indexing them would add ceremony without runtime value.

## 9. Summary

State access is now more deliberate: hot gameplay runtime builds a derived `GameStateIndex`, reads through shared query helpers, and keeps canonical immutable `GameState` as the only gameplay truth. This reduces duplicated lookup logic and prepares the engine for heavier realtime/session usage.
