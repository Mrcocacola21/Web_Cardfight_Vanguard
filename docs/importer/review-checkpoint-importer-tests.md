# Importer Tests Checkpoint

Date: 2026-04-09
Verdict: GO WITH CONDITIONS

## 1. Scope of This Checkpoint

This checkpoint covers the importer foundation that already exists today:

- import tracking (`import_sources`, `import_jobs`)
- raw product import
- raw card-printing import
- card-printing normalization
- manual review queue
- dev JSON import path

The focus of this checkpoint is semantic protection, not broad feature
expansion:

- repeat imports
- conflict and unresolved handling
- normalization results and summaries
- publish-safety boundaries
- traceability

Not in scope:

- publication into final catalog truth
- reviewer UI
- production upstream parser behavior
- load/performance testing

## 2. What Was Tested

The current importer test surface now covers:

- raw product importer service semantics
- raw card-printing importer service semantics
- normalization service semantics
- manual review queue service semantics
- dev JSON entrypoint orchestration
- importer repository persistence contracts

The suite remains intentionally compact. Tests target importer stages directly
instead of collapsing the whole pipeline into one brittle scenario.

## 3. Repeat Import Coverage

Covered:

- raw product importer skip-or-update semantics within the same job
- raw card-printing importer skip-or-update semantics within the same job
- repeated dev JSON imports reusing the same source while creating a new job
- repeated normalization with same-version skip behavior
- repeated normalization with new-version superseding behavior
- review queue reopening when a same-version normalization result changes after
  a terminal review decision

What this protects:

- repeated runs are explainable instead of being accidental duplicate creation
- stage-local idempotency is exercised explicitly
- stale review state on reruns is no longer left untested

## 4. Conflict Handling Coverage

Covered:

- unresolved normalization (`no_name_match`)
- ambiguous normalization with multiple compatible canonical candidates
- blocked-for-review normalization with conflicting structural facts
- exceptional-card normalization paths
- creation of manual review items from unresolved / ambiguous / conflicting /
  exceptional outcomes
- basic review lifecycle:
  - open
  - in_review
  - resolved
  - rejected
  - cancelled
  - superseded

What this protects:

- review-worthy cases do not disappear into fake auto-resolution
- the queue remains an explicit pipeline layer
- repeated normalization does not silently leave stale resolved review items in
  place

## 5. Normalization Result/Report Coverage

Covered:

- auto-resolved results
- unresolved results
- ambiguous results
- blocked-for-review results
- same-version skip counts
- new-version superseded counts
- `readyForPublicationCount` remaining a report field rather than an implicit
  publication side effect
- traceability fields on normalization outputs:
  - `importJobId`
  - `rawCardPrintingRecordId`
  - `rawProductRecordId`
  - `rawPayloadFingerprint`

What this protects:

- normalization stays a semantic boundary between raw import and publication
- outcome summaries reflect actual statuses instead of helper-only formatting

## 6. Publish Safety Coverage

Covered explicitly:

- raw product importer tests now assert they do not progress into normalization,
  review, or finalization calls
- raw card-printing importer tests now assert they do not progress into
  normalization, review, or finalization calls
- normalization tests assert they do not mutate raw-import stages or finalize
  jobs
- manual review queue tests assert queue actions do not touch published catalog
  truth
- dev JSON runner tests assert jobs remain non-published (`publishedRecordCount`
  stays `0`) and that the path goes through tracked source/job + importer stages

Important honesty note:

- there is still no publication layer in the codebase
- this checkpoint therefore tests non-publication boundaries, not publication
  behavior itself

## 7. Traceability Coverage

Covered:

- raw product importer returns `importJobId` and `importSourceId`
- raw card-printing importer returns `importJobId` and `importSourceId`
- raw card-printing import preserves raw product linkage where available
- normalization results retain raw printing and raw product anchors
- manual review items retain normalization-result and raw-record anchors
- dev JSON path preserves source reuse, job creation, input fingerprinting, and
  review summary lookup under real tracked jobs
- repository tests assert importer persistence writes the relevant
  `import_job_id`, normalization ids, and raw-record ids under importer schema

What this protects:

- traceability is validated as a real contract, not only as documentation

## 8. What Is Still Not Covered

- no real publication workflow is present yet, so there are no publication-write
  tests
- no scheduler/worker orchestration tests exist beyond the dev JSON runner
- no full database integration test runs the whole importer pipeline against a
  live Postgres instance
- no large-batch performance or scaling tests exist
- no reviewer UI or operational dashboard tests exist, because those surfaces do
  not exist yet

## 9. Current Risks

- run-level idempotency is still only partial: repeated identical inputs still
  create a new job by design
- successful-job finalization remains concentrated in the dev JSON runner rather
  than a shared importer runner abstraction
- the suite protects current pipeline semantics well, but it does not yet prove
  publication readiness because publication does not exist yet

## 10. Verdict

Verdict: GO WITH CONDITIONS

Why:

- the riskiest current semantics are now meaningfully protected:
  - repeated imports
  - conflict/unresolved handling
  - normalization status/report behavior
  - non-publication boundaries
  - traceability
- the suite is still honest about what does not exist yet
- later publication-oriented work is safer now, but should still proceed only
  after publication boundaries are implemented and tested explicitly
