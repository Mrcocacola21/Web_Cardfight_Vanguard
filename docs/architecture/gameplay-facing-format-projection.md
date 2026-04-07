# Gameplay-Facing Format Projection

Status: Gameplay boundary note  
Last updated: 2026-04-07

## Why This Document Exists

This document defines how format meaning reaches the gameplay layer without turning `format profile` into a runtime dumping ground.

The project already has:

- a canonical published `format profile` contract owned by `legality`;
- a published `deck snapshot` contract owned by `decks`;
- a published gameplay-facing catalog projection owned by `catalog`;
- published capability-support rules for gameplay support ownership in `rules`.

What is still needed is the runtime-facing format input used by gameplay systems.

Without that boundary, the architecture will drift in predictable ways:

- `rules` will read the full published `format profile` directly and reinterpret it ad hoc;
- runtime-only behavior will start leaking back into the canonical `format profile`;
- different gameplay subsystems will derive different meanings for the same format;
- `web app` or deck flows will begin patching runtime format behavior indirectly;
- the same format key will accumulate two incompatible meanings, one in `legality` and one in `rules`.

### Decision 1: Gameplay Needs a Narrower Format Input than the Canonical Format Profile

Decision:

- The gameplay layer must receive format meaning through a narrower runtime-oriented projection rather than through the raw canonical `format profile` contract.

Rationale:

- `format profile` is a shared high-level contract.
- Runtime systems need a smaller, more operational representation of only the format facts that matter to gameplay setup and runtime interpretation.

Practical implication:

- `rules` must not treat the canonical profile as if it were already gameplay-ready input.

## What the Gameplay Format Projection Is

A `gameplay-facing format projection` in this project is:

- a minimal, stable, runtime-oriented representation of format behavior derived from the canonical published `format profile` for use inside the gameplay context.

It is:

- derived from canonical format meaning;
- owned by the gameplay boundary;
- narrower than the published format profile;
- suitable for gameplay setup, runtime zone initialization, and runtime format-specific branching.

It is not:

- the canonical `format profile`;
- a legality model;
- a UI representation;
- runtime game state;
- a rules engine implementation;
- a second canonical owner of format meaning.

### Decision 2: Gameplay Format Projection Is a Derived Runtime Contract, Not a New Canonical Format Definition

Decision:

- The gameplay-facing format projection must be treated as a derived runtime contract layer inside gameplay, not as a second canonical definition of Standard, V Premium, Premium, or future formats.

Rationale:

- Canonical format meaning is already owned and published elsewhere.
- Gameplay needs runtime-oriented interpretation, not authority over base format semantics.

Practical implication:

- If gameplay needs a different canonical meaning of a format, the shared `format profile` contract is wrong or incomplete and must be revised centrally.

## Relationship to Format Profile

The canonical `format profile` answers:

- what the format means at cross-context level.

The gameplay-facing format projection answers:

- what runtime-relevant format behavior gameplay systems should operate on.

### Decision 3: Format Profile Remains Canonical; Gameplay Projection Is a Runtime Derivation

Decision:

- `format profile` remains the only canonical cross-context definition of the format.
- The gameplay-facing format projection is a rules-owned derivation of that meaning for runtime use.

Rationale:

- This preserves one owner for canonical format semantics and one owner for runtime interpretation.

Practical implication:

- `rules` may derive gameplay projection from the canonical profile.
- It must not redefine the underlying meaning of format sections, construction basis, or format identity.

### What Comes from the Canonical Format Profile

The gameplay-facing format projection may derive from:

- stable format identity;
- canonical deck-section baseline;
- high-level gameplay-facing markers already published by the canonical profile;
- any other published format facts that materially affect gameplay setup.

### What Gets Transformed

The gameplay-facing format projection should transform high-level format meaning into runtime-oriented gameplay inputs such as:

- runtime zone availability;
- runtime section-to-zone interpretation;
- runtime mechanic enablement markers;
- runtime setup behavior switches;
- adapter-selection inputs inside gameplay.

### What Gets Dropped

The gameplay-facing format projection should drop published format information that does not materially affect runtime behavior, especially:

- legality-oriented construction interpretation that matters only before play;
- restriction attachment baselines;
- card-pool basis markers;
- support-state publication details as if they were runtime rules.

