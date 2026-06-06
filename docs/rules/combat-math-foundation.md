# Combat Math Foundation

## 1. Purpose

This step turns battle flow from phase-shaped movement into engine-owned combat
math. The reducer now resolves attack power, guard shield, total defense, and an
explicit hit or miss result.

## 2. Why battle flow needed real combat math

The previous battle scaffold could declare attacks, boost, guard, drive check,
damage check, and complete battle, but damage was not gated by an actual combat
comparison. That made guard and boost structurally visible but not gameplay
truth.

Damage and win condition can now build on a resolved battle result instead of
inferring one from later movement.

## 3. Column semantics

The current engine does not yet have durable front-row/back-row slot metadata
that can safely infer physical columns across all fixtures.

For this foundation, the attacking column is explicit battle state:

- `battle.attackerPieceId` is the attacking unit;
- `battle.boostingPieceId`, when present, is the committed booster from the
  existing `battle.commit_boost` transition;
- no uncommitted rear-guard is automatically added just because it is nearby in
  a fixture.

This keeps the column relation reducer-owned and deterministic while leaving a
clear future extension point for stricter board coordinates.

## 4. Attack power calculation

`system.resolve_combat` computes attack power inside `rules-core`.

The current formula is:

`attacker base power + committed booster base power + provider-read piece power modifiers`

Base power comes from the match-scoped card stats snapshot introduced by the
card stats bridge. Runtime power modifiers come from materialized
`GamePieceStatusState.powerModifier` values exposed by the combat modifier
provider. Combat math does not inspect Persona Ride flags directly.

## 5. Booster contribution

Boost is not inferred. A booster contributes only when battle state contains a
`boostingPieceId` produced by `battle.commit_boost`.

The booster contribution uses the booster card's engine-facing `power`. Existing
boost validation still owns who may commit the boost and from which supported
zone. Future row/column legality can strengthen that same transition without
changing combat comparison consumers.

## 6. Shield calculation

Committed guardians contribute shield through `battle.guardPieceIds`.

`system.resolve_combat` resolves each guard piece through `cardDefinitionId`,
sums its engine-facing `shield`, and stores both the shield total and per-piece
components in `battle.combat`.

## 7. Comparison stages and hit/miss result

Battle now has an explicit comparison stage:

1. `battle.attack_declared`
2. `battle.guard_resolved`
3. `system.resolve_combat`
4. `battle.status = combat_resolved`
5. `battle.combat.result = hit | miss`

Vanguard attacks must complete drive check before combat comparison. Rear-guard
attacks can compare after guard resolution.

Hit battles may proceed to damage check. Missed battles can complete through
battle-scoped mandatory flow with reason `attack_missed`.

Combat also stores effective attacker critical and the derived
`damageCheckCount`. Damage check actions must match that derived count.

## 8. What is intentionally NOT implemented yet

This step does not implement:

- a final universal continuous-effect engine;
- full continuous/replacement effect machinery;
- gifts or premium-specific modifier rules;
- intercept legality beyond current guard commitment;
- automatic physical column inference from final board coordinates.

## 9. Summary

Combat comparison is now engine truth. Attack power, critical, committed boost,
shield, total defense, hit/miss, and derived damage-check count are resolved by
the reducer and serialized on battle state, with events that expose the resolved
combat facts.
