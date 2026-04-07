# Architecture Review Checkpoint 03

Status: Pre-implementation gate review  
Last updated: 2026-04-07

## Executive Summary

The architecture is materially stronger than it was at checkpoint-02. The major cross-context contracts that were previously missing are now defined:

- card identity;
- format profile ownership and publication;
- deck snapshot;
- legality result;
- gameplay-facing catalog projection.

The system is now coherent enough to start monorepo setup, core package boundaries, catalog foundations, and early deck-domain work.

It is not ready for unconstrained implementation across all areas.

The current verdict is:

- `GO WITH CONDITIONS`

The main reasons it is not a clean `GO` are:

1. one ownership contradiction still exists across documents;
2. capability-support publication is still underdefined;
3. importer-to-catalog workflow and initial data-model decisions are still missing for real ingestion work;
4. legality request wiring is conceptually defined, but not yet formalized as a published request contract.

These are not domain-collapse risks. They are implementation-shaping risks. If ignored, they will turn into package-boundary debt immediately.

## Contract Completeness

### Finding 1: The five critical contracts now exist

Issue:

- The architecture now defines the five contracts that checkpoint-02 identified as essential:
- card identity contract;
- format profile contract;
- deck snapshot contract;
- legality result contract;
- gameplay-facing catalog projection.

Why it matters:

- This closes the largest contract gaps that previously made implementation unsafe.

Risk level:

- LOW

Recommendation:

- Treat these as the minimum mandatory contract set for initial module work.

### Finding 2: Contract overlap exists, but it is mostly intentional and acceptable

Issue:

- Some overlap remains across contracts:
- deck snapshot carries a format reference while format profile defines the format meaning;
- gameplay-facing projection carries canonical card identity while card identity is also its own shared contract;
- legality result includes validation-context summary while deck snapshot remains input-only.

Why it matters:

- Overlap is only dangerous when it creates competing meaning.
- In the current documents, the overlaps are structural and appear intentional rather than contradictory.

Risk level:

- LOW

Recommendation:

- Keep these overlaps as-is unless implementation pressure reveals semantic duplication.

### Finding 3: A few companion contracts are still missing

Issue:

- The following contracts are still not formally published:
- legality validation-request contract;
- capability-support publication contract;
- gameplay-facing format projection for runtime adapters;
- match-entry or gameplay-setup contract.

Why it matters:

- These are the next contracts likely to be improvised during implementation if not fixed deliberately.

Risk level:

- MEDIUM

Recommendation:

- Define them before deep legality integration or any real gameplay work begins.

## Ownership Analysis

### Finding 4: Ownership is mostly clear for the core shared contracts

Issue:

- Core ownership now appears explicit:
- card identity contract -> `catalog`
- format profile contract -> `legality`
- deck snapshot contract -> `decks`
- legality result contract -> `legality`
- gameplay-facing catalog projection -> `catalog`

Why it matters:

- This is the strongest ownership picture the project has had so far.

Risk level:

- LOW

Recommendation:

- Use these owners as the default package and module authority model in monorepo planning.

### Finding 5: One document-level ownership conflict still remains

Issue:

- `docs/engineering/principles.md` still says deck modules should own "validation targets, and legality results."
- Newer documents clearly assign legality-result semantics and publication to `legality`, while `decks` only owns deck snapshots or stored attachments of legality output.

Why it matters:

- This is a real contradiction, not wording noise.
- If implementation starts from the principles doc alone, the wrong package boundary may be created immediately.

Risk level:

- CRITICAL

Recommendation:

- Resolve the contradiction before package implementation begins.
- The intended direction is already clear in later docs:
- `decks` owns deck versions and deck snapshots;
- `legality` owns legality result meaning and publication.

### Finding 6: Capability-support ownership is still not settled enough

Issue:

- The format-profile ownership note correctly separates canonical format meaning from capability-support metadata.
- It still leaves open exactly how capability-support metadata is published and who operationally owns that publication surface.

Why it matters:

- Deck builder, legality messaging, and UI capability states will drift if this remains implicit.

Risk level:

- MEDIUM

Recommendation:

- Define one canonical publication model for capability support before full deck-builder + legality integration begins.

## Boundary Integrity

### Finding 7: Truth boundaries are holding

Issue:

- The architecture now clearly separates:
- catalog truth;
- legality truth;
- gameplay truth.

Why it matters:

- This was one of the biggest structural risks earlier in the project.

Risk level:

- LOW

