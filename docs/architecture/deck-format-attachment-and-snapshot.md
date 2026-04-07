# Deck-Format Attachment and Deck Snapshot Contract

Status: Cross-context deck contract  
Last updated: 2026-04-07

## Why This Contract Exists

This document defines:

- how a deck attaches to a format;
- what the platform means by a `deck snapshot`;
- how `decks`, `legality`, `rules`, and `web app` should consume deck data without leaking internal models across boundaries.

This contract is necessary because a deck in this project is not "just a list of cards." A Vanguard deck is meaningful only relative to:

- a format contract;
- a format-defined deck structure;
- gameplay-level card identity;
- downstream consumers such as legality and future gameplay.

Without a formal attachment and snapshot model, different contexts will inevitably interpret the same deck differently:

- `decks` will treat it as editor state or persistence rows;
- `legality` will reconstruct structure ad hoc;
- `rules` will be tempted to consume storage models directly;
- `web app` will fill the gaps with page-level assumptions.

That would recreate exactly the coupling risks identified in checkpoint-02.

## The Problem We Need to Solve

The architecture must clearly separate at least four different things:

- stored deck entity or deck version;
- editable deck state in a builder;
- shared cross-context deck representation;
- runtime gameplay state.

If they are flattened into one model, the system will quickly accumulate:

- format ambiguity;
- duplicated legality logic;
- UI-shaped deck models;
- accidental dependence on persistence shape;
- future rules integration pain.

### Decision 1: Decks Need an Explicit Format Attachment Model and a Separate Snapshot Contract

Decision:

- The project should treat format attachment and deck snapshot publication as explicit domain contracts, not as implicit behavior hidden in UI or storage.

Rationale:

- A deck's meaning changes materially when format changes.
- Cross-context consumers need one stable, minimal deck input model.

Practical implication:

- `decks` owns stored deck objects and publishes deck snapshots.
- `legality` consumes legality requests built on those snapshots instead of deck persistence or editor state.
- future `rules` consume snapshots as gameplay setup input, not as deck storage models.

## Deck-to-Format Attachment Policy

### Decision 2: Every Persisted Deck Version Must Have Exactly One Attached Format Key

Decision:

- A persisted deck version must have exactly one explicit attached `format key`.

Rationale:

- Format determines deck structure, admissibility basis, and later gameplay interpretation.
- A saved deck without an attached format is too ambiguous to be a stable cross-context object.

Practical implication:

- Persisted deck versions, shared decks, and legality-ready deck inputs are always format-bound.
- A saved deck version is not allowed to be "formatless."

### Decision 3: Formatless or Ambiguous Deck States Are Allowed Only as Transient Draft or Import States

Decision:

- A deck may temporarily exist without a resolved format only inside draft-editing or import-staging flows.

Rationale:

- Early user input and imported lists may be incomplete or ambiguous.
- That is a workflow concern, not a canonical deck contract.

Practical implication:

- `formatless draft` and `ambiguous import candidate` are not canonical deck versions.
- They are not valid deck snapshots for legality or gameplay consumers.

### Decision 4: Format Attachment Is Part of a Deck Version's Meaning, Not a Mere View Preference

Decision:

- Format attachment should be treated as part of the domain meaning of a deck version, not as a lightweight display filter.

Rationale:

- Standard, V Premium, and Premium imply different sections, construction constraints, and downstream interpretation.

Practical implication:

- Changing format on a saved deck version is not a harmless toggle.
- It changes the semantics of the object enough to require deliberate handling.

### Decision 5: One Deck Version Belongs to One Format; Cross-Format Equivalents Should Be Modeled as Variants

Decision:

- A single deck version belongs to exactly one format at a time.
- The same conceptual archetype across different formats should be represented as separate format-bound variants.

Rationale:

- Cross-format equivalence is conceptual, not structural.
- Forcing one deck version to represent multiple formats would blur structure, legality, and sharing semantics.

Practical implication:

- Standard and Premium versions of the "same deck idea" should be separate persisted variants or branches.
- They may be linked by lineage later, but they should not be one mutable multi-format object.

### Decision 6: Format Switching After Persistence Should Default to Forking, Not In-Place Mutation

Decision:

- Once a deck version is persisted or shared, changing its format should default to creating a new variant or branch rather than mutating the existing version in place.

Rationale:

- In-place format mutation destroys the meaning of saved legality history, structure assumptions, and shareable deck identity.

Practical implication:

- A builder may offer a "convert" or "copy to new format variant" flow.
- Unsaved draft state may still change format freely before it becomes a canonical persisted version.

### Attachment State Model

The architecture should recognize these conceptual states:

- `format-unresolved draft`
- `format-attached draft`
- `persisted format-bound deck version`
- `shared format-bound deck version`
- `legality target` derived from a format-bound snapshot
- `gameplay-prepared input` derived from a format-bound snapshot

Only the first state is allowed to be format-unresolved.

## Deck Structure Under a Format

### Decision 7: Deck Structure Is Controlled by the Attached Format, Not by UI Assumptions

Decision:

- A deck's expected sections and structural interpretation are determined by its attached format contract.

Rationale:

- Main deck, ride deck, G deck, and future format-defined sections are not presentation choices.
- They are part of the domain meaning of the deck.

Practical implication:

- `decks` stores sectioned deck content.
- `format profile` plus `legality` define what section set is allowed or required.
- `web app` must not guess sections from current UI.

### Decision 8: Deck Representation Must Make Format-Bound Structure Explicit

Decision:

- Deck structure must be explicit in deck representations intended for cross-context use.

Rationale:

- Implicit or guessed structure makes legality and future gameplay setup fragile.

Practical implication:

- A deck snapshot should represent sections directly.
- Required sections should be explicit even when currently empty in a draft or invalid deck state.
- Disallowed sections must not appear.

## What a Deck Snapshot Is

### Decision 9: A Deck Snapshot Is the Published Cross-Context Deck Input

Decision:

- A `deck snapshot` is the minimal, stable, cross-context representation of a deck in a chosen format, published by the `decks` context for downstream consumers.

Rationale:

- Other contexts need a deck input that is independent of:
- editor state;
- storage rows;
- social decoration;
- UI composition;
- gameplay runtime state.

Practical implication:

- `legality` consumes a deck snapshot rather than deck persistence internals.
- Future gameplay entry should consume a deck snapshot or a derived gameplay-prepared input, not the full stored deck model.

### Decision 9A: Deck Snapshot Is Shared Deck Input, Not Full Legality Invocation

Decision:

- A `deck snapshot` is the shared deck input contract, not the full legality invocation contract.

Rationale:

- `legality` also owns validation target semantics and evaluation context meaning.
- Collapsing deck snapshot and legality request would blur `decks` ownership with `legality` ownership.

Practical implication:

- `decks` publishes the snapshot.
- callers build a `legality validation request` on top of that snapshot when they want admissibility evaluation.

### Deck Snapshot Is Not

A deck snapshot is not:

- the stored deck entity;
- the editable builder state;
- the page-level form model;
- the persistence schema;
- a social preview payload;
- a legality result;
- gameplay runtime state.

## What a Deck Snapshot Must Contain

### Decision 10: A Deck Snapshot Must Carry Format Reference and Explicit Sections

Decision:

- A valid deck snapshot must carry the attached format reference and an explicit sectioned deck structure.

Rationale:

- Downstream consumers cannot interpret deck composition safely without format and section boundaries.

Practical implication:

- The deck snapshot contract must include a stable `format key` or equivalent format reference.
- It must not embed a resolved format profile object.

### Required Conceptual Elements

The deck snapshot should contain at least:

- optional source reference to the originating deck and or deck version when such traceability exists;
- attached format reference using the published format key;
- explicit deck sections keyed by format-defined section identities;
- canonical-card references for entries;
- counts per entry;
- section placement as part of the deck meaning;
- only the minimum metadata required for downstream consumers to interpret the snapshot as a deck input.

### Decision 11: Canonical Card Identity Is the Only Default Card Reference in the Snapshot

Decision:

- Deck snapshot entries should reference canonical-card identity by default.

Rationale:

- Deck construction, legality, and future gameplay all depend on gameplay identity, not printing identity.

Practical implication:

- Snapshot entries do not use printing ids as their default card reference.
- Presentation preferences such as preferred printing belong elsewhere.

### Decision 12: Snapshot May Represent an Incomplete or Invalid Deck, but It Must Still Be Structurally Explicit

Decision:

- A deck snapshot may represent a draft or invalid deck under its attached format, as long as format attachment is explicit and section/card references are resolved well enough to publish the snapshot.

Rationale:

- Legality needs to evaluate incomplete or invalid decks during editing.
- That does not require a weaker contract. It requires an explicit one.

Practical implication:

- Missing required cards or empty required sections do not prevent snapshot publication.
- Unknown format or unresolved card identity does prevent a valid deck snapshot.

## What a Deck Snapshot Must Not Contain

### Decision 13: Deck Snapshot Must Exclude UI, Persistence, and Foreign Context Noise

Decision:

- The deck snapshot must not carry fields that belong to editor convenience, persistence internals, social decoration, importer provenance, or legality result semantics.

Rationale:

- Extra fields create coupling and tempt downstream consumers to depend on the wrong layer.

Practical implication:

- If another context needs one of those fields, it should consume a different published contract.

The deck snapshot must not include:

- UI editor state;
- sorting preferences;
- search filters;
- temporary client flags;
- local dirty-state markers;
- persistence-specific row shapes or storage internals;
- importer provenance;
- full printing catalog data unless a future explicit rule requires it;
- social-facing decoration fields not needed downstream;
- legality results or legality support outcomes;
- gameplay runtime state or gameplay event data;
- resolved format profile objects.

## Snapshot Lifecycle

### Decision 14: Deck Snapshot Is Assembled by the Decks Context, Not by UI or Legality

Decision:

- The `decks` context is responsible for assembling and publishing deck snapshots from deck-owned state.

Rationale:

- Snapshot publication is part of deck boundary ownership.
- If UI or legality assemble snapshots independently, the contract will fork immediately.

Practical implication:

- `web app` may request or transport a snapshot.
- `legality` may consume it.
- Neither should define its shape independently.

### Lifecycle Model

1. User edits a draft or an imported list enters staging.
2. Once a format is attached and card identities are resolved to canonical cards, `decks` can assemble a valid deck snapshot.
3. `legality` may evaluate that snapshot in a validation context.
4. Future gameplay entry may derive a gameplay-prepared input from that snapshot plus other published contracts.
5. Social or sharing surfaces usually consume a dedicated preview model, not the raw deck snapshot, even if both derive from the same stored deck version.

### Decision 15: Not Every Draft State Produces a Valid Deck Snapshot

Decision:

- A partially complete editor state may produce a valid deck snapshot only after format attachment and card-reference resolution are explicit enough for downstream use.

Rationale:

- Downstream consumers need a stable contract, not a partially assembled page state.

Practical implication:

- A draft with unresolved format or unresolved card identity remains editor or import state, not a deck snapshot.
- A draft with attached format and explicit section entries may publish a snapshot even if the deck is still incomplete or invalid.

## Relationship to Legality

### Decision 16: Legality Consumes Deck Snapshot; It Does Not Own Deck Storage

Decision:

- `legality` reads a published deck snapshot and evaluates it in a separate validation context.

Rationale:

- This keeps legality independent from deck persistence and editor implementation.

Practical implication:

- `legality` should not reconstruct deck meaning from UI state or database rows.
- It should receive deck input through the deck snapshot contract as part of a legality validation request.

### Decision 17: Deck Snapshot, Legality Request, and Legality Result Are Separate Contracts

Decision:

- A deck snapshot is the shared deck-input contract.
- A legality validation request is the legality-owned invocation contract built on that deck input.
- A legality result is the output contract from legality.

Rationale:

- Input and output ownership must remain separate to avoid cross-context leakage.

Practical implication:

- `decks` may publish deck snapshots and later store or display legality results, but legality request and legality-result semantics remain owned by `legality`.

### Decision 18: Incomplete Deck Snapshot Is Not the Same as Unsupported Legality

Decision:

- A structurally explicit but incomplete deck snapshot may still be evaluated by legality and may produce an `invalid`, `unsupported`, or `partially_supported` outcome depending on the known rules and support scope.
- Unsupported legality remains a capability statement about the system, not a property of the snapshot itself.

Rationale:

- Snapshot quality and legality support are different axes.

Practical implication:

- Do not label a deck snapshot itself as unsupported when the real issue is incomplete legality coverage.

## Relationship to Rules / Gameplay

### Decision 19: Rules Must Not Consume the Full Stored Deck Model

Decision:

- Future `rules` or gameplay entry must consume a deck snapshot or a derived gameplay-prepared deck input, not the full stored deck model.

Rationale:

- Gameplay should depend on stable cross-context inputs, not persistence internals or editor concerns.

Practical implication:

- Match setup should begin from deck snapshot plus other published contracts, not from deck database rows or page state.

### Decision 20: Deck Snapshot Is Not Gameplay State

Decision:

- A deck snapshot is deck input, not runtime game state.

Rationale:

- Gameplay state includes zones, turn state, actions, choices, and runtime effects.
- A deck snapshot only describes the deck before those runtime structures exist.

Practical implication:

- Future gameplay setup may transform a deck snapshot into gameplay-owned runtime structures.
- It must not treat the snapshot itself as the runtime state model.

### Decision 21: Gameplay Setup Should Consume Snapshot Plus Published Upstream Contracts

Decision:

- A gameplay setup flow should consume:
- deck snapshot;
- published format contract;
- gameplay-facing card projection;
- any explicit match-entry inputs the gameplay layer needs.

Rationale:

- This preserves the boundary between deck ownership and runtime ownership.

Practical implication:

- `rules` should not need to reach into deck storage, legality internals, or full catalog models to start a gameplay session.

## Versions, Variants, and Format Changes

