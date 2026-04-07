# Capability Support Publication and Ownership

Status: Cross-context capability governance note  
Last updated: 2026-04-07

## Why This Document Exists

This note defines how the system should declare what it actually supports at a given point in time.

That is necessary because the platform will expand in uneven layers:

- one format may be structurally modeled before its legality is complete;
- deck building may be usable before gameplay exists;
- gameplay may support some mechanics while others remain unavailable;
- content coverage may exist without dependable legality or runtime support.

If capability support is not modeled and published explicitly, different parts of the system will guess:

- UI will invent local `supported` and `unsupported` logic;
- deck builder will hide or allow actions based on assumptions instead of contracts;
- legality will blur unsupported scope into invalidity;
- rules will silently try to execute mechanics the system does not actually support.

The result would be false confidence, inconsistent messaging, and hidden coupling across contexts.

### Decision 1: Capability Support Must Be an Explicit Published Layer

Decision:

- The platform must treat capability support as an explicit cross-context concern rather than an implicit side effect of code that happens to exist.

Rationale:

- A phased-support product needs an honest way to say what is dependable now, what is only partially dependable, and what is not available at all.

Practical implication:

- Support states must be published as shared contracts.
- Consumer contexts must read those contracts instead of reconstructing support heuristics locally.

## What a Capability Is

A `capability` in this project is:

- a declared system ability to provide dependable behavior for a specific subject and scope.

Examples:

- deck building for Standard;
- legality validation for Premium;
- ride deck handling for a supported deck-building flow;
- gameplay execution for a specific mechanic family;
- runtime trigger handling within a declared gameplay scope.

A capability is not:

- a feature toggle;
- a format profile;
- a legality result;
- a UI visibility flag;
- a roadmap promise;
- a proxy for content coverage in the catalog.

### Decision 2: Capability Statements Must Be Scoped

Decision:

- Capability support must always be declared for a specific subject and scope, not as a vague global boolean.

Rationale:

- "Gameplay is supported" is too ambiguous to be useful.
- The system needs to say what behavior is supported, for which format, and at what depth.

Practical implication:

- Good capability statements look like "Premium legality validation is partially supported" or "Standard gameplay setup is unsupported."
- Capability publication should not rely on coarse project-wide labels such as "gameplay = coming later."

### Decision 3: Capability Is About Dependable Behavior, Not About Existence of Data

Decision:

- Capability support describes whether the system can behave authoritatively for a requested area, not whether related data merely exists somewhere in storage.

Rationale:

- A format profile can exist before deck builder support exists.
- A card can exist in the catalog before gameplay support exists.

Practical implication:

- Presence in `catalog` does not imply capability support.
- Capability publication must remain separate from raw content coverage and importer progress.

## Capability Types

The project should think about capabilities in a few stable families.

### Format-Baseline Capabilities

These express whether the system can provide dependable format-level baseline behavior such as:

- resolved format identity;
- deck-structure baseline;
- format-aware construction basis;
- format-aware support messaging.

These are closely related to `format profile`, but they are not the same thing. `Format profile` defines what the format means. Capability support defines how fully the current system can operate against that meaning.

### Deck-Workflow Capabilities

These express whether the system can provide dependable deck workflows such as:

- create and edit a deck in a format;
- construct explicit deck sections;
- save and version format-bound deck snapshots;
- import or share a deck in a supported flow.

These are owned by the deck domain, not by UI pages.

### Legality Capabilities

These express whether the system can provide dependable legality behavior such as:

- structure validation;
- card-pool eligibility checks;
- restriction-list checks;
- special construction-rule support;
- overall legality validation for a declared scope.

### Gameplay Capabilities

These express whether the system can provide dependable runtime behavior such as:

- gameplay setup for a format;
- action validation;
- zone and phase handling;
- effect resolution;
- match-room runtime flow.

### Mechanic-Level Capabilities

These express whether a specific rule family or mechanic is supported within a broader capability area.

Examples:

- a deck-building mechanic constraint that affects deck structure;
- a legality rule family that is only partially modeled;
- a gameplay mechanic such as Stride or OverDress runtime handling.

### Decision 4: Mechanic-Level Capability Ownership Follows the Behavior Being Claimed

Decision:

- Mechanic-level capabilities do not create a separate ownership domain.
- Ownership follows the behavior being claimed.

Rationale:

- The same named mechanic may matter differently in deck editing, legality, and runtime gameplay.

Practical implication:

- A runtime mechanic capability belongs to `rules`.
- A legality rule-family capability belongs to `legality`.
- A deck-workflow capability belongs to `decks`.

## Support States

The system should use the same three support states already established in format and legality documents:

- `supported`
- `partially_supported`
- `unsupported`

### Supported

Definition:

- The system provides dependable behavior for the declared capability and scope.

Practical implication:

- The platform may present authoritative behavior for that capability within the declared boundary.

### Partially Supported

Definition:

- The system supports some but not all of the declared capability scope, and the limitation is known.

Practical implication:

- The platform may operate only within the supported subset.
- It must communicate what remains incomplete.

### Unsupported

Definition:

- The system does not provide a dependable contract for the declared capability and scope.

Practical implication:

- The platform must not behave as if the capability were authoritative.

### Decision 5: Support States Must Keep Their Existing Meanings Across Contexts

Decision:

- `supported`, `partially_supported`, and `unsupported` must mean the same thing across UI, decks, legality, and rules.

Rationale:

- The project already uses these states in legality and format modeling.
- Changing their meaning per context would destroy trust and make the same state label misleading.

Practical implication:

- No context may invent a local interpretation such as "unsupported but probably fine" or "partial means valid enough."

## Ownership Model

Capability ownership must be explicit and singular.

### Decision 6: Every Capability Has Exactly One Canonical Owner

Decision:

- Each published capability statement must have exactly one owning bounded context.
- Shared ownership is forbidden.

Rationale:

- If multiple contexts own the same capability status, they will eventually drift.

Practical implication:

- A capability may be consumed by many contexts, but it may be declared only by one owner.

### Ownership by Capability Family

| Capability family          | Canonical owner | Why                                                                                   |
| -------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| format-baseline capability | `legality`      | `legality` already owns published format semantics and admissibility baseline         |
| deck-workflow capability   | `decks`         | `decks` owns deck editing, deck versions, and deck snapshots                          |
| legality capability        | `legality`      | legality truth and legality-result semantics belong there                             |
| gameplay capability        | `rules`         | runtime gameplay truth belongs there                                                  |
| mechanic-level capability  | behavior owner  | ownership follows whether the mechanic is being claimed for decks, legality, or rules |

### Decision 7: Ownership Follows the Claimed Behavior, Not the Noun Mentioned in the Capability

Decision:

- Ownership should be assigned based on what the capability is claiming, not only on which format or mechanic name appears in the statement.

Rationale:

- "Premium gameplay support" refers to a format, but the claimed behavior is runtime gameplay, so `rules` owns it.
- "Standard deck building support" also refers to a format, but the claimed behavior is deck workflow, so `decks` owns it.

Practical implication:

- Mentioning `Standard`, `Premium`, `Stride`, or `OverDress` does not by itself determine ownership.

### Non-Owners

The following contexts must not own capability status:

- `web app`
- UI component layers
- `importer`
- raw persistence/storage layers

`catalog` may publish content and coverage facts that capability owners rely on, but it should not become the canonical owner of deck, legality, or gameplay capability support.

## Publication Model

Capability support must be published, not inferred.

### Decision 8: Capability Status Must Be Published Through a Shared Contract with a Common Vocabulary

Decision:

- Capability support should be exposed through a shared contract surface that uses common support-state language and owner-declared scope.

Rationale:

- Consumers need one stable way to read support truth without importing internal models from multiple contexts.

Practical implication:

Capability publication should conceptually expose at least:

- what capability is being claimed;
- what scope it applies to;
- which context owns it;
- which support state applies;
- what important limitation or declared boundary is in effect.

