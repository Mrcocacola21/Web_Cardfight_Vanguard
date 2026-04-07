# Cardfight!! Vanguard Web Client Vision

Status: Initial product vision  
Last updated: 2026-04-07

## Product Overview

### Elevator Pitch

This product is a web-based Cardfight!! Vanguard companion platform: a structured card catalog, deck building workspace, legality checker, social deck-sharing surface, and match support toolset that can expand over time into deeper gameplay assistance without being forced to start as a full simulator.

### Expanded Product Overview

The product is not a single-purpose card database. It is a long-lived platform for how Vanguard players actually prepare, validate, share, and use decks across multiple formats.

At its core, the platform must help players answer practical questions:

- What cards exist in the supported content pool?
- What can I play in my format?
- Is this deck legal right now?
- How do I compare, refine, and share lists with other players?
- What tools can help during real matches even before full gameplay support exists?

The product must support the reality of Cardfight!! Vanguard as a multi-format game with evolving content. Standard, V Premium, and Premium cannot be treated as afterthoughts or bolted-on modes. They create different expectations around deck construction, legality, card pools, printings, and future gameplay support. The platform therefore needs a domain model and product structure that can absorb new sets, product families, legal states, and mechanic metadata without rethinking the entire system each time content expands.

### Why This Cannot Be Built as "Just a List of Cards"

A static list of cards solves discovery only at the shallowest level. It does not solve the workflows that make players return.

- Vanguard players do not only browse cards; they build decks under format constraints.
- Card relevance depends on format, release coverage, clan or nation context, restrictions, and future content waves.
- A useful product must connect card data to deck construction, validation, comparison, sharing, and real play support.
- A catalog-only product has weak retention because it does not become part of a player's weekly routine.
- A catalog-first architecture that ignores growth usually becomes brittle once deck legality, printings, or gameplay support are added.

The correct framing is not "a website with cards on it." The correct framing is "a companion platform for Vanguard players that starts with high-trust information and expands into high-frequency workflows."

## Vision Statement

Build the most dependable and extensible web companion for Cardfight!! Vanguard: a product that begins by making card discovery, deck construction, and legality validation dramatically easier, then grows into the place where players manage their decks, share lists with friends and local communities, and use practical match-time tools.

The vision is to create a platform that becomes more valuable as content and capabilities expand, not more fragile. Each new format, booster, product family, legality update, and mechanic should extend a stable foundation rather than trigger product rewrites or one-off solutions.

The long-term ambition is not "launch a simulator." The long-term ambition is to own the full preparation-to-play workflow responsibly. Full gameplay simulation may become a future expansion path, but only after the product has earned trust in catalog accuracy, deck workflows, legality logic, and practical match support.

## Problem Statement

Cardfight!! Vanguard players often operate across fragmented tools and incomplete sources:

- card information is scattered, inconsistent, or not structured for practical deck work;
- legality and format support are easy to misunderstand, especially as formats diverge and content grows;
- deck building often depends on ad hoc notes, spreadsheets, or generic tools that do not understand Vanguard-specific constraints;
- sharing and iterating on decks with friends or local groups is more manual than it should be;
- there is a gap between "researching cards" and "using a tool during real play."

This creates friction for both new and experienced players. Returning players struggle to understand the current card pool and format boundaries. Competitive players waste time validating lists and comparing options. Local communities lack a shared operating surface for decks, testing, and basic match support.

The problem is not only missing data. The problem is missing workflow support around that data. A product that only aggregates cards leaves most of the actual player job unfinished.

## Who This Product Is For

### Target Audience

The primary audience is active and returning Cardfight!! Vanguard players who need reliable digital support for finding cards, building decks, checking legality, and collaborating around play. The product should serve users across Standard, V Premium, and Premium, even if content coverage arrives in phases.

Secondary audiences include local playgroups, content-oriented community members, and organizers who benefit from shared deck references, rules-aware deck validation, and practical match utilities.

### User Archetypes

#### 1. Competitive Format Specialist

This player focuses mainly on one supported format and wants fast card discovery, accurate deck validation, and iteration speed. They care about efficiency, trust, and clear legality outcomes.

#### 2. Multi-Format Builder

This player moves between Standard, V Premium, and Premium. They need the product to keep format boundaries explicit and to prevent cross-format confusion in both card search and deck construction.

#### 3. Returning Player

This player knows Vanguard but is no longer current on supported cards, product waves, or format legality. They need guided discovery, understandable filters, and confidence that a deck list reflects the supported environment.

#### 4. Local Community Player

