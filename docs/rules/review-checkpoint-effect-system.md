# Review Checkpoint: Effect System

## 1. Executive Summary

Verdict: **GO WITH CONDITIONS**.

Phase 18 now forms a real rules-core subsystem: effects have stable definitions, keyword bindings, typed/declarative/hybrid representation, event-triggered resolution, observable first effects, and a formal staged FIFO queue. This is no longer a decorative registry.

The architecture is sound enough to move forward, but not yet safe for broad card-effect expansion. The main risks are central effect-id dispatch in the triggered resolver, one remaining pre-event mechanic hook for continuous modifiers, and silent queue-depth dropping.

## 2. Scope Reviewed

Reviewed:

- effect definition and registry contracts;
- keyword mechanics contracts and sample mappings;
- hybrid effect representation;
- first working effects;
- event-triggered resolver;
- resolution queue;
- reducer/transition integration;
- tests and Phase 18 documentation.

Out of scope:

- official full card-effect encyclopedia;
- final priority/stack rules;
- UI inspection;
- network/replay protocol.

## 3. Effect System Coherence Review

The subsystem is coherent. The current flow is understandable:

`keyword/card runtime facts -> effect ids -> registry definitions -> event/timing matching -> queue items -> bounded resolution -> transition result`.

The layers are not just adjacent folders. Registry, keyword mechanics, hybrid definitions, triggered resolution, and queue ordering actively compose in runtime tests.

Remaining concern: pre-event continuous effects such as Twin Drive still use a direct transition hook. That is acceptable as a bounded proof, but it must become a generic before-window modifier seam before more check modifiers are added.

## 4. Effect Registry Review

The registry is load-bearing:

- stable `effect:<namespace>:<key>` identity;
- immutable registration;
- duplicate rejection;
- event/timing lookup;
- central sample registry used by keyword and triggered flows.

Registration and execution are still separated. The registry stores definitions and strategy metadata; it does not mutate state.

Risk: the resolver currently uses effect ids to decide which bounded implementations can execute. This does not weaken registry identity, but it can turn into a central handler forest if left as-is.

## 5. Keyword Mechanics Layer Review

The keyword layer is a real gameplay bridge:

- stable `Keyword` inputs;
- explicit `KeywordMechanicDefinition`;
- effect bindings by `EffectDefinitionId`;
- format gating for Persona Ride;
- no importer, DB, browser, or UI dependency.

The bridge is not raw string chaos. It consumes stable shared keyword contracts and maps them to engine-facing effect definitions.

Current sample size is intentionally small but representative: Boost, Intercept, Twin Drive, Persona Ride.

## 6. Hybrid Effect Model Review

The top-level effect contract supports typed, declarative, and hybrid effects coherently.

Strengths:

- one `EffectDefinition` contract;
- representation discriminated through `resolution.strategy.kind`;
- keyword layer can reference any representation without caring;
- queue items are representation-neutral;
- declarative operations are bounded and typed, not loose JSON.

Risk: the declarative subset is still very small. That is fine now, but first real expansion should prove at least one reusable interpreter path instead of pushing every new behavior into typed branches.

## 7. First Effects Review

The first effects are real and observable:

- Twin Drive changes drive check count and revealed/moved cards.
- Persona Ride draws, emits `cards.drawn`, materializes power with a marker flag, and triggers a nested draw finalizer.
- Check finalizer changes check state to `resolved_none`.

They prove registry, keyword, timing/event, hybrid, state mutation, events, and queue ordering.

Concern: Twin Drive remains wired through `resolveDriveCheckCountEffects` inside the drive check transition. This is acceptable for Phase 18 proof-of-viability, but it is the clearest scale-risk seam.

## 8. Event-Triggered Resolution Review

Triggered resolution is engine-owned:

- reducer applies a base transition;
- triggered resolver consumes the applied transition result;
- effects match against emitted events and related timing windows;
- consequences fold back into a structured transition result.

No-match cases remain calm. Invalid effect execution can return structured invalid transition output.

The main limitation is intentional: only supported bounded effects are executable. The current allow-list is explicit, but it must evolve into handler/operation dispatch before many effects are added.

## 9. Stack/Queue Review

The ordering model is formal and deterministic.

Chosen model: staged FIFO queue.

Scheduled unit: `EffectResolutionQueueItem`, carrying trigger event, timing window, effect definition, source kind, insertion sequence, depth, and optional parent item.

Ordering policy:

1. trigger event sequence;
2. timing window sequence;
3. source kind;
4. stable effect id;
5. source piece id;
6. FIFO insertion sequence.

Nested behavior is bounded and explicit. Persona Ride can emit `cards.drawn`; the resolver creates a timing window for that nested event; the draw finalizer is appended to the queue tail.

