# Booster-By-Booster Expansion

## 1. Booster Selected For The Wave

The first standalone booster wave was defined around one product unit:

- `DZ-BT01 Fated Clash`

This step intentionally used a single-product input instead of a mixed-wave
fixture. The imported content remained a curated `Keter Sanctuary` slice inside
that one booster, so the ingestion shape now matches the real product boundary:

- one booster
- one input
- one repeatable pipeline pass

Important runtime context:

- `DZ-BT01` already existed in the local catalog from Step `11.1`
- this step therefore validated the booster-by-booster ingestion pattern and
  repeatability semantics on top of existing catalog truth
- it did not require a direct catalog bypass or any architecture changes

## 2. Input Structure

Fixture created for this step:

- [booster-by-booster-expansion-dz-bt01-keter.json](/C:/codes/Web_VG/packages/importer/fixtures/dev-json/booster-by-booster-expansion-dz-bt01-keter.json)

Input shape:

- `source.key = dev-json.booster-by-booster-expansion.dz-bt01-keter`
- stable `snapshotKey = dz-bt01-keter-v1`
- exactly `1` product row
- exactly `9` printing rows
- all printing rows belong to `sourceProductCode = DZ-BT01`

The product metadata is clean and reproducible:

- product category: `booster`
- product kind: `main`
- region: `en`
- release date: `2024-05-03`

The selected printings cover the supported Keter slice of the booster:

- `Fated One of Miracles, Rezael` regular + `DSR`
- `Bringer of Protection, Cethlan` regular + `FR`
- `Wings of Aspiration, Soel`
- `Knight of Great Advance, Ascensior`
- `Patrol of Gusts, Ventesta`
- `Divine Sister, Biscotti`
- `Knight of Gentle Beauty, Nobia`

This input preserves the intended booster-level pattern:

- no mixed products
- no giant combined wave
- no direct catalog writes

## 3. Importer Pipeline Results

Runtime verifier created for this step:

- [run-booster-by-booster-expansion.ts](/C:/codes/Web_VG/scripts/run-booster-by-booster-expansion.ts)

Observed source:

- source key:
  `dev-json.booster-by-booster-expansion.dz-bt01-keter`
- source id:
  `bc35240e-856a-4cab-9ef4-ea062291cf39`
- source did not exist before this script run

Two back-to-back import jobs were executed against the exact same booster input:

- first job:
  `df3195b9-0d0b-400b-a41c-6a0087b40181`
- second job:
  `bb3c91d1-92a1-4eef-8450-a06908b880fc`

Per job, the importer behaved consistently:

- raw products: `1`
- raw printings: `9`
- `raw_record_count = 10`
- `normalized_candidate_count = 9`
- `conflict_count = 0`

Observed lifecycle:

- pre-publication status / stage:
  `partially_completed` / `normalization`
- final status / stage:
  `completed` / `published`

Publication results were identical across both runs:

- attempted: `9`
- publishable: `9`
- published products: `1`
- published printings: `9`
- skipped: `0`

Replay of publication for the same job remained safe:

- replay did not create duplicate rows
- replay kept `published_record_count = 9`
- replay preserved stable catalog row identities

## 4. Normalization Behavior

Observed normalization counts per run:

- total results: `9`
- `auto_resolved`: `9`
- `unresolved`: `0`
- `ambiguous`: `0`

Integrity checks passed:

- `Rezael` regular and `DSR` normalized to one entity:
  `card.fated-one-of-miracles-rezael`
- `Cethlan` regular and `FR` normalized to one entity:
  `card.bringer-of-protection-cethlan`
- `9` printings remained grouped under `7` distinct catalog entities

No semantic drift was observed:

- alt printings did not create extra `CardEntity`
- printing-level identity was preserved
- no ambiguous case was silently auto-attached

One important architectural condition remains:

- normalization still depends on canonical entities already existing in
  `catalog.card_entities`
- this step reused the canonical bootstrap from Step `11.1`

## 5. Review Queue Behavior

Observed review queue counts per run:

- total items: `0`

For this selected booster slice, that behavior was expected:

- every printing matched exactly one canonical entity
- every normalization result had `candidateCount = 1`
- nothing fell into `unresolved_mapping`

This means the queue stayed clean, but it also means this specific booster wave
did not exercise the unresolved-review path directly.

Operational implication:

- review queue behavior remains correct by absence of review-owned cases here
- the next standalone booster should include one controlled unresolved mapping
  if we want to re-exercise queue behavior within the same booster-by-booster
  workflow

## 6. Publication Result

Publication integrity checks passed on both runs:

- all `9` publishable printings were present in `catalog.card_printings`
- no unresolved rows were published
- product -> printing -> entity links remained valid

