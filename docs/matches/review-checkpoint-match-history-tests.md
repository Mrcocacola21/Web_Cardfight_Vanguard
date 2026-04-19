# Match History Tests Checkpoint

## 1. Scope

This checkpoint treats Phase 13 as one subsystem and verifies:

- manual match creation semantics
- owner-owned read and write boundaries
- deck and opponent linkage behavior
- match-list filters and ordering
- personal stats aggregation
- friend-opponent stats aggregation and social scope
- protected route behavior for owner-only pages

## 2. Match Creation Coverage

Covered:

- successful manual match creation
- owner profile resolution from auth identity
- owner deck selection is required
- foreign deck selection is rejected
- self-opponent is rejected
- visible opponent linkage is required
- result, played date, and notes are passed through as structured fields
- invalid form input is rejected before the use case runs
- signed-out manual creation attempts are blocked
- signed-out opponent search is blocked

Primary layers:

- application: `match-create-use-cases.test.ts`
- server/action: `match-entry-actions.test.ts`
- server/read: `manual-match-entry-read.test.ts`
- UI: `manual-match-entry-view.test.tsx`

## 3. Match List Coverage

Covered:

- owner-scoped list read model
- newest-first ordering
- result filter
- deck filter
- opponent filter
- format and date-range filters
- combined filter behavior
- empty history vs filtered no-results state
- safe behavior for stale or missing linked deck/opponent data
- signed-out access to the protected route is blocked
- query normalization and href building for list filters

Primary layers:

- application: `match-history-list-use-cases.test.ts`
- server/read: `match-history-list-read.test.ts`
- query parsing: `match-history-list-query.test.ts`
- UI: `match-history-list-view.test.tsx`, `app/(protected)/matches/page.test.tsx`

## 4. Personal Stats

Covered:

- total tracked matches
- wins, losses, draws
- winrate calculation
- top-deck aggregation
- unavailable/stale deck fallback bucket
- empty stats behavior
- protected owner-only stats route behavior

Primary layers:

- application: `match-stats-use-cases.test.ts`
- server/read: `match-stats-read.test.ts`
- UI: `match-stats-view.test.tsx`, `app/(protected)/matches/stats/page.test.tsx`

## 5. Friend-Opponent Stats

Covered:

- aggregation uses only owner-owned matches
- only current active friends are included in this slice
- pending/non-friend opponents do not count
- former-friend historical matches are excluded from the current-friend route
- per-friend wins, losses, draws, and winrate
- selected-friend detail view
- zero-match selected-friend state
- signed-out access to the protected route is blocked
- selected-friend query parsing and href building

Primary layers:

- application: `match-friend-opponent-stats-use-cases.test.ts`
- server/read: `match-friend-opponent-stats-read.test.ts`
- query parsing: `match-friend-opponent-stats-query.test.ts`
- UI: `match-friend-opponent-stats-view.test.tsx`, `app/(protected)/matches/friends/page.test.tsx`

## 6. Ownership / Privacy

Covered directly:

- owned match resolution blocks access to another owner's record
- protected list/stats/friend-stats routes reject signed-out access
- manual match creation does not allow forging another owner's deck linkage
- opponent search uses visible-profile surface and excludes the owner profile
- friend-opponent stats remain personal and current-friend scoped

Covered indirectly:

- repository tests verify owner-scoped query shapes and stale-link fallbacks
- migrations define owner-only RLS for `social.matches` and `social.match_participants`

## 7. Fixtures

Fixtures currently used across the subsystem include:

- multiple match results: win, loss, draw, unknown
- multiple decks and deck versions
- visible, hidden, friend, non-friend, pending-request, and former-friend opponents
- stale deck links
- hidden opponent summaries with preserved opponent profile ids
- empty history and zero-match friend selections

## 8. Not Covered

Not fully covered in this checkpoint:

- DB-backed negative RLS tests executed against a live policy environment
- high-volume pagination/performance behavior beyond the current foundational scale
- browser-level end-to-end flows across the full app shell
- future gameplay-generated match records

## 9. Risks

- The largest remaining risk is RLS regression that slips past the mostly mocked `web` test suite.
- Historical deck fidelity is still linkage-based rather than snapshot-based, so long-term history readability depends on future product decisions.
- Full-history reads for list/stats are semantically correct now but are not yet scale-optimized.

## 10. Verdict

**GO WITH CONDITIONS**

Phase 13 is sufficiently protected to close as a foundation phase.

Conditions that should remain on the near-term backlog:

- add a small DB-backed negative authorization suite for match-history routes and repositories
- introduce query-side pagination/filtering once match volume grows materially
- decide when historical deck snapshotting becomes necessary for product fidelity
