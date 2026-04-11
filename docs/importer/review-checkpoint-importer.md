# Importer Review Checkpoint

Date: 2026-04-09
Verdict: GO WITH CONDITIONS

## 1. Executive Summary

The importer foundation is architecturally coherent and still follows the
intended pipeline:

- source tracking
- job tracking
- raw product ingestion
- raw card-printing ingestion
- normalization
- manual review queue
- dev JSON entrypoint

The most important boundaries are currently intact:

- raw import data does not impersonate published catalog truth
- normalization does not silently publish
- manual review resolution does not silently publish
- the dev JSON path reuses the same importer pipeline instead of bypassing it

There is no current evidence strong enough to justify a `HOLD`. The main issue
that should be addressed before publication-oriented work expands further is a
same-version review-queue stale-decision risk: a terminal manual-review item can
remain attached to a changed normalization result inside the same job/version.

The subsystem is safe to continue, but not yet safe to treat as finished
publication-ready importer core.

## 2. Scope Reviewed

Reviewed areas:

- `import_sources` / `import_jobs` persistence and lifecycle
- raw product importer
- raw card-printing importer
- card-printing normalization
- manual review queue
- dev JSON import path
- importer repository boundary and tests

Review focus:

- idempotency
- deduplication
- traceability
- publish boundaries

Not reviewed:

- publication into final catalog truth
- real upstream parser quality
- reviewer UI
- scheduling / worker orchestration
- performance benchmarking

## 3. Idempotency Review

Status: acceptable with conditions

What is coherent:

- repeated raw product ingestion is idempotent within one job by
  `(import_job_id, source_product_id)` and uses skip-or-update semantics
- repeated raw printing ingestion is idempotent within one job by
  `(import_job_id, source_printing_id)` and uses skip-or-update semantics
- repeated normalization is controlled by
  `(raw_card_printing_record_id, normalization_version)`
- new normalization versions supersede older active results instead of
  silently overwriting history
- repeated dev JSON imports reuse the same source definition but create a new
  tracked job

What is only partial:

- run-level idempotency is explainable, but not deduplicated: the same source
  and same input fingerprint still create a new job and rerun the pipeline
- successful non-dev flows do not have one shared orchestration boundary that
  finalizes jobs consistently; the dev JSON path does this, but it is not yet a
  universal importer runner contract

Conclusion:

- stage-local idempotency is real
- end-to-end repeated-run idempotency is only partially implemented

## 4. Deduplication Review

Status: acceptable with conditions

What is strong:

- raw products keep per-job history while deduplicating same-source items within
  a job
- raw printings do the same and preserve raw product linkage separately from
  canonical card identity
- normalization results are version-aware and support superseding older active
  outcomes
- manual review items are unique per normalization result, which prevents queue
  spam for the exact same result row

What needs attention:

- deduplication is intentionally local to each pipeline layer, which is good,
  but it means operators must still reason at the job level rather than assume a
  global "same source, same record, one row forever" model
- manual review deduplication becomes unsafe when a same-version normalization
  result changes after the review item already reached a terminal state

Conclusion:

- deduplication strategy is explicit and mostly coherent
- the weak point is not raw-layer duplication; it is stale review state across
  same-version normalization changes

## 5. Traceability Review

Status: strong

Traceability chain is present and usable:

- raw product record -> import job -> import source
- raw printing record -> import job -> import source
- normalization result -> raw printing record -> import job -> import source
- review item -> normalization result -> raw printing -> import job -> import
  source

Additional strengths:

- raw printings preserve source-level product references and optional raw product
  linkage
- normalization results preserve raw payload fingerprint, candidate ids, status
  reason, and resolution evidence
- review items preserve escalation reason, context payload, and reviewer decision
  metadata
- the dev JSON path still creates a real source and real job instead of hiding
  local imports

Conclusion:

- engineers can explain where imported data came from
- operators can explain why a record is unresolved or in review
- provenance is already strong enough to support later publication work

## 6. Publish Boundary Review

Status: strong

Boundary checks:

- raw importers write only to importer-owned raw tables
- normalization reads canonical `catalog.card_entities` for matching but writes
  only importer-owned normalization results
- manual review queue writes only importer-owned review items and reviewer
  decisions
- the dev JSON path orchestrates source/job/raw/normalization/review steps and
  stops before any publication step

No evidence was found of hidden writes into published catalog truth such as:

- `catalog.products`
- `catalog.card_printings`
- `catalog.card_entities`

Conclusion:

- publish boundaries are currently clean
- this is the strongest part of the importer foundation today

## 7. Domain Semantics Review (Product / Printing / Entity)

Status: strong

Observed semantics:

- raw product importer preserves product metadata as importer-layer product facts
- raw printing importer preserves printing-level facts and raw product context
- normalization attaches printings toward canonical card entities without
  collapsing the printing into the entity
- manual review queue escalates unresolved printing-to-entity resolution issues
  without pretending they are already canonical truth

No evidence was found of importer-side semantic collapse such as:

- treating a raw printing as a canonical entity
- treating raw product context as published product truth
- flattening product, printing, and entity identities into one stage-local model

