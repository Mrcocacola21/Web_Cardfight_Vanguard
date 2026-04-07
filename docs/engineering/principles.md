# Cardfight!! Vanguard Web Client Engineering Principles

Status: Initial engineering principles  
Last updated: 2026-04-07

## Why This Document Exists

This document defines the engineering rules that should guide architecture, module boundaries, implementation choices, and future prompts for Codex in this project.

It exists because this product is not a small website with a few pages. It is a long-lived Vanguard platform that must grow across:

- catalog and structured card data;
- deck building and deck legality;
- social and match history features;
- gradual gameplay support;
- multiple formats;
- expanding content coverage by product family and release wave.

Without explicit principles, the project will drift toward predictable failure modes:

- React components becoming the home of rules logic;
- catalog, legality, and gameplay concepts being merged into one data shape;
- one-off format hacks replacing explicit format architecture;
- importer and runtime app code leaking into each other;
- giant card-effect switches and hardcoded exceptions becoming the default pattern;
- data access spreading across the UI;
- weak typing hiding domain mistakes until late.

This document is intended to be used as an internal alignment reference. Engineers and Codex should be able to use it to decide where logic belongs, how new modules should be shaped, and when a shortcut is unacceptable.

## Architectural Mindset for the Project

The project should be treated as an extensible platform with phased delivery, not as a page-by-page web app.

The core mindset is:

- the domain is already complex, even before full gameplay support exists;
- the first release does not need all Vanguard features, but it must not distort the future model;
- catalog, legality, gameplay, social, and ingestion are related but different concerns;
- multi-format support is not an optional afterthought;
- architecture must be designed to absorb more content, more rules depth, and more workflows without repeated structural rewrites.

We are deliberately optimizing for long-term coherence rather than short-term convenience. That does not mean over-engineering everything on day one. It means making sure early decisions do not trap the product in UI-shaped logic, single-format assumptions, or one-off data handling.

## Core Engineering Principles

### 1. Monorepo Is an Intentional Architecture Choice

**Description**  
The project should live in a monorepo with explicit packages or modules for domain logic, application logic, UI, persistence adapters, ingestion tooling, and shared contracts.

**Rationale**  
This project will grow across several connected but distinct concerns. Keeping everything in one undifferentiated app directory makes it too easy to mix domain rules, UI behavior, importer code, and storage access. A monorepo gives the team one source of truth while still allowing internal boundaries, independent testability, and controlled reuse.

**Practical implication**  
Catalog, decks, legality, gameplay, importer, database integration, UI libraries, and the web application should not evolve as one shapeless codebase. They should be separate packages or domain modules with explicit dependency directions. Shared code should be shared because it is a real stable contract, not because the project lacks boundaries.

### 2. Domain-First Architecture

**Description**  
The project should be designed from the domain model outward: domain concepts first, then storage and data access, then application orchestration, then UI.

**Rationale**  
Cardfight!! Vanguard is not a trivial CRUD product. Formats, printings, legality, deck structures, and future gameplay support all introduce domain complexity before UI complexity. If the project is built page-first, the domain will be reverse-engineered from screens and request handlers later, which is exactly how structural debt forms.

**Practical implication**  
When adding a feature, start by identifying the domain objects, invariants, and boundaries involved. A page should not invent its own model of cards, decks, or legality. Storage schemas and API shapes should serve the domain model rather than define it.

### 3. No Gameplay Logic in React

**Description**  
React components must not become the location of authoritative gameplay logic, gameplay validation, or effect resolution.

**Rationale**  
UI code is optimized for rendering, user interaction, and local state. Gameplay logic is optimized for rules correctness, deterministic transitions, and format-aware validation. Those are different responsibilities. If gameplay rules live in React, future playable match support becomes fragile, untestable, and impossible to share across clients or runtimes.

**Practical implication**  
React should display state, collect user intent, and trigger commands or actions. Rules decisions, gameplay state transitions, action validation, and effect resolution should live in domain or engine layers. UI may pre-validate for convenience, but it must not become the source of truth.

### 4. No Giant Switch for All Cards

**Description**  
The system must not centralize all card-specific logic in one massive switch statement, one giant registry file, or one expanding pile of `if cardId === ...`.

**Rationale**  
Vanguard content grows over time. A giant switch guarantees central coupling, merge conflicts, unreadable behavior, and brittle effect logic. It also pushes the system toward card-by-card chaos instead of structured mechanics, typed handlers, and reusable behavior layers.

**Practical implication**  
Prefer extension-ready patterns such as typed effect handlers, mechanic-oriented registries, keyword-aware behavior modules, and layered rules processing. Some behaviors may later be partially declarative, but a generic DSL should not be introduced only because it sounds elegant. The architecture should favor the least-complex approach that remains extensible and testable.

