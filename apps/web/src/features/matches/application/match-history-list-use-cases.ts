import type {
  MatchHistoryApplicationResult,
  MatchHistoryApplicationServices,
} from './match-history-application-support'
import type { StoredMatchHistoryListItem } from './match-history-repository'
import type { MatchHistoryListQuery } from '@/features/matches/match-history-list-query'

export interface MatchHistoryDeckFilterOption {
  readonly deckId: string
  readonly label: string
}

export interface MatchHistoryListView {
  readonly totalMatchCount: number
  readonly matches: readonly StoredMatchHistoryListItem[]
  readonly availableDecks: readonly MatchHistoryDeckFilterOption[]
}

export interface ListMatchHistoryViewCommand {
  readonly ownerProfileId: string
  readonly query: MatchHistoryListQuery
}

export async function listMatchHistoryViewUseCase(
  services: MatchHistoryApplicationServices,
  command: ListMatchHistoryViewCommand,
): Promise<MatchHistoryApplicationResult<MatchHistoryListView>> {
  const listResult = await services.repository.listAllMatchHistoryItemsByOwner(
    command.ownerProfileId,
  )

  if (!listResult.ok) {
    return mapRepositoryFailure(listResult.error.message)
  }

  const totalMatchCount = listResult.data.length
  const availableDecks = createDeckFilterOptions(listResult.data)
  const matches = applyMatchHistoryListFilters(listResult.data, command.query)

  return {
    ok: true,
    data: {
      totalMatchCount,
      matches,
      availableDecks,
    },
  }
}

export function applyMatchHistoryListFilters(
  matches: readonly StoredMatchHistoryListItem[],
  query: MatchHistoryListQuery,
): readonly StoredMatchHistoryListItem[] {
  const opponentNeedles = normalizeOpponentNeedles(query.opponent)

  return [...matches]
    .filter((match) => {
      if (query.result !== 'all' && match.result !== query.result) {
        return false
      }

      if (query.deckId && match.ownDeck.deckId !== query.deckId) {
        return false
      }

      if (query.formatId !== 'all' && match.formatId !== query.formatId) {
        return false
      }

      const playedOn = match.playedAt.slice(0, 10)

      if (query.playedFrom && playedOn < query.playedFrom) {
        return false
      }

      if (query.playedTo && playedOn > query.playedTo) {
        return false
      }

      if (opponentNeedles.length > 0) {
        const opponentName =
          match.opponent.displayName?.toLocaleLowerCase() ?? ''

        if (
          opponentName.length === 0 ||
          !opponentNeedles.every((needle) => opponentName.includes(needle))
        ) {
          return false
        }
      }

      return true
    })
    .sort(compareMatchHistoryItems)
}

function createDeckFilterOptions(
  matches: readonly StoredMatchHistoryListItem[],
): readonly MatchHistoryDeckFilterOption[] {
  const deckOptions = new Map<string, MatchHistoryDeckFilterOption>()

  for (const match of matches) {
    if (!match.ownDeck.deckId || !match.ownDeck.title) {
      continue
    }

    if (!deckOptions.has(match.ownDeck.deckId)) {
      deckOptions.set(match.ownDeck.deckId, {
        deckId: match.ownDeck.deckId,
        label: match.ownDeck.title,
      })
    }
  }

  return [...deckOptions.values()].sort((left, right) =>
    left.label.localeCompare(right.label),
  )
}

function compareMatchHistoryItems(
  left: StoredMatchHistoryListItem,
  right: StoredMatchHistoryListItem,
) {
  return (
    right.playedAt.localeCompare(left.playedAt) ||
    right.createdAt.localeCompare(left.createdAt)
  )
}

function normalizeOpponentNeedles(opponentQuery: string) {
  return opponentQuery
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

function mapRepositoryFailure(
  message: string,
): MatchHistoryApplicationResult<never> {
  return {
    ok: false,
    error: {
      code: 'repository-failed',
      message,
    },
  }
}
