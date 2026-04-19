import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./friendship-removal-action', () => ({
  FriendshipRemovalAction: ({
    targetDisplayName,
  }: {
    targetDisplayName: string
  }) => <button type="button">Remove friend: {targetDisplayName}</button>,
}))

import { FriendsListCard } from './friends-list-card'

describe('FriendsListCard', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders active friends with profile links and remove actions', () => {
    render(
      <FriendsListCard
        friends={[
          {
            friendshipId: 'friendship-1',
            friendsSince: '2026-04-18T13:00:00.000Z',
            friendProfileId: 'profile-2',
            friendDisplayName: 'Nova Player',
            friendAvatarUrl: null,
            friendBio: 'Public deck enjoyer.',
            friendProfileVisible: true,
          },
        ]}
      />,
    )

    expect(screen.getByText('Nova Player')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view profile/i })).toHaveAttribute(
      'href',
      '/users/profile-2',
    )
    expect(
      screen.getByRole('button', { name: /remove friend: nova player/i }),
    ).toBeInTheDocument()
  })

  it('renders an empty state with a search entrypoint when there are no friends', () => {
    render(<FriendsListCard friends={[]} />)

    expect(screen.getByText(/no friends yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /find users/i })).toHaveAttribute(
      'href',
      '/users',
    )
  })

  it('keeps hidden friends out of the public-profile link surface', () => {
    render(
      <FriendsListCard
        friends={[
          {
            friendshipId: 'friendship-2',
            friendsSince: '2026-04-18T13:00:00.000Z',
            friendProfileId: 'profile-3',
            friendDisplayName: 'Private profile',
            friendAvatarUrl: null,
            friendBio: null,
            friendProfileVisible: false,
          },
        ]}
      />,
    )

    expect(
      screen.getByText(
        /not currently visible through the public profile surface/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /view profile/i }),
    ).not.toBeInTheDocument()
  })
})