Conclusion:

- importer semantics still respect the catalog domain model

## 8. Manual Review Queue Review

Status: acceptable with conditions

What is good:

- unresolved, ambiguous, conflicting, and exceptional outcomes map to explicit
  queue reasons
- queue lifecycle is operationally meaningful
- review items remain a separate pipeline layer
- superseding and cancelling behavior exists for results that no longer require
  review

Current weakness:

- when the same normalization result row changes inside the same
  `normalization_version`, an already `resolved` or `rejected` review item is
  skipped instead of reopened or replaced
- this leaves a stale terminal decision attached to changed normalization
  content

Conclusion:

- the queue foundation is good
- the current stale-terminal-item behavior should be fixed before publication
  starts depending on review outcomes

## 9. Dev JSON Path Review

Status: strong

What is true today:

- the dev path is a real importer entrypoint, not a shortcut
- it creates or resolves an `import_source`
- it creates a real `import_job`
- it routes product data through the raw product importer
- it routes printing data through the raw printing importer
- it can optionally run normalization and therefore queue creation
- it finalizes the job explicitly

Important honesty check:

- this path is useful for development and testing
- it does not pretend to be a production upstream parser
- it does not bypass raw/normalization/review boundaries

Conclusion:

- the dev JSON path is an honest and useful developer-experience layer

## 10. Test Posture Review

Status: acceptable with conditions

What is covered:

- import source/job persistence
- raw product ingestion semantics
- raw printing ingestion semantics
- normalization statuses and rerun behavior
- manual review queue creation and lifecycle
- dev JSON contract validation and pipeline routing

What is still risky:

- there is no targeted test for the stale terminal review-item scenario when a
  same-version normalization result changes
- there is no shared orchestration-level test outside the dev JSON path for
  successful job finalization semantics
- there are no performance-shape tests for large importer runs

Conclusion:

- the importer test posture is meaningful
- the main remaining gap is around repeated normalization plus prior review
  decisions

## 11. Top Findings

### HIGH: Terminal review items can become stale when same-version normalization results change

- Issue:
  - `syncFromNormalizationResults(...)` skips existing `resolved` and
    `rejected` items even if the derived review payload has changed
- Why it matters:
  - the queue can preserve an old human decision against changed normalization
    evidence
  - publication-oriented steps would then trust stale review state
- Severity:
  - HIGH
- Recommendation:
  - reopen, replace, or supersede terminal review items when the same
    normalization result changes materially
  - add a targeted regression test before publication work depends on reviewer
    decisions

### MEDIUM: End-to-end idempotency is only partial at the job-run level

- Issue:
  - the same source and same input fingerprint still create a new job and rerun
    the pipeline
- Why it matters:
  - the system is traceable, but not globally deduplicated at the run level
  - operators cannot yet distinguish "repeat same run" from "new meaningful run"
    by behavior alone
- Severity:
  - MEDIUM
- Recommendation:
  - decide explicitly whether future non-dev runners should short-circuit or
    merely track repeated identical inputs as separate jobs

### MEDIUM: Successful job finalization is centralized only in the dev JSON runner

- Issue:
  - raw importers and the normalizer update progress, but the dev JSON runner is
    currently the only orchestration boundary that finalizes successful jobs
- Why it matters:
  - future source adapters could leave jobs in `running` or
    `blocked_for_review` without a consistent terminal-state policy
- Severity:
  - MEDIUM
- Recommendation:
  - define one shared importer runner/finalization policy before adding more
    entrypoints

### ACCEPTABLE TRADE-OFF: Normalization matching is intentionally conservative

- Issue:
  - matching relies on exact normalized name plus structural compatibility checks
- Why it matters:
  - this will send more records to review
  - however, it avoids unsafe silent attachment to canonical entities
- Severity:
  - ACCEPTABLE TRADE-OFF
- Recommendation:
  - keep the current conservative baseline until reviewer-driven evidence
    justifies more matching rules

### ACCEPTABLE TRADE-OFF: Raw-layer history is preserved per job instead of globally collapsed

- Issue:
  - repeated imports append history across jobs rather than upserting one global
    raw record
- Why it matters:
  - this increases operator reasoning burden slightly
  - but it preserves traceability and keeps raw history inspectable
- Severity:
  - ACCEPTABLE TRADE-OFF
- Recommendation:
  - keep this strategy unless storage or operational volume proves otherwise

## 12. Fixes Applied

None.

The main correctness issue identified in this checkpoint affects review rerun
semantics and should be fixed deliberately, not hidden inside the review pass.

## 13. Final Verdict

Verdict: GO WITH CONDITIONS

Why not `HOLD`:

- publish boundaries are clean
- traceability is strong end to end
- raw, normalization, review, and dev-entry stages are explicit
- domain semantics remain intact

Why not plain `GO`:

- the stale terminal review-item behavior is a real correctness risk for future
  publication-oriented steps
- run-level idempotency and shared successful-job finalization policy are still
  incomplete

Safe next step:

- fix review-item reopening/superseding semantics for changed same-version
  normalization results
- then define the shared publication-prep orchestration boundary before building
  publication steps on top of the current importer core