### 5. Strict Typing Is a Domain Safety Mechanism

**Description**  
TypeScript should be used as a serious modeling tool. Domain entities, repository contracts, action payloads, legality results, ingestion records, and API boundaries should be strongly typed.

**Rationale**  
The project contains overlapping concepts that are easy to mix up: card entity vs printing, format vs era, legality vs restriction, deck validation vs gameplay validation. Weak typing makes those mistakes cheap to write and expensive to discover.

**Practical implication**  
Avoid `any`, loosely shaped objects, and dictionary-driven domain behavior. Prefer explicit types, discriminated unions, branded identifiers where useful, and narrow contracts at package boundaries. If two concepts are different in the glossary, they should usually be different in the type system.

### 6. Architecture Must Be Extension-Ready

**Description**  
The system should be designed so new formats, product families, content waves, legality rules, and gameplay mechanics can be added incrementally without structural rework.

**Rationale**  
This project is expected to grow format by format and booster by booster. If the first implementation hardcodes one format, one deck structure, or one content assumption into every layer, later support for Standard, V Premium, and Premium will become a rewrite instead of an expansion.

**Practical implication**  
New formats should plug into shared foundations through explicit format-aware boundaries. New content waves should flow through importer, catalog, legality, and UI without forcing new architecture every time. A useful question is always: if we add one more format or one more product family, do we extend the system or fork it?

### 7. Separation of Concerns Is Non-Negotiable

**Description**  
Domain logic, persistence, content ingestion, presentation, realtime synchronization, application orchestration, and testing utilities must remain distinct concerns.

**Rationale**  
This project spans several kinds of complexity at once. If those concerns bleed together, every future change becomes riskier because changing a deck rule also means changing a query, a component, and an importer path at the same time. Strong boundaries reduce coupling and make the system understandable.

**Practical implication**  
Domain modules should not know how React renders them. UI modules should not know how Supabase tables are shaped. Importer code should not define runtime deck behavior. Realtime transport should not become the home of gameplay decisions. Test helpers should support modules without becoming runtime dependencies.

### 8. Data Access Must Be Deliberate

**Description**  
Database access and remote queries must be centralized behind explicit repository or query layers. Supabase integration must not leak across the codebase.

**Rationale**  
Scattered query logic creates hidden coupling, inconsistent access control, duplicated fetch behavior, and fragile server/client boundaries. This is especially dangerous in a product that mixes public catalog data with user-owned decks, profiles, match history, and future realtime features.

**Practical implication**  
React components should not assemble arbitrary database queries inline. A meaningful repository or query layer should own read/write access patterns. Server-side and browser-side responsibilities must be explicit. Row-level security and privacy rules should be enforced through proper boundaries, not trusted to UI conventions.

### 9. Build for Gradual Complexity, Not Immediate Completeness

**Description**  
The architecture should support partial implementation and phased rollout, as long as early implementations preserve the correct long-term model.

**Rationale**  
The project should not attempt to support the full Vanguard universe at once. At the same time, "temporary" shortcuts often become permanent architecture. The right balance is to allow partial support where the product scope is intentionally partial, but not to encode false assumptions that make later growth harder.

**Practical implication**  
Placeholder architecture is acceptable when it keeps the right boundaries intact. For example, a future gameplay module may begin as interfaces and minimal state structures rather than full rules logic. What is not acceptable is flattening formats, collapsing printings into one card record, or treating manual content entry as the long-term ingestion model.

### 10. Testing Is Architectural Protection

**Description**  
Testing should be treated as a structural requirement for domain modules, legality logic, repository behavior, importer pipelines, and rules foundations.

**Rationale**  
In a domain-heavy platform, testing is not just regression insurance. It is a signal about whether boundaries are healthy. If a module is hard to test, it often means it is coupled to UI, persistence, or runtime concerns it should not own.

**Practical implication**  
Domain modules should be testable without rendering the app. Repository contracts should be testable separately from UI flows. Importer normalization logic should be testable against representative source inputs. Rules-core modules should be deterministic enough to test with state and action fixtures.

### 11. Maintainability and Readability Beat Cleverness

**Description**  
The project should favor clear, scalable structures over impressive abstractions, premature generic systems, or framework-shaped novelty.

**Rationale**  
The domain itself is already complex. The codebase does not need extra accidental complexity. Clever abstractions tend to hide responsibility, make debugging harder, and create onboarding friction. This is especially dangerous in a system where future contributors may arrive through both human engineers and prompt-driven Codex changes.

