# Match Stats Foundation

## 1. Purpose

`/matches/stats` is the first personal analytics surface for match history. It derives useful owner-only summary metrics from persisted match records without introducing a second mutable stats store.

## 2. Stats Read Model

The stats read model returns:

- `totalMatches`
- `wins`
- `losses`
- `draws`
- `winRate`
- `topDecks`

The query is owner-scoped and reads match-history records through the existing repository/application layers.

## 3. Aggregation Rules

Only completed owner matches with a tracked owner result count toward stats:

- included statuses: `completed`
- included results: `win`, `loss`, `draw`
- excluded from stats:
  - `recorded`
  - `voided`
  - malformed or missing owner results such as `unknown`

This keeps the math stable and avoids ambiguous partial rows affecting the personal summary.

## 4. Winrate Definition

The baseline formula is:

- `winRate = wins / totalMatches`

Where `totalMatches` means completed tracked matches only. The read model stores `winRate` as a ratio, and the UI formats it as a percentage.

## 5. Top Decks Aggregation

Top decks are derived by grouping completed tracked matches by the linked owner deck:

- current linked deck rows are grouped by `deckId`
- current deck title is used as the label when still resolvable
- stale or missing deck links are grouped into one fallback bucket: `Unavailable deck`

The page returns the top usage buckets ordered by match count descending.

## 6. Ownership / Privacy Semantics

Stats are owner-only in this phase:

- the page reads only the current owner profile's match history
- opponent visibility does not turn personal stats into a shared surface
- no friend-facing or public stats are exposed here

## 7. Empty-State Behavior

If there are no completed tracked matches, the stats page does not pretend that `0%` is meaningful analytics. It shows an explicit empty state and points the user back to manual match entry.

## 8. What Is Intentionally NOT Implemented Yet

- friend or opponent scoped stats
- public/shared stats
- trend analytics or time-series views
- matchup matrixes
- stats filters or date-scoped recomputation
- gameplay-engine-derived special cases

## 9. Summary

This step adds a practical personal stats layer on top of match history: total tracked matches, result breakdown, winrate, and top decks. The feature stays repository-backed, owner-only, and derived from existing match records, which makes it a safe foundation for later friend/opponent stats.