Recommendation:

- Keep using truth-layer language in future module and package decisions.

### Finding 8: The biggest remaining boundary risk is not conceptual, but practical

Issue:

- The documents now forbid most boundary leaks explicitly.
- The main residual risk is implementation convenience:
- `rules` reaching for full catalog data;
- `web app` reintroducing format or legality logic;
- `decks` attaching too much meaning to legality outputs.

Why it matters:

- These are the exact shortcuts likely to appear under delivery pressure.

Risk level:

- MEDIUM

Recommendation:

- Treat these as review checklist items during the first implementation wave.

## Dependency Direction Analysis

### Finding 9: The dependency map is sane and remains consistent with new contracts

Issue:

- The bounded-context dependency directions still hold after the new documents:
- `importer -> catalog`
- `decks -> catalog`
- `decks -> legality`
- `legality -> catalog`
- `rules -> catalog`
- `web app -> domain contexts as composition only`

Why it matters:

- New contracts did not introduce new cycles.

Risk level:

- LOW

Recommendation:

- Preserve this as the default dependency policy for package setup.

### Finding 10: `rules -> catalog` is safe only if interpreted narrowly

Issue:

- The architecture does allow `rules -> catalog`, but only through catalog-published gameplay-facing projection and card identity contracts.
- If implementers read this as permission to import full catalog entities, the boundary is broken.

Why it matters:

- This is the most likely misread once gameplay work starts.

Risk level:

- MEDIUM

Recommendation:

- In package design and code review, interpret `rules -> catalog` strictly as:
- `rules -> catalog published gameplay projection`
- not:
- `rules -> catalog internals`

### Finding 11: `legality -> decks` remains a latent risk if snapshot boundaries are ignored

Issue:

- Conceptually, `legality` consumes a published deck snapshot.
- If the snapshot type is implemented inside deck persistence internals instead of the published contract surface, an implicit `legality -> decks internals` dependency will reappear.

Why it matters:

- This would recreate the circular pressure checkpoint-02 explicitly warned about.

Risk level:

- MEDIUM

Recommendation:

- Keep the deck snapshot contract physically and conceptually separate from deck storage internals during implementation.

## Deck / Format / Legality Alignment

### Finding 12: Deck-to-format attachment is now strong enough for initial implementation

Issue:

- Persisted deck versions are now explicitly format-bound.
- Formatless states are restricted to draft or import staging.
- Format switching defaults to variant or branch creation rather than silent mutation.

Why it matters:

- This closes one of the most important semantic gaps from checkpoint-02.

Risk level:

- LOW

Recommendation:

- Use this as the default model for deck builder foundation and deck storage design.

### Finding 13: Deck snapshot is sufficient for legality input at policy level

Issue:

- The deck snapshot contract now defines:
- format reference;
- explicit deck sections;
- canonical card references;
- counts;
- exclusion of UI and persistence noise.

Why it matters:

- This is enough to support legality evaluation without leaking UI state or deck persistence models.

Risk level:

- LOW

Recommendation:

- Use deck snapshot as the only cross-context input into legality.

### Finding 14: One legality-facing contract is still missing

Issue:

- The deck snapshot is defined.
- The legality result is defined.
- The legality validation context is conceptually defined.
- The published validation-request contract between `decks` and `legality` is still not explicit.

Why it matters:

- Without it, each caller may assemble legality inputs slightly differently.

Risk level:

- MEDIUM

Recommendation:

- Define a narrow validation-request contract before full legality integration starts.

## Catalog -> Gameplay Bridge

### Finding 15: The gameplay-facing catalog projection closes the biggest gameplay-coupling risk

Issue:

- `rules` now has a defined, owner-published, minimal projection instead of relying on full catalog entities.

Why it matters:

- This was the main unresolved gameplay-facing contract from checkpoint-02.

Risk level:

- LOW

Recommendation:

- Make this projection mandatory for any gameplay foundation work.

### Finding 16: The projection is intentionally minimal, but one companion contract is still missing

Issue:

- The gameplay-facing catalog projection is now defined.
- The gameplay-facing projection of `format profile` is still only implied.

Why it matters:

- Runtime adapter selection and gameplay setup will likely need a narrower gameplay-format input than the full published format profile.

Risk level:

- MEDIUM

Recommendation:

- Define a gameplay-facing format projection before rules-engine implementation begins.

### Finding 17: Projection size is acceptable and not obviously overloaded

Issue:

- The gameplay-facing projection includes gameplay-relevant identity, classification, stats, keywords, and effect-definition data.
- It excludes printing, provenance, search, UI, and legality fields.

Why it matters:

- This is the correct boundary shape.

Risk level:

- LOW

Recommendation:

- Keep the burden of proof on any new field proposed for the projection.

## Readiness for Implementation

### Monorepo Setup

Assessment:

- READY

Why:

- Bounded contexts, dependency directions, and the minimum shared-contract surface are now defined well enough to guide package boundaries.

Conditions:

- Fix the ownership contradiction in `engineering principles` before turning package boundaries into code.

### Basic Package Structure

Assessment:

- READY

Why:

- Owners, consumers, and forbidden directions are sufficiently explicit.

Conditions:

- Do not create a giant shared-core package.
- Keep published contracts narrow from the start.

### Catalog + Importer Foundation

Assessment:

- GO WITH CONDITIONS

Why:

- Card identity and normalization policy are strong enough to begin.
- Importer isolation is conceptually strong.

Blocking conditions before deeper implementation:

- define ingestion workflow and publication boundaries in more operational detail;
- define initial data-model or persistence decisions consistent with identity and normalization policy.

### First Domain Modules

Assessment:

- GO WITH CONDITIONS

Why:

- Core contracts are now sufficient for:
- catalog domain foundations;
- deck domain foundations;
- legality domain foundations at the contract level.

Blocking conditions before deeper cross-context integration:

- resolve the legality-ownership contradiction in `engineering principles`;
- define capability-support publication;
- define legality validation-request contract.

### Deck Builder Foundation

Assessment:

- GO WITH CONDITIONS

Why:

- Deck-format attachment and deck snapshot policy are now clear enough for format-bound deck editing foundations.

Conditions:

- Do not finalize legality UX or support-state messaging until capability-support publication is defined.
- Do not let builder helpers become local owners of format semantics.

### Gameplay or Rules Foundation

Assessment:

- NOT READY FOR FULL IMPLEMENTATION

Why:

- The gameplay-facing catalog projection exists, which is good.
- But gameplay-facing format projection, match-entry contract, and runtime setup contract are still missing.

Conditions:

- Gameplay work can proceed only as boundary preparation, not as full runtime implementation.

## Risk Register

### CRITICAL

- Ownership contradiction in `engineering principles` versus newer architecture contracts regarding legality results and validation targets.

### MEDIUM

- Capability-support publication and ownership model is still underdefined.
- Validation-request contract for `decks -> legality` is still missing.
- Gameplay-facing format projection is still missing.
- Importer-to-catalog operational workflow is still under-specified for real ingestion implementation.
- `rules -> catalog` can still be misread as direct dependency on catalog internals if package boundaries are sloppy.
- `legality -> decks` can still reappear indirectly if deck snapshot is implemented inside deck persistence internals.

### LOW

- Contract overlap between identity, snapshot, and projection surfaces appears intentional and manageable.
- Truth boundaries are now well documented and internally consistent.
- Deck-to-format attachment model is now strong enough for initial deck-domain work.

## Required Next Decisions

1. Fix the ownership contradiction in `docs/engineering/principles.md` so it matches the newer contract set.
2. Define the capability-support publication model and owner-facing responsibility.
3. Define the legality validation-request contract.
4. Define the gameplay-facing format projection used by future runtime adapters.
5. Define the ingestion workflow and publication path from importer into catalog.
6. Define initial persistence and data-model decisions for catalog identity, printings, deck versions, and deck snapshots.
7. Translate the bounded-context map plus shared contracts into an initial monorepo package strategy.

## Final Verdict

Verdict:

- GO WITH CONDITIONS

Why:

- The architecture is now strong enough to begin real development of:
- monorepo setup;
- base package structure;
- catalog foundations;
- importer foundations;
- deck-domain foundations.

- It is not strong enough yet for unconstrained cross-context implementation.
- If the remaining contract and ownership gaps are ignored, the system will accumulate debt at package-boundary level almost immediately.

Most important conclusions:

1. The core cross-context contracts are now present and mostly coherent.
2. Ownership is mostly clear, but one document-level contradiction still must be fixed.
3. Deck-format attachment is no longer a blocker.
4. Catalog-to-gameplay coupling is now substantially reduced.
5. Capability-support publication remains the biggest unresolved cross-context contract.
6. Ingestion workflow and initial persistence decisions are now the next real blockers for productive implementation.
