# Ingestion Workflow and Importer-to-Catalog Publication Flow

Status: Ingestion boundary note  
Last updated: 2026-04-07

## Why This Document Exists

This document defines the end-to-end ingestion workflow and the controlled handoff from `importer` into `catalog`.

It is needed because Cardfight!! Vanguard content is large, heterogeneous, and structurally messy:

- multiple formats and eras coexist;
- product families and release waves expand over time;
- cards have printings, reprints, promos, alt arts, and special-distribution variants;
- the platform must add content gradually without fragmenting identity or losing traceability.

If ingestion and catalog publication stay implicit, the likely failures are predictable:

- `importer` starts owning too much domain meaning;
- `catalog` begins depending on raw source shapes;
- normalization becomes ad hoc and unreviewable;
- provenance disappears when content changes;
- duplicate canonical cards or duplicate printings accumulate silently;
- importer leftovers leak into long-term catalog truth.

### Decision 1: Ingestion and Catalog Publication Must Be Explicitly Separated

Decision:

- The architecture must treat ingestion workflow and catalog publication as separate stages with a controlled boundary between them.

Rationale:

- `importer` and `catalog` solve different problems.
- Content preparation is not the same thing as owning published catalog truth.

Practical implication:

- `importer` owns ingestion, normalization, provenance, and review workflow.
- `catalog` owns canonical published content after controlled handoff.

## Importer vs Catalog Responsibilities

### Decision 2: `Importer` Owns Ingestion Workflow; `Catalog` Owns Published Content Truth

Decision:

- `importer` and `catalog` remain separate bounded contexts with different ownership responsibilities.

Rationale:

- Ingestion must preserve source fidelity and uncertainty.
- Catalog must publish stable normalized content for downstream consumers.

Practical implication:

- `importer` is not the owner of catalog truth.
- `catalog` must not become dependent on raw importer workflow state.

### Importer

`importer` owns:

- source acquisition and source adapter behavior;
- raw record extraction and parser output;
- normalization workflow;
- source mappings;
- provenance preservation;
- ambiguity detection;
- manual review queue and review workflow;
- publication-readiness decisions for normalized content candidates.

`importer` must not own:

- canonical catalog truth after publication;
- deck legality semantics;
- gameplay semantics;
- search-oriented catalog presentation models;
- user-facing catalog publication as if raw source shapes were already domain truth.

### Catalog

`catalog` owns:

- canonical cards;
- card printings;
- products, sets, and product-family relationships;
- normalized content relationships after publication;
- search and display-facing catalog read models;
- downstream catalog projections, including gameplay-facing catalog projection.

`catalog` must not own:

- raw source parsing;
- ingestion heuristics;
- unresolved ambiguity handling as if it were normal catalog behavior;
- raw source provenance as a primary domain model;
- ad hoc re-normalization of already published normalized content.

### Decision 3: Catalog Must Consume Publication-Ready Normalized Content, Not Importer Internals

Decision:

- `catalog` should consume only publication-ready normalized content through an explicit ingestion/publication boundary.

Rationale:

- Catalog needs stable domain inputs, not workflow artifacts.

Practical implication:

- If catalog needs raw scraper output, parser traces, or unresolved candidate matches, the boundary is already broken.

## Ingestion Stages

The ingestion workflow should be understood as a staged pipeline with explicit meaning at each step.

### Stage 1: Raw Source Acquisition

Meaning:

- `importer` obtains external source material such as files, feeds, pages, or other source payloads.

Boundary note:

- Nothing at this stage is catalog truth.

### Stage 2: Raw Record Extraction

Meaning:

- `importer` extracts source-shaped records from the acquired material.

Boundary note:

- These records preserve source fidelity.
- They are still source records, not normalized card or printing records.

### Stage 3: Parsed Source Representation

Meaning:

- `importer` parses raw records into structured source data usable by normalization logic.

Boundary note:

- Parser output is still importer-owned workflow data.
- It does not cross into catalog publication as-is.

### Stage 4: Normalization and Identity Matching

Meaning:

- `importer` maps parsed source data into normalized content candidates using the canonical card and printing identity policy.

Boundary note:

- This is where source-facing data starts becoming domain-aligned.
- It is still not yet catalog truth until review and publication readiness are satisfied.

### Stage 5: Conflict Detection and Ambiguity Classification

Meaning:

- `importer` identifies duplicate risks, low-confidence matches, contradictory fields, or unresolved product or identity relationships.

Boundary note:

- Ambiguity belongs to importer workflow.
- Unresolved ambiguity must not be published as if it were canonical content.

### Stage 6: Manual Review and Resolution

Meaning:

- ambiguous or conflicting candidates are routed into importer-owned review flow for human confirmation, correction, or rejection.

Boundary note:

- Review resolves publication readiness.
- Review does not belong in ordinary catalog query or browse behavior.

### Stage 7: Publication-Ready Normalized Content

Meaning:

- `importer` produces normalized content candidates that are resolved enough to be published into catalog truth.

Boundary note:

- This is the first stage that may cross into catalog through the publication boundary.

### Stage 8: Importer-to-Catalog Handoff

Meaning:

- `importer` publishes publication-ready normalized content through a controlled handoff contract into `catalog`.

Boundary note:

- Handoff transfers normalized content, not importer workflow state.

### Stage 9: Catalog Publication

Meaning:

- `catalog` accepts publication-ready normalized content and materializes canonical catalog truth and catalog-owned read models.

Boundary note:

- After this stage, downstream systems consume catalog truth, not importer workflow outputs.

### Decision 4: Each Stage Must Have a Different Truth Status

Decision:

- The workflow must preserve the distinction between source data, normalized candidates, publication-ready content, and published catalog truth.

Rationale:

- Those are different stages of confidence and ownership.

Practical implication:

- The system must never collapse "imported," "normalized," and "published" into one vague status.

## Normalization Responsibilities

### Decision 5: Normalization Is Owned by `Importer` and Must Follow the Card Identity Policy

Decision:

- Normalization is part of importer workflow and must apply the canonical-card and printing identity rules defined by the card identity policy.

Rationale:

- Identity matching is the core risk area in content ingestion.
- It belongs in the workflow that reconciles external source data into stable internal meaning.

Practical implication:

- `importer` must decide, for each source candidate, whether it is:
- an existing canonical card with an existing printing;
- an existing canonical card with a new printing;
- a new canonical card with its first printing;
- an uncertain match that requires review.

### Normalization Responsibilities Include

- resolving gameplay-level identity versus printing-level identity;
- reconciling product and set metadata into normalized product relationships;
- deduplicating repeat source records for the same printing;
- preserving source mappings from raw source record to normalized content;
- routing low-confidence cases to manual review instead of forcing questionable merges.

### Decision 6: Normalization Must Be Reviewable, Not Hidden Importer Magic

Decision:

- Normalization decisions must remain traceable through source mappings, provenance, and review outcomes.

Rationale:

- An ingestion pipeline that cannot explain why a source record became a specific canonical card or printing will become unmaintainable quickly.

Practical implication:

- Review and audit must be able to trace:
- what source record was imported;
- what normalized records it mapped to;
- whether that mapping was automatic or review-resolved.

## Importer-to-Catalog Publication Flow

### Decision 7: Importer Publishes Resolved Normalized Content; Catalog Publishes Canonical Catalog Truth

Decision:

- `importer` publishes only normalized, review-resolved, publication-ready content into `catalog`.
- `catalog` then publishes canonical catalog truth from those accepted normalized inputs.

Rationale:

- Publication readiness and published truth are separate stages with different owners.

Practical implication:

- `importer` owns the decision that a normalized candidate is ready to cross the boundary.
- `catalog` owns the decision to accept that ready content into catalog truth and downstream catalog projections.

### Controlled Handoff Sequence

The handoff should follow this sequence:

1. `importer` completes normalization for a content slice or batch.
2. unresolved ambiguity is withheld from publication.
3. review resolves any cases that must be decided before publication.
4. `importer` marks the resolved content as publication-ready.
5. publication-ready normalized content crosses the explicit importer-to-catalog boundary.
6. `catalog` consumes that content and materializes canonical cards, printings, products, and catalog-owned projections.

### Decision 8: Catalog Must Not Re-Decide Importer-Level Ambiguity During Handoff

Decision:

- `catalog` may validate that incoming content is publication-ready according to the boundary contract.
- It must not become the place where unresolved importer ambiguity is silently reinterpreted.

Rationale:

- If catalog has to keep solving importer-level uncertainty, the bounded-context boundary has collapsed.

Practical implication:

- Ambiguous content should be rejected back to importer workflow or withheld earlier.
- It should not become "best effort" catalog truth.

## What May Cross the Boundary

The boundary may carry only normalized, stable, publication-ready content categories.

### Allowed Categories

- normalized canonical-card content or canonical-card updates;
- normalized printing-level content or printing updates;
- normalized product, set, and product-family content relevant to catalog truth;
- resolved associations between canonical cards, printings, and products;
- normalized identity mappings needed to keep catalog identity stable across re-ingestion;
- review-resolved association outcomes where those outcomes are now part of publication-ready content;
- stable provenance references or source-mapping references where catalog-level auditability genuinely benefits from them;
- publication-state markers that distinguish publication-ready content from unpublished workflow artifacts.

