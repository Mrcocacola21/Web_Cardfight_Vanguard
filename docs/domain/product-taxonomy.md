# Product Taxonomy

Status: Initial domain product taxonomy  
Last updated: 2026-04-07

## 1. Overview

This document defines the product taxonomy used by the Cardfight!! Vanguard web client / companion platform.

It exists because product data in this project is not a cosmetic catalog label. Product structure affects:

- how `catalog` groups and explains printings;
- how `importer` normalizes release sources;
- how `legality` interprets baseline product eligibility;
- how UI presents release families and coverage;
- how print history remains stable as the card pool grows.

The taxonomy must therefore model products as structured release containers with explicit lineage and role, not as a loose string field.

## 2. What Is a Product

### Decision: `Product` Is a Release Container, Not a Card

Decision:

- A `Product` is a release container that groups card printings under one official release identity.

Rationale:

- Cards and printings answer gameplay and release-level identity questions.
- Products answer release-origin and distribution questions.

Practical implication:

- `Product` is neither a canonical card nor a printing.
- A product is the release object that a printing belongs to.

### Product Role

A product should be understood as:

- a named release object;
- part of a broader product family lineage;
- classified by a structured product taxonomy;
- associated with one release date and optional release-region scope;
- the container that owns printing membership.

## 3. ProductFamily

### Decision: `ProductFamily` Describes Release Lineage, Not Playable Format

Decision:

- `ProductFamily` is the lineage-level grouping that places products into broad release families.

Rationale:

- Format eligibility depends partly on release lineage.
- Product lineage is not the same thing as format meaning.

Practical implication:

- `ProductFamily` should be available to legality and format modeling as an input to eligibility policy.
- It must not be treated as a playable format by itself.

### Current Baseline Families

At the current domain level, the baseline lineage families are:

- Standard lineage
- V lineage
- Premium lineage

These are lineage buckets, not format definitions.

Important boundary:

- a product in Premium lineage is not automatically "legal in Premium" without legality evaluation;
- a product in Standard lineage is not itself a format object.

### Recommended ProductFamily Meaning

`ProductFamily` should carry at least:

- stable identity;
- human-readable name;
- lineage classification;
- optional parent or broader-family relationship when a family is a refinement of another family.

That allows the model to express broad lineage while remaining extensible for future subfamilies or exceptional families.

## 4. ProductType Taxonomy

### Decision: `ProductType` Must Be Structured, Not a Flat Enum

Decision:

- `ProductType` must be modeled as a category + subtype taxonomy.

Rationale:

- Main booster, extra booster, title booster, lyrical booster, trial deck, and start deck are not equivalent labels.
- They imply different release behavior, grouping expectations, and ingestion patterns.

Practical implication:

- The system should distinguish category from subtype instead of storing one flat string like `"booster"` or `"deck"`.

### Taxonomy Shape

The recommended current taxonomy is:

- Booster
  - Main Booster
  - Extra Booster
  - Title Booster
  - Lyrical Booster
- Deck
  - Trial Deck
  - Start Deck
- Promo
- Special Set

This is the minimum structured taxonomy needed right now.

### Why This Matters

This model gives the system stable answers to questions such as:

- is this a booster-style product or a constructed-deck product?
- if it is a booster, what kind of booster line is it?
- if it is a deck, is it a trial deck or a start deck?
- is this a promo release outside standard booster/deck flow?
- is this an irregular special-set style release that should not be forced into booster/deck semantics?

## 5. Product Attributes

### Recommended Core Attributes

At domain level, a `Product` should carry at least:

- `id`
  - stable identity
- `name`
  - human-readable name
- `code`
  - release code such as `BT`, `EB`, `D-SS`, promo code, or equivalent official source code
- `releaseDate`
  - release identity in time
- `family`
  - product-family lineage reference
- `type`
  - structured taxonomy object, not a flat string
- `region`
  - optional release-region scope where needed
- optional cycle or release-group marker
  - when importer or catalog needs release grouping beyond the individual product

### Decision: Product Attributes Must Stay Product-Oriented

Decision:

- Product attributes must describe the release object itself.

Rationale:

- Cards, printings, legality, and gameplay already have their own identities and truths.

Practical implication:

- Product should not absorb card gameplay meaning.
- Product should not carry legality verdicts.

