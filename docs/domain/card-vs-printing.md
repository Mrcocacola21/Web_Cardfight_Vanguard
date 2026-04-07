# Card vs CardPrinting

Status: Initial card identity separation note  
Last updated: 2026-04-07

## 1. Overview

This document fixes the final domain separation between `Card` and `CardPrinting` in the Cardfight!! Vanguard platform model.

It exists because this distinction is one of the most important contracts in the system. If it is modeled incorrectly:

- `decks` will reference release artifacts instead of gameplay identity;
- `legality` will attach rules to the wrong level;
- `importer` will create duplicate cards or collapse distinct printings;
- `rules` will inherit release-specific noise that does not belong in gameplay truth.

This document does not replace the card identity policy. It narrows that policy into one implementation-ready domain distinction:

- `Card`
- `CardPrinting`

## 2. Why Separation Is Required

### Decision: Gameplay Identity and Release Identity Must Be Separate

Decision:

- The system must model `Card` and `CardPrinting` as two different domain entities.

Rationale:

- A gameplay card may exist in many sets, promo releases, art variants, and language-specific printings.
- Those printings are not normally different gameplay cards.
- The platform must support catalog history and printing detail without corrupting deck, legality, or gameplay identity.

Practical implication:

- `Card` is the gameplay-level canonical entity.
- `CardPrinting` is the physical or release-specific printing entity.

### Boundary Rule

`Card` answers:

- what gameplay object is this?

`CardPrinting` answers:

- where and how was this gameplay object printed or distributed?

Those are different questions and must stay different.

## 3. Card Definition

### Decision: `Card` Is the Canonical Gameplay Entity

Decision:

- `Card` is the canonical gameplay-facing entity in catalog truth.

Rationale:

- Deck building, legality, and gameplay all need one stable card identity that is independent of release-specific printing details.

Practical implication:

- `Card` is the authoritative reference target for deck entries, legality checks, and gameplay-facing projections.

### What a Card Contains

A `Card` should contain gameplay-meaningful and identity-stable fields such as:

- card identity
- name
- card type
- grade
- nation or clan
- race or similar gameplay traits where relevant
- core stats such as power, critical, or shield where relevant
- trigger classification where relevant
- keywords or gameplay-facing tags
- effect references at catalog or projection level

### What a Card Must Not Contain

A `Card` must not directly own printing-specific publication data such as:

- set code
- release product membership
- rarity
- distribution channel
- artwork-specific variant data
- printing locale or release-region data

Those belong to `CardPrinting` or its related `Product`.

## 4. CardPrinting Definition

### Decision: `CardPrinting` Is the Release-Specific Printing Entity

Decision:

- `CardPrinting` is the release-specific entity that represents one concrete printing of a canonical card.

Rationale:

- The system must preserve print history, promos, alt arts, and release provenance without turning them into separate gameplay cards by default.

Practical implication:

- `CardPrinting` belongs to catalog truth and future collection truth.
- It does not become the default identity for decks, legality, or gameplay.

### What a CardPrinting Contains

A `CardPrinting` should contain printing or publication-specific fields such as:

- printing identity
- canonical card reference
- product reference
- collector or card number within the release
- rarity
- locale and, where justified, region-specific release detail
- artwork or visual-variant markers
- promo or special-distribution markers where needed

Release timing and release-code meaning should usually come through the related `Product`, not be duplicated unnecessarily onto every printing.

### What a CardPrinting Must Not Contain

A `CardPrinting` must not become a second gameplay card object.

It must not duplicate the full gameplay definition of `Card`, including:

- normalized card type meaning
- canonical gameplay stats as a second source of truth
- runtime effect behavior
- legality semantics

## 5. Relationship

### Decision: `Card` Has Many `CardPrinting` Records

Decision:

- `Card` has a one-to-many relationship with `CardPrinting`.
- `CardPrinting` has an inverse reference back to exactly one `Card`.

Rationale:

- One gameplay card may be printed many times.
- A single printing still belongs to one canonical gameplay card.

Practical implication:

- `Card -> many CardPrinting`
- `CardPrinting -> one Card`
- `CardPrinting -> one Product`

This is the core catalog relationship needed to support reprints, promos, alternate art, and print history.

## 6. Identity Strategy

