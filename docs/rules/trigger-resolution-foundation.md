# Trigger Resolution Foundation

## 1. Purpose

This step makes drive check and damage check produce real trigger consequences.
Checks still reveal and move cards through the existing battle flow, but trigger
effects now resolve through the engine effect system.

## 2. Why checks need real trigger consequences

Before this step, a check could reveal a trigger-bearing card and then only mark
the check as complete. That left one of Vanguard's central loops outside
gameplay truth.

Trigger resolution now updates reducer-owned state, emits domain facts, and can
affect later combat or battle aftermath.

## 3. Trigger data contract

Trigger identity comes from the existing engine card stats bridge:

- each runtime card piece has a `cardDefinitionId`;
- match state carries an `EngineCardStatsSnapshot`;
- `EngineCardStats.triggerType` is `critical`, `draw`, `front`, `heal`,
  `stand`, `over`, or `null`;
- raw catalog, importer, DB, and UI models are not imported by `rules-core`.

## 4. Trigger-to-effect mapping model

`battle.drive_checked` and `battle.damage_checked` already open timing windows.
The global `CHECK_TRIGGER_REVEAL_EFFECT` listens to those events and dispatches
to a typed handler.

The handler uses an explicit trigger mapping:

- Critical: power plus critical to the primary target;
- Draw: power to the primary target and draw one;
- Front: power to all controlled battle units under the current board model;
- Heal: power to the primary target and conditional heal;
- Stand: power to the primary target and stand one eligible rested rear-guard;
- Over: special broadcast power and draw one.

The check transition does not hardcode trigger effects beside the effect queue.

## 5. Target policy

This foundation uses deterministic engine-owned auto-targeting until interactive
trigger choice requests are introduced.

Primary target policy:

- drive check: current battle attacker if it is still controlled by the check
  player;
- otherwise the check player's vanguard;
- otherwise the first controlled battle unit.

Front and Over target all controlled units in `vanguard_circle` and
`rear_guard_circle`. The current zone model does not yet store physical
front-row/back-row coordinates, so this is intentionally a battle-unit baseline
rather than final row geometry.

Stand targets the first controlled, rested, unlocked rear-guard. If no valid
target exists, the stand part is a structured no-op while the trigger event
still records the result.

## 6. Heal condition semantics

Heal condition is evaluated after the damage-check card has entered the damage
zone. The trigger player may heal if their current damage count is greater than
or equal to the opponent's current damage count.

When heal succeeds, one deterministic damage card moves to drop. If the trigger
was revealed by damage check, the engine prefers healing an older damage card
before the just-revealed card. The battle damage snapshot is reconciled after
healing, so a 5 to 6 damage check can become non-lethal if heal succeeds.

## 7. Over Trigger semantics

Over Trigger is not treated as a normal +10000 trigger. The bounded current
baseline applies `+100000000` power to all controlled battle units and draws
one card if the player has a usable deck and hand zone.

Full official Over Trigger extras and format-specific card text remain future
effect work.

## 8. Relationship to event-triggered resolution

Trigger resolution is part of event-triggered resolution:

- check transitions emit `battle.drive_checked` or `battle.damage_checked`;
- the effect registry queues `CHECK_TRIGGER_REVEAL_EFFECT`;
- the typed handler emits `trigger.revealed`, consequence events such as
  `cards.drawn`, `piece.stood`, or `player.damage_changed`, then
  `trigger.resolved`;
- nested `cards.drawn` events still pass through the existing effect queue.

This keeps ordering deterministic and reducer-centered.

## 9. What is intentionally NOT implemented yet

This step does not implement:

- interactive player choice for trigger targets;
- full printed card text resolution;
- all era-specific trigger exceptions;
- official Over Trigger remove-from-game and card-specific extra effects;
- final row/column coordinate semantics for Front Trigger;
- full duration cleanup at end of turn.

## 10. Summary

Drive and damage checks now resolve real trigger effects through the effect
system. Trigger consequences are serialized in engine state and events, while
the implementation remains bounded enough for turn enforcement and richer
effect targeting to build on next.
