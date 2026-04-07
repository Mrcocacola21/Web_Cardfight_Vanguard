# Bounded Contexts and Dependency Directions

Status: Context map note  
Last updated: 2026-04-07

## Why This Document Exists

This document defines the high-level bounded contexts for the project and the allowed dependency directions between them.

It exists because the platform is already large enough to fail from boundary mistakes before it fails from missing features. Cardfight!! Vanguard puts pressure on the architecture from several directions at once:

- multiple formats with different construction and gameplay implications;
- large and growing card content across sets, promos, and product families;
- separate legality, catalog, and gameplay concerns;
- importer and normalization complexity;
- user-owned objects such as decks, profiles, and shared artifacts.

Without bounded contexts, the project will drift toward a single oversized application layer where:

- UI components become accidental domain owners;
- legality logic gets duplicated inside deck flows;
- gameplay logic leaks into React and page orchestration;
- importer assumptions leak into catalog, legality, or rules;
- every new feature reaches across the whole codebase.

This note is related to the earlier truth-boundaries note, but it is not the same thing.

- `truth layers` describe different kinds of domain truth: catalog, legality, and gameplay.
- `bounded contexts` describe the high-level module and ownership boundaries that should implement and consume those truths.

One bounded context may own one truth layer directly, or consume projections from another context. The important rule is that consumption does not equal ownership.

### Decision 1: Use Bounded Contexts as Explicit Architectural Boundaries

Decision:

- The platform should be organized around explicit bounded contexts, not around one generic app layer or page-by-page feature folders.

Rationale:

- This project must survive growth in content, rules, and user-facing features.
- Explicit context boundaries reduce hidden coupling and make future monorepo packaging more predictable.

Practical implication:

- New modules should be introduced under a context boundary first, not as free-floating utilities or page-local logic.

## Proposed Bounded Contexts

### Decision 2: Use Seven High-Level Bounded Contexts in the Current Architecture Model

Decision:

- The current recommended bounded contexts are:
- `catalog`
- `decks`
- `legality`
- `rules`
- `importer`
- `social`
- `web app`

Rationale:

- These contexts align with the major problem spaces already identified in product scope, domain glossary, and engineering principles.
- They separate content, user-owned deck workflows, admissibility, runtime gameplay, ingestion, social relationships, and delivery composition.

Practical implication:

- The future monorepo may express these contexts through packages or modules, but the boundary decisions should exist even before the folder structure is finalized.

### Context Overview

| Context    | Primary Responsibility                                        | Primary Truth or Capability          |
| ---------- | ------------------------------------------------------------- | ------------------------------------ |
| `catalog`  | normalized card and product content                           | catalog truth                        |
| `decks`    | user-owned deck objects and deck workflows                    | deck storage and deck lifecycle      |
| `legality` | admissibility under format and restriction contracts          | legality truth                       |
| `rules`    | runtime gameplay state and action logic                       | gameplay truth                       |
| `importer` | raw source ingestion and normalization workflow               | ingestion and provenance flow        |
| `social`   | profiles, relationships, sharing, privacy-facing social rules | user relationship and sharing domain |
| `web app`  | UI composition and delivery                                   | composition layer, not domain truth  |

### Catalog

Purpose:

- Own the normalized description of cards, printings, products, and searchable content metadata.

Inside this context:

- canonical card identity;
- printing identity;
- product, set, and product-family data;
- catalog-oriented card metadata;
- search and browse read models;
- provenance-aware normalized content records.

What does not belong here:

- restriction ownership;
- deck legality results;
- runtime gameplay rules;
- raw importer workflow state as if it were permanent catalog truth.

### Decks

Purpose:

- Own deck objects as user-facing domain artifacts and support deck creation, storage, editing, versioning, and retrieval workflows.

Inside this context:

- deck identity;
- deck composition references;
- deck versions and saved revisions;
- deck metadata such as title, notes, author ownership, and timestamps;
- user-owned deck workflows.

What does not belong here:

- authoritative legality rules;
- runtime gameplay rules;
- full catalog duplication;
- friend-relationship rules or broader social graph logic.

### Legality

Purpose:

- Own deck and card admissibility evaluation under declared format profiles, restriction baselines, and validation scope.

Inside this context:

- format-aware deck validation;
- restriction interpretation;
- structure and copy-limit checks;
- same-name or same-card checks;
- legality result construction;
- support-state-aware validation outcomes.

What does not belong here:

- catalog ingestion ownership;
- runtime action legality;
- gameplay state transitions;
- UI-local messaging logic as the source of legal meaning.

### Rules

Purpose:

- Own runtime gameplay state, actions, effects, events, and state transitions.

Inside this context:

- game state and player state;
- zones, phases, and turns;
- action validation;
- effect handling and resolution;
- event log and gameplay snapshots;
- format adapters or gameplay-profile interpretation.