Concern: queue max-depth overflow currently drops nested seeds calmly but silently. Deterministic, but too quiet for future debugging.

## 10. Reducer / Contract Integration Review

Reducer integration is structurally good:

- base transitions still own core mechanics;
- reducer wraps applied transitions with triggered resolution;
- effect consequences return through normal `TransitionResult`;
- events remain ordered;
- pending requests stay reducer-owned;
- invalid results stay structured.

The effect layer is not a second reducer yet. It does mutate state for effect consequences, but only inside the transition/result contract. This is acceptable for the current engine-owned effect subsystem.

Risk: if more mechanics import effect-specific helpers like drive check does now, that boundary will degrade.

## 11. Adapter Compatibility Review

Core-vs-adapter separation still holds:

- no UI/browser/DB/importer dependencies in rules-core effect code;
- Persona Ride is format-scoped through applicability;
- keyword mechanics supports format-scoped mappings;
- Standard/V Premium/Premium can still grow through format policy/adapters.

Current core samples naturally include Standard Persona Ride. That is not a stealth Standard-only architecture, but future format-specific behavior should avoid hardcoding format checks inside every typed effect.

## 12. Test Coverage Review

Coverage is meaningful, not decorative.

Tests cover:

- registry creation, lookup, duplicates, metadata stability;
- keyword mapping and format applicability;
- typed/declarative/hybrid classification;
- first real effect consequences;
- event-triggered candidate collection and execution;
- queue ordering, FIFO consumption, nested append, empty queue, depth bound;
- reducer-observable event/state outcomes.

Remaining gaps:

- no tests for structured behavior when queue max depth is exceeded in actual triggered resolution;
- no tests for optional effect/request-producing effects yet;
- no adapter matrix around format-specific effect behavior beyond initial Standard/Premium gating.

## 13. Documentation Review

Phase 18 docs exist and explain separation of concerns:

- effect registry;
- keyword mechanics;
- hybrid model;
- first effects;
- event-triggered resolution;
- stack/queue model.

Small fix applied during checkpoint: `first-effects-proof-of-viability.md` was updated to reflect that Persona Ride now resolves through event-triggered queue flow and that stack/queue now exists.

Some docs remain step-foundation docs and intentionally describe what was out of scope at that step. The checkpoint document should be treated as the current end-of-Phase-18 summary.

## 14. Top Findings

### Finding 1

Severity: **Medium**

Issue: `triggered-resolution.ts` still dispatches executable effects through explicit effect-id checks and an allow-list.

Why it matters: this is safe for three bounded effects, but it will become a central handler forest if dozens of real effects are added.

Recommendation: before broad card-effect expansion, introduce a typed handler/declarative operation dispatcher keyed by strategy metadata, with capability registration separate from effect definitions.

### Finding 2

Severity: **Medium**

Issue: Twin Drive is still integrated as a direct pre-check helper call from the drive check transition.

Why it matters: continuous/replacement/before-window effects will likely multiply. If each mechanic imports effect-specific helpers, the systemic architecture weakens.

Recommendation: add a generic before-window modifier collection/resolution seam for check count and similar replacement/continuous effects.

### Finding 3

Severity: **Medium**

Issue: queue max-depth overflow drops nested seeds silently.

Why it matters: deterministic silence is better than nondeterminism, but hidden dropped effects will be hard to debug once real chains exist.

Recommendation: return structured queue overflow status, emit a diagnostic domain event, or invalidate the transition under an explicit engine error policy.

### Finding 4

Severity: **Low**

Issue: nested timing window generation is currently hardcoded for `cards.drawn -> zone.transfer:after`.

Why it matters: the next nested trigger examples could copy this pattern and scatter timing derivation logic.

Recommendation: introduce a small event-to-timing derivation policy/table before adding more nested event families.

### Finding 5

Severity: **Low**

Issue: declarative operations are useful but still narrow.

Why it matters: if most new effects bypass declarative operations, the hybrid model will skew typed and lose its boilerplate-reduction value.

Recommendation: add the next repeated simple effect as a declarative operation and keep typed handlers for genuinely procedural rules.

## 15. Fixes Applied

- Updated `docs/rules/first-effects-proof-of-viability.md` to reflect current event-triggered queue behavior.
- No production code changes were needed during the checkpoint.

## 16. Final Verdict

Verdict: **GO WITH CONDITIONS**.

The effect system is now a real scalable foundation, not a pile of placeholders. It is coherent enough to proceed to the Phase 18 review close and plan the next development phase.

Conditions before broad effect expansion:

- replace effect-id execution branching with a handler/operation dispatch layer;
- generalize pre-event continuous/replacement modifier resolution;
- make queue overflow behavior structured and visible;
- keep docs updated as foundation docs become historical.
