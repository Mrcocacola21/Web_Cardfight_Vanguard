# Cardfight!! Vanguard Web Client Scope Definition for V1

Status: Initial v1 scope definition  
Last updated: 2026-04-07

## Purpose of This Scope Definition

This document defines the intended scope of the first releasable version of the Cardfight!! Vanguard web client.

Its purpose is not to describe everything the product may eventually become. Its purpose is to create a hard boundary around the first version so product and engineering can align on what must ship, what can wait, and what should be rejected for now.

The key constraint is simple: the first version must already be useful as a Vanguard companion platform without requiring a full gameplay simulator.

This scope definition exists to prevent three predictable failure modes:

- turning v1 into an attempt to build all of Vanguard at once;
- shipping a shallow card database with weak retention and no operational value;
- hiding major future ambitions inside v1 under the label of "foundation."

## Product Scope Philosophy

Version 1 should deliver a coherent player workflow, not a collection of disconnected surfaces.

That workflow is:

1. find supported cards;
2. understand what those cards are and where they come from;
3. build a deck in a declared format;
4. validate that deck within the supported scope;
5. save it, share it, and use it in lightweight ongoing play activity.

The product is intentionally broader than a catalog, but intentionally narrower than a full digital game platform.

The scope philosophy for v1 is:

- prioritize repeat-use workflows over broad feature counts;
- support a declared content slice well rather than pretending to support all Vanguard;
- make multi-format growth possible without requiring full multi-format completeness on day one;
- implement only the social and match surfaces that strengthen actual deck and play workflows;
- build future expansion paths into the product model, but do not ship future ambitions as half-built features.

## Scope Snapshot

### Must-Have in V1

- web client foundation;
- auth and profile;
- catalog, card detail pages, and product or set pages;
- content ingestion foundation for the supported scope;
- deck builder;
- deck legality for the declared supported scope;
- deck-centered social foundation;
- manual match history tools;
- basic stats;
- architectural readiness for later gameplay expansion.

### Important, But Later

- playable match prototype;
- first gameplay engine foundation;
- richer real-time features;
- broader content coverage and deeper format adapters;
- deeper collection or binder features;
- richer social functionality;
- expanded analytics and tournament tooling.

### Explicitly Out of Scope for V1

- full Vanguard simulator;
- execution of all card effects;
- full historical card pool support at launch;
- complete support for every format and product family at launch;
- exhaustive edge-case handling for promos, printings, and obscure products;
- production-complete tournament or ranked online systems.

## MVP / Version 1 Scope

### V1 Outcome

Version 1 should launch as a dependable Vanguard companion product that lets a signed-in user browse supported cards, inspect card and product details, build decks for the supported formats and supported content slice, check legality within that scope, share decks through a basic social layer, record match results manually, and see simple performance-oriented stats.

It is acceptable for v1 to support only part of the total Vanguard universe, as long as the supported coverage is explicit, internally consistent, and operationally maintainable.

### Must-Have V1 Capabilities

| Capability                              | What V1 Includes                                                                                                                                            | User Value                                                                                 | Why It Belongs in V1                                                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Web client foundation                   | A stable authenticated web app shell, primary navigation, clear format and coverage messaging, basic settings, and persistent user-facing product structure | Makes the platform understandable and usable as a product rather than a prototype          | Every other workflow depends on users being able to navigate the product, understand support boundaries, and trust what they are looking at |
| Auth and profile                        | Account creation or sign-in, basic profile identity, ownership of decks and match records, and basic privacy or visibility controls                         | Gives users persistence, saved work, attribution, and a place from which sharing can start | Decks, match history, and social usage have low value if they are anonymous or non-persistent                                               |
| Catalog or card browser                 | Search, filtering, and browsing across the supported card pool with format-aware and product-aware entry points                                             | Solves the primary discovery problem and feeds deck building directly                      | The product cannot be a Vanguard companion if users cannot reliably find relevant cards                                                     |
| Card detail pages                       | Canonical card pages with key metadata, supported legality context, product references, and enough structured information to support deck decisions         | Turns search results into trusted reference objects that can be shared, linked, and reused | Card-level trust is foundational for both deck building and future data expansion                                                           |
| Products or set pages                   | Pages for supported boosters, sets, or product families that show what is in scope and how cards are grouped                                                | Makes content coverage understandable and reinforces phased growth instead of hiding it    | Vanguard content arrives through products and release waves, so the product must expose that structure from the start                       |
| Content ingestion foundation            | A repeatable internal process for adding and updating cards, sets, printings, and legality-related metadata for the supported scope                         | Keeps the product maintainable as new content is added                                     | Manual one-off content handling is not a viable strategy even for an early release                                                          |
| Deck builder                            | Create, edit, save, duplicate, and share decks inside declared format boundaries with clear deck composition handling for supported formats                 | Delivers one of the highest-frequency player workflows and makes the platform operational  | Deck building is a central reason to use the product regularly, not an optional add-on                                                      |
| Deck legality foundation                | Format-aware validation for the supported formats and supported content slice, with visible validation results and understandable failure reasons           | Replaces guesswork and turns the deck builder into a trusted tool                          | Without legality support, deck building remains incomplete and users will fall back to manual verification                                  |
| Social foundation                       | Public or private deck visibility, shareable deck pages, deck ownership attribution, and a lightweight profile-linked sharing surface                       | Makes the product useful among friends, test groups, and local communities                 | Social value in v1 should reinforce deck usage, not attempt to create a full community platform                                             |
| Match history tools                     | Manual match result logging tied to decks, formats, and basic notes or opponent context                                                                     | Extends the product into actual play usage even without a simulator                        | This is the lowest-cost path to real post-game utility and repeat engagement                                                                |
| Basic stats                             | Simple deck and match summaries such as games played, wins and losses, and deck-linked performance views                                                    | Helps users evaluate testing and makes match logging worth doing                           | Basic stats close the loop between building, playing, and improving without requiring advanced analytics                                    |
| Readiness for future gameplay expansion | Product objects and boundaries that can later support match tools, game-state-aware utilities, and selective gameplay features                              | Prevents the first version from becoming a dead-end                                        | Future gameplay support should be enabled by the v1 model, not implemented in v1                                                            |

