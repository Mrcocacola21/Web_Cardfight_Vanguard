// @vitest-environment node

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getFriendsDashboardPageState: vi.fn(),
}))

vi.mock('@/features/social/server/friends-dashboard-read', () => ({
  getFriendsDashboardPageState: mocks.getFriendsDashboardPageState,
}))

import { GET } from './route'

describe('/api/social/friends/realtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getFriendsDashboardPageState.mockResolvedValue({
      kind: 'ready',
      viewerProfileId: 'profile-owner',
      viewerDisplayName: 'Azure Pilot',
      friends: [createFriend()],
      incomingRequests: [createIncomingRequest()],
      outgoingRequests: [createOutgoingRequest()],
    })
  })

  it('returns the authenticated owner friends dashboard snapshot', async () => {
    const response = await GET()
    const json = await readJson(response)

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      transport: 'server_route_social_dashboard_polling',
      status: 'ok',
      snapshot: {
        viewerProfileId: 'profile-owner',
        viewerDisplayName: 'Azure Pilot',
        friends: [
          {
            friendshipId: 'friendship-1',
            friendDisplayName: 'Nova Player',
          },
        ],
        incomingRequests: [
          {
            requestId: 'request-incoming-1',
            requesterProfileId: 'profile-requester',
          },
        ],
        outgoingRequests: [
          {
            requestId: 'request-outgoing-1',
            recipientProfileId: 'profile-recipient',
          },
        ],
      },
    })
    expect(json).not.toHaveProperty('profileId')
    expect(JSON.stringify(json)).not.toContain('auth-user-other')
    expect(mocks.getFriendsDashboardPageState).toHaveBeenCalledWith()
  })

  it('returns auth_required without exposing social state', async () => {
    mocks.getFriendsDashboardPageState.mockResolvedValueOnce({
      kind: 'error',
      message: 'The friends dashboard requires an authenticated session.',
    })

    const response = await GET()
    const json = await readJson(response)

    expect(response.status).toBe(401)
    expect(json).toMatchObject({
      status: 'error',
      code: 'auth_required',
    })
    expect(JSON.stringify(json)).not.toContain('request-incoming-1')
    expect(JSON.stringify(json)).not.toContain('friendship-1')
  })

  it('returns profile_required before delivering live social state', async () => {
    mocks.getFriendsDashboardPageState.mockResolvedValueOnce({
      kind: 'profile-unavailable',
    })

    const response = await GET()
    const json = await readJson(response)

    expect(response.status).toBe(403)
    expect(json).toMatchObject({
      status: 'error',
      code: 'profile_required',
    })
  })

  it('keeps social realtime separate from gameplay room transport', () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        'src/app/api/social/friends/realtime/route.ts',
      ),
      'utf8',
    )

    expect(source).not.toContain('@web-vg/match-session')
    expect(source).not.toContain('/api/matches')
    expect(source).not.toContain('createServerRouteRealtimeTransport')
  })
})

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

function createFriend() {
  return {
    friendshipId: 'friendship-1',
    friendsSince: '2026-06-07T12:00:00.000Z',
    friendProfileId: 'profile-friend',
    friendDisplayName: 'Nova Player',
    friendAvatarUrl: null,
    friendBio: 'Public deck enjoyer.',
    friendProfileVisible: true,
  }
}

function createIncomingRequest() {
  return {
    requestId: 'request-incoming-1',
    requestedAt: '2026-06-07T12:01:00.000Z',
    requesterProfileId: 'profile-requester',
    recipientProfileId: 'profile-owner',
    requesterDisplayName: 'Incoming Pilot',
    requesterAvatarUrl: null,
    requesterBio: null,
    requesterProfileVisible: true,
  }
}

function createOutgoingRequest() {
  return {
    requestId: 'request-outgoing-1',
    requestedAt: '2026-06-07T12:02:00.000Z',
    requesterProfileId: 'profile-owner',
    recipientProfileId: 'profile-recipient',
    recipientDisplayName: 'Outgoing Pilot',
    recipientAvatarUrl: null,
    recipientBio: null,
    recipientProfileVisible: true,
  }
}