## 6. Product -> Printing Relationship

### Decision: Product Owns Printing Membership

Decision:

- A `Product` contains `CardPrinting` records.
- A `CardPrinting` belongs to exactly one `Product`.

Rationale:

- Printing identity is release-specific.
- Release-specific identity requires one concrete product origin.

Practical implication:

- `Canonical Card -> many CardPrintings`
- `Product -> many CardPrintings`
- `CardPrinting -> one Canonical Card`
- `CardPrinting -> one Product`

### Boundary Rule

`Card` is the gameplay-level normalized identity.  
`CardPrinting` is the release-specific printing identity.  
`Product` is the printing container or release source.

These must stay distinct.

## 7. Promo Model

### Decision: `Promo` Is Its Own Product Taxonomy Branch

Decision:

- `Promo` should be modeled as a separate product type category, not squeezed into booster or deck taxonomy.

Rationale:

- Promos often sit outside normal set cycles;
- they may be event-distributed, box-included, shop-given, or otherwise irregular;
- they are a release/distribution classification, not a rarity field.

Practical implication:

- Promo products can exist without booster semantics or deck semantics.
- Promo printings remain ordinary printings in catalog truth, but their product origin stays explicit.

### Promo Boundary

Promo status may matter for:

- importer source mapping;
- catalog grouping and coverage communication;
- special release display;
- future operational review.

Promo status does not by itself create a new canonical gameplay card identity.

## 8. Optional Grouping (Cycles)

### Decision: Release Cycles Are Useful but Secondary

Decision:

- The model may support optional release-grouping concepts such as season, cycle, or release wave.

Rationale:

- Importer and catalog sometimes need a grouping above individual products but below broad lineage.

Practical implication:

- Cycle grouping may exist as an optional release attribute or adjacent grouping model.
- It must not replace product identity, product family, or product type.

### Example Uses

- grouping several booster products into one rollout wave;
- presenting a coherent release season in UI;
- importer batch coordination.

## 9. Integration With Formats

### Decision: Product Taxonomy Informs Format Eligibility; It Does Not Replace It

Decision:

- Product family and product taxonomy inform format eligibility as upstream catalog facts.
- They do not decide legality by themselves.

Rationale:

- Format profile defines baseline eligibility policy.
- Legality evaluates decks within that policy plus restriction overlays.

Practical implication:

- `FormatProfile` may say which product families are in baseline scope.
- `legality` may then use product-family lineage as one input into card-pool eligibility.
- Product taxonomy stays in catalog truth.

### Current High-Level Relationship

- Standard profiles typically point at Standard-lineage baseline families
- V Premium profiles typically point at V-lineage baseline families, plus explicit official allowances where relevant
- Premium profiles use the broadest baseline pool and therefore rely on broader lineage interpretation

Important boundary:

- product taxonomy provides eligibility inputs;
- legality decides actual admissibility.

## 10. Notes for Importer

### Decision: Taxonomy Must Be Easy to Normalize From Raw Sources

Decision:

- The product taxonomy must be importer-friendly and source-normalization friendly.

Rationale:

- Product labels coming from source material are messy and inconsistent across eras.
- Importer needs a stable internal target model.

Practical implication:

- Raw source labels should map into:
  - a normalized product family
  - a structured product taxonomy
  - a normalized product code and release identity

### Importer Guidance

Importer should:

- preserve original source labels for provenance;
- normalize product category and subtype explicitly;
- avoid collapsing all booster-like products into one generic booster bucket;
- avoid forcing irregular products into the wrong taxonomy branch just to fit a flat enum;
- keep promo and special-set handling explicit.

Importer must not:

- invent format meaning from product labels alone;
- blur product type into card identity;
- publish ambiguous product normalization as canonical truth without resolution.

## 11. Summary

The product taxonomy of this project is built around a few core rules:

- `Product` is a release container for printings
- `ProductFamily` expresses lineage, not playable format
- `ProductType` is a structured taxonomy, not a flat enum
- `Product -> CardPrinting` is a first-class relationship
- promo remains a distinct taxonomy branch
- product taxonomy informs legality inputs but does not replace legality

This gives the system a model that is usable for:

- `importer` normalization;
- `catalog` publication and browse structure;
- `legality` eligibility inputs;
- UI release grouping and coverage communication.
