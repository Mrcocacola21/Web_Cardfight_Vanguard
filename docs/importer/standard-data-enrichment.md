# Standard Data Enrichment

## Purpose

Move the Standard content base from "published cards exist" to "published cards
carry enough semantic data for legality, validation, catalog detail UX, and
future mechanic-aware expansion."

This step stayed inside existing truth boundaries:

- importer still writes to raw / normalization / review only
- publication remains the only bridge into catalog truth
- validation still reads structured catalog + legality data
- no UI-owned legality or mechanic logic was introduced

## Scope

Step `11.4` focused on additive semantic enrichment for the already imported
`D / DZ` Standard slice instead of broadening product volume again.

Curated scope:

- booster content already imported in `11.2`:
  `DZ-BT01`
- non-booster content already imported in `11.3`:
  `D-SD03`, `DZ-LBT01`, `DZ-SS05`
- structured keyword/mechanics coverage for selected real cards
- explicit restriction provenance cleanup for the active Standard choice rule
- printing-level enrichment for special variant printings

Files added for this step:

- [standard_data_enrichment_wave_11_4.sql](/C:/codes/Web_VG/supabase/snippets/standard_data_enrichment_wave_11_4.sql)
- [run-standard-data-enrichment.ts](/C:/codes/Web_VG/scripts/run-standard-data-enrichment.ts)

Files changed for read-side / publication behavior:

- [catalog-publication-unit-preparer.ts](/C:/codes/Web_VG/packages/catalog/src/services/catalog-publication-unit-preparer.ts)
- [catalog-read.ts](/C:/codes/Web_VG/apps/web/src/features/catalog/server/catalog-read.ts)
- [catalog-detail.types.ts](/C:/codes/Web_VG/apps/web/src/features/catalog/catalog-detail.types.ts)
- [catalog-card-detail-view.tsx](/C:/codes/Web_VG/apps/web/src/components/catalog/catalog-card-detail-view.tsx)

## Legalities

Structured legality data was already present before this step through active
rule profiles plus product-family coverage. Step `11.4` verified that this path
still works on enriched Standard data without UI fallbacks.

Observed legality facts on real imported cards:

- `Apex Ruler, Bastion`:
  `allowed` in `Standard` and `Premium`, `disallowed` in `V Premium`
- `Aurora Star, Coral`:
  `allowed` in `Standard` and `Premium`, `disallowed` in `V Premium`
- `Cerrgaon`:
  `allowed` in `Standard` and `Premium`, `disallowed` in `V Premium`

Important decision:

- no new `rule_profile_card_eligibility_overrides` were added in this step
- current `D / DZ` legality remained correctly derivable from published product
  families plus active rule profiles
- that avoids redundant overlays where the existing structured model is already
  sufficient

## Restrictions

Restriction data remains a separate legality layer and continues to bind to
`CardEntity`, not `CardPrinting`.

This step tightened the existing Standard choice restriction overlay by making
its provenance explicit:

- active Standard restriction list source now points to:
  `https://en.cf-vanguard.com/howto/fighters_rules/deckrules/`
- the `Cerrgaon` / `Fated One of Miracles, Rezael` choice rule note now states
  that it mirrors the current English Standard deck rules checked on
  `2026-04-17`

Observed restriction facts:

- `Rezael` exposes one Standard choice restriction entry
- `Cerrgaon` exposes the same Standard choice restriction entry
- `allowedChoices = 1`
- validation still returns `choice-restriction-violated` when both are used
  together

What did not change:

- no hidden UI restriction constants were added
- validation still consumes legality-layer restriction data
- no printing-level restriction logic was introduced

## Keywords

Step `11.4` expanded keyword / mechanics coverage through structured
`catalog.keyword_tags` + `catalog.card_entity_keyword_tags`, while keeping
`card_entities.keywords` as a flattened read projection.

Applied tags:

- `Apex Ruler, Bastion`:
  `twin-drive`, `persona-ride`
- `Fated One of Miracles, Rezael`:
  `twin-drive`, `persona-ride`, `divine-skill`
- `Lifesaving Angel, Kurabiel`:
  `sentinel`
- `Bringer of Protection, Cethlan`:
  `sentinel`
- `Spiritual King of Determination, Olbaria`:
  `over-trigger`

This step also started using the structured keyword-tag read path in catalog
card detail instead of relying only on the flat string array.

