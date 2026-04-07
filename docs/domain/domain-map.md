# Domain Map

Status: Initial domain map  
Last updated: 2026-04-07

## 1. Overview

This document defines the high-level domain map for the Cardfight!! Vanguard web client / companion platform.

It is not a code model, a database schema, or a runtime specification. It is the implementation-ready domain reference that connects:

- bounded contexts;
- core domain entities;
- ownership boundaries;
- source-of-truth layers;
- cross-context relationships;
- format, deck, legality, and gameplay boundaries.

This domain map assumes and preserves the contracts already fixed in the architecture documents:

- canonical card identity over printing identity for gameplay, decks, and legality;
- format profile as a structured contract, not an enum;
- deck snapshot as the cross-context deck input;
- legality as a separate truth layer from catalog and gameplay;
- gameplay-facing projections as derived inputs for the rules context.

## 2. Bounded Contexts

### Catalog

Responsibility:

- Own normalized card and product content.
- Publish canonical card identity, printing identity, and catalog read models.
- Publish gameplay-facing card projection for gameplay consumers.

Owns:

- canonical cards;
- card printings;
- products and product families;
- card attributes and catalog metadata;
- catalog truth.

Must not:

- own legality outcomes;
- own restriction interpretation;
- own runtime gameplay state or effect execution;
- own importer workflow state after publication.

### Importer

Responsibility:

- Own ingestion workflow from external sources into publication-ready normalized content.

Owns:

- raw source records;
- parsing and normalization workflow;
- source mappings;
- ambiguity handling;
- manual review state;
- provenance.

Must not:

- own canonical catalog truth after publication;
- own legality policy;
- own gameplay semantics.

### Decks

Responsibility:

- Own user-facing deck objects and deck lifecycle.

Owns:

- deck identity;
- deck versions;
- deck metadata;
- format attachment for deck versions;
- deck snapshot publication;
- deck structure as stored deck content.

Must not:

- own legality rules or legality results;
- own runtime gameplay state;
- own catalog truth.

### Legality

Responsibility:

- Own admissibility under format and restriction contracts.

Owns:

- format profile as canonical published cross-context format contract;
- legality rules;
- restriction interpretation;
- validation context;
- legality validation request semantics;
- legality result;
- legality truth.

Must not:

- own deck persistence;
- own catalog ingestion;
- own gameplay runtime behavior.

### Rules

Responsibility:

- Own runtime gameplay interpretation and state transitions.

Owns:

- gameplay-facing format projection;
- runtime format adapters;
- gameplay state;
- actions, phases, zones, and events;
- effect handlers and resolution logic;
- gameplay truth.

Must not:

- own canonical catalog data;
- own legality results;
- depend on full catalog internals or UI state.

### Social

Responsibility:

- Own user relationship, profile, match-history, and sharing concerns.

Owns:

- user profile;
- friendship and visibility relationships;
- shared-deck references;
- match and match-result records at product level;
- social-facing permissions.

Must not:

- own deck composition;
- own legality;
- own gameplay engine behavior.

### Web / App

Responsibility:

- Compose and deliver UI.

Owns:

- routes;
- pages;
- presentation composition;
- app-level orchestration.

Must not:

- become source of truth for catalog, legality, or gameplay;
- redefine format rules or domain meaning in React.

## 3. Core Entities

### Catalog Context

#### Canonical Card

Definition:

- The primary normalized gameplay-level identity for a card in the system.

Role:

- authoritative card identity for decks, legality, and gameplay references;
- grouping parent for printings;
- primary catalog card object.

#### Card Printing

Definition:

- A release-specific printing of a canonical card.

Role:

- stores release identity, product membership, set code, card number, rarity, locale, and other printing-specific facts.

#### Product

Definition:

- A product-level release container such as booster, trial deck, promo release, or other official product grouping.

Role:

- groups printings by release origin.

#### Product Family

Definition:

- A higher-level product lineage grouping used to describe release families and broad product eras.

Role:

- supports catalog organization and format/product mapping.

#### Card Attributes

Definition:

- Normalized gameplay-relevant descriptive fields attached to a canonical card.

Examples:

- grade;
- power;
- critical;
- shield;
- nation;
- clan;
- race;
- card type;
- trigger classification;
- keywords;
- printed text as catalog data.

### Format Domain

This domain is canonically owned through `legality`, not through a standalone format context.

#### Format

Definition:

- A stable named playable format recognized by the system, such as Standard, V Premium, or Premium.

Role:

- stable identity and selection handle.

#### Format Profile

Definition:

- The structured cross-context contract that defines what a format means.

Role:

- deck-structure baseline;
- construction basis;
- card-pool basis;
- restriction attachment baseline;
- gameplay-relevant high-level markers.

#### Format Capability

Definition:

- A scoped support claim about what the system currently supports for a format or format-related behavior.

Examples:

- deck building support for Standard;
- legality validation for Premium;
- runtime gameplay support for a mechanic family.

Role:

- communicates support state without redefining format meaning.

### Legality Context

#### Restriction List

Definition:

- A structured set of admissibility restrictions attached to a format and rule baseline.

Role:

- banned, limited, restricted-count, choice, or combination restrictions.

#### Legality Rule

Definition:

- A rule family or rule unit used by legality evaluation.

Examples:

- deck structure checks;
- card-pool eligibility checks;
- copy-limit checks;
- same-name checks;
- restriction checks;
- format-specific construction checks.

#### Validation Context

Definition:

- The complete context in which legality is evaluated.

Includes conceptually:

- validation target;
- deck snapshot;
- resolved format profile;
- capability scope;
- applicable restriction baseline;
- evaluation scope.

#### Legality Validation Request

Definition:

- The explicit input contract sent to legality.

Role:

- invokes legality with stable semantics independent of UI or persistence.

#### Legality Result

Definition:

- The structured output of legality evaluation.

Role:

- carries assertion status, support status, completeness, findings, warnings, and unresolved checks.

### Decks Context

#### Deck

Definition:

- A user-owned deck aggregate representing a deck concept within the product.

Role:

- holds title, ownership, metadata, and variant lineage.

#### Deck Version

Definition:

- A concrete saved revision of a deck.

Role:

- immutable or versioned saved state for one format-bound deck.

#### Deck Snapshot

Definition:

- The minimal, stable, cross-context representation of a format-bound deck.

Role:

- legality input;
- future gameplay setup input;
- cross-context deck contract.

#### Deck Entry

Definition:

- A section-bound card reference with count inside a deck representation.

Role:

- references canonical card identity, not printing identity, by default.

#### Deck Structure

Definition:

- The format-bound section structure of a deck.

Examples:

- main deck;
- ride deck;
- G deck.

Role:

- explicit section model for stored deck content and deck snapshot.

### Rules / Gameplay Context

#### Gameplay Card Projection

Definition:

- The gameplay-facing catalog projection published by catalog for rules consumers.

Role:

- supplies gameplay-relevant card facts without exposing full catalog internals.

#### Gameplay Format Projection

Definition:

- The runtime-oriented format projection owned by rules and derived from the canonical format profile.

Role:

- supplies runtime-relevant format meaning without exposing raw format profile into engine internals.

#### Effect Definition

Definition:

- A gameplay-facing effect descriptor or reference derived from catalog facts and consumed by gameplay systems.

Role:

- links card identity to gameplay-meaningful effect descriptors.

#### Effect Handler

Definition:

- A runtime rules object or behavior unit that executes an effect in game state.

Role:

- gameplay-owned runtime interpretation and execution logic.

#### Match State

Definition:

- The runtime state of a single match instance.

Includes conceptually:

- players;
- deck-derived runtime zones;
- turn and phase state;
- events;
- active effects;
- choices and pending resolutions.

