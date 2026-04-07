# Gameplay-Facing Catalog Projection

Status: Cross-context gameplay input contract  
Last updated: 2026-04-07

## Why This Document Exists

This document defines the gameplay-facing catalog projection used by the `rules` or gameplay context.

It exists because the gameplay layer must not consume the full catalog model directly. The catalog contains far more information than gameplay needs, including:

- printing history;
- rarity and set metadata;
- release provenance;
- search and browse fields;
- UI-oriented display data;
- importer-facing normalization context.

If `rules` reads the full catalog model, the result will be predictable:

- gameplay logic will become coupled to catalog structure;
- printing-level fields will leak into gameplay by convenience;
- catalog or importer changes will break runtime code;
- catalog truth and gameplay truth will blur into one unstable model.

Gameplay needs a smaller, more stable, more disciplined data surface.

### Decision 1: `Rules` Must Consume a Curated Gameplay Projection, Not the Full Catalog Model

Decision:

- The gameplay layer should consume a published gameplay-facing projection derived from catalog truth, not the full catalog entity model.

Rationale:

- Runtime systems need only gameplay-relevant card facts.
- Everything beyond that increases coupling without improving correctness.

Practical implication:

- `rules` should depend on the gameplay-facing projection contract and canonical card identity, not on browse models, printing records, or importer-shaped catalog objects.

## What the Gameplay Projection Is

A gameplay-facing projection in this project is:

- a curated, minimal, stable representation of card data tailored for gameplay engine consumption.

It is:

- derived from canonical catalog truth;
- published as a shared contract;
- read-only for gameplay consumers;
- intentionally smaller than the full catalog model.

It is not:

- a copy of the catalog;
- raw importer data;
- a UI model;
- a legality model;
- gameplay runtime state;
- an effect handler implementation.

### Decision 2: Gameplay Projection Is a Derived Contract Layer, Not a New Domain Truth Layer

Decision:

- The gameplay-facing projection should be treated as a derived published contract between `catalog` and `rules`, not as a separate source of truth about cards.

Rationale:

- Card content remains owned by catalog truth.
- Gameplay interpretation remains owned by gameplay truth.
- The projection exists only to bridge those layers safely.

Practical implication:

- If catalog data changes, the projection may change.
- If gameplay state changes, the projection does not.

## Relationship to Catalog Truth

### Decision 3: Catalog Remains the Source of Truth; Projection Is a Read-Only Derivation

Decision:

- `catalog` remains the source of truth for card data.
- The gameplay-facing projection is a derived representation published from that source.

Rationale:

- Gameplay should consume card facts, not own card facts.

Practical implication:

- `rules` may read the projection.
- `rules` must not modify it, extend it locally, or become its owner.

### Decision 4: Projection Is the Bridge from Catalog Truth to Gameplay Input, Not a Replacement for Catalog

Decision:

- The projection should be understood as a boundary bridge between catalog truth and gameplay setup, not as a second catalog.

Rationale:

- A projection that becomes a second catalog will recreate the same maintenance and coupling problems under a different name.

Practical implication:

- The projection should expose only gameplay-relevant card facts and identifiers.
- Browse, search, printing, and provenance concerns stay in catalog.

## Required Data Categories

### Decision 5: Projection Must Contain Gameplay-Relevant Facts and No More

Decision:

- The published gameplay-facing projection should include only data categories that materially affect gameplay setup, runtime validation, effect selection, or effect interpretation.

Rationale:

- This keeps the contract minimal while still making the gameplay layer viable.

Practical implication:

- Every included field category should be defensible by answering one question:
- "What gameplay decision or runtime interpretation needs this?"

### Required Conceptual Categories

The projection should contain at least these categories:

- gameplay-level card identity based on canonical card identity;
- stable gameplay-facing names or identifiers used by gameplay-aware checks where needed;
- card type and other role-defining categories such as unit, order, trigger, or token if relevant to gameplay;
- core gameplay stats such as grade, power, critical, shield, or equivalent gameplay-relevant numeric facts where applicable;
- nation, clan, race, attribute, trigger classification, or similar gameplay-relevant classification fields when they affect runtime rules;
- keywords and mechanic markers that influence gameplay interpretation;
- effect definitions in published gameplay-facing form, such as structured descriptors, references, or effect-definition handles suitable for runtime lookup;
- gameplay-relevant flags or markers needed to initialize or validate runtime behavior.

### Decision 6: Effect Data in the Projection Must Describe Gameplay-Relevant Effect Meaning, Not Implement Runtime Logic

Decision:

- The projection may include effect-definition data or references needed by gameplay systems, but it must not contain runtime business logic itself.

Rationale:

- Data description and runtime execution are separate concerns.

Practical implication:

- The projection may point gameplay systems to the right effect or mechanic definition.
- It must not become a hidden effect-handler layer.

