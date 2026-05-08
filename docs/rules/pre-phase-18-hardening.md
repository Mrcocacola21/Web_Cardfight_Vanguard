# Pre-Phase 18 Hardening

## 1. Purpose

This pass closes the minimum semantic gaps that would make an effect system ambiguous: transfer flag lifecycle, battle completion, choice-response events, and effect timing windows.

It does not implement the Phase 18 effect system. It only gives future effect registry and queue work stable reducer-owned boundaries.

## 2. Why these four seams had to be closed before Phase 18

Phase 18 effects need clear facts to observe and clear moments to attach to. Before this pass, zone transfers preserved runtime piece state by accident, completed battles could remain in `GameState.battle`, accepted choice responses could resolve without an event, and timing was only implied by event order.

Those gaps would make triggered effects depend on implementation accidents instead of engine contracts.

## 3. Flag lifecycle across transfers

Runtime piece flags now have an explicit transfer policy in `transfers/flag-lifecycle`.

- Main unit circle to main unit circle: preserve orientation and flags. Today this means `stand`/`rest` and known flags such as `locked` remain attached.
- Any transfer entering or leaving the runtime unit context: reset to default `stand` with no runtime flags.
- Guardian circle, hand, deck, soul, drop, bind, damage, ride deck, G zone, and similar non-main contexts do not preserve unit orientation or `locked`.
- The baseline policy is source/destination-zone driven. Transfer reason is part of the policy input for future refinement, but no current rule special-cases battle context or format.

All reducer movement now routes through the zone transfer layer so mechanics do not decide flag cleanup ad hoc.

## 4. Battle completion / cleanup semantics

Battle completion is now an explicit engine-owned transition: `system.resolve_mandatory_flow` with `scope: "battle"` after `battle.damage_checked`.

Completion does three things:

- emits `battle.completed` with the load-bearing battle summary, including attacker, defender, target, guard pieces, and last check;
- removes `GameState.battle`;
- moves committed guardians from guardian circle to the defending player's drop zone using `battle_cleanup`, resetting their runtime piece state through the transfer lifecycle policy.

If no guard pieces were committed, cleanup emits only `battle.completed` and clears the battle. If committed guardians cannot be cleaned because required zones are missing, the transition is invalid instead of silently losing state.

## 5. Event policy for choice responses

Every accepted choice response now emits exactly one `choice.response_resolved` event before any domain consequences from that response.

Policy:

- generic choices emit only `choice.response_resolved`;
- guard selection emits `choice.response_resolved`, then guardian moves, then `battle.guard_declared`;
- guard pass emits `choice.response_resolved`, then `battle.guard_passed`;
- mulligan emits `choice.response_resolved`, then movement/shuffle/draw events, then `mulligan.completed`;
- invalid, blocked, or mismatched responses emit no events.

The choice event describes request resolution and responder input. Subsequent transition events describe gameplay facts caused by that input.

## 6. Minimal timing windows

`TransitionResult` now includes deterministic `timingWindows`.

The current minimal vocabulary is:

- `before`
- `on`
- `after`

The current timing points are:

- `zone.transfer`
- `choice.response`
- `battle.attack`
- `battle.boost`
- `battle.guard`
- `battle.drive_check`
- `battle.damage_check`
- `battle.completion`

Timing windows are reducer output, not UI interpretation. They are intentionally simple metadata, not a stack, queue, trigger resolver, or DSL.

## 7. Tests added

Focused coverage was added or strengthened for:

- transfer flag reset/preserve behavior across main and non-main zones;
- battle completion clearing `GameState.battle` and moving guardians to drop;
- choice response events for generic, guard, pass, and mulligan paths;
- deterministic timing windows on transfer, attack, guard, drive, damage, and battle completion transitions.

The full `@web-vg/rules-core` test suite passes after the changes.

## 8. What is still intentionally NOT implemented yet

This pass does not implement:

- effect registry;
- keyword mechanic layer;
- trigger resolution;
- stack or queue model;
- card-specific effects;
- full Vanguard battle outcome math;
- full timing taxonomy;
- format-specific timing overrides.

The transfer policy accepts transfer reason as input so adapters can refine later without rewriting the reducer-owned lifecycle contract.

## 9. Summary

The rules engine now has explicit transfer flag lifecycle, explicit battle completion cleanup, coherent choice-response events, and minimal timing windows. That is enough semantic hardening to start Phase 18.1 Effect registry without building on hidden lifecycle or timing assumptions.
