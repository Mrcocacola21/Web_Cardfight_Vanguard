## Purpose

Keep `@web-vg/db` repository imports discoverable without keeping
`packages/db/src/repositories/index.ts` as a dump-all barrel.

## Why the old top-level barrel was too broad

The previous `repositories/index.ts` re-exported repository factories, repo
contracts, domain DTOs, write inputs, publication DTOs, and other narrow
shapes from every repository module. That made the top-level API noisy,
increased merge pressure on one file, and encouraged consumers to depend on
repository internals they did not actually need.

## What stays in `repositories/index.ts`

Top-level repository exports are now limited to:

- shared repository infrastructure types: `DbClient`, `RepositoryResult`,
  `RepositoryError`, `RepositoryErrorCode`
- repository factory entrypoints:
  `createCatalogRepository`, `createCatalogPublicationRepository`,
  `createCollectionsRepository`, `createDecksRepository`, `createImporterRepository`,
  `createProfilesRepository`

This keeps repo creation easy to discover from `@web-vg/db` while avoiding a
global type dump.

## What must be imported from submodules

Domain-specific repository contracts and DTOs now live behind explicit public
subpaths:

- `@web-vg/db/repositories/catalog`
- `@web-vg/db/repositories/collections`
- `@web-vg/db/repositories/decks`
- `@web-vg/db/repositories/importer`
- `@web-vg/db/repositories/profiles`

If a consumer needs deck records, catalog read models, importer job DTOs, or
profile-specific types, it should import them from the matching submodule.

## What is no longer exported publicly

The top-level repository barrel no longer re-exports:

- deck/catalog/collection/importer/profile DTO types
- repository-specific write input types
- repository contract types for individual domains
- publication-specific DTOs outside the catalog submodule

Implementation files such as mappers, repository internals, and helper modules
remain module-local and are still not public API.

## Expected import patterns

Use `@web-vg/db` when you need:

- database generated types (`Database`, `Tables`, `TablesInsert`, ...)
- shared repository result/client types
- repository factory functions

Use `@web-vg/db/repositories/<domain>` when you need:

- domain-specific repository contracts
- domain-specific persistence DTOs and record types

Example:

```ts
import { createDecksRepository, type RepositoryResult } from '@web-vg/db'
import type { DeckDetailRecord } from '@web-vg/db/repositories/decks'
```

## Summary

`@web-vg/db` now exposes a curated repository entry surface, while domain DTOs
and contracts stay attached to their owning repository submodules. This keeps
imports clearer, reduces accidental coupling to unrelated repository internals,
and removes `repositories/index.ts` as a growing bottleneck.
