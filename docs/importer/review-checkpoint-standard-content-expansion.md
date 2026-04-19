# Review Checkpoint: Standard Content Expansion

## 1. Executive Summary

Checkpoint date:
`2026-04-17`

Expanded Standard content remains semantically intact across the reviewed
slice:

- `DZ-BT01` booster
- `D-SD03` start deck
- `DZ-LBT01` lyrical booster
- `DZ-SS05` special series product

Observed published scope:

- `4` reviewed products
- `31` reviewed printings
- booster and non-booster families both present
- legality, restrictions, keyword tags, and printing semantics all available on
  real published data

Runtime verification stayed clean:

- booster wave rerun:
  `10 raw records -> 9 normalized -> 9 published`
- additional products wave rerun:
  `25 raw records -> 22 normalized -> 22 published`
- latest jobs completed with `conflict_count = 0`
- repeat imports kept stable product/printing identities and moved provenance
  to the latest successful jobs

Verdict:
`GO WITH CONDITIONS`

The current expansion pattern is usable and repeatable, but continued growth
should not rely indefinitely on prefix-based family classification,
collector-prefix printing heuristics, and manual canonical bootstrap /
restriction overlay steps.

## 2. Scope Reviewed

Runtime evidence used in this checkpoint:

- [run-standard-data-enrichment.ts](/C:/codes/Web_VG/scripts/run-standard-data-enrichment.ts)
- direct local Supabase checks against:
  - `catalog.products`
  - `catalog.card_printings`
  - `importer.import_jobs`
  - `importer.manual_review_items`

Code paths reviewed:

- normalization:
  [card-printing-normalizer.ts](/C:/codes/Web_VG/packages/importer/src/normalization/card-printing-normalizer.ts)
- manual review queue:
  [manual-review-queue.ts](/C:/codes/Web_VG/packages/importer/src/review/manual-review-queue.ts)
- publication identity + printing shaping:
  [catalog-publication-identity.ts](/C:/codes/Web_VG/packages/catalog/src/services/catalog-publication-identity.ts),
  [catalog-publication-unit-preparer.ts](/C:/codes/Web_VG/packages/catalog/src/services/catalog-publication-unit-preparer.ts)
- catalog legality / keyword / printing reads:
  [catalog.repository.ts](/C:/codes/Web_VG/packages/db/src/repositories/catalog/catalog.repository.ts)
- deck-builder validation data reads:
  [deck-builder-validation-read.ts](/C:/codes/Web_VG/apps/web/src/features/decks/server/deck-builder-validation-read.ts)

Review scope stayed intentionally narrow:

- no new content wave was added
- no redesign was attempted
- only current Standard expansion behavior was reviewed for integrity and drift

## 3. Importer Pipeline Integrity

The pipeline still behaves as an explicit chain:

- raw import
- normalization
- review queue sync
- publication
- catalog truth

Observed runtime behavior:

- booster rerun latest job:
  `3d7f6e9a-428c-47c0-9551-842d38009f00`
- additional-products rerun latest job:
  `1b119fb3-1cb8-4962-81bc-b97726fe80de`
- both jobs ended in:
  `job_status = completed`, `current_stage = published`

Boundary check result:

- importer direct catalog writes were not observed
- publication remains the single write bridge into catalog truth
- enrichment verifier still reports:
  `publicationRemainsSingleWriteBridge = true`

Repeatability result:

- source reuse: yes
- jobs distinct: yes
- input fingerprint stable: yes
- snapshot key stable: yes
- product ids stable across reruns: yes
- printing ids stable across reruns: yes

Conclusion:

- current pipeline integrity is still strong
- no hidden shortcut around publication was found in the reviewed Standard
  slice

## 4. Normalization Review

Current normalization remains conservative and structurally coherent.

Reviewed behavior:

- matching starts from normalized exact name
- compatibility then checks:
  `grade`, `cardType`, `nation`, `clan`, `triggerType`
- incompatible matches become review-owned rather than silently attached

Relevant implementation:

- exact-name candidate grouping:
  [card-printing-normalizer.ts:615](/C:/codes/Web_VG/packages/importer/src/normalization/card-printing-normalizer.ts:615)
- resolved / ambiguous / blocked outcomes:
  [card-printing-normalizer.ts:629](/C:/codes/Web_VG/packages/importer/src/normalization/card-printing-normalizer.ts:629)