Because `DZ-BT01` already existed from Step `11.1`, the key publication result
was row reuse rather than new identity creation:

- product row id stayed stable:
  `5b247d50-45af-4609-98d7-28ac32d2a878`
- all `9` printing row ids stayed stable across both new jobs

Traceability was refreshed correctly to the latest run:

- after the second run, `catalog.products.source_import_job_id` pointed to
  `bb3c91d1-92a1-4eef-8450-a06908b880fc`
- after the second run, every `catalog.card_printings.source_import_job_id`
  also pointed to that same second job
- normalization and raw foreign keys on published printings pointed to the
  second run's rows, not stale earlier provenance

This is the desired repeatability behavior:

- catalog identity stays stable
- lineage updates to the latest successful import/publication pass

## 7. Validation On The New Booster Content

Validation used the real catalog / legality path, not UI shortcuts.

Observed legality behavior:

- `Rezael` and `Cethlan` remained `allowed` in `Standard`
- both remained `disallowed` in `V Premium`
- the `Rezael` / `Cerrgaon` choice restriction remained visible

Smoke validation scenarios:

- valid Rezael Standard deck:
  - result: `0` issues
- Rezael + Cerrgaon Standard deck:
  - result: `choice-restriction-violated`
- Standard deck with no ride deck:
  - result: `standard-ride-deck-missing`

This confirms:

- new booster cards are usable in deck validation
- restriction rules still bind correctly
- Standard format rules still evaluate correctly

## 8. Repeatability

Repeatability is the main output of Step `11.2`, and it passed.

Observed repeatability facts:

- same source reused across both runs:
  `bc35240e-856a-4cab-9ef4-ea062291cf39`
- jobs were distinct:
  - `df3195b9-0d0b-400b-a41c-6a0087b40181`
  - `bb3c91d1-92a1-4eef-8450-a06908b880fc`
- `snapshotKey` stayed stable:
  `dz-bt01-keter-v1`
- `inputFingerprint` stayed stable:
  `d26505b4387040c515e0be5227cc5f4e623293e82356e48d80946f7c652d63b6`

Catalog repeatability facts:

- product id remained stable across both runs
- all `9` printing ids remained stable across both runs
- publication replay for each job was safe
- latest provenance updated to the latest repeated job

This is the expected persistent-ingestion behavior:

- same input creates a new tracked job
- raw history remains job-scoped
- canonical catalog identity does not fork

## 9. Known Issues

- Canonical bootstrap is still a prerequisite. This step confirms stable
  booster ingestion, but it does not solve canonical entity creation.
- Pre-publication importer lifecycle still reports
  `partially_completed / normalization` even when all `9` normalization results
  were auto-resolved and no review items were created. Publication corrects the
  final lifecycle state to `completed / published`, but the pre-publication
  status shape is still slightly misleading.
- This booster already existed in the catalog from Step `11.1`, so this step
  validated the standalone ingestion pattern more than it expanded net-new
  catalog content.
- The selected booster slice did not generate unresolved or ambiguous cases, so
  this step did not directly stress the review queue path.

## 10. Expansion Pattern For The Next Booster

Use the following pattern for every next booster wave:

1. Create one booster-only fixture with exactly one product in `products`.
2. Keep a stable `source.key` and `snapshotKey` for that booster input version.
3. Limit the input to one coherent product slice; do not mix unrelated boosters.
4. Prepare canonical prerequisites before import; do not bypass publication by
   inserting printings directly into catalog.
5. Run the full path:
   `dev JSON -> raw -> normalization -> review -> publication`.
6. Replay publication for the same job once to confirm idempotency.
7. Re-run the exact same booster input as a second import job.
8. Verify:
   - raw counts are stable
   - normalization status counts are stable
   - alt printings reuse one entity
   - catalog product / printing ids remain stable
   - latest provenance points to the newest successful job
   - deck validation still passes smoke scenarios
9. Document any new ambiguity class instead of hiding it in a local fix.

Recommended next booster choice:

- pick a booster not already present in catalog
- preferably include one controlled unresolved card so review queue behavior is
  exercised again inside the same standalone booster pattern

## 11. Verdict

Verdict: GO WITH CONDITIONS

Why `GO WITH CONDITIONS` instead of plain `GO`:

- the booster-by-booster ingestion pattern itself is now stable and repeatable
- publication and catalog identity behavior are correct
- validation remains usable on booster content
- but this exact wave reused a booster already seeded in `11.1`
- and it did not directly exercise unresolved review queue behavior

Safe next step:

- continue to the next booster
- prefer a booster that adds net-new content
- keep the same standalone input / replay / repeatability template
- include one deliberate unresolved mapping if possible
