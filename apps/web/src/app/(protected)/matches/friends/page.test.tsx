import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMatchFriendOpponentStatsPageState: vi.fn(),
  matchFriendOpponentStatsView: vi.fn(),
}))

vi.mock('@/features/matches/server/match-friend-opponent-stats-read', () => ({
  getMatchFriendOpponentStatsPageState:
    mocks.getMatchFriendOpponentStatsPageState,
}))

vi.mock('@/components/matches/match-friend-opponent-stats-view', () => ({
  MatchFriendOpponentStatsView: ({
    viewerDisplayName,
    query,
    stats,
  }: {
    viewerDisplayName: string
    query: {
      friendProfileId: string | null
    }
    stats: {
      totalCurrentFriends: number
    }
  }) => {
    mocks.matchFriendOpponentStatsView({
      viewerDisplayName,
      query,
      stats,
    })

    return (
      <div>
        <span data-testid="viewer-name">{viewerDisplayName}</span>
        <span data-testid="selected-friend">
          {query.friendProfileId ?? 'none'}
        </span>
        <span data-testid="friend-count">{stats.totalCurrentFriends}</span>
      </div>
    )
  },
}))

import MatchFriendOpponentStatsPage from './page'

describe('MatchFriendOpponentStatsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMatchFriendOpponentStatsPageState.mockResolvedValue({
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

  it('loads the friend-opponent stats read model before rendering the view', async () => {
    render(
      await MatchFriendOpponentStatsPage({
        searchParams: Promise.resolve({
          friend: 'profile-friend-1',
        }),
      }),
    )

    expect(mocks.getMatchFriendOpponentStatsPageState).toHaveBeenCalledWith({
      friendProfileId: 'profile-friend-1',
    })
    expect(screen.getByTestId('viewer-name')).toHaveTextContent('Azure Pilot')
    expect(screen.getByTestId('selected-friend')).toHaveTextContent(
      'profile-friend-1',
    )
    expect(screen.getByTestId('friend-count')).toHaveTextContent('2')
  })
})
