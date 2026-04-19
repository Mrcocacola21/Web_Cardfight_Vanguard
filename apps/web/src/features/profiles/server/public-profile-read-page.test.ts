// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createProfilesRepository: vi.fn(),
  createSocialRepository: vi.fn(),
  getCurrentAuthState: vi.fn(),
  getProfileByAuthUserId: vi.fn(),
  getProfileById: vi.fn(),
  getVisibleProfileById: vi.fn(),
  getFriendRelationshipBetweenProfiles: vi.fn(),
  getFriendshipBetweenProfiles: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@web-vg/db', () => ({
  createProfilesRepository: mocks.createProfilesRepository,
  createSocialRepository: mocks.createSocialRepository,
}))

vi.mock('@/features/auth/server/auth-session', () => ({
  getCurrentAuthState: mocks.getCurrentAuthState,
}))

import { getPublicProfilePageState } from './public-profile-read'

describe('getPublicProfilePageState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({})
    mocks.getProfileById.mockResolvedValue({
      ok: true,
      data: null,
    })
    mocks.getVisibleProfileById.mockResolvedValue({
      ok: true,
      data: {
        id: 'profile-public',
        displayName: 'Azure Pilot',
        avatarUrl: null,
        bio: 'Public pilot bio.',
        visibility: 'public',
        bioVisibility: 'public',
        bioVisible: true,
      },
    })
    mocks.getFriendRelationshipBetweenProfiles.mockResolvedValue({
      ok: true,
      data: null,
    })
    mocks.getFriendshipBetweenProfiles.mockResolvedValue({
      ok: true,
      data: null,
    })
    mocks.createProfilesRepository.mockReturnValue({
      getProfileByAuthUserId: mocks.getProfileByAuthUserId,
      getProfileById: mocks.getProfileById,
      getVisibleProfileById: mocks.getVisibleProfileById,
    })
    mocks.createSocialRepository.mockReturnValue({
      getFriendRelationshipBetweenProfiles:
        mocks.getFriendRelationshipBetweenProfiles,
      getFriendshipBetweenProfiles: mocks.getFriendshipBetweenProfiles,
    })
  })

  it('surfaces auth resolution failures instead of degrading to guest visibility', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'error',
      message: 'Failed to resolve the current authenticated session.',
    })

    const state = await getPublicProfilePageState('profile-public')

    expect(state).toEqual({
      kind: 'error',
      message: 'Failed to resolve the current authenticated session.',
    })
    expect(mocks.getVisibleProfileById).not.toHaveBeenCalled()
  })

  it('surfaces authenticated viewer-profile lookup failures instead of degrading to guest visibility', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'ready',
      user: {
        id: 'auth-user-1',
        email: 'pilot@example.com',
      },
    })
    mocks.getProfileByAuthUserId.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'query-failed',
        message: 'Failed to load current profile.',
      },
    })

    const state = await getPublicProfilePageState('profile-public')

    expect(state).toEqual({
      kind: 'error',
      message: 'Failed to load current profile.',
    })
    expect(mocks.getVisibleProfileById).not.toHaveBeenCalled()
  })
})
