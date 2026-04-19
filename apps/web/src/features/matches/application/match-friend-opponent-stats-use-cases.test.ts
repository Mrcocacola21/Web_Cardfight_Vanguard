import { describe, expect, it, vi } from 'vitest'

import { getFriendOpponentStatsViewUseCase } from './match-friend-opponent-stats-use-cases'

describe('getFriendOpponentStatsViewUseCase', () => {
  it('aggregates only current-friend opponents from the owner match history', async () => {
    const services = createServices({
      friends: [
        createFriend({
          friendProfileId: 'profile-friend-1',
          friendDisplayName: 'Nova Player',
        }),
        createFriend({
          friendProfileId: 'profile-friend-2',
          friendDisplayName: 'Stealth Rival',
        }),
      ],
      matches: [
        createMatch({
          id: 'match-friend-1-win',
          opponent: {
            profileId: 'profile-friend-1',
            displayName: 'Nova Player',
            avatarUrl: null,
            bio: null,
            profileVisible: true,
          },
          result: 'win',
          ownDeck: {
            deckId: 'deck-1',
            title: 'Keter Balance',
            versionNumber: 3,
          },
        }),
        createMatch({
          id: 'match-friend-1-loss',
          opponent: {
            profileId: 'profile-friend-1',
            displayName: null,
            avatarUrl: null,
            bio: null,
            profileVisible: false,
          },
          result: 'loss',
          ownDeck: {
            deckId: 'deck-2',
            title: 'Brandt Gate Control',
            versionNumber: 1,
          },
        }),
        createMatch({
          id: 'match-friend-2-draw',
          opponent: {
            profileId: 'profile-friend-2',
            displayName: 'Stealth Rival',
            avatarUrl: null,
            bio: null,
            profileVisible: true,
          },
          result: 'draw',
          ownDeck: {
            deckId: 'deck-1',
            title: 'Keter Balance',
            versionNumber: 4,
          },
        }),
        createMatch({
          id: 'match-pending-request-opponent',
          opponent: {
            profileId: 'profile-pending',
            displayName: 'Pending Only',
            avatarUrl: null,
            bio: null,
            profileVisible: true,
          },
          result: 'win',
        }),
      ],
    })

    const result = await getFriendOpponentStatsViewUseCase(services, {
      ownerProfileId: 'profile-owner',
    })

    expect(services.listAllActiveFriendships).toHaveBeenCalledWith(
      'profile-owner',
    )
    expect(
      services.matchHistoryRepository.listAllMatchHistoryItemsByOwner,
    ).toHaveBeenCalledWith('profile-owner')
    expect(result).toEqual({
      ok: true,
      data: {
        totalCurrentFriends: 2,
        friendsWithTrackedMatches: 2,
        selectedFriendProfileId: 'profile-friend-1',
        friendSummaries: [
          {
            friendProfileId: 'profile-friend-1',
            friendDisplayName: 'Nova Player',
            friendAvatarUrl: null,
            friendBio: null,
            friendProfileVisible: true,
            totalMatches: 2,
            wins: 1,
            losses: 1,
            draws: 0,
            winRate: 0.5,
            latestMatchAt: '2026-04-18T10:00:00.000Z',
          },
          {
            friendProfileId: 'profile-friend-2',
            friendDisplayName: 'Stealth Rival',
            friendAvatarUrl: null,
            friendBio: null,
            friendProfileVisible: true,
            totalMatches: 1,
            wins: 0,
            losses: 0,
            draws: 1,
            winRate: 0,
            latestMatchAt: '2026-04-18T10:00:00.000Z',
          },
        ],
        selectedFriend: {
          friendProfileId: 'profile-friend-1',
          friendDisplayName: 'Nova Player',
          friendAvatarUrl: null,
          friendBio: null,
          friendProfileVisible: true,
          totalMatches: 2,
          wins: 1,
          losses: 1,
          draws: 0,
          winRate: 0.5,
          latestMatchAt: '2026-04-18T10:00:00.000Z',
          topDecks: [
            {
              deckId: 'deck-2',
              label: 'Brandt Gate Control',
              matchCount: 1,
            },
            {
              deckId: 'deck-1',
              label: 'Keter Balance',
              matchCount: 1,
            },
          ],
        },
      },
    })
  })

  it('supports selecting a current friend with zero tracked matches', async () => {
    const services = createServices({
      friends: [
        createFriend({
          friendProfileId: 'profile-friend-empty',
          friendDisplayName: 'No Games Yet',
          friendProfileVisible: false,
        }),
        createFriend({
          friendProfileId: 'profile-friend-active',
          friendDisplayName: 'Has Matches',
        }),
      ],
      matches: [
        createMatch({
          opponent: {
            profileId: 'profile-friend-active',
            displayName: 'Has Matches',
            avatarUrl: null,
            bio: null,
            profileVisible: true,
          },
          result: 'win',
        }),
      ],
    })

    const result = await getFriendOpponentStatsViewUseCase(services, {
      ownerProfileId: 'profile-owner',
      selectedFriendProfileId: 'profile-friend-empty',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        totalCurrentFriends: 2,
        friendsWithTrackedMatches: 1,
        selectedFriendProfileId: 'profile-friend-empty',
        friendSummaries: [
          {
            friendProfileId: 'profile-friend-active',
            friendDisplayName: 'Has Matches',
            friendAvatarUrl: null,
            friendBio: null,
            friendProfileVisible: true,
            totalMatches: 1,
            wins: 1,
            losses: 0,
            draws: 0,
            winRate: 1,
            latestMatchAt: '2026-04-18T10:00:00.000Z',
          },
          {
            friendProfileId: 'profile-friend-empty',
            friendDisplayName: 'No Games Yet',
            friendAvatarUrl: null,
            friendBio: null,
            friendProfileVisible: false,
            totalMatches: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            winRate: null,
            latestMatchAt: null,
          },
        ],
        selectedFriend: {
          friendProfileId: 'profile-friend-empty',
          friendDisplayName: 'No Games Yet',
          friendAvatarUrl: null,
          friendBio: null,
          friendProfileVisible: false,
          totalMatches: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: null,
          latestMatchAt: null,
          topDecks: [],
        },
      },
    })
  })

  it('excludes historical matches against profiles that are no longer current friends', async () => {
    const services = createServices({
      friends: [
        createFriend({
          friendProfileId: 'profile-current-friend',
          friendDisplayName: 'Current Friend',
        }),
      ],
      matches: [
        createMatch({
          opponent: {
            profileId: 'profile-current-friend',
            displayName: 'Current Friend',
            avatarUrl: null,
            bio: null,
            profileVisible: true,
          },
          result: 'draw',
        }),
        createMatch({
          opponent: {
            profileId: 'profile-former-friend',
            displayName: 'Former Friend',
            avatarUrl: null,
            bio: null,
            profileVisible: true,
          },
          result: 'win',
        }),
      ],
    })

    const result = await getFriendOpponentStatsViewUseCase(services, {
      ownerProfileId: 'profile-owner',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        totalCurrentFriends: 1,
        friendsWithTrackedMatches: 1,
        selectedFriendProfileId: 'profile-current-friend',
        friendSummaries: [
          {
            friendProfileId: 'profile-current-friend',
            friendDisplayName: 'Current Friend',
            friendAvatarUrl: null,
            friendBio: null,
            friendProfileVisible: true,
            totalMatches: 1,
            wins: 0,
            losses: 0,
            draws: 1,
            winRate: 0,
            latestMatchAt: '2026-04-18T10:00:00.000Z',
          },
        ],
        selectedFriend: {
          friendProfileId: 'profile-current-friend',
          friendDisplayName: 'Current Friend',
          friendAvatarUrl: null,
          friendBio: null,
          friendProfileVisible: true,
          totalMatches: 1,
          wins: 0,
          losses: 0,
          draws: 1,
          winRate: 0,
          latestMatchAt: '2026-04-18T10:00:00.000Z',
          topDecks: [
            {
              deckId: 'deck-1',
              label: 'Keter Balance',
              matchCount: 1,
            },
          ],
        },
      },
    })
  })
})

