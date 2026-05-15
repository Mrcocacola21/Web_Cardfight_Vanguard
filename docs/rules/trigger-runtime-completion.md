# Trigger Runtime Completion

## 1. Purpose

This step closes the gap between "a check revealed a trigger" and "the trigger actually changed gameplay state." Supported trigger consequences now execute as part of the engine-owned effect runtime path.

## 2. What Was Incomplete Before

The check flow could reveal cards and mark `lastCheck.triggerResolutionState` as pending, but the architectural risk was that consequences could drift into direct check helpers or remain reveal-only.

That would make one of Vanguard's most common runtime paths a side channel next to the effect system.

## 3. How Trigger Consequences Flow Through The Effect System

Drive and damage check transitions only move the checked card, emit `battle.drive_checked` or `battle.damage_checked`, and leave the check as `pending_future_engine`.

Event-triggered resolution then collects `CHECK_TRIGGER_REVEAL_EFFECT`, enqueues it, and dispatches it through `EffectHandlerRegistry` using `core.check.resolve-revealed-triggers`.

The trigger handler owns consequence execution. It emits `trigger.revealed`, applies state changes, emits `trigger.resolved`, and finishes with `effect.resolved`. Any nested `cards.drawn` events re-enter the existing event-triggered queue and are finalized by the draw finalizer effect.

## 4. Supported Trigger Types And Runtime Status

Critical: applies +10000 power and +1 critical to the primary trigger target.

Draw: applies +10000 power and draws one card when a deck card is available.

Front: applies +10000 power to all controlled battle units.

Heal: applies +10000 power, evaluates damage condition after damage placement, and heals one deterministic damage card when eligible.

Stand: applies +10000 power and stands the first eligible rested rear-guard; with no stand target, the stand portion is a structured no-op.

Over: applies the current bounded +100000000 broadcast power baseline and draws one card.

No-trigger checks resolve through the same check effect and emit `effect.resolved` with `trigger_check_none`.

## 5. Targeting / Choice Handling

The current baseline is deterministic auto-targeting inside the trigger effect handler:

- drive checks prefer the attacking unit;
- damage checks prefer the checked player's vanguard;
- otherwise the first controlled battle unit is used;
- Stand chooses the first eligible rested rear-guard.

There is no player choice request for trigger targeting yet. That is intentional for this bounded runtime completion step; no UI/session rescue path is involved.

## 6. Heal And Over Trigger Special Considerations

Heal checks the damage condition against canonical damage zones after the revealed card has entered damage. If healing succeeds during a damage check, battle damage aftermath is reconciled so a 5 to 6 damage check can become non-lethal.

Over Trigger is not treated as a name-only branch. The bounded baseline applies broadcast power to controlled battle units, draws one card, and emits `overTriggerApplied`.

## 7. Queue/Ordering And Battle/Check Flow

The queue remains responsible for ordering. The check effect resolves before nested effects created by its emitted events. Draw and Over triggers emit `cards.drawn`, which schedules the draw finalizer through the same event-triggered queue.

Raw check transitions do not apply trigger consequences. Reducer-level action application runs event-triggered resolution after the base transition, preserving the same battle/check/damage sequencing.

## 8. What Is Intentionally NOT Implemented Yet

This step does not implement player-directed trigger target choices.

It does not model obscure format-era trigger exceptions or full Over Trigger text variance.

It does not add advanced simultaneous effect arbitration beyond the current queue policy.

It does not move trigger consequences into a broad declarative DSL; the current trigger effect remains a typed runtime handler because target policy, damage reconciliation, and event emission are procedural.

## 9. Summary

Supported triggers are no longer reveal-only. Their consequences are state-changing, event-producing, deterministic, and routed through the effect runtime instead of direct check-flow shortcuts.
