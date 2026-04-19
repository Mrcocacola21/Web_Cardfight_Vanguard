# Additional Standard Products Expansion

## 1. Scope of This Wave

This wave intentionally validated non-booster Standard ingestion with one
curated product from each additional product family that matters for real deck
building and catalog completeness:

- `D-SD03` start deck
- `DZ-LBT01` lyrical product
- `DZ-SS05` special series product

The scope stayed small on purpose:

- diversity of product families was the goal, not volume
- the wave reused the existing importer and publication path unchanged
- no direct catalog writes were introduced

Important runtime context:

- `D-SD03` and `DZ-SS05` already existed in the local catalog from the earlier
  Standard expansion wave
- `DZ-LBT01` was the net-new product line added by this step
- this made the wave useful for both new-product ingestion and non-booster
  repeatability checks on already known products

## 2. Product Families Included

Imported products in this wave:

- start deck:
  `D-SD03 Start Deck 03: Tohya Ebata -Apex Ruler-`
- lyrical product:
  `Cardfight!! Vanguard Lyrical Booster: Lyrical Monasterio Sparkling Stars!`
  (`DZ-LBT01`)
- special series:
  `DZ-SS05 CoroCoro Start Deck Pack`

Observed family/type preservation after publication:

- `D-SD03` -> `product_category = deck`, `product_kind = start`
- `DZ-LBT01` -> `product_category = booster`, `product_kind = lyrical`
- `DZ-SS05` -> `product_category = special-set`,
  `product_kind = special-series`

All three remained in `family-standard`.

## 3. Input Structure

Fixture created for this step:

- [additional-standard-products-expansion-wave-11-3.json](/C:/codes/Web_VG/packages/importer/fixtures/dev-json/additional-standard-products-expansion-wave-11-3.json)

Runtime verifier created for this step:

- [run-additional-standard-products-expansion.ts](/C:/codes/Web_VG/scripts/run-additional-standard-products-expansion.ts)

Additional canonical bootstrap used for the lyrical slice:

- [additional_standard_products_wave_11_3_canonical_bootstrap.sql](/C:/codes/Web_VG/supabase/snippets/additional_standard_products_wave_11_3_canonical_bootstrap.sql)

Input shape stayed aligned with the existing importer contract:

- stable `source.key = dev-json.additional-standard-products-expansion-wave-11-3`
- stable `snapshotKey = wave-11-3-v1`
- exactly `3` product rows
- exactly `22` printing rows

Printing distribution by product:

- `D-SD03`: `15`
- `DZ-LBT01`: `5`
- `DZ-SS05`: `2`

The lyrical slice deliberately included parallel printings for one card:

- `Aurora Star, Coral` regular `RRR`
- `Aurora Star, Coral` `MSP`

The special-series slice did the same:

- `Cerrgaon` `CR`
- `Cerrgaon` `GCR`

This gave the wave a direct check that non-booster variants still collapse to
one canonical entity while remaining separate printings.

## 4. Importer Pipeline Results

Observed source:

- source key:
  `dev-json.additional-standard-products-expansion-wave-11-3`
- source id:
  `2bcc3bec-7288-42d2-a80a-9591071a7929`
- source did not exist before this script run

Two back-to-back import jobs were executed against the exact same fixture:

- first job:
  `7e8f3815-d944-4912-9501-ef243295d79c`
- second job:
  `7731c073-fb74-49f4-b8af-e4ed3567c1f5`

Per job, the importer behaved consistently:

- raw products: `3`
- raw printings: `22`
- linked raw printings: `22`
- `raw_record_count = 25`
- `normalized_candidate_count = 22`
- `conflict_count = 0`

Observed lifecycle:

- pre-publication status / stage:
  `partially_completed` / `normalization`
- final status / stage:
  `completed` / `published`

Publication results were identical across both runs:

- attempted: `22`
- publishable: `22`
- published products: `3`
- published printings: `22`
- skipped: `0`

