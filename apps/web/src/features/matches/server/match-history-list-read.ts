import { listMatchHistoryViewUseCase } from '@/features/matches/application/match-history-list-use-cases'
import type { MatchHistoryDeckFilterOption } from '@/features/matches/application/match-history-list-use-cases'
import { createMatchHistoryRepository } from '@/features/matches/infrastructure/match-history-repository'
import type { MatchHistoryListQuery } from '@/features/matches/match-history-list-query'
import { getCurrentProfileState } from '@/features/profiles/server/profile-read'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { StoredMatchHistoryListItem } from '@/features/matches/application/match-history-repository'

export type MatchHistoryListPageState =
  | {
      readonly kind: 'ready'
      readonly viewerDisplayName: string
      readonly query: MatchHistoryListQuery
      readonly totalMatchCount: number
      readonly matches: readonly StoredMatchHistoryListItem[]
      readonly availableDecks: readonly MatchHistoryDeckFilterOption[]
    }
  | {
      readonly kind: 'profile-unavailable'
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }

export async function getMatchHistoryListPageState(
  query: MatchHistoryListQuery,
): Promise<MatchHistoryListPageState> {
  const currentProfileState = await getCurrentProfileState()

  if (currentProfileState.kind === 'error') {
    return {
      kind: 'error',
      message: currentProfileState.message,
    }
  }

  if (currentProfileState.kind === 'signed-out') {
    return {
      kind: 'error',
      message: 'Match history requires an authenticated session.',
    }
  }

  if (!currentProfileState.profile) {
    return {
      kind: 'profile-unavailable',
    }
  }

  const client = await createSupabaseServerClient()
  const result = await listMatchHistoryViewUseCase(
    {
      repository: createMatchHistoryRepository(client),
    },
    {
      ownerProfileId: currentProfileState.profile.id,
      query,
    },
  )

  if (!result.ok) {
    return {
      kind: 'error',
      message: result.error.message,
    }
  }

  return {
    kind: 'ready',
    viewerDisplayName: currentProfileState.profile.displayName,
    query,
    totalMatchCount: result.data.totalMatchCount,
    matches: result.data.matches,
    availableDecks: result.data.availableDecks,
  }
}