**Practical implication**  
Choose names that reflect the glossary. Keep contracts understandable. Introduce abstraction only when it reduces duplication or clarifies variation in a real, repeatable way. If a pattern looks elegant but makes ownership and debugging harder, it is probably the wrong choice.

### 12. Stable Boundaries Matter More Than Early Convenience

**Description**  
When a short-term shortcut conflicts with a stable domain or package boundary, the boundary should usually win.

**Rationale**  
Most architecture problems in long-lived products come from convenience decisions that bypass boundaries "just this once." In this project, that typically means importing storage-specific types into UI, embedding format behavior in screens, or bypassing repositories because one query seems simple.

**Practical implication**  
The team should optimize for boundary integrity even in v1. Shipping a smaller but structurally sound feature is preferable to shipping a wider feature that teaches the codebase the wrong dependency pattern.

## Boundaries We Intend to Protect

The following boundaries are intentional and should remain visible in the architecture:

| Boundary                                    | What Belongs There                                                 | What Should Not Leak In                                                               | Why It Matters                                                            |
| ------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Domain vs presentation                      | cards, printings, decks, legality, format rules, gameplay concepts | page props, visual groupings, component-local convenience types becoming system truth | the domain must outlive UI screens                                        |
| Canonical content vs printing history       | canonical cards, format relevance, deck references                 | art variants or set-specific data redefining gameplay identity                        | printings and gameplay identity are different concerns                    |
| Deck validation vs gameplay rules           | pre-game construction, eligibility, restrictions, deck structure   | in-match sequencing, action validation, effect resolution                             | legality and gameplay are related but not the same engine                 |
| Application orchestration vs domain logic   | use cases, commands, workflows, authorization-aware flows          | raw component state, low-level DB details, card text parsing                          | orchestration should compose domain behavior, not replace it              |
| Persistence vs domain model                 | repositories, query adapters, storage-specific concerns            | direct UI-driven query shaping defining domain contracts                              | storage can change; domain meaning should remain stable                   |
| Content ingestion vs runtime application    | source import, normalization, provenance, review queues            | runtime deck behavior or page-level rendering decisions                               | ingesting content is not the same as consuming it in-product              |
| Server vs browser                           | secure writes, privileged reads, SSR, authoritative enforcement    | browser-only assumptions defining security or rules truth                             | trust boundaries must be explicit                                         |
| Realtime synchronization vs rules authority | transport, subscriptions, session signaling                        | authoritative gameplay decisions embedded in socket handlers                          | transport should carry state and actions, not become the rules layer      |
| Testing utilities vs production modules     | fixtures, builders, harnesses, simulated repositories              | test-only abstractions leaking into runtime architecture                              | test support should strengthen design without shaping production behavior |

## Anti-Patterns We Explicitly Want to Avoid

The following patterns are explicitly discouraged:

### Page-First Domain Design

Building features by starting from routes, screens, and API handlers and only later trying to infer a domain model from them.

Why this is harmful: it creates UI-shaped data models, duplicated business rules, and weak cross-feature consistency.

### One App Folder with Everything in It

Letting catalog logic, deck validation, importer code, UI utilities, Supabase queries, and gameplay experiments live in one undifferentiated area.

Why this is harmful: it destroys ownership and makes every change a cross-cutting change.

### Gameplay Rules in Components

Computing legal actions, resolving effects, or mutating authoritative gameplay state inside React components or view hooks.

Why this is harmful: it blocks future gameplay reuse and makes correctness dependent on rendering code.

### Giant Card Logic Switch

A central file or cluster of files that grows into a card-by-card rules encyclopedia implemented through hardcoded conditionals.

Why this is harmful: it creates merge contention, obscures reusable mechanics, and turns future expansion into maintenance debt.

### Format Logic Hidden in Boolean Flags

Encoding format behavior through scattered flags and component conditionals instead of explicit format-aware domain logic.

Why this is harmful: it looks simple early and becomes impossible to reason about once Standard, V Premium, and Premium diverge further.

### Presentation Models Used as Domain Models

Treating search-result items, card-detail payloads, or page-specific response shapes as the core domain types.

Why this is harmful: presentation needs change faster than domain meaning, so the system becomes unstable.

### Query Logic Spread Across the UI

Letting React pages and components issue direct storage-specific queries and shape business data ad hoc.

Why this is harmful: it couples data access, privacy, caching, and UI structure in one place.

### Supabase Everywhere

Allowing Supabase clients, table names, or storage-specific assumptions to leak into unrelated packages and domain modules.

Why this is harmful: it makes the persistence choice the de facto architecture.

### Weakly Typed Domain Payloads

Using `any`, generic records, or unvalidated external payloads as if they were internal domain objects.

Why this is harmful: it hides domain mistakes until runtime and encourages accidental concept mixing.

