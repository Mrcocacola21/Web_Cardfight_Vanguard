# Legality Model

Status: Initial legality domain model  
Last updated: 2026-04-07

## 1. Overview

This document defines the domain model of `legality` for the Cardfight!! Vanguard platform.

It exists to make one thing explicit:

- legality is the system that determines whether a deck is admissible for a declared format and restriction baseline

It is not:

- a gameplay rules engine
- a card catalog
- a UI concern

Legality operates on:

- `DeckSnapshot`
- `FormatProfile`
- legality-owned restriction and validation context contracts

and produces:

- `LegalityResult`

## 2. What Legality Is (and Is Not)

### Decision: Legality Is Pre-Game Admissibility Validation

Decision:

- Legality checks whether a deck is admissible under a declared format profile and restriction baseline before gameplay begins.

Rationale:

- Deck validity must be decided from deck structure, format baseline, eligible card pool, and restriction rules.
- That is a different concern from runtime gameplay behavior.

Practical implication:

- `legality` evaluates admissibility.
- `rules` evaluates actions, effects, timing, and state transitions during play.

### What Legality Is Not

Legality does not:

- execute effects
- simulate phases or turns
- determine whether an in-match action is legal
- resolve effect timing
- substitute for gameplay state validation

If a question depends on runtime state, it belongs to gameplay truth, not legality truth.

## 3. Input Model

### Decision: Legality Works on Snapshot + Profile, Not Mutable Deck State

Decision:

- The canonical legality input is a `DeckSnapshot` evaluated under a resolved `FormatProfile` inside a legality-owned `ValidationContext`.

Rationale:

- Snapshot is stable, explicit, and cross-context safe.
- Mutable builder state and storage internals are not.

Practical implication:

- `decks` publishes the deck snapshot.
- `legality` resolves evaluation semantics and restriction baseline.

### Input Components

The legality input model consists of:

- `DeckSnapshot`
  - explicit format-bound deck representation
- `FormatProfile`
  - canonical format baseline
- `ValidationContext`
  - legality-owned evaluation context, including support matrix and restriction list

### Boundary Rule

Legality input must not be:

- UI draft state
- persistence rows
- raw catalog entities with no deck snapshot boundary
- printing-first deck data

## 4. Format Eligibility

### Decision: Format Eligibility Is the First Legality Gate

Decision:

- The first legality question is whether the deck's referenced canonical cards belong to the format's baseline eligible pool.

Rationale:

- A deck cannot be legal if its cards are outside the format's card-pool baseline before any restriction overlay is considered.

Practical implication:

- Format eligibility must be evaluated before restriction detail and before final legality assertion.

### Format Eligibility Inputs

Format eligibility is based on:

- canonical `Card` identity
- product-family lineage and related catalog metadata where needed
- the `FormatProfile` product-eligibility policy

Examples:

- Standard
  - baseline eligibility limited to Standard-relevant product lineage
- V Premium
  - baseline eligibility built from V-lineage policy and any official extensions recognized by the profile
- Premium
  - broadest baseline eligibility profile

### Card vs Printing in Eligibility

Format eligibility is evaluated against canonical card identity, not printing identity.

Printing metadata may help the catalog and importer derive lineage, but legality must not treat each printing as a separate legality target by default.

## 5. Restriction System

### Decision: Restriction Validation Is a First-Class Legality Subsystem

Decision:

- Restriction validation is part of legality, not an afterthought layered beside it.

Rationale:

- Restrictions change what is admissible in a format.
- They are part of pre-game deck validation.

Practical implication:

- Restriction checks must be modeled explicitly in legality contracts and results.

### RestrictionList

`RestrictionList` is:

- the versioned set of restriction rules applicable to a format baseline

It should carry at least:

- `formatId`
- `version`
- a set of structured `RestrictionRule` items

### RestrictionRule

A `RestrictionRule` is a legality-owned rule that applies to canonical card identity or an explicit choice group.

Restriction rules should not target printing identity by default.

## 6. Restriction Types

### Decision: Copy Restrictions Must Be Explicit

Decision:

- The legality model must represent the common restriction families directly.

Rationale:

- Banned, limited, and semi-limited are not the same thing.
- They drive different user feedback and validation logic.

Practical implication:

- Restriction modeling should not reduce everything to free-form text.

### Required Restriction Types

The baseline restriction model should support:

- `unrestricted`
  - no special copy restriction beyond normal deck rules
- `banned`
  - zero copies allowed
- `limited`
  - one copy allowed
- `semi-limited`
  - two copies allowed
- `maximum-copies`
  - explicit copy ceiling when the limit is not one of the baseline named cases

These restrictions apply to canonical `Card` identity.

### Application Rule

Restriction counting is done against canonical card identity inside the deck snapshot, not by counting printings.

That prevents the same gameplay card from bypassing restrictions through mixed printings.

## 7. Choice Restrictions

### Decision: Choice Restrictions Must Be Modeled Separately From Simple Copy Limits

