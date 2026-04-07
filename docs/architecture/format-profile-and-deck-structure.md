# Format Profile and Deck-Structure Contract

Status: Initial format contract  
Last updated: 2026-04-07

## Why This Contract Exists

This document defines how the system represents formats and how deck structure is derived from format.

It exists because format is not a cosmetic label in this project. Format affects:

- allowed card pool;
- deck structure;
- deck construction rules;
- legality and restriction handling;
- UI behavior;
- future gameplay-rule differences.

If format is treated as a simple enum or a page-level filter, the likely failure mode is a Standard-shaped system with later exceptions patched in for V Premium and Premium. That would create exactly the problems already identified in the first architecture review:

- hardcoded deck sections in UI;
- legality logic tied to one format's assumptions;
- importer and catalog layers without a clear format contract;
- future rules-engine work inheriting the wrong abstraction.

This contract is intended to be the shared foundation for deck builder, legality, UI, and future gameplay-aware modules.

## What Is a Format Profile

### Decision 1: A Format Profile Is a Structured Domain Contract, Not Just an Enum

Decision:

- A `format profile` is the structured domain object that describes how a format behaves in the system.
- A simple `format key` may still exist as a stable identifier, but it must resolve to a full format profile.

Rationale:

- Format influences too many concerns to be represented safely as a string or enum alone.
- The system needs one place to define deck structure, card-pool basis, legality baseline, and future gameplay hooks.

Practical implication:

- UI, legality, deck builder, and future gameplay modules should consume a format profile or a resolved format-capability contract, not raw `if format == ...` logic.

### Decision 2: Format Profile and Format Support State Must Be Separate

Decision:

- `format profile` defines what the format is.
- `format support state` defines how fully the current system implementation supports it.

Rationale:

- A format can be known conceptually before it is fully supported operationally.
- Collapsing definition and support into one field makes partial support impossible to describe clearly.

Practical implication:

- The system can recognize a format profile for Standard, V Premium, or Premium even when legality, gameplay, or coverage support is incomplete.

### Minimum Format Profile Contents

A format profile should contain at least the following conceptual fields:

| Field                             | Purpose                                                                    |
| --------------------------------- | -------------------------------------------------------------------------- |
| `format_key`                      | stable system identifier                                                   |
| `display_name`                    | user-facing label                                                          |
| `construction_basis`              | nation-based, clan-based, or other explicit basis                          |
| `allowed_card_pool_definition`    | how eligible cards are selected                                            |
| `deck_structure_contract`         | allowed deck sections and their constraints                                |
| `baseline_construction_rules`     | generic deck-construction rules for the format                             |
| `restriction_attachment_policy`   | how restriction lists apply                                                |
| `gameplay_profile_reference`      | abstract reference to gameplay-rule differences, not engine implementation |
| `supported_variants_or_overrides` | explicit exceptional structure or construction cases where needed          |

### Allowed Card Pool Definition

The `allowed_card_pool_definition` should be treated as a structured policy, not as a free-form note.

It may depend on:

- icon or era selectors;
- explicit equivalence mappings;
- explicit inclusions or exclusions;
- format-specific cross-era allowances;
- future release-wave coverage overlays.

This is important because official formats are not always representable as a single era label.

## Supported Formats Overview

### Decision 3: The Current Core Profiles Are Standard, V Premium, and Premium

Decision:

- The project should define three core format profiles:
- `standard`
- `v_premium`
- `premium`

Rationale:

- These are the explicitly planned long-term product formats.
- They differ enough in card-pool basis, deck construction, and future gameplay implications that they must be first-class profiles.

Practical implication:

- New format work should extend this model rather than hardcode exceptions around one default format.

### Decision 4: `Premium` in the Current Contract Means Premium Clan Fight Baseline

Decision:

- In this contract, `premium` should mean the Premium Clan Fight baseline.
- Premium Extreme Fight, if ever supported, should be modeled as a separate format profile or explicit format variant, not as an invisible flag on the same profile.

Rationale:

- Mixed-clan or mixed-nation construction changes deck-construction semantics materially.
- That is too large a difference to hide under one vaguely overloaded `premium` label.

Practical implication:

- The current architecture stays aligned with the planned product scope while remaining extensible if Extreme Fight is ever added later.

### Format Summary

| Format    | Construction Basis  | Card Pool Basis                                                                                                      | Base Deck Structure         | Structural Notes                                                                       |
| --------- | ------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------- |
| Standard  | nation-based        | modern Standard-eligible pool, primarily D-icon cards plus explicit equivalence allowances                           | main deck + ride deck       | ride deck is part of baseline profile; some explicit special cases may alter structure |
| V Premium | clan-based          | V-icon card pool plus explicit format-specific allowances                                                            | main deck only              | no ride deck in baseline                                                               |
| Premium   | clan-based baseline | all English cards sold or distributed, with modern nation cards mapped into clan-based construction where applicable | main deck + optional G deck | no ride deck in baseline; G deck is part of Premium structure                          |

