# Format Model

Status: Initial domain format model  
Last updated: 2026-04-07

## 1. Overview

This document defines the domain model of `format` for the Cardfight!! Vanguard web client / companion platform.

It exists because format is a first-class game-system concept in this project. It affects:

- how decks are constructed;
- which deck sections exist;
- which product families form the baseline card pool;
- which mechanics are format-native;
- how legality interprets admissibility;
- how gameplay runtime selects its format-facing projection.

This document is not a rules engine specification and not a legality result specification. It defines the stable domain meaning of a format so that `decks`, `legality`, and `rules` can depend on the same concept without duplicating it.

## 2. Why Formats Are Not Enums

### Decision: `Format` Is a Rule Profile, Not a Label

Decision:

- A format must be modeled as a structured profile.
- A stable format key may still exist, but it is only an identifier that resolves to a profile.

Rationale:

- Standard, V Premium, and Premium differ in deck structure, construction basis, eligible product lineage, and gameplay-facing mechanics.
- Those differences are too large to represent safely as `if format === 'STANDARD'`.

Practical implication:

- The system may still use stable IDs such as `standard`, `v-premium`, or `premium`, but all real behavior must come from a resolved `FormatProfile`.

### Why Enum Thinking Fails

An enum-shaped format model leads to predictable failures:

- deck builder hardcodes Standard assumptions;
- legality duplicates format rules in ad hoc conditionals;
- gameplay invents a second hidden format model;
- support for future formats becomes a branching problem instead of a profile-extension problem.

The domain therefore needs `format key -> format profile`, not `format enum -> scattered switch statements`.

## 3. FormatProfile Definition

### Decision: `FormatProfile` Is the Canonical Format Model

Decision:

- `FormatProfile` is the main domain object that describes what a format means in the system.

Rationale:

- It gives one place to express deck structure baseline, product eligibility baseline, format-native capabilities, and restriction compatibility.
- It keeps format meaning stable while letting consumers derive local projections.

Practical implication:

- `decks` should consume the profile for structure guidance.
- `legality` should consume the profile as baseline input.
- `rules` should consume a gameplay-facing projection derived from the profile, not the raw profile deep inside runtime logic.

### Minimum Shape of a FormatProfile

A format profile should include at least:

- `id`
  - stable format identity
- `displayName`
  - human-readable label
- `constructionBasis`
  - how deck identity is constrained at baseline, such as nation-based or clan-based
- `productEligibility`
  - which product families are in scope and by what baseline policy
- `deckStructure`
  - which sections exist and what section rules apply
- `constructionRules`
  - baseline duplicate-counting and trigger-counting rules that belong to the format itself
- `capabilities`
  - which format-native mechanics and structural capabilities exist
- `restrictionCompatibility`
  - how the format attaches to restriction modeling

### Decision: Support State Is Adjacent to FormatProfile, Not Embedded in It

Decision:

- `FormatProfile` defines what a format is.
- Support state defines what the current system can do with that format.

Rationale:

- A format may be fully known conceptually before gameplay or legality support is complete.
- Blending definition and support turns the model into implementation status instead of domain meaning.

Practical implication:

- Keep format meaning stable.
- Publish support status separately through the capability-support model.

## 4. Capabilities Model

### Decision: Format Capabilities Describe Format-Native Possibilities, Not System Support

Decision:

- `format capabilities` in the format model mean format-native features and mechanics.
- They do not mean whether the current implementation fully supports them.

Rationale:

- "Standard has a ride deck" is part of format meaning.
- "Gameplay for Standard is partially supported" is a support-state concern.

Practical implication:

- The format model should express what the format permits or requires.
- The capability-support publication model should express what the system currently supports.

### Capability Categories

At the current domain level, format capabilities should cover at least:

- structural capabilities
  - `supportsRideDeck`
  - `supportsGDeck`
- gameplay-facing mechanic capabilities
  - `supportsStride`
  - `supportsImaginaryGift`
  - `supportsOverDress`
- a compact set of gameplay markers for downstream projections

These capabilities are not full rules. They are profile-level declarations about what the format includes or permits as part of its baseline.

### Capability Model Rule

Capability should answer:

- what kinds of sections, mechanics, or format-native features are part of this format

Capability should not answer:

- whether a specific deck is legal
- whether the current system implementation fully supports the feature
- how a runtime effect is executed step by step

## 5. Deck Structure Rules

### Decision: Deck Structure Is a Format Concern

Decision:

- Deck structure rules belong inside `FormatProfile`.

Rationale:

- Main deck, ride deck, and G deck are not universal facts.
- Their existence and constraints depend on the format.

Practical implication:

- `decks` must derive deck sections from the profile, not from UI assumptions.
- `legality` must validate against the same structure baseline.

### Deck Structure Contents

The profile-level deck structure contract should define:

- which sections exist
- whether each section is required or optional
- minimum and maximum size for each section
- section-level card qualification constraints when needed
  - for example grade or card-type restrictions
- baseline construction constraints that are not simple section size limits
  - for example duplicate-counting scope or trigger ceilings in the main deck

### Examples of Structure Meaning

- Standard
  - main deck plus ride deck in baseline structure
- V Premium
  - main deck only in baseline structure
- Premium
  - main deck plus G deck in baseline structure

### Boundary Rule

Deck structure is not:

- a React concern
- a deck persistence quirk
- a legality-only concern

It is part of format meaning and must be readable from the profile itself.

## 6. Product Eligibility