### Decision: Decks Use `Card`, Not `CardPrinting`

Decision:

- Deck entries and deck snapshots should use canonical `Card` identity as the authoritative reference.

Rationale:

- Deck construction rules, same-name logic, copy limits, legality, and gameplay setup all care about gameplay identity.
- Printing-based references would make equivalent reprints behave like different cards.

Practical implication:

- `decks` should store `CardId` as the actual card reference.
- A preferred-printing reference may exist later for display, but it must remain secondary.

### Decision: Legality Targets `Card`, Not `CardPrinting`, by Default

Decision:

- Legality should evaluate card admissibility against canonical `Card` identity by default.

Rationale:

- Restriction rules, copy limits, and format admissibility normally apply to gameplay identity, not to a specific rarity or release instance.

Practical implication:

- `legality` should consume deck snapshots keyed by `CardId`.
- `CardPrinting` matters only if a future explicit legality rule genuinely attaches to a printing-level exception.

### Decision: Rules Consume Gameplay Projection Derived From `Card`

Decision:

- Runtime gameplay should consume gameplay-facing card projections derived from canonical `Card`.

Rationale:

- Gameplay truth needs stable card meaning, not release artifacts.

Practical implication:

- `rules` should never depend on `CardPrinting` as its ordinary gameplay identity.
- Printing data may be present for display or future explicit exceptions, but not as the default runtime reference.

## 7. Field Ownership

### Card Owns

- gameplay identity
- canonical name
- gameplay classification
- gameplay-relevant stats
- gameplay-facing tags
- effect references

### CardPrinting Owns

- printing identity
- product membership
- collector number
- rarity
- locale
- artwork and release-variant detail

### Product Owns

- release code
- release date
- product taxonomy
- broader release grouping and family lineage

### Field Ownership Rule

If a field exists to answer "how is this gameplay object printed or distributed," it does not belong on `Card`.

If a field exists to answer "what gameplay object is this," it does not belong primarily on `CardPrinting`.

## 8. Usage Across the System

### Catalog

`catalog` stores and publishes both:

- `Card` as canonical gameplay identity
- `CardPrinting` as release-specific identity

Catalog pages and search should generally prefer canonical-card views, with linked printing history.

### Decks

`decks` should use:

- `CardId` as the authoritative card reference

`decks` should not use:

- `CardPrintingId` as the primary gameplay reference

### Legality

`legality` should use:

- `CardId`
- format profile
- restriction lists

Legality should not assume:

- different printings imply different legality objects

### Rules

`rules` should use:

- gameplay-facing projection keyed by canonical card identity

Rules should not consume:

- full printing history
- rarity or release metadata as gameplay inputs by default

### Importer

`importer` should normalize raw source records into:

- one canonical `Card` when gameplay identity matches
- one or more `CardPrinting` records when release identity differs

Importer must preserve both:

- canonical-card grouping
- printing-level distinctness

## 9. Edge Cases

### Reprints

Reprints normally create:

- the same `Card`
- a new `CardPrinting`

### Alternate Art

Alternate art normally creates:

- the same `Card`
- a new `CardPrinting`

### Promo Versions

Promo releases normally create:

- the same `Card`
- a new `CardPrinting`

Promo status is a release concern, not a new gameplay identity by default.

### Errata

Errata requires explicit identity review.

Policy direction:

- if errata changes only release presentation or clarifies without changing gameplay identity, keep one `Card` and a distinct printing path if needed
- if errata materially changes gameplay identity, create a different canonical `Card`

This is one of the few edge cases where importer review and normalization discipline are mandatory.

### Material Gameplay Difference

If two source records differ materially in gameplay meaning, they must not be collapsed into one `Card` just because they look like related releases.

## 10. Summary

The final contract is:

- `Card` is the canonical gameplay entity
- `CardPrinting` is the release-specific printing entity
- `Card -> many CardPrinting`
- `decks` reference `Card`
- `legality` evaluates `Card`
- `rules` consume gameplay projections derived from `Card`
- `importer` groups multiple printings under one `Card` when gameplay identity matches

This separation preserves:

- stable gameplay identity
- clean legality targeting
- correct importer normalization
- future collection and print-history support

The system should treat any attempt to collapse `Card` and `CardPrinting` into one entity as an architectural violation.
