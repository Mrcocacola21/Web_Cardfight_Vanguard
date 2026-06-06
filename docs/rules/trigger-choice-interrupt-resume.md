# Trigger Choice Interrupt/Resume

## 1. Purpose

This document defines the bounded runtime model for trigger choices that cannot be silently auto-targeted.

The engine owns the full path: reveal trigger, create a canonical pending request, pause the current check resolution, accept a participant response, resume the same check trigger resolution chain, and finish battle or damage aftermath deterministically.

## 2. Why Automatic Trigger Targeting Was Not Enough

Critical, Draw, Heal, and Stand triggers expose real player choices under the supported baseline:

- Critical chooses power target and critical target.
- Draw chooses power target before the draw consequence.
- Heal chooses power target, and chooses a damage card to heal when the heal condition is met.
- Stand chooses power target and, when eligible, a rested rear-guard to stand.

Auto-selecting those targets made realtime synchronize a railroaded approximation. It also hid stale/wrong response failure cases from the authoritative model.

## 3. Chosen Interrupt/Resume Model

The check trigger effect remains the owner of trigger consequences. When a revealed trigger needs player input, it stops inside the effect handler by setting:

- `GameState.status = 'awaiting_choice'`
- a head `pendingRequests[0]` request of type `trigger.resolve`
- `battle.lastCheck.triggerResolutionState = 'awaiting_choice'`
- `battle.lastCheck.triggerContinuation` with serializable resume data

No closure, UI state, or client-owned continuation is used.

## 4. How Trigger Requests Are Created

`trigger.resolve` requests are created by the trigger effect runtime only when at least one required choice exists.

Choice-driven branches:

- Critical: power target plus critical target.
- Draw: power target.
- Heal: power target; heal target only when the current damage condition allows healing.
- Stand: power target; stand target only when a rested eligible rear-guard exists.

Automatic branches:

- Front: applies power to all controlled battle units.
- Current bounded Over Trigger: applies broadcast power and draw; no distribution choice is modeled yet.
- No-trigger checks: resolve as `trigger_check_none`.

## 5. How Continuation/Resume Works

The suspended continuation is stored in `battle.lastCheck.triggerContinuation`.

It records the request id, effect definition id, source check event sequence, revealed card index, next revealed card index, already resolved trigger count, accumulated operation kinds, trigger type, revealed piece id, eligible target sets, and heal condition snapshot when relevant.

`answer.trigger` is accepted only for the head request. The reducer validates it through the canonical request matcher, consumes the head request, reconstructs the source check event from `battle.lastCheck`, applies the selected consequence, clears the continuation, and resumes the remaining revealed cards in the same check trigger handler path.

## 6. Relationship To Queue Ordering

The global event-triggered effect queue dispatches `CHECK_TRIGGER_REVEAL_EFFECT` as before.

The trigger handler pauses its own check-resolution loop at the exact revealed trigger that needs input. After response, resolution resumes from `nextRevealedCardIndex` with the same effect definition id and accumulated operation kinds. It does not create a second check flow and does not reprocess already revealed triggers.

If resume creates another immediate trigger choice request, that request becomes the new head before older queued requests.

## 7. Relationship To Battle/Check Aftermath

Drive and damage checks enter `pending_resolution` after the raw check transition.

While a trigger request is active, aftermath does not advance past the unresolved trigger. Damage checks keep their current damage state, including a temporarily lethal outcome when the revealed Heal trigger has not yet resolved. After `answer.trigger`, Heal can reconcile `battle.damage.damageAfter` and `outcome` before the check is marked `resolved_triggers`.

Completed matches stop resolution immediately. Resolved checks clear `triggerContinuation`.

## 8. Failure/Stale Response Semantics

Wrong responder, wrong response type, missing required target, extra target for a non-requested branch, and illegal target all fail as `request_response_mismatch`.

A response for a non-head request is blocked by the existing pending-request discipline.

A response after the request is gone fails as `request_not_pending`.

Terminal states must not retain pending requests; late responses after completion therefore fail structurally instead of auto-selecting a fallback.

## 9. What Is Intentionally NOT Implemented Yet

This step does not implement full priority windows, all historical trigger exceptions, final Over Trigger text variance, client-owned fallback choices, or a new queue model.

The current Over Trigger branch remains bounded and automatic. Front remains automatic because it applies to all controlled battle units in the current supported baseline.

## 10. Summary

Trigger choices now use the canonical pending request model. The runtime no longer silently selects player-choice trigger targets for Critical, Draw, Heal, or Stand. Resume is serializable, deterministic, reducer-owned, and integrated with the existing effect runtime, check ordering, hidden-information projection, and pending-request action blocking.
