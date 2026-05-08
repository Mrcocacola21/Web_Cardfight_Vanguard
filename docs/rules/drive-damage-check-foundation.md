# Drive / Damage Check Foundation

## 1. Purpose

This step introduces `drive check` and `damage check` as real engine mechanics inside `rules-core`.

## 2. Why drive and damage checks are core Vanguard mechanics

These checks are one of the most format-defining parts of Vanguard. They are not UI reveals or draw aliases. They consume top-deck runtime card instances, expose reveal facts, and advance battle state in a way that future trigger and battle-resolution systems can build on.

## 3. Drive check semantics

Current baseline:

- `system.drive_check` is a system-owned battle action
- it requires an active battle in `guard_resolved`
- it currently supports only vanguard attacks
- it consumes the top `N` cards from the attacking player deck
- revealed cards move from `deck` to `hand`
- battle state advances to `drive_checked`

## 4. Damage check semantics

Current baseline:

- `system.damage_check` is a system-owned battle action
- it requires an active battle in `drive_checked`
- it currently supports damage-taking only when the battle target is the defending player or defending vanguard
- it consumes the top `N` cards from the defending player deck
- revealed cards move from `deck` to `damage`
- battle state advances to `damage_checked`

## 5. Reveal handling

Reveal is owned by engine state and events.

Each check records:

- revealed runtime piece ids
- canonical card definition ids when available
- source and destination zones
- a bounded trigger-resolution status

This data is stored in `battle.lastCheck` and emitted through battle check events. Full viewer-specific hidden-information projection is still a later concern.

## 6. Post-check zone movement

Current baseline movement is explicit:

- drive check: `deck -> hand`
- damage check: `deck -> damage`

Checks also emit `piece.moved` events for the same card instances, so replay/logging code can follow both reveal facts and zone movement facts.

## 7. Trigger/result handling baseline

This step does not implement the full trigger engine.

Instead, each check stores and emits:

- revealed cards
- `triggerResolutionState: 'pending_future_engine'`

That gives later trigger/effect work a clean hook without pretending that trigger resolution already exists.

## 8. Invalid / blocked behavior

The reducer keeps structured semantics:

- `invalid` when battle context is missing or in the wrong phase
- `invalid` when source/destination zones do not match check semantics
- `invalid` when the top-deck source cannot supply the requested count
- `blocked` when pending requests already stop progression

No hidden randomness or UI-owned reveal logic is used.

## 9. What is intentionally NOT implemented yet

This step does not implement:

- full trigger resolution
- power / critical modifier application
- hit / miss determination
- battle completion cleanup
- format-specific drive counts or edge-case legality matrices
- viewer-specific reveal/privacy projection

## 10. Summary

`rules-core` now owns deterministic drive and damage checks as battle mechanics. Top-deck consumption is explicit, reveal facts are part of engine output, and battle state now has a stable place to carry future trigger-resolution work.