### Standard Profile

Definition:

- Standard is the primary modern format profile.

Architectural view:

- construction is nation-based;
- the card pool is primarily D-era or D-icon aligned, but the profile must allow explicit equivalence tables or official cross-printing allowances;
- the baseline deck structure includes a main deck and a ride deck;
- the profile must remain capable of explicit structure overrides for official special cases.

Why this matters:

- Standard is the highest risk for accidental hardcoding because it is the most likely first implementation target.

### V Premium Profile

Definition:

- V Premium is a clan-based format profile centered on V-icon card usage.

Architectural view:

- construction is clan-based;
- the allowed pool is V-icon based plus explicit format allowances where official rules define them;
- the baseline deck structure is main deck only;
- ride deck behavior is absent from the baseline profile.

Why this matters:

- V Premium proves that "current format" assumptions do not generalize. It keeps the architecture honest by requiring a non-ride-deck format.

### Premium Profile

Definition:

- Premium is a clan-based broad-card-pool format profile with G-zone usage in baseline structure.

Architectural view:

- the allowed pool is broadly all English cards sold or distributed, subject to format-specific construction and restriction rules;
- construction remains clan-based in the current baseline profile;
- modern nation cards may still require format-specific clan correspondence logic;
- the baseline deck structure includes main deck plus G deck, with no ride deck in baseline.

Why this matters:

- Premium is the strongest test of whether the format model is real or only Standard with flags added later.

## Deck Structure Model

### Decision 5: Deck Structure Is Determined by Format Profile

Decision:

- A deck structure is not global.
- It is derived from the format profile.

Rationale:

- Different formats use different deck sections and different constraints.
- The UI must not define what sections a deck has.

Practical implication:

- Deck builder and legality should ask the format profile what deck sections exist and what rules attach to them.

### Deck Structure Contract

A deck structure contract should define, for each supported section:

- section key;
- whether the section is required, optional, or disallowed;
- section-level size constraints;
- section-level card eligibility constraints;
- section-specific construction rules;
- whether the section participates in specific deck-wide rules such as trigger counts or copy limits.

### Main Deck

Definition:

- The primary deck section used for ordinary draw and play.

Policy:

- Main deck is part of all currently planned format profiles.
- Main deck size and card eligibility are format-governed.

Why it matters:

- Main deck is the shared structural baseline across Standard, V Premium, and Premium, but it must still remain format-aware.

### Ride Deck

Definition:

- A separate format-governed section used for ride support in formats that include it.

Policy:

- Ride deck is required in Standard baseline.
- Ride deck is disallowed in V Premium baseline.
- Ride deck is disallowed in Premium baseline.
- The model must still allow explicit profile-level overrides for official Standard special cases.

Why it matters:

- This is the clearest proof that deck structure cannot be hardcoded as "just a main deck."

### G Deck

Definition:

- A separate format-governed section used for G-zone cards in formats that include it.

Policy:

- G deck is available in Premium baseline.
- G deck is disallowed in V Premium baseline.
- G deck is disallowed in Standard baseline unless an explicit profile-level override or supported format variant allows it.

Why it matters:

- G deck cannot be treated as a Premium-only implementation hack; it must be modeled as a deck-section capability controlled by the format profile.

### Decision 6: Deck Sections Must Be First-Class Structural Concepts

Decision:

- `main deck`, `ride deck`, and `G deck` must be represented as explicit structural sections, not as optional UI panels or ad hoc arrays.

Rationale:

- Structure-aware validation and future gameplay compatibility both depend on named sections with stable semantics.

Practical implication:

- Internal deck models, validation routines, and API contracts should refer to section identities explicitly.

## Format-Specific Deck Construction Rules

### Decision 7: Deck Construction Rules and Gameplay Rules Must Stay Separate

Decision:

- Deck construction rules define whether a deck is structurally and legally valid before play.
- Gameplay rules define how cards and actions behave during a match.

Rationale:

- Format affects both, but they are not the same layer.
- Deck builder and legality should not quietly become gameplay systems.

Practical implication:

- Format profile may expose both construction-related fields and gameplay-profile references, but those concerns must remain separate in implementation.

### Construction Responsibilities Driven by Format Profile

Deck-construction logic should use the format profile to validate:

1. card-pool eligibility;
2. construction basis, such as nation-based or clan-based constraints;
3. allowed deck sections;
4. required versus optional sections;
5. size rules for each section;
6. deck-wide copy limits and same-name checks;
7. format-specific special construction rules;
8. attached restriction lists and their effect on legality.