- structural compatibility checks:
  [card-printing-normalizer.ts:756](/C:/codes/Web_VG/packages/importer/src/normalization/card-printing-normalizer.ts:756)

Observed runtime totals across the reviewed Standard slice:

- `31 / 31` reviewed printings normalized successfully
- latest expanded jobs produced:
  - `31 auto_resolved`
  - `0 unresolved`
  - `0 ambiguous`

Integrity observations:

- regular + alt-art Rezael printings collapse to one canonical entity
- regular + FR Cethlan printings collapse to one canonical entity
- regular + MSP Coral printings collapse to one canonical entity
- CR + GCR Cerrgaon printings collapse to one canonical entity
- no extra `CardEntity` rows were observed for rarity or art variants

Important nuance:

- current matcher does not use `base_power` or `base_shield`
- this is acceptable for the curated D/DZ slice reviewed here
- it remains a future ambiguity risk if Standard grows into cards sharing the
  same normalized name and current structural fields

Conclusion:

- no current semantic error was observed in entity grouping
- normalization is still stable under the current expansion volume

## 5. Review Queue Review

The review queue still behaves as a safety valve, not as hidden dead code.

Relevant implementation:

- auto-resolved and superseded results do not create review items:
  [manual-review-queue.ts:723](/C:/codes/Web_VG/packages/importer/src/review/manual-review-queue.ts:723)
- unresolved / ambiguous / conflicting results map to explicit review reasons:
  [manual-review-queue.ts:765](/C:/codes/Web_VG/packages/importer/src/review/manual-review-queue.ts:765)

Observed behavior for the reviewed Standard expansion jobs:

- booster rerun review items:
  `0`
- additional-products rerun review items:
  `0`

Observed global queue state from local DB:

- latest `25` items query returned `6` open review items
- all visible recent items were `unresolved_mapping`
- latest open queue items came from other imports, not the reviewed Standard
  waves

Assessment:

- queue path is alive
- queue is not being artificially bypassed by the reviewed Standard waves
- but the expanded Standard slice still has a coverage gap:
  it did not re-exercise ambiguous or unresolved review handling

Conclusion:

- queue quality is acceptable
- queue stress on expanded Standard content is still limited

## 6. Publication Integrity Review

Publication integrity remains strong for the reviewed slice.

Schema support for stable truth + provenance:

- product uniqueness:
  [20260408120600_create_products.sql:27](/C:/codes/Web_VG/supabase/migrations/20260408120600_create_products.sql:27)
- printing uniqueness:
  [20260408120800_create_card_printings.sql:1](/C:/codes/Web_VG/supabase/migrations/20260408120800_create_card_printings.sql:1)
- provenance columns and unique source links:
  [20260409180000_add_catalog_publication_provenance.sql:2](/C:/codes/Web_VG/supabase/migrations/20260409180000_add_catalog_publication_provenance.sql:2)

Observed publication results:

- `31 / 31` reviewed printings publishable
- `31 / 31` reviewed printings published
- unresolved content did not leak because no unresolved rows were publishable
- publication replay remained idempotent-aware on the same job

Direct DB integrity checks for the reviewed slice:

- reviewed products with non-null provenance:
  `4 / 4`
- reviewed printings with non-null provenance:
  `31 / 31`
- reviewed duplicate product identities found:
  `0`
- reviewed duplicate printing identities found:
  `0`

Product family semantics after publication:

- `D-SD03` -> `deck / start`
- `DZ-BT01` -> `booster / main`
- `DZ-LBT01` -> `booster / lyrical`
- `DZ-SS05` -> `special-set / special-series`

Conclusion:

- publication is still preserving product, printing, and provenance semantics
- no publication-level collapse of product-family distinctions was observed

## 7. Catalog Truth Integrity

Catalog truth is still usable as a read-side source of record, not just as a
bag of rows.

Observed truth properties:

- selected products remain discoverable by official code and canonical key
- selected printings remain discoverable by printing key
- product-scoped search works for booster and non-booster products
- product detail and printing detail reads work against the published slice

Relevant catalog reads:

- legality facts:
  [catalog.repository.ts:201](/C:/codes/Web_VG/packages/db/src/repositories/catalog/catalog.repository.ts:201)
- keyword tags:
  [catalog.repository.ts:411](/C:/codes/Web_VG/packages/db/src/repositories/catalog/catalog.repository.ts:411)