### Decision 9: Owner-Published Capability Declarations Are Canonical; Aggregated Views Are Read Models Only

Decision:

- The canonical truth for any capability comes from the owning bounded context.
- A combined capability view may exist for convenience, but it must remain a passive aggregation of owner-published declarations.

Rationale:

- The system needs one source of truth per capability, but consumers also need a coherent published surface.

Practical implication:

- A composed capability screen or API response may merge `decks`, `legality`, and `rules` declarations.
- That aggregation must not reinterpret or override the owner-declared status.

### Publication Does Not Mean Internal Model Exposure

Publishing capability support does not mean exposing:

- internal validation pipelines;
- runtime engine internals;
- page-level flags;
- database rows;
- hidden implementation detail from importer or storage layers.

Published capability support should be stable, minimal, and readable across contexts.

## Usage Across Contexts

### UI and Web App

UI should:

- read published capability support;
- show clear supported, partial, and unsupported messaging;
- enable, warn, or disable user flows based on published support;
- avoid claiming certainty when capability support is partial or unsupported.

UI must not:

- decide support state on its own;
- hardcode local support matrices as the source of truth;
- convert unsupported capability into misleading absence of UI without explanation.

### Decks

`decks` should:

- publish deck-workflow capability support for format-bound deck editing and related flows;
- read published format-baseline and legality capability support where those affect deck workflows;
- use capability status to block, warn, or downgrade specific deck actions.

`decks` must not:

- define legality support on behalf of `legality`;
- define gameplay support on behalf of `rules`;
- reinterpret canonical format support semantics locally.

### Legality

`legality` should:

- publish format-baseline and legality capability support;
- use published capability support to determine whether authoritative legality validation is possible for the requested scope;
- report unsupported and partially supported validation honestly.

`legality` must not:

- treat unsupported capability as invalid deck quality;
- infer gameplay support from legality support;
- assume that a structurally supported format implies full restriction or rule-family support.

### Rules

`rules` should:

- publish gameplay and runtime mechanic capability support;
- use published support to determine whether gameplay setup, action validation, or effect resolution may run authoritatively.

`rules` must not:

- infer runtime support from catalog presence;
- infer runtime support from legality support alone;
- quietly execute unsupported runtime mechanics.

## Relationship with Legality

Capability support and legality results are related, but they are not the same contract.

### Decision 10: Capability Status Is Upstream Input to Legality Interpretation, Not a Replacement for Legality Result

Decision:

- Capability support informs what legality can honestly evaluate.
- Legality result remains the separate output contract that states what the system can assert about a specific deck in a specific validation context.

Rationale:

- Capability support describes platform readiness.
- Legality result describes the outcome of a specific evaluation attempt.

Practical implication:

- `unsupported` capability is not the same thing as `invalid`.
- `partially_supported` capability does not imply a positive legality result.

### Capability Support and Legality Result Must Stay Aligned

If legality capability is `unsupported` for the requested scope:

- legality should not assert overall legality;
- legality should return `support_status = unsupported`;
- legality should avoid framing the deck as invalid unless a separate authoritative failure is already known from a supported check set.

If legality capability is `partially_supported`:

- legality may evaluate supported check groups;
- legality may still assert `illegal` if a known authoritative failure exists;
- legality must not assert `legal` unless the requested scope is fully supported and fully evaluated.

## Anti-Patterns

The following practices are explicitly prohibited:

- UI decides `supported` or `unsupported` by local hardcoded rules.
- `decks` maintains its own private legality-capability matrix.
- `rules` ignores published capability support and attempts runtime behavior anyway.
- capability status is scattered across page code, hooks, services, and tests without one published declaration.
- capability status is treated as a feature toggle system.
- capability status is embedded directly into `catalog` as if content presence defined runtime or legality support.
- unsupported capability is translated into invalidity.
- partial support is translated into "good enough to claim legal."
- a combined capability view rewrites or overrides owner-declared support.

