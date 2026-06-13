import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SocialFriendsDashboardSnapshot } from '@/features/social/realtime/friends-dashboard-realtime'

vi.mock('./friendship-removal-action', () => ({
  FriendshipRemovalAction: ({
    targetDisplayName,
  }: {
    readonly targetDisplayName: string
  }) => <button type="button">Remove friend: {targetDisplayName}</button>,
}))

import { FriendsDashboardRealtimeClient } from './friends-dashboard-realtime-client'

describe('FriendsDashboardRealtimeClient', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows a newly received friend request without manual reload', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        okResponse({
          ...emptySnapshot(),
          incomingRequests: [incomingRequest()],
        }),
      ),
    )

    render(
      <FriendsDashboardRealtimeClient
        initialSnapshot={emptySnapshot()}
        pollIntervalMs={10_000}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Incoming Pilot')).toBeInTheDocument(),
    )
    expect(screen.getByText('1 incoming')).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith('/api/social/friends/realtime', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    })
  })

  it('converges when an outgoing request is accepted into an active friendship', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        okResponse({
          ...emptySnapshot(),
          friends: [activeFriend()],
          outgoingRequests: [],
        }),
      ),
    )

    render(
      <FriendsDashboardRealtimeClient
        initialSnapshot={{
          ...emptySnapshot(),
          outgoingRequests: [outgoingRequest()],
        }}
        pollIntervalMs={10_000}
      />,
    )

    expect(screen.getByText('Outgoing Pilot')).toBeVisible()

    await waitFor(() =>
      expect(screen.getByText('Nova Player')).toBeInTheDocument(),
    )
    expect(screen.queryByText('Outgoing Pilot')).not.toBeInTheDocument()
    expect(screen.getByText('1 friends')).toBeVisible()
    expect(screen.getByText('0 outgoing')).toBeVisible()
  })

  it('removes pending request rows after a declined request update', async () => {
    fetchMock.mockResolvedValue(jsonResponse(okResponse(emptySnapshot())))

    render(
      <FriendsDashboardRealtimeClient
        initialSnapshot={{
          ...emptySnapshot(),
          outgoingRequests: [outgoingRequest()],
        }}
        pollIntervalMs={10_000}
      />,
    )

    expect(screen.getByText('Outgoing Pilot')).toBeVisible()

    await waitFor(() =>
      expect(screen.queryByText('Outgoing Pilot')).not.toBeInTheDocument(),
    )
    expect(screen.getByText(/no outgoing requests/i)).toBeVisible()
    expect(screen.getByText('0 outgoing')).toBeVisible()
    expect(screen.getByText('0 friends')).toBeVisible()
  })

  it('converges for the recipient after accepting an incoming request elsewhere', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        okResponse({
          ...emptySnapshot(),
          friends: [activeFriend()],
          incomingRequests: [],
        }),
      ),
    )

    render(
      <FriendsDashboardRealtimeClient
        initialSnapshot={{
          ...emptySnapshot(),
          incomingRequests: [incomingRequest()],
        }}
        pollIntervalMs={10_000}
      />,
    )

    expect(screen.getByText('Incoming Pilot')).toBeVisible()

    await waitFor(() =>
      expect(screen.getByText('Nova Player')).toBeInTheDocument(),
    )
    expect(screen.queryByText('Incoming Pilot')).not.toBeInTheDocument()
    expect(screen.getByText('1 friends')).toBeVisible()
    expect(screen.getByText('0 incoming')).toBeVisible()
  })

  it('removes inactive friendships after the other participant removes the edge', async () => {
    fetchMock.mockResolvedValue(jsonResponse(okResponse(emptySnapshot())))

    render(
      <FriendsDashboardRealtimeClient
        initialSnapshot={{
          ...emptySnapshot(),
          friends: [activeFriend()],
        }}
        pollIntervalMs={10_000}
      />,
    )

    expect(screen.getByText('Nova Player')).toBeVisible()

    await waitFor(() =>
      expect(screen.queryByText('Nova Player')).not.toBeInTheDocument(),
    )
    expect(screen.getByText(/no friends yet/i)).toBeVisible()
    expect(screen.getByText('0 friends')).toBeVisible()
  })

  it('keeps hidden profile data out of live request links', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        okResponse({
          ...emptySnapshot(),
          incomingRequests: [
            {
              ...incomingRequest(),
              requesterDisplayName: 'Private profile',
              requesterBio: null,
              requesterProfileVisible: false,
            },
          ],
        }),
      ),
    )

    render(
      <FriendsDashboardRealtimeClient
        initialSnapshot={emptySnapshot()}
        pollIntervalMs={10_000}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Private profile')).toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('link', { name: /view profile/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/not currently visible through the public profile/i),
    ).toBeVisible()
  })

  it('replaces same-id request rows when live privacy fields change', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        okResponse({
          ...emptySnapshot(),
          incomingRequests: [
            {
              ...incomingRequest(),
              requesterDisplayName: 'Private profile',
              requesterBio: null,
              requesterProfileVisible: false,
            },
          ],
        }),
      ),
    )

    render(
      <FriendsDashboardRealtimeClient
        initialSnapshot={{
          ...emptySnapshot(),
          incomingRequests: [incomingRequest()],
        }}
        pollIntervalMs={10_000}
      />,
    )

    expect(screen.getByRole('link', { name: /view profile/i })).toHaveAttribute(
      'href',
      '/users/profile-requester',
    )

    await waitFor(() =>
      expect(
        screen.queryByRole('link', { name: /view profile/i }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Private profile')).toBeVisible()
    expect(
      screen.getByText(/not currently visible through the public profile/i),
    ).toBeVisible()
  })

  it('keeps the current dashboard state visible when a live refresh fails', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          transport: 'server_route_social_dashboard_polling',
          status: 'error',
          code: 'dashboard_unavailable',
          message: 'Failed to load incoming friend requests.',
        }),
        {
          status: 503,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    )

    render(
      <FriendsDashboardRealtimeClient
        initialSnapshot={{
          ...emptySnapshot(),
          incomingRequests: [incomingRequest()],
        }}
        pollIntervalMs={10_000}
      />,
    )

    expect(screen.getByText('Incoming Pilot')).toBeVisible()

    await waitFor(() =>
      expect(screen.getByText('Sync issue')).toBeInTheDocument(),
    )
    expect(screen.getByText('Incoming Pilot')).toBeVisible()
  })
})

