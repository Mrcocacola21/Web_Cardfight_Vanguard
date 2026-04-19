// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MatchFriendOpponentStatsUseCasesModule from '@/features/matches/application/match-friend-opponent-stats-use-cases'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createSocialRepository: vi.fn(),
  createMatchHistoryRepository: vi.fn(),
  getCurrentProfileState: vi.fn(),
  getFriendOpponentStatsViewUseCase:
    vi.fn<
      typeof MatchFriendOpponentStatsUseCasesModule.getFriendOpponentStatsViewUseCase
    >(),
  listActiveFriendships: vi.fn(),
  listAllMatchHistoryItemsByOwner: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@web-vg/db', () => ({
  createSocialRepository: mocks.createSocialRepository,
}))

vi.mock('@/features/matches/infrastructure/match-history-repository', () => ({
  createMatchHistoryRepository: mocks.createMatchHistoryRepository,
}))

vi.mock('@/features/profiles/server/profile-read', () => ({
  getCurrentProfileState: mocks.getCurrentProfileState,
}))

vi.mock(
  '@/features/matches/application/match-friend-opponent-stats-use-cases',
  () => ({
    getFriendOpponentStatsViewUseCase: mocks.getFriendOpponentStatsViewUseCase,
  }),
)

import {
  getMatchFriendOpponentStatsPageState,
  resolveMatchFriendOpponentStatsPageState,
} from './match-friend-opponent-stats-read'

describe('resolveMatchFriendOpponentStatsPageState', () => {
  it('maps the owner-scoped stats query into a stable ready page state', async () => {
    const state = await resolveMatchFriendOpponentStatsPageState(
      {
        id: 'profile-owner',
        displayName: 'Azure Pilot',
      },
      {
        friendProfileId: 'profile-friend-1',
      },
      {
        getFriendOpponentStatsView() {
          return Promise.resolve({
            ok: true,
            data: {
              totalCurrentFriends: 2,
              friendsWithTrackedMatches: 1,
              friendSummaries: [],
              selectedFriendProfileId: 'profile-friend-1',
              selectedFriend: null,
            },
          })
        },
      },
    )

    expect(state).toEqual({
      kind: 'ready',
      viewerDisplayName: 'Azure Pilot',
      query: {
        friendProfileId: 'profile-friend-1',
      },
      stats: {
        totalCurrentFriends: 2,
        friendsWithTrackedMatches: 1,
        friendSummaries: [],
        selectedFriendProfileId: 'profile-friend-1',
        selectedFriend: null,
      },
    })
  })
})

