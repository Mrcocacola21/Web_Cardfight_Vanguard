# Effect Runtime Hardening

## 1. Purpose

Pre-Phase 20B Step 1 makes effect execution match the effect contracts that already existed. `handlerKey` is now a runtime dispatch key, not metadata that the resolver ignores.

## 2. Why id-based dispatch had to go

The previous event-triggered resolver selected executable effects and executed them through hardcoded checks against specific effect definition ids. That made the system look data-driven while requiring every new executable effect to edit the central resolver.

That shape does not scale to real card effects or realtime ordering because one file becomes the hidden runtime registry.

## 3. Definition registry vs handler registry

`EffectRegistry` stores effect definitions: identity, timing, trigger metadata, applicability, resolution strategy, handler keys, descriptor keys, and declarative operations.

`EffectHandlerRegistry` stores executable runtime handlers: `EffectHandlerKey -> EffectHandler`. It rejects duplicate keys, provides deterministic lookup/listing, and can validate that definitions requiring handlers have registered handlers.

These registries are intentionally separate. Definitions describe what an effect is; handlers execute procedural runtime behavior.

## 4. Chosen runtime dispatch model

Event-triggered resolution still owns candidate collection, queue creation, ordering, and nested effect discovery.

Actual execution now goes through `resolveEffectRuntimeQueueItem`:

- `typed_handler` resolves `handlerKey` through `EffectHandlerRegistry`.
- `hybrid` resolves `handlerKey` through `EffectHandlerRegistry`; the handler may use the definition's declarative operations.
- `declarative_descriptor` goes through the bounded declarative runtime path.

The resolver no longer switches on known effect definition ids.

## 5. Typed/declarative/hybrid execution after hardening

Typed effects execute through registered handlers.

Declarative event-triggered effects currently execute only for supported generic operations, with resource operations routed through the existing resource operation resolver. Unsupported declarative operation mixes fail explicitly.

Hybrid effects remain hybrid: Persona Ride is dispatched through a typed handler key, while its draw and power consequences still come from the definition's declarative operation list.

Twin Drive remains on the existing pre-drive-check declarative path because it is a continuous check-count modifier, not an event-triggered queue item.

## 6. Failure behavior

Duplicate runtime handler keys throw a rules invariant error at registration.

If a queued typed or hybrid effect requires a handler key that is not registered, runtime returns an invalid transition result with an explicit missing-handler message.

If a handler receives an event shape it cannot execute, it returns an explicit invalid action reference.

If an event-triggered declarative effect declares unsupported operations, runtime fails instead of silently ignoring them.

## 7. What was migrated in this step

The event-triggered runtime now dispatches these current executable effects through `EffectHandlerRegistry`:

- check trigger reveal/finalization;
- cards drawn finalization;
- Persona Ride hybrid post-ride effect;
- the existing unit attack auto hook as an explicit no-output handler to preserve current behavior until that sample has real gameplay behavior.

Resource declarative effects remain executable through the declarative runtime path.

## 8. What is intentionally NOT implemented yet

This step does not introduce a full declarative DSL.

It does not make every declarative operation executable in every timing context.

It does not move manual Boost or Intercept action handling into the effect runtime.

It does not add new card effects beyond migrated runtime examples.

## 9. Summary

Effect definitions, runtime handlers, and queue resolution now have separate responsibilities. Adding a new typed event-triggered effect requires registering a handler under its `handlerKey`, not editing a central effect-id branch in triggered resolution.
