# Content Wave 1 Entity vs Printing Validation

## 1. Purpose

Validate the actual wave-1 importer outcome as a gate before any
publication-oriented step, specifically through the `Product` /
`CardPrinting` / `CardEntity` contract.

Verdict target for this check:

- one canonical gameplay entity where one should exist
- multiple printings preserved as multiple printings
- unresolved case stays unresolved and review-backed
- no semantic collapse between raw, normalization, and published truth

## 2. Wave-1 Outcome Reviewed

Reviewed outcome:

- source: `source-1`
- job: `job-1`
- job state: `blocked_for_review`
- raw products: `3`
- raw printings: `4`
- normalization:
  - auto-resolved: `3`
  - unresolved: `1`
  - ambiguous: `0`
  - ready-for-publication: `3`
- review queue:
  - items: `1`
  - reason: `unresolved_mapping`
  - status: `open`

Reviewed cards:

- `Apex Ruler, Bastion`
- `Fated One of Miracles, Rezael` regular
- `Fated One of Miracles, Rezael` DSR
- `Fated One of Time, Liael=Amorta`

## 3. CardEntity Duplication Check

Result: no unintended canonical duplication was observed in the wave-1
outcome.

Evidence:

- `Apex Ruler, Bastion` resolves once to `entity-bastion`
- both `Rezael` printings resolve to the same canonical entity:
  `entity-rezael`
- no second canonical identity is implied by the parallel `Rezael` printing

Assessment:

- current normalization output is semantically safe for the canonical identity
  side of the wave

## 4. Multiple Printings Check (`Rezael`)

Result: passed with the intended semantics.

Observed behavior:

- two distinct raw printings exist for `Rezael`
- both point to the same raw product context
- both generate separate normalization results
- both normalization results point to `entity-rezael`

What this means:

- canonical gameplay identity is shared
- printing identity is still distinct
- the result does not flatten the two printings into one printing-like record

Risk level:

- low for this wave

## 5. Unresolved Case Check (`Liael=Amorta`)

Result: passed with the intended safety behavior.

Observed behavior:

- raw import succeeded
- normalization status stayed `unresolved`
- `proposedCardEntityId` remained `null`
- one manual review item was created with:
  - reason: `unresolved_mapping`
  - status: `open`

What this means:

- the unresolved record is contained in explicit pipeline state
- no hidden best-effort canonical attachment happened
- the record is not semantically safe for publication yet

## 6. Product / CardPrinting / CardEntity Separation Review

Result: the three layers remain distinct in the wave-1 outcome.

Observed separation:

- `Product` is represented through raw product context and raw-product linkage
- `CardPrinting` is represented by separate raw printing rows and separate
  normalization results per printing
- `CardEntity` appears only as proposed canonical attachment in normalization
  output

Why this matters:

- `Rezael` shows shared entity without losing printing identity
- `Liael` shows unresolved printing without pretending the entity already exists
- normalization still behaves as attachment logic, not as silent publication

## 7. Publication Readiness Implications

Entity-vs-printing readiness by case:

- `Apex Ruler, Bastion`: publish-safe from this lens
- `Fated One of Miracles, Rezael` regular: publish-safe from this lens
- `Fated One of Miracles, Rezael` DSR: publish-safe from this lens
- `Fated One of Time, Liael=Amorta`: not publish-safe from this lens

Important limitation:

- this check only validates semantic correctness of entity/printing attachment
- it does not perform publication, legality enrichment, or broader content QA

## 8. Top Findings

1. `ACCEPTABLE`: the current wave preserves one canonical `Rezael` entity while
   keeping two separate printings. This is the desired multi-printing outcome.
2. `ACCEPTABLE`: the unresolved `Liael` record is safely contained by
   normalization + review queue and is not treated as publish-ready.
3. `LOW`: wave-1 validation is still based on the explicit integration harness
   run, not a DB-backed publication rehearsal. The semantic gate is valid, but
   one more checkpoint will still be needed once publication exists.

## 9. Fixes Applied

Applied in tests:

- strengthened the integrated wave-1 run test to assert:
  - the two `Rezael` normalization results have distinct printing anchors
  - both still share the same canonical entity
  - the unresolved `Liael` result is excluded from the publish-ready subset

## 10. Final Verdict

`GO WITH CONDITIONS`

Conditions:

- proceed toward publication foundation only for the three resolved printings
- keep `Liael=Amorta` outside publication until explicit review resolution exists
- keep publication logic explicit so that resolved printing publication does not
  blur printing rows into canonical entity rows