function createServices(input: {
  readonly friends: readonly ReturnType<typeof createFriend>[]
  readonly matches: readonly ReturnType<typeof createMatch>[]
}) {
  return {
    listAllActiveFriendships: vi.fn().mockResolvedValue({
      ok: true,
      data: input.friends,
    }),
    matchHistoryRepository: {
      listAllMatchHistoryItemsByOwner: vi.fn().mockResolvedValue({
        ok: true,
        data: input.matches,
      }),
    },
  }
}

function createFriend(
  overrides: Partial<{
    friendshipId: string
    friendsSince: string
    friendProfileId: string
    friendDisplayName: string
    friendAvatarUrl: string | null
    friendBio: string | null
    friendProfileVisible: boolean
  }> = {},
) {
  return {
    friendshipId: overrides.friendshipId ?? 'friendship-1',
    friendsSince: overrides.friendsSince ?? '2026-04-18T09:00:00.000Z',
    friendProfileId: overrides.friendProfileId ?? 'profile-friend',
    friendDisplayName: overrides.friendDisplayName ?? 'Friend Player',
    friendAvatarUrl: overrides.friendAvatarUrl ?? null,
    friendBio: overrides.friendBio ?? null,
    friendProfileVisible: overrides.friendProfileVisible ?? true,
  }
}

function createMatch(
  overrides: Partial<{
    id: string
    formatId: string
    status: 'recorded' | 'completed' | 'voided'
    playedAt: string
    createdAt: string
    result: 'win' | 'loss' | 'draw' | 'unknown'
    notes: string | null
    ownDeck: {
      deckId: string | null
      title: string | null
      versionNumber: number | null
    }
    opponent: {
      profileId: string | null
      displayName: string | null
      avatarUrl: string | null
      bio: string | null
      profileVisible: boolean
    }
  }> = {},
) {
  return {
    id: overrides.id ?? 'match-1',
    formatId: overrides.formatId ?? 'standard',
    status: overrides.status ?? 'completed',
    playedAt: overrides.playedAt ?? '2026-04-18T10:00:00.000Z',
    createdAt: overrides.createdAt ?? '2026-04-18T10:05:00.000Z',
    result: overrides.result ?? 'win',
    notes: overrides.notes ?? null,
    ownDeck: overrides.ownDeck ?? {
      deckId: 'deck-1',
      title: 'Keter Balance',
      versionNumber: 3,
    },
    opponent: overrides.opponent ?? {
      profileId: 'profile-friend',
      displayName: 'Friend Player',
      avatarUrl: null,
      bio: null,
      profileVisible: true,
    },
  }
}
