# Content Ingestion Review Wave 1

Date: 2026-04-10
Verdict: GO WITH CONDITIONS

## 1. Purpose

Provide a final wave-1 ingestion checkpoint for the full content chain:

- dev JSON entrypoint
- raw import
- normalization
- manual review queue
- publication
- catalog-facing UI reads

The goal is to answer whether the current system is safe to scale
"booster by booster" without blurring pipeline boundaries or freezing incorrect
semantics into catalog truth.

## 2. Scope (Wave 1)

Reviewed wave-1 content and outcomes:

- `Apex Ruler, Bastion`
- `Fated One of Miracles, Rezael` regular printing
- `Fated One of Miracles, Rezael` DSR printing
- `Fated One of Time, Liael=Amorta`

Observed wave-1 results:

- raw products: `3`
- raw printings: `4`
- normalization: `3` auto-resolved, `1` unresolved
- review queue: `1` open `unresolved_mapping` item
- publication: `3` published printings, `1` skipped unresolved printing

## 3. End-to-End Pipeline Integrity

Assessment: strong

Confirmed chain:

- dev JSON import creates or resolves a tracked source and creates a tracked job
- raw product import writes importer-owned raw product records only
- raw printing import writes importer-owned raw printing records only
- normalization creates normalization results only
- review queue sync creates review items only
- publication is a separate catalog-owned write step
- catalog UI reads published catalog truth through catalog repositories

What is correct:

- no stage is skipped in the intended happy path
- importer does not write to catalog truth directly
- publication is not hidden inside normalization or review handling
- UI reads catalog truth instead of importer-layer truth

Important limit:

- the explicit wave-1 importer proof was an integration-level service run using
  a stateful repository harness, not a fully persisted local CLI run against a
  live Supabase REST/API runtime

## 4. Importer Stability

Assessment: acceptable with conditions

Stable properties:

- raw product import is idempotent within a job
- raw printing import is idempotent within a job
- repeated dev JSON imports reuse the same source and create a new tracked job
- normalization reruns are version-aware and support superseding
- manual review items remain tied to normalization outcomes instead of becoming
  detached workflow rows

Wave-1 behavior is predictable:

- `Bastion` resolves cleanly
- `Rezael` resolves as two printings on one canonical entity
- `Liael` stays unresolved and review-owned

Remaining condition:

- end-to-end operational stability is still stronger in tests and service-level
  orchestration than in one fully persisted local runtime execution

## 5. Normalization Review

Assessment: strong

Observed correctness:

- matching remains explainable rather than heuristic-heavy
- `Bastion` auto-resolves cleanly
- both `Rezael` printings resolve to the same canonical `CardEntity`
- `Liael` remains unresolved and is not guessed through

Why this matters:

- there is no evidence of over-matching in the current wave
- there is no evidence of unsafe under-matching in the resolved cases
- `CardEntity` identity remains canonical gameplay identity rather than a
  surrogate for published printings

Trade-off:

- the normalization strategy remains intentionally conservative, which will
  increase review volume as more boosters arrive

## 6. Review Queue Behavior

Assessment: strong

Observed behavior:

- unresolved wave-1 content creates a real queue item
- the queue item is traceable to normalization result, raw printing, job, and
  source
- review-worthy content is not silently attached to a canonical entity

Wave-1 result:

- `Liael=Amorta` entered the queue as `unresolved_mapping`
- the item remains `open`
- the case did not leak into published content

Conclusion:

- the queue is operationally meaningful, not merely a theoretical table

## 7. Publication Boundary

Assessment: strong with one operational gap

Confirmed:

- publication publishes only publishable normalization outcomes
- unresolved `Liael` is skipped
- publication preserves `CardEntity` vs `CardPrinting` semantics
- traceability is written onto published catalog rows

Wave-1 publication outcome:

- `3` printings published
- `Rezael` remains `2` printing rows on `1` canonical entity
- `Liael` remains outside catalog truth

Gap:

- publication currently does not close the loop back into `import_jobs`
  publication-stage tracking even though the import-tracking model supports it

## 8. Catalog Truth Consistency

Assessment: strong

Published catalog truth is currently coherent:

