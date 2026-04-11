# Manual Review Queue

## 1. Purpose

This step implements an explicit importer-owned manual review layer between
normalization and later publication.

It stores reviewable normalization outcomes as first-class queue items and
preserves the context needed for later human resolution.

It does not publish into final catalog truth.

## 2. Scope

Included:

- persistence for manual review items
- creation of review items from normalization outcomes
- queue status/lifecycle handling
- traceability to jobs, raw records, and normalization results
- resolution metadata persistence without publication side effects

Excluded:

- reviewer UI
- permissions and reviewer roles
- notifications
- publication workflow
- bulk review console

## 3. What Enters The Queue

The queue accepts normalization outcomes that are unsafe to auto-publish:

- `unresolved` -> `unresolved_mapping`
- `ambiguous` -> `ambiguous_mapping`
- `blocked_for_review` with conflicting structural evidence ->
  `conflicting_facts`
- `blocked_for_review` with exceptional shapes or metadata gaps ->
  `exceptional_card`

`auto_resolved` results do not create queue items.

## 4. Review Item Shape

Each review item stores:

- `import_job_id`
- `normalization_result_id`
- `raw_card_printing_record_id`
- optional `raw_product_record_id`
- `review_reason`
- `review_status`
- `summary`
- `context_payload`
- `candidate_card_entity_ids`
- optional `proposed_card_entity_id`
- optional resolution fields:
  - `resolution_kind`
  - `resolved_card_entity_id`
  - `decision_notes`
- lifecycle timestamps:
  - `opened_at`
  - `started_review_at`
  - `resolved_at`
  - `closed_at`
  - `updated_at`

This keeps review items structured and inspectable without turning the queue
into a free-form blob.

## 5. Status Model

Review items use these statuses:

- `open`: newly queued and waiting for review
- `in_review`: actively being worked
- `resolved`: reviewer made a durable queue-level resolution
- `rejected`: reviewer rejected the imported record at queue level
- `superseded`: older queue item replaced by a newer normalization outcome
- `cancelled`: no longer actionable because the upstream normalization result no
  longer requires review

`resolved`, `rejected`, `superseded`, and `cancelled` are terminal queue
statuses.

## 6. Relationship To Normalization Results

The queue is keyed by normalization output, not raw rows directly.

- one normalization result can have at most one queue item
- repeated normalization for the same raw printing can create a new queue item
  if a new normalization result is produced
- older queue items can be marked `superseded`
- resolved or rejected historical items remain as audit trail

This avoids queue spam while preserving history across repeated runs.

## 7. Resolution Model

Queue resolution records reviewer intent, but it does not publish anything.

Supported resolution kinds:

- `accept_proposed_match`
- `select_candidate_match`
- `keep_unresolved`
- `mark_exceptional`
- `reject_imported_record`

Queue resolution means: a human decision has been stored for later publication
or follow-up. It does not mutate final catalog tables.

## 8. Traceability And Auditability

Each queue item is traceable to:

- `import_sources` through `import_jobs`
- `import_jobs`
- `raw_card_printing_record_id`
- optional importer-layer `raw_product_record_id`
- `normalization_result_id`
- the structured reason and context that caused escalation
- the final queue-level decision, if one exists

This makes it possible to answer why a case was queued, where it came from, and
what decision was recorded later.

## 9. Exceptional-Card Handling

Exceptional cards and records are handled explicitly through the
`exceptional_card` review reason.

This bucket is for cases such as:

- non-standard card structures
- metadata gaps that make normal matching unsafe
- source records that need human judgment before normalization can proceed

They are not forced into fake ambiguity when the real issue is exceptional
shape.

## 10. What This Step Explicitly Does NOT Do

This queue foundation does not:

- publish into `catalog.card_printings`
- publish into `catalog.card_entities`
- implement reviewer UI
- implement permissions or assignments
- send notifications
- build an operations dashboard

## 11. Summary

The manual review queue is now an explicit persisted pipeline layer.

It gives the importer pipeline:

- predictable escalation for unresolved, ambiguous, conflicting, and
  exceptional cases
- durable review lifecycle and decision metadata
- traceability to source/job/raw/normalization context
- a clean boundary to later reviewer UI and publication work
