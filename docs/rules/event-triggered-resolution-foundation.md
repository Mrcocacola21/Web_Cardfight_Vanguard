# Event-Triggered Resolution Foundation

## 1. Purpose

Event-triggered resolution is the engine-owned layer that turns emitted gameplay events into effect resolution. It runs after a base transition, reads that transition's events and timing windows, finds matching registered effects, resolves the currently supported bounded subset, and folds the resulting state/events back into the same transition result.

It is not a UI subscriber, transport event bus, analytics hook, or full priority/stack engine.

## 2. Why Effects Must Resolve From Engine Events

Vanguard effects are heavily tied to facts such as "when rode", "when attack declared", and "when check resolved". If each mechanic file calls effect code directly, the system becomes a set of card-specific branches.

The resolver makes the route systemic:

`base transition -> events/timing windows -> registry/keyword lookup -> bounded effect resolution -> structured transition result`

## 3. Trigger Sources

The current trigger sources are the engine outputs that already exist:

- emitted `GameEvent`s;
- `TransitionTimingWindow`s related to events by `relatedEventSequence`;
- choice-response events are compatible with this model through `choice.response_resolved`, though no choice-triggered effect is implemented in this step.

There is no separate gameplay event universe.

## 4. Trigger Matching Model

An effect can be considered only when:

- its trigger metadata matches the event type;
- its timing metadata matches the related timing window;
- its format/applicability metadata matches the current state;
- keyword-bound effects are reached through the keyword mechanics registry from a stable source piece keyword.

Direct global effects and keyword-bound effects use the same event/timing matching checks. Unsupported registered effects are not executed by this foundation until a bounded resolver path exists for them.

## 5. Relationship To Effect Registry And Hybrid Effect Model

The effect registry remains the source of effect definitions. Event-triggered resolution does not hardcode card ids or raw text.

The current supported paths are:

- typed: `effect:core:check.resolve-revealed-triggers`;
- typed nested follow-up: `effect:core:draw.finalize-cards-drawn`;
- hybrid: `effect:keyword:persona-ride.on-ride`.

Persona Ride uses typed domain gating for the same-card ride condition and declarative operations for draw/power consequences. The check finalizer uses a typed handler path to close the current check as `resolved_none` until full trigger resolution exists.

## 6. Current Resolution Order/Boundaries

Resolution is deterministic and queue-backed as of the stack/queue foundation.

Candidate ordering is:

1. triggering event sequence;
2. related timing window sequence;
3. source kind (`direct` before `keyword`);
4. stable effect id;
5. stable source piece id.

Base transition events are scanned first. Effect-emitted events can schedule bounded nested follow-up work only when the resolver creates timing windows for them. Full priority and simultaneous conflict handling remain deferred.

## 7. Sample Triggered Flows

Persona Ride:

- `card.ride` base transition emits `card.rode`;
- the `card.ride` after window is related to that event;
- the resolver finds the rode piece's `persona-ride` keyword;
- keyword mechanics maps it to `effect:keyword:persona-ride.on-ride`;
- the effect resolves automatically, draws one card, materializes Persona Ride power with a marker flag, and emits `effect.resolved`;
- the emitted `cards.drawn` event can schedule the core draw finalizer as a nested queue item.

Check finalizer:

- drive/damage check emits `battle.drive_checked` or `battle.damage_checked`;
- the after window is related to that event;
- the resolver finds `effect:core:check.resolve-revealed-triggers`;
- the typed path marks the current check as `resolved_none` and emits `effect.resolved`.

## 8. What Is Intentionally NOT Implemented Yet

- No player priority windows.
- No unbounded recursive trigger resolution.
- No simultaneous trigger conflict policy.
- No complete Vanguard timing encyclopedia.
- No full trigger-effect interpreter.
- No UI, DB, importer, browser, or network dependency.

## 9. Summary

The engine can now react to its own domain events systemically. Effects are matched through registry and keyword contracts, resolved through the formal queue model, and returned as normal transition state/events.
