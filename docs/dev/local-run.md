# Local Run

## 1. Prerequisites

- Windows PowerShell examples below assume the repo root is `Web_VG`.
- Node.js `20.9+` with `corepack` available.
- Docker Desktop running before starting Supabase.
- No global `pnpm` or global `supabase` install is required.

## 2. Install

```powershell
cd C:\codes\Web_VG
corepack pnpm install
```

Notes:

- This repo is a `pnpm` workspace (`pnpm-workspace.yaml`) with `turbo.json`.
- Root `dev` and `build` scripts proxy to `@web-vg/web`.
- `corepack enable` is optional. On some Windows setups it fails with a permissions error under `C:\Program Files\nodejs`; `corepack pnpm ...` still works.

## 3. Env setup

Create `apps/web/.env.local` from the running local Supabase instance:

```powershell
$supabaseEnv = corepack pnpm dlx supabase@2.88.0 status -o env
$apiUrl = ($supabaseEnv | Select-String '^API_URL=').Line.Split('"')[1]
$publishableKey = ($supabaseEnv | Select-String '^PUBLISHABLE_KEY=').Line.Split('"')[1]
@"
NEXT_PUBLIC_APP_ORIGIN=http://127.0.0.1:3000
NEXT_PUBLIC_SUPABASE_URL=$apiUrl
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$publishableKey
"@ | Set-Content apps/web/.env.local
```

Required for `apps/web`:

- `NEXT_PUBLIC_APP_ORIGIN`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Optional for DB utility scripts only:

- `DATABASE_URL`
- `SUPABASE_DB_URL`
- `DATABASE_SSL`

## 4. Infra startup

```powershell
corepack pnpm dlx supabase@2.88.0 start
corepack pnpm dlx supabase@2.88.0 db reset --local
corepack pnpm dlx supabase@2.88.0 status -o env
```

What this does:

- starts the local Supabase stack on `127.0.0.1`
- applies all migrations
- loads `supabase/seeds/dev_minimal_dataset.sql`
- prints the exact local API/DB/auth values used by the app

## 5. Optional: Expanded Standard Content

`db reset --local` only loads the minimal synthetic dev seed. If you want the
fuller Standard slice used by the repo's importer/publication runtime checks
(`Bastion`, `Bastion Prime`, `Rezael`, `D-SD03`, `DZ-BT01`, `DZ-LBT01`,
`DZ-SS05`, keyword tags, legality provenance, and printing variant semantics),
run this after the reset:

```powershell
function Apply-RepoSql($path) {
  Get-Content -Raw $path | docker exec -i supabase_db_Web_VG psql -v ON_ERROR_STOP=1 -U postgres -d postgres
}

Apply-RepoSql .\supabase\snippets\standard_content_expansion_wave_11_1_canonical_bootstrap.sql
Apply-RepoSql .\supabase\snippets\standard_content_expansion_wave_11_1_choice_restriction_overlay.sql
Apply-RepoSql .\supabase\snippets\additional_standard_products_wave_11_3_canonical_bootstrap.sql
Apply-RepoSql .\supabase\snippets\standard_data_enrichment_wave_11_4.sql

corepack pnpm dlx tsx .\scripts\run-standard-content-expansion-wave.ts
corepack pnpm dlx tsx .\scripts\run-standard-data-enrichment.ts
```

## 6. Build / typecheck

```powershell
corepack pnpm typecheck
corepack pnpm build
```

## 7. Run commands

Start the web app:

```powershell
corepack pnpm dev
```

Useful direct entrypoints:

```powershell
corepack pnpm --filter @web-vg/web dev
corepack pnpm --filter @web-vg/web build
corepack pnpm --filter @web-vg/db run test:db
```

## 8. Common failure modes

- `corepack enable` fails with `EPERM` on Windows: use `corepack pnpm ...` directly.
- `supabase start` or `db reset --local` fails while Docker is stopped: start Docker Desktop first.
- `apps/web/.env.local` still contains placeholder or stale Supabase values: regenerate it from `supabase status -o env`.
- `db reset --local` fails around `user_data.public_profiles`: make sure the repo includes the migration fix in `supabase/migrations/20260418190000_add_profile_privacy_flags.sql`.
- Catalog still shows only `Azure Vanguard ...` cards after reset: you have not yet run the optional expanded Standard content bootstrap above.

## 9. What was fixed during this task

- Fixed migration ordering in `20260418190000_add_profile_privacy_flags.sql` so local `supabase db reset --local` no longer fails on dependencies between `user_data.public_profiles`, social views, and `friend_relationships_requester_insert`.
- Fixed an async dependency contract in `apps/web/src/features/profiles/server/public-profile-read.ts`.
- Fixed an incomplete typed test fixture in `apps/web/src/features/matches/server/match-history-list-read.test.ts`.

## 10. Verified local URLs

- App root: `http://127.0.0.1:3000/`
- Catalog: `http://127.0.0.1:3000/catalog`
- Login: `http://127.0.0.1:3000/login`
- Supabase API: `http://127.0.0.1:54321`
- Supabase Studio: `http://127.0.0.1:54323`
