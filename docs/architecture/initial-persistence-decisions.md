# Initial Persistence Decisions

Status: Pre-implementation persistence note  
Last updated: 2026-04-07

## Why Persistence Must Be Explicit

Persistence is not a neutral implementation detail in this project. Persisted structures become long-lived facts, operational habits, and integration constraints. If storage decisions are left implicit, the first storage model will become the real architecture whether the team intended that or not.

This is especially risky here because the platform already has explicit contracts for:

- canonical catalog content;
- deck versions and deck snapshots;
- legality inputs and legality results;
- gameplay-facing catalog and format projections;
- importer-to-catalog publication flow.

If persistence ignores those boundaries:

- snapshots will drift into source-of-truth models;
- projections will be stored as if they were canonical data;
- importer workflow artifacts will leak into catalog storage;
- legality outputs will be mistaken for permanent truth;
- bounded contexts will start sharing storage shapes instead of published contracts.

### Decision 1: Persistence Must Follow Bounded Contexts and Published Contracts

Decision:

- Storage design must follow bounded-context ownership and published contract boundaries rather than flattening them into one shared persistence model.

Rationale:

- The system already has explicit truth boundaries and shared-contract rules.
- Persistence that ignores them will recreate the coupling those documents were written to prevent.

Practical implication:

- A persisted shape is allowed to reflect an owning context's internal needs.
- It must not become an implicit shared model for other contexts.

### Decision 2: One Physical Database Is Acceptable; One Shared Data Model Is Not

Decision:

- MVP implementation may use one physical database or one storage platform.
- That does not justify one undifferentiated cross-context data model.

Rationale:

- Operational simplicity is acceptable early.
- Semantic boundary collapse is not.

Practical implication:

- Logical ownership must remain separated even if physical infrastructure is shared.

## Persistence Boundaries by Context

### Catalog

`catalog` should persist:

- canonical cards;
- card printings;
- products, sets, and product-family relationships;
- normalized catalog metadata;
- catalog-owned read models when persistence is useful for search or product performance.

`catalog` should not persist as its own truth:

- raw importer payloads;
- parser output;
- unresolved ambiguity;
- importer review workflow state;
- legality results;
- gameplay runtime state.

### Importer

`importer` should persist:

- source references and source mappings;
- raw source records when operationally justified;
- parsed or structured source records when needed for repeatable normalization;
- normalization state;
- ambiguity and conflict state;
- manual review queue and review outcomes;
- provenance needed for auditability and re-ingestion.

`importer` should not persist as published product truth:

- canonical catalog meaning after publication;
- legality interpretations;
- gameplay semantics;
- ordinary user-facing catalog read models.

### Decks

`decks` should persist:

- deck identities;
- deck versions;
- author-owned deck metadata;
- format attachment for persisted deck versions;
- persisted immutable deck snapshots where snapshots are part of versioning, sharing, or history.

`decks` should not persist as its own truth:

- legality logic;
- canonical legality meaning;
- full copied catalog card entities;
- gameplay runtime state;
- social graph ownership.

### Legality

`legality` should persist, where needed:

- canonical format profiles;
- restriction baselines or rule snapshots owned by legality;
- capability-support declarations if they remain in legality-owned publication;
- cached or attached legality results only as derived artifacts with context.

`legality` should not persist as primary truth:

- deck storage;
- raw importer data;
- catalog source-of-truth content;
- gameplay runtime state.

### Rules

`rules` is future-facing, but when introduced it should persist:

- match or gameplay session identities;
- gameplay-owned runtime state when durable runtime storage becomes necessary;
- event logs, gameplay snapshots, or replay-oriented artifacts if product scope requires them.

`rules` should not persist as its own truth:

- canonical catalog content;
- legality verdict ownership;
- full deck persistence internals;
- importer provenance.

### Social

`social` should persist:

- profiles;
- relationship state;
- privacy and visibility settings;
- sharing metadata and references to published deck artifacts where needed.

`social` should not persist as its own truth:

- deck composition as a replacement for `decks`;
- legality status as primary truth;
- gameplay runtime truth.

### Web App

`web app` should not own durable domain persistence.

It may persist limited application-level or user-experience state where justified, such as:

- session-oriented preferences;
- disposable UI preferences;
- temporary client-side workflow state.

It must not become the place where domain truth is stored simply because it was convenient to wire first.

### Decision 3: Persist Where the Context Owns Meaning

Decision:

- Durable storage belongs in the context that owns the meaning of the stored data.

Rationale:

- Data ownership and storage ownership should not drift apart without strong reason.

Practical implication:

- If a context needs another context's data, the default answer is to reference or consume a published contract, not to persist a shadow copy as new truth.

## Canonical vs Derived vs Transient Data

This distinction is relative to the owning context.

### Canonical Data

Canonical data is:

- the source of truth inside its owning context;
- the data other context-local shapes should derive from;
- the data that should survive re-computation.

Examples:

- canonical cards, printings, and products in `catalog`;
- raw source records, source mappings, and review outcomes in `importer`;
- deck versions in `decks`;
- format profiles and restriction baselines in `legality`;
- future gameplay state in `rules`.

### Derived Data

Derived data is:

- produced from canonical data;
- useful for integration, performance, search, display, or workflow;
- safe to rebuild when the underlying canonical data changes.

Examples:

- deck snapshots derived from deck-owned state;
- gameplay-facing catalog projection derived from catalog truth;
- gameplay-facing format projection derived from canonical format meaning;
- legality results derived from validation inputs and legality-owned rules;
- catalog read models derived from canonical cards and printings;
- publication-ready normalized content derived from importer workflow.

### Transient Data

Transient data is:

- short-lived operational or interaction state;
- not suitable as durable truth;
- often safe to discard and rebuild.

Examples:

- page filters and tab state;
- editor dirty flags;
- temporary normalization intermediates not needed for audit or review;
- in-memory legality evaluation intermediates;
- runtime setup scaffolding before gameplay state is established.

### Decision 4: Derived Persistence Is Allowed, but Derived Data Must Not Become Truth by Accident

Decision:

- Derived data may be persisted for performance, traceability, or product workflow reasons.
- Persisting it does not make it canonical truth.

Rationale:

- Some derived artifacts are operationally useful to store.
- The architecture only breaks when stored derivations start replacing their owning canonical data.

Practical implication:

- Persisted derivations must remain rebuildable, contextual, and clearly non-canonical.

## Snapshot Persistence Policy

### Decision 5: Deck Snapshot May Be Persisted, but Only as an Immutable Published Representation

Decision:

- `deck snapshot` may be persisted when the product needs stable versioning, sharing, history, or cross-context replay of a deck representation.

Rationale:

- Snapshot is already the published cross-context representation of a deck.
- Persisting that representation is useful for stable deck versions and user-facing history.

Practical implication:

- Snapshot persistence should be tied to a specific deck version or publication event, not treated as an editable working model.

### Snapshot Rules

- A persisted snapshot is immutable.
- It is not the source of deck-domain logic.
- It must not be rewritten retroactively to reflect later editor changes.
- If a deck meaning changes materially, publish a new snapshot through a new deck version or new derived publication artifact.

### Decision 6: Snapshot Immutability Is Semantic, Not Just Technical

Decision:

- Even if storage migrations or serialization formats change later, the semantic content of a persisted snapshot must remain fixed to the deck version or event it represents.

Rationale:

- History, sharing, legality attachment, and future gameplay preparation all depend on stable past deck meaning.

Practical implication:

- Migration of storage format is acceptable.
- Silent mutation of past deck meaning is not.

## Projection Persistence Policy

### Decision 7: Projections Are Not Sources of Truth

Decision:

- Gameplay-facing projections, catalog read models, and similar projection layers must never be treated as the primary truth of the data they summarize.

Rationale:

- Projections exist to narrow, optimize, or reshape canonical data for a consumer.
- They do not own the original meaning.

Practical implication:

- A persisted projection is always an optimization or delivery artifact, not the place where authoritative edits should start.

### Projection Persistence Guidance

- A projection may be computed on demand.
- A projection may be cached.
- A projection may be materialized durably if product performance or workflow requires it.
- If persisted, it must remain derivable from canonical inputs.
- If canonical inputs change, the projection must be considered refreshable or invalidatable.

### Decision 8: Do Not Persist a Projection Only Because It Is Convenient to Query

Decision:

- Query convenience alone is not sufficient reason to elevate a projection into long-lived truth.

Rationale:

- Query convenience is one of the fastest ways to turn read models into accidental domain models.

Practical implication:

- Prefer a persisted projection only when the team can still state clearly what canonical source it derives from and how it is refreshed.

## Importer Persistence Policy

### Decision 9: Importer Persistence Is Workflow-Oriented, Not Product-Truth-Oriented

Decision:

- Importer storage should persist workflow state needed for repeatable ingestion, normalization, provenance, and review.

Rationale:

- Importer is the owner of preparation and reconciliation, not of public catalog truth.

Practical implication:

- Importer persistence may be messy operationally.
- That mess must not leak into catalog truth or cross-context contracts.

### Importer Persistence Guidance

- Persist raw source records when operationally and legally justified.
- Persist parsed or structured source artifacts when they improve repeatability or reviewability.
- Persist normalization state, mapping state, and review state deliberately.
- Preserve enough provenance to explain how a published canonical card or printing was derived.

### Decision 10: Importer Internals Must Not Be Reused as Catalog Storage

Decision:

- Importer-owned persisted models must not be repurposed as the long-term storage model for catalog.

Rationale:

- Workflow artifacts optimize for reconciliation.
- Catalog truth optimizes for stable domain meaning.

Practical implication:

- If a catalog query depends on importer workflow rows or raw source blobs, the storage boundary is broken.

## Catalog Persistence Policy

### Decision 11: Catalog Stores Canonical Domain Content and Catalog-Owned Read Models

Decision:

- Catalog persistence should center on canonical cards, card printings, products, and normalized catalog metadata.

Rationale:

- Catalog is the owner of published content truth.

Practical implication:

- Search and display models may also be stored if helpful, but they remain derived from canonical catalog content.

### Catalog Must Not Store as Canonical Truth

- raw importer artifacts;
- unresolved ambiguity;
- parser or normalization internals;
- importer review workflow state;
- legality conclusions;
- gameplay runtime conclusions.

### Decision 12: Catalog Updates Must Arrive Through Controlled Publication, Not Ad Hoc Re-Normalization

Decision:

- Changes to catalog canonical content should enter through importer publication flow or controlled catalog-owned correction processes, not through silent re-normalization inside catalog persistence.

Rationale:

- Re-running importer logic inside catalog would create duplicate decision paths and eventual drift.

Practical implication:

- If normalization was wrong, fix it upstream and republish cleanly.

## Legality Persistence Policy

### Decision 13: Legality Inputs May Be Canonical; Legality Results Are Derived

Decision:

- `legality` may persist canonical rule inputs such as format profiles, restriction baselines, and legality-owned support declarations.
- Legality results remain derived outputs.

Rationale:

- The legality context owns the meaning of the rules it evaluates against.
- It does not own permanent truth about every evaluated deck outcome.

Practical implication:

- Persist rule baselines as owned domain data.
- Treat validation outputs as contextual artifacts.

### Legality Result Persistence Guidance

- A legality result may be cached.
- A legality result may be attached to a deck version or validation event as a snapshot.
- A legality result must never be treated as timeless truth without its validation context.
- Any stored legality result should remain obviously tied to:
- the evaluated deck snapshot or deck version;
- the format and restriction context;
- the support-status context;
- the evaluation time or freshness boundary.

### Decision 14: Stored Legality Results Must Be Disposable or Recomputable

Decision:

- Persisted legality results must be treated as disposable derived artifacts, not permanent authoritative state.

Rationale:

- Legality can change when restriction lists, support scope, or owned rule baselines change.

Practical implication:

- Revalidation is the default authority.
- Stored results are for convenience, history, or user-facing attachment, not as the final truth forever.

## Identity Strategy (Conceptual)

### Decision 15: Stable Internal Identity and External Source Identity Must Stay Separate

Decision:

- The system should keep internal stable identities separate from external source identifiers and separate again from gameplay-facing identity meaning.

Rationale:

- Source ids change by source.
- Internal ids exist for owned persistence and references.
- Gameplay identity follows the canonical-card model, not a source-specific label.

Practical implication:

- Do not use source ids as canonical platform ids.
- Do not use printing ids as default gameplay ids.

### Conceptual Identity Layers in Persistence

- `catalog` owns stable internal ids for canonical cards, printings, and products.
- `importer` owns source references and source mappings to those internal ids.
- `decks` owns stable deck ids and deck-version ids.
- Deck snapshots reference canonical-card identity, not full copied card rows.
- Gameplay-facing identity still resolves to canonical-card meaning unless an explicit future rule requires more.

### Decision 16: Cross-Context References Should Prefer Stable Owned Identities Over Copied Objects

Decision:

- Persisted cross-context references should prefer stable identities and published contracts over copying foreign context entities into local storage.

Rationale:

- Copied foreign objects drift.
- Stable references preserve ownership boundaries.

Practical implication:

- Deck storage should reference canonical-card identity, not copied full card payloads.

## Mutation and Immutability Rules

### Immutable by Default