### Social / Matches Context

#### User

Definition:

- A platform user identity in the product domain.

Role:

- ownership and social relationships.

#### Friend Relation

Definition:

- A user-to-user relationship record used for social features and visibility.

#### Match

Definition:

- A product-level match record or match-room level entity representing one play session or recorded result.

Role:

- social and match-tool identity, not gameplay engine state itself.

#### Match Entry

Definition:

- A participant entry into a match context.

Role:

- links user, deck or submitted deck reference, and match role.

#### Match Result

Definition:

- The outcome of a completed match at product level.

Role:

- winner/loser/draw and related reporting data.

## 4. Ownership

### Ownership Summary

| Entity or Contract          | Owner                                                             | Typical Readers                           | Typical Transforming Consumers                        |
| --------------------------- | ----------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------- |
| canonical card              | catalog                                                           | decks, legality, rules, web               | legality, rules through published projections         |
| card printing               | catalog                                                           | web, future collection, importer review   | catalog read models                                   |
| product                     | catalog                                                           | web, importer, catalog consumers          | catalog read models                                   |
| product family              | catalog                                                           | catalog, legality, web                    | catalog and legality mappings                         |
| card attributes             | catalog                                                           | legality, rules, web                      | gameplay-facing card projection                       |
| format                      | legality                                                          | decks, rules, web                         | format profile resolution                             |
| format profile              | legality                                                          | decks, rules, web                         | gameplay-facing format projection                     |
| format capability           | owning context per capability                                     | web, decks, legality, rules               | support-aware UX or validation/runtime gating         |
| restriction list            | legality                                                          | legality                                  | legality evaluation                                   |
| legality rule               | legality                                                          | legality                                  | legality evaluation                                   |
| validation context          | legality                                                          | legality, API/application orchestration   | legality execution                                    |
| legality validation request | legality semantics                                                | decks, web, API                           | legality                                              |
| legality result             | legality                                                          | decks, web, future sharing or match-entry | UI messaging, deck feedback                           |
| deck                        | decks                                                             | web, social                               | deck versioning and snapshot assembly                 |
| deck version                | decks                                                             | web, social, legality via snapshot        | snapshot assembly                                     |
| deck snapshot               | decks                                                             | legality, rules, web                      | legality request creation, gameplay setup preparation |
| deck entry                  | decks                                                             | legality, rules via snapshot              | snapshot publication                                  |
| deck structure              | decks (stored representation), meaning governed by format profile | legality, web, rules                      | legality and gameplay setup                           |
| gameplay card projection    | catalog                                                           | rules                                     | gameplay runtime setup                                |
| gameplay format projection  | rules                                                             | rules runtime components                  | gameplay setup                                        |
| effect definition           | catalog-derived / rules-consumed                                  | rules                                     | effect handler resolution                             |
| effect handler              | rules                                                             | rules                                     | runtime action/effect execution                       |
| match state                 | rules                                                             | match room UI                             | gameplay engine                                       |
| user                        | social                                                            | web, decks, matches                       | social workflows                                      |
| friend relation             | social                                                            | social, web                               | privacy and sharing rules                             |
| match                       | social                                                            | web, match tools                          | social/match workflows                                |
| match entry                 | social                                                            | match tools, future gameplay entry        | match creation flows                                  |
| match result                | social                                                            | web, social, analytics later              | match completion flows                                |

### Ownership Rule

Reading does not imply ownership.

If one context consumes another context's contract, it may transform it into a local derived model for its own work, but it does not redefine the canonical meaning of that upstream entity.

## 5. Relationships

### Catalog Relationships

- `Canonical Card -> Card Printing`
  - one canonical card has many printings
- `Card Printing -> Product`
  - one printing belongs to one product release context
- `Product -> Product Family`
  - many products belong to one product family
- `Canonical Card -> Card Attributes`
  - canonical card carries normalized gameplay-relevant descriptive fields

