# Damage Win Condition Foundation

## 1. Purpose

This step makes damage count and defeat at 6 damage part of engine truth. A
match can now complete by gameplay rules, not only by concede.

## 2. Why damage must become gameplay truth

Damage cards already moved into a damage zone, but that was only zone content.
Combat could hit and damage check could reveal a card, while no engine rule knew
whether the defending player had reached lethal damage.

Damage count is now observable and reducer-owned, so trigger resolution and
later win-condition work can build on a real post-damage state.

## 3. How damage is counted

Canonical damage truth is the number of occupants in the player's owned
`damage` zone.

`resolvePlayerDamageState` exposes a deterministic engine query:

- player id;
- damage zone id;
- current damage count;
- defeat threshold;
- whether the player is currently defeated by damage.

The battle stores only a damage-check snapshot for the current battle aftermath,
not a second global damage counter.

## 4. Lethal threshold and evaluation point

The current Vanguard baseline threshold is 6 damage.

Evaluation happens after the damage-check card has been moved into the damage
zone. The `system.damage_check` transition records `battle.damage` with
`damageBefore`, `damageAfter`, threshold, and `non_lethal` or `lethal` outcome.

The terminal game-state transition happens during the required battle-scoped
mandatory aftermath. Until that aftermath resolves, the active battle blocks
other gameplay actions.

## 5. Non-lethal vs lethal branches

Non-lethal branch:

- damage count is updated;
- battle reaches `damage_checked`;
- battle completion clears battle state;
- match remains `in_progress`.

Lethal branch:

- damage count is updated;
- battle reaches `damage_checked` with a `lethal` damage outcome;
- battle completion clears battle state;
- defeated player status becomes `defeated`;
- game state becomes `completed`.

## 6. Match/battle aftermath events

Damage check now emits:

- `battle.damage_checked` with the damage snapshot;
- `player.damage_changed`.

Battle aftermath may emit:

- `battle.completed`;
- `player.defeated` for lethal damage;
- `match.ended` with reason `damage_defeat`.

## 7. Relationship to room/session boundary

`rules-core` owns the damage defeat rule. The room/session layer only consumes
the resulting engine state and events. When engine state becomes `completed`,
the room lifecycle becomes `completed`; it does not recalculate damage or invent
its own win condition.

## 8. What is intentionally NOT implemented yet

This step does not implement:

- trigger effects during damage check;
- alternative win/loss conditions;
- heal-trigger prevention or replacement timing;
- tournament result persistence;
- realtime reconnect/authoritative sync.

## 9. Summary

Damage is now counted from canonical engine state, lethal damage is explicit,
and battle aftermath can end the game through engine-owned Vanguard rules.
