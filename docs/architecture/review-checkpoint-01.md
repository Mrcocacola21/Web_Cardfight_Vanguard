# Architecture Review Checkpoint 01

Status: Initial architecture review  
Last updated: 2026-04-07

## Purpose of This Review

This review checks whether the currently documented direction is internally consistent across product vision, v1 scope, domain terminology, and engineering principles.

The goal is not to approve the project by default. The goal is to identify:

- where the model is already coherent;
- where ambiguity is still acceptable;
- where architectural traps are forming;
- what must be clarified before implementation hardens the wrong assumptions.

This review is intentionally focused on structural consistency, not implementation detail. It does not propose final schemas, final package trees, or a full rules-engine design.

## Inputs Reviewed

The following documents were reviewed together:

- `docs/product/vision.md`
- `docs/product/scope-v1.md`
- `docs/product/domain-glossary.md`
- `docs/engineering/principles.md`

These documents establish the current project model across product direction, v1 boundaries, domain vocabulary, and engineering constraints.

## Executive Summary

The current direction is viable. There are no critical contradictions that make the project structurally unsound at this stage.

The strongest part of the current direction is that it consistently frames the product as a companion platform first, not a premature simulator, while still leaving room for future gameplay support. The documents also do a good job separating several dangerous concept pairs: format vs era, card vs printing, legality vs restriction, and match history vs playable match.

The main weakness is not contradiction but under-specified contracts. Several important distinctions are named correctly, but not yet turned into explicit architectural models. The most important missing clarifications are:

1. the format rule profile that ties format to deck structure, card eligibility, legality inputs, and future gameplay behavior;
2. the card identity model, especially the relationship between `card entity`, `canonical card`, and `card printing`;
3. the validation context model, especially how legality, restriction-list version, content coverage, and unsupported cases are represented together;
4. the boundary between catalog truth, legality truth, and gameplay truth;
5. the first concrete package or bounded-context boundaries that enforce the engineering principles in practice.

The project is safe to continue from a design perspective, but it should not proceed too far into implementation until those areas are clarified.

## What Looks Strong

- The product model is disciplined. The vision and v1 scope are aligned around a companion-platform-first release rather than a hidden simulator project.
- The documents repeatedly reject the "just a card list" trap without overcommitting to full gameplay too early.
- The domain glossary already removes several of the most dangerous terminology collisions that usually poison implementation later.
- The scope document is honest about partial support, phased coverage, and the need to keep unsupported areas explicit rather than implicit.
- The engineering principles are directionally correct for this kind of product: monorepo, domain-first, no gameplay logic in React, no giant card switch, strict typing, and extension-ready architecture are all appropriate.
- The current model correctly treats content growth as a product and architecture concern rather than a background operational detail.
- The project already acknowledges that Standard, V Premium, and Premium cannot be represented as trivial variants of the same thing.

## Tension Points and Potential Contradictions

### A. Product Model Consistency

| Observation                                                                                                                                      | Why It Matters                                                                                                                                      | Risk Level | Recommendation                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| The vision and v1 scope are broadly aligned around "companion platform first, gameplay later."                                                   | This is the core structural decision for the project, and it is currently consistent.                                                               | Low        | Keep this framing unchanged. It is a strength, not a weakness.                                                                         |
| The phrase "future gameplay expansion" is clear at a high level but still leaves room for over-preparation in implementation.                    | Teams often interpret "be ready for gameplay later" as permission to build half a rules engine too early.                                           | Medium     | Define what "gameplay readiness" means at this stage in architectural terms: preserved boundaries, not prebuilt gameplay complexity.   |
| Match tools are positioned as valuable before simulation, but v1 currently includes only manual match history and basic stats.                   | This is not a contradiction, but the product language can drift unless the distinction between "match support" and "playable match" stays explicit. | Medium     | Formalize a small taxonomy: `match history`, `assisted match tools`, `match room`, and `playable match`.                               |
| The scope documents correctly reject full gameplay in v1, but they do not yet define the threshold where future gameplay work becomes justified. | Without that threshold, phase 2 can become a vague bucket for simulator creep.                                                                      | Medium     | Define future gameplay entry criteria based on stable catalog, legality trust, and proven match-tool usage rather than ambition alone. |