Decision:

- Choice restrictions are a distinct legality rule family and must not be flattened into ordinary copy limits.

Rationale:

- "Choose one of these cards or card groups" is not the same as "this card has a maximum copy count."

Practical implication:

- The restriction model should have an explicit `choice` rule shape.

### Choice Restriction Meaning

A choice restriction should express at least:

- the set of canonical cards participating in the restriction
- the number of allowed selections from that set

Typical interpretation:

- if the deck contains more selected members of the group than the allowed choice count, the deck is illegal

### Example

If a rule says:

- choose one of `Card X` or `Card Y`

the legality system must reject decks that contain both when only one option is allowed by the choice group.

### Boundary Rule

Choice restriction remains a legality concept.

It does not require gameplay simulation and does not belong in deck UI logic.

## 8. Validation Stages

### Decision: Legality Validation Must Be Staged

Decision:

- Legality validation should be modeled as distinct evaluation stages, not one undifferentiated pass/fail step.

Rationale:

- Different failures belong to different rule families.
- Support and partial-evaluation messaging depend on knowing what was checked.

Practical implication:

- Results should preserve which stages were evaluated and where problems occurred.

### Required Stages

The baseline legality stages are:

1. `format eligibility`
   - are the referenced canonical cards in the format's baseline pool?
2. `restriction validation`
   - do restriction-list rules allow this deck composition?
3. `deck structure validation`
   - does the deck match the format's structural contract?

These stages are enough for an initial legality model without collapsing into gameplay logic.

## 9. LegalityResult

### Decision: LegalityResult Is a Structured Outcome, Not a Boolean

Decision:

- `LegalityResult` must express an explicit legality status plus detailed issues and evaluation completeness.

Rationale:

- The system must distinguish invalidity, unsupported validation, and partial support honestly.

Practical implication:

- UI and future APIs should consume structured results.

### Baseline Result Shape

At minimum, `LegalityResult` should contain:

- `status`
  - `valid`
  - `invalid`
  - `unsupported`
  - `partially_supported`
- `formatId`
- `target`
- `complete`
- `checkedStages`
- `issues`
- `unresolvedChecks`

### Result Semantics

- `valid`
  - all required checks in scope passed
- `invalid`
  - at least one authoritative legality rule failed
- `unsupported`
  - the system cannot provide dependable legality validation for the requested scope
- `partially_supported`
  - some checks were performed, but the full requested legality scope is not completely supported or evaluated

## 10. LegalityIssue

### Decision: Issues Must Point to Meaningful Rule Failures

Decision:

- `LegalityIssue` must capture the nature of a legality problem in a structured way.

Rationale:

- Deck builder feedback, tests, and future API consumers need explainable findings, not only a final summary status.

Practical implication:

- Issues should carry a stable kind, message, and optional references such as card, section, or rule reference.

### Typical Issue Categories

The baseline legality issue categories should include:

- `format-eligibility`
  - card outside format baseline pool
- `restriction`
  - banned, limited, semi-limited, maximum-copy, or choice-restriction failure
- `copy-limit`
  - deck contains too many copies of a canonical card
- `deck-structure`
  - invalid section, invalid size, or missing required section
- `support`
  - requested legality scope is unsupported or incomplete
- `input`
  - malformed or incomplete validation input

### Example Findings

- banned card present
- too many copies of a limited card
- choice restriction violated
- card not eligible for selected format
- ride deck present in a format that disallows it

## 11. Unsupported / Partial

### Decision: Unsupported and Partial Are Not Invalid

Decision:

- `unsupported` and `partially_supported` must remain distinct from `invalid`.

Rationale:

- Unsupported is a platform capability statement.
- Partial support is an incomplete-evaluation statement.
- Invalid is a rule-failure statement.

Practical implication:

- The system must not mark a deck invalid merely because the relevant legality capability is missing.

### Unsupported

Use `unsupported` when:

- the relevant legality capability does not exist for the requested format or target
- the platform cannot provide a dependable legality answer

### Partially Supported

Use `partially_supported` when:

- some legality stages ran
- but one or more required checks remain unresolved or outside supported coverage

### Known Failure With Partial Evaluation

If a known authoritative failure exists and evaluation is still incomplete overall, the final modeling choice may still be `invalid`, with unresolved checks preserved separately.

That keeps known invalidity visible without pretending evaluation was complete.

## 12. Summary

The legality model of this project is built around these rules:

- legality validates admissibility, not gameplay behavior
- legality consumes `DeckSnapshot + FormatProfile + ValidationContext`
- format eligibility comes before restriction overlay
- restrictions apply to canonical `Card`, not `CardPrinting`
- choice restrictions are explicit legality rules, not hidden UI logic
- legality evaluation is staged
- legality results are structured and support-aware

This keeps legality:

- separate from gameplay truth
- separate from raw catalog truth
- reusable across deck builder, future APIs, and future gameplay-entry validation

It should be treated as the canonical pre-game deck admissibility model for the platform.
