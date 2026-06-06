# Combat Modifier Provider

## 1. Purpose

This step closes the runtime seam between effect consequences, materialized piece modifiers, combat math, and damage-check count derivation.

Combat math now asks a provider for battle-relevant modifiers instead of interpreting named effects such as Persona Ride itself.

## 2. Why Combat Math Could Not Keep Hardcoded Effect Knowledge

Hardcoding Persona Ride inside `combat-resolution.ts` made combat a second effect interpreter:

- combat had to know the Persona flag name;
- combat had to know Persona's +10000 amount;
- adding another power source would require another combat branch;
- critical modifiers could exist in state without driving actual damage checks.

That is not a trustworthy authoritative runtime path for richer effects.

## 3. Chosen Modifier Provider Model

The bounded provider is `resolveCombatPieceModifiers`.

It reads canonical `GamePieceStatusState` materialized fields:

- `powerModifier`
- `criticalModifier`

It returns combat-facing modifier components:

- `piece_power_modifier`
- `piece_critical_modifier`

It does not execute card text, inspect keywords, resolve Persona, or mutate state. Effects own materialization. Combat owns battle math.

## 4. Modifier Sources And Combat-Facing Contract

Current truth source:

- effects and trigger runtime materialize modifiers into `pieceStates`;
- the provider exposes those materialized values;
- combat combines provider output with base card stats and guard/boost state.

Current combat snapshot stores:

- `attackPower`
- `attackerPowerComponents`
- `attackCritical`
- `attackerCriticalComponents`
- `defensePower`
- `shieldPower`
- `totalDefensePower`
- `damageCheckCount`
- `result`

Negative power modifiers are outside the current bounded combat model and fail structurally. Effective attacker critical must be at least 1 in the current damage-check model.

## 5. How Persona Ride Was Removed From Hardcoded Combat Math

Persona Ride still resolves through the effect runtime and typed handler.

Its power consequence now materializes `powerModifier: 10000` on the affected current vanguard/rear-guards. The existing Persona marker flag remains for lifecycle/debug visibility, but combat math does not read it.

`combat-resolution.ts` no longer imports or branches on `PERSONA_RIDE_POWER_FLAG` or Persona's amount.

## 6. How Critical Now Feeds Real Damage-Check Derivation

Combat resolves attacker critical from:

`base attacker critical + provider critical modifiers`

For a hit, `battle.combat.damageCheckCount` equals effective attacker critical. For a miss, it is `0`.

`system.damage_check` still carries `count` for command audit compatibility, but the transition validates it against `battle.combat.damageCheckCount` and uses the derived value. A stale or wrong count is invalid.

## 7. End-To-End Runtime Path: Trigger/Effect -> Combat -> Damage Checks

The real runtime path is now:

1. Trigger or effect resolves.
2. Runtime materializes `powerModifier` and/or `criticalModifier` in `pieceStates`.
3. Combat modifier provider reads that materialized state.
4. Combat math computes effective power and critical.
5. Hit/miss and `damageCheckCount` are stored on `battle.combat`.
6. Damage check validates and consumes the derived count.

This is tested with Critical trigger resolution feeding combat critical and producing two actual damage checks.

## 8. What Is Intentionally NOT Implemented Yet

This is not a universal continuous-effect engine.

It does not implement every historical modifier category, replacement effect, gift modifier, text parser, or final priority model. Shield is still resolved from committed guard card stats in the current guard model.

The provider is deliberately bounded to current materialized runtime modifier truth.

## 9. Summary

Combat is now a consumer of materialized effect outcomes. Persona is no longer privileged inside combat math, and effective critical is now part of authoritative damage-check derivation.