### Decision 9: Boundary-Crossing Data Must Already Be Resolved Enough to Function as Catalog Input

Decision:

- Any data category crossing from importer to catalog must already be stable enough to serve as catalog input without further importer-style interpretation.

Rationale:

- Catalog is the owner of published content, not the second half of the normalization pipeline.

Practical implication:

- If a category still requires heuristic matching, parser-specific logic, or ambiguity scoring to interpret, it is not ready to cross the boundary.

## What Must Not Cross the Boundary

The following must not cross into catalog truth as part of ordinary importer-to-catalog publication:

- raw scraped records or raw source payloads;
- parser internals;
- transient extraction artifacts;
- unresolved candidate matches;
- heuristic confidence internals used only to decide review or matching;
- importer retry state, job state, or operational logs;
- temporary normalization artifacts that are not part of stable catalog meaning;
- unresolved ambiguity presented as if it were canonical;
- ad hoc importer implementation details;
- legality or gameplay interpretations assigned during ingestion;
- UI- or admin-tool-specific workflow state as if it were domain content.

### Decision 10: Catalog Must Not Become a Storage Dump for Importer Leftovers

Decision:

- Importer leftovers, diagnostics, and unresolved workflow artifacts must remain importer-owned unless a separate explicit admin or audit contract justifies exposure.

Rationale:

- Catalog should stay clean, queryable, and domain-oriented.

Practical implication:

- If a field exists only because the importer happened to compute it during parsing or matching, that is not enough reason to place it in catalog truth.

## Ambiguity and Manual Review Handling

### Decision 11: Unresolved Ambiguity Blocks Catalog Publication

Decision:

- Content with unresolved identity, printing, product, or source-mapping ambiguity must not be published as canonical catalog truth.

Rationale:

- Ambiguous publication is one of the fastest ways to create duplicate-card chaos and long-term catalog corruption.

Practical implication:

- The system should prefer delayed publication over low-confidence publication.

### Manual Review Queue

The manual review queue should live in `importer` and cover at least:

- uncertain canonical-card matching;
- uncertain printing deduplication;
- uncertain product or set attachment;
- conflicting source fields that materially affect normalized meaning;
- ambiguous promo, alt-art, or reprint classification.

### Decision 12: Review Outcome Feeds Publication; It Does Not Become Catalog Workflow Logic

Decision:

- Manual review outcomes should resolve importer workflow and then feed the publication path.
- Catalog should consume the resolved output, not the review process itself.

Rationale:

- Review is an ingestion concern.
- Published catalog truth should reflect resolved outcomes, not open workflow.

Practical implication:

- Review tools may span importer and publication state operationally.
- Ordinary catalog consumers should not see unresolved review state as if it were catalog truth.

## Provenance Policy

### Decision 13: Provenance Must Be Preserved, but Not All Provenance Belongs in Catalog Truth

Decision:

- The system must preserve provenance across ingestion and publication, but only stable, justified provenance references should cross into catalog-owned data.

Rationale:

- Provenance is essential for auditability, debugging, re-ingestion, and conflict resolution.
- Full raw provenance is not the same thing as canonical catalog meaning.

Practical implication:

- `importer` should preserve full raw provenance internally.
- `catalog` may retain stable provenance references or source lineage markers where they help audit or explain published content.

### Useful Provenance for Catalog-Level Consumption

The following provenance categories may be justified downstream:

- stable source references for auditability;
- source-mapping references that help explain where a published record came from;
- publication lineage markers that help compare updates over time.

### Provenance That Should Usually Remain Importer-Internal

- raw payload copies;
- parser-specific extraction traces;
- matching heuristics and low-level evidence;
- operational retry or scraping diagnostics;
- review notes that are only meaningful inside ingestion workflow.

## Re-ingestion and Update Expectations

### Decision 14: The Workflow Must Be Idempotent-Minded

Decision:

- Re-ingesting the same source or equivalent source data should converge on the same normalized content rather than create duplicate canonical cards or duplicate printings.

Rationale:

- Content updates and repeated imports are normal, not exceptional.

Practical implication:

- The workflow should prefer stable source mappings, stable identity reconciliation, and deterministic publication behavior.

### Update Expectations

On re-ingestion:

- the same printing should normally update or reconfirm the existing normalized printing, not create a second one;
- a newly discovered reprint should become a new printing under an existing canonical card when gameplay identity matches;
- corrected source data may revise a normalized record or reopen review if prior mapping is no longer trustworthy;
- unchanged source content should not produce duplicate publication output merely because the pipeline ran again.

