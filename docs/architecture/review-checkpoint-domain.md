# Domain Review Checkpoint

Status: Domain phase checkpoint  
Last updated: 2026-04-07

## 1. Executive Summary

The domain phase is materially successful.

The current model is strong enough to support:

- deck-builder implementation;
- legality-validation implementation;
- gameplay-engine foundation work at the abstraction and setup layer.

The model is not yet strong enough for unconstrained gameplay implementation across all Vanguard complexity without additional clarification work.

The main conclusion is:

- Standard is well covered.
- V Premium is adequately covered at baseline.
- Premium is covered structurally, but remains the weakest and highest-risk format because G-deck qualification and cross-era runtime complexity are still underspecified.

There are no fatal domain contradictions in the core model itself. The main immediate problems are:

- stale contract documents that no longer match the current contract system;
- Premium-specific detail gaps;
- gameplay-runtime detail gaps beyond the current abstraction baseline.

## 2. Format Coverage

### Standard

Assessment:

- covered well enough for deck builder and legality;
- covered at gameplay-setup level, not at full rules depth.

What is solid:

- ride deck exists as an explicit format and deck-construction concept;
- trigger rules are explicit in construction baseline;
- Standard uses a structured profile rather than enum branching;
- product eligibility is modeled through profile + lineage rather than UI assumptions.

What is still weak:

- the exact official override set for D-era eligibility is still conceptual rather than concretely published as profile data.

Verdict:

- Standard domain coverage is acceptable for implementation start.

### V Premium

Assessment:

- covered adequately for deck builder and legality baseline.

What is solid:

- no ride deck;
- no G deck;
- clan-based construction baseline;
- V-lineage-driven eligibility baseline;
- duplicate and trigger rules remain profile-owned.

What is still weak:

- official edge-case allowances and lineage interpretation are still modeled conceptually, not operationally;
- V-era special interactions are not a gameplay-engine blocker yet, but they are not formally decomposed past the current format-capability layer.

Verdict:

- V Premium is sufficiently modeled for deck builder and legality start.

### Premium

Assessment:

- covered at structure and boundary level;
- not yet fully decomposed for authoritative gameplay or full legality edge-case confidence.

What is solid:

- G deck exists as a separate section;
- broad product eligibility is recognized;
- canonical card identity remains stable across cross-era content;
- gameplay format projection can represent G-zone-origin runtime behavior.

What is weak:

- G-deck qualification is explicitly underspecified;
- cross-era interaction depth is acknowledged but not yet translated into sharper runtime and catalog-side qualification contracts;
- Premium remains the most likely place for hidden edge cases in both legality and gameplay.

Verdict:

- Premium is structurally covered, but not fully de-risked.

## 3. Deck Model Validation

Assessment:

- the deck model is strong and implementation-ready for first deck-builder work.

What is solid:

- `Deck`, `DeckVersion`, and `DeckSnapshot` are clearly separated;
- sections are explicit: `main`, `ride`, `g`;
- section boundaries are first-class, not UI conventions;
- duplicate counting uses canonical `CardId`;
- trigger counting uses canonical `CardId`;
- construction rules are attached to `FormatProfile`, not hidden in `decks`.

Strengths:

- the model prevents printing-based duplicate bypass;
- it supports Standard, V Premium, and Premium without collapsing into one generic card list;
- legality has a clean structure baseline to validate against.

Weak points:

- Premium G-deck qualification is still too abstract;
- ride-deck construction is adequately modeled at baseline, but deeper qualification constraints remain profile-instance work, not yet concrete publications.

Verdict:

- deck model is ready for implementation.

## 4. Legality Model Validation

Assessment:

- the legality model is strong enough for first legality implementation.

What is solid:

- legality is clearly separated from gameplay;
- input is `DeckSnapshot + FormatProfile + ValidationContext`;
- staged validation is explicit;
- restriction lists are first-class;
- banned, limited, semi-limited, and maximum-copies are explicit;
- choice restrictions are modeled as a separate rule family;
- result statuses distinguish `invalid`, `unsupported`, and `partially_supported`.

Strengths:

- canonical `CardId` is the legality target, not printing;
- deck-structure validation is properly separated from restriction validation;
- support-state awareness is built into the result model.

Weak points:

- choice restrictions are modeled correctly, but still need sharper implementation guidance if real grouped or more complex official restriction semantics appear;
- Premium-specific legality edge cases still depend on missing G-deck and cross-era qualification detail;
- partial-support semantics are architecturally sound but require disciplined implementation to avoid hiding known invalid states.

Verdict:

- legality model is ready for initial implementation, but Premium remains the stress case.

## 5. Card Model Validation

Assessment:

- the card model is one of the strongest parts of the domain phase.

What is solid:

- `Card` and `CardPrinting` are clearly separated;
- canonical gameplay identity is preserved;
- printing identity remains catalog-only by default;
- decks, legality, and gameplay all depend on canonical `CardId`;
- importer normalization has a clear target model.

Strengths:

- release metadata is prevented from leaking into gameplay identity;
- product taxonomy integrates correctly with printing ownership;
- reprints, promos, and alt arts are handled without collapsing gameplay identity.

Weak points:

- errata remains a review-heavy boundary and will require importer discipline;
- future collection or display features may pressure the model toward preferred-printing leakage if not controlled.

Verdict:

- card model is solid and fit for implementation.

## 6. Gameplay Model Validation

Assessment:

- gameplay abstraction is strong enough to begin engine-foundation work;
- it is not yet a complete gameplay semantics model.

What is solid:

- `GameState` is clearly identified as gameplay truth;
- `CardInstance` is separate from catalog cards;
- runtime zones are explicit;
- actions represent intent;
- events represent facts;
- `action -> event -> state` flow is explicit;
- effect resolution is registry-based rather than `cardId` branching;
- catalog and format enter only through gameplay-facing projections.

