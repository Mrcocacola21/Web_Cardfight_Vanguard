# Publication Lifecycle

## 1. Purpose

Close the operational gap between importer-stage normalization/review and the
catalog publication boundary by making publication a tracked final stage of the
import-job lifecycle.

## 2. Current Lifecycle Gap Closed By This Step

Before this step:

- publication already existed as an explicit catalog write boundary
- published rows already carried provenance
- `import_jobs` did not reflect that publication had actually run

After this step:

- publication starts under tracked stage `publication`
- successful publication finalizes the job at tracked stage `published`
- `published_record_count` is recorded on the import job

## 3. How Publication Updates `import_jobs`

Publication now uses the existing importer job lifecycle instead of staying a
detached catalog-only action.

On publication start:

- `job_status = running`
- `current_stage = publication`

On successful publication completion:

- `current_stage = published`
- `job_status = completed` when nothing is skipped
- `job_status = partially_completed` when some normalization results remain
  unpublished
- `published_record_count = published_printing_count`
- `finished_at` is set as the completion timestamp

No separate `completed_at` field was introduced because the current tracking
model already uses `finished_at` as the terminal timestamp.

## 4. Publication Outcome Accounting

Publication accounting stays intentionally small and operational:

- `published_record_count` counts published printing-level records

Why printing-level:

- publication unit is `CardPrinting`
- products may be supportive release context, but the publication unit crossing
  normalization into catalog truth is the printing

Mixed jobs are handled honestly:

- if some printings publish and some remain review-owned, the job becomes
  `partially_completed`

## 5. Retry-Safe Behavior

Publication remains idempotent and retry-safe:

- catalog products still upsert by stable identity
- catalog printings still upsert by deterministic `printing_key`
- published provenance remains stable

Tracked lifecycle behavior:

- first successful publication finalizes the job
- replaying publication for an already published job is safe
- if the replay does not change the terminal publication result, the job is not
  churned back through another lifecycle transition
- counts do not inflate on rerun

## 6. Error Handling

If the first publication attempt fails:

- the job is marked `failed`
- `current_stage` remains `publication`
- `finished_at` records the failure time
- `error_code = publication_failed`
- `status_reason` stores the publication failure summary

If a replay of an already published job fails:

- the error is returned and logged
- the previously successful terminal job state is preserved

This avoids misleadingly turning a previously published job into a failed one
because of a non-destructive replay attempt.

## 7. Logging / Operational Visibility

Publication now emits structured lifecycle logs for:

- start
- success
- failure

Logged context includes:

- `importJobId`
- whether the run is a replay of an already published job
- final stage/status where relevant
- attempted / publishable / published / skipped counts
- failure message and code where relevant

This is not a metrics platform. It is the minimum useful operational visibility
for a tracked terminal stage.

## 8. What This Step Explicitly Does NOT Do

This step does not:

- move publication into importer raw/normalization stages
- create a giant workflow engine
- add admin or operator UI
- add new content waves
- change publication unit from printing-level to entity-level
- weaken provenance or importer/catalog boundaries

## 9. Summary

Publication is now a real tracked final stage of the ingestion pipeline:

- raw -> normalization -> review -> publication -> published
- import jobs now record publication completion honestly
- reruns stay idempotent
- failure handling is explicit
- catalog publication remains a dedicated boundary instead of a hidden side
  effect
