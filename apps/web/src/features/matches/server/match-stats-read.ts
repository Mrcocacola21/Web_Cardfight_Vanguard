import { getMatchStatsViewUseCase } from '@/features/matches/application/match-stats-use-cases'
import type { MatchStatsView } from '@/features/matches/application/match-stats-use-cases'
import { createMatchHistoryRepository } from '@/features/matches/infrastructure/match-history-repository'
import { getCurrentProfileState } from '@/features/profiles/server/profile-read'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type MatchStatsPageState =
  | {
      readonly kind: 'ready'
      readonly viewerDisplayName: string
      readonly stats: MatchStatsView
    }
  | {
      readonly kind: 'profile-unavailable'
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }

export async function getMatchStatsPageState(): Promise<MatchStatsPageState> {
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
      message: 'Match stats require an authenticated session.',
    }
  }

  if (!currentProfileState.profile) {
    return {
      kind: 'profile-unavailable',
    }
  }

  const client = await createSupabaseServerClient()
  const result = await getMatchStatsViewUseCase(
    {
      repository: createMatchHistoryRepository(client),
    },
    {
      ownerProfileId: currentProfileState.profile.id,
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
    stats: result.data,
  }
}