### Decision: Product Eligibility Is a Baseline Format Concern

Decision:

- A format profile must define its baseline product eligibility policy.

Rationale:

- Format meaning is partly about which release lineage is in scope before restrictions are applied.
- That baseline should be stable and explicit.

Practical implication:

- `FormatProfile` should reference supported product families and the baseline eligibility basis used to interpret them.

### What Product Eligibility Means

Product eligibility should answer:

- which product families are within the format's baseline scope
- whether the scope is strict family membership, family membership with explicit overrides, or a broader pool model

Product eligibility should not answer:

- whether a specific deck list passes all legality checks
- whether a specific card is restricted, banned, or limited

Those remain legality concerns.

### Relationship to Restriction Lists

Product eligibility and restriction lists are separate:

- product eligibility
  - defines the baseline pool that may be considered by the format
- restriction lists
  - define additional legality constraints inside that baseline

This separation is necessary because "allowed in the format's baseline pool" and "currently legal in this format" are not the same question.

## 7. Standard / V Premium / Premium Profiles

### Standard Profile

Standard should be modeled as a profile with:

- nation-based construction baseline
- product eligibility based on Standard-era families and explicit official allowances where needed
- main deck plus ride deck structure
- no G deck in baseline structure
- format-native support for OverDress-era mechanics and ride-deck behavior

### V Premium Profile

V Premium should be modeled as a profile with:

- clan-based construction baseline
- product eligibility centered on V-era families and explicit official allowances where needed
- main deck only in baseline structure
- no ride deck
- no G deck
- format-native handling for Imaginary Gift era behavior where relevant

### Premium Profile

Premium should be modeled as a profile with:

- clan-based baseline construction in the current contract
- broad product eligibility across Premium-relevant card pool lineage
- main deck plus G deck structure
- no ride deck in baseline structure
- format-native support for Stride and broad cross-era interaction

### Decision: These Are Profile Instances, Not Enum Members

Decision:

- Standard, V Premium, and Premium should be treated as canonical profile instances.

Rationale:

- Their behavior comes from structured profile fields, not from hardcoded names.

Practical implication:

- Adding a new format means adding a new profile definition, not extending switch statements around a format enum.

## 8. Format vs Legality

### Decision: Format Defines the Frame, Legality Evaluates Within the Frame

Decision:

- `FormatProfile` and `LegalityResult` are separate domain concepts.

Rationale:

- Format answers what the format means.
- Legality answers whether a given deck satisfies the format and its restrictions.

Practical implication:

- A deck may be invalid under a correctly resolved format profile.
- The profile itself does not carry invalidity, warnings, or evaluation findings.

### Format Owns Baseline Meaning

Format profile should define:

- construction basis
- product eligibility baseline
- deck structure baseline
- format-native capabilities
- restriction compatibility baseline

Legality should define:

- validation request semantics
- restriction interpretation
- validation context
- legality issues and results

## 9. Format Usage Across the System

### Decks

`decks` should use `FormatProfile` for:

- selecting and attaching a format to a deck version
- determining which sections exist
- guiding structure-aware editor behavior

`decks` must not:

- hardcode Standard as the default hidden model
- invent local structure semantics

### Legality

`legality` should use `FormatProfile` for:

- resolving the validation baseline
- selecting deck-structure rules
- selecting restriction compatibility baseline
- interpreting product eligibility baseline

`legality` must not:

- collapse format meaning into legality results
- treat restriction overlays as if they were the format itself

### Rules / Gameplay

`rules` should not consume format as raw ad hoc strings.

Instead it should receive:

- a gameplay-facing format projection derived from the canonical profile

That projection may narrow the profile into runtime-relevant facts such as:

- active sections and corresponding zones
- active mechanic markers
- runtime setup-relevant format switches

### Web / App

`web` may consume the profile for presentation and orchestration, but it must not become the place where format rules are defined or patched.

## 10. Extension Model

### Decision: The Model Must Support New and Custom Formats Without Forking the System

Decision:

- The format system must remain profile-based so that future official formats, event-specific variants, or custom formats can be added without redesigning decks, legality, or gameplay boundaries.

Rationale:

- Cardfight!! Vanguard format evolution is not hypothetical.
- A rigid enum model becomes a maintenance trap as soon as a materially different format arrives.

Practical implication:

- New formats should enter as new profiles or explicit profile variants.
- Consumers should continue to depend on the same profile contract.

### Extension Rules

- prefer adding new profile instances over patching consumer logic
- prefer additive fields over changing old field meaning
- keep support-state publication separate from format definition
- treat event-specific overrides as explicit profile variants, not page-local hacks
- if a new format materially changes construction basis or structure semantics, model it as a distinct profile

### Anti-Patterns to Avoid

- `enum FormatType { Standard, VPremium, Premium }`
- string-switch logic spread across decks, legality, and rules
- ride deck or G deck logic hardcoded in UI
- product eligibility mixed directly into restriction lists
- format profile used as a legality result surrogate
- runtime gameplay logic encoded directly into the canonical format profile

## Summary

The format model of this project is built around a single core rule:

- format is a profile, not an enum

That profile carries:

- identity
- human-readable label
- construction basis
- product eligibility baseline
- deck structure rules
- format-native capabilities
- restriction compatibility baseline

System support remains adjacent and separate.

This allows:

- `decks` to stay structure-aware without hardcoding one format
- `legality` to validate against a canonical baseline
- `rules` to consume a projection instead of inventing format logic
- future official or custom formats to extend the system without architecture drift
