# Architecture Review Checkpoint 04

Status: Final pre-implementation gate review  
Last updated: 2026-04-07

## Executive Summary

The architecture is now strong enough to begin real implementation of:

- monorepo setup;
- catalog and importer foundations;
- first domain modules;
- deck and legality foundations;
- a thin API layer that follows domain contracts rather than inventing new semantics.

The current verdict is:

- `GO WITH CONDITIONS`

That verdict is not caused by domain-model collapse. The major contract gaps identified in checkpoint-03 are now closed:

- capability-support publication exists;
- legality validation request exists;
- gameplay-facing format projection exists;
- importer-to-catalog workflow exists;
- initial persistence rules exist.

The remaining issues are smaller but real:

1. one core contract inventory document is now out of date relative to the newer contract set;
2. two older wording points can still mislead implementers about gameplay format input and legality input boundaries;
3. monorepo package/export strategy is not yet formalized, so careless package wiring could still bypass the documented contracts.

These are implementation-shaping risks, not architecture-collapse risks. They should be fixed immediately as part of implementation kickoff, not deferred indefinitely.

## Contract System Completeness

### Finding 1: The core contract system is now complete enough for the current implementation scope

Issue:

- The architecture now has explicit contracts for:
- card identity;
- format profile;
- deck snapshot;
- legality result direction;
- legality validation request;
- gameplay-facing catalog projection;
- gameplay-facing format projection;
- capability support.

Why it matters:

- These were the critical missing contracts that previously made implementation unsafe.

Risk level:

- LOW

Recommendation:

- Treat this as the minimum mandatory contract set for initial monorepo and backend work.

### Finding 2: No current blocker-level contract is still missing for catalog, importer, decks, legality, or thin API work

Issue:

- There is no remaining missing contract that blocks catalog/importer, deck snapshot publication, legality invocation, or package-boundary planning.

Why it matters:

- The project can now move from architecture definition into module implementation without inventing first-order domain contracts during coding.

Risk level:

- LOW

Recommendation:

- Begin implementation against the published contracts rather than creating new local substitutes.

### Finding 3: The contract inventory is not fully synchronized across documents

Issue:

- `shared-contract-surface.md` still lists only the original five core shared contracts and does not reflect the later addition of:
- legality validation request;
- capability-support publication;
- the runtime-facing format projection model as a governed downstream contract.

Why it matters:

- Package planning or export-boundary decisions could follow the older inventory and accidentally omit newly required published surfaces.

Risk level:

- MEDIUM

Recommendation:

- Update the shared-contract inventory before finalizing package exports.

## Ownership Analysis

### Finding 4: Contract ownership is now clear at the architecture level

Issue:

- Ownership is now singular and coherent for the key contracts:
- `catalog` owns card identity and gameplay-facing catalog projection;
- `legality` owns format profile, legality result semantics, legality validation request semantics, and legality capability support;
- `decks` owns deck versions and deck snapshots;
- `rules` owns gameplay-facing format projection and gameplay capability support;
- `importer` owns ingestion workflow, normalization workflow, provenance, and review state.

Why it matters:

- Single ownership is the core defense against contract drift.

Risk level:

- LOW

Recommendation:

- Use these ownership assignments as the default package-authority model.

### Finding 5: The earlier legality ownership conflict is resolved

Issue:

- The contradiction that previously let `decks` appear to own legality semantics has been removed from `engineering principles` and aligned with the legality-boundary documents.

Why it matters:

- This was one of the highest-risk early ownership errors.

Risk level:

- LOW

Recommendation:

- Preserve this boundary in package naming, exports, and code review.

### Finding 6: A small amount of ownership-adjacent wording drift still exists

Issue:

- A few older documents still use broader wording that predates the newer boundary contracts:
- `truth-boundaries.md` still says a future rules engine should consume `format profile` directly;
- `deck-format-attachment-and-snapshot.md` still says deck snapshot is the input contract for legality without acknowledging the later legality validation-request boundary.

Why it matters:

- These are not ownership reversals, but they can mislead implementers into skipping the newer boundary layers.

Risk level:

- MEDIUM

Recommendation:

- Synchronize those older statements with the newer format-projection and validation-request documents.

## Boundary Integrity

### Finding 7: The three truth layers remain intact

Issue:

- `catalog truth`, `legality truth`, and `gameplay truth` are now clearly separated and reinforced by later contract documents.

Why it matters:

- This is the foundation that prevents catalog, legality, and gameplay from collapsing into one oversized model.