Operational result:

- keyword/mechanics data is now available as normalized catalog truth
- card detail can show tag category + description
- groundwork exists for future keyword-aware filters or logic without treating
  the UI as the tag owner

## Printing Integrity

Printing-level semantics were the main catalog truth gap before this step.

Before `11.4`:

- special printings were published as distinct printings
- but `artVariant`, `isAlternateArt`, and `isPromoVariant` were effectively
  empty defaults for importer-published records

After `11.4`, publication preserves special printing variants:

- `Rezael DSR`:
  `artVariant = dsr`, `isAlternateArt = true`
- `Cethlan FR`:
  `artVariant = fr`, `isAlternateArt = true`
- `Aurora Star, Coral MSP`:
  `artVariant = msp`, `isAlternateArt = true`
- `Cerrgaon CR`:
  `artVariant = cr`, `isAlternateArt = false`
- `Cerrgaon GCR`:
  `artVariant = gcr`, `isAlternateArt = true`

Product-level view after replayed publication:

- `DZ-BT01`:
  `9` printings, `2` alternate-art variants
- `DZ-LBT01`:
  `5` printings, `1` alternate-art variant
- `DZ-SS05`:
  `2` printings, `1` alternate-art variant

Entity vs printing boundary stayed correct:

- legality and restrictions remain entity-level
- special rarity / art semantics remain printing-level
- no extra `CardEntity` rows were created for special printings

## Smoke Results

Verifier for this step:

- [run-standard-data-enrichment.ts](/C:/codes/Web_VG/scripts/run-standard-data-enrichment.ts)

Booster refresh (`DZ-BT01`):

- raw products: `1`
- raw printings: `9`
- normalization: `9 auto_resolved`
- review queue: `0`
- publication: `9 / 9`
- validation:
  - valid Rezael deck: `0` issues
  - Rezael + Cerrgaon: `choice-restriction-violated`
  - missing ride deck: `standard-ride-deck-missing`

Non-booster refresh (`D-SD03`, `DZ-LBT01`, `DZ-SS05`):

- raw products: `3`
- raw printings: `22`
- normalization: `22 auto_resolved`
- review queue: `0`
- publication: `22 / 22`
- validation:
  - valid Bastion deck: `0` issues
  - Bastion + Coral: `standard-nation-mismatch`
  - Rezael + Cerrgaon: `choice-restriction-violated`

Targeted enrichment checks passed:

- structured keyword tags loaded for all selected cards
- choice restriction provenance resolved to the official deck-rules URL
- special printings retained correct `artVariant` and alternate-art flags
- publication replay remained idempotent

Verification commands run:

- `corepack pnpm --filter @web-vg/catalog run test -- src/services/catalog-publication-unit-preparer.test.ts`
- `corepack pnpm --filter @web-vg/web run test -- src/features/catalog/server/catalog-read.test.ts src/components/catalog/catalog-card-detail-view.test.tsx`
- `corepack pnpm dlx tsx ./scripts/run-standard-data-enrichment.ts`

## Gaps

- Keyword coverage is still selective. The data model is ready, but this step
  did not attempt full keyword tagging for all imported Standard cards.
- Standard legality still uses the active dev restriction list version
  `dev-2026-04` with dev effective date metadata. Source provenance is now
  explicit, but the list version itself is not yet a full official publication
  mirror.
- No new explicit legality overrides were added because the current imported
  `D / DZ` cards were already correctly derivable through product-family
  eligibility. If future exceptions appear, overrides should remain additive and
  minimal.
- Review queue was not exercised in this step because both refreshed waves
  normalized cleanly.

## Verdict

Verdict: GO WITH CONDITIONS

Why:

- Standard content is now materially more semantic-ready
- legality remains structured and correct on real imported cards
- restriction data stays separate and validation-owned, with explicit
  provenance
- keyword/mechanics tags are now both stored and consumed through normalized
  data
- printing-level variant semantics no longer collapse to empty defaults
- architecture boundaries remain intact

Conditions before calling the entire Standard pool fully enriched:

- continue expanding keyword/mechanics coverage incrementally
- replace dev-stamped Standard restriction-list metadata with a cleaner
  official-source version when the broader restriction baseline is ready
- extend the same enrichment pattern to the next Standard waves instead of
  letting printings or mechanics fall back to empty defaults again