## Why These Features Belong in V1

The v1 scope is intentionally centered around one complete companion loop: discover, build, validate, share, track.

These features belong in v1 because together they create practical value before any full gameplay engine exists:

- the catalog, card pages, and product pages establish trust and coverage clarity;
- the deck builder and legality layer create the strongest day-to-day utility;
- auth, profile, and social sharing turn personal work into persistent and reusable product activity;
- match history and basic stats create a bridge from preparation into real play;
- the ingestion foundation and future-readiness constraint prevent v1 from being a short-lived throwaway implementation.

This is also the realistic boundary. It is broad enough to create a real product, but still narrow enough to be built without absorbing the entire complexity of Vanguard gameplay, every historical card edge case, or an always-on social platform.

## Phase 2 Scope

Phase 2 should deepen the product only after the v1 workflows are stable, trusted, and operationally maintainable.

These items are important, but they are not release-critical for the first version.

| Phase 2 Item                         | Why It Matters                                                                              | Why It Is Not Required for V1                                                                | Dependency on V1                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Playable match prototype             | Begins testing the product's ability to support interactive play flows                      | The first release can already be valuable through deck, legality, and manual match workflows | Depends on stable card, deck, and match domain objects from v1                         |
| First gameplay engine foundation     | Creates the basis for selected rules-aware gameplay features later                          | Too expensive and too open-ended to be bundled into the initial release                      | Depends on trustworthy card data and format boundaries from v1                         |
| Deeper format adapters               | Supports more format-specific edge behavior and broader format completeness                 | V1 only needs the depth required for the declared supported scope                            | Depends on proven v1 handling of format-aware deck and legality logic                  |
| Richer real-time features            | Could support live collaboration, synchronous play assistance, or richer match coordination | Real-time systems add complexity before core single-user and async workflows are proven      | Depends on adoption of v1 deck, profile, and match surfaces                            |
| Broader content ingestion coverage   | Expands into more boosters, product families, printings, and eventually more formats        | Coverage breadth is not the same as product readiness                                        | Depends on v1 ingestion operations being repeatable and reliable                       |
| Deeper collection or binder features | Adds ownership tracking, collection management, and personal inventory workflows            | Useful, but not necessary to prove the core companion loop                                   | Depends on stable card identity and product relationships from v1                      |
| More advanced social functionality   | Could include richer profiles, comments, following, group spaces, or collaboration layers   | Social depth should follow proven deck-centric usage rather than lead it                     | Depends on actual sharing behavior and moderation needs observed in v1                 |
| Expanded statistics and analysis     | Could add matchup trends, richer testing analysis, and broader deck performance views       | Basic stats are enough to validate the loop initially                                        | Depends on sufficient match data and meaningful usage patterns from v1                 |
| Tournament tooling                   | Could support event submissions, pairings-adjacent utilities, or organizer flows            | Valuable for some users, but not required to prove the companion platform                    | Depends on solid decks, profiles, legality, and possibly richer social or event models |

Phase 2 should not be treated as "everything we did not fit into v1." It should be treated as the next layer that becomes justified only after the first layer is dependable.

## Explicit Non-Goals

The following are explicitly out of scope for version 1:

- full playable simulation of Cardfight!! Vanguard across all mechanics;
- implementation of all card effects or a generalized rules engine for the entire game;
- support for the full historical card pool at first release;
- full support for Standard, V Premium, and Premium in complete historical depth on day one;
- exhaustive handling of every promo, obscure product, alt-print, and edge-case legality scenario at launch;
- a production-complete tournament platform;
- a ranked or competitive online ecosystem;
- a collection manager with the depth of a mature commercial TCG inventory service;
- advanced real-time social features that do not directly strengthen deck sharing or match logging;
- broad gameplay design commitments beyond what is needed to preserve future expansion paths.

These are non-goals for a reason:

- they dramatically increase complexity without being necessary to make the first product useful;
- they would delay release and weaken focus on the core companion workflow;
- several of them depend on the product learning from real v1 usage before they can be designed responsibly.

## Scope Boundaries and Implementation Levels

