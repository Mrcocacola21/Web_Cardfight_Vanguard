# Friend Opponent Stats Foundation

## 1. Purpose

Add the first explicit bridge between the social graph and match history by exposing owner-only statistics against current friends.

## 2. What "stats against friends" means

Friend-opponent stats are derived from the owner's persisted match records. A record contributes to this surface only when its linked opponent profile is also part of the owner's current active friendship graph.

This is a personal analytics slice. It is not a bilateral source of truth shared by both users.

## 3. Ownership/privacy semantics

- The route is owner-only.
- Aggregation reads only the current viewer's match records.
- Friendship is used only as a filter scope.
- Pending requests do not count as friend access.
- Friends do not gain automatic visibility into the owner's match history or stats.

## 4. Read model shape

The read model returns:

- current friend summaries with total matches, wins, losses, draws, winrate, and latest tracked match date
- one selected-friend detail slice with the same aggregate fields plus top owner decks used against that friend

## 5. Aggregation rules

- Only completed matches with tracked `win`, `loss`, or `draw` results contribute.
- `winRate = wins / totalTrackedMatches`
- Deck usage is aggregated from the owner's linked deck references in those same tracked matches.

## 6. Friendship-scope policy

The dashboard is scoped to current active friends only.

Historical matches against former friends remain valid records and still participate in owner history and global personal stats, but they do not appear on this friend-opponent route once the friendship is no longer active.

## 7. UI surface

The protected entrypoint is `/matches/friends`.

It shows:

- a summary list for current friends
- a selected-friend detail panel
- compact navigation back to personal stats, match history, and manual match entry

## 8. What is intentionally NOT implemented yet

- public or shared opponent stats
- friend-facing visibility into another user's records
- matchup analytics against all users
- time-series or trend analytics
- comparative dashboards between two users

## 9. Summary

This step keeps match history owner-owned while reusing the existing friendship graph honestly. The result is a simple, privacy-safe social slice that can support later review and richer analytics without introducing a second analytics system.