- `Bastion` exists as one published printing attached to one canonical entity
- `Rezael` exists as two published printings attached to one canonical entity
- `Liael` does not exist in published catalog truth
- there is no current evidence of duplicate published printings for wave 1
- there is no current evidence of broken entity or product references in wave 1

This is sufficient for the first catalog-facing product pages and card detail
reads already built on top of published data.

## 9. Data Enrichment Layers (Legalities / Keywords)

Assessment: strong

Wave-1 enrichment remains data-first:

- legality facts come from persisted legality + catalog data
- keyword/mechanics tags come from persisted catalog keyword tables
- UI reads enriched catalog data and does not hardcode semantic facts

Boundary integrity is preserved:

- legality truth is not conflated with deck-validation execution
- keyword/mechanics truth is not conflated with gameplay engine logic
- unpublished `Liael` does not receive catalog-facing legality or keyword data

## 10. Traceability

Assessment: strong

End-to-end traceability works in practice:

- published printing -> normalization result
- published printing -> raw printing
- published printing -> raw product when available
- published printing -> import job
- import job -> import source

This is already enough to answer:

- which source produced a published row
- which job ingested it
- which normalization result authorized publication
- which unresolved record remained review-owned instead of being published

## 11. Scalability Assessment

Assessment: GO WITH CONDITIONS

The current architecture is ready to scale booster-by-booster if the following
conditions are handled explicitly:

- publication must become part of tracked job lifecycle accounting rather than a
  catalog-only side effect
- one real persisted local run through the actual runtime entrypoint should be
  completed before claiming full operational confidence
- publication identity heuristics should not remain the long-term strategy for
  broader product-line expansion

What is already good enough for expansion:

- stage boundaries are real
- stage ownership is clean
- unresolved content is contained instead of leaking
- published catalog truth is not polluted by importer internals

## 12. Top Findings

### Finding 1

- Severity: MEDIUM
- Issue: publication does not currently update `import_jobs.current_stage` or
  `published_record_count`
- Why it matters: the import-tracking model explicitly supports publication
  lifecycle accounting, but wave-level operational traceability currently ends
  at normalization/review and then resumes only on published catalog rows
- Recommendation: add an explicit publication orchestration boundary that marks
  publication stage/status and records published counts back onto the job

### Finding 2

- Severity: MEDIUM
- Issue: the explicit wave-1 pipeline proof is integration-level and service
  real, but not yet a fully persisted local CLI/runtime-backed execution
- Why it matters: system logic is proven, but environment-level confidence is
  still lower than the code-level and repository-harness confidence
- Recommendation: perform one reproducible local persisted run through the
  actual dev entrypoint before claiming fully proven operational readiness

### Finding 3

- Severity: MEDIUM
- Issue: publication identity resolution still relies on wave-friendly
  heuristics for product family and derived keys
- Why it matters: the current D/DZ wave is covered, but title boosters, promos,
  special products, or broader line expansion will become fragile under
  heuristic family inference and slug-derived catalog keys
- Recommendation: move product-family classification and publication identity
  policy toward explicit catalog master data or publication mapping inputs
  before broader content expansion

### Finding 4

- Severity: ACCEPTABLE TRADE-OFF
- Issue: normalization remains intentionally conservative
- Why it matters: review volume will rise as coverage expands, but this is safer
  than aggressive matcher drift at the current maturity level
- Recommendation: expand matching rules only when there is measured need and a
  clear review-cost signal

## 13. Risks

Primary risks before larger expansion:

- jobs will not provide a complete operational picture of publication progress
  unless publication lifecycle tracking is added
- broader product-line coverage may expose publication key/family heuristics as
  brittle
- teams may overestimate runtime confidence if the harness-backed wave-1 proof
  is mistaken for a full local-stack operational run

These are real but manageable risks. None currently justify a `HOLD`.

## 14. Fixes Applied

None in this checkpoint.

This review did not require a safe code fix to maintain boundary integrity.

## 15. Final Verdict

Verdict: GO WITH CONDITIONS

Wave 1 proves that the system is architecturally coherent and already usable as
an ingestion pipeline:

- importer stages are explicit
- review behavior is explicit
- publication is explicit
- catalog UI reads published truth only

The pipeline is safe to scale beyond wave 1, but only if the next expansion
step addresses publication lifecycle tracking and avoids letting wave-specific
identity heuristics harden into permanent catalog policy.
