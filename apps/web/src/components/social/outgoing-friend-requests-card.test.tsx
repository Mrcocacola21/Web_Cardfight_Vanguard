import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { OutgoingFriendRequestsCard } from './outgoing-friend-requests-card'

describe('OutgoingFriendRequestsCard', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders outgoing pending requests with profile links and no response actions', () => {
    render(
      <OutgoingFriendRequestsCard
        requests={[
          {
            requestId: 'friend-1',
            requestedAt: '2026-04-18T14:00:00.000Z',
            requesterProfileId: 'profile-1',
            recipientProfileId: 'profile-2',
            recipientDisplayName: 'Azure Pilot',
            recipientAvatarUrl: null,
            recipientBio: 'Ready for the next match.',
            recipientProfileVisible: true,
          },
        ]}
      />,
    )

    expect(screen.getByText('Azure Pilot')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view profile/i })).toHaveAttribute(
      'href',
      '/users/profile-2',
    )
    expect(
      screen.queryByRole('button', { name: /accept/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /remove friend/i }),
    ).not.toBeInTheDocument()
  })

  it('renders an empty state with a user-search link when there are no outgoing requests', () => {
    render(<OutgoingFriendRequestsCard requests={[]} />)

    expect(screen.getByText(/no outgoing requests/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /find users/i })).toHaveAttribute(
      'href',
      '/users',
    )
  })

  it('does not render a public-profile link for hidden recipients', () => {
    render(
      <OutgoingFriendRequestsCard
        requests={[
          {
            requestId: 'friend-2',
            requestedAt: '2026-04-18T15:00:00.000Z',
            requesterProfileId: 'profile-1',
            recipientProfileId: 'profile-3',
            recipientDisplayName: 'Private profile',
            recipientAvatarUrl: null,
            recipientBio: null,
            recipientProfileVisible: false,
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
