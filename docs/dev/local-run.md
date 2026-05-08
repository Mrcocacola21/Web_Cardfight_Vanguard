# Local Docker Dev Workflow

This repo uses Supabase CLI as the canonical Docker lifecycle manager. There is
no repo-owned `docker-compose.yml`; do not start the Supabase containers with
ad hoc Docker or Compose commands.

The web app is still a normal Next.js dev process. Start and stop it separately
with `corepack pnpm dev`.

## Prerequisites

- Node.js `20.9+` with Corepack.
- Docker Desktop running.
- Run commands from the repo root.

Install dependencies:

```powershell
corepack pnpm install
```

## Canonical Commands

Start local Supabase containers:

```powershell
corepack pnpm dev:up
```

Stop containers and keep local Supabase data volumes:

```powershell
corepack pnpm dev:down
```

Restart the stack:

```powershell
corepack pnpm dev:restart
```

Show container health, URLs, and stopped/unhealthy services:

```powershell
corepack pnpm dev:status
```

Show logs:

```powershell
corepack pnpm dev:logs
corepack pnpm dev:logs -- db
corepack pnpm dev:logs:follow
corepack pnpm dev:logs:follow -- kong
```

Reset the local database to migrations plus `supabase/seeds/dev_minimal_dataset.sql`:

```powershell
corepack pnpm dev:reset
```

Hard reset when Docker/Supabase is wedged. This deletes only this repo's
Supabase containers, network, and volumes, then starts clean:

```powershell
corepack pnpm dev:hard-reset
```

## Data Policy

- `dev:down` is non-destructive. It stops containers, removes leftover
  containers/networks, and preserves `supabase_db_Web_VG` and
  `supabase_storage_Web_VG` volumes.
- `dev:reset` is a database reset. It keeps Docker volumes but rewrites local DB
  contents from migrations and seed.
- `dev:hard-reset` is destructive for local Supabase data. Use it only when the
  stack is broken or you want a clean environment.

## App Environment

Create or refresh `apps/web/.env.local` from the running local Supabase stack:

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

Start the app after `dev:up`:

```powershell
corepack pnpm dev
```

## What The Lifecycle Script Does

`scripts/dev-stack.mjs` wraps Supabase CLI and Docker for predictable local
lifecycle behavior:

- starts Supabase via `supabase@2.88.0 start`;
- excludes local-only analytics/vector and edge-runtime services that are not
  needed by this repo;
- disables Docker restart policies before stopping so a crashing sidecar cannot
  recreate itself during shutdown;
- shuts Postgres down from inside the DB container with `pg_ctl -m fast -w`
  before `supabase stop`, avoiding the Supabase CLI generated shell PID 1 /
  one-second Docker timeout path;
- sends `docker stop --timeout 30` for any already-restarting containers before
  cleanup;
- removes orphaned project containers/networks after stop while preserving data
  volumes unless `dev:hard-reset` was explicitly requested;
- fails fast when any project container is unhealthy or restarting.

## If Shutdown Gets Stuck

1. Run `corepack pnpm dev:status`.
2. Inspect logs with `corepack pnpm dev:logs -- <service>`, for example
   `corepack pnpm dev:logs -- db`.
3. Try a normal stop: `corepack pnpm dev:down`.
4. If a container is still in `Restarting`, `Stopping`, or `unhealthy`, run
   `corepack pnpm dev:hard-reset`.

Do not run `docker system prune` for this repo workflow. The lifecycle commands
filter by `com.supabase.cli.project=Web_VG` so other local projects are not
touched.

## Optional Expanded Standard Content

`dev:reset` loads only the minimal synthetic dev seed. If you want the fuller
Standard slice used by importer/publication runtime checks, run this after
`dev:reset`:

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

## Useful URLs

- App root: `http://127.0.0.1:3000/`
- Supabase API: `http://127.0.0.1:54321`
- Supabase Studio: `http://127.0.0.1:54323`
- Mailpit: `http://127.0.0.1:54324`
