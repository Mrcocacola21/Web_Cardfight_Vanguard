# Deck Construction Model

Status: Initial deck construction domain model  
Last updated: 2026-04-07

## 1. Overview

This document defines the domain model of `deck construction` for the Cardfight!! Vanguard platform.

It exists to make one boundary explicit:

- deck construction defines how a deck is composed

It does not:

- execute gameplay
- simulate ride sequences or effects
- belong to UI state
- belong to importer workflow

Deck construction is the shared structural baseline used by:

- `decks`
  - to model and version deck composition
- `legality`
  - to validate that a deck snapshot respects format-defined construction rules

## 2. Deck Entity

### Decision: `Deck` Is an Aggregate Bound to a Format Profile

Decision:

- `Deck` is a bounded aggregate owned by `decks`.
- Every deck version is attached to one resolved `FormatProfile`.

Rationale:

- Deck construction rules are format-dependent.
- A deck without format attachment has incomplete construction meaning.

Practical implication:

- `Deck` owns authoring identity and version history.
- `DeckSnapshot` is the immutable, format-bound representation used outside the `decks` context.

### Deck, Version, and Snapshot

At the domain level:

- `Deck`
  - the persistent aggregate root for user-owned deck history
- `DeckVersion`
  - one authored revision of the deck under a declared format
- `DeckSnapshot`
  - the immutable sectioned representation published for validation and other downstream consumers

`DeckSnapshot` must contain:

- `deckId`
- `formatId`
- sectioned deck entries
- a completeness marker
- a revision marker

It must not become:

- mutable editor state
- UI-local form state
- legality result storage

## 3. Deck Zones

### Decision: Deck Zones Are First-Class Sections

Decision:

- Deck construction is modeled as explicit sections, not one merged list of cards.

Rationale:

- Main deck, ride deck, and G deck have different meaning and different rules.
- Section boundaries matter for counting, validation, and future gameplay setup.

Practical implication:

- A deck snapshot must preserve section identity.
- Format profiles must declare which sections exist.

### Section Set

The baseline construction model recognizes:

- `main`
  - the primary playable deck section
- `ride`
  - a dedicated ride sequence section for formats that support it
- `g`
  - a dedicated G deck section for formats that support it

## 4. Zone Rules

### Decision: Section Rules Are Independent but Composable

Decision:

- Each section has its own existence, size, and qualification rules.
- Overall deck validity may depend on the combined result of multiple section checks.

Rationale:

- Section-local rules are not interchangeable.
- A valid main deck does not make an invalid ride deck or G deck acceptable.

Practical implication:

- Validation must evaluate sections separately and then combine results.
- UI should not flatten sections into a generic list and guess later.

### Section Rule Categories

For each section, the format model must be able to express:

- whether the section exists
- whether it is required or optional
- minimum and maximum size
- section-level card qualification constraints
  - for example allowed grades or card-type families

## 5. Deck Size Rules

### Decision: Deck Size Is Format-Defined, Not Globally Hardcoded

Decision:

- Deck size rules come from `FormatProfile`.

Rationale:

- Official formats differ in section presence and section size.
- Future custom or event formats must not require rewriting `decks` or `legality`.

Practical implication:

- `decks` reads size expectations from the format profile.
- `legality` validates the snapshot against the same size baseline.

### Current Official Baseline

For the currently modeled official profiles:

- Standard
  - main deck fixed at 50 cards
  - ride deck fixed at 4 cards
  - no G deck
- V Premium
  - main deck fixed at 50 cards
  - no ride deck
  - no G deck
- Premium
  - main deck fixed at 50 cards
  - no ride deck
  - G deck allowed up to 16 cards

These numbers belong to the profile instances, not to global switch statements.

## 6. Trigger Rules

### Decision: Trigger Rules Are Construction Rules, Not Gameplay Rules

Decision:

- Trigger composition is part of deck construction.

Rationale:

- Trigger limits constrain admissible deck composition before a match begins.
- They do not require runtime effect execution.

Practical implication:

- Trigger counting belongs to construction and legality, not to `rules`.

### Trigger Counting Baseline

Trigger rules are evaluated:

- on canonical `Card` identity
- in the `main` deck section
- by trigger classification published by catalog truth

For the current official baseline used by this project:

- main deck may contain up to 16 trigger cards
- critical triggers may appear up to 8 times
- heal triggers may appear up to 4 times
- over triggers may appear up to 1 time
- draw, front, and stand triggers are limited only by the remaining trigger quota unless a profile variant says otherwise

These are construction constraints. Restriction lists may still tighten card-specific copies separately.

## 7. Duplicate Rules

### Decision: Duplicate Counting Uses Canonical Card Identity

Decision:

- Baseline duplicate limits count canonical `CardId`, not `CardPrintingId`.

Rationale:

- Different printings of the same gameplay card must not bypass deck-construction limits.

Practical implication:

- Four mixed printings of the same card still count as four copies of one card.

### Baseline Duplicate Rule

The baseline duplicate rule for official profiles is:

- a deck may contain up to 4 copies of the same canonical card within the counting scope declared by the format profile

Counting scope is format-defined:

- Standard
  - duplicate counting applies across `main + ride`
