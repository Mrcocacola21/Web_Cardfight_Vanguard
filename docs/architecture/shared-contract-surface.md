# Shared Contract Surface

Status: Cross-context contract policy  
Last updated: 2026-04-07

## Why This Document Exists

This document defines the minimum shared-contract surface allowed between bounded contexts.

It exists because the main remaining architecture risk is no longer the domain model itself. The main risk is uncontrolled sharing between contexts. If contexts are allowed to import each other's internal models directly, the architecture will collapse in predictable ways:

- `catalog` will leak into `rules`;
- `legality` will become a de facto dependency of everything;
- `decks` will start storing or reinterpreting foreign logic;
- `web app` will become the place where domain contracts are actually assembled;
- a giant shared package will replace bounded contexts in practice.

Cardfight!! Vanguard is especially sensitive to this problem because the platform has to model:

- content identity and print history;
- format-dependent legality;
- runtime gameplay behavior;
- phased support states;
- user-owned deck workflows.

Those concerns are connected, but they are not interchangeable. The only safe way to cross boundaries is through narrow, explicitly owned contracts.

### Decision 1: Shared-Contract Discipline Is Mandatory

Decision:

- Cross-context sharing must be restricted to a small, explicitly owned contract surface.

Rationale:

- Without contract discipline, bounded contexts become nominal only.

Practical implication:

- A context may consume another context's published contract.
- It must not import the other context's internal model because that model happens to be convenient.

## What Is a Shared Contract

A shared contract in this project is:

- a stable, minimal, explicitly published interface between bounded contexts.

It is not:

- an internal domain model;
- a repository or persistence model;
- a database schema;
- a UI model;
- a page payload;
- a raw importer record;
- a convenience type copied from another module.

### Decision 2: Shared Contracts Are Boundary Interfaces, Not Internal Data Shapes

Decision:

- A shared contract must be designed for cross-context consumption, not discovered accidentally from an internal implementation.

Rationale:

- Internal models optimize for the owning context.
- Shared contracts optimize for safe integration at the boundary.

Practical implication:

- If a type cannot be explained as a published boundary interface, it should not be shared across contexts.

## Required Shared Contracts

### Decision 3: The Allowed Core Shared Surface Is Intentionally Small

Decision:

- The current required shared-contract surface should be limited to:
- `card identity contract`
- `format profile contract`
- `deck snapshot contract`
- `legality validation-request contract`
- `legality result contract`
- `gameplay-facing card projection`
- `gameplay-facing format projection`

Rationale:

- These are the only cross-context contracts that the current architecture clearly needs as stable boundary interfaces.

Practical implication:

- Any proposed additional shared contract should be treated as an architecture change, not as a local convenience.

### A. Card Identity Contract

Owner:

- `catalog`

Consumers:

- `decks`
- `legality`
- `rules`
- `web app` where needed for orchestration

Why it exists:

- Different contexts need one stable gameplay-level way to refer to a card without importing the full catalog model.

What it includes:

- canonical-card identity;
- stable gameplay-facing identity keys that are explicitly part of the card identity policy;
- only the minimal identity-level fields needed for cross-context reference and rule attachment.

What it does not include:

- printing-level details;
- product or set metadata;
- search metadata;
- UI presentation fields;
- raw text or full catalog entity payloads unless separately published through another contract.

Policy note:

- This contract exports gameplay-level identity, not collection or printing identity.

### B. Format Profile Contract

Owner:

- `legality`

Consumers:

- `decks`
- `rules`
- `web app`

Why it exists:

- Multiple contexts need the same stable answer to "what format contract is being applied?" without each context inventing its own format model.

What it includes:

- stable format key;
- construction basis;
- deck-section structure contract;
- allowed-card-pool basis at the contract level;
- restriction attachment model at the contract level;
- abstract gameplay-facing hooks or markers needed by later gameplay consumers.

What it does not include:

- legality results;
- runtime gameplay state;
- UI labels as the primary contract;
- per-request support outcomes;
- internal restriction evaluator details.

Policy note:

- This document resolves the ownership gap from checkpoint-02: the published format-profile contract is owned by `legality`.
- `rules` may consume the published contract or a narrower gameplay-oriented projection of it, but it does not own the base format-profile contract.

### C. Deck Snapshot Contract

Owner:

- `decks`

Consumers:

- `legality`
- future gameplay entry flows and `rules`
- `web app` only for orchestration where necessary

Why it exists:

- Other contexts need an immutable, gameplay-relevant representation of a deck without depending on deck persistence internals, editor state, or UI models.

What it includes:

- deck section contents in a format-neutral structural shape;
- canonical-card references for entries;
- counts and section placement;
- only the minimum metadata needed to interpret the snapshot as a deck input.

What it does not include:

- database row shapes;
- page state;
- editor-local convenience data;
- resolved legality results;
- full catalog card payloads;
- preferred printing or collection ownership details unless a future explicit consumer need justifies it.

Policy note:

- The deck snapshot contract is a shared input, not the deck persistence model.
- Consumers must not depend on deck storage internals.
- The deck snapshot must not embed a resolved format profile. Format crosses the boundary through the published format contract or explicit validation or match context.

### D. Legality Validation-Request Contract

Owner:

- `legality`

Consumers:

- `decks`
- `web app`
- transport or application orchestration layers
- future gameplay-entry flows when they need legality invocation

Why it exists:

- The platform needs one canonical way to ask `legality` to evaluate a deck subject without sending raw editor state or storage-shaped payloads.

What it includes:

- a legality-owned invocation boundary built on a published deck snapshot;
- validation target semantics;
- only the minimum request context legality needs to interpret the evaluation attempt.

What it does not include:

- raw editor state;
- page-local validation modes;
- persistence rows;
- capability override flags;
- expected legality outcomes.

Policy note:

- `deck snapshot` is not the full legality input by itself.
- The legality validation request is the legality-owned input boundary built on top of the deck snapshot contract.

### E. Legality Result Contract

Owner:

- `legality`

Consumers:

- `decks`
- `web app`
- any API-facing orchestration layer
- future social or match-entry flows only if they need an admissibility result, not gameplay truth

Why it exists:

- The platform needs one stable, support-aware output for admissibility evaluation.

What it includes:

- structured legality status such as `valid`, `invalid`, `unsupported`, or `partially_supported`;
- checked stages summary;
- completeness and unresolved-check information;
- structured findings and references needed by consumers.

What it does not include:

- internal rule-execution structures;
- raw restriction-source internals;
- runtime gameplay conclusions;
- flattened boolean-only legality;
- UI-local formatting logic as the primary meaning of the result.

Policy note:

- This document resolves the ownership gap from checkpoint-02: `legality` owns legality result semantics and publication.
- `decks` may store or attach a legality result snapshot, but it does not own the contract meaning.

### F. Gameplay-Facing Card Projection

Owner:

- `catalog`

Consumers:

- `rules`
- future gameplay or match-room orchestration

Why it exists:

- The rules context needs gameplay-relevant card data, but it must not consume the full catalog model.

What it includes:

- canonical-card identity;
- gameplay-relevant card facts needed by rules;
- only the fields necessary for runtime validation, action handling, effect lookup, or gameplay interpretation.

What it does not include:

- printing history;
- product metadata not needed by gameplay;
- search and browse metadata;
- importer provenance;
- collection ownership data;
- full catalog projections used for UI browsing.

Policy note:

- This projection must stay intentionally smaller than the catalog model.
- If rules needs more data, the first question should be whether the new field is genuinely gameplay-relevant.

### G. Gameplay-Facing Format Projection

Owner:

- `rules`

Consumers:

- gameplay setup and runtime subsystems inside `rules`
- match-entry orchestration only when it needs gameplay-ready format input

Why it exists:

- The gameplay context needs a runtime-oriented format input that is narrower than the canonical format profile.

What it includes:

- runtime-relevant format identity;
- runtime zone or section activation meaning;
- runtime mechanic markers;
- setup-relevant format facts used by gameplay systems.

