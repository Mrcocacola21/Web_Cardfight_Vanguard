import type { StoredMatchHistoryListItem } from './match-history-repository'

export interface MatchStatsTopDeck {
  readonly deckId: string | null
  readonly label: string
  readonly matchCount: number
}

export interface MatchStatsSummary {
  readonly totalMatches: number
  readonly wins: number
  readonly losses: number
  readonly draws: number
  readonly winRate: number | null
  readonly topDecks: readonly MatchStatsTopDeck[]
}

interface MatchStatsAggregationOptions {
  readonly topDeckLimit?: number
}

const defaultTopDeckLimit = 5

export function createMatchStatsSummary(
  matches: readonly StoredMatchHistoryListItem[],
  options: MatchStatsAggregationOptions = {},
): MatchStatsSummary {
  const trackedMatches = matches.filter(isTrackedStatsMatch)
  const wins = trackedMatches.filter((match) => match.result === 'win').length
  const losses = trackedMatches.filter(
    (match) => match.result === 'loss',
  ).length
  const draws = trackedMatches.filter((match) => match.result === 'draw').length
  const totalMatches = trackedMatches.length

  return {
    totalMatches,
    wins,
    losses,
    draws,
    winRate: totalMatches > 0 ? wins / totalMatches : null,
    topDecks: aggregateTopDecks(
      trackedMatches,
      options.topDeckLimit ?? defaultTopDeckLimit,
    ),
  }
}

export function isTrackedStatsMatch(match: StoredMatchHistoryListItem) {
  return (
    match.status === 'completed' &&
    (match.result === 'win' ||
      match.result === 'loss' ||
      match.result === 'draw')
  )
}

function aggregateTopDecks(
  matches: readonly StoredMatchHistoryListItem[],
  limit: number,
): readonly MatchStatsTopDeck[] {
  const deckBuckets = new Map<string, MatchStatsTopDeck>()

  for (const match of matches) {
    const bucket = resolveDeckBucket(match)
    const existing = deckBuckets.get(bucket.key)

    if (existing) {
      deckBuckets.set(bucket.key, {
        ...existing,
        matchCount: existing.matchCount + 1,
      })
      continue
    }

    deckBuckets.set(bucket.key, {
      deckId: bucket.deckId,
      label: bucket.label,
      matchCount: 1,
    })
  }

  return [...deckBuckets.values()]
    .sort(
      (left, right) =>
        right.matchCount - left.matchCount ||
        left.label.localeCompare(right.label),
    )
    .slice(0, limit)
}

function resolveDeckBucket(match: StoredMatchHistoryListItem) {
  if (match.ownDeck.deckId && match.ownDeck.title) {
    return {
      key: match.ownDeck.deckId,
      deckId: match.ownDeck.deckId,
      label: match.ownDeck.title,
    }
  }

  if (match.ownDeck.title) {
    return {
      key: `title:${match.ownDeck.title}`,
      deckId: null,
      label: match.ownDeck.title,
    }
  }

  return {
    key: 'unavailable-deck',
    deckId: null,
    label: 'Unavailable deck',
  }
}