describe('getMatchFriendOpponentStatsPageState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({})
    mocks.listAllMatchHistoryItemsByOwner.mockResolvedValue({
      ok: true,
      data: [],
    })
    mocks.createMatchHistoryRepository.mockReturnValue({
      listAllMatchHistoryItemsByOwner: mocks.listAllMatchHistoryItemsByOwner,
    })
    mocks.createSocialRepository.mockReturnValue({
      listActiveFriendships: mocks.listActiveFriendships,
    })
  })

  it('returns profile-unavailable when the authenticated user has no persisted profile row', async () => {
    mocks.getCurrentProfileState.mockResolvedValueOnce({
      kind: 'ready',
      authUser: {
        id: 'auth-user-1',
        email: 'pilot@example.com',
      },
      profile: null,
    })

    const state = await getMatchFriendOpponentStatsPageState({
      friendProfileId: null,
    })

    expect(state).toEqual({
      kind: 'profile-unavailable',
    })
    expect(mocks.createSocialRepository).not.toHaveBeenCalled()
    expect(mocks.getFriendOpponentStatsViewUseCase).not.toHaveBeenCalled()
  })

  it('returns an auth error when the viewer is signed out', async () => {
    mocks.getCurrentProfileState.mockResolvedValueOnce({
      kind: 'signed-out',
    })

    const state = await getMatchFriendOpponentStatsPageState({
      friendProfileId: null,
    })

    expect(state).toEqual({
      kind: 'error',
      message: 'Friend-opponent stats require an authenticated session.',
    })
    expect(mocks.createSocialRepository).not.toHaveBeenCalled()
    expect(mocks.getFriendOpponentStatsViewUseCase).not.toHaveBeenCalled()
  })

  it('pages current active friendships and forwards the selected friend query to the use case', async () => {
    mocks.getCurrentProfileState.mockResolvedValueOnce({
      kind: 'ready',
      authUser: {
        id: 'auth-user-1',
        email: 'pilot@example.com',
      },
      profile: {
        id: 'profile-owner',
        username: null,
        displayName: 'Azure Pilot',
        avatarUrl: null,
        bio: null,
        visibility: 'public',
        bioVisibility: 'private',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
      },
    })
    mocks.listActiveFriendships.mockImplementation(
      (_ownerProfileId: string, limit: number, offset = 0) => {
        if (offset === 0) {
          return Promise.resolve({
            ok: true,
            data: Array.from({ length: limit }, (_, index) =>
              createFriend(`profile-friend-${index + 1}`),
            ),
          })
        }

        return Promise.resolve({
          ok: true,
          data: [createFriend('profile-friend-51')],
        })
      },
    )
    mocks.getFriendOpponentStatsViewUseCase.mockImplementation(
      async (services, command) => {
        const friends = await services.listAllActiveFriendships(
          command.ownerProfileId,
        )
        const matches =
          await services.matchHistoryRepository.listAllMatchHistoryItemsByOwner(
            command.ownerProfileId,
          )

        return {
          ok: true,
          data: {
            totalCurrentFriends: friends.ok ? friends.data.length : 0,
            friendsWithTrackedMatches: matches.ok ? matches.data.length : 0,
            friendSummaries: [],
            selectedFriendProfileId: command.selectedFriendProfileId ?? null,
            selectedFriend: null,
          },
        }
      },
    )

    const state = await getMatchFriendOpponentStatsPageState({
      friendProfileId: 'profile-friend-4',
    })

    expect(mocks.listActiveFriendships).toHaveBeenNthCalledWith(
      1,
      'profile-owner',
      50,
      0,
    )
    expect(mocks.listActiveFriendships).toHaveBeenNthCalledWith(
      2,
      'profile-owner',
      50,
      50,
    )
    expect(mocks.listAllMatchHistoryItemsByOwner).toHaveBeenCalledWith(
      'profile-owner',
    )
    const firstCall = mocks.getFriendOpponentStatsViewUseCase.mock.calls[0]

    expect(firstCall).toBeDefined()

    if (!firstCall) {
      throw new Error(
        'Expected getFriendOpponentStatsViewUseCase to be called.',
      )
    }

    const [services, command] = firstCall

    expect(services.matchHistoryRepository).toBeDefined()
    expect(services.listAllActiveFriendships).toBeDefined()
    expect(command).toEqual({
      ownerProfileId: 'profile-owner',
      selectedFriendProfileId: 'profile-friend-4',
    })
    expect(state).toEqual({
      kind: 'ready',
      viewerDisplayName: 'Azure Pilot',
      query: {
        friendProfileId: 'profile-friend-4',
      },
      stats: {
        totalCurrentFriends: 51,
        friendsWithTrackedMatches: 0,
        friendSummaries: [],
        selectedFriendProfileId: 'profile-friend-4',
        selectedFriend: null,
      },
    })
  })
})

function createFriend(friendProfileId: string) {
  return {
    friendshipId: `friendship:${friendProfileId}`,
    friendsSince: '2026-04-19T07:00:00.000Z',
    friendProfileId,
    friendDisplayName: `Friend ${friendProfileId}`,
    friendAvatarUrl: null,
    friendBio: null,
    friendProfileVisible: true,
  }
}