What it does not include:

- legality rules;
- restriction interpretation;
- card-pool definitions;
- UI metadata;
- runtime game state itself.

Policy note:

- This projection is a gameplay-owned derivative of canonical format meaning.
- It does not replace `format profile` as the cross-context canonical format contract.

## Ownership and Publication Rules

### Decision 4: Every Shared Contract Has Exactly One Owner

Decision:

- Each shared contract must have one owning context and one published source of truth.

Rationale:

- Shared ownership produces duplicated semantics and eventual divergence.

Practical implication:

- Consumers may read the contract.
- They may adapt it locally for their own use.
- They may not redefine or republish its meaning.

### Decision 5: Publication Must Happen Through the Owning Context's Public Boundary

Decision:

- A shared contract is published conceptually by the owning context, not by storage schemas, page models, or internal helper modules.

Rationale:

- Context boundaries are only real if the owner controls the outward interface.

Practical implication:

- Consumers should import a published contract surface, not deep internal types from the owner's implementation.

### Publication Rules by Contract

`card identity contract`

- Published by `catalog`
- Read-only to consumers
- Consumers may reference it, but may not reinterpret printing identity as gameplay identity

`format profile contract`

- Published by `legality`
- Read-only to consumers
- Consumers may resolve behavior from it, but may not fork their own format semantics

`deck snapshot contract`

- Published by `decks`
- Read-only to consumers
- Consumers may use it as shared deck input, but may not treat it as full legality invocation or deck persistence internals

`legality validation-request contract`

- Published by `legality`
- Read-only to consumers
- Consumers may build or transport it using legality-owned semantics, but may not invent local validation meanings

`legality result contract`

- Published by `legality`
- Read-only to consumers
- Consumers may display or cache it, but may not turn it into gameplay truth or redefine support semantics

`gameplay-facing card projection`

- Published by `catalog`
- Read-only to consumers
- Consumers may use it for runtime logic, but may not treat it as a full catalog replacement

`gameplay-facing format projection`

- Published by `rules`
- Read-only to consumers
- Consumers may use it for gameplay runtime input, but may not treat it as the canonical format profile

## What Must Not Be Shared

### Decision 6: Internal Models Must Not Cross Context Boundaries by Default

Decision:

- The following must not be treated as shared contracts.

Rationale:

- These objects are either too large, too unstable, or too tied to one context's internal concerns.

Practical implication:

- If another context needs one of these, a purpose-built published contract should be created instead.

Explicitly forbidden as shared contracts:

- the full catalog model inside `rules`;
- raw importer records outside `importer`;
- importer workflow state outside `importer`;
- UI models or page payloads as domain contracts;
- database schemas, table shapes, or repository records;
- internal legality evaluator logic or restriction-engine internals;
- full deck persistence models outside `decks`;
- printing-level data in gameplay or legality unless a future rule explicitly requires it;
- web-app-local composition objects as cross-context truth;
- ad hoc "temporary shared" helper types copied from one module into another.

## Contract Minimalism Rules

### Decision 7: Shared Contracts Must Be Smaller Than the Owner's Internal Model

Decision:

- Every shared contract should publish the least information necessary for cross-context use.

Rationale:

- Minimal contracts reduce coupling, version churn, and accidental dependency spread.

Practical implication:

- If a field is not needed by multiple consumers for boundary-safe work, it probably does not belong in the contract.

Minimalism rules:

- prefer identifiers, capability flags, and stable summaries over full objects;
- never include storage-specific fields unless they are part of the public contract by design;
- never include UI-only convenience fields;
- do not expose owner workflow state if a stable result or projection is enough;
- if a consumer needs one extra field, that alone is not enough reason to expand the contract;
- if in doubt, do not add the field.

## Evolution and Versioning (Conceptual)

### Decision 8: Shared Contracts Must Evolve Conservatively

Decision:

- Shared contracts are expected to evolve, but their meaning must remain stable across iterations unless a deliberate breaking change is approved.

Rationale:

- These contracts sit on architectural boundaries. Silent semantic drift causes cross-context breakage faster than local refactors do.

