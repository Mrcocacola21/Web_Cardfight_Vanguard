# Match History List And Filters

## 1. Purpose

`/matches` is the first real read-side for match history. It turns owner-owned match records into a usable personal history surface instead of leaving them as rows that only exist for later stats work.

## 2. Route / Entry Point

The match list route is:

- `/matches`

It is a protected, owner-only page. Manual entry remains at `/matches/new`.

## 3. Match List Read Model

The page uses one server-backed read model:

- resolve current owner profile
- load owner-scoped match-history items from the repository
- attach public-safe opponent summary and owner deck summary when still resolvable
- apply baseline filters in the application query layer
- return newest-first list data plus available deck filter options

The repository projection is based on persisted match records, participant rows, deck linkage, and the visible-profile surface. It does not query raw auth identity.

## 4. Supported Filters

The page currently supports:

- result: `win`, `loss`, `draw`
- deck
- opponent name text search
- format
- played date range: `from` / `to`

Filters are query-driven and reset back to `/matches`.

## 5. Ordering Model

Ordering is newest first by played date, with created timestamp as a fallback tie-breaker. The read path is intentionally bounded to the newest owner-scoped records instead of introducing pagination infrastructure in this step.

## 6. Empty vs No-Results States

The route distinguishes:

- no persisted matches yet
- persisted matches exist, but current filters return nothing

The empty-history state points back to manual match entry. The filtered no-results state offers a clear filter reset path.

## 7. Ownership / Privacy Semantics

Match history remains owner-only:

- the page only loads records for the current profile owner
- opponent linkage does not create shared visibility
- deck linkage is resolved only through owner-accessible deck data
- opponent summaries come from the visible-profile surface, so hidden or deleted profiles degrade to safe fallbacks instead of leaking data

## 8. What Is Intentionally NOT Implemented Yet

- match stats or derived analytics
- public/shared match feeds
- advanced pagination
- match detail page
- edit/delete flows
- gameplay replay or runtime integration

## 9. Summary

This step makes match history usable: `/matches` now gives the owner one place to review recorded matches, filter them by the fields that matter, and branch into manual entry without leaking other users' data. That is enough foundation for the next step: match stats.