function okResponse(snapshot: SocialFriendsDashboardSnapshot) {
  return {
    transport: 'server_route_social_dashboard_polling',
    status: 'ok',
    snapshot,
  }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function emptySnapshot(): SocialFriendsDashboardSnapshot {
  return {
    viewerProfileId: 'profile-owner',
    viewerDisplayName: 'Azure Pilot',
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    refreshedAt: '2026-06-07T12:00:00.000Z',
  }
}

function activeFriend() {
  return {
    friendshipId: 'friendship-1',
    friendsSince: '2026-06-07T12:05:00.000Z',
    friendProfileId: 'profile-friend',
    friendDisplayName: 'Nova Player',
    friendAvatarUrl: null,
    friendBio: 'Public deck enjoyer.',
    friendProfileVisible: true,
  }
}

function incomingRequest() {
  return {
    requestId: 'request-incoming-1',
    requestedAt: '2026-06-07T12:01:00.000Z',
    requesterProfileId: 'profile-requester',
    recipientProfileId: 'profile-owner',
    requesterDisplayName: 'Incoming Pilot',
    requesterAvatarUrl: null,
    requesterBio: 'Ready to test Brandt Gate.',
    requesterProfileVisible: true,
  }
}

function outgoingRequest() {
  return {
    requestId: 'request-outgoing-1',
    requestedAt: '2026-06-07T12:02:00.000Z',
    requesterProfileId: 'profile-owner',
    recipientProfileId: 'profile-recipient',
    recipientDisplayName: 'Outgoing Pilot',
    recipientAvatarUrl: null,
    recipientBio: 'Waiting for games.',
    recipientProfileVisible: true,
  }
}