### Decision 15: Catalog Should Not Re-Normalize Already Normalized Publication Inputs

Decision:

- Once content has crossed the publication boundary as resolved normalized input, catalog should ingest it as catalog input rather than re-run importer-style normalization logic.

Rationale:

- Re-normalization inside catalog would create duplicate decision paths and eventual semantic drift.

Practical implication:

- Corrections to normalization should be made upstream in importer workflow and then republished cleanly.

## Downstream Interaction Notes

### Catalog

- consumes publication-ready normalized content;
- materializes canonical cards, printings, products, and catalog projections;
- becomes the source of truth for downstream catalog consumers.

### Legality

- must not depend on importer directly;
- should read canonical card identity and format-relevant catalog facts through catalog-owned contracts only.

### Rules

- must not depend on importer directly;
- should read gameplay-facing projections from catalog, not ingestion workflow artifacts.

### Web App

- should not observe raw ingestion workflow or raw source artifacts in normal product flows;
- should consume catalog truth or explicit admin/review read models where justified.

### Future Admin or Review Tools

- may read importer review state, publication readiness, or provenance detail through explicit operational contracts;
- should not expose unresolved importer workflow state as ordinary public catalog truth.

### Decision 16: Importer Is Upstream of Catalog, But Not Upstream of the Entire Product Surface

Decision:

- Downstream application contexts should consume catalog truth, legality truth, or gameplay truth as appropriate.
- They should not shortcut directly into importer workflow just because importer saw the data first.

Rationale:

- Importer prepares content.
- It does not publish application truth to every other context.

Practical implication:

- `legality`, `rules`, and normal `web app` flows should remain insulated from raw ingestion concerns.

## Anti-Patterns

The following practices are explicitly prohibited:

- `catalog` reading raw importer records directly;
- scraper or parser output directly populating canonical catalog entities;
- `importer` deciding legality or gameplay semantics;
- ambiguous content being published as canonical;
- catalog re-normalizing already normalized content ad hoc;
- raw source artifacts being treated as long-term domain truth;
- importer implementation details leaking into public catalog contracts;
- UI flows coupling themselves to ingestion stages or raw publication workflow;
- unresolved duplicates being published as separate canonical cards or printings simply because the pipeline could not decide.

## Examples

### Example 1: Good New Set Publication

- A new booster set is imported from external source material.
- `importer` extracts records, parses them, normalizes cards, printings, and products, and resolves source mappings.
- ambiguous items are reviewed before publication.
- `importer` publishes the resolved normalized content batch.
- `catalog` ingests that batch and publishes updated canonical card pages, printing links, and product pages.

This is the intended end-to-end flow.

### Example 2: Good Reprint Handling

- A record describes a known gameplay card reprinted in a later product.
- `importer` matches it to the existing canonical card and creates a new printing candidate.
- the new printing is publication-ready and crosses into catalog.
- `catalog` adds the printing under the existing canonical card instead of creating a duplicate canonical card.

### Example 3: Good Ambiguous Promo Handling

- A promo record cannot be matched confidently to an existing canonical card or known printing lineage.
- `importer` routes it to manual review.
- it does not cross the publication boundary until review resolves it.

This is correct even if publication is delayed.

### Example 4: Bad Direct Scraper-to-Catalog Flow

- Raw scraper output is written directly into catalog card tables or catalog entities.
- Later, the team discovers duplicate printings and mixed card identity.

This is forbidden. Raw source output is not catalog truth.

### Example 5: Bad Catalog Re-Normalization

- `catalog` receives a normalized printing candidate but decides to infer a new canonical card because a raw source label looks unusual.

This is a boundary violation. Identity reconciliation belongs upstream in importer workflow.

### Example 6: Bad Unresolved Duplicate Publication

- Two low-confidence records might be the same promo printing.
- The pipeline publishes both as separate printings "for now" to avoid blocking the release.

This is prohibited unless the team has explicitly resolved them as distinct. Low-confidence duplication is not an acceptable default.

## Final Recommendations

- Keep `importer` and `catalog` as separate bounded contexts.
- Treat ingestion as a staged workflow with explicit truth-status transitions.
- Make normalization importer-owned, identity-aware, and fully traceable.
- Allow only normalized, review-resolved, publication-ready content to cross into catalog.
- Keep raw source records, parser artifacts, heuristics, and unresolved ambiguity inside importer unless an explicit operational contract says otherwise.
- Preserve provenance intentionally, but do not confuse provenance storage with published catalog truth.
- Make re-ingestion converge on stable canonical cards and printings rather than creating duplicate content.
- Keep downstream systems insulated from importer and dependent on catalog truth or catalog-published projections instead.
