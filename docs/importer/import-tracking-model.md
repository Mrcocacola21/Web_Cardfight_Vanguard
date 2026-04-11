# Import Tracking Model

## 1. Purpose

This document defines the persistence foundation for importer tracking.

The goal is to make importer execution:

- traceable from source to job
- understandable across repeated imports
- explicit about lifecycle and outcomes
- ready for later raw import, normalization, review, and publication tables

This is not the raw-record schema, candidate schema, review queue, or importer
runtime implementation.

## 2. `import_sources`

`import_sources` is the stable definition of an import origin.

It represents:

- one named source definition
- how that source is identified
- the durable metadata that belongs to the source itself rather than to one run

It is not:

- one execution attempt
- one payload snapshot
- one imported record

Current fields are intentionally small:

- `source_key`: stable source identity within a source type
- `source_type`: broad source class such as local JSON, parser output, or feed
- `display_name`: operator-facing label
- `provider_name`: optional upstream/provider marker
- `origin_uri`: optional human/audit-friendly origin reference
- `configuration`: source-level config metadata
- `is_active`: operational enable/disable flag
- timestamps

The unique key is `(source_type, source_key)` because one source may have many
jobs over time, but the source definition itself should stay stable.

## 3. `import_jobs`

`import_jobs` is the execution record for one import run or retry attempt.

It is the central tracking anchor for later:

- raw import records
- normalized candidates
- review outcomes
- publication actions

Each job belongs to exactly one source and may optionally reference an earlier
job through `retry_of_job_id`.

Key fields:

- `job_status`: lifecycle state
- `current_stage`: source/raw/normalization/publication stage marker
- `pipeline_version`: importer logic version that produced this run
- `upstream_snapshot_key`: optional upstream revision or snapshot marker
- `input_fingerprint`: optional payload-level fingerprint for idempotency
- `scope_metadata`: job-level scope such as product slice or file batch
- `status_reason`: operator-facing explanation for blocked/partial/cancelled
  outcomes
- `error_code`: structured failure reason for failed jobs
- summary counters
- lifecycle timestamps

## 4. Job Lifecycle And Statuses

Statuses are explicit and intentionally small:

- `pending`: job exists but has not started work yet
- `running`: job is actively executing
- `blocked_for_review`: normalization reached an unresolved state and the run
  stopped awaiting review
- `completed`: all intended work for this run finished without unresolved
  blockers
- `partially_completed`: some intended work succeeded, but the run ended with
  unresolved remainder or non-fatal gaps
- `failed`: the run stopped because of an execution failure
- `cancelled`: the run was intentionally stopped

Expected lifecycle:

- `pending -> running`
- `running -> completed`
- `running -> partially_completed`
- `running -> blocked_for_review`
- `running -> failed`
- `pending|running -> cancelled`

Terminal statuses:

- `completed`
- `partially_completed`
- `blocked_for_review`
- `failed`
- `cancelled`

`current_stage` records where the job currently is, or where it stopped:

- `source`
- `raw_import`
- `normalization`
- `publication`

This keeps "what happened" and "where it happened" separate.

## 5. Traceability Model

Traceability anchors are:

- `import_sources.id`
- `import_jobs.id`

Later importer tables should reference `import_jobs.id` directly.

Expected downstream linkage:

- raw import records -> `import_jobs.id` and usually `import_sources.id`
- normalized candidates -> `import_jobs.id` plus raw lineage
- manual review records -> `import_jobs.id` plus candidate lineage
- publication records/results -> `import_jobs.id` plus accepted candidate
  lineage

This should make it possible to answer:

- which source produced this run
- which job imported this record
- which pipeline version made the normalization decision
- which publication outcome came from which job

## 6. Idempotency / Repeated Import Considerations

Repeated imports are normal and should produce many jobs for the same source.

The tracking model supports idempotency reasoning through:

- `source_id`: stable source lineage
- `retry_of_job_id`: explicit rerun relationship when one job retries another
- `upstream_snapshot_key`: source-facing revision marker when available
- `input_fingerprint`: payload-level hash/fingerprint when available
- `pipeline_version`: distinguishes same input processed by different logic

This does not implement deduplication by itself, but it makes repeated imports
inspectable and gives later raw/candidate/publication layers stable anchors for
convergence rules.

## 7. Summary / Outcome Fields

The job carries a small operational summary:

- `raw_record_count`
- `normalized_candidate_count`
- `conflict_count`
- `published_record_count`

These fields are not analytics warehouse facts. They exist so operators and
later importer logic can quickly understand job shape and outcome without
recomputing the whole pipeline.

Failure and partial-outcome visibility is explicit through:

- `job_status`
- `current_stage`
- `status_reason`
- `error_code`
- lifecycle timestamps

## 8. What Is Intentionally Not Implemented Yet

Not part of this step:

- raw import record tables
- normalized candidate tables
- manual review queue tables
- publication event/result tables
- worker scheduling or retry orchestration
- importer dashboards or admin UI
- parser/source adapter implementations

This step only creates the tracking backbone those later tables and workflows
should attach to.