### Decision 4: Rules Engine Core Must Not Consume Raw Format Profile Directly

Decision:

- The rules engine core should consume gameplay-facing format projection, not raw `format profile`.

Rationale:

- Direct dependence on the raw profile would let runtime code become the place where canonical format meaning is reinterpreted piecemeal.

Practical implication:

- Format-profile consumption belongs at the gameplay boundary or adapter layer, not deep inside runtime action or effect logic.

## Required Data Categories

The gameplay-facing format projection should include only categories that materially affect gameplay setup, runtime state structure, or runtime action/effect interpretation.

### Decision 5: Projection Must Include Only Runtime-Relevant Format Facts

Decision:

- Every included category must answer one question:
- "What runtime behavior, runtime setup choice, or runtime interpretation needs this format fact?"

Rationale:

- A smaller runtime contract is more stable and less likely to drag legality concerns into gameplay.

Practical implication:

- If a format field has no clear runtime use, it does not belong in the projection.

### Required Conceptual Categories

The projection should contain at least these categories:

- stable gameplay-facing format identity suitable for runtime selection and tracing;
- runtime deck-section interpretation, such as which format-defined deck sections produce runtime-accessible structures or zones;
- zone-definition categories that affect gameplay setup, such as whether ride-deck-origin or G-zone-origin runtime structures exist;
- format-specific runtime behavior markers or toggles that affect gameplay flow;
- references or markers for format-level mechanic families that gameplay must activate, disable, or route through explicit runtime adapters;
- setup-time constraints that materially affect how a valid pre-game deck input becomes gameplay-owned runtime state;
- only the minimum runtime-facing information needed by gameplay setup, action validation, and effect systems to behave consistently for that format.

### Decision 6: Projection May Carry Runtime Branching Markers, but Not Runtime Business Logic

Decision:

- The gameplay-facing format projection may carry format-level runtime markers, toggles, or adapter-selection facts.
- It must not contain runtime execution logic itself.

Rationale:

- Data used to choose runtime behavior is not the same thing as implementing that behavior.

Practical implication:

- The projection may indicate that a format has ride-deck-origin behavior or G-zone-origin behavior.
- It must not embed the actual state-transition or effect-resolution code for those behaviors.

## Excluded Data Categories

### Decision 7: Legality, Coverage, and Presentation Concerns Must Be Excluded by Default

Decision:

- The gameplay-facing format projection must exclude any data category that is primarily about legality, catalog coverage, importer provenance, or UI presentation rather than runtime behavior.

Rationale:

- Those concerns belong to other truth layers and other bounded contexts.

Practical implication:

- Gameplay input remains stable even when legality or UI becomes more detailed.

### Excluded Categories

The projection must not include:

- legality rules;
- restriction-list semantics;
- card-pool definitions;
- validation-target or validation-result data;
- support-state publication as if it were runtime rule meaning;
- UI labels, descriptions, icons, or presentation-oriented metadata;
- importer or source-system data;
- persistence details;
- deck-editor workflow preferences;
- page-level configuration;
- catalog browse concerns;
- social or sharing metadata.

### Decision 8: Projection Must Not Become a Second Format Profile

Decision:

- The gameplay-facing format projection must remain narrower than the canonical `format profile`.

Rationale:

- If it becomes a second all-purpose format object, the architecture will have duplicated format authority.

Practical implication:

- When a proposed field is questioned, the first check is whether it belongs in the canonical profile, in gameplay projection, or nowhere at all.

## Ownership and Publication

### Decision 9: `Rules` Owns the Gameplay-Facing Format Projection

Decision:

- The `rules` bounded context owns the gameplay-facing format projection as its canonical runtime format input contract.

Rationale:

- Runtime interpretation belongs to gameplay truth.
- The projection exists to serve runtime setup and runtime execution, not admissibility or deck storage.

Practical implication:

- `rules` owns how canonical format meaning is narrowed into runtime-facing format input.
- `rules` does not own the canonical `format profile` itself.

### Decision 10: Projection Publication Happens at the Gameplay Boundary, Not in the Rules Engine Core

Decision:

- The gameplay-facing format projection should be published by a gameplay-boundary adapter or projection layer inside `rules`, not assembled ad hoc inside engine internals.

Rationale:

- Engine core should consume ready runtime input, not build boundary projections on demand.

Practical implication:

- Match setup, runtime initialization, and runtime validators should receive a published gameplay-facing format projection as input.
- They should not parse raw `format profile` structures directly.

### Consumers

Primary consumers of the gameplay-facing format projection are:

- gameplay setup and match-room initialization;
- runtime state initialization;
- runtime action-validation systems;
- effect and mechanic routing layers inside `rules`.

External contexts should not depend on this projection by default. Outside gameplay, the canonical shared format contract remains `format profile`.

### Decision 11: This Projection Does Not Change Canonical Shared-Contract Ownership

Decision:

- The gameplay-facing format projection does not replace the published `format profile` as the cross-context shared contract for format meaning.

Rationale:

- The canonical shared contract still belongs to `legality`.
- This projection exists only to keep gameplay runtime input disciplined.

Practical implication:

- `decks`, `web app`, and legality-facing flows should continue to consume `format profile`, not the gameplay projection.

## Relationship to Deck Snapshot

### Decision 12: Deck Snapshot Carries Format Reference; Gameplay Projection Interprets Runtime Meaning of That Format

Decision:

- The deck snapshot continues to carry the attached format reference.
- The gameplay-facing format projection supplies the runtime interpretation of that format for gameplay consumers.

Rationale:

- Deck meaning and runtime format meaning are related but distinct inputs.

Practical implication:

- Gameplay setup should not force deck snapshot to carry runtime format detail.

### Decision 13: Gameplay Setup Depends on Three Inputs

Decision:

- Gameplay setup should be based on:
- deck snapshot;
- gameplay-facing catalog projection;
- gameplay-facing format projection.

Rationale:

- Each input owns a different part of gameplay preparation:
- deck structure and card references;
- gameplay-relevant card facts;
- runtime format meaning.

Practical implication:

- The combination of those contracts is sufficient to produce gameplay-owned runtime structures without importing deck internals, full catalog, or raw format profile into the engine core.

## Relationship to Capability Support

### Decision 14: Capability Support Gates Projection Resolution, but Does Not Become Projection Meaning

Decision:

- Published gameplay capability support must gate whether an authoritative gameplay-facing format projection can be produced for a requested runtime scope.
- Capability support must not be redefined as the projection itself.

Rationale:

- Capability support answers whether the system can behave dependably.
- Projection answers what runtime format facts apply when runtime behavior is available.

Practical implication:

- If gameplay capability is unsupported for a requested format scope, gameplay should not produce an authoritative runtime projection for that scope.
- Unsupported runtime behavior must not appear in projection as if it were active.

### Decision 15: Unsupported Runtime Features Must Be Omitted or Explicitly Non-Active, Never Quietly Enabled

Decision:

- Runtime elements that are outside current published gameplay capability must not appear as active gameplay behavior in the projection.

Rationale:

- Silent activation of unsupported mechanics would invalidate the capability model and break runtime trust.

Practical implication:

- Projection resolution should respect capability publication before gameplay setup begins.
- Runtime engine core should not guess which parts of a format are supported today.

## Relationship to Rules Engine

### Decision 16: Rules Engine Core Receives Projection; It Does Not Build It

Decision:

- The rules engine core must consume gameplay-facing format projection as ready input.
- It must not build that projection for itself from raw `format profile`.

Rationale:

- Boundary projection is part of input assembly, not core runtime logic.

Practical implication:

- Action systems, effect systems, and state-transition systems should depend on the runtime-facing projection contract, not on legality-owned format structures.

### Decision 17: Projection Defines Runtime-Relevant Format Shape, Not Full Runtime State

Decision:

- The gameplay-facing format projection should define the runtime-relevant format shape and format-driven behavior markers.
- It must not be confused with the actual runtime state object.

Rationale:

- Runtime state also depends on players, deck instances, turn flow, actions, and evolving state transitions.

Practical implication:

- Projection is a setup input.
- Game state remains gameplay-owned runtime truth after setup.

## Anti-Patterns

The following practices are explicitly prohibited:

- `rules` imports and consumes raw `format profile` throughout engine code.
- gameplay projection contains legality rules or restriction interpretation.
- gameplay projection duplicates catalog projections or card data.
- UI or page logic decides which runtime mechanics are active.
- different gameplay subsystems interpret the same format key differently.
- gameplay projection becomes a second all-purpose `format profile`.
- canonical format meaning is patched locally inside runtime adapters.
- unsupported gameplay mechanics are treated as active because the canonical profile mentions them at high level.

## Evolution Policy

### Decision 18: New Formats Enter Gameplay Through Canonical Format Profile First, Then Through Gameplay Projection

Decision:

- A new format or format variant must first have canonical meaning in the published `format profile` before gameplay projection for that format is introduced.

Rationale:

- Runtime derivation must start from stable canonical meaning rather than from ad hoc gameplay-first invention.

Practical implication:

- Gameplay must not become the first owner of a new format definition.

### Decision 19: Runtime Projection Should Grow Additively with Supported Mechanics

Decision:

- The gameplay-facing format projection should evolve by adding clearly justified runtime categories or markers as supported gameplay scope expands.

Rationale:

- Gameplay will become deeper over time, but the runtime input boundary should remain understandable and stable.

Practical implication:

- Add new runtime-facing mechanic markers only when gameplay actually needs them.
- Do not front-load speculative runtime detail into the projection.

### Decision 20: If Runtime Needs Contradict Canonical Format Meaning, Fix the Canonical Contract Upstream

Decision:

- If gameplay repeatedly needs to override or reinterpret canonical format meaning, the fix is to revise the canonical format contract or its published markers, not to fork format semantics inside `rules`.

Rationale:

- Architectural drift is best corrected at the canonical boundary, not hidden in downstream projections.

Practical implication:

- Projection is allowed to narrow and adapt.
- It is not allowed to repair upstream meaning silently.

## Examples

### Example 1: Standard Projection Includes Ride-Deck Runtime Meaning

- The canonical Standard profile says the format has a main deck and ride deck baseline.
- The gameplay boundary in `rules` derives a Standard gameplay-facing format projection that marks ride-deck-origin runtime structures as active.
- Gameplay setup uses that projection to initialize the corresponding runtime format behavior.

### Example 2: Premium Projection Includes G-Zone Runtime Meaning

- The canonical Premium profile says the format has main deck plus G deck baseline.
- The gameplay boundary derives a Premium gameplay-facing format projection that enables G-zone-origin runtime structures and relevant runtime format markers.
- The rules engine consumes that projection as runtime configuration input.

### Example 3: Good Runtime Input Assembly

- A gameplay flow receives a Premium deck snapshot with attached format reference.
- It receives gameplay-facing card projection for the canonical card identities in that deck.
- It receives a Premium gameplay-facing format projection from the gameplay boundary.
- Runtime setup builds gameplay-owned state from those inputs.

This is the intended flow.

### Example 4: Bad Direct Raw Format Usage

- A runtime effect system imports the canonical format profile and checks for Premium or Standard directly.
- Another subsystem does something slightly different with the same profile.

This is forbidden. Runtime subsystems should receive gameplay-facing format projection, not invent their own format interpretation paths.

### Example 5: Bad Legality Leakage

- A gameplay-facing format projection includes restriction behavior or legality-oriented construction rules.
- Runtime systems start using it to decide deck admissibility.

This is a boundary violation. Pre-game admissibility belongs to legality truth, not gameplay input.

### Example 6: Bad UI-Owned Runtime Toggle

- A page-level control decides whether a mechanic is active for gameplay because the UI believes that mechanic is not ready yet.

This is forbidden. Runtime activation must come from gameplay-owned projection plus published capability support, not from UI assumption.

## Final Recommendations

- Keep `format profile` as the only canonical cross-context format contract.
- Introduce a gameplay-facing format projection as the runtime-specific derivative used by gameplay systems.
- Make `rules` the owner of this runtime projection, but not of canonical format meaning.
- Build the projection at the gameplay boundary, not inside runtime engine internals.
- Keep the projection minimal and runtime-relevant: zones, section-to-zone meaning, runtime mechanic markers, and setup-relevant format facts only.
- Exclude legality, restriction, card-pool, importer, and presentation concerns.
- Let gameplay setup consume `deck snapshot + gameplay-facing catalog projection + gameplay-facing format projection`.
- Keep capability support separate and let it gate projection resolution instead of leaking unsupported runtime behavior into active gameplay input.