- entity printings:
  [catalog.repository.ts:458](/C:/codes/Web_VG/packages/db/src/repositories/catalog/catalog.repository.ts:458)
- product printings:
  [catalog.repository.ts:483](/C:/codes/Web_VG/packages/db/src/repositories/catalog/catalog.repository.ts:483)

Observed catalog facts:

- no broken product / printing / entity reads during verifier runs
- no weird cross-family merging across start deck, lyrical, and special series
- keyword tags remain entity-level
- alt-art / promo semantics remain printing-level

Conclusion:

- catalog truth remains operationally usable after Standard expansion

## 8. Enrichment Review

Step `11.4` enrichment remains coherent on the expanded content base.

Legalities:

- reviewed D/DZ cards show:
  `allowed` in `Standard` and `Premium`
- same cards show:
  `disallowed` in `V Premium`

Restrictions:

- Rezael / Cerrgaon Standard choice restriction still resolves correctly
- active source reference now points to the official English deck-rules page

Keywords / mechanics:

- structured keyword tags load correctly for:
  Bastion, Rezael, Kurabiel, Cethlan, Olbaria
- flattened keyword arrays remain aligned with structured tags

Printing semantics:

- DSR / FR / MSP / GCR variants are published as alternate-art printings
- CR remains a distinct non-alt special variant

Important caveat:

- active Standard restriction metadata is still development-stamped
  (`versionLabel = dev-2026-04`, `effectiveFrom = 2026-04-08`)
- that is usable for current validation and catalog read-side behavior
- it is not yet a durable long-term operational governance shape

Conclusion:

- enrichment is usable and no longer POC-only
- enrichment is still partly curated rather than broadly automated

## 9. Validation Interaction Review

Validation still interacts with expanded content through structured data, not
through UI-owned assumptions.

Relevant implementation:

- deck-builder validation reads legality facts from the catalog repository:
  [deck-builder-validation-read.ts:166](/C:/codes/Web_VG/apps/web/src/features/decks/server/deck-builder-validation-read.ts:166)
- active restriction lists are loaded from legality tables:
  [deck-builder-validation-read.ts:520](/C:/codes/Web_VG/apps/web/src/features/decks/server/deck-builder-validation-read.ts:520)

Observed smoke results:

- valid Rezael deck:
  `0` issues
- valid Bastion deck:
  `0` issues
- Rezael + Cerrgaon:
  `choice-restriction-violated`
- missing ride deck:
  `standard-ride-deck-missing`
- Bastion + Coral:
  `standard-nation-mismatch`

Conclusion:

- imported cards still participate honestly in validation
- no false-positive or false-negative regression was observed in the reviewed
  smoke scenarios

## 10. Product-Family Diversity Review

The reviewed Standard slice is no longer booster-only, and the system did not
collapse back into booster-only semantics.

Reviewed families:

- booster main:
  `DZ-BT01`
- deck start:
  `D-SD03`
- booster lyrical:
  `DZ-LBT01`
- special-set special-series:
  `DZ-SS05`

Observed behavior:

- normalization did not branch on product family
- publication preserved `product_category` and `product_kind`
- catalog read-side still handled all four product shapes

Conclusion:

- product-family diversity is now real in the catalog truth
- current expansion pattern still survives that diversity

## 11. Semantic Drift Risks

### Risk 1

Severity:
`medium`

Issue:
Product family resolution still depends on hardcoded code prefixes.

Why it matters:

- current logic maps Standard/V/Premium through `D-`, `DZ-`, `V-`, `G-`, and
  `PR-` prefixes only
- future product codes outside those prefixes would silently stop classifying
  into the right family

Evidence:

- [catalog-publication-identity.ts:7](/C:/codes/Web_VG/packages/catalog/src/services/catalog-publication-identity.ts:7)

Recommendation:

- move family classification toward explicit source/product metadata or a small
  central registry instead of prefix inference only

### Risk 2

Severity:
`medium`

Issue:
Printing semantics are still inferred heuristically from collector prefixes,
rarity, and `PR-` product codes.

Why it matters:

- current reviewed variants publish correctly
- future Standard variants can drift if new rarity/art naming conventions do not
  fit the current collector-prefix set

Evidence:

- [catalog-publication-unit-preparer.ts:83](/C:/codes/Web_VG/packages/catalog/src/services/catalog-publication-unit-preparer.ts:83)
- [catalog-publication-unit-preparer.ts:300](/C:/codes/Web_VG/packages/catalog/src/services/catalog-publication-unit-preparer.ts:300)

