import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getFriendsDashboardPageState: vi.fn(),
  friendsDashboardView: vi.fn(),
}))

vi.mock('@/features/social/server/friends-dashboard-read', () => ({
  getFriendsDashboardPageState: mocks.getFriendsDashboardPageState,
}))

vi.mock('@/components/social/friends-dashboard-view', () => ({
  FriendsDashboardView: ({
    viewerDisplayName,
    friends,
    incomingRequests,
    outgoingRequests,
  }: {
    viewerDisplayName: string
    friends: readonly unknown[]
    incomingRequests: readonly unknown[]
    outgoingRequests: readonly unknown[]
  }) => {
    mocks.friendsDashboardView({
      viewerDisplayName,
      friends,
      incomingRequests,
      outgoingRequests,
    })

    return (
      <div>
        <span data-testid="viewer-name">{viewerDisplayName}</span>
        <span data-testid="friend-count">{friends.length}</span>
        <span data-testid="incoming-count">{incomingRequests.length}</span>
        <span data-testid="outgoing-count">{outgoingRequests.length}</span>
      </div>
    )
  },
}))

import FriendsPage from './page'

describe('FriendsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getFriendsDashboardPageState.mockResolvedValue({
      kind: 'ready',
      viewerProfileId: 'profile-1',
      viewerDisplayName: 'Azure Pilot',
      friends: [{ friendshipId: 'friendship-1' }],
      incomingRequests: [{ requestId: 'friend-1' }],
      outgoingRequests: [{ requestId: 'friend-2' }],
    })
  })

  it('loads the central friends dashboard read model before rendering the page view', async () => {
    render(await FriendsPage())

    expect(mocks.getFriendsDashboardPageState).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('viewer-name')).toHaveTextContent('Azure Pilot')
    expect(screen.getByTestId('friend-count')).toHaveTextContent('1')
    expect(screen.getByTestId('incoming-count')).toHaveTextContent('1')
    expect(screen.getByTestId('outgoing-count')).toHaveTextContent('1')
  })
})