The first version should not treat every included area equally. Some parts must be fully useful now, some may be partial within declared coverage, and some should exist only as deliberate foundation.

| Area                          | V1 Level                                                      | Boundary                                                                         |
| ----------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Web client foundation         | Full for v1 needs                                             | Must feel like a stable product, not a demo shell                                |
| Auth and profile              | Full for v1 needs                                             | Enough for identity, persistence, and sharing; not a deep social identity system |
| Catalog and browse experience | Full within declared content slice                            | Search and filtering must work reliably for all supported cards                  |
| Card detail pages             | Full within declared content slice                            | Canonical, trustworthy, and shareable for supported cards                        |
| Product or set pages          | Full within declared content slice                            | Must clearly communicate coverage and product grouping                           |
| Content ingestion             | Foundation, but production-usable                             | Needs repeatable operations, not a manual stopgap disguised as process           |
| Deck builder                  | Full within declared supported formats and coverage           | One of the main reasons to use the product; cannot be placeholder-quality        |
| Deck legality                 | Partial by total game scope, full by declared supported scope | Must be trustworthy where support is claimed; unsupported cases must be explicit |
| Social                        | Foundation plus minimal usable surface                        | Sharing and deck visibility are in scope; broader community systems are not      |
| Match tools                   | Minimal practical implementation                              | Manual match history is in scope; live match orchestration is not                |
| Stats                         | Minimal practical implementation                              | Basic summaries are enough; advanced analytics are later                         |
| Gameplay support              | Architectural readiness only                                  | Preserve the path; do not ship half-built game logic as user-facing scope        |

### What V1 Must Do Fully

These items must feel complete enough to justify release:

- browse supported cards;
- inspect supported card and product details;
- create, edit, save, and share decks;
- validate deck legality within declared support boundaries;
- sign in and retain user-owned decks and match logs;
- record match outcomes manually and view simple deck-linked stats.

### What V1 May Do Partially

These items may be partial as long as the limitations are explicit:

- format support across Standard, V Premium, and Premium;
- total content coverage by booster, product family, or printing;
- legality depth for edge cases outside the declared supported scope;
- social interactions beyond direct deck sharing and attribution.

### What V1 Should Only Prepare For

These items should be enabled conceptually or structurally, but not delivered as first-version promises:

- rules-aware gameplay interactions;
- playable match experiences;
- deeper real-time collaboration;
- richer collection management;
- tournament operations.

## Scope Control Principles

Scope discipline is critical for this project because Vanguard can endlessly expand in content depth, rules complexity, and community features.

The team should use the following principles when deciding whether a new idea belongs in v1, phase 2, or later backlog:

1. If a feature does not materially strengthen the discover-build-validate-share-track loop, it is probably not v1.
2. If a feature requires solving broad gameplay rules or card-effect execution, it is not v1.
3. If a feature is only valuable after decks, legality, and match logging are already stable, it belongs after v1.
4. If a feature increases supported breadth without improving the product's core workflows, it should compete for phase 2, not silently enter v1.
5. If a feature can be represented as future-ready structure without becoming a user-facing promise, keep it at the foundation level.
6. If the team cannot state the supported boundary clearly, the feature is not ready for release scope.
7. If a feature creates major moderation, live-sync, or operational burden, it needs stronger justification than "users may want it."
8. If a feature sounds important only because the complete long-term vision includes it, that is not enough reason to include it in v1.

The practical decision test should be:

- Does this help the first release become clearly useful?
- Does it fit inside declared support boundaries?
- Can it be shipped with trustworthy quality?
- Does it avoid dragging gameplay-engine complexity into the first release?

If the answer to any of these is no, the item should move out of v1.

## Release Readiness Perspective

Version 1 should be considered release-ready when it satisfies the following conditions:

- the supported formats and supported content slice are explicitly declared in-product;
- users can browse and inspect all supported cards and supported products reliably;
- users can build and save decks against the supported scope without major workflow gaps;
- legality results are trustworthy for the cases the product claims to support;
- sharing a deck with another user is straightforward and stable;
- manual match logging is usable enough to support ongoing testing or local play habits;
- basic stats provide a simple but credible feedback loop;
- content updates for supported scope can be handled through repeatable internal operations;
- known limitations are visible rather than hidden.

Release readiness does not require completeness across all Vanguard formats, all historical products, or gameplay simulation. It requires a stable and honest product that solves a meaningful companion workflow for a declared scope.

## Open Questions for Future Planning

The following questions should be resolved after this scope document, because they directly shape how v1 is executed without changing its overall boundary:

- Which exact formats are supported at initial launch, and at what declared depth?
- Which boosters, product families, and printings define the first supported content wave?
- What is the minimum acceptable deck-sharing model for v1: private, link-shared, public profile, or some combination?
- How detailed should manual match history be in the first release?
- What degree of legality explanation is required to make validation outcomes trustworthy?
- Who owns ongoing content ingestion operations, and what release cadence is realistic?
- What minimum moderation or abuse controls are required once profiles and shared decks exist?
- What product signals will determine whether phase 2 should prioritize gameplay prototypes, broader content coverage, or richer social layers?