Strengths:

- the model is cleanly event-driven;
- it rejects direct UI-owned runtime behavior;
- it prevents gameplay from depending on raw catalog or legality internals.

Weak points:

- runtime topology is still coarse;
- circle-level structure, timing windows, replacement effects, and priority semantics are not yet formalized;
- this is enough for engine scaffolding, but not enough for confident full mechanic implementation.

Verdict:

- gameplay model is ready for engine foundation, not for full mechanic-scale implementation.

## 7. Boundary Validation

Assessment:

- core truth boundaries are holding.

What is solid:

- catalog truth remains separate from legality truth;
- legality truth remains separate from gameplay truth;
- gameplay consumes projections rather than internals;
- deck snapshots remain the cross-context deck input boundary;
- printing identity is kept out of ordinary legality and gameplay semantics.

No direct boundary collapse was found in the core domain models.

Main boundary risk:

- stale architecture documents can still reintroduce confusion even though the newer domain models are correct.

## 8. Contract Consistency

Assessment:

- core contracts are mostly aligned;
- document drift is now the main consistency problem.

### Consistent Areas

- format profile remains profile-based and canonical;
- deck snapshot remains sectioned and format-bound;
- legality request remains separate from deck snapshot;
- gameplay setup still depends on snapshot + gameplay catalog projection + gameplay format projection;
- card identity stays canonical across decks, legality, and gameplay.

### Contradictions and Stale Areas

#### Issue 1: Shared Contract Inventory Is Outdated

`docs/architecture/shared-contract-surface.md` still presents an older, narrower contract inventory.

Impact:

- it underrepresents the current boundary model;
- it can mislead package implementations about which contracts are legitimately shared.

#### Issue 2: Old Legality Result Language Still Exists in Deck Snapshot Contract

`docs/architecture/deck-format-attachment-and-snapshot.md` still uses older legality outcome wording such as `illegal` and `no_assertion` in examples.

Impact:

- it conflicts with the current legality model, which uses `invalid`, `unsupported`, and `partially_supported`.

#### Issue 3: Shared Contract Result Wording Is Older Than Current Legality Model

`docs/architecture/shared-contract-surface.md` still describes legality-result fields in older conceptual language.

Impact:

- it creates ambiguity about the current published legality-result contract semantics.

Verdict:

- the model is mostly consistent, but contract documents need a sync pass.

## 9. Risk Register

### High Risk

#### 1. Premium G-Deck Qualification Is Still Underspecified

Why it matters:

- Premium legality and gameplay both depend on knowing which cards qualify for G-deck treatment.

Impact:

- legality could become inconsistent;
- gameplay setup could infer the wrong runtime structures;
- Premium support could fork into local heuristics.

#### 2. Gameplay Runtime Semantics Are Still Too Coarse for Full Engine Work

Why it matters:

- current abstractions cover state, actions, events, and handlers, but not deeper timing/replacement/priority semantics.

Impact:

- engine work can start, but not all mechanic families can be implemented safely yet.

#### 3. Stale Contract Documents Can Reintroduce Wrong Implementations

Why it matters:

- developers may follow old contract language instead of newer domain and architecture decisions.

Impact:

- boundary drift;
- incorrect legality-result handling;
- wrong import surfaces.

### Medium Risk

#### 1. Product-Family Eligibility Mapping Is Still Conceptual

Why it matters:

- Standard, V Premium, and Premium depend on lineage and official allowances.

Impact:

- importer and legality will need sharper profile-instance data soon.

#### 2. Choice Restrictions May Need Richer Group Semantics

Why it matters:

- the current model is correct for baseline choice restrictions, but complex official future cases may need richer grouping.

Impact:

- legality implementation may need an additive refinement.

#### 3. Errata Normalization Remains Review-Heavy

Why it matters:

- wrong canonical-card grouping would poison importer, legality, and gameplay simultaneously.

Impact:

- importer review policy remains critical.

### Low Risk

#### 1. Custom Format Evolution

Why it matters:

- the model supports it conceptually, but governance is still discipline-based.

Impact:

- low immediate risk, higher future governance risk.

#### 2. Social vs Future Dedicated Match Context

Why it matters:

- current match ownership is acceptable, but may want refinement later as match product features deepen.

Impact:

- low immediate risk.

## 10. Missing Pieces

The following pieces are still missing or insufficiently sharp for the next stages:

- canonical published profile instances for Standard, V Premium, and Premium as actual implementation-ready profile data;
- a sharper Premium G-deck qualification contract;
- a gameplay-runtime topology and timing note covering circles, priority, replacement semantics, and deeper resolution order;
- a documentation sync pass for stale architecture contracts;
- more explicit profile-instance treatment of official lineage overrides for format eligibility.

## 11. Next Steps

Recommended next steps:

1. Synchronize stale architecture documents with the current legality and shared-contract model.
2. Publish concrete Standard, V Premium, and Premium profile instances from the current abstract format model.
3. Define Premium G-deck qualification more sharply before serious Premium legality or gameplay work.
4. Add a deeper gameplay runtime topology and timing document before implementing non-trivial mechanics.
5. Start deck-builder and legality implementation on Standard and V Premium first, keeping Premium behind the clarified model work.

## 12. Final Verdict

Verdict:

- GO WITH CONDITIONS

Reason:

- The domain model is strong enough for deck builder and legality implementation, and strong enough for gameplay-engine foundation work.
- It is not yet fully de-risked for Premium-heavy legality or for full gameplay-engine implementation across complex mechanics.
- The remaining problems are real, but they are concentrated and actionable rather than systemic.