## Excluded Data Categories

### Decision 7: Printing, Search, Provenance, and UI Data Must Be Excluded by Default

Decision:

- Data categories that do not directly affect gameplay must not be included in the gameplay-facing projection.

Rationale:

- These fields create coupling and tempt gameplay code to depend on irrelevant catalog details.

Practical implication:

- If a field is proposed for the projection, its gameplay justification must be explicit.

### Excluded Categories

The projection must exclude, by default:

- printing-level details such as rarity, set code, card number, or release identity;
- artwork and visual presentation data;
- language variants and locale-display text that do not affect gameplay meaning;
- importer source metadata and provenance records;
- UI presentation fields;
- collection, binder, or ownership data;
- search, filter, ranking, pagination, or sorting fields;
- page-level grouped catalog projections;
- social-facing decoration;
- legality results or legality support-state outputs.

### Decision 8: Printing-Level Data Must Not Enter Gameplay Projection Unless an Explicit Gameplay Rule Truly Requires It

Decision:

- Printing-level data should remain excluded unless a future supported gameplay rule explicitly depends on it.

Rationale:

- Default inclusion of printing data would undermine the card identity policy and recreate printing-as-gameplay confusion.

Practical implication:

- The burden of proof is on the exception, not on the exclusion.

## Projection Boundaries

### Decision 9: Projection Is Read-Only to `rules`

Decision:

- The gameplay-facing projection is read-only to gameplay consumers.

Rationale:

- `rules` consumes gameplay inputs; it does not own or mutate catalog-derived card facts.

Practical implication:

- Runtime systems may cache or transform the projection into gameplay-owned runtime structures.
- They may not treat the projection as a mutable extension point.

### Decision 10: Projection Must Not Contain Business Logic or Consumer-Specific Extensions

Decision:

- The projection should not contain runtime state logic, effect-handler code, or consumer-specific fields added ad hoc by `rules`.

Rationale:

- A projection is a boundary contract, not an escape hatch for missing runtime abstractions.

Practical implication:

- If `rules` needs additional data, the owner must decide whether that data belongs in the projection.
- `rules` must not patch the contract locally.

### Decision 11: `Rules` Must Not Build Its Own Mini-Catalog

Decision:

- The gameplay layer must not filter full catalog data into a private pseudo-catalog as a substitute for the published projection.

Rationale:

- That would recreate the same coupling under a different implementation shape.

Practical implication:

- Gameplay should consume the published projection directly or a gameplay-owned runtime transformation derived from it.

## Relationship to Deck Snapshot

### Decision 12: Deck Snapshot and Gameplay Projection Are Complementary Inputs

Decision:

- The deck snapshot and gameplay-facing catalog projection are separate contracts that work together.

Rationale:

- The deck snapshot answers "which cards are in this deck, in which sections, under which format reference?"
- The gameplay projection answers "what gameplay-relevant card facts correspond to those identities?"

Practical implication:

- Snapshot plus projection provides the input surface needed for gameplay setup.

### Decision 13: Deck Snapshot Provides References; Projection Provides Gameplay Facts

Decision:

- The deck snapshot should carry canonical card references and structure.
- The gameplay projection should provide the gameplay-relevant card data for those references.

Rationale:

- This preserves clean contract boundaries and keeps each surface minimal.

Practical implication:

- Do not expand deck snapshot to carry full gameplay card data.
- Do not force gameplay to pull deck structure from catalog.

## Relationship to Legality

### Decision 14: Legality and Gameplay May Share Identity Inputs, but Legality Must Not Depend on Gameplay Projection

Decision:

- `legality` and `rules` may share canonical card identity and some high-level card facts conceptually, but `legality` should not depend on the gameplay-facing projection contract directly.

Rationale:

- Legality and gameplay are different truth layers and should remain separate.

Practical implication:

- If both contexts need some shared identity or classification fields, those fields should come from canonical shared contracts, not by letting legality consume gameplay projection as a shortcut.

### Decision 15: Gameplay Projection Must Not Carry Legality Outcomes

Decision:

- The gameplay-facing projection must not include legality results, restriction decisions, or legality-support conclusions.

Rationale:

- Those belong to legality truth, not gameplay-facing card data.

Practical implication:

- Gameplay setup may receive legality outputs separately if a higher-level flow chooses to consult them.
- The card projection itself remains legality-neutral.

## Ownership and Publication

### Decision 16: `Catalog` Owns and Publishes the Gameplay-Facing Catalog Projection

Decision:

- The `catalog` context is the owner and publisher of the gameplay-facing catalog projection.

Rationale:

- The projection is derived from catalog truth.
- `rules` needs card facts, not ownership of card facts.

Practical implication:

