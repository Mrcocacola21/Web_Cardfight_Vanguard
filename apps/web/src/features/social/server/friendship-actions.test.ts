// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as FriendshipUseCasesModule from '@/features/social/application/friendship-use-cases'

import { initialFriendRemovalFormState } from './friend-removal-form-state'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getCurrentAuthState: vi.fn(),
  createProfilesRepository: vi.fn(),
  createSocialRepository: vi.fn(),
  removeFriendUseCase:
    vi.fn<typeof FriendshipUseCasesModule.removeFriendUseCase>(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/auth/server/auth-session', () => ({
  getCurrentAuthState: mocks.getCurrentAuthState,
}))

vi.mock('@web-vg/db', () => ({
  createProfilesRepository: mocks.createProfilesRepository,
  createSocialRepository: mocks.createSocialRepository,
}))

vi.mock('@/features/social/application/friendship-use-cases', () => ({
  removeFriendUseCase: mocks.removeFriendUseCase,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import { removeFriendAction } from './friendship-actions'

describe('removeFriendAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({})
    mocks.createProfilesRepository.mockReturnValue({
      getProfileByAuthUserId: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: 'profile-1',
        },
      }),
    })
    mocks.createSocialRepository.mockReturnValue({
      getFriendshipBetweenProfiles: vi.fn(),
      removeFriendship: vi.fn(),
    })
  })

  it('returns an auth-required state for signed-out users', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'signed-out',
    })

    const formData = new FormData()
    formData.set('targetProfileId', 'profile-2')

    const result = await removeFriendAction(
      initialFriendRemovalFormState,
      formData,
    )

    expect(result).toEqual({
      status: 'error',
      code: 'auth-required',
      message: 'Sign in before removing a friend.',
    })
    expect(mocks.removeFriendUseCase).not.toHaveBeenCalled()
  })

  it('passes actor and target context into the use case and revalidates the dashboard plus public profile page', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'ready',
      user: {
        id: 'auth-user-1',
        email: 'pilot@example.com',
      },
    })
    mocks.removeFriendUseCase.mockResolvedValueOnce({
      ok: true,
      data: {
        removedFriendshipId: 'friendship-1',
        targetProfileId: 'profile-2',
      },
    })

    const formData = new FormData()
    formData.set('targetProfileId', 'profile-2')

    const result = await removeFriendAction(
      initialFriendRemovalFormState,
      formData,
    )

    expect(mocks.removeFriendUseCase).toHaveBeenCalledWith(expect.any(Object), {
      isAuthenticated: true,
      actorProfileId: 'profile-1',
      targetProfileId: 'profile-2',
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/friends')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/users/profile-2')
    expect(result).toEqual({
      status: 'success',
      code: 'removed',
      message: 'Friend removed.',
    })
  })

  it('maps missing friendships into stable UI feedback', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'ready',
      user: {
        id: 'auth-user-1',
        email: 'pilot@example.com',
      },
    })
    mocks.removeFriendUseCase.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'friendship-not-found',
        message: 'This friendship is no longer active.',
      },
    })

    const formData = new FormData()
    formData.set('targetProfileId', 'profile-2')

    const result = await removeFriendAction(
      initialFriendRemovalFormState,
      formData,
    )

    expect(result).toEqual({
      status: 'error',
      code: 'friendship-not-found',
      message: 'This friendship is no longer active.',
    })
  })
})
