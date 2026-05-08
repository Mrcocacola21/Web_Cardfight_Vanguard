# Keyword Mechanics Layer Foundation

## 1. Purpose

The keyword mechanics layer is the rules-core bridge from stable content-facing
keywords to engine-facing effect semantics.

It turns keyword references into structured mechanic bindings that point at
registered effect definitions. It does not execute those effects.

## 2. Why keywords need a gameplay layer

Catalog keywords are content facts. Gameplay needs to know what those facts mean
for actions, checks, guards, timing, and future effect resolution.

Without a dedicated layer, reducers and adapters would gradually collect direct
string checks for keywords or card text. The keyword mechanics layer keeps that
mapping explicit, inspectable, and testable.

## 3. Input semantic model

The input is a stable `Keyword` from `@web-vg/shared` or a
`KeywordMechanicReference`.

The layer does not consume:

- display labels;
- raw card text;
- importer staging ids;
- publication pipeline internals.

Keyword values are validated as lowercase structured semantic keys such as
`boost`, `intercept`, `twin-drive`, and `persona-ride`.

## 4. Output semantic model

The output is a `KeywordMechanicDefinition` containing:

- derived keyword mechanic id;
- keyword reference;
- applicability metadata;
- one or more `KeywordEffectBinding` entries;
- optional mechanic tags.

Each effect binding points to an `EffectDefinitionId` and declares the semantic
role of that binding, such as granting an action, enabling a guard source,
modifying a check, or triggering resolution.

## 5. Relationship to effect registry

The effect registry remains the source of effect definitions.

The keyword layer only maps keyword semantics to effect ids. A bridge helper can
resolve those ids through an `EffectRegistry` to prove that a keyword has a
registered engine route, but no handler is invoked and no state is mutated.

This preserves the separation:

- effect registry: definitions;
- keyword mechanics layer: keyword-to-effect bindings;
- future effect engine: execution, ordering, costs, choices, and queues.

## 6. Relationship to catalog/content tags

Catalog/content owns the fact that a card has a keyword. Rules-core consumes the
stable semantic keyword only after publication or projection has already
normalized content.

The gameplay layer does not import catalog, DB, importer, or UI modules. It
depends only on shared stable contracts and rules-core domain subsystems.

## 7. Sample keyword mappings

The initial sample set is intentionally small:

- `boost` maps to `effect:keyword:boost.commit`;
- `intercept` maps to `effect:keyword:intercept.guard-from-circle`;
- `twin-drive` maps to `effect:keyword:twin-drive.check-count`;
- `persona-ride` maps to `effect:keyword:persona-ride.on-ride` and is scoped to
  Standard format applicability.

These examples show generic keywords, battle timing hooks, check modification,
and format-scoped behavior without implementing a full effect engine.

## 8. What is intentionally NOT implemented yet

This foundation does not implement:

- full keyword encyclopedia;
- card text parsing;
- raw catalog/importer integration;
- effect handler execution;
- cost payment or target selection;
- stack or queue processing;
- adapter-specific keyword override policy;
- UI keyword inspection.

## 9. Summary

Rules-core now has a pure keyword mechanics layer. Stable keywords can be mapped
to explicit effect definition ids, filtered by format applicability, and resolved
through the effect registry. That gives the engine a systemic route from content
semantics to future behavior while keeping registration, mapping, and execution
separate.
