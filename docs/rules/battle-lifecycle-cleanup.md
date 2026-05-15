# Battle Lifecycle Cleanup

## 1. Purpose

This step makes battle cleanup and turn-scoped cleanup explicit engine lifecycle work. A battle is not considered fully finished until the engine resolves its mandatory battle flow, clears the active battle state, and emits the completion facts.

## 2. Why battle cleanup had to become explicit

The battle pipeline already had attack, guard, check, combat, damage, and trigger aftermath seams. The unsafe part was the tail: guardians and battle context could be treated as implicitly gone even though authoritative state still had to prove it. Realtime and later effect timing need a stable boundary instead of callers inferring that no more battle work is pending.

## 3. Battle end semantics

Battle starts with `battle.declare_attack`. It becomes resolvable after either:

- `damage_checked`, for a hit that completed damage aftermath; or
- `combat_resolved` with an explicit `miss`, for a no-damage branch.

The mandatory engine action `system.resolve_mandatory_flow` with `scope: 'battle'` is the canonical battle end path. It emits `battle.completed`, clears `state.battle`, and opens the `battle.completion` timing windows around that fact.

## 4. Guardian cleanup semantics

Guardian cleanup is part of battle completion, not UI cleanup. If the completed battle has `guardPieceIds`, those pieces are moved from the battle `guardian_circle` to the defending player's `drop` with reason `battle_cleanup`.

The engine emits normal `piece.moved` facts for the zone transfer and then emits `battle.guardians_cleaned_up` before `battle.completed`. Missing guard or drop zones are structured invalid state, not silent no-ops.

## 5. End-of-turn flag cleanup semantics

Turn-scoped runtime state is cleared only at turn switch, before the next player's `turn.started` fact. The cleanup removes temporary flags and power/critical modifiers, while preserving persistent bounded flags such as `locked` and face-down damage.

When anything is removed, the engine emits `turn.cleanup_applied` with the affected piece ids, removed flag piece ids, and cleared modifier piece ids.

## 6. Difference between battle cleanup and turn cleanup

Battle cleanup clears only battle-owned residue: active battle state and guardians committed to the guardian circle.

Turn cleanup clears until-end-of-turn runtime state. A power bonus or persona-like turn flag can survive battle completion and still expire correctly at turn end.

## 7. Relationship to trigger/effect ordering and terminal states

Battle completion runs after combat, checks, trigger consequence resolution, and damage aftermath. It does not erase battle context before those runtime paths finish.

On lethal damage, cleanup still runs first. The engine then emits `battle.completed`, `player.defeated`, and `match.ended`, and the completed state has no stale battle context or pending requests.

## 8. What is intentionally NOT implemented yet

This is not a universal continuous-effect/status engine. It does not model every historical cleanup exception, replacement effect, or future card-text timing nuance. It establishes the engine-owned lifecycle boundary that those systems can extend later.

## 9. Summary

Battle end is now a real engine lifecycle step. Guardians are deterministically moved to drop during battle completion, turn-scoped flags and modifiers expire at turn switch, and the two cleanup scopes remain separate and observable.
