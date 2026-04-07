# Format Profile Ownership and Publication

Status: Cross-context contract governance note  
Last updated: 2026-04-07

## Why This Note Exists

This note defines who owns the `format profile`, how it is published, and how other contexts are allowed to consume it.

This is necessary because `format profile` is one of the most sensitive shared contracts in the system. It affects:

- deck structure;
- legality interpretation;
- future gameplay setup;
- cross-context consistency for Standard, V Premium, and Premium;
- future format expansion.

If ownership and publication stay implicit, the same format will be interpreted differently by different modules:

- `decks` will invent local structure rules;
- `legality` will drift from the shared contract into a private format model;
- `rules` will create a separate incompatible meaning of the same format;
- `web app` will move format logic into pages and UI state.

That would make `format profile` functionally equivalent to "enum + scattered conditions," which is exactly what the architecture is trying to avoid.

### Decision 1: `Format Profile` Requires Explicit Ownership and Publication Governance

Decision:

- The project should treat `format profile` as a governed shared contract with one canonical owner and one published meaning.

Rationale:

- Format semantics are too foundational to be reconstructed independently by consumers.

Practical implication:

- No consumer context may define its own canonical version of Standard, V Premium, Premium, or future formats.

## What a Format Profile Means in This Project

A `format profile` in this project is:

- the structured domain contract that describes what a format means at cross-context level.

It answers questions such as:

- what deck structure baseline exists;
- what construction basis applies;
- what kind of card-pool model applies;
- how restrictions attach conceptually;
- which high-level gameplay-relevant differences matter for downstream consumers.

It is not:

- an era;
- a UI label;
- a legality result;
- runtime game state;
- a full rulebook;
- a page-level configuration object.

### Decision 2: Format Profile Is a Shared Baseline Contract, Not a Full Rules Implementation

Decision:

- `format profile` should remain a high-level cross-context contract that describes format semantics without becoming a full legality engine or a full gameplay engine.

Rationale:

- The contract must be stable enough for multiple consumers.
- If it carries too much runtime detail, it becomes fragile and overburdened.

Practical implication:

- `format profile` may include gameplay-relevant markers or hooks.
- It must not become a dumping ground for full runtime sequencing or effect behavior.

### Conceptual Scope of a Format Profile

The canonical published profile should cover at least:

- stable format key;
- deck structure baseline;
- construction basis such as nation-based or clan-based;
- allowed card-pool basis at contract level;
- restriction attachment reference points;
- high-level gameplay-relevant format markers needed for downstream selection or branching.

## Canonical Ownership Decision

### Decision 3: The Canonical Owner of the Published Format Profile Contract Is `legality`

Decision:

- The `legality` bounded context is the canonical owner of the published `format profile` contract.

Rationale:

- The current architecture does not define a separate `format` bounded context.
- The most stable existing home for cross-context format semantics is `legality`, because format profile primarily governs admissibility baseline, construction basis, deck structure contract, and restriction attachment rules.
- This keeps format meaning anchored in a domain context rather than in UI, deck storage, or runtime gameplay internals.

Practical implication:

- The canonical published meaning of Standard, V Premium, Premium, and future formats is owned and published by `legality`.
- Other contexts may consume or derive from that meaning, but may not republish a competing canonical definition.

### Decision 4: Ownership of Format Profile Does Not Mean Ownership of Every Format-Related Behavior

Decision:

- `legality` owns the canonical published format-profile contract, but it does not automatically own every internal format-related behavior in other contexts.

Rationale:

- `rules` still owns runtime adapters and runtime behavior.
- `decks` still owns deck storage and deck snapshots.
- `web app` still owns presentation.

Practical implication:

- Ownership of the base contract is centralized.
- Context-specific derived interpretations remain local, but they must be derived from the canonical published profile rather than redefining it.

### Why Ownership Must Not Be Shared

Shared ownership between `decks`, `legality`, and `rules` would fail for predictable reasons:

- `decks` would optimize the profile around editing workflows and structure helpers;
- `legality` would optimize it around validation;
- `rules` would optimize it around runtime behavior;
- the same format would drift into three subtly different models.

One owner is required to prevent semantic fork.

## Publication Model

### Decision 5: Format Profile Must Be Published as a Stable Shared Contract Surface

Decision:

- `legality` should publish `format profile` through a narrow, stable, context-facing contract surface.

Rationale:

- Publication is how the owner exposes format meaning without exposing internal logic.

Practical implication:

- Consumers should receive a published format-profile contract, not deep legality internals, not page-local derived objects, and not ad hoc storage records.

### Publication Does Not Equal Internal Implementation Exposure

Publication means:

- the owning context provides the canonical shared contract;
- consumers depend on that published surface;
- internal evaluators, helper logic, storage shapes, or support-resolution details remain internal unless explicitly published.

Publication does not mean:

- consumers can import legality internals freely;
- all format-related logic becomes public;
- the owner gives up control over contract evolution.

### Public Shared Surface

The shared surface of `format profile` should remain intentionally narrow.

It should publish:

- stable format identity;
- canonical structural baseline for deck sections;
- construction-basis policy markers;
- allowed card-pool basis markers;
- restriction-attachment baseline;
- high-level gameplay-relevant markers needed by consuming contexts.

It should not publish as part of the core profile:

- legality results;
- runtime state logic;
- internal rule-evaluation pipelines;
- per-request validation outcomes;
- UI-local labels as the canonical contract;
- full capability matrices if those are better published as adjacent support metadata.

### Decision 6: Capability Support Metadata Is Adjacent to Format Profile, Not the Same Thing

Decision:

- Capability support or support-state metadata should be treated as adjacent to the core format profile, not as the same thing as canonical format meaning.

Rationale:

- "What the format is" and "how fully the system supports this capability right now" are related but different concerns.

Practical implication:

- Consumers must not treat support metadata as if it defines format semantics.
- If support metadata is published, it must attach to the canonical format key rather than redefine the format locally.

## Shared Surface vs Internal Interpretation

### Decision 7: Consumers May Derive from the Published Profile, but Must Not Redefine It

Decision:

- Contexts may build local helpers, projections, or adapters derived from the published format profile.
- They must not redefine the canonical meaning of that format.

Rationale:

- Derived interpretation is necessary for context-specific work.
- Local canonical semantics would create semantic drift.

Practical implication:

- Derivation is allowed.
- Reinterpretation of canonical format meaning is not.

### What Is Shared

- published format key;
- published section baseline;
- published construction-basis meaning;
- published allowed-pool basis markers;
- published restriction attachment baseline;
- published gameplay-facing format markers where explicitly part of the shared contract.

### What Remains Internal

Within `legality`:

- restriction evaluator internals;
- validation strategy;
- support-resolution logic unless explicitly published separately;
- local optimization structures.

Within `rules`:

- runtime format adapters;
- runtime sequencing and state-transition behavior;
- gameplay-only projections derived from canonical format profile.

Within `decks`:

- editor helpers;
- deck-construction UI behavior;
- persistence internals;
- deck snapshot assembly internals.

Within `web app`:

- presentation grouping;
- labels and display mapping;
- route and page composition behavior.

### Decision 8: Internal Derivations Must Preserve Canonical Meaning

Decision:

- A local helper or adapter may narrow or project the published profile for local use, but it must remain semantically compatible with the canonical published profile.

Rationale:

- Safe local derivation preserves boundaries without blocking practical work.

Practical implication:

- If a local helper needs to contradict the published profile, the contract is wrong or incomplete and should be revised centrally.

## Consumer Responsibilities

### A. Decks

Responsibilities:

- store a format key or other stable reference to the published format profile as part of persisted deck versions;
- use published format profile to determine expected structural guidance;
- build deck snapshots against the attached canonical format meaning.

What `decks` may do:

- create local structure helpers derived from the published profile;
- use the published section baseline to drive draft or builder behavior.

What `decks` must not do:

- define its own canonical meaning of Standard, V Premium, or Premium;
- silently change section semantics locally;
- store deck structure assumptions that conflict with the published profile.

### B. Legality

Responsibilities:

- own and publish canonical format-profile meaning;
- use that profile as baseline input for validation context and admissibility evaluation.

What `legality` may do:

- derive internal validation helpers and rule-loading behavior from the published profile;
- publish adjacent capability-support metadata if the architecture later decides to expose it from the same context.

What `legality` must not do:

- treat its internal evaluation details as if they were the shared format profile itself;
- blur format semantics into per-request legality results.

### C. Rules

Responsibilities:

- consume the published format profile or a narrower gameplay-oriented projection of it;
- use canonical format meaning as baseline input for runtime adapter selection or gameplay setup.

What `rules` may do:

- implement runtime format adapters;
- derive gameplay-focused format projections from the canonical profile.

What `rules` must not do:

- define a competing canonical Standard, Premium, or V Premium model;
- ignore published structure or construction meaning and replace it with runtime-only assumptions;
- treat runtime adapters as canonical format ownership.

### D. Web App

Responsibilities:

- read published format-profile data for presentation, composition, and user-facing guidance.

What `web app` may do:

- show labels, available sections, and format-aware hints based on the published profile;
- compose profile-derived read models for pages.

What `web app` must not do:

- own or mutate canonical format semantics;
- keep local page-only format rules that contradict the published profile;
- decide format behavior by hardcoded conditions because the page needs them quickly.

### E. Importer

Responsibilities:

- reference format-related identifiers only when needed for ingestion alignment, coverage tagging, or downstream routing.

What `importer` may do:

- use format keys or format references as metadata where appropriate.

What `importer` must not do:

- publish canonical format definitions;
- define format semantics through importer source shape;
- become the place where new formats are effectively invented.

## Anti-Patterns to Avoid

### Decision 9: Multiple Canonical Meanings of the Same Format Are Architecture Violations

Decision:

- The following patterns should be treated as invalid architecture moves.

Rationale:

- Each of them recreates semantic fork around the most foundational cross-context contract.

Practical implication:

- If one of these appears, the fix is contract correction, not local workaround layering.

Anti-patterns:

- `decks` defining its own format semantics;
- `legality` becoming the de facto owner of format meaning without publishing a stable shared contract;
- `rules` ignoring the canonical format profile and inventing incompatible runtime semantics for the same format key;
- `web app` storing and mutating format rules locally;
- multiple modules defining "Standard" differently;
- treating `format profile` as an enum plus scattered `if format == ...` conditions;
- expanding `format profile` until it becomes a dumping ground for all gameplay and legality logic;
- publishing support-state results as if they were canonical format meaning;
- letting page payloads or database rows become the effective format contract.

## Evolution and Extension Policy

### Decision 10: New Formats and Format Variants Must Enter Through Canonical Publication

Decision:

- New formats or new supported variants must be introduced through the canonical owner and published contract surface, not through local consumer patches.

Rationale:

- Distributed local additions produce semantic divergence immediately.

Practical implication:

- Adding a new format should update the canonical publication first.
- Consumers then adapt against that shared baseline.

### Decision 11: Semantic Changes Must Be Intentional and Centralized

Decision:

- Changes to existing format meaning must be treated as deliberate contract evolution, not incidental local behavior changes.

Rationale:

- Format semantics sit at the center of decks, legality, and future gameplay.

Practical implication:

- If Standard, V Premium, or Premium meaning changes in the contract, that should be visible as a canonical owner decision and not as scattered consumer fixes.

### Extension Rules

- prefer additive published fields over changing the meaning of old ones;
- keep base profile meaning stable and explicit;
- add new gameplay-oriented derivations in `rules` only after the canonical baseline is clear;
- add new support metadata beside the canonical profile rather than hiding it in consumer code;
- if a format variant is materially different, model it as a distinct canonical profile or explicit canonical variant, not as hidden local flags.

## Examples

### Good Example 1: Deck Builder Uses Published Standard Profile

- `decks` reads the published Standard profile.
- It knows that `ride_deck` is part of baseline structure because the canonical contract says so.
- The deck builder does not invent a separate Standard-specific structure model locally.

### Good Example 2: Legality Validates Premium Without Owning All Premium Behavior

- `legality` uses the published Premium profile as canonical input.
- It applies validation and restriction logic using that baseline.
- It does not treat internal validation helpers as the public definition of Premium.

### Good Example 3: Rules Selects a Premium Adapter from the Canonical Baseline

- `rules` receives the canonical Premium format profile or a published gameplay-facing projection derived from it.
- It selects a Premium runtime adapter based on that baseline.
- The adapter remains a runtime interpretation layer, not a second canonical owner of Premium.

### Good Example 4: UI Shows Sections Without Owning Format Logic

- `web app` reads the published profile and shows that Standard has `main_deck` plus `ride_deck`.
- The page presents those sections, but does not own the rule that they exist.

### Good Example 5: A New Format Is Added Through Canonical Publication

- The team adds a future format or explicit format variant.
- The new profile is introduced through canonical publication by the owner.
- `decks`, `legality`, `rules`, and `web app` then adapt against the same shared definition.

### Bad Example 1: Rules Hardcodes a Different Standard

- `rules` assumes a Standard behavior that conflicts with the published profile used by `decks` and `legality`.
- Result: the same `format key` now means different things in different contexts.

### Bad Example 2: Deck Editor Treats Format as Local UI Config Only

- A deck page stores a local toggle that changes available sections without using the canonical published profile.
- Result: UI becomes a shadow owner of format semantics.

### Bad Example 3: Legality Redefines Deck Structure Internally

- `legality` decides that a format should have different sections than the published profile already says.
- Result: the owner has forked its own public contract internally, which breaks trust in the publication model.

## Final Recommendations

### Recommendation 1: Keep `legality` as the Canonical Owner of the Published Format Profile

- One owner is required.
- In the current bounded-context map, `legality` is the correct owner of canonical published format meaning.

### Recommendation 2: Publish a Narrow, Stable Format Contract

- Publish only the cross-context baseline needed by `decks`, `rules`, and `web app`.
- Keep evaluators, runtime adapters, and per-request outcomes outside the core published profile.

### Recommendation 3: Allow Derived Interpretation, Forbid Semantic Fork

- Consumers may derive helpers, adapters, and projections from the published format profile.
- They must not redefine Standard, V Premium, Premium, or future formats locally.

### Recommendation 4: Keep Support Metadata Adjacent, Not Substitutive

- Capability support can be published beside the canonical profile.
- It must not replace or redefine canonical format meaning.

### Recommendation 5: Route Format Evolution Through Canonical Publication

- New formats, format variants, and semantic changes must go through the owner and the published contract surface first, then flow outward to consumers.

## Open Questions We Intentionally Leave for Later

- whether capability-support metadata should be published from `legality` directly or from a narrower capability-resolution layer within the same ownership boundary;
- the exact published gameplay-facing projection of format profile used by future runtime adapters;
- the exact repository or package location of the published format contract inside the monorepo;
- how localized or user-facing labels should be layered over canonical format keys without polluting the shared contract;
- whether future format-variant lineage needs a separate contract beyond the base format profile.
