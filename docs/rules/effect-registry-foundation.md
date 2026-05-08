# Effect Registry Foundation

## 1. Purpose

The effect registry is the rules-core domain subsystem that owns registered
effect definitions and exposes one lookup path for future effect resolution.

It is a registry of gameplay definitions, not an executor. It lets the engine
ask which definitions are candidates for an event or timing window without
embedding card-specific branches into transitions.

## 2. Why effects need a registry

Vanguard effects grow across cards, keywords, formats, and timing windows. If
each transition or adapter starts checking individual cards directly, effect
behavior becomes fragmented and hard to test.

The registry centralizes effect discovery:

- definitions are registered once;
- lookup goes through stable effect identity;
- engine-facing queries use existing event and timing contracts;
- future handler, queue, and keyword layers can build on the same source of
  truth.

## 3. What gets registered

The registered unit is an `EffectDefinition`.

An effect definition contains:

- stable identity;
- effect kind;
- trigger metadata;
- timing bindings;
- applicability metadata;
- resolution model plus execution strategy reference;
- optional tags and keyword metadata.

Cards and keywords are not registered as effects. They will later point to
effect definition ids.

## 4. Effect identity model

Each effect has a structured identity:

- `namespace`;
- `key`;
- derived `EffectDefinitionId`.

The derived id is formatted as `effect:<namespace>:<key>`. Namespace and key
segments must be lowercase structured keys. This keeps ids readable and stable
without tying them to UI labels, database primary keys, or raw card ids.

## 5. Effect definition contract

The baseline contract is intentionally narrow:

- `kind`: triggered, activated, continuous, or replacement;
- `trigger`: event, timing, manual, or static;
- `timing`: bindings to `EffectTimingPoint` and `EffectTimingWindow`;
- `applicability`: global, format, card, or keyword scope, with optional format
  ids;
- `resolution`: automatic, optional, continuous, or replacement model, plus a
  typed handler, declarative descriptor, or hybrid strategy key.

The registry stores strategy keys. It does not call handlers or mutate game
state.

## 6. Relationship to timing/event model

The registry depends on current rules-core event and timing contracts:

- event lookup uses `GameEvent` / `EventType`;
- timing lookup uses `TransitionTimingWindow` or explicit effect timing
  bindings;
- candidate lookup can combine the current event and timing window.

This connects the registry to reducer-owned facts such as attack declaration,
drive checks, damage checks, choice responses, zone transfers, and battle
completion without adding a stack or queue yet.

## 7. Relationship to future keyword/card linkage

Cards and keyword mechanics should reference `EffectDefinitionId`.

The expected later shape is:

- gameplay-facing card projections publish effect references;
- keyword mechanics map keywords to effect ids;
- the effect registry resolves those ids to rules-owned effect definitions;
- the execution layer resolves candidates using runtime source, costs, choices,
  and ordering.

This keeps catalog data and keyword labels separate from runtime behavior.

## 8. What is intentionally NOT implemented yet

This foundation does not implement:

- full effect execution;
- handler invocation;
- costs or target selection;
- stack or queue semantics;
- card-specific effect encyclopedia;
- keyword mechanics mapping;
- DB/catalog importer integration;
- UI registry inspection;
- format-specific override policy.

Registration and lookup are implemented now. Resolution is a later layer.

## 9. Summary

Rules-core now has a pure effect registry foundation. Effects are represented
as structured definitions with stable ids, event/timing metadata, applicability,
and execution strategy references. The engine can discover candidate effects
systemically, while effect execution remains intentionally out of scope for
Phase 18.1.
