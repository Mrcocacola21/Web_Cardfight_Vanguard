# DB Types

## 1. How Types Are Generated

Database types are generated from the real Postgres schema with the official Supabase CLI.

Repository command:

```bash
corepack pnpm db:types:generate
```

Generation source:

- local Supabase database via `supabase gen types typescript --local` when available
- or `DATABASE_URL` / `SUPABASE_DB_URL` via `--db-url`

## 2. Where They Live

Generated types live in:

- [database.types.ts](/C:/codes/Web_VG/packages/db/src/generated/database.types.ts)

The only public import surface is:

```ts
import type { Database } from '@web-vg/db'
```

## 3. How To Use Them

`@web-vg/db` exports:

- `Database`
- `Json`
- `TableRow`
- `TableInsert`
- `TableUpdate`

These are persistence-facing types only.

They must not replace domain types in `catalog`, `decks`, `legality`, `rules-core`, or `shared`.

## 4. Why They Must Not Be Written Manually

Manual DB typing drifts from migrations and from the actual database state.

Generated types keep:

- table names
- column types
- nullability
- insert/update shapes

aligned with the schema that Supabase/Postgres actually exposes.

## 5. How To Update After Schema Changes

1. add or update migrations
2. apply them to a local or target database
3. run:

```bash
corepack pnpm db:types:generate
```

4. review the generated diff, but do not hand-edit the output