### B. Format Model Consistency

| Observation                                                                                                                                                                                          | Why It Matters                                                                                                                                                      | Risk Level | Recommendation                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The glossary clearly separates `format` from `era`, which is correct and important.                                                                                                                  | This avoids one of the most common long-term modeling failures.                                                                                                     | Low        | Preserve this distinction everywhere in code and docs.                                                                                                                                          |
| The current documents do not yet define a formal `format profile` or equivalent concept.                                                                                                             | Format affects deck structure, legality inputs, eligibility, and future gameplay rules. Without a format contract, logic will spread across modules in ad hoc ways. | High       | Define an explicit format-level contract soon, even if the first version is small. It should at minimum express deck sections, eligibility basis, restriction handling, and future rules hooks. |
| The current language correctly says Standard, V Premium, and Premium are different, but it does not yet specify how deck construction and gameplay capabilities vary by format in one unified model. | If this is not made explicit, deck logic will likely hardcode Standard first and retrofit the others later.                                                         | High       | Create a format/deck-structure concept document before implementation of deck validation gets deep.                                                                                             |
| The current model risks underestimating how different Premium is from Standard and V Premium in future gameplay support.                                                                             | Premium can break abstractions that seem sufficient if the architecture is shaped too tightly around Standard.                                                      | High       | Treat Premium as the test case for whether a format abstraction is real or only Standard renamed.                                                                                               |
| The wording "Ride Deck where applicable" is acceptable in product prose but too loose for implementation.                                                                                            | Deck structure cannot depend on prose-level interpretation.                                                                                                         | Medium     | Convert format-specific deck sections into explicit model concepts rather than inferred conventions.                                                                                            |

### C. Content Model Consistency

| Observation                                                                                                                                            | Why It Matters                                                                                                                                                                 | Risk Level | Recommendation                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The separation of `product family`, `specific set`, and `release wave` is good and should scale.                                                       | This gives the platform a workable structure for phased content expansion.                                                                                                     | Low        | Keep this model and use it in ingestion, catalog, and coverage reporting.                                                                                                               |
| `card entity` and `canonical card` are currently close enough in definition that they may become accidental duplicates.                                | If both concepts survive without a strict distinction, the type system and repository contracts will become inconsistent quickly.                                              | High       | Decide whether these are true synonyms or two different levels of identity. Then enforce one canonical naming rule in code and docs.                                                    |
| The glossary correctly separates `card printing` from canonical card identity, but the deck model has not yet said which one decks actually reference. | This is a critical architectural issue. If deck lists point at printings in some places and canonical cards in others, legality, sharing, and importer behavior will fragment. | High       | Decide early whether decks reference canonical card identity by default, with optional preferred printing metadata layered on top.                                                      |
| Reprints, promos, alt arts, and special products are acknowledged but not yet governed by a content normalization policy.                              | Without such a policy, manual exceptions will proliferate in ingestion and legality.                                                                                           | High       | Write a content identity and normalization policy that covers reprint equivalence, alt-art handling, and when a new printing does or does not create a new canonical gameplay identity. |
| The `catalog entry` concept is correctly marked as presentation-facing, but no query projection guidance exists yet.                                   | Without projection guidance, presentation models often leak back into the domain model.                                                                                        | Medium     | Define a catalog query/view-model policy that keeps presentation groupings outside the core card identity model.                                                                        |
| The current content model is strong enough for phased coverage, but only if ingestion remains repeatable.                                              | The documents say this clearly, but the operational model is still unformalized.                                                                                               | Medium     | Prioritize an ingestion workflow document before content starts growing materially.                                                                                                     |

### D. Legality and Deck Model Consistency

