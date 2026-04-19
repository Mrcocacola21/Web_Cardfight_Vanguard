import { createSocialRepository, type RepositoryResult } from '@web-vg/db'
import type { ProfileRecord } from '@web-vg/db/repositories/profiles'
import type { ActiveFriendRecord } from '@web-vg/db/repositories/social'

import {
  getFriendOpponentStatsViewUseCase,
  type FriendOpponentStatsView,
} from '@/features/matches/application/match-friend-opponent-stats-use-cases'
import { createMatchHistoryRepository } from '@/features/matches/infrastructure/match-history-repository'
import type { MatchFriendOpponentStatsQuery } from '@/features/matches/match-friend-opponent-stats-query'
import { getCurrentProfileState } from '@/features/profiles/server/profile-read'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const friendStatsPageSize = 50

export type MatchFriendOpponentStatsPageState =
  | {
      readonly kind: 'ready'
      readonly viewerDisplayName: string
      readonly query: MatchFriendOpponentStatsQuery
      readonly stats: FriendOpponentStatsView
    }
  | {
      readonly kind: 'profile-unavailable'
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }

interface MatchFriendOpponentStatsReadDependencies {
  readonly getFriendOpponentStatsView: (
    ownerProfileId: string,
    query: MatchFriendOpponentStatsQuery,
  ) => Promise<
    | {
        readonly ok: true
        readonly data: FriendOpponentStatsView
      }
    | {
        readonly ok: false
        readonly error: {
          readonly message: string
        }
      }
  >
}

export async function resolveMatchFriendOpponentStatsPageState(
  viewerProfile: Pick<ProfileRecord, 'id' | 'displayName'>,
  query: MatchFriendOpponentStatsQuery,
  dependencies: MatchFriendOpponentStatsReadDependencies,
): Promise<MatchFriendOpponentStatsPageState> {
  const result = await dependencies.getFriendOpponentStatsView(
    viewerProfile.id,
    query,
  )

  if (!result.ok) {
    return {
      kind: 'error',
      message: result.error.message,
    }
  }

  return {
    kind: 'ready',
    viewerDisplayName: viewerProfile.displayName,
    query,
    stats: result.data,
  }
}

export async function getMatchFriendOpponentStatsPageState(
  query: MatchFriendOpponentStatsQuery,
): Promise<MatchFriendOpponentStatsPageState> {
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
      message: 'Friend-opponent stats require an authenticated session.',
    }
  }

  if (!currentProfileState.profile) {
    return {
      kind: 'profile-unavailable',
    }
  }

  const client = await createSupabaseServerClient()
  const socialRepository = createSocialRepository(client)

  return resolveMatchFriendOpponentStatsPageState(
    currentProfileState.profile,
    query,
    {
      async getFriendOpponentStatsView(ownerProfileId, activeQuery) {
        return getFriendOpponentStatsViewUseCase(
          {
            matchHistoryRepository: createMatchHistoryRepository(client),
            async listAllActiveFriendships(profileId) {
              return listAllActiveFriendships(profileId, socialRepository)
            },
          },
          {
            ownerProfileId,
            selectedFriendProfileId: activeQuery.friendProfileId,
          },
        )
      },
    },
  )
}

async function listAllActiveFriendships(
  ownerProfileId: string,
  repository: Pick<
    ReturnType<typeof createSocialRepository>,
    'listActiveFriendships'
  >,
): Promise<RepositoryResult<readonly ActiveFriendRecord[]>> {
  const friendships: ActiveFriendRecord[] = []
  let offset = 0

  while (true) {
    const result = await repository.listActiveFriendships(
      ownerProfileId,
      friendStatsPageSize,
      offset,
    )

    if (!result.ok) {
      return result
    }

    friendships.push(...result.data)

    if (result.data.length < friendStatsPageSize) {
      return {
        ok: true,
        data: friendships,
      }
    }

    offset += result.data.length
  }
}
