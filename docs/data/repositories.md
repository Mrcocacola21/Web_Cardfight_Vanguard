# Repositories

## 1. Why The Repository Layer Exists

The repository layer is the boundary between:

- persistence and Supabase/PostgREST access
- app or service code that needs data

It exists so that UI and composition code do not write database queries directly.

## 2. Where It Lives

Repositories live in:

- [packages/db/src/repositories](/C:/codes/Web_VG/packages/db/src/repositories)

This keeps:

- generated DB types
- query helpers
- row-to-read-model mapping

inside the same infrastructure boundary.

## 3. How To Use It

Create a typed Supabase client first, then create a repository from that client.

Example:

```ts
import { createCatalogRepository } from '@web-vg/db'

const repository = createCatalogRepository(client)
const result = await repository.getCardEntityById(cardId)
```

Repositories accept a client dependency, but they do not expose the client back outward.

## 4. Why UI Must Not Query Supabase Directly

Direct UI queries create three problems:

- SQL/PostgREST logic leaks into presentation code
- raw rows leak outside persistence boundaries
- mapping and error handling become inconsistent

`apps/web` may still create a Supabase client at the integration boundary, but queries should run through repositories.

## 5. How To Add New Queries

When adding a new query:

1. place it in the bounded repository area it belongs to
2. use generated DB types from `@web-vg/db`
3. return read models, not raw rows
4. map Supabase errors into repository-level errors
5. do not turn `packages/db` into a god-layer; keep repositories context-focused

## 6. Write-Side Note

- Single-table writes may stay as direct repository queries.
- Multi-table aggregate writes must not rely on chained app-side Supabase calls
  pretending to be transactions.
- When one mutation spans multiple authoritative tables, the repository should
  call one DB-side transactional unit through RPC instead of orchestrating
  best-effort cleanup in application code.
- UI and server actions may trigger repository writes, but they must not own
  write orchestration.

See:

- [write-side-transaction-strategy.md](/C:/codes/Web_VG/docs/data/write-side-transaction-strategy.md)