This player uses the product with friends, testing groups, or store communities. They need shareable lists, easy comparison, and lightweight social features that make the tool useful in actual group play rather than only solitary research.

#### 5. Match-Day Utility User

This player may already know what they want to play, but needs support during real sessions: quick reference, counters, turn-adjacent helpers, or other match tools that reduce friction without requiring a full digital game engine.

## Product Pillars

### 1. Structured Catalog

The catalog is the foundation, but it must be modeled as structured game content rather than a flat encyclopedia. Cards need to be represented in ways that allow format scoping, search, filtering, printings, product-family relationships, legality states, and future mechanic-aware behaviors.

### 2. Deck Building as a Core Workflow

Deck building is one of the central reasons this product should exist. The product must make deck creation, editing, comparison, and iteration feel first-class. A player should be able to move naturally from card discovery into deck decisions without leaving the platform.

### 3. Legality as a Trust Layer

Deck legality checking is not a side feature. It is a core trust mechanism. If the platform cannot clearly answer whether a deck is valid for a supported format and supported content scope, users will fall back to manual verification. Accurate legality logic turns the product from a reference site into an operational tool.

### 4. Social Use Around Practical Objects

Social features matter because Vanguard is played in communities, not in isolation. The platform should let players share decks, discuss iterations, compare builds, and use the product inside friend groups or local scenes. Social functionality should attach to meaningful objects such as deck lists, format discussions, testing groups, or match preparation, not exist as generic community fluff.

### 5. Match Tools Before Full Simulation

There is meaningful value between "no play support" and "full simulator." Match tools can help players during real games through tracking, reference, and support utilities that do not require the product to model the entire Vanguard engine on day one. This creates practical usage earlier and keeps future gameplay ambitions grounded in real player workflows.

### 6. Deliberate Gameplay Expansion

Gameplay support should be introduced gradually and intentionally. The product should preserve a future path toward richer rules-aware interactions, but it should not attempt to implement the full Vanguard rules engine as the first milestone. The right approach is progressive capability: begin with metadata and utilities that support deck and match workflows, then expand only when the foundation is proven.

## What Makes This Product Valuable

### Key Value of the Early Product

The early product becomes valuable when it gives Vanguard players one reliable place to:

- explore the supported card pool with confidence;
- build decks inside clear format boundaries;
- validate legality without external spreadsheets or guesswork;
- save and share lists with other players;
- begin using lightweight community and match-oriented workflows.

This is enough to create repeat usage even without a full gameplay engine. The platform becomes part of preparation, testing, and local coordination.

### Long-Term Product Value

Over time, the product can become the default operating surface for a Vanguard player:

- a persistent home for decks across formats;
- a trusted source of format-aware card and legality data;
- a shared collaboration layer for friends, teams, and local communities;
- a practical companion during matches;
- a stable foundation for deeper gameplay support when the product is ready.

The long-term value comes from continuity. Players should not need one tool for cards, another for deck building, another for legality checks, and yet another for match-day assistance.

## Scope of the Early Product

The initial stage should focus on delivering high-trust utility, not maximum surface area.

The early product should include:

- a structured catalog for the initially supported content waves;
- clear handling of supported formats, even if full coverage arrives gradually;
- deck creation, editing, storage, and sharing;
- explicit legality validation for supported formats and supported content scope;
- enough social functionality to make decks collaborative and shareable;
- a product foundation that can later support match tools and deeper gameplay features.

The early product should be honest about coverage. If a format, set, booster, product family, or legality rule is only partially supported, that limitation must be explicit. Trust is improved by clarity, not by pretending completeness.

The first release does not need to ship a full match-tool suite, but it should not block it either. Core product objects such as cards, decks, formats, and supported game-state metadata should be framed so that lightweight real-play utilities can be added without rethinking the product from scratch.

## Long-Term Expansion Path

### Phased Growth Model

This product must grow in phases, and that phased growth is part of the product vision itself.

The platform should expand along several axes:

- by format: Standard, then broader V Premium and Premium support as coverage matures;
- by content wave: booster by booster, product family by product family;
- by data richness: from core card data into printings, legal states, and mechanic-aware metadata;
- by workflow depth: from catalog and deck construction into social coordination, match support, and selective gameplay assistance.

This matters because the product is not trying to win by day-one completeness. It is trying to win by building a foundation that stays coherent as coverage broadens.

### Why Phased Content Expansion Is a Product Concern

Gradual content expansion is not just an implementation detail. It changes the product promise, user trust model, and architecture requirements.