### Importer as Manual Data Editing Forever

Treating ingestion as a pile of one-off scripts, direct edits, and undocumented fixes instead of a repeatable content operation.

Why this is harmful: content growth becomes slower and less trustworthy with each release wave.

### Placeholder Shortcuts That Distort the Model

Using temporary implementations that flatten important concepts such as format, printing, restriction, or deck structure into one generic blob.

Why this is harmful: those shortcuts usually survive into later phases and block correct growth.

### Untestable Core Modules

Allowing critical modules to depend so heavily on the app runtime that they cannot be tested in isolation.

Why this is harmful: it usually means the module owns too many responsibilities.

## Decision Filters for Future Changes

Use the following checklist before introducing a new module, rule path, query path, or structural shortcut:

1. Does this decision strengthen or weaken domain boundaries?
2. Does it preserve the distinction between catalog, legality, gameplay, and application concerns?
3. Does it make adding another format easier, or does it hardcode one format more deeply?
4. Does it help the system absorb new product families and release waves without refactoring core structures?
5. Does it reduce coupling, or does it create a new hidden dependency between layers?
6. Does it keep the rules layer more independent from UI, or less?
7. Does it avoid turning storage-specific choices into application-wide contracts?
8. Does it improve or damage testability of the affected module?
9. Does it move us toward typed contracts, or toward loosely shaped payloads?
10. Does it reduce the risk of giant-card-logic chaos, or increase it?
11. Is the abstraction justified by real variation, or is it architecture theater?
12. If this shortcut survives for two years, would we still accept it?

If a change fails several of these checks, it should be redesigned rather than patched in.

## How These Principles Affect Day-to-Day Development

These principles are meant to change normal implementation behavior, not just architecture discussions.

- A new feature should begin with the domain terms it touches, using the glossary rather than inventing local vocabulary.
- A new rule or legality behavior should be added to domain-aware modules, not to pages that happen to need it first.
- A new fetch path should go through a deliberate repository or query boundary, not directly into component code.
- A new content source or release wave should be integrated through ingestion and normalization paths, not by hand-authoring runtime data indefinitely.
- A new gameplay experiment should preserve the separation between action intent, action validation, state transition, and rendering.
- A temporary implementation should be labeled by what it intentionally leaves out, but it should still respect the permanent boundaries.
- A Codex prompt that asks for code changes should ideally specify which layer is being changed: domain, repository, app orchestration, UI, importer, or tests.
- A pull request or implementation review should ask not only "does it work?" but also "did it land in the right layer?"

## Practical Implications for Future Modules

The principles above should shape future modules in concrete ways.

### Catalog Modules

Catalog modules should own canonical card modeling, printing relationships, product structures, filters, and content-oriented queries. They should not contain deck legality rules or UI-specific grouping logic as their primary abstraction.

### Deck and Legality Modules

Deck modules should own deck structures, deck versions, and deck snapshots. Legality modules should own validation logic, restriction interpretation, and legality results. Other contexts may submit explicit validation requests and store or display returned legality results, but they must not reimplement or reinterpret legality rules. Format-specific legality should be added through explicit legality rules or adapters, not through deck modules, component-level conditions, or database-only assumptions.

### Importer and Content Modules

Importer modules should own source ingestion, normalization, provenance, and review workflows. They should produce stable content records for the rest of the system rather than directly shaping UI payloads.

### Gameplay and Rules Modules

Gameplay modules should own game state, actions, validation, resolution, and effect-handling foundations when those capabilities are introduced. They should remain independent of React and narrow in responsibility enough to test directly.

### UI and Web Application Modules

UI modules should own rendering, interaction flow, and user-facing composition. They may call application services and present validation results, but they should not become the source of rules, domain truth, or persistence contracts.

### Social and Match Modules

Social features should remain attached to practical platform objects such as profiles, shared decks, match history, and privacy. Match history should remain clearly separate from future playable match infrastructure.

### Realtime Modules

Realtime modules should focus on synchronization, presence, subscriptions, and delivery of events or state updates. They should not become the default place to hide domain behavior that belongs in rules or application services.

### Testing Utilities

Test helpers should make domain, importer, and repository modules easier to exercise. They should mirror domain concepts clearly and avoid introducing fantasy abstractions that production code does not actually use.

## Closing Position

These principles are not a style guide and not an architecture diagram. They are a decision framework.

The project will change over time. Formats will expand, content coverage will grow, legality depth will increase, and gameplay support will become more ambitious. The purpose of these principles is to make that growth additive instead of chaotic.

If a future change fits the product scope but violates these principles, the correct response is not to force it through. The correct response is to redesign the change so the platform becomes stronger as it grows.
