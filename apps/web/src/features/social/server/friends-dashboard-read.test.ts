// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createSocialRepository: vi.fn(),
  getCurrentProfileState: vi.fn(),
  listActiveFriendships: vi.fn(),
  listIncomingPendingFriendRequests: vi.fn(),
  listOutgoingPendingFriendRequests: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@web-vg/db', () => ({
  createSocialRepository: mocks.createSocialRepository,
}))

vi.mock('@/features/profiles/server/profile-read', () => ({
  getCurrentProfileState: mocks.getCurrentProfileState,
}))

import {
  getFriendsDashboardPageState,
  resolveFriendsDashboardPageState,
} from './friends-dashboard-read'

describe('resolveFriendsDashboardPageState', () => {
  it('returns a stable owner-only dashboard shape with separated social sections', async () => {
    const state = await resolveFriendsDashboardPageState(
      {
        id: 'profile-1',
        displayName: 'Azure Pilot',
      },
      {
        listActiveFriendships() {
          return Promise.resolve({
            ok: true,
            data: [
              {
                friendshipId: 'friendship-1',
                friendsSince: '2026-04-18T13:00:00.000Z',
                friendProfileId: 'profile-2',
                friendDisplayName: 'Nova Player',
                friendAvatarUrl: null,
                friendBio: 'Public deck enjoyer.',
                friendProfileVisible: true,
              },
            ],
          })
        },
        listIncomingPendingFriendRequests() {
          return Promise.resolve({
            ok: true,
            data: [
              {
                requestId: 'friend-1',
                requestedAt: '2026-04-18T12:00:00.000Z',
                requesterProfileId: 'profile-3',
                recipientProfileId: 'profile-1',
                requesterDisplayName: 'Azure Rival',
                requesterAvatarUrl: null,
                requesterBio: null,
                requesterProfileVisible: true,
              },
            ],
          })
        },
        listOutgoingPendingFriendRequests() {
          return Promise.resolve({
            ok: true,
            data: [
              {
                requestId: 'friend-2',
                requestedAt: '2026-04-18T14:00:00.000Z',
                requesterProfileId: 'profile-1',
                recipientProfileId: 'profile-4',
                recipientDisplayName: 'Private profile',
                recipientAvatarUrl: null,
                recipientBio: null,
                recipientProfileVisible: false,
              },
            ],
          })
        },
      },
    )

    expect(state).toEqual({
      kind: 'ready',
      viewerProfileId: 'profile-1',
      viewerDisplayName: 'Azure Pilot',
      friends: [
        {
          friendshipId: 'friendship-1',
          friendsSince: '2026-04-18T13:00:00.000Z',
          friendProfileId: 'profile-2',
          friendDisplayName: 'Nova Player',
          friendAvatarUrl: null,
          friendBio: 'Public deck enjoyer.',
          friendProfileVisible: true,
        },
      ],
      incomingRequests: [
        {
          requestId: 'friend-1',
          requestedAt: '2026-04-18T12:00:00.000Z',
          requesterProfileId: 'profile-3',
          recipientProfileId: 'profile-1',
          requesterDisplayName: 'Azure Rival',
          requesterAvatarUrl: null,
          requesterBio: null,
          requesterProfileVisible: true,
        },
      ],
      outgoingRequests: [
        {
          requestId: 'friend-2',
          requestedAt: '2026-04-18T14:00:00.000Z',
          requesterProfileId: 'profile-1',
          recipientProfileId: 'profile-4',
          recipientDisplayName: 'Private profile',
          recipientAvatarUrl: null,
          recipientBio: null,
          recipientProfileVisible: false,
        },
      ],
    })
  })

  it('maps repository failures into a page-level error state', async () => {
    const state = await resolveFriendsDashboardPageState(
      {
        id: 'profile-1',
        displayName: 'Azure Pilot',
      },
      {
        listActiveFriendships() {
          return Promise.resolve({
            ok: false,
            error: {
              code: 'query-failed',
              message: 'Failed to load active friendships.',
            },
          })
        },
        listIncomingPendingFriendRequests() {
          return Promise.resolve({
            ok: true,
            data: [],
          })
        },
        listOutgoingPendingFriendRequests() {
          return Promise.resolve({
            ok: true,
            data: [],
          })
        },
      },
    )

    expect(state).toEqual({
      kind: 'error',
      message: 'Failed to load active friendships.',
    })
  })
})

describe('getFriendsDashboardPageState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({})
    mocks.listActiveFriendships.mockResolvedValue({
      ok: true,
      data: [],
    })
    mocks.listIncomingPendingFriendRequests.mockResolvedValue({
      ok: true,
      data: [],
    })
    mocks.listOutgoingPendingFriendRequests.mockResolvedValue({
      ok: true,
      data: [],
    })
    mocks.createSocialRepository.mockReturnValue({
      listActiveFriendships: mocks.listActiveFriendships,
      listIncomingPendingFriendRequests:
        mocks.listIncomingPendingFriendRequests,
      listOutgoingPendingFriendRequests:
        mocks.listOutgoingPendingFriendRequests,
    })
  })

  it('returns profile-unavailable when the authenticated user has no profile row yet', async () => {
    mocks.getCurrentProfileState.mockResolvedValueOnce({
      kind: 'ready',
      authUser: {
        id: 'auth-user-1',
        email: 'pilot@example.com',
      },
      profile: null,
    })

    const state = await getFriendsDashboardPageState()

    expect(state).toEqual({
      kind: 'profile-unavailable',
    })
    expect(mocks.createSocialRepository).not.toHaveBeenCalled()
  })

  it('uses the current owner profile id for every dashboard section read', async () => {
    mocks.getCurrentProfileState.mockResolvedValueOnce({
      kind: 'ready',
      authUser: {
        id: 'auth-user-1',
        email: 'pilot@example.com',
      },
      profile: {
        id: 'profile-1',
        username: null,
        displayName: 'Azure Pilot',
        avatarUrl: null,
        bio: null,
        visibility: 'public',
        bioVisibility: 'private',
        createdAt: '2026-04-18T10:00:00.000Z',
        updatedAt: '2026-04-18T10:00:00.000Z',
      },
    })

    const state = await getFriendsDashboardPageState()

    expect(mocks.listActiveFriendships).toHaveBeenCalledWith('profile-1', 25)
    expect(mocks.listIncomingPendingFriendRequests).toHaveBeenCalledWith(
      'profile-1',
      25,
    )
    expect(mocks.listOutgoingPendingFriendRequests).toHaveBeenCalledWith(
      'profile-1',
      25,
    )
    expect(state).toEqual({
      kind: 'ready',
      viewerProfileId: 'profile-1',
      viewerDisplayName: 'Azure Pilot',
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
    })
  })
})