- Users need to know what is supported now versus what is planned later.
- The content model must tolerate partial coverage without breaking search, deck building, or legality logic.
- New sets and product families must be addable through repeatable product operations, not manual exceptions.
- Legality and gameplay-related data must be able to evolve as formats and content diverge.

If phased content growth is not part of the vision, the team will default to one-off additions and format-specific hacks. That eventually destroys consistency and slows every future release.

### Future Expansion Direction

Once the catalog, deck workflows, and legality layer are dependable, the platform can expand responsibly into:

- stronger deck comparison and iteration workflows;
- richer social collaboration around groups, testing, and shared lists;
- practical match tools used during physical play;
- progressively deeper gameplay support for selected interactions;
- broader coverage across formats, boosters, and special products.

Full gameplay simulation is explicitly not the starting goal. It is a possible future path that should be enabled by product and data design, not forced prematurely.

## Non-Goals for the Initial Stage

The initial stage is not intended to deliver:

- full gameplay simulation of Cardfight!! Vanguard;
- complete support for the entire historical card pool on day one;
- exhaustive implementation of every edge-case rule before the core deck workflow is stable;
- a generic social network disconnected from decks and play;
- format-specific product silos that cannot share a common foundation;
- uncontrolled feature sprawl in the name of shipping "everything Vanguard-related."

These are non-goals because they would dilute focus, weaken trust, and push the team toward brittle architecture before the product has proven its core value.

## Guiding Principles

1. Design for the platform, not for a single screen.
2. Treat formats, printings, product families, legal states, and mechanic metadata as first-class concepts.
3. Optimize for player workflows, especially discovery to deck building to legality validation.
4. Build trust through explicit scope, accurate validation, and visible support boundaries.
5. Keep social features attached to practical Vanguard objects and use cases.
6. Prefer incremental capability over premature completeness.
7. Support match-time utility before attempting full digital gameplay.
8. Add content through repeatable systems, not manual one-off handling.
9. Preserve a future path to deeper gameplay support without making it the first dependency.
10. Make expansion cheaper over time, not more expensive.

## Success Criteria

The product vision is succeeding if the following become true:

- users can quickly understand what content and formats are currently supported;
- supported cards are discoverable in ways that directly help deck construction;
- deck building and legality validation are trusted enough to replace manual checking for supported scope;
- deck sharing and lightweight social usage create recurring engagement among friends or local communities;
- match tools become useful before any full simulator exists;
- adding new boosters, product families, or format coverage does not require structural rework;
- the team can use this document to make scope decisions and reject work that does not strengthen the platform.

## Risks and Product Challenges

### Data Trust Risk

If card data, legality states, or format boundaries are wrong or ambiguous, the product loses credibility quickly. This matters because trust is the basis for deck building and validation adoption.

### Multi-Format Complexity Risk

If the product is shaped too heavily around the first supported format, later expansion into V Premium or Premium will become expensive and error-prone. This matters because multi-format support is part of the long-term vision, not optional stretch scope.

### Premature Simulator Risk

If the team jumps too early into full gameplay simulation, it can consume the roadmap and delay the features that make the product immediately useful. This matters because a weak core platform cannot be rescued by an over-ambitious engine.

### Catalog-Only Trap

If the product stops at card browsing, usage frequency and retention will remain limited. This matters because the strongest value comes from connected workflows, not from passive reference alone.

### Weak Social Integration Risk

If social features are bolted on as generic comments or profiles without deck-centered use cases, they will feel optional and unused. This matters because social value should reinforce real community behavior, not compete with existing chat platforms.

### Manual Content Operations Risk

If each new set, printing, or legality update requires special handling, content growth will become slow and inconsistent. This matters because phased expansion is fundamental to the product strategy.

### Scope Creep Risk

Because Vanguard offers many possible surfaces, the team may try to build too many incomplete features at once. This matters because partial, low-trust coverage across many areas is worse than strong utility in a focused early scope.

### External Constraint Risk

Content sourcing, naming consistency, localization differences, and potential rights constraints may affect what data and assets can be presented. This matters because product promises must remain realistic and maintainable.

## Closing Position

This project should be understood as a long-term Vanguard companion platform with a disciplined starting scope.

Its first job is to make supported card discovery, deck building, and legality validation clearly better than fragmented community workflows. Its second job is to turn those workflows into recurring usage through sharing, local-community relevance, and practical match support. Its future job is to grow into deeper gameplay assistance without forcing the team to build the full game engine before the platform foundation is ready.

That framing should guide future architecture, data modeling, roadmap, and scope decisions.
