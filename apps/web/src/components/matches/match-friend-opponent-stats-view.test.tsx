import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MatchFriendOpponentStatsView } from './match-friend-opponent-stats-view'

describe('MatchFriendOpponentStatsView', () => {
  it('renders an empty state when there are no current active friends yet', () => {
    render(
      <MatchFriendOpponentStatsView
        viewerDisplayName="Azure Pilot"
        query={{
          friendProfileId: null,
        }}
        stats={{
          totalCurrentFriends: 0,
          friendsWithTrackedMatches: 0,
          friendSummaries: [],
          selectedFriendProfileId: null,
          selectedFriend: null,
        }}
      />,
    )

    expect(screen.getByText(/no active friends yet/i)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /open friends dashboard/i }),
    ).toHaveAttribute('href', '/friends')
  })

  it('renders current-friend summaries and selected friend detail', () => {
    render(
      <MatchFriendOpponentStatsView
        viewerDisplayName="Azure Pilot"
        query={{
          friendProfileId: 'profile-friend-1',
        }}
        stats={{
          totalCurrentFriends: 2,
          friendsWithTrackedMatches: 1,
          friendSummaries: [
            {
              friendProfileId: 'profile-friend-1',
              friendDisplayName: 'Nova Player',
              friendAvatarUrl: null,
              friendBio: null,
              friendProfileVisible: true,
              totalMatches: 3,
              wins: 2,
              losses: 1,
              draws: 0,
              winRate: 2 / 3,
              latestMatchAt: '2026-04-19T09:00:00.000Z',
            },
            {
              friendProfileId: 'profile-friend-2',
              friendDisplayName: 'Private Friend',
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
          selectedFriendProfileId: 'profile-friend-1',
          selectedFriend: {
            friendProfileId: 'profile-friend-1',
            friendDisplayName: 'Nova Player',
            friendAvatarUrl: null,
            friendBio: null,
            friendProfileVisible: true,
            totalMatches: 3,
            wins: 2,
            losses: 1,
            draws: 0,
            winRate: 2 / 3,
            latestMatchAt: '2026-04-19T09:00:00.000Z',
            topDecks: [
              {
                deckId: 'deck-1',
                label: 'Keter Balance',
                matchCount: 2,
              },
            ],
          },
        }}
      />,
    )

    expect(screen.getByText(/current friend summaries/i)).toBeInTheDocument()
    expect(screen.getByText(/nova player detail/i)).toBeInTheDocument()
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
    expect(screen.getByText('66.7%')).toBeInTheDocument()
    expect(screen.getByText(/keter balance/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view profile/i })).toHaveAttribute(
      'href',
      '/users/profile-friend-1',
    )
    expect(screen.getAllByRole('link', { name: /view profile/i })).toHaveLength(
      1,
    )
    expect(screen.getByRole('link', { name: /open deck/i })).toHaveAttribute(
      'href',
      '/decks/deck-1',
    )
  })

  it('renders a zero-match detail state for a selected current friend without tracked matches', () => {
    render(
      <MatchFriendOpponentStatsView
        viewerDisplayName="Azure Pilot"
        query={{
          friendProfileId: 'profile-friend-2',
        }}
        stats={{
          totalCurrentFriends: 1,
          friendsWithTrackedMatches: 0,
          friendSummaries: [
            {
              friendProfileId: 'profile-friend-2',
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
          selectedFriendProfileId: 'profile-friend-2',
          selectedFriend: {
            friendProfileId: 'profile-friend-2',
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
        }}
      />,
    )

    expect(
      screen.getByText(/no tracked matches vs no games yet/i),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: /clear selection/i })[0],
    ).toHaveAttribute('href', '/matches/friends')
  })
})
