# Seeds

## 1. What Is Included

The development seed dataset is intentionally small and synthetic.

It currently seeds:

- 3 formats
  - `standard`
  - `v-premium`
  - `premium`
- 3 active rule profiles
- 3 product families
- 4 products
  - one Standard booster
  - one Standard start deck
  - one V-era booster
  - one Premium promo product
- 10 canonical card entities
- 12 card printings
  - including a few reprint/alternate-print examples
- 3 active restriction lists
  - one `limited` example
  - one `banned` example
  - one `choice restriction` example

The dataset is designed to support local work on:

- catalog rendering
- deck builder inputs
- legality integration
- UI development against non-empty content

## 2. How To Run

Set a direct Postgres connection string first:

- `DATABASE_URL`, or
- `SUPABASE_DB_URL`

Optional:

- `DATABASE_SSL=require` when the target database expects SSL, such as a hosted Supabase Postgres instance

Then run:

```bash
corepack pnpm db:seed
```

The seed runner executes:

- [dev_minimal_dataset.sql](/C:/codes/Web_VG/supabase/seeds/dev_minimal_dataset.sql)

The SQL uses stable IDs and `upsert`-style inserts, so re-running the same seed dataset is safe for the same local dev baseline.

## 3. What Is Not Covered

This seed does not try to be production truth.

It intentionally does not include:

- full Vanguard card data
- importer raw data
- user/profile/social datasets
- gameplay runtime rooms or events
- real match history
- large catalog coverage

It is not a replacement for the future importer pipeline.

## 4. How To Extend It

When extending the seed:

1. keep the dataset small and reviewable
2. prefer synthetic or clearly bounded dev content
3. preserve canonical `card_entity` vs `card_printing` separation
4. do not duplicate importer normalization logic in seed SQL
5. use stable IDs and idempotent inserts where practical