### Deck Relationships

- `Deck -> Deck Version`
  - one deck has many versions over time
- `Deck Version -> Format`
  - every persisted deck version has exactly one attached format key
- `Deck Version -> Deck Structure`
  - a version stores content in explicit format-bound sections
- `Deck Snapshot -> Deck Entry`
  - a snapshot contains sectioned entries
- `Deck Entry -> Canonical Card`
  - deck entries reference canonical card identity, not printing identity

### Legality Relationships

- `Legality Validation Request -> Deck Snapshot`
  - legality consumes a published deck snapshot
- `Legality Validation Request -> Format Profile`
  - legality resolves or confirms the canonical format contract
- `Validation Context -> Restriction List`
  - legality evaluates restrictions in context
- `Validation Context -> Legality Rule`
  - legality executes named rule families
- `Legality Result -> Validation Context`
  - legality result is always contextual, never abstract

### Gameplay Relationships

- `Rules -> Gameplay Card Projection`
  - gameplay consumes catalog-published gameplay facts
- `Rules -> Gameplay Format Projection`
  - runtime systems consume rules-owned runtime format projection
- `Gameplay Format Projection <- Format Profile`
  - gameplay format projection is derived from canonical format meaning
- `Match State <- Deck Snapshot + Gameplay Card Projection + Gameplay Format Projection`
  - gameplay setup derives runtime state from those inputs
- `Effect Handler <- Effect Definition`
  - runtime behavior is linked to gameplay-facing effect meaning, not full catalog records

### Social Relationships

- `User -> Deck`
  - users own or publish decks through deck references
- `User -> Friend Relation -> User`
  - social graph relationships
- `Match -> Match Entry -> User`
  - product-level match participation
- `Match -> Match Result`
  - outcome data for completed matches

### Key Modeling Decision: Deck References Canonical Card, Not Printing

Decision:

- Deck entries and deck snapshots reference canonical card identity by default.

Rationale:

- deck construction;
- legality checks;
- gameplay setup;
- same-name and copy-limit semantics

all depend on gameplay identity, not release-specific printing identity.

Practical implication:

- printing remains catalog and future collection concern;
- deck display may later carry preferred-printing metadata outside the authoritative gameplay reference.

## 6. Truth Boundaries

### Catalog Truth

Question answered:

- What is this card or content object in the system?

Includes:

- canonical cards;
- printings;
- products;
- product families;
- normalized card text and attributes;
- provenance-linked published catalog data.

Consumers:

- decks for card selection and references;
- legality for admissibility inputs;
- rules through gameplay-facing projection;
- web for search and display.

### Legality Truth

Question answered:

- Is this deck or card admissible under the declared format and known rule baseline?

Includes:

- format profile;
- restriction interpretation;
- validation context;
- legality rules;
- legality validation request semantics;
- legality result.

Consumers:

- decks for validation feedback;
- web for user messaging;
- future match-entry flows for pre-game admissibility checks.

### Gameplay Truth

Question answered:

- What is allowed to happen in the current runtime match state?

Includes:

- runtime format meaning;
- gameplay card meaning;
- actions, zones, phases, and effect execution;
- runtime state transitions.

Consumers:

- match room;
- gameplay tooling;
- replay or match analytics later.

### Boundary Rule

- Catalog truth does not imply legality truth.
- Legality truth does not imply gameplay truth.
- Gameplay truth does not redefine catalog truth.

## 7. Format/Product System

### Format System

The platform currently recognizes three core formats:

- Standard
- V Premium
- Premium

The canonical meaning of each format is expressed through `Format Profile`, not through page-local logic or enums alone.

Format profile covers:

- construction basis;
- deck structure baseline;
- card-pool basis;
- restriction attachment baseline;
- high-level gameplay markers.

### Product System

The product side of the domain is orthogonal to format but related to it.