The following should be treated as immutable once persisted for a specific event or version:

- deck snapshots;
- deck versions, if the domain treats versions as historical facts;
- stored legality-result snapshots attached to a past evaluation event;
- raw source records captured for audit or re-ingestion;
- source-mapping history entries once committed as historical evidence.

### Controlled Mutable Data

The following may change through context-owned update flows:

- canonical catalog entities and printings;
- product metadata;
- format profiles and restriction baselines;
- capability-support declarations;
- importer review state before publication;
- active draft workflow state, if drafts are persisted separately from canonical deck versions.

### Decision 17: Mutability Must Follow Ownership and Event Meaning

Decision:

- If a record represents a stable historical fact, treat it as immutable.
- If it represents the current owned state of a context, allow controlled updates through that owner.

Rationale:

- Hidden mutation is one of the main ways persistence breaks architectural meaning.

Practical implication:

- Do not mutate a snapshot into something new when the real event is "a new version exists."
- Do not mutate historical legality output to make it look current; recompute and store a new derived artifact if needed.

## MVP Trade-offs

### Decision 18: Early Persistence May Be Operationally Simple as Long as Semantic Boundaries Stay Intact

Decision:

- MVP implementation may intentionally simplify storage architecture while preserving ownership boundaries.

Acceptable trade-offs include:

- one physical database;
- one deployment boundary;
- no separate CQRS infrastructure;
- storing immutable snapshots in JSON-like payloads where that fits the domain contract;
- computing some projections on demand instead of materializing them early;
- storing some derived read models in the same datastore as canonical records, as long as ownership remains clear.

Rationale:

- Architectural discipline does not require premature infrastructure complexity.

Practical implication:

- The team can move quickly without flattening canonical, derived, and transient data into one blob.

### Not Acceptable Even in MVP

- treating projections as source of truth;
- storing raw importer artifacts in catalog-owned canonical storage;
- making legality results permanent truth without context;
- persisting full copied foreign entities instead of owned identities or published contracts;
- letting UI workflow state become domain storage because it is easy.

## Anti-Patterns

The following practices are explicitly prohibited:

- storing projections as source of truth;
- storing UI state in domain persistence as if it were canonical data;
- mixing raw importer data into catalog canonical storage;
- mutable snapshots;
- storing legality results as timeless truth;
- persisting deck entries as copied full card objects;
- letting one context depend on another context's persistence shape instead of its published contracts;
- using storage convenience to redefine canonical identity or truth boundaries.

## Examples

### Good Example 1: Immutable Deck Snapshot Persistence

- A deck version is saved in `decks`.
- `decks` publishes and persists an immutable snapshot for that version.
- `legality` later evaluates that snapshot.
- A future share flow references the same snapshot or a publication artifact derived from it.

This preserves deck history and keeps snapshot distinct from mutable editor state.

### Good Example 2: Canonical Catalog Persistence

- `catalog` stores canonical cards and linked printings.
- Search or gameplay-facing projections are computed or cached from that canonical content.

This keeps catalog truth separate from projection optimization.

### Good Example 3: Derived Legality Attachment

- A legality result is stored next to a deck version for quick display.
- The stored artifact includes enough validation-context summary to show what it was based on.
- A later rule change triggers revalidation rather than mutating the past result into new truth.

This treats legality output as derived and contextual.

### Bad Example 1: Projection as Primary Model

- The gameplay-facing catalog projection becomes the main stored representation of cards because it is convenient for runtime work.

This is forbidden. The projection is derived from catalog truth and must remain derived.

### Bad Example 2: Importer Data in Catalog Truth

- Raw importer JSON or parser artifacts are stored inside catalog canonical content because the team might need them later.

This is a boundary violation. Keep importer workflow state inside importer or publish only justified provenance references.

### Bad Example 3: Timeless Stored Legality

- A legality result is written once and later treated as permanently authoritative even after restriction or support changes.

This is forbidden. Legality output without context and freshness rules is not trustworthy enough to be persistent truth.

## Final Recommendations

- Let persistence follow bounded contexts and truth boundaries.
- Keep canonical, derived, and transient data explicitly separate.
- Persist deck snapshots only as immutable boundary artifacts, not as mutable working state.
- Treat projections as optimizations or delivery artifacts, never as canonical truth.
- Keep importer workflow persistence isolated from catalog persistence.
- Keep legality results derived, contextual, and recomputable.
- Prefer stable identities and published contracts over copied foreign entities.
- Start with simple infrastructure if needed, but do not compromise semantic ownership boundaries.