Practical implication:

- Prefer additive changes over semantic rewrites.
- Prefer new fields over changing the meaning of old fields.
- Treat breaking changes as architecture-level decisions, not routine cleanup.

Evolution rules:

- backward compatibility matters by default;
- deprecate before removing when practical;
- do not repurpose old fields to mean something new;
- if a contract outgrows its minimal role, split it rather than turning it into a grab-bag.

## Dependency Implications

### Decision 9: Contexts Depend on Published Contracts, Not on Internal Models

Decision:

- Cross-context dependency is allowed only through published contracts, stable read models, or explicit application-layer composition.

Rationale:

- This is the enforcement mechanism behind bounded contexts.

Practical implication:

- A context may depend on another context's published contract surface.
- It must not reach through that surface into internal models, storage, or workflow types.

Implications for current contexts:

- `decks -> legality` is allowed through published format contracts, legality validation requests, and `legality result contract`
- `decks -> catalog` is allowed through `card identity contract` and catalog read models
- `rules -> catalog` is allowed through `card identity contract` and `gameplay-facing card projection`
- `rules` uses `gameplay-facing format projection` for runtime input and must not consume raw `format profile` throughout engine internals
- `rules` must not consume `legality result contract` as gameplay truth
- `legality -> catalog` is allowed through `card identity contract` and format-relevant catalog facts
- `importer` publishes into catalog-facing ingestion contracts only; it does not publish runtime contracts to `rules` or `legality`
- `web app` may compose published contracts and read models, but it must not create new domain truth

## Examples

### Good Example 1: `decks -> legality` Through Deck Snapshot and Legality Result

- `decks` publishes an immutable deck snapshot.
- `legality` consumes that snapshot plus format input.
- `legality` returns a structured legality result.
- `decks` may attach or display the result, but does not redefine its meaning.

### Good Example 2: `rules -> catalog` Through Gameplay Projection

- `catalog` publishes a gameplay-facing card projection.
- `rules` consumes only the gameplay-relevant fields it needs.
- `rules` does not import printing history, product metadata, or search payloads.

### Good Example 3: `legality -> catalog` Through Identity

- `legality` reads canonical-card identity and format-relevant card facts.
- Restriction logic attaches to canonical-card identity or explicit gameplay rule keys.
- `legality` does not depend on importer records or full catalog browse models.

### Good Example 4: Importer Does Not Influence Rules Directly

- `importer` ingests a new set and normalizes source records.
- `catalog` publishes updated content contracts after normalization.
- `rules` only ever consumes catalog-published gameplay-facing data, never importer raw records.

### Bad Example 1: `rules` Reads Full Catalog Entity

- `rules` imports a full catalog card model because it already contains useful text, printing, product, and search fields.
- Result: gameplay becomes coupled to catalog internals and drags in non-gameplay concerns.

### Bad Example 2: UI Builds a Legality Result

- A page decides that unresolved checks "look fine" and produces a boolean `legal`.
- Result: the web app becomes a shadow legality engine and violates legality ownership.

### Bad Example 3: `decks` Stores Restriction Rules

- Deck persistence stores rule fragments or local restriction decisions to make editing easier.
- Result: deck context starts owning legality semantics and drifts away from the legality source of truth.

## Final Recommendations

### Recommendation 1: Keep the Shared Surface Small

- Treat the seven contracts in this document as the default maximum shared surface for the current phase.

### Recommendation 2: Enforce Single Ownership

- Every shared contract must have exactly one owning context and one published meaning.

### Recommendation 3: Prefer Projections Over Whole Models

- If a consumer needs data from another context, publish a narrow projection instead of sharing the owner's internal entity.

### Recommendation 4: Do Not Expand Contracts Casually

- New fields and new shared contracts should require explicit architectural justification.

### Recommendation 5: Use Contracts as the Only Legitimate Boundary-Crossing Mechanism

- Cross-context integration should happen through published contracts, explicit service boundaries, and application-layer composition, not through reach-through imports or copied internal types.
