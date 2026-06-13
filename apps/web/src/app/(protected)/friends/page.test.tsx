import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getFriendsDashboardPageState: vi.fn(),
  friendsDashboardRealtimeClient: vi.fn(),
}))

vi.mock('@/features/social/server/friends-dashboard-read', () => ({
  getFriendsDashboardPageState: mocks.getFriendsDashboardPageState,
}))

vi.mock('@/components/social/friends-dashboard-realtime-client', () => ({
  FriendsDashboardRealtimeClient: ({
    initialSnapshot,
  }: {
    readonly initialSnapshot: {
      readonly viewerDisplayName: string
      readonly friends: readonly unknown[]
      readonly incomingRequests: readonly unknown[]
      readonly outgoingRequests: readonly unknown[]
    }
  }) => {
    mocks.friendsDashboardRealtimeClient({ initialSnapshot })

    return (
      <div>
        <span data-testid="viewer-name">
          {initialSnapshot.viewerDisplayName}
        </span>
        <span data-testid="friend-count">{initialSnapshot.friends.length}</span>
        <span data-testid="incoming-count">
          {initialSnapshot.incomingRequests.length}
        </span>
        <span data-testid="outgoing-count">
          {initialSnapshot.outgoingRequests.length}
        </span>
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

    const renderedProps = requireRecord(
      mocks.friendsDashboardRealtimeClient.mock.calls[0]?.[0] as unknown,
    )
    const initialSnapshot = requireRecord(renderedProps.initialSnapshot)

    expect(initialSnapshot).toMatchObject({
      viewerProfileId: 'profile-1',
      viewerDisplayName: 'Azure Pilot',
    })
  })
})

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>
  }

  throw new Error('Expected a record value.')
}
