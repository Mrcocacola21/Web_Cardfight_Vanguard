# Manual Test Prep

## 1. Exact startup commands

Run everything from the repo root:

```powershell
cd C:\codes\Web_VG

corepack pnpm install

corepack pnpm dev:up
corepack pnpm dev:reset

$supabaseEnv = corepack pnpm dlx supabase@2.88.0 status -o env
$apiUrl = ($supabaseEnv | Select-String '^API_URL=').Line.Split('"')[1]
$publishableKey = ($supabaseEnv | Select-String '^PUBLISHABLE_KEY=').Line.Split('"')[1]
@"
NEXT_PUBLIC_APP_ORIGIN=http://127.0.0.1:3000
NEXT_PUBLIC_SUPABASE_URL=$apiUrl
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$publishableKey
"@ | Set-Content apps/web/.env.local

function Apply-RepoSql($path) {
  Get-Content -Raw $path | docker exec -i supabase_db_Web_VG psql -v ON_ERROR_STOP=1 -U postgres -d postgres
}

Apply-RepoSql .\supabase\snippets\standard_content_expansion_wave_11_1_canonical_bootstrap.sql
Apply-RepoSql .\supabase\snippets\standard_content_expansion_wave_11_1_choice_restriction_overlay.sql
Apply-RepoSql .\supabase\snippets\additional_standard_products_wave_11_3_canonical_bootstrap.sql
Apply-RepoSql .\supabase\snippets\standard_data_enrichment_wave_11_4.sql

corepack pnpm dlx tsx .\scripts\run-standard-content-expansion-wave.ts
corepack pnpm dlx tsx .\scripts\run-standard-data-enrichment.ts

corepack pnpm typecheck
corepack pnpm build
corepack pnpm dev
```

For a pristine rerun, repeat `corepack pnpm dev:reset`, regenerate
`apps/web/.env.local`, reapply the expansion/enrichment commands, then restart
`pnpm dev`.

## 2. Env file location

- App env file: `apps/web/.env.local`
- Template: `apps/web/.env.example`

Required values for local manual testing:

- `NEXT_PUBLIC_APP_ORIGIN=http://127.0.0.1:3000`
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<value from supabase status -o env>`

## 3. Data preparation steps

`corepack pnpm dev:reset` gives the synthetic baseline only:

- 3 formats
- 4 products
- 10 canonical cards
- 12 printings
- baseline restriction examples for Standard, V Premium, and Premium

For full manual QA, also apply the curated Standard expansion and enrichment
commands above. That adds the richer catalog slice used by the repo's
importer/publication checks, including:

- `Apex Ruler, Bastion`
- `Fated One of Miracles, Rezael`
- `Cerrgaon`
- `Bringer of Protection, Cethlan`
- `Lifesaving Angel, Kurabiel`
- products `D-SD03`, `DZ-BT01`, `DZ-LBT01`, `DZ-SS05`
- keyword tags, legality facts, alternate-art/printing metadata

User, social, deck, and match data are not seeded. Create those through the UI
during the test run.

## 4. Test accounts setup

Use 3 separate browser contexts: three Chrome profiles, one normal window plus
two incognito windows, or three different browsers.

Suggested accounts:

- User A: main owner account, for deck/profile/match ownership
- User B: friend account, for accepted friendship and friend-opponent match tests
- User C: stranger account, for privacy and declined-request tests

Suggested local emails:

- `qa.owner.<date>@example.com`
- `qa.friend.<date>@example.com`
- `qa.stranger.<date>@example.com`

Local Supabase email confirmation is disabled in `supabase/config.toml`, so
registration works directly from `/register` without mailbox confirmation.

## 5. URLs to open

- App root: `http://127.0.0.1:3000/`
- Login: `http://127.0.0.1:3000/login`
- Register: `http://127.0.0.1:3000/register`
- Catalog: `http://127.0.0.1:3000/catalog`
- Users: `http://127.0.0.1:3000/users`
- Profile: `http://127.0.0.1:3000/profile`
- Decks: `http://127.0.0.1:3000/decks`
- Friends: `http://127.0.0.1:3000/friends`
- Match entry: `http://127.0.0.1:3000/matches/new`
- Supabase Studio: `http://127.0.0.1:54323`
- Mailpit: `http://127.0.0.1:54324`

Useful direct catalog URLs after the Standard expansion:

- `http://127.0.0.1:3000/catalog/card.apex-ruler-bastion`
- `http://127.0.0.1:3000/catalog/card.fated-one-of-miracles-rezael`
- `http://127.0.0.1:3000/catalog/products/product.d-sd03.d-sd03-start-deck-03-tohya-ebata-apex-ruler`
- `http://127.0.0.1:3000/catalog/products/product.dz-bt01.dz-bt01-fated-clash`
- `http://127.0.0.1:3000/catalog/printings/printing.apex-ruler-bastion.d-sd03.001.en`

## 6. Common startup failures

- Docker Desktop is not running: `corepack pnpm dev:up` and
  `corepack pnpm dev:reset` will fail until the Docker engine is healthy.
- `apps/web/.env.local` still contains stale values: regenerate it from
  `supabase status -o env`.
- Port `3000` is already occupied: stop the previous dev server or update
  `NEXT_PUBLIC_APP_ORIGIN` to the actual dev port before testing auth flows.
- `next dev` says another dev server is already running: stop the old PID on
  Windows with `taskkill /PID <pid> /F`.
- Catalog only shows `Azure Vanguard ...` synthetic data: the Standard
  expansion/enrichment commands were skipped.
- Reusing the same test emails after a previous run: either use new email
  suffixes or reset the local DB again.
- A Supabase container is stuck in `Restarting`, `Stopping`, or `unhealthy`:
  run `corepack pnpm dev:status`, inspect `corepack pnpm dev:logs`, then use
  `corepack pnpm dev:hard-reset` if a normal `corepack pnpm dev:down` does not
  recover it.

## 7. What was fixed during this task

- Local migration replay now succeeds through
  `supabase/migrations/20260418190000_add_profile_privacy_flags.sql`.
- Auth session handling now tolerates stale refresh cookies instead of
  surfacing repeated `refresh_token_not_found` noise during local browsing.
- Local QA docs now describe the required expanded catalog bootstrap instead of
  stopping at the tiny synthetic seed.
