## Purpose

Record the first real local runtime-backed wave-1 pipeline execution through the
actual dev JSON entrypoint, persisted in the local Supabase database, and closed
through tracked publication.

## Runtime Path Used

Runtime command:

```bash
corepack pnpm pipeline:dev-json -- ./packages/importer/fixtures/dev-json/content-wave-1-standard-ddz-minimal.json
```

This wrapper:

1. runs the actual importer runtime entrypoint
   `tsx --tsconfig ./tsconfig.base.json ./packages/importer/src/dev-json/run-dev-json-import.ts`
2. persists raw import, normalization, and review state through the local
   Supabase API/DB
3. runs tracked publication as a separate catalog boundary
4. verifies the persisted outcome directly from the database

## Seed Used

- fixture:
  [content-wave-1-standard-ddz-minimal.json](/C:/codes/Web_VG/packages/importer/fixtures/dev-json/content-wave-1-standard-ddz-minimal.json)
- canonical bootstrap prerequisite:
  [wave_1_canonical_bootstrap.sql](/C:/codes/Web_VG/supabase/snippets/wave_1_canonical_bootstrap.sql)

Tiny runtime correction applied during this step:

- `Apex Ruler, Bastion` now includes `printingCode = D-BT01/001EN`
- without that printing identity, real publication skipped Bastion as
  `missing_printing_identity`

## Source / Job Created

- source reused:
  `ca4c9e0c-7506-4ff2-a362-424219efad20`
- source key:
  `dev-json.content-wave-1-standard-ddz-minimal`
- persisted runtime job:
  `0af87951-ac63-494a-b80c-d7ce01e90bf3`

Lifecycle outcome:

- pre-publication status/stage:
  `blocked_for_review` / `normalization`
- final status/stage:
  `partially_completed` / `published`
- `published_record_count = 3`
- completion timestamp is persisted in existing `import_jobs.finished_at`

## Raw Stage Outcome

- raw products persisted: `3`
- raw printings persisted: `4`
- all raw printings linked to raw product context

Products:

- `D-BT01 Genesis of the Five Greats`
- `DZ-BT01 Fated Clash`
- `DZ-BT02 Illusionless Strife`

Printings:

- `Apex Ruler, Bastion` -> `D-BT01/001EN`
- `Fated One of Miracles, Rezael` -> `DZ-BT01/010EN`
- `Fated One of Miracles, Rezael` -> `DZ-BT01/DSR01EN`
- `Fated One of Time, Liael=Amorta` -> `DZ-BT02/010EN`

## Normalization Outcome

- normalization results persisted: `4`
- `auto_resolved`: `3`
- `unresolved`: `1`
- `ambiguous`: `0`

Resolved:

- `Apex Ruler, Bastion` ->
  `41000000-0000-4000-8000-000000000001`
- `Fated One of Miracles, Rezael` regular ->
  `41000000-0000-4000-8000-000000000002`
- `Fated One of Miracles, Rezael` DSR ->
  `41000000-0000-4000-8000-000000000002`

Unresolved:

- `Fated One of Time, Liael=Amorta`

## Review Queue Outcome

- manual review items persisted: `1`
- reason: `unresolved_mapping`
- status: `open`

The unresolved `Liael=Amorta` printing remained explicitly review-owned and was
not silently attached to any canonical entity.

## Publication Outcome

Tracked publication ran as the final stage for the same import job.

- attempted normalization results: `4`
- publishable: `3`
- published products: `3`
- published printings: `3`
- skipped normalization results: `1`

Published printings:

- `Apex Ruler, Bastion`
- `Fated One of Miracles, Rezael` regular
- `Fated One of Miracles, Rezael` DSR

Not published:

- `Fated One of Time, Liael=Amorta`

Rezael publication semantics were preserved:

- `2` published printing rows
- `1` shared canonical entity
- no printing collapse into entity truth

Publication replay sanity check also passed:

- replay reused the already-published job
- no duplicate catalog rows were created
- `published_record_count` remained `3`

## Traceability Verification

The persisted run preserves usable lineage:

`catalog.card_printings`
-> `source_normalization_result_id`
-> `importer.card_printing_normalization_results`
-> `source_raw_card_printing_record_id`
-> `importer.raw_card_printing_records`
-> `source_import_job_id`
-> `importer.import_jobs`
-> `source_id`
-> `importer.import_sources`

Sample chain from the successful run:

- published printing:
  `9c0aa709-159e-43e2-ab0b-296b906493d0`
- normalization result:
  `8627501a-b895-4f3a-9bd7-cf6c8355b44d`
- raw printing:
  `c45ae10b-6607-4938-a2b0-1bacb7181d92`
- raw product:
  `309750a6-1d8b-4de7-b263-96f52348fa83`
- import job:
  `0af87951-ac63-494a-b80c-d7ce01e90bf3`
- import source:
  `ca4c9e0c-7506-4ff2-a362-424219efad20`

## Runtime Issues / Fixes

Small runtime fixes were required to make the persisted flow real:

1. local Supabase API did not expose `catalog` / `importer` / `legality`
   schemas
   - fixed in
     [config.toml](/C:/codes/Web_VG/supabase/config.toml)
2. Supabase API roles lacked privileges on custom schemas/tables
   - fixed in
     [20260410130000_grant_api_schema_privileges.sql](/C:/codes/Web_VG/supabase/migrations/20260410130000_grant_api_schema_privileges.sql)
3. wave-1 canonical bootstrap existed only as an assumption
   - fixed with
     [wave_1_canonical_bootstrap.sql](/C:/codes/Web_VG/supabase/snippets/wave_1_canonical_bootstrap.sql)
4. Bastion fixture lacked a real printing identity for publication
   - fixed in
     [content-wave-1-standard-ddz-minimal.json](/C:/codes/Web_VG/packages/importer/fixtures/dev-json/content-wave-1-standard-ddz-minimal.json)

Operational issue encountered but not productized further:

- local Supabase restart required removing a stuck `supabase_vector_Web_VG`
  container before the stack became healthy again

## What This Step Explicitly Does NOT Do

- add a new content wave
- redesign importer architecture
- add importer admin tooling
- move publication inside importer stages
- publish unresolved review-owned content
- build a monitoring platform

## Summary

Wave 1 now has a real persisted runtime proof:

- actual dev/runtime entrypoint used
- actual local Supabase database used
- raw, normalization, review, and publication all persisted
- `import_jobs` lifecycle closes at `published`
- publication remains explicit and retry-safe
- unresolved `Liael=Amorta` stays in review and out of catalog truth