Replay of publication for the same job remained safe:

- replay did not create duplicate rows
- replay preserved `published_record_count = 22`
- replay preserved stable product and printing identities

Performance remained well within acceptable bounds for this wave:

- total verifier runtime: `4810 ms`
- first importer pass: `1392 ms`
- first publication pass: `150 ms`
- second importer pass: `1228 ms`
- second publication pass: `113 ms`

## 5. Normalization Behavior

Observed normalization counts per run:

- total results: `22`
- `auto_resolved`: `22`
- `unresolved`: `0`
- `ambiguous`: `0`

Per-product breakdown:

- `D-SD03`: `15/15 auto_resolved`
- `DZ-LBT01`: `5/5 auto_resolved`
- `DZ-SS05`: `2/2 auto_resolved`

Integrity checks passed for non-booster variant handling:

- `Aurora Star, Coral` regular and `MSP` both normalized to
  `card.aurora-star-coral`
- `Cerrgaon` `CR` and `GCR` both normalized to `card.cerrgaon`
- no extra `CardEntity` rows were created for lyrical or special-series
  variants

Observed normalization behavior confirms that current matching is not
booster-specific:

- matching still depends on normalized name plus structural fields
  `grade/type/nation/clan/trigger`
- current compatibility checks do not depend on product family
- current compatibility checks do not depend on rarity or art variant

One operational condition remains unchanged:

- normalization still requires canonical entities to exist before import
- this wave therefore needed a small lyrical canonical bootstrap for the new
  `DZ-LBT01` slice

## 6. Review Queue Behavior

Observed review queue counts per run:

- total items: `0`

For this curated wave, that was acceptable:

- every imported printing matched exactly one canonical entity
- every normalization result had `candidateCount = 1`
- nothing fell into `unresolved_mapping`
- no ambiguous case was silently auto-attached

Operational note:

- queue behavior stayed correct by absence of review-owned cases
- this wave did not stress the queue with a controlled unresolved non-booster
  example

## 7. Publication Results

Publication integrity checks passed:

- all `22` publishable printings were present in `catalog.card_printings`
- unresolved rows were not present because no unresolved rows existed
- product -> printing -> entity links remained valid
- `product_category` and `product_kind` were preserved exactly for all three
  products

Catalog product identities after publication:

- `D-SD03` product id:
  `c8ab6fd0-db37-40de-9acb-965316b7919d`
- `DZ-LBT01` product id:
  `0f0e24aa-bc10-45d7-ba47-b27bd7fa614a`
- `DZ-SS05` product id:
  `dcb02355-49c1-46fa-a929-883afa675582`

Publication behavior by product:

- `DZ-LBT01` created a stable new lyrical product row with `5` printings
- `D-SD03` and `DZ-SS05` reused their existing catalog identities
- after the second run, provenance moved forward to the second import job for
  all three products

This is the desired publication shape:

- stable catalog identity
- latest successful import remains the current provenance
- product-family distinctions survive publication unchanged

## 8. Catalog Usability

Catalog usability checks passed on all three product families.

Product-scoped search remained usable:

- searching `bastion` inside `D-SD03` returned
  `card.apex-ruler-bastion`
- searching `aurora` inside `DZ-LBT01` returned
  `card.aurora-star-coral`
- searching `cerrgaon` inside `DZ-SS05` returned
  `card.cerrgaon`

Product views also remained coherent:

- `D-SD03` exposed `15` printings
- `DZ-LBT01` exposed `5` printings
- `DZ-SS05` exposed `2` printings

Observed read-side behavior stayed honest:

- start deck remained a deck product, not collapsed into booster semantics
- lyrical product remained a lyrical booster, not flattened into `main`
- special series remained a `special-set`

## 9. Validation Smoke Results

Validation used the real catalog / legality path.

Observed legality samples:

- `Apex Ruler, Bastion` allowed in `Standard` and `Premium`
- `Aurora Star, Coral` allowed in `Standard` and `Premium`
- `Cerrgaon` allowed in `Standard` and `Premium`
- `Cerrgaon` still exposed the active Standard choice restriction with
  `Fated One of Miracles, Rezael`

Smoke scenarios:

- valid Bastion Standard deck using imported start-deck content:
  `0` issues
- Bastion deck mixed with `Aurora Star, Coral`:
  `standard-nation-mismatch`
- Rezael + Cerrgaon deck:
  `choice-restriction-violated`

This confirms:

- imported non-booster cards are usable in deck validation
- format rules still apply correctly
- restriction rules still bind correctly
- new lyrical content does not break Standard validation assumptions

## 10. Repeatability Notes

Repeatability passed for the whole non-booster wave and therefore also covers
at least one truly additional product line, `DZ-LBT01`.

Observed repeatability facts:

- same source reused across both runs
- jobs were distinct
- `snapshotKey` stayed stable:
  `wave-11-3-v1`
- `inputFingerprint` stayed stable:
  `65c32ae3689ac3d88b39e43a67c695d424b4c39e08a6625fb992959b031a3760`

Catalog repeatability facts:

- product ids remained stable across both runs
- printing ids remained stable across both runs
- latest provenance pointed to the second successful run
- publication replay for each job remained safe

For the net-new lyrical product specifically:

- `DZ-LBT01` kept stable product identity:
  `0f0e24aa-bc10-45d7-ba47-b27bd7fa614a`
- both `Aurora Star, Coral` printings kept stable printing ids across rerun

## 11. Booster-only Assumption Check

No hard booster-only assumption was found in the active raw ->
normalization -> publication -> catalog path for this wave.

What passed:

- raw product ingestion stores `raw_product_category` and `raw_product_kind`
  generically
- publication copies those values through to `catalog.products`
- catalog product typing already includes:
  - deck `trial | start`
  - booster `main | extra | title | lyrical`
  - special-set `special-series | festival | collector | other`
- normalization matched non-booster rows without any product-family-specific
  hack

One condition remains:

- Standard family resolution is still prefix-based in
  [catalog-publication-identity.ts](/C:/codes/Web_VG/packages/catalog/src/services/catalog-publication-identity.ts)
- current logic maps `D-` and `DZ-` to `family-standard`
- that is sufficient for the current Standard scope, but future product codes
  outside these prefixes would require an explicit extension

This is a manageable condition, not a blocker for continued Standard growth.

## 12. Known Issues / Conditions

- Canonical bootstrap is still a prerequisite for new cards. This wave needed a
  lyrical bootstrap snippet before the importer could run cleanly.
- Pre-publication importer lifecycle still reports
  `partially_completed / normalization` even when all normalization results are
  publishable. Publication corrects the final lifecycle state, but the interim
  status is still slightly misleading.
- Review queue was not additionally stress-tested in this wave because the
  selected inputs all normalized cleanly.
- Product-family resolution is currently robust for `D-` / `DZ-`, but still
  relies on code-prefix classification rather than a richer family registry.

## 13. Verdict

Verdict: GO WITH CONDITIONS

Why `GO WITH CONDITIONS`:

- the importer pipeline handled start deck, lyrical, and special-series inputs
  without architecture drift
- publication preserved product-family distinctions
- catalog remained usable across all imported product families
- validation remained correct on imported non-booster content
- repeatability held across rerun
- but new-card ingestion still depends on canonical bootstrap, and this wave
  did not re-exercise the review queue with a controlled unresolved case

Safe next step:

- continue Standard expansion product-family-by-product-family
- add the next start deck, lyrical release, or special product using the same
  one-wave fixture pattern
- prefer the next wave to include one controlled unresolved or ambiguous case
  so non-booster review behavior is exercised again without bypassing the
  pipeline