Risk level:

- LOW

Recommendation:

- Continue using truth-layer language in package and code review decisions.

### Finding 8: Importer-to-catalog leakage is now controlled

Issue:

- The ingestion workflow note now gives a clear staged handoff from importer-owned normalization into catalog-owned published content.

Why it matters:

- This closes one of the main early data-corruption risks.

Risk level:

- LOW

Recommendation:

- Do not allow catalog persistence or catalog repositories to read importer workflow state directly.

### Finding 9: Boundary risk now comes mostly from sloppy implementation, not missing architecture

Issue:

- The remaining boundary risk is practical:
- `rules` importing full catalog internals instead of published projections;
- `web app` reintroducing domain semantics in pages;
- `decks` storing foreign meaning rather than references and snapshots;
- package boundaries exposing internals by convenience.

Why it matters:

- The documentation is now strong enough that most future mistakes would be implementation violations, not missing architecture.

Risk level:

- MEDIUM

Recommendation:

- Treat boundary enforcement as a package and review discipline problem from day one.

## End-to-End Data Flow

### Finding 10: The end-to-end pipeline is now coherent

Issue:

- The intended flow is now structurally clear:
- `importer` acquires and parses source data;
- `importer` normalizes and resolves identity;
- publication-ready normalized content crosses into `catalog`;
- `catalog` publishes canonical content and projections;
- `decks` stores format-bound deck versions and publishes deck snapshots;
- `legality` receives validation requests built on those snapshots and returns support-aware legality results;
- future gameplay setup consumes deck snapshot plus gameplay-facing card and format projections.

Why it matters:

- This is the first point in the project where the entire upstream-to-downstream pipeline is implementable without obvious hidden shortcuts.

Risk level:

- LOW

Recommendation:

- Use this flow as the default architecture story for initial package wiring and service boundaries.

### Finding 11: There is no obvious unavoidable shortcut in the current pipeline

Issue:

- No stage now requires:
- `catalog` to read raw importer records;
- `legality` to read deck persistence internals;
- `rules` to read full catalog entities;
- `web app` to invent format or legality semantics.

Why it matters:

- This means the architecture is not forcing a bad implementation path.

Risk level:

- LOW

Recommendation:

- Any implementation that takes one of those shortcuts should be treated as a boundary violation, not as a necessary compromise.

### Finding 12: One future gameplay pipeline contract is still missing

Issue:

- Match-entry and runtime-setup contracts are still not defined explicitly.

Why it matters:

- This is not a blocker for current implementation, but it will become the next missing contract once gameplay work moves beyond stubs.

Risk level:

- LOW

Recommendation:

- Do not start substantive gameplay execution work until a match-entry or runtime-setup contract exists.

## Persistence Sanity

### Finding 13: Persistence policy is now aligned with the architectural contracts

Issue:

- The new persistence note correctly separates:
- canonical data;
- derived data;
- transient data.

Why it matters:

- This prevents storage convenience from rewriting architectural meaning.

Risk level:

- LOW

Recommendation:

- Use canonical vs derived vs transient classification explicitly in repository and storage design.

### Finding 14: Snapshot and projection persistence are now handled correctly at policy level

Issue:

- The architecture now states that:
- snapshots may be persisted, but as immutable boundary artifacts;
- projections may be cached or materialized, but remain derived;
- legality results may be stored only as contextual, recomputable derived artifacts.

Why it matters:

- These are exactly the persistence mistakes that usually create months of debt later.

Risk level:

- LOW

Recommendation:

- Reject any early storage design that turns snapshots or projections into primary truth.

## Monorepo Readiness

### Finding 15: The architecture is ready for monorepo and package decomposition

Issue:

- The project can now be decomposed coherently into at least:
- `catalog`
- `importer`
- `decks`
- `legality`
- `rules` as a stub or boundary package
- shared contract surfaces
- `web app`

Why it matters:

- The context map, shared contracts, and ownership model are finally strong enough to support clean package boundaries.

Risk level:

- LOW

Recommendation:

- Proceed with monorepo setup, but derive exports from the contract system rather than from convenience imports.

### Finding 16: Package strategy is the main remaining implementation governance gap

Issue:

- The architecture says what the packages should mean, but not yet exactly how package exports and dependency directions should be enforced in code.

Why it matters:

- This is now the main risk of accidental architectural drift during implementation.

Risk level:

- MEDIUM

Recommendation:

- Write the package/export strategy immediately before or alongside the first package scaffolding.