### Decision 22: Deck Version and Deck Variant Must Be Distinguished Conceptually

Decision:

- The architecture should distinguish between:
- `deck version`: a saved revision of one format-bound deck;
- `deck variant`: a related but separately meaningful deck in another format or branch.

Rationale:

- Versioning tracks evolution of one format-bound deck.
- Varianting tracks semantically different deck forms that should not overwrite each other.

Practical implication:

- Standard and Premium forms of the same archetype should normally be separate variants, each with its own versions.

### Decision 23: Format Change on a Persisted Deck Should Produce a New Variant by Default

Decision:

- After a deck is persisted, shared, or used as a stable object, switching to another format should default to creating a new format-bound variant rather than mutating the existing deck identity.

Rationale:

- Format change often changes sections, counts, legality interpretation, and future gameplay setup assumptions.

Practical implication:

- Format conversion should be modeled as copy, fork, or branch semantics.
- The original deck version history should remain attached to its original format.

### Decision 24: Shared Decks Should Resolve to Format-Bound Versions, Not Abstract Archetypes

Decision:

- Social sharing should target a concrete format-bound deck version or publication record derived from one.

Rationale:

- Users should know exactly which format and structure a shared deck represents.

Practical implication:

- A public deck link should not point to a format-ambiguous archetype object by default.

## Examples

### Example 1: Standard Deck with Explicit Ride Deck

- A saved Standard deck version has `format_key = standard`.
- Its deck snapshot explicitly includes `main_deck` and `ride_deck`.
- Even if the ride deck is currently incomplete, the snapshot remains structurally explicit and can be sent to legality.

### Example 2: Premium Deck with Explicit G Deck Structure

- A saved Premium deck version has `format_key = premium`.
- Its deck snapshot includes `main_deck` and may include `g_deck` as allowed by the format contract.
- No ride deck section appears because the attached format does not permit it in baseline structure.

### Example 3: Draft Deck Before Format Is Fully Selected

- A user starts entering cards without picking a format.
- This is editor draft state, not a canonical deck snapshot.
- The system may persist it as draft workflow state if desired, but not as a format-bound deck version for legality or sharing.

### Example 4: Imported Deck List with Ambiguous Format

- An import flow parses a list successfully but cannot determine whether it targets V Premium or Premium.
- The result is an import candidate or draft state, not a legality-ready deck snapshot.
- Once the user resolves the format and card identities are normalized, `decks` may publish a proper snapshot.

### Example 5: One Conceptual Archetype, Separate Format-Bound Variants

- A user has one "conceptual deck idea" that exists in Standard and Premium.
- The platform stores those as separate format-bound variants.
- Each variant has its own versions, snapshots, and legality history.

### Example 6: Legality Reads Snapshot Without UI State

- The deck builder has unsaved local sorting and search state.
- `decks` publishes a clean deck snapshot with format key, sections, canonical card references, and counts.
- a caller builds a legality validation request from that snapshot.
- `legality` evaluates the request and ignores the builder's local UI noise.

### Example 7: Gameplay Setup Reads Prepared Input Derived from Snapshot

- A future match flow starts from a format-bound deck snapshot.
- It resolves the published format contract and gameplay-facing card projection.
- `rules` builds gameplay-owned runtime structures from those inputs.
- The deck snapshot itself never becomes the runtime state object.

## Final Recommendations

### Recommendation 1: Require Explicit Format Attachment for Persisted and Shared Deck Versions

- Persisted deck versions should always carry exactly one attached format key.
- Formatless states should remain draft or import workflow states only.

### Recommendation 2: Treat Format as Part of Deck-Version Meaning

- Format is not a cosmetic selector.
- It is part of what makes one deck version the deck it is.

### Recommendation 3: Publish Deck Snapshot as the Only Cross-Context Deck Input

- `decks` should publish deck snapshots.
- `legality` and future gameplay entry should consume them instead of storage models or UI state.

### Recommendation 4: Keep Deck Snapshot Minimal and Format-Bound

- The snapshot should include format reference, explicit sections, canonical-card references, and counts.
- It should not include legality outputs, runtime state, UI state, or full catalog payloads.

### Recommendation 5: Model Cross-Format Changes as Variants, Not Silent Mutation

- If a saved deck moves from one format to another, the default architectural model should be new variant or branch creation.

## Open Questions We Intentionally Leave for Later

- the exact published field set for deck source references and whether they are always present or optional;
- the exact shape of gameplay-prepared deck input derived from snapshot for future rules work;
- whether draft workflow objects deserve their own explicit contract outside canonical deck snapshot;
- the exact product decision for how variant lineage is exposed in UI and social surfaces;
- whether future non-format-specific deck templates should exist as separate pre-deck artifacts rather than as deck versions.