### Decision 8: Construction Basis Is a First-Class Property of the Format

Decision:

- `nation-based` and `clan-based` construction must be modeled as explicit construction-basis policies inside the format profile.

Rationale:

- This difference affects eligibility, validation, UI prompts, importer relationships, and future gameplay assumptions.

Practical implication:

- Do not hide nation-vs-clan logic in validation conditionals spread across multiple modules.

### Decision 9: Restriction Handling Belongs to the Format Profile Baseline

Decision:

- A format profile must define how restriction lists attach to deck validation for that format.

Rationale:

- Restriction lists are not generic global overlays with identical meaning across all formats.
- The legality engine needs a stable way to resolve which restrictions are in scope for a given format.

Practical implication:

- Validation context should resolve format profile first, then load the restriction source appropriate to that profile.

### Decision 10: Deck Structure Variants Must Be Explicit, Not Implicit

Decision:

- If a format has exceptional official construction cases, those must be modeled as explicit profile-level overrides or supported variants.

Rationale:

- Standard already has official exceptions affecting ride deck or G-deck behavior.
- If those are handled as hidden one-offs later, the contract will collapse into special-case logic.

Practical implication:

- The architecture should allow a default format profile plus explicit construction overrides, while keeping the baseline profile readable and stable.

## Format Support States

### Decision 11: Support State Is Capability-Based

Decision:

- The system should track support state by capability, not only by one coarse boolean.

Recommended capability dimensions:

- catalog awareness;
- card-pool resolution;
- deck-structure support;
- deck-building support;
- legality support;
- gameplay support.

Rationale:

- A format may be known and structurally modeled before full legality or gameplay support exists.

Practical implication:

- UI, API, and deck builder can communicate useful partial support instead of pretending the format is either fully done or nonexistent.

### Support State Definitions

#### Supported

Definition:

- The system provides dependable behavior for the requested capability and declared coverage scope of that format.

Practical implication:

- Users may create, edit, and validate decks with trusted results for the supported scope.

#### Partially Supported

Definition:

- The format profile is known and some capabilities are implemented, but at least one requested capability or part of the declared scope is incomplete.

Practical implication:

- The system must communicate exactly what is and is not supported.
- Partial support must not silently degrade into false legality certainty.

#### Unsupported

Definition:

- The system does not provide a dependable contract for the requested capability of that format.

Practical implication:

- The system should refuse to present authoritative deck-building or legality behavior for that capability.

### Decision 12: Support State Must Be Visible in UI, Deck Builder, Legality, and API

Decision:

- Support state is not an internal note only. It must be observable wherever format behavior is surfaced.

Rationale:

- Hidden partial support destroys user trust and makes debugging harder.

Practical implication:

- UI should show clear support messaging.
- Deck builder should restrict or warn based on capability support.
- Legality should return unsupported or partial-support outcomes explicitly.
- API responses should distinguish unsupported from invalid.

### Expected System Behavior by Support State

| State               | UI                               | Deck Builder                                                        | Legality                                                | API                                    |
| ------------------- | -------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------- |
| Supported           | full normal flow                 | creation and editing enabled                                        | authoritative within declared scope                     | normal success with supported context  |
| Partially supported | clear warnings and scope markers | allow only supported functions; disable or warn on unsupported ones | return partial or unsupported status, not false invalid | explicit support metadata in responses |
| Unsupported         | no authoritative workflow        | disable creation or keep read-only import view only                 | no legality assertion                                   | explicit unsupported response          |

## Boundaries and Responsibilities

### Decision 13: Certain Layers Must Depend on Format Profile Directly

Decision:

- The following system areas should depend directly on the format profile:
- deck builder;
- legality and validation;
- format-aware UI composition;
- future gameplay engine entry points;
- catalog filtering where format eligibility is shown.

Rationale:

- These layers need structured format behavior, not guessed behavior.

Practical implication:

- If one of these modules is branching on hardcoded format names instead of using the profile contract, it is probably in the wrong shape.

### Decision 14: Certain Layers Must Not Redefine Format Logic

Decision:

- The following areas must not own format behavior as local duplicated logic:
- React components;
- canonical card identity;
- printing identity;
- collection ownership records;
- raw importer source records.

Rationale:

- These layers may consume format-related outputs, but they should not become the place where format semantics are defined.

Practical implication:

- Importer may classify content for format relevance, but it should not become the primary home of deck-structure or legality rules.

### Decision 15: Avoid Standard-as-Default Architecture

Decision:

- No module should assume Standard deck structure or nation-based construction as the default hidden model.

Rationale:

- Standard is likely to be implemented first, which makes it the easiest place for accidental hardcoding.

Practical implication:

- If a module cannot represent V Premium cleanly, it is not format-ready yet.
- If a module cannot represent Premium G-deck behavior without major branching, the abstraction is too weak.

## Rules Engine Compatibility

### Decision 16: Future Rules Engine Should Accept Format Profile as an Input Contract

Decision:

- A future rules engine should receive a resolved format profile, or a gameplay-focused projection of it, as an input contract.

Rationale:

- Gameplay differences by format are real, but they should be supplied through a formal profile rather than hidden global assumptions.

Practical implication:

- Rules-engine code should not discover the format indirectly from UI choices or deck section guesses.

### Decision 17: Deck Structure and Gameplay Phase Logic Must Stay Separate

Decision:

- Deck structure is a pre-game construction concern.
- Turn, phase, action, and effect behavior are runtime gameplay concerns.

Rationale:

- Both may vary by format, but they are not the same kind of variability.

Practical implication:

- Do not embed gameplay sequencing assumptions into deck-builder or legality modules just because they share the same format profile.

### Decision 18: Gameplay Differences in Format Profile Should Remain Abstract at This Stage

Decision:

- The format profile should include a reference to gameplay-rule differences, but not a premature full engine implementation.

Rationale:

- The architecture needs a place for future variation.
- The project does not need a full gameplay system yet.

Practical implication:

- Keep gameplay differences represented as bounded hooks or profile references until phase-appropriate engine work begins.

## Examples

### Example 1: Standard Deck with Ride Deck

- The user selects `standard`.
- The format profile resolves to nation-based construction with a required `main_deck` and required `ride_deck`.
- The deck builder renders both sections because the profile says they exist.
- Validation checks nation consistency, main-deck rules, ride-deck rules, trigger-related baseline constraints, and applicable restrictions.
- The deck is valid only if both required sections satisfy the Standard profile contract.

### Example 2: Premium Deck with G Deck

- The user selects `premium`.
- The format profile resolves to clan-based construction with a required `main_deck` and available `g_deck`, but no ride deck.
- The deck builder exposes G-deck handling because the profile allows it.
- Legality validates the main deck and G-deck structure separately under Premium rules and restrictions.

### Example 3: Wrong Structural Attempt

- A user starts a V Premium deck and tries to add a ride deck section.
- The format profile says ride deck is disallowed.
- The UI should not silently accept it.
- Deck validation should return a structural invalid result, not a generic gameplay error.

### Example 4: Partially Supported Format Capability

- The system has a Premium format profile and can represent main deck plus G deck structure.
- Card-pool support is present, but legality support for part of the current restriction logic is incomplete.
- The format support state for deck building may be `supported`, while legality may be `partially_supported`.
- The deck builder can still operate, but legality results must be marked partial or unsupported for the incomplete area.

### Example 5: Unsupported Format

- A future format or unsupported Premium variant is recognized as a concept the team may support later, but no dependable implementation exists.
- The system should not pretend to validate decks for it.
- UI should label the format unsupported.
- API should return unsupported capability state rather than invalid-deck semantics.

## Final Recommendations

### Recommendation 1: Adopt `format profile` as the Core Format Contract

Recommendation:

- Use a stable `format key` that resolves to a structured profile object.

Rationale:

- This keeps format extensible without losing identity stability.

### Recommendation 2: Derive Deck Structure Strictly from Format Profile

Recommendation:

- Deck sections must be defined by format profile, never by UI assumptions.

Rationale:

- This is the cleanest way to keep deck builder, legality, and future gameplay aligned.

### Recommendation 3: Treat Support State as a Separate Capability Layer

Recommendation:

- Format definition and format implementation status must remain separate.

Rationale:

- This allows partial support without lying to the user or distorting the model.

### Recommendation 4: Treat Premium as the Stress Test

Recommendation:

- Evaluate every new format abstraction against Premium.

Rationale:

- If the model only works cleanly for Standard, it is not a real format model.

### Recommendation 5: Add New Formats by Extending Profiles, Not Forking Systems

Recommendation:

- New formats should add or override structured profile fields rather than create new isolated deck and legality stacks.

Rationale:

- The architecture should become broader without becoming fragmented.

## Open Questions / Future Extensions

The following remain intentionally open:

- the exact policy for future support of Premium Extreme Fight or other format variants;
- the exact model for official special-case construction overrides inside Standard;
- the eventual gameplay-profile representation used by the rules engine;
- the exact validation-result shape for partial support, which should be finalized together with the legality validation-context document;
- whether future product needs justify richer format-family hierarchies beyond the current three core profiles.

These are legitimate next-step decisions, but they should be made on top of the contract above rather than by weakening it.