## Catalog/Importer Readiness

### Finding 17: Catalog and importer work can start now

Issue:

- Card identity, normalization policy, ingestion workflow, publication flow, and initial persistence decisions are now sufficient for real catalog/importer implementation.

Why it matters:

- This was explicitly not true at checkpoint-03.

Risk level:

- LOW

Recommendation:

- Start with importer normalization foundations, catalog canonical models, and controlled publication flow.

### Finding 18: The main catalog/importer risk is operational discipline, not missing architecture

Issue:

- The remaining risk is that implementation may bypass the workflow and write importer-shaped data into catalog-owned storage because it is faster.

Why it matters:

- That shortcut would undermine the strongest newly-added boundary.

Risk level:

- MEDIUM

Recommendation:

- Make importer-to-catalog publication an explicit integration point from the first implementation, not a later cleanup step.

## Deck + Legality Readiness

### Finding 19: Deck and legality integration is now architecturally ready

Issue:

- The deck-side and legality-side boundaries are now complete enough:
- format-bound deck versions are defined;
- deck snapshot is defined;
- legality validation request is defined;
- legality result semantics are defined;
- capability support and partial evaluation semantics are defined.

Why it matters:

- `legality` can now be implemented as an isolated service or module without depending on deck persistence internals or UI state.

Risk level:

- LOW

Recommendation:

- Start deck-builder and legality integration through deck snapshot plus legality validation request only.

### Finding 20: Validation-target proliferation is a future risk, not a current blocker

Issue:

- The validation-request contract allows owner-defined targets and scopes.
- If implementation introduces too many targets too early, it could create avoidable complexity.

Why it matters:

- The contract is correct, but early overuse would still be a design error.

Risk level:

- LOW

Recommendation:

- Start with the canonical default target and add others only when a real product flow requires them.

## Gameplay Future Readiness

### Finding 21: The architecture is future-safe for gameplay without forcing gameplay now

Issue:

- The project now has both required gameplay input bridges:
- gameplay-facing catalog projection;
- gameplay-facing format projection.

Why it matters:

- This means future gameplay can be added without making `rules` depend directly on full catalog or raw format profile internals.

Risk level:

- LOW

Recommendation:

- Keep gameplay implementation dormant or stubbed until match-entry/runtime-setup boundary work begins.

### Finding 22: Current gameplay readiness is boundary-ready, not implementation-ready

Issue:

- The architecture is ready for gameplay boundary preparation, not for full gameplay execution design.

Why it matters:

- This is the correct maturity level for the current product phase.

Risk level:

- LOW

Recommendation:

- Do not confuse future-safe architecture with a green light to build the rules engine immediately.

## Risk Register

### Critical

- None.

### Medium

- `shared-contract-surface.md` is now partially stale relative to the newer contract set and may mislead package-export decisions.
- `truth-boundaries.md` and `deck-format-attachment-and-snapshot.md` still contain older wording that can be misread after the newer gameplay-format and legality-request contracts.
- Package/export governance is not yet formalized, so internal-model imports could still bypass the documented contract system during early monorepo work.
- Catalog/importer implementation can still go wrong if the team bypasses publication-ready handoff and writes importer-shaped data directly into catalog-owned storage.

### Low

- Match-entry/runtime-setup contract is still missing for future gameplay work.
- Capability publication may need operational refinement once package and API boundaries become concrete.
- Validation-target or support-capability granularity could become too fine if the team adds variants prematurely.

## Required Final Fixes

1. Update `shared-contract-surface.md` so its core contract inventory matches the current architecture.
2. Align the older wording in `truth-boundaries.md` and `deck-format-attachment-and-snapshot.md` with the newer gameplay-format and legality-request contracts.
3. Write the initial monorepo package/export strategy before broad parallel implementation begins.

## Final Verdict

- `GO WITH CONDITIONS`

Explanation:

- The architecture is now safe to begin real implementation for monorepo, catalog/importer, first domain modules, deck foundations, legality foundations, and a thin API layer.
- There are no remaining blocker-level contract gaps or ownership contradictions.
- The remaining issues are documentation-sync and package-governance risks. They are serious enough to require immediate cleanup, but not serious enough to block implementation entirely.

Implementation may start now, but it should start with discipline:

- package boundaries must reflect the published contracts;
- importer-to-catalog handoff must be explicit from day one;
- legality must consume validation requests built on deck snapshots, not raw deck storage or UI state;
- gameplay should remain boundary-only until later runtime contracts are defined.
