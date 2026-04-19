// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createSocialRepository: vi.fn(),
  listIncomingPendingFriendRequests: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@web-vg/db', () => ({
  createSocialRepository: mocks.createSocialRepository,
}))

import { getIncomingFriendRequestsState } from './incoming-friend-request-read'

describe('getIncomingFriendRequestsState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({})
    mocks.listIncomingPendingFriendRequests.mockResolvedValue({
      ok: true,
      data: [
        {
          requestId: 'friend-1',
          requestedAt: '2026-04-18T12:00:00.000Z',
          requesterProfileId: 'profile-1',
          recipientProfileId: 'profile-2',
          requesterDisplayName: 'Azure Pilot',
          requesterAvatarUrl: null,
          requesterBio: 'Ready to test Brandt Gate.',
          requesterProfileVisible: true,
        },
      ],
    })
    mocks.createSocialRepository.mockReturnValue({
      listIncomingPendingFriendRequests:
        mocks.listIncomingPendingFriendRequests,
    })
  })

  it('returns an empty ready state when the viewer has no profile yet', async () => {
    const state = await getIncomingFriendRequestsState(null)

    expect(state).toEqual({
      kind: 'ready',
      requests: [],
    })
    expect(mocks.createSocialRepository).not.toHaveBeenCalled()
  })

  it('loads incoming pending requests through the social repository', async () => {
    const state = await getIncomingFriendRequestsState('profile-2')

    expect(mocks.listIncomingPendingFriendRequests).toHaveBeenCalledWith(
      'profile-2',
      20,
    )
    expect(state).toEqual({
      kind: 'ready',
      requests: [
        {
          requestId: 'friend-1',
          requestedAt: '2026-04-18T12:00:00.000Z',
          requesterProfileId: 'profile-1',
          recipientProfileId: 'profile-2',
          requesterDisplayName: 'Azure Pilot',
          requesterAvatarUrl: null,
          requesterBio: 'Ready to test Brandt Gate.',
          requesterProfileVisible: true,
        },
      ],
    })
  })

  it('maps repository failures into an error state', async () => {
    mocks.listIncomingPendingFriendRequests.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'unknown',
        message: 'Failed to load incoming friend requests.',
      },
    })
    mocks.createSocialRepository.mockReturnValueOnce({
      listIncomingPendingFriendRequests:
        mocks.listIncomingPendingFriendRequests,
    })

    const state = await getIncomingFriendRequestsState('profile-2')

    expect(state).toEqual({
      kind: 'error',
      message: 'Failed to load incoming friend requests.',
    })
  })
})
