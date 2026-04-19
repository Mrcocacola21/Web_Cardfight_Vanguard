# Standard Content Expansion Wave

## 1. Scope of expansion

This wave deliberately expanded one curated Standard slice instead of trying to
load the whole D / DZ card pool.

Chosen scope:

- one early D start deck: `D-SD03`
- one earlier D booster: `D-BT04`
- one later D booster: `D-BT08`
- one DZ booster core set: `DZ-BT01`
- one additional DZ booster with a controlled unresolved case: `DZ-BT02`
- one special Standard product for restriction / alternate-printing coverage:
  `DZ-SS05`

The content focus was `Keter Sanctuary`, with enough real cards to make the
catalog and deck validation paths materially usable without overloading the
pipeline.

## 2. Imported products / sets

Imported products:

- `D-SD03 Start Deck 03: Tohya Ebata -Apex Ruler-`
- `D-BT04 Awakening of Chakrabarthi`
- `D-BT08 Minerva Rising`
- `DZ-BT01 Fated Clash`
- `DZ-BT02 Illusionless Strife`
- `DZ-SS05 CoroCoro Start Deck Pack`

Imported wave size:

- raw products: `6`
- raw printings: `30`
- canonical entities prepared for normalization: `26`

Intentional coverage inside the wave:

- full `Bastion` ride / trigger / order core from `D-SD03`
- later D support via `Bastion Prime` and `Wisdom of Beginning That Cleared The World`
- multi-printing cases for `Rezael`, `Cethlan`, and `Cerrgaon`
- one controlled unresolved case: `Fated One of Time, Liael=Amorta`

## 3. Importer pipeline behavior

Runtime path used:

- `tsx --tsconfig ./tsconfig.base.json ./packages/importer/src/dev-json/run-dev-json-import.ts`
- tracked publication through the explicit catalog publication service
- local Supabase database

Observed job:

- source key:
  `dev-json.standard-content-expansion-wave-11-1-ddz-keter-curated`
- import job:
  `d52b5b4d-7551-45c3-a937-36cea38f45ce`

Observed job lifecycle:

- pre-publication status / stage:
  `blocked_for_review` / `normalization`
- final status / stage:
  `partially_completed` / `published`
- `raw_record_count = 36`
- `normalized_candidate_count = 30`
- `conflict_count = 1`
- `published_record_count = 29`

The pipeline remained clean:

- importer wrote raw product and raw printing records only
- normalization attached printings to existing canonical entities
- publication remained the only bridge that wrote catalog products / printings

## 4. Normalization observations

Observed normalization result counts:

- total: `30`
- `auto_resolved`: `29`
- `unresolved`: `1`
- `ambiguous`: `0`

Semantic integrity checks passed:

- `Rezael` regular and `DSR` printings mapped to one entity:
  `card.fated-one-of-miracles-rezael`
- `Cethlan` regular and `FR` printings mapped to one entity:
  `card.bringer-of-protection-cethlan`
- `Cerrgaon` `CR` and `GCR` printings mapped to one entity:
  `card.cerrgaon`

No semantic duplication was created in the imported canonical pool.

Important condition:

- this wave still required a canonical bootstrap prerequisite because the
  current publication path does not create `catalog.card_entities`

## 5. Review queue behavior

Observed review queue counts:

- total items: `1`
- reason: `unresolved_mapping`
- status: `open`

Review-owned case:

- `Fated One of Time, Liael=Amorta`

Behavior was correct:

- the card remained unresolved
- no silent auto-attach occurred
- publication skipped it because it was not publishable

## 6. Publication results

Observed publication results:

- attempted normalization results: `30`
- publishable results: `29`
- published products: `6`
- published printings: `29`
- skipped results: `1`

Skipped result:

- `Liael=Amorta` skipped with `non_publishable_status`

Publication replay also passed:

- replay reused the existing published job
- no duplicate catalog rows were created
- final published count remained `29`

Printing-level traceability stayed intact:

- published printings still retained `source_import_job_id`
- raw / normalization foreign links stayed populated
- printing-level data was not collapsed into entity truth

## 7. Catalog usability

Catalog checks after publication:

- `searchText = bastion` with `format = standard`, `era = d`,
  `nation = Keter Sanctuary` returned:
  - `card.apex-ruler-bastion`
  - `card.apex-surpassing-sword-bastion-prime`
- `format = standard`, `era = d`, `nation = Keter Sanctuary` returned
  `25` catalog-visible card entities
- product-scoped search for `Rezael` inside `DZ-BT01` returned exactly
  `card.fated-one-of-miracles-rezael`
- `DZ-BT02` exposed only the publishable printing
  `Academic of Endeavoring, Effoll`; unresolved `Liael=Amorta` did not leak into
  catalog

This wave is materially usable for deck building within the imported slice.

## 8. Validation behavior on new content

Legality facts resolved correctly for imported cards:

- imported D / DZ cards became `allowed` in `Standard`
- the `Rezael` / `Cerrgaon` choice restriction was visible in legality facts

Validation smoke decks:

- valid Bastion Standard deck:
  - result: `0` issues
- Rezael + Cerrgaon Standard deck:
  - result: `choice-restriction-violated`

This confirms:

- existing Standard validation rules still operate on the expanded content
- restriction support applies to imported cards
- deck validation is still driven by catalog / legality data, not UI-only logic

## 9. Performance notes

Observed local runtime timings:

- importer runtime: `1166 ms`
- publication runtime: `115 ms`
- end-to-end script runtime: `3397 ms`

At this wave size:

- importer did not degrade materially
- normalization remained inexpensive
- publication stayed small and replay-safe

No load-testing claims are made here, but the current pipeline clearly handled a
non-toy expansion wave without stress signals.

## 10. Risks

- Canonical bootstrap is still a prerequisite. The current architecture can
  scale curated expansions, but it still lacks a first-class canonical card
  creation lane.
- The `Rezael` / `Cerrgaon` restriction used in this wave is a dev legality
  overlay that mirrors the official current deck rules. Product ingestion and
  legality-list ingestion are still separate concerns.
- `Olbaria` was preserved with nation semantics matching official dash-style
  source data. The current Standard nation validator has no special-case model
  for generic nationless cards, so this area still needs explicit domain policy
  before broader generic trigger coverage is expanded.
- Publication still publishes product rows independently from printing
  publishability. That was acceptable in this wave because every product had at
  least one publishable printing except the intentionally controlled review
  case.

## 11. Verdict

Verdict: `GO WITH CONDITIONS`

Why this is a go:

- the importer pipeline handled a real multi-product wave cleanly
- normalization preserved entity / printing semantics
- review queue behavior stayed correct
- publication remained explicit, traceable, and replay-safe
- catalog search / filter / deck-building paths became materially more usable
- validation continued to work on imported Standard content

Conditions before much larger Standard expansion:

- keep using explicit canonical bootstrap prerequisites until canonical entity
  creation is productized cleanly
- keep legality overlays separate from content ingestion and avoid mixing them
  into importer shortcuts
- define a domain-safe policy for nationless / generic Standard cards before
  expanding generic trigger coverage aggressively

Continuation recommendation:

- yes, Standard can be expanded further
- continue in curated waves
- prefer one nation slice or one deck-family slice at a time
- keep one or two intentional review-owned cards per wave to prevent silent
  ambiguity regressions
