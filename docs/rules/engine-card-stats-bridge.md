# Engine Card Stats Bridge

## 1. Purpose

This bridge gives the gameplay engine a real, deterministic path from a runtime
`cardDefinitionId` to gameplay-ready card stats.

The engine still owns runtime state and piece movement. Catalog/content remains
the upstream owner of canonical card facts.

## 2. Why the engine needs real card stats

Moving piece ids between zones is not enough for Vanguard gameplay. Combat math,
guard/shield checks, trigger checks, grade restrictions, win conditions, and
future deck-to-match bootstrap all need card facts such as power, shield,
critical, grade, card type, and trigger type.

Without this bridge, battle flow can only be a scaffold.

## 3. Chosen architecture

Chosen variant: normalized match-scoped stats snapshot.

`GamePieceState` continues to carry `cardDefinitionId`; stats are not embedded
into each piece. A live match state may carry an `EngineCardStatsSnapshot`
keyed by card definition id, and match-session initialization requires that
snapshot to cover every card piece.

This is a hybrid of the explicit resolver boundary and serializable state:

- no duplicated stats on every piece;
- no runtime reach into DB, catalog repositories, or importer internals;
- replay and persistence can serialize the exact match-scoped stats snapshot;
- card facts are immutable for the match once loaded;
- hidden information remains piece/zone visibility, not card-definition data.

## 4. Engine-facing card stats contract

`EngineCardStats` is the gameplay-facing contract:

- `cardDefinitionId`
- `cardType`
- `grade`
- `power`
- `shield`
- `critical`
- `triggerType`
- `keywords`

`triggerType` is explicit: trigger units must have one; non-trigger cards use
`null`. Helper predicates expose unit/order/trigger classification without
storing redundant booleans.

## 5. How stats enter a match session

The intended pipeline is:

1. catalog/content publishes `GameplayCard` projection data;
2. rules-core validates and maps it with
   `buildEngineCardStatsSnapshotFromGameplayCards`;
3. match bootstrap stores the resulting `cardStats` snapshot on `GameState`;
4. pieces resolve stats through `cardDefinitionId` with
   `resolveGamePieceCardStats` or `requireGamePieceCardStats`;
5. `match-session` rejects card-backed live states that lack a complete
   snapshot.

The local prototype now creates a gameplay-card projection and initializes its
room with a real stats snapshot.

## 6. Why raw catalog/importer internals stay outside rules-core

`rules-core` consumes only shared contracts and its own engine contract. It does
not import catalog packages, importer packages, DB repositories, publication
records, raw normalization types, or UI models.

Architecture tests explicitly keep the bridge out of `@web-vg/catalog`,
`@web-vg/importer`, and `@web-vg/db`.

## 7. Failure behavior for incomplete card data

Missing required stats fail predictably with `RulesInvariantError`.

Bootstrap policy:

- low-level synthetic reducer fixtures may omit stats until they exercise
  stat-consuming logic;
- live match rooms with card pieces must include a complete card-stats
  snapshot;
- if a card piece references a definition missing from the snapshot,
  initialization fails.

There is no silent fallback for stat-consuming paths.

## 8. What is intentionally NOT implemented yet

This step does not implement:

- combat power comparison;
- shield application;
- trigger resolution;
- grade enforcement;
- win condition checks;
- real deck-to-match bootstrap from persisted deck data;
- DB or catalog runtime loading inside the engine.

## 9. Summary

The engine now has a clean, serializable bridge from `cardDefinitionId` to
gameplay-ready card stats. Stats stay match-scoped and deterministic, while raw
catalog/importer internals remain outside `rules-core`.
