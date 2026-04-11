# Ingestion Pipeline

## 1. Purpose

This document defines the ingestion pipeline that brings external content into
the platform without collapsing importer workflow into published catalog truth.

The goal is to make four stages explicit:

- source
- raw import records
- normalized candidates
- published catalog data

The pipeline is intentionally practical. It is designed to support:

- local JSON and dev import paths
- future source adapters and page parsers
- idempotent repeated imports
- traceable normalization and publication
- manual review where automation is unsafe

It is not a generic ETL platform design.

## 2. Pipeline Overview

The pipeline is:

`Source -> Raw Import Records -> Normalized Candidates -> Published Catalog Data`

Truth status changes at each stage:

- source is external and untrusted
- raw import records are preserved importer-owned facts
- normalized candidates are internal proposals, still unpublished
- published catalog data is final catalog truth

The pipeline must not skip these boundaries implicitly.

| Stage                  | Owner                              | Input                                                       | Output                                                                    | Success Means                                                   | Not Ready Means                                               |
| ---------------------- | ---------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| Source                 | external source + importer adapter | feed/file/page payload                                      | source payload reference and acquisition result                           | payload was acquired and identified                             | source unavailable, malformed, or unsupported                 |
| Raw Import Records     | importer                           | source payload                                              | traceable raw records keyed to source/job                                 | source facts are preserved for reprocessing                     | extraction failed or source slice is incomplete               |
| Normalized Candidates  | importer                           | raw import records + normalization rules + review decisions | internal product / printing / card candidates with resolution state       | candidates are internally structured and publication-assessable | ambiguity, conflicts, missing links, or low confidence remain |
| Published Catalog Data | catalog                            | publication-ready normalized candidates                     | canonical products, printings, card entities, and published relationships | catalog truth was materialized and traced to publication input  | candidate is unresolved or catalog acceptance failed          |

## 3. Stage 1: Source

### Meaning

Source is the external origin of content. Examples:

- structured JSON dump
- local file bundle
- page parser output
- external feed

### What Stage 1 Owns

- source identity
- source type
- acquisition time
- source payload reference or captured payload

### What It Does Not Own

- normalized platform meaning
- publication readiness
- catalog truth

### Input

- adapter configuration or local file path
- source selection metadata such as product family, release slice, or source URL

### Output

- acquired source payload or payload reference
- source metadata suitable for job tracking

### Key Invariants

- every source acquisition belongs to an import job
- every acquired source slice is attributable to one declared source identity
- source acquisition does not assign canonical card or printing meaning

### Success

- the source material needed for extraction is available and attributable

### Not Ready for Next Stage

- the source could not be acquired
- the source type is unsupported
- the payload is too malformed to extract stable raw records

## 4. Stage 2: Raw Import Records

### Meaning

Raw import records are importer-owned persisted facts extracted from the source.
They preserve what came from outside before internal normalization assigns final
platform meaning.

### What Raw Import Records Should Contain

- import job reference
- source reference
- source-specific record identifier where available
- source slice identifier such as page/file/product code section
- structured raw fields that can be reprocessed deterministically
- raw payload fragment or canonicalized raw payload where needed for audit
- source provenance metadata
- stable content fingerprint or payload hash

### What Raw Import Records Must Not Be

- canonical card rows
- canonical printing rows
- silently normalized final catalog objects
- unstructured garbage blobs if a stable structured raw shape is available

### Input

- acquired source payload
- extractor/parser output

### Output

- importer-owned raw records with provenance and stable job/source linkage

### Key Invariants

- raw records remain traceable to source and job
- raw records are reprocessable without reacquiring the source
- raw records preserve source fidelity even when later normalization changes

### Success

- the external facts needed for normalization are persisted and attributable

### Not Ready for Next Stage

- extraction produced incomplete or invalid raw records
- source provenance is missing
- the raw layer cannot support deterministic reprocessing

## 5. Stage 3: Normalized Candidates

### Meaning

Normalized candidates are importer-owned internal proposals that convert raw
import records into platform-shaped content without yet publishing catalog
truth.

Candidate means:

- the record is now expressed in internal terms
- matching, deduplication, and conflict detection have run
- the record can be assessed for publication readiness
- the record may still be blocked by ambiguity or review

### Candidate Types

At minimum the pipeline should allow separate candidate intents for:

- product candidate
- card printing candidate
- canonical card entity linkage candidate
- relationship candidate between product, printing, and card entity

### What Candidates Should Carry

- upstream raw-record linkage
- normalized internal fields
- proposed identity resolution
- match confidence or resolution basis
- conflict state
- publication-readiness state
- review requirement markers
- candidate fingerprint or normalization version marker

### What Candidates Are Not

- raw imported payload
- final catalog rows
- hidden importer heuristics with no explainable output

### Input

- raw import records
- normalization rules
- source mapping rules
- review decisions or previously approved overrides

### Output

- structured candidates that are either:
  - publish-ready
  - blocked for conflict/manual review
  - rejected

### Key Invariants

- candidate identity proposals are explicit
- unresolved ambiguity stays visible and does not masquerade as published truth
- candidate lineage back to raw records remains intact

### Success

- the record is internally normalized enough to make a publication decision

### Not Ready for Next Stage

- canonical card match is ambiguous
- printing deduplication is unresolved
- product attachment is contradictory or missing
- required normalized fields are missing

## 6. Stage 4: Published Catalog Data

### Meaning

Published catalog data is catalog-owned truth materialized from
publication-ready normalized candidates.

This is the first stage that repositories, UI, legality-facing content reads,
and downstream catalog consumers may treat as authoritative catalog truth.

### Publication Is an Explicit Operation

Publish means:

- a candidate is accepted across the importer-to-catalog boundary
- catalog materializes or updates canonical rows
- the result is traceable back to job, raw record lineage, and candidate

Publication is not:

- a side effect of raw import persistence
- a side effect of normalization alone
- permission to push unresolved ambiguity into catalog

### Publication Preconditions

- candidate is publication-ready
- required identity decisions are resolved
- required product / printing / card relationships are resolved
- no blocking conflict remains

### Publication Granularity

The practical default should be:

- jobs track the operational run
- candidates track record-level readiness
- publication may be partial at record or batch level within a job

This allows a job to publish resolved products/printings/cards while unresolved
records remain withheld.

### Input

- publication-ready normalized candidates
- explicit publication command or publication batch selection

### Output

- catalog-owned products
- catalog-owned card printings
- catalog-owned canonical card entities
- catalog-owned relationships and provenance references where justified

### Key Invariants

- published catalog truth is explainable from accepted candidate lineage
- catalog does not ingest unresolved ambiguity
- publication does not require catalog to redo importer-level normalization

### Success

- catalog truth was updated without semantic confusion or duplicate drift

### Not Ready

- candidate still needs review
- acceptance validation fails
- the publish operation would create unresolved identity corruption

## 7. Ownership and Boundaries

### Source

Owned by:

- external source plus importer acquisition adapter

### Raw Import Records

Owned by:

- importer

### Normalized Candidates

Owned by:

- importer

### Published Catalog Data

Owned by:

- catalog

### Boundary Rule

Importer may:

- acquire
- preserve
- normalize
- match
- detect conflicts
- prepare for review
- decide publication readiness

Catalog may:

- accept publication-ready content
- materialize canonical truth
- expose catalog read models

Importer must not publish its workflow state as runtime catalog truth.
Catalog must not depend on raw importer internals to function.

## 8. Job Tracking and Traceability

Traceability is first-class.

Each import run should be tracked as a job with:

- stable job id
- source id
- pipeline version or normalization version
- start/end timestamps
- scope metadata such as product slice, format slice, or file batch
- final job outcome

Each stage should keep explicit links:

- source acquisition -> import job
- raw import record -> import job + source identity
- normalized candidate -> raw import record(s) + normalization version
- publication event -> normalized candidate(s) + import job

The pipeline should also preserve stable per-record identifiers where possible:

- source record key
- raw payload fingerprint
- candidate key
- publication lineage reference

Repeated imports are normal. Traceability must explain:

- which job saw the record
- whether it was unchanged, changed, or remapped
- which published catalog records came from which accepted candidates

## 9. Idempotency and Deduplication Expectations

Idempotency must be deliberate.

### Repeated Import of the Same Source Payload

Expected behavior:

- creates a new import job
- may create new raw-record entries or raw-record versions tied to that job
- must converge on the same active normalized candidates and published catalog
  truth if the payload meaning did not change

### Raw Layer

Expectation:

- append-friendly for history and audit
- deduplicated enough within a job to avoid accidental duplicate raw rows for
  the same source record

Practical rule:

- exact same source-record identity plus same payload hash inside one job should
  not produce duplicate active raw records

### Candidate Layer

Expectation:

- rerunning normalization for the same raw record under the same normalization
  rules should not create multiple active equivalent candidates
- superseded candidates may exist historically, but only one current candidate
  state should remain active for one source-record/version intent

### Publication Layer

Expectation:

- repeated publication of the same accepted candidate should converge on the
  same catalog row set
- publication should upsert or confirm existing canonical card / printing /
  product truth rather than duplicate it

### Where Deduplication Happens

- raw deduplication: source-record identity + payload fingerprint
- candidate deduplication: raw lineage + normalization version + candidate intent
- catalog deduplication: canonical entity identity, printing identity, and
  product identity according to the domain model

## 10. Conflict Detection and Manual Review Boundary

### Conflict Detection

The pipeline must detect at least these cases:

- uncertain canonical card match
- uncertain printing deduplication
- conflicting product attachment
- source inconsistencies that materially affect normalized meaning
- partial metadata that blocks safe publication

### Unresolved State

Unresolved means:

- importer can describe the issue
- importer cannot safely auto-publish
- the candidate is withheld from catalog publication

### Auto-Linking Rule

Auto-linking is allowed only when the pipeline has a high-confidence deterministic
basis for the decision.

If the basis is weak or contradictory, the record must stop before publication.

### Manual Review Boundary

Manual review enters after normalization/conflict detection and before
publication.

The review queue should preserve:

- raw-record lineage
- candidate data
- proposed match/link decisions
- conflict reason
- review decision and review actor metadata

Review outcomes should feed back into candidate resolution and publication
readiness. Review does not directly edit final catalog truth as a shortcut.

## 11. Relationship to Product / CardPrinting / CardEntity

The pipeline must preserve the existing domain split.

### Product

Product is a release/container entity. Product metadata often arrives earlier and
more directly than full card normalization.

Practical implication:

- product candidates may become publish-ready before every related printing is
  resolved

### CardPrinting

CardPrinting is the concrete released instance.

Practical implication:

- printing candidates carry set/product membership, rarity, collector number,
  locale, and other printing-facing facts
- publication must not collapse printings into canonical card rows

### CardEntity

CardEntity is the canonical gameplay identity.

Practical implication:

- card-entity linkage may require matching and review
- publication of a printing requires either:
  - a confident existing canonical card match, or
  - an explicit decision to create a new canonical card entity

### Boundary Rule

Importer must not use convenience as an excuse to:

- publish printings as if they were canonical cards
- lose product relationships during normalization
- collapse product, printing, and canonical card into one vague row shape

## 12. What Is Intentionally Not Implemented Yet

Not defined here:

- concrete database schema for import jobs, raw records, candidates, or review
  queue tables
- parser implementation details
- source adapter implementations
- manual review UI
- operational retry orchestration
- distributed worker design
- full publication API surface

This document is the pipeline design foundation, not the full importer platform.

## 13. Summary

The ingestion pipeline is a controlled staged flow:

- source is external input
- raw import records preserve traceable imported facts
- normalized candidates express internal proposals without becoming catalog truth
- publication is an explicit handoff into catalog-owned truth

Key design commitments:

- stage boundaries stay explicit
- importer owns workflow, provenance, normalization, and review
- catalog owns published content truth
- repeated imports converge rather than duplicate
- unresolved ambiguity stops before publication
- product, printing, and canonical card identity remain separate throughout the
  pipeline
