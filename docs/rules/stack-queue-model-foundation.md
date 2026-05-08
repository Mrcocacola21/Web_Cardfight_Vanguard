# Stack / Queue Model Foundation

## 1. Purpose

The stack/queue model is the engine-owned execution-order layer for pending effect resolutions. It makes ordering explicit by turning triggered effects into scheduled resolution items before execution.

It is not a UI queue, async task runner, transport queue, or generic job system. It is a gameplay-domain ordering contract for effects.

## 2. Why Effect Ordering Must Be Formal

Event-triggered effects can produce more events, and those events can trigger more effects. Without a formal order model, behavior would silently depend on registry order, object iteration, or incidental recursion.

The queue makes the replay contract clear:

`same state + same action + same effects => same scheduled items => same resolution order`

## 3. Why The Chosen Model Is A Queue

The current engine uses a bounded staged FIFO queue, not a LIFO stack.

That matches the current transition model:

- base transition emits an ordered event/timing batch;
- matching effects become queue items;
- items are consumed from the head;
- nested items produced by resolving an item are appended to the tail.

This keeps parent resolution before nested follow-up work, while still making nested scheduling explicit. A later priority/stack layer can refine this without changing the scheduled unit shape.

## 4. Scheduled Unit Model

The scheduled unit is an `EffectResolutionQueueItem`.

It carries:

- stable queue item id;
- insertion sequence;
- depth;
- source kind (`direct` or `keyword`);
- triggering event;
- related timing window;
- effect definition id and effect definition;
- optional source piece id;
- optional parent queue item id for nested work.

The unit is representation-neutral: typed, declarative, and hybrid effects use the same queue item model.

## 5. Insertion And Consumption Policy

Initial trigger candidates are sorted by:

1. trigger event sequence;
2. timing window sequence;
3. source kind (`direct` before `keyword`);
4. stable effect id;
5. stable source piece id.

The queue then assigns insertion sequence and consumes FIFO. Nested candidates are sorted by the same policy and appended to the tail with `depth = parent.depth + 1`.

The current maximum nested depth is bounded by `DEFAULT_EFFECT_RESOLUTION_QUEUE_MAX_DEPTH`.

## 6. Relationship To Event-Triggered Resolution

Event-triggered resolution now creates queue items instead of resolving candidates directly.

The flow is:

`base transition result -> collect candidates -> create queue -> dequeue item -> resolve effect -> append events/timing -> collect nested candidates -> enqueue tail -> final transition result`

Effect definitions still describe what effects are. The queue only describes how pending resolutions are ordered.

## 7. Nested Trigger Behavior

Nested triggers are supported through bounded staged FIFO scheduling.

Current concrete chain:

- `card.rode` triggers Persona Ride;
- Persona Ride resolves and emits `cards.drawn`;
- the resolver creates an internal `zone.transfer:after` timing window for that draw event;
- `cards.drawn` triggers the core draw finalizer;
- the finalizer is appended after the Persona Ride item and emits its own `effect.resolved`.

Effect-emitted events that do not have generated timing windows do not create nested candidates yet.

## 8. What Is Observable Vs Internal

Queue items are internal engine ordering units. They are exported for tests/domain integration, but not stored in `GameState` and not treated as UI state.

Observable behavior is:

- ordered `effect.resolved` events;
- final state changes;
- timing windows that are part of nested trigger matching.

The queue snapshot itself is not emitted as an event.

## 9. What Is Intentionally NOT Implemented Yet

- No full Vanguard priority system.
- No player arbitration over simultaneous optional effects.
- No UI stack inspector.
- No network/replay protocol.
- No complete recursive timing encyclopedia.
- No conflict resolver for every simultaneous trigger edge case.
- No unbounded recursion.

## 10. Summary

Effect ordering is now a formal domain model. Triggered effects are scheduled as queue items, consumed in deterministic FIFO order, and nested follow-up effects are appended with explicit parent/depth metadata. This is a bounded foundation, but it removes accidental execution order from the effect system and prepares the engine for the Phase 18 review checkpoint.
