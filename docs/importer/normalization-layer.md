# Normalization Layer

## 1. Purpose

This step implements the normalization layer between raw importer persistence and
later publication into catalog truth.

It reads importer-owned raw printing records, attempts deterministic attachment
to canonical `CardEntity` rows, and persists importer-owned normalization
results.

It does not publish into final `catalog.card_printings` truth.

## 2. Scope

Included:

- reading raw card-printing records
- deterministic resolution toward canonical `CardEntity`
- importer-owned normalization result persistence
- explicit unresolved and review-blocked outcomes
- repeated normalization behavior with superseded historical results

Excluded:

- final publication into catalog truth
- manual review UI or queue implementation
- legality derivation
- fuzzy matching platform
- raw importer/parser work

## 3. Input And Output

Input:

- `importJobId`
- optional explicit `rawCardPrintingRecordIds[]`
- optional `normalizationVersion`

Output:

- persisted `importer.card_printing_normalization_results`
- updated import-job normalization counters/status
- run summary with processed/resolved/unresolved/conflict counts

## 4. Normalization Result Shape

Each normalization result stores:

- `import_job_id`
- `raw_card_printing_record_id`
- optional `raw_product_record_id`
- `normalization_version`
- `normalization_status`
- `resolution_basis`
- optional `proposed_card_entity_id`
- `candidate_card_entity_ids`
- `candidate_count`
- normalized match keys:
  - `normalized_name`
  - `normalized_grade`
  - `normalized_card_type`
  - `normalized_nation`
  - `normalized_clan`
  - `normalized_trigger_type`
- `raw_payload_fingerprint`
- `needs_manual_review`
- `status_reason`
- optional `conflict_summary`
- `resolution_evidence`
- timestamps

This keeps normalization output inspectable, traceable, and still separate from
published truth.

## 5. Status Model

The normalization layer uses these statuses:

- `auto_resolved`: one safe canonical entity was selected
- `unresolved`: no canonical name match was found
- `ambiguous`: multiple compatible canonical entities remained
- `blocked_for_review`: name matches existed, but structural fields conflicted
  with every candidate
- `superseded`: older result replaced by a newer normalization version

`auto_resolved` is considered ready for later publication, but not published.

`ambiguous` and `blocked_for_review` are review-needed outcomes.

## 6. Auto-Resolution Strategy

Current auto-resolution is deliberate and explainable:

1. Normalize imported card name into the catalog `normalized_name` shape.
2. Load canonical `catalog.card_entities` by exact normalized name.
3. Narrow exact-name matches using compatible imported structural fields when
   available:
   - grade
   - card type
   - nation
   - clan
   - trigger type

Resolution rules:

- zero exact-name matches -> `unresolved`
- exactly one compatible candidate -> `auto_resolved`
- more than one compatible candidate -> `ambiguous`
- exact-name matches exist but all conflict structurally ->
  `blocked_for_review`

No fuzzy scoring or hidden heuristics are used at this stage.

## 7. Unresolved / Ambiguous Handling

The layer does not guess through uncertainty.

- `unresolved` preserves a non-published result with no proposed canonical
  entity.
- `ambiguous` stores all compatible candidate ids and requires review.
- `blocked_for_review` stores conflicting name-match candidates and conflict
  context for later human action.

## 8. Traceability

Every normalization result remains traceable to:

- `import_sources` through `import_jobs`
- `import_jobs`
- `raw_card_printing_record_id`
- optional importer-layer `raw_product_record_id`
- the exact `normalization_version`
- the raw payload fingerprint used at normalization time

This allows later review/publication steps to explain where a candidate came
from and why it was resolved or withheld.

## 9. Relationship To Manual Review

The normalization layer now hands review-needed outcomes to the importer-owned
manual review queue.

- `unresolved`, `ambiguous`, and `blocked_for_review` results can become review
  items
- queue items are created from normalization outputs, not from raw rows alone
- candidate ids, conflict summary, and resolution evidence are stored so review
  does not need to re-infer context from scratch
- normalization still stops before publication into final catalog truth

## 10. What This Step Explicitly Does NOT Do

This layer does not:

- write to `catalog.card_printings`
- write to `catalog.card_entities`
- decide final publication
- implement manual review UI
- create legality/gameplay meaning
- collapse `Product`, `CardPrinting`, and `CardEntity` into one model

## 11. Summary

The normalization layer is now a real persisted stage between raw importer
facts and published catalog truth.

It provides:

- deterministic canonical-card attachment where safe
- explicit unresolved and review-blocked outcomes
- repeated-run behavior via normalization versions and superseded results
- clear traceability to raw records, jobs, and source lineage