- `catalog` decides what the published gameplay-facing projection contains.
- `rules` consumes it but does not define it.

### Decision 17: `Rules` Is the Primary Consumer, Not a Co-Owner

Decision:

- `rules` is the primary consumer of the gameplay-facing projection, but it is not a co-owner of the contract.

Rationale:

- Shared ownership would quickly turn the projection into a gameplay-shaped catalog fork.

Practical implication:

- Requests for new fields should flow back to the owner.
- `rules` should not locally extend the published contract.

### Decision 18: Publication Must Happen Through the Catalog Public Boundary

Decision:

- The gameplay-facing projection should be published through the catalog context's public boundary, not through deep internal catalog types and not through importer outputs.

Rationale:

- Publication discipline is what keeps the projection stable and safe.

Practical implication:

- Consumers should import or request the published projection contract.
- They should not reach through into catalog internals.

## Evolution Policy

### Decision 19: Projection Must Evolve Additively and Conservatively

Decision:

- The gameplay-facing projection should evolve conservatively, with additive changes preferred over semantic rewrites.

Rationale:

- Runtime systems will depend on this contract heavily once gameplay work begins.

Practical implication:

- New mechanics should add clearly justified gameplay fields or effect-definition handles.
- Existing field meaning should remain stable unless an explicit contract change is made.

### Decision 20: New Gameplay Needs Must Flow Back Through the Owner

Decision:

- When gameplay support expands, the projection should be revised through `catalog` ownership rather than patched locally inside `rules`.

Rationale:

- Centralized evolution prevents contract drift and hidden coupling.

Practical implication:

- If a new mechanic requires new card facts, the projection should be extended centrally and republished.

## Anti-Patterns

### Decision 21: The Following Gameplay-to-Catalog Shortcuts Are Architecture Violations

Decision:

- The patterns below should be treated as invalid architecture moves.

Rationale:

- Each one breaks the boundary this projection is meant to protect.

Practical implication:

- If these appear in implementation, the correct response is contract correction, not normalization.

Anti-patterns:

- `rules` imports full catalog entities;
- `rules` depends on printing-level fields by convenience;
- the gameplay-facing projection becomes a second full catalog;
- the projection starts carrying gameplay runtime state;
- the projection is treated as mutable by consumers;
- `rules` adds local fields to the projection without changing the published owner contract;
- importer data directly shapes gameplay representation without catalog publication;
- UI or page payloads influence gameplay-facing card data;
- legality logic or legality results are embedded into the projection.

## Examples

### Good Example 1: `Rules` Receives Minimal Gameplay Card Data

- `rules` receives a gameplay-facing card projection with canonical identity, gameplay-relevant stats, keywords, and effect-definition handles.
- It does not receive rarity, set code, or browse metadata.

### Good Example 2: Snapshot Supplies Ids, Projection Supplies Facts

- Deck snapshot provides canonical card references and section placement.
- Gameplay-facing projection supplies the gameplay-relevant card facts for those references.
- Gameplay setup combines both to initialize runtime structures.

### Good Example 3: New Keyword Added Through Projection Evolution

- A new supported mechanic requires a new gameplay-relevant keyword marker.
- `catalog` extends the published gameplay-facing projection.
- `rules` consumes the new field after the owner publishes it.

### Bad Example 1: `Rules` Reads Rarity or Set Code

- A gameplay module imports full catalog data because rarity and set code are already present there.
- Result: runtime logic becomes coupled to printing and release metadata that do not belong in gameplay by default.

### Bad Example 2: `Rules` Filters Catalog Internally

- Gameplay code loads full catalog entities and locally filters them down to the fields it wants.
- Result: `rules` has created a shadow mini-catalog and bypassed the published boundary.

### Bad Example 3: UI Influences Gameplay Representation

- A page decides which card fields gameplay needs and builds a page-local gameplay object.
- Result: UI becomes an accidental owner of gameplay input structure.

## Final Recommendations

### Recommendation 1: Make Gameplay Projection Mandatory

- `rules` should receive card data only through the published gameplay-facing projection, not through full catalog entities.

### Recommendation 2: Keep `catalog` as the Source of Truth and Publisher

- Card facts stay owned by catalog truth.
- The gameplay-facing projection is the published bridge to gameplay consumers.

### Recommendation 3: Keep the Projection Minimal

- Include only gameplay-relevant identity, stats, classifications, keywords, effect-definition data, and explicit gameplay markers.

### Recommendation 4: Exclude Printing, UI, Provenance, and Legality Data

- If a field does not have a direct gameplay justification, it should stay out of the projection.

### Recommendation 5: Treat Projection as the Only Legitimate Card-Data Entry Point into Gameplay

- Deck snapshot plus gameplay-facing projection should be the standard input surface for gameplay setup.
- `rules` should not reach around that boundary.