Recommendation:

- promote printing semantics into explicit ingestion/publication data instead of
  letting publication infer all meaning from collector strings

### Risk 3

Severity:
`medium`

Issue:
New-content expansion still depends on manual canonical bootstrap and explicit
restriction overlay steps.

Why it matters:

- this is operationally manageable for curated waves
- it becomes a growth tax and a drift risk as the number of new cards and rules
  grows

Evidence:

- [run-booster-by-booster-expansion.ts:84](/C:/codes/Web_VG/scripts/run-booster-by-booster-expansion.ts:84)
- [run-booster-by-booster-expansion.ts:1299](/C:/codes/Web_VG/scripts/run-booster-by-booster-expansion.ts:1299)
- [run-additional-standard-products-expansion.ts:101](/C:/codes/Web_VG/scripts/run-additional-standard-products-expansion.ts:101)
- [run-additional-standard-products-expansion.ts:1419](/C:/codes/Web_VG/scripts/run-additional-standard-products-expansion.ts:1419)

Recommendation:

- keep the current bootstrap path for now, but plan a cleaner canonical
  onboarding pattern before Standard coverage grows much further

### Risk 4

Severity:
`low`

Issue:
Expanded Standard waves did not re-exercise ambiguous or unresolved review
behavior.

Why it matters:

- runtime queue path is alive
- but current D/DZ curated waves were too clean to test queue pressure under
  expansion

Evidence:

- reviewed Standard reruns produced `0` review items
- global queue still contains `6` open `unresolved_mapping` items from other
  imports

Recommendation:

- include one controlled unresolved or ambiguous card in an upcoming Standard
  wave without bypassing the pipeline

## 12. Top Findings

### Finding 1

Severity:
`medium`

Issue:
Prefix-based product family classification is the main scaling risk, not a
current broken behavior.

Why it matters:

- current expansion works because all reviewed Standard products fit existing
  prefixes
- one off-pattern product code would create silent publication omission or
  family misclassification

Recommendation:

- replace prefix-only classification with explicit product-family data before
  Standard growth becomes broad

### Finding 2

Severity:
`medium`

Issue:
Printing-level semantic enrichment is working, but the implementation is still
heuristic-based.

Why it matters:

- alternate-art handling currently succeeds on DSR / FR / MSP / GCR
- future rarity/variant families can drift faster than the current hardcoded
  prefix list

Recommendation:

- prefer source-fed printing semantics over collector-prefix inference

### Finding 3

Severity:
`medium`

Issue:
Canonical bootstrap and rule overlay steps remain manual operational
dependencies for new content.

Why it matters:

- current wave-by-wave delivery is still manageable
- repeated manual bootstrap becomes the most likely source of future
  inconsistency as content volume rises

Recommendation:

- formalize canonical onboarding and restriction-overlay refresh as an explicit
  operational pattern

### Finding 4

Severity:
`low`

Issue:
Review queue integrity looks healthy, but expanded Standard content has not yet
stress-tested it again.

Why it matters:

- safety-valve behavior remains present
- confidence in queue behavior under future larger waves is still partly
  inherited from earlier review-focused imports

Recommendation:

- schedule one deliberately review-bearing Standard wave soon

## 13. Fixes Applied

No production code fix was applied in this checkpoint.

Reason:

- the reviewed Standard slice does not currently show an active integrity
  defect that justifies widening scope
- the highest-value output of this step is an honest architectural/data review
  and explicit continuation conditions

## 14. Final Verdict

Verdict:
`GO WITH CONDITIONS`

Why:

- importer -> normalization -> review -> publication -> catalog boundaries are
  still intact
- no semantic drift was observed in the reviewed published D/DZ slice
- product-family diversity did not break normalization, publication, catalog,
  or validation
- enrichment is materially usable for validation and catalog UX
- repeatability and provenance behavior remain strong

Conditions before accelerating Standard expansion:

- keep adding content wave-by-wave, not as giant bulk imports
- do not extend prefix-based family inference indefinitely
- do not extend collector-prefix printing heuristics indefinitely
- reduce dependence on manual canonical bootstrap / overlay operations
- re-exercise review queue behavior on a future Standard wave with a controlled
  unresolved or ambiguous case

Safe continuation statement:

- yes, Standard expansion can continue safely
- it should continue under the conditions above, not as unconstrained scale-up