## Evolution Policy

Capability support will change over time as the platform grows.

### Decision 11: New Capabilities Must Be Added Through the Canonical Owner, Not Through Consumer Workarounds

Decision:

- New capability statements must be introduced by the bounded context that owns the behavior being claimed.

Rationale:

- Growth should extend the canonical support model, not create shadow support logic in consuming contexts.

Practical implication:

- If `rules` adds a new mechanic family, `rules` must publish that support explicitly.
- If `legality` deepens support for a restriction family, `legality` must publish the changed support state explicitly.

### Decision 12: Prefer Additive Evolution Over Semantic Reinterpretation

Decision:

- Capability publication should evolve by adding new explicitly scoped capabilities or by moving a declared capability from partial to supported.
- Existing support-state meanings should not be repurposed.

Rationale:

- Stable contract meaning is more important than short-term convenience.

Practical implication:

- Prefer "this capability is now supported" over redefining what `supported` meant last month.
- Prefer adding a new mechanic-level capability over smuggling that nuance into unrelated capability text.

### Decision 13: Capability Granularity Should Grow Only When It Clarifies Real Boundaries

Decision:

- The platform should introduce finer-grained capabilities only when they express a real support boundary that consumers need to understand.

Rationale:

- Capability publication should stay useful and small, not turn into an uncontrolled matrix of pseudo-features.

Practical implication:

- Do not split capabilities unless that split changes user messaging, legality interpretation, gameplay safety, or integration behavior.

## Examples

### Example 1: Premium Gameplay Is Unsupported

- `rules` publishes that Premium gameplay setup and runtime execution are `unsupported`.
- UI shows that gameplay is unavailable for Premium.
- `decks` may still allow Premium deck editing if its own deck-workflow capability is supported.
- `legality` may still validate Premium at its own declared support level.

### Example 2: Premium Legality Is Partially Supported

- `legality` publishes Premium legality as `partially_supported`.
- The reason is that structure and card-pool checks are supported, but one restriction family is incomplete.
- UI shows a partial-support warning.
- A legality result for a Premium deck may return `support_status = partially_supported`.
- The system must not present that deck as fully verified legal.

### Example 3: Standard Deck Building Is Supported While Gameplay Is Unsupported

- `decks` publishes Standard deck editing and saving as `supported`.
- `rules` publishes Standard gameplay runtime as `unsupported`.
- Users can build and save Standard decks.
- Match-room startup remains unavailable or clearly marked unsupported.

### Example 4: Unsupported Mechanic Must Not Be Executed

- `rules` publishes a runtime mechanic family as `unsupported`.
- A match-room or gameplay setup flow sees that support state and refuses authoritative execution for that mechanic.
- The system does not attempt fallback behavior that pretends the mechanic works.

### Example 5: Bad Local Guessing in UI

- UI hides a gameplay button because a page-level hardcoded list says Premium is unsupported.
- `rules` later publishes partial support for Premium setup.
- The page stays wrong because it never read published capability truth.

That is an architecture failure. UI must read published capability state rather than preserve private assumptions.

## Final Recommendations

- Treat capability support as a mandatory cross-context honesty layer.
- Keep capability distinct from format profile, legality result, and catalog coverage.
- Require every capability statement to have exactly one owner.
- Publish support states through stable shared contracts using the common vocabulary `supported`, `partially_supported`, and `unsupported`.
- Let `decks`, `legality`, and `rules` own capability status only for the behaviors they actually own.
- Let UI and other consumers read and present capability support, but never define it.
- Keep aggregated capability views passive and read-only.
- Use capability support to prevent false authority claims, especially around legality and gameplay.

## Open Questions We Intentionally Leave for Later

- whether the first implementation exposes capability publication as one aggregated read surface, several owner-published read surfaces, or both;
- how capability declarations should reference content-coverage slices when support depends on phased ingestion;
- whether social and match-history workflows eventually need their own published capability families;
- how capability publication should be cached or versioned operationally once APIs and packages are implemented.