- V Premium
  - duplicate counting applies across `main`
- Premium
  - duplicate counting applies across `main`
  - G deck remains section-specific and is not merged into main-deck copy counting by default

Card-specific exceptions do not belong in the baseline construction rule. They belong in legality restriction lists.

## 8. Ride Deck Rules

### Decision: Ride Deck Is a Distinct Construction Section

Decision:

- Ride deck is a dedicated section when the format profile declares it.

Rationale:

- Ride deck presence materially changes deck construction and gameplay setup.
- It cannot be modeled as hidden metadata on the main deck.

Practical implication:

- Ride deck must be a named section in the snapshot and profile.

### Standard Baseline Ride Deck

For the current Standard profile baseline:

- ride deck is required
- ride deck size is fixed at 4 cards
- ride deck cards are counted outside main deck size
- ride deck cards are still counted by canonical identity for duplicate limits when the format profile says the duplicate-counting scope includes `ride`
- ride deck composition follows a dedicated grade progression baseline, currently one card each for grades 0, 1, 2, and 3

Ride deck rules remain construction rules. They do not require gameplay simulation.

## 9. G Deck Rules

### Decision: G Deck Is a Separate Premium Construction Section

Decision:

- G deck is a separate section that exists only in formats that declare it.

Rationale:

- Premium construction includes card space outside the main deck.
- That space has its own size and qualification constraints.

Practical implication:

- G deck must not be merged into main deck structure or duplicate counting by default.

### Premium Baseline G Deck

For the current Premium profile baseline:

- G deck is available as a separate section
- G deck may contain up to 16 cards
- G deck cards must satisfy G-deck-specific qualification rules declared by the format profile
- G deck validity is evaluated independently from main deck validity, then combined into overall deck validity

This model intentionally avoids encoding G-deck gameplay behavior. It only defines construction shape.

## 10. Format-Specific Rules

### Standard

Standard construction baseline uses:

- `main` and `ride`
- nation-based construction basis
- fixed-size ride deck
- no G deck
- trigger rules on main deck
- duplicate counting across main and ride

### V Premium

V Premium construction baseline uses:

- `main` only
- clan-based construction basis
- no ride deck
- no G deck
- trigger rules on main deck
- duplicate counting in main deck only

### Premium

Premium construction baseline uses:

- `main` and `g`
- clan-based construction basis in the current contract
- no ride deck
- G deck up to 16
- trigger rules on main deck
- duplicate counting in main deck only unless an explicit profile variant says otherwise

### Decision: Format Differences Live in Profiles, Not in UI Branching

Decision:

- Standard, V Premium, and Premium differ through profile data, not scattered `if` statements.

Practical implication:

- New official or custom formats should be introduced as profile instances or explicit variants.

## 11. Counting Strategy

### Decision: Counting Is Canonical and Scope-Based

Decision:

- All deck-construction counts use canonical `CardId`.
- Every rule declares or implies its counting scope.

Rationale:

- Construction rules must stay stable across printings.
- Different rule families count different sections.

Practical implication:

- section size counts
  - count entries and copies inside one explicit section
- trigger counts
  - count canonical trigger cards in `main`
- duplicate counts
  - count canonical cards across the sections defined by the format profile

### Counting Must Not Use Printing Identity

The system must not:

- count `CardPrintingId`
- count rarity variants as separate copies
- treat alternate art as a second gameplay card for construction purposes

## 12. Validation Boundaries

### Decision: Construction Defines the Rules, Legality Checks Them

Decision:

- Deck construction model defines the rule frame.
- Legality evaluates whether a snapshot satisfies that frame.

Rationale:

- The model must separate rule definition from validation outcome.

Practical implication:

- `decks`
  - owns deck authoring, versions, and snapshots
- `FormatProfile`
  - owns construction baseline
- `legality`
  - validates snapshot against format structure, duplicate constraints, trigger constraints, and restriction overlays
- `rules`
  - remains downstream and does not own pre-game construction semantics

## 13. Edge Cases

### Card-Specific Exceptions

If a specific card has a copy rule other than the baseline duplicate rule:

- do not patch the deck model locally
- model it as a legality restriction

### Future Rule Changes

If official construction rules change:

- introduce a new profile variant or revised profile publication
- do not hardcode one-off exceptions in the builder or UI

### Custom Formats

Custom or event formats may:

- remove sections
- add sections
- change duplicate scope
- change trigger ceilings

They should still be represented as profile-based construction definitions, not page-local hacks.

### Premium Qualification Detail

Premium G deck qualification still needs a sharper card-taxonomy contract when real Premium implementation starts.

That is a catalog and format-model refinement problem, not a reason to collapse G deck into the main deck model.

## 14. Summary

The deck construction model of this project is built around these rules:

- `Deck` is a format-bound aggregate with immutable published snapshots
- deck sections are first-class
- main, ride, and G are separate zones with separate rules
- deck size, duplicate limits, and trigger limits come from the format profile baseline
- counting uses canonical `CardId`, never printing identity
- legality validates construction; gameplay does not own it

This keeps deck builder and legality aligned on the same construction meaning without mixing in gameplay logic or UI-specific assumptions.