| Observation                                                                                                                                             | Why It Matters                                                                                                                                                                     | Risk Level | Recommendation                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| The documents clearly separate `legality`, `restriction list`, and `deck validation`, which is correct.                                                 | This is essential to keeping pre-game validation separate from in-match rules.                                                                                                     | Low        | Preserve this separation as a hard rule in implementation.                                            |
| The legality model does not yet define the validation context precisely enough.                                                                         | A legality result without explicit context can hide whether it was computed against a specific format, restriction list, supported coverage slice, or incomplete support boundary. | High       | Introduce a formal `validation context` concept that includes format, rule inputs, and support scope. |
| The documents acknowledge partial support and unsupported cases, but they do not yet define how unsupported differs from invalid in validation outputs. | If unsupported and illegal collapse into the same result channel, user trust and internal logic will both degrade.                                                                 | High       | Make validation outcomes at least three-way: valid, invalid, unsupported or unverified.               |
| The deck model includes `main deck`, `ride deck`, and `G deck`, but the generalized deck-structure abstraction is not yet stated.                       | Without a structural deck-section model, format-specific deck logic will likely become condition-heavy and brittle.                                                                | High       | Define a format-driven deck structure model before deck validation deepens.                           |
| The current model does not yet say whether restrictions attach to canonical cards, printings, or both.                                                  | This matters for reprints, promos, and legality migration across print histories.                                                                                                  | High       | Define the restriction target identity model explicitly.                                              |
| Choice restrictions are recognized as relational legality, which is a good sign.                                                                        | This suggests the model is not naively card-by-card only.                                                                                                                          | Low        | Keep legality designed as compositional validation, not only per-card checks.                         |

### E. Future Rules Engine Compatibility

| Observation                                                                                                                                                                     | Why It Matters                                                                                                                                                     | Risk Level | Recommendation                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| The current product direction does not contradict a future rules engine.                                                                                                        | Companion-first and gameplay-later are compatible if the truth boundaries remain clear.                                                                            | Low        | Continue with the current staged product strategy.                                                                                                |
| The project still needs a sharper separation between `catalog truth`, `legality truth`, and `gameplay truth`.                                                                   | These are three different kinds of truth. If they collapse into one model, future gameplay support will either overtrust catalog data or undertrust runtime rules. | High       | Formalize these three truth layers explicitly in the next architectural documents.                                                                |
| The glossary includes gameplay terms such as `action`, `zone`, `phase`, `effect`, and `rules engine`, but those terms are not yet connected to a minimal engine boundary model. | That is acceptable for now, but it becomes dangerous if implementation starts inventing local interpretations of those terms.                                      | Medium     | Write a lightweight gameplay boundary note before any interactive match work starts.                                                              |
| The current principles correctly forbid gameplay logic in React, but catalog metadata may still be misused as gameplay behavior.                                                | Keywords, mechanic tags, and card metadata help discovery, but they are not a full executable rules representation.                                                | High       | State explicitly that catalog tags can inform gameplay modules but cannot substitute for engine semantics or authoritative rule handling.         |
| The project correctly rejects a giant switch and also rejects a premature generic DSL, but the allowed middle path is still implicit.                                           | That gap is acceptable in design, but dangerous in implementation because teams tend to invent a local pattern under pressure.                                     | Medium     | Defer final effect-system design, but document acceptable early patterns: typed handlers, mechanic-oriented registries, and narrow extensibility. |
| The current documents are right to think about gameplay abstractions now only at boundary level.                                                                                | Thinking too late would force rules into UI; thinking too early would create empty abstractions.                                                                   | Low        | Keep gameplay design at the boundary-and-contract level until phase-appropriate use cases exist.                                                  |

### F. Engineering Principles Alignment

