# Hybrid Effect Model Foundation

## 1. Purpose

The hybrid effect model lets rules-core represent effects through one
`EffectDefinition` contract while allowing different implementation shapes:
typed, declarative, and hybrid.

The model is not an executor. It defines how effect definitions carry enough
structured semantics for future resolution without forcing every effect into one
extreme.

## 2. Why effect system cannot be only typed

Typed handlers are necessary for rich procedural rules: unusual branching,
source validation, timing interactions, and format-sensitive behavior.

If every repeated effect pattern becomes a custom handler, the system will grow
boilerplate, duplicate logic, and handler sprawl. Simple recurring effects need
a smaller representation.

## 3. Why effect system cannot be only declarative

Vanguard effects are not all regular data transforms. Some effects need precise
domain logic that would become unsafe or unreadable as a generic DSL.

A declarative-only model would either under-model hard cases or become a broad
interpreter platform too early.

## 4. Unified effect contract

`EffectDefinition` remains the top-level contract:

- stable identity;
- effect kind;
- trigger metadata;
- timing bindings;
- applicability metadata;
- resolution model;
- execution strategy.

The execution strategy discriminates the representation:

- `typed_handler`;
- `declarative_descriptor`;
- `hybrid`.

Registry lookup, keyword bindings, timing lookup, and event lookup all use the
same effect id and definition shape.

## 5. Typed effects

Typed effects use a handler key and optional effect family metadata. They are for
procedural semantics that should stay in explicit domain code.

Examples:

- `effect:keyword:boost.commit`;
- `effect:keyword:intercept.guard-from-circle`;
- `effect:core:check.resolve-revealed-triggers`.

Typed definitions do not require declarative operations.

## 6. Declarative effects

Declarative effects use a descriptor key plus bounded operation payloads. The
current operation subset is intentionally small:

- adjust a check count;
- draw cards;
- apply a power modifier.

Example:

- `effect:keyword:twin-drive.check-count` describes an additive drive-check
  count modifier.

This is structured domain data, not loose JSON and not a universal DSL.

## 7. Relationship to effect registry

The effect registry stores all representations under the same registration and
lookup path. Duplicate ids are still rejected. Metadata and operation payloads
are normalized and frozen when registered.

The registry does not execute typed handlers or interpret declarative
operations.

## 8. Relationship to keyword mechanics layer

Keyword mechanics continue to point to `EffectDefinitionId`. They do not need to
know whether the target effect is typed, declarative, or hybrid.

This keeps the keyword layer as a content-to-engine bridge while the effect
definition owns representation details.

## 9. Sample hybrid examples

The sample set now includes:

- typed: `boost` and `intercept` keyword effects;
- declarative: `twin-drive` check-count modifier;
- hybrid: `persona-ride`, with a typed handler key for eligibility/procedure
  and declarative operations for draw and front-row power.

These examples connect to existing keyword, timing, event, and registry
semantics without resolving effects yet.

## 10. What is intentionally NOT implemented yet

This foundation does not implement:

- effect execution;
- handler invocation;
- declarative interpreter;
- cost payment;
- target selection;
- stack or queue processing;
- full card-effect DSL;
- full official keyword/effect encyclopedia.

## 11. Summary

Rules-core now has a unified hybrid effect model. Typed, declarative, and hybrid
effects share one identity and registry contract. Declarative payloads are small
and strongly shaped, typed effects remain available for procedural behavior, and
keyword mechanics can reference either form without knowing internal details.
