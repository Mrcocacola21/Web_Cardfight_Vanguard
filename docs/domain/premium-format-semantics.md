# Premium Format Semantics

Status: Premium domain clarification note  
Last updated: 2026-04-07

## 1. Overview

This document sharpens the domain semantics of `Premium` as a playable format in the Cardfight!! Vanguard platform.

It exists because Premium is the most structurally demanding official format currently recognized by the system. The baseline format model already captures that Premium:

- uses a broad cross-era card pool;
- has a separate G deck;
- is distinct from Standard and V Premium;
- requires gameplay-facing format projection for runtime interpretation.

What still needed clarification was:

- what qualifies as a G-deck card at domain level;
- how Premium should think about cross-era card coexistence;
- which compatibility fields matter to legality and gameplay preparation.

This document does not define runtime gameplay rules or effect resolution. It defines Premium as a domain contract that other bounded contexts can depend on safely.

## 2. Premium as a Format Profile

### Decision: Premium Is a Broad Cross-Era Profile, Not Just "Everything Allowed"

Decision:

- Premium must be treated as a structured profile with broad product eligibility, separate G-deck semantics, and explicit cross-era coexistence.

Rationale:

- "All cards are allowed" is too weak to describe Premium.
- Premium has structural meaning beyond pool breadth, especially through G-deck access and Stride-era runtime shape.

Practical implication:

- Premium still resolves through `FormatProfile`, not through a broad allow-all shortcut.

## 3. G Deck Semantics

### Decision: G Deck Is a Separate Premium-Only Construction and Runtime Domain Section

Decision:

- In Premium, the G deck is a separate section with its own card qualification semantics.

Rationale:

- G-deck cards are not just main-deck cards in another list.
- They participate in a different construction and runtime meaning.

Practical implication:

- `decks` must preserve G deck as its own explicit section.
- `legality` must validate G-deck qualification separately from main-deck qualification.
- `rules` may derive G-zone runtime behavior only through gameplay-facing format and card projections.

### What Makes a Card G-Deck-Eligible

At domain level, a card is G-deck-eligible only when catalog truth can identify it as belonging to the G-deck card family required by Premium.

This means G-deck qualification depends on gameplay-relevant card classification, not on:

- product label alone;
- release date alone;
- printing rarity or promo status;
- page-level assumptions.

### G-Deck Qualification Rule

The Premium model should treat G-deck qualification as a card-level eligibility marker derived from canonical card meaning and published through the relevant projection or qualification contract.

That marker should answer:

- may this canonical card occupy the G deck section under Premium semantics?

It should not answer:

- how the card resolves at runtime;
- whether a specific stride action is currently legal in the match;
- whether the system fully supports the mechanic today.

### G Deck and Main Deck Relationship

The G deck is separate from the main deck.

That means:

- a canonical card qualifies for one sectional role or the other according to published classification;
- G-deck occupancy is not a duplicate of main-deck occupancy;
- G-deck size and qualification are evaluated separately from main-deck size and qualification.

This does not forbid future explicit exceptions. It forbids silent merging of section meaning.

## 4. G Deck and Stride Relationship

### Decision: Stride Depends on Premium Runtime Meaning, Not on Construction Alone

Decision:

- The Premium format profile may declare Stride as a format-native capability, but deck construction and legality should stop at structural qualification and section admissibility.

Rationale:

- The existence of the G deck and Stride support is part of format meaning.
- Actual Stride execution belongs to gameplay truth.

Practical implication:

- `legality` may assert that a deck has an admissible Premium G deck.
- `rules` later decides what Stride-related runtime actions are available in the current match state.

## 5. Cross-Era Semantics

### Decision: Premium Admits Cross-Era Coexistence Through Canonical Identity, Not Era-Specific Forking

Decision:

- Premium should treat D-era, V-era, and older canonical cards as coexisting within one broad format profile, while preserving their canonical card identity and gameplay-relevant classification.

Rationale:

- Premium is the main format where cross-era coexistence is expected.
- Era coexistence must not collapse identity boundaries or produce multiple parallel gameplay identities for the same canonical card.

Practical implication:

- cross-era cards still remain canonical `Card` entities;
- legality and gameplay consume shared upstream identity rather than era-specific copies of the model.

### Cross-Era Product Eligibility

Premium product eligibility remains broad, but not meaningless.

It should still be mediated through:

- canonical card identity;
- product-family lineage and official eligibility interpretation;
- the Premium profile's baseline product-eligibility policy.

This preserves the distinction between:

- being in the broad Premium-eligible pool;
- being structurally admissible in a Premium deck;
- being currently supported in gameplay implementation.

## 6. Compatibility-Relevant Fields

### Decision: Premium Needs Explicit Compatibility Fields, Not Era Guessing

Decision:

- Premium legality and gameplay preparation should rely on explicit compatibility-relevant fields rather than guessing from release era labels alone.

Rationale:

- Cross-era coexistence is too complex to reduce safely to set-code or series-name heuristics.

Practical implication:

- The domain model should treat the following field families as compatibility-relevant when published appropriately:
  - canonical card identity;
  - nation and clan where applicable;
  - card type and section qualification markers;
  - grade and other construction-relevant classification;
  - format-native mechanic markers;
  - G-deck qualification markers;
  - gameplay-facing effect references for runtime use.

### What Must Not Drive Cross-Era Compatibility

The following must not become the default source of Premium compatibility meaning:

- printing identity;
- rarity;
- product marketing label by itself;
- UI-side "era" filters;
- importer-local unresolved heuristics.

## 7. Premium in Legality

### Decision: Premium Legality Must Separate Pool Breadth from Section Qualification

Decision:

- Premium legality should evaluate at least two distinct questions:
- is the canonical card in the broad Premium baseline pool?
- is the canonical card admissible in the section where the snapshot places it?

Rationale:

- Premium is not only about broad card-pool inclusion.
- G deck introduces section qualification that cannot be collapsed into pool breadth.

Practical implication:

- a card may be Premium-eligible in the broad sense and still be invalid in a specific section placement;
- legality findings must preserve that distinction.

## 8. Premium in Gameplay Setup

### Decision: Premium Gameplay Setup Must Derive Runtime Shape From Projections, Not From Era Branching

Decision:

- Gameplay setup for Premium must derive runtime zone and mechanic activation from gameplay-facing format projection plus gameplay-facing card projection.

Rationale:

- Premium runtime behavior is too rich to be assembled safely from raw catalog era labels or page-level assumptions.

Practical implication:

- `rules` should not decide G-zone or Stride support by checking set eras directly;
- the gameplay boundary should receive Premium runtime meaning through published projections only.

## 9. Anti-Patterns

The following are prohibited:

- treating Premium as "allow every card" without section semantics;
- deciding G-deck qualification from product label alone;
- using printing identity to decide cross-era gameplay identity;
- letting legality infer Premium compatibility from UI-era filters;
- letting gameplay derive Premium runtime behavior from raw set codes;
- merging main deck and G deck semantics into one general card list.

## 10. Summary

Premium is now defined more sharply as:

- a broad cross-era format profile;
- a format with explicit separate G-deck semantics;
- a format that relies on canonical card identity and published compatibility-relevant fields;
- a format where broad eligibility, section qualification, legality, and gameplay support remain separate questions.

This removes the main Premium ambiguity from the domain phase:

- Premium is not just "all cards";
- G deck is not just "another list";
- cross-era coexistence does not justify weakening canonical identity or truth boundaries.