| Observation                                                                                                                                            | Why It Matters                                                                                                                              | Risk Level | Recommendation                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| The product and domain documents are consistent with monorepo, domain-first, strict typing, and extension-ready architecture.                          | The high-level direction supports the engineering principles rather than undermining them.                                                  | Low        | No correction needed here.                                                                         |
| The principles are strong, but they are not yet backed by a concrete bounded-context or package-boundary document.                                     | Without one more layer of concreteness, future implementation can still drift into the wrong dependency patterns while claiming compliance. | High       | Formalize bounded contexts and allowed dependency directions next.                                 |
| The current docs say "no gameplay logic in React" and "data access must be deliberate," but the application orchestration layer is still underdefined. | If orchestration is not defined, UI and repositories will tend to connect directly.                                                         | High       | Define the application-service or use-case layer more explicitly before major feature work starts. |
| The documents strongly warn against manual content chaos, but ingestion ownership and flow are still only product-level commitments.                   | Engineering principles cannot protect content quality if the ingestion path remains informal in practice.                                   | Medium     | Formalize importer responsibilities, normalization rules, and review checkpoints soon.             |
| Strict typing is declared as a principle, but the glossary still contains one naming ambiguity with `card entity` vs `canonical card`.                 | Ambiguous vocabulary weakens strict typing before code even exists.                                                                         | High       | Resolve identity terminology before shared types are written.                                      |

## Architectural Risks

### High-Risk Ambiguities

| Risk                                                                                                                                    | Why It Matters                                                                               | Recommendation                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Card identity is not fully locked: `card entity`, `canonical card`, `card printing`, and deck references are not yet one settled model. | This can destabilize importer, catalog, legality, and deck storage all at once.              | Define the canonical identity model and the default deck reference model immediately.          |
| Validation context is not formalized.                                                                                                   | Legality trust depends on knowing exactly what was validated against what.                   | Define a validation-context object and result model.                                           |
| Format profile is still implicit.                                                                                                       | Deck structure and future gameplay logic will otherwise hardcode Standard-first assumptions. | Define format capabilities and deck-structure contracts soon.                                  |
| Catalog truth, legality truth, and gameplay truth are not yet named as separate architectural layers.                                   | Future rules work may incorrectly depend on catalog metadata or UI-facing legality results.  | Add a truth-layer clarification document.                                                      |
| Package boundaries are principle-level only.                                                                                            | Teams may implement directly in the app package and call it temporary.                       | Create a bounded-context and dependency-direction document before major implementation begins. |

### Medium-Risk Assumptions

| Assumption                                                                        | Why It Matters                                                               | Recommendation                                                                         |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| The current product-family taxonomy will scale cleanly across irregular products. | It probably will, but special cases may still challenge normalization.       | Revisit after defining ingestion rules.                                                |
| Match tools can stay clearly separate from playable match work.                   | Likely true, but only if terminology and app-level boundaries stay explicit. | Keep match-history and gameplay-session concepts separate in all future docs.          |
| Phase 2 gameplay work can be deferred safely.                                     | True for product scope, but only if boundaries are preserved now.            | Preserve contracts, but do not implement speculative engine internals.                 |
| Content coverage messaging will stay honest as scope grows.                       | This is easy to weaken once implementation complexity rises.                 | Treat coverage declaration as a product and system requirement, not a UI afterthought. |

### Acceptable Unknowns

| Unknown                                     | Why It Can Stay Open                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Final effect-system shape                   | It depends on actual gameplay scope and should not be over-designed yet.           |
| Final realtime architecture                 | v1 does not require it, and premature specificity would be wasted.                 |
| Final repository layout inside the monorepo | The principles are enough for now; the exact tree can follow bounded-context work. |
| Exact phase 2 gameplay surface              | Product scope correctly leaves this open until core workflows are proven.          |
| Exact depth of initial multi-format support | This is a product coverage decision, not yet an architectural contradiction.       |

### Decisions That Should Be Explicitly Deferred

| Deferred Decision                                      | Why Deferral Is Correct                                     |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| Full rules-engine implementation strategy              | Too early before gameplay scope is justified.               |
| Generic card-effect DSL                                | Premature without concrete engine needs.                    |
| Final production-grade realtime session model          | Not needed before playable or assisted match work begins.   |
| Exhaustive support for all historical print edge cases | The scope is intentionally phased and should stay that way. |