Product system consists of:

- product family;
- product;
- printing;
- canonical card.

Product families describe broad release lineage and help interpret how catalog content relates to format and content growth. They do not replace format profile.

### How Cards Reach Formats

The domain model should think of format eligibility as a legality concern built from:

- canonical card identity and attributes from catalog;
- product and lineage metadata where relevant for allowed-pool interpretation;
- format profile card-pool basis;
- restriction overlays.

Important boundary:

- products and printings belong to catalog truth;
- "this card is legal in this format" belongs to legality truth.

## 8. Legality Model

### Legality Flow

At domain level, legality works as:

1. `decks` publishes a `Deck Snapshot`
2. a `Legality Validation Request` is formed
3. `legality` resolves the `Format Profile`
4. `legality` resolves applicable `Restriction List` and rule baseline
5. `legality` evaluates the snapshot inside a `Validation Context`
6. `legality` returns a structured `Legality Result`

### Legality Inputs

- deck snapshot;
- format key / resolved format profile;
- validation request semantics;
- restriction baseline;
- support capability context.

### Legality Outputs

- legality result with:
  - assertion status;
  - support status;
  - evaluation completeness;
  - findings;
  - unresolved checks;
  - warnings.

### Legality Boundary Rule

Legality does not:

- simulate matches;
- evaluate runtime action legality;
- own deck persistence;
- own raw catalog ingestion or full catalog browse concerns.

## 9. Deck Model

### Deck Model Summary

The deck model consists of:

- deck;
- deck version;
- explicit format attachment;
- explicit sectioned structure;
- deck snapshot as shared contract.

### Deck Snapshot vs Stored Deck

`Deck Version` is deck-owned persistent meaning.

`Deck Snapshot` is the published cross-context representation derived from that deck-owned state.

They are related but not identical:

- deck version may carry ownership, notes, lineage, and other deck-owned metadata;
- deck snapshot strips that down to the minimum needed by legality and gameplay-adjacent consumers.

### Deck Structure Boundary

Deck sections are explicit:

- main deck;
- ride deck;
- G deck;
- future format-defined sections if added later.

Their meaning is governed by the attached format profile, not by UI assumptions.

### Deck and Format Attachment

Every persisted deck version belongs to exactly one format at a time.

Cross-format equivalents should be modeled as separate variants rather than as one mutable multi-format deck object.

## 10. Gameplay Boundary

### Gameplay Input Surface

Gameplay should consume:

- deck snapshot from `decks`;
- gameplay-facing card projection from `catalog`;
- gameplay-facing format projection from `rules`, derived from legality-owned format profile.

This is the intended gameplay-ready input surface.

### Gameplay Must Not Know

The gameplay layer must not depend on:

- raw importer records;
- full catalog entities and printing history by default;
- legality results as substitutes for runtime rules;
- UI composition logic;
- deck editor state or persistence rows.

### Gameplay Boundary Rule

Gameplay owns runtime behavior only after setup begins.

It does not own:

- canonical card publication;
- format profile publication;
- deck snapshot publication;
- legality assertions.

## 11. Summary

The domain map of this platform is built around a small set of core decisions:

- `catalog` owns card and product truth;
- `legality` owns admissibility and canonical format meaning;
- `decks` owns user deck objects and publishes deck snapshots;
- `rules` owns runtime gameplay truth and runtime-specific projections;
- `importer` owns ingestion and normalization workflow;
- `social` owns users, relationships, and match-level product records;
- `web` composes but does not own domain truth.

The most important cross-context relationships are:

- canonical card, not printing, is the default gameplay identity;
- format profile governs deck structure and legality baseline;
- deck snapshot is the cross-context deck input;
- gameplay-facing projections are derived read models, not sources of truth;
- catalog truth, legality truth, and gameplay truth remain separate even when they share upstream identifiers.

This domain map is intended to be the implementation reference for the next phase of package-level domain work.