What does not belong here:

- deck legality evaluation;
- catalog search and printing presentation concerns;
- React-driven state ownership;
- raw importer records and normalization decisions.

### Importer

Purpose:

- Own raw source ingestion, normalization workflow, source mapping, manual review, and provenance preservation.

Inside this context:

- source adapters and raw source records;
- normalization pipeline;
- deduplication and matching flow;
- manual review queue;
- source provenance and mapping history.

What does not belong here:

- authoritative deck legality policy;
- runtime gameplay semantics;
- web-page presentation ownership;
- direct ownership of published catalog meaning after normalization is completed.

### Social

Purpose:

- Own profiles, user-to-user relationships, privacy-facing social concerns, and sharing-oriented application behavior.

Inside this context:

- profiles;
- friend requests and friendship relations;
- social visibility and audience rules;
- shared-deck references or social publishing metadata;
- user-facing privacy decisions for social surfaces.

What does not belong here:

- deck composition ownership;
- legality policy;
- gameplay engine behavior;
- importer or catalog normalization logic.

### Web App

Purpose:

- Act as the delivery, orchestration, and composition layer for user interfaces.

Inside this context:

- route and page composition;
- presentation state;
- data-fetch orchestration;
- interaction wiring;
- composition of read models from multiple contexts.

What does not belong here:

- source-of-truth ownership for catalog, legality, or gameplay;
- rules encoded in React because a page needs them quickly;
- cross-context policy logic that should live in domain modules.

## Context Ownership Boundaries

### Decision 3: Each Context Must Have Explicit Ownership, Read Rights, and Non-Ownership Rules

Decision:

- Each context must be defined not only by what it does, but also by what it owns, what it reads, and what it must not redefine locally.

Rationale:

- Many architectural problems start when a module is allowed to read another context and then quietly starts reinterpreting it as if it owned it.

Practical implication:

- Consumption boundaries should be explicit in docs, contracts, and future package dependencies.

| Context    | What It Owns                                                                             | What It May Read                                                                 | What It Must Not Own                                                         | What It Must Not Redefine Locally                                    |
| ---------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `catalog`  | canonical cards, printings, products, catalog metadata, catalog read models              | normalized importer outputs through explicit ingestion contracts                 | restriction policy, legality results, runtime rules                          | legality status, gameplay semantics                                  |
| `decks`    | deck ids, deck versions, deck composition, deck metadata, author-owned deck workflows    | catalog card references and display projections, legality results by contract    | legality rules, runtime game state, social graph                             | card identity semantics, legality interpretation                     |
| `legality` | validation context, restriction interpretation, admissibility findings, legality results | canonical card identity, format profile, relevant deck snapshot input            | raw ingestion flow, runtime effect handling, UI-owned truth                  | catalog meaning, gameplay action rules                               |
| `rules`    | game state, runtime actions, effects, events, state transitions                          | canonical gameplay-relevant identity, format gameplay inputs, match entry inputs | legality verdict ownership, full printing catalog concerns, UI orchestration | deck legality meaning, catalog provenance                            |
| `importer` | raw source records, normalization workflow, source mappings, manual review, provenance   | external source data and catalog ingestion contracts                             | legality policy, runtime rules, deck workflows                               | canonical catalog meaning after publication, gameplay interpretation |
| `social`   | profiles, relationships, audience rules, sharing metadata                                | deck summaries or shared-deck references, public-facing profile data             | deck composition, legality engine behavior, gameplay engine behavior         | deck legality, gameplay support status                               |
| `web app`  | page composition, interaction wiring, presentation state                                 | read models and service interfaces from all relevant contexts                    | domain truth ownership                                                       | format rules, legality conclusions, gameplay logic                   |

## Recommended Dependency Directions

### Decision 4: Dependency Direction Must Be Deliberate, Not Opportunistic

Decision:

- Dependency direction between contexts should be explicitly constrained.

Rationale:

- "It was convenient here" is how circular dependency and hidden coupling start.

Practical implication:

- If a new feature seems to require a forbidden dependency, that is usually a sign that an interface, projection, or orchestration boundary is missing.

### Recommended Direction Summary

In the list below, `A -> B` means `A` may depend on `B` through a stable context-facing contract.

- `importer -> catalog`
- `decks -> catalog`
- `decks -> legality`
- `legality -> catalog`
- `rules -> catalog`
- `social -> decks`
- `web app -> catalog`
- `web app -> decks`
- `web app -> legality`
- `web app -> rules`
- `web app -> social`

These are the intentionally discouraged or contract-only relationships:

- `rules` and `legality` should not directly depend on each other in core domain code;
- `decks` should not depend on `social` for its core deck model;
- `social` should consume shared-deck references or read models, not deck internals;
- `catalog` should not depend on raw importer internals once ingestion boundaries are defined.

These should be treated as prohibited:

- `catalog -> legality`
- `catalog -> rules`
- `catalog -> web app`
- `legality -> importer`
- `legality -> web app`
- `legality -> rules`
- `rules -> web app`
- `rules -> importer`
- `rules -> social`
- `decks -> rules`
- `decks -> importer`
- `social -> legality` for core social behavior
- any lower context -> `web app`

### Decision 5: Legality and Rules Should Share Upstream Contracts, Not Depend on Each Other

Decision:

- `legality` and `rules` should be modeled as peer contexts that consume some common upstream inputs, rather than one context embedding the other.

Rationale:

- They both care about cards and formats, but they answer different questions and evolve at different times.

Practical implication:

- Shared inputs such as canonical card identity or format profile should be exposed through explicit contracts.
- Runtime rules should not read legality verdicts as a proxy for gameplay truth.

### Decision 6: Web App Is the Main Composition Layer and Must Remain One-Way

Decision:

- The web app may depend on multiple contexts for page composition, but no domain context may depend on the web app.

Rationale:

- The web app is a delivery layer, not a domain owner.

Practical implication:

- When a page needs domain behavior, the behavior should move into the relevant context rather than being solved locally inside the page.

### Dependency Guidance by Context

`catalog`

- May depend on stable ingestion contracts and infrastructure.
- Must not depend on decks, legality, rules, social, or web app.

`decks`

- May depend on catalog read models and legality service contracts.
- Must not depend on rules for core deck editing or storage.
- Must not depend on importer internals.

`legality`

- May depend on canonical card identity and format-relevant catalog facts.
- Should consume deck snapshots through explicit contracts rather than decks persistence internals.
- Must not depend on rules, importer internals, social, or web app.

`rules`

- May depend on curated gameplay-relevant card facts and format gameplay inputs.
- Should receive match-entry inputs through explicit contracts, not reach into deck or legality internals.
- Must not depend on React, web app, importer internals, or social.

`importer`

- May depend on external source adapters and catalog ingestion contracts.
- Must not depend on legality or rules to decide normalization outcomes.

`social`

- May depend on deck references, shared-deck read models, and profile-related contracts.
- Must not depend on rules engine behavior or own legality decisions.

`web app`

- May depend on all published context-facing APIs or read models needed for composition.
- Must not be depended on by lower contexts.

## Context Interaction Notes

### Catalog + Importer

Why interaction exists:

- The importer needs to bring external source data into normalized catalog objects.

Safe direction:

- `importer -> catalog` through ingestion and normalization contracts.

Main risk:

- Letting raw source shape leak into catalog meaning, or letting catalog depend on importer workflow state.

### Decks + Legality

Why interaction exists:

- Deck flows need admissibility feedback for the chosen format.

Safe direction:

- `decks -> legality` through a validation request and structured legality result.

Main risk:

- Duplicating legality rules inside deck editing logic, or making legality depend on deck persistence internals.

### Decks + Catalog

Why interaction exists:

- Decks reference cards and need card summaries, search, and display metadata.

Safe direction:

- `decks -> catalog` through canonical card references and catalog read models.

Main risk:

- Copying catalog metadata into deck storage or redefining card identity inside deck code.

### Rules + Legality

Why interaction exists:

- Both contexts care about formats and cards, and match-entry flows may want both legality and gameplay support checks.

Safe direction:

- No direct core dependency by default.
- Compose them at the application layer or through explicit shared upstream contracts.

Main risk:

- Merging pre-game admissibility with runtime action validation into one oversized rules module.

### Rules + Catalog

Why interaction exists:

- Gameplay logic needs canonical gameplay-relevant card identity and selected card facts.

Safe direction:

- `rules -> catalog` through curated gameplay inputs, not full catalog projections.

Main risk:

- Pulling printing, product, search, or importer concerns into runtime rules.

### Social + Decks

Why interaction exists:

- Social surfaces need to reference decks that users share or publish.

Safe direction:

- `social -> decks` through deck references, shared-deck summaries, or publication read models.

Main risk:

- Social starting to own deck composition, or deck context starting to own friendship and audience logic.

### Web App + All Contexts

Why interaction exists:

- Pages and flows need to compose data from multiple contexts.

Safe direction:

- `web app` reads context-facing APIs, read models, and service boundaries.

Main risk:

- The web app becoming the place where business rules are truly implemented because it sees everything.

## Anti-Patterns to Avoid

### Decision 7: Explicitly Reject Context-Breaking Shortcuts

Decision:

- The following anti-patterns should be treated as architecture violations, not as harmless shortcuts.

Rationale:

- This project will accumulate hidden debt quickly if the team treats boundary violations as temporary conveniences.

Practical implication:

- When these patterns appear in reviews, the correct response is redesign, not normalization.

Anti-patterns:

- legality logic duplicated inside deck-builder UI flows;
- rules logic leaking into React components;
- importer deciding gameplay semantics or restriction outcomes;
- catalog becoming a dumping ground for legality flags and restriction conclusions;
- web app owning business rules because it already composes the page;
- social depending directly on gameplay engine internals;
- circular dependencies between decks, legality, and rules;
- one giant shared `utils` or `domain` blob that erases context ownership;
- lower-level contexts reaching through another context into its storage instead of using a published contract;
- deck storage persisting full copied card records instead of stable references.

## Allowed Integration Styles

### Decision 8: Integrate Through Published Contracts, Not Reach-Through Access

Decision:

- Context integration should happen through explicit published contracts, stable read models, or application-layer composition.

Rationale:

- Clean boundaries require explicit integration seams.

Practical implication:

- If a context needs another context's data, it should consume a contract that context intentionally publishes.

Recommended integration styles:

- explicit service interfaces for operations such as legality validation;
- published read models for display or cross-context lookup;
- shared types only for stable domain contracts such as canonical card identity, deck snapshot input, or legality result shape;
- application-layer composition in the web app for multi-context pages;
- events or revalidation triggers only where the trigger does not transfer ownership of the receiving context's policy.

Integration styles to avoid:

- importing deep internal models from another context because they are "already there";
- ad-hoc cross-module queries directly against another context's storage;
- broad shared type packages that become a second hidden monolith;
- forcing one context to understand another context's workflow state when a narrower read model would do.

## Examples

### Example 1: Deck Builder Uses Catalog and Legality Without Owning Either

- The deck builder page lets the user search cards, add them to a deck, and view validation feedback.
- `catalog` supplies card search and card display data.
- `decks` owns the saved deck and deck version being edited.
- `legality` returns a structured validation result for the current format.
- `web app` composes the page.
- No page component owns card identity rules or legality rules.

### Example 2: Importer Adds a New Set Without Redefining Legality

- A new set is ingested from an external source.
- `importer` normalizes raw records and maps them into catalog-facing contracts.
- `catalog` publishes new canonical cards and printings.
- `legality` may later validate decks against updated card coverage, but importer does not decide whether those cards are legal.

### Example 3: Gameplay Engine Uses Gameplay-Relevant Card Facts Only

- A future match room starts a gameplay session for a deck.
- `rules` consumes canonical card identity and gameplay-relevant facts.
- It does not pull full printing history, search metadata, or raw importer records into runtime state logic.

### Example 4: Social Displays a Shared Deck Without Owning Deck Logic

- A user views a friend's shared deck.
- `social` determines whether the viewer can see the deck.
- `decks` supplies the deck summary or deck read model.
- `catalog` may supply card display projections.
- `social` does not evaluate gameplay support or deck legality itself.

### Example 5: Web App Composes a Multi-Context Page

- A deck details page shows the deck list, selected format, legality summary, and linked card previews.
- `web app` orchestrates data from `decks`, `legality`, and `catalog`.
- The page remains a composition layer.
- Format rules, card identity, and legality assertions remain inside their owning contexts.

## Final Recommended Context Map

### Decision 9: Proceed with a Context Map That Is Strict Enough to Prevent Early Drift

Decision:

- The recommended context map for the next phase is:
- `importer -> catalog`
- `decks -> catalog`
- `decks -> legality`
- `legality -> catalog`
- `rules -> catalog`
- `social -> decks`
- `web app -> catalog | decks | legality | rules | social`

Rationale:

- This map gives the project clean upstream dependencies while keeping legality and gameplay separated, importer isolated, and the web app in a composition-only role.

Practical implication:

- Work can safely proceed on monorepo and module planning with these boundaries as the default.
- Any new dependency direction should be treated as an explicit architecture decision, not a local convenience.

### Safe to Proceed With

- treating `catalog`, `decks`, `legality`, `rules`, `importer`, `social`, and `web app` as the primary architecture slices;
- designing published contracts for deck snapshots, legality results, and curated card read models;
- keeping `legality` and `rules` separate while allowing them to share upstream format and card contracts;
- using the web app as composition and delivery only.

### Follow-Up Detail Still Needed

- exact package or module boundaries inside the future monorepo;
- which shared contracts deserve their own stable package rather than living inside one context;
- whether social publishing of decks should use a dedicated publication read model or a direct deck-summary contract;
- how match-entry orchestration should pass deck data into future gameplay modules;
- how revalidation or reindex triggers should flow after importer and catalog changes.

## Open Questions for Later Architecture Work

- the exact contract shape for deck snapshot input shared with legality and future gameplay;
- the exact curated gameplay-read-model exported to the rules context;
- the final strategy for published read models versus service calls between contexts;
- the minimal stable shared-contract surface needed to avoid both duplication and a giant shared-core package;
- whether additional contexts will be needed later for collection, match history, or tournament tooling as the product expands.