## Compatibility with Future Rules Engine

The current direction is compatible with a future rules engine, but only conditionally.

The compatibility is strong in principle because:

- gameplay is explicitly not a v1 requirement;
- the product does not try to force simulation into the first release;
- the glossary already separates gameplay concepts from legality and catalog concepts;
- the engineering principles explicitly reject gameplay logic in React.

The compatibility is weak in one important sense: the project has not yet formalized the contract between catalog data, legality systems, and future runtime rules.

That contract should eventually answer at least these questions:

- Which card attributes are catalog facts versus rules-engine inputs?
- Which legality outcomes are derivable from catalog plus restriction data, and which belong to runtime rules?
- How does a format adapter influence deck validation versus gameplay state transitions?
- Which concepts are authoritative at runtime versus only informative at catalog time?

If those questions are not answered before gameplay-adjacent implementation starts, the most likely failure mode is not an obvious contradiction. The most likely failure mode is hidden coupling: gameplay logic quietly reading catalog projections, legality systems silently becoming partial rules engines, or React components becoming the temporary coordinator that never goes away.

## Questions That Must Be Clarified Soon

These should be clarified before major implementation deepens:

1. What is the single authoritative identity model for cards, printings, and deck references?
2. What is the formal format profile or format adapter contract?
3. What is the generalized deck-structure model across Standard, V Premium, and Premium?
4. What exactly is the validation context for deck legality, including unsupported cases?
5. How do restrictions target identity: canonical card, printing, combination, or format-specific proxy?
6. What are the bounded contexts or top-level domain modules, and what dependency directions are allowed between them?
7. What is the minimum contract separating catalog truth, legality truth, and gameplay truth?

## Questions That Can Stay Open for Now

These are important, but they do not need immediate resolution:

1. The final effect system design.
2. The final realtime or multiplayer architecture.
3. The exact shape of phase 2 playable match support.
4. The full collection and binder model.
5. Tournament-specific architecture.
6. The exact monorepo folder layout, as long as package boundaries are defined conceptually first.

## Recommended Next Decisions

The next design work should focus on reducing the high-risk ambiguities rather than broadening scope.

### 1. Lock the Card Identity Model

Define the exact relationship between canonical gameplay identity, printing identity, and deck references. This is the single most important unresolved content-model issue.

### 2. Define the Format Profile Contract

Create a small but explicit architectural model for per-format capabilities:

- deck sections;
- eligibility basis;
- restriction handling;
- validation hooks;
- future gameplay-rule hooks.

### 3. Define the Legality Validation Context

Specify what a legality check is evaluated against and how unsupported or partially supported states are represented.

### 4. Define Bounded Contexts and Dependency Directions

Translate the engineering principles into a concrete architectural boundary document. At minimum, clarify the relationship among catalog, decks, legality, importer, social, gameplay, application orchestration, and infrastructure adapters.

### 5. Define Catalog vs Legality vs Gameplay Truth

Write a small architectural clarification that states what each layer owns and what it must not infer from the others.

### 6. Define Ingestion Normalization Policy

Formalize how reprints, promos, alt arts, special products, and ambiguous source data are normalized into stable internal records.

## Architecture Review Verdict

The current direction is viable.

There are no critical contradictions between the vision, v1 scope, glossary, and engineering principles. The project is currently pointed in the right direction.

What absolutely needs clarification next:

- card identity and deck-reference identity;
- format profile and deck-structure contract;
- legality validation context and unsupported-result semantics;
- bounded contexts and dependency directions;
- truth boundaries between catalog, legality, and gameplay layers.

What is safe to proceed with now:

- companion-platform-first product planning;
- phased content strategy;
- domain-first engineering direction;
- monorepo and package-boundary planning;
- early catalog, deck, legality, and ingestion design, as long as the unresolved contracts above are handled before implementation hardens around shortcuts.
