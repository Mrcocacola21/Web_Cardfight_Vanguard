# Attack / Boost / Guard Foundation

## 1. Purpose

This step introduces the first explicit battle-flow foundation in `rules-core`. The engine now owns attack declaration, optional boost commitment, and guard commitment flow.

## 2. Why attack/boost/guard are the next battle mechanics

`ride` and `call` made board state meaningful. `attack`, `boost`, and `guard` are the next load-bearing mechanics because they create the first real battle context that later steps can extend with drive checks, damage checks, power math, and triggered effects.

## 3. Battle-state model

`GameState` now has an optional `battle` aggregate. It holds:

- attacking player
- defending player
- attacker piece and attacker zone
- target reference
- optional boosting piece and boosting zone
- committed guard pieces and guard zone
- optional guard request id
- battle status

The current baseline statuses are:

- `attack_declared`
- `boost_declared`
- `guard_requested`
- `guard_resolved`

This is intentionally a small explicit battle model, not a full combat framework.

## 4. Attack semantics

`battle.declare_attack` is a player action that starts a battle context.

Current baseline:

- attacker must belong to the acting player
- attacker must be on `vanguard_circle` or `rear_guard_circle`
- target may be the opposing player or an opposing unit on `vanguard_circle` / `rear_guard_circle`
- only one active battle may exist at a time

The transition emits `battle.attack_declared`.

## 5. Boost semantics

`battle.commit_boost` is a battle-context action, not a separate movement mechanic.

Current baseline:

- boost is only available after `attack_declared`
- only one boosting unit may be committed
- booster must be a different unit controlled by the attacking player
- booster must already be on a `rear_guard_circle`

This keeps boost explicit in engine state without implementing full column geometry yet. The transition emits `battle.boost_declared`.

## 6. Guard semantics

`battle.guard` is an engine-owned battle-response action that opens a guard request.

Current baseline flow:

1. defending player submits `battle.guard`
2. engine creates pending request `battle.guard_select`
3. defending player answers with `answer.guard` or `answer.pass`
4. selected guardians move from `hand` to `guardian_circle`
5. battle state advances to `guard_resolved`

This proves that guard is owned by engine flow, not by UI toggles. Guard commitment emits `piece.moved` facts and `battle.guard_declared`. Opening the guard step emits `battle.guard_requested`.

## 7. Events and requests involved

Added or actively used in this step:

- actions: `battle.declare_attack`, `battle.commit_boost`, `battle.guard`
- request: `battle.guard_select`
- responses: `answer.guard`, `answer.pass`
- events: `battle.attack_declared`, `battle.boost_declared`, `battle.guard_requested`, `battle.guard_declared`

## 8. Invalid / blocked behavior

The reducer keeps structured transition semantics:

- `invalid` for wrong zones, wrong actor, missing battle, duplicate boost, invalid guard references, and mismatched guard responses
- `blocked` when pending requests already exist
- additional battle sequencing guardrails while an unresolved battle is active

No hidden throws are used for normal battle control flow.

## 9. What is intentionally NOT implemented yet

This step does not implement:

- drive checks
- damage checks
- battle outcome resolution
- full power math
- format-specific battle legality matrices
- boost column geometry
- card-text-driven battle effects

Those belong to later battle/effect steps.

## 10. Summary

`rules-core` now has a real battle foundation:

- explicit battle state
- attack declaration
- optional boost commitment
- engine-owned guard request/response flow

This is enough to support the next step, where battle resolution can extend an already coherent combat context instead of inventing one from scratch.
