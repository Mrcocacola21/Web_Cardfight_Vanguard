// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as FriendRequestUseCasesModule from '@/features/social/application/friend-request-use-cases'

import { initialFriendRequestFormState } from './friend-request-form-state'
import { initialFriendRequestResponseFormState } from './friend-request-response-form-state'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getCurrentAuthState: vi.fn(),
  createProfilesRepository: vi.fn(),
  createSocialRepository: vi.fn(),
  sendFriendRequestUseCase:
    vi.fn<typeof FriendRequestUseCasesModule.sendFriendRequestUseCase>(),
  acceptFriendRequestUseCase:
    vi.fn<typeof FriendRequestUseCasesModule.acceptFriendRequestUseCase>(),
  declineFriendRequestUseCase:
    vi.fn<typeof FriendRequestUseCasesModule.declineFriendRequestUseCase>(),
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

vi.mock('@/features/social/application/friend-request-use-cases', () => ({
  sendFriendRequestUseCase: mocks.sendFriendRequestUseCase,
  acceptFriendRequestUseCase: mocks.acceptFriendRequestUseCase,
  declineFriendRequestUseCase: mocks.declineFriendRequestUseCase,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import {
  respondToFriendRequestAction,
  sendFriendRequestAction,
} from './friend-request-actions'

describe('sendFriendRequestAction', () => {
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
      getPublicProfileById: vi.fn(),
    })
    mocks.createSocialRepository.mockReturnValue({
      getFriendRelationshipBetweenProfiles: vi.fn(),
      getFriendRequestById: vi.fn(),
      createFriendRequest: vi.fn(),
      acceptFriendRequest: vi.fn(),
      declineFriendRequest: vi.fn(),
      getFriendshipBetweenProfiles: vi.fn(),
      listActiveFriendships: vi.fn(),
      listIncomingPendingFriendRequests: vi.fn(),
      listOutgoingPendingFriendRequests: vi.fn(),
    })
  })

  it('returns an auth-required state for signed-out users', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'signed-out',
    })

    const formData = new FormData()
    formData.set('recipientProfileId', 'profile-2')

    const result = await sendFriendRequestAction(
      initialFriendRequestFormState,
      formData,
    )

    expect(result).toEqual({
      status: 'error',
      code: 'auth-required',
      message: 'Sign in before sending a friend request.',
    })
    expect(mocks.sendFriendRequestUseCase).not.toHaveBeenCalled()
  })

  it('passes sender and recipient context into the use case and revalidates the public profile page', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'ready',
      user: {
        id: 'auth-user-1',
        email: 'pilot@example.com',
      },
    })
    mocks.sendFriendRequestUseCase.mockResolvedValueOnce({
      ok: true,
      data: {
        friendRequestId: 'friend-1',
        status: 'pending',
      },
    })

    const formData = new FormData()
    formData.set('recipientProfileId', 'profile-2')

    const result = await sendFriendRequestAction(
      initialFriendRequestFormState,
      formData,
    )

    expect(mocks.sendFriendRequestUseCase).toHaveBeenCalledTimes(1)

    const firstCall = mocks.sendFriendRequestUseCase.mock.calls[0]

    if (!firstCall) {
      throw new Error('Expected the friend-request use case to be invoked.')
    }

    const [dependencies, command] = firstCall

    expect(typeof dependencies.profilesRepository.getPublicProfileById).toBe(
      'function',
    )
    expect(
      typeof dependencies.socialRepository.getFriendRelationshipBetweenProfiles,
    ).toBe('function')
    expect(typeof dependencies.socialRepository.createFriendRequest).toBe(
      'function',
    )
    expect(command).toEqual({
      isAuthenticated: true,
      senderProfileId: 'profile-1',
      recipientProfileId: 'profile-2',
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/friends')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/users/profile-2')
    expect(result).toEqual({
      status: 'success',
      code: 'request-sent',
      message: 'Friend request sent.',
    })
  })
})

describe('respondToFriendRequestAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({})
    mocks.createProfilesRepository.mockReturnValue({
      getProfileByAuthUserId: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: 'profile-2',
        },
      }),
      getPublicProfileById: vi.fn(),
    })
    mocks.createSocialRepository.mockReturnValue({
      getFriendRelationshipBetweenProfiles: vi.fn(),
      getFriendRequestById: vi.fn(),
      createFriendRequest: vi.fn(),
      acceptFriendRequest: vi.fn(),
      declineFriendRequest: vi.fn(),
      getFriendshipBetweenProfiles: vi.fn(),
      listActiveFriendships: vi.fn(),
      listIncomingPendingFriendRequests: vi.fn(),
      listOutgoingPendingFriendRequests: vi.fn(),
    })
  })

  it('returns an auth-required state for signed-out users', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'signed-out',
    })

    const formData = new FormData()
    formData.set('requestId', 'friend-2')
    formData.set('decision', 'accept')

    const result = await respondToFriendRequestAction(
      initialFriendRequestResponseFormState,
      formData,
    )

    expect(result).toEqual({
      status: 'error',
      code: 'auth-required',
      message: 'Sign in before managing friend requests.',
    })
    expect(mocks.acceptFriendRequestUseCase).not.toHaveBeenCalled()
  })

  it('passes recipient context into the accept use case and revalidates the profile inbox', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'ready',
      user: {
        id: 'auth-user-2',
        email: 'recipient@example.com',
      },
    })
    mocks.acceptFriendRequestUseCase.mockResolvedValueOnce({
      ok: true,
      data: {
        friendRequestId: 'friend-2',
        requesterProfileId: 'profile-1',
        friendshipId: 'friendship-1',
        status: 'accepted',
      },
    })

    const formData = new FormData()
    formData.set('requestId', 'friend-2')
    formData.set('decision', 'accept')

    const result = await respondToFriendRequestAction(
      initialFriendRequestResponseFormState,
      formData,
    )

    expect(mocks.acceptFriendRequestUseCase).toHaveBeenCalledTimes(1)

    const firstCall = mocks.acceptFriendRequestUseCase.mock.calls[0]

    if (!firstCall) {
      throw new Error('Expected the accept use case to be invoked.')
    }

    const [, command] = firstCall

    expect(command).toEqual({
      isAuthenticated: true,
      recipientProfileId: 'profile-2',
      requestId: 'friend-2',
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/friends')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/users/profile-1')
    expect(result).toEqual({
      status: 'success',
      code: 'accepted',
      message: 'Friend request accepted.',
    })
  })

  it('uses the decline use case for decline decisions', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'ready',
      user: {
        id: 'auth-user-2',
        email: 'recipient@example.com',
      },
    })
    mocks.declineFriendRequestUseCase.mockResolvedValueOnce({
      ok: true,
      data: {
        friendRequestId: 'friend-3',
        requesterProfileId: 'profile-1',
        status: 'declined',
      },
    })

    const formData = new FormData()
    formData.set('requestId', 'friend-3')
    formData.set('decision', 'decline')

    const result = await respondToFriendRequestAction(
      initialFriendRequestResponseFormState,
      formData,
    )

    expect(mocks.declineFriendRequestUseCase).toHaveBeenCalledWith(
      expect.any(Object),
      {
        isAuthenticated: true,
        recipientProfileId: 'profile-2',
        requestId: 'friend-3',
      },
    )
    expect(result).toEqual({
      status: 'success',
      code: 'declined',
      message: 'Friend request declined.',
    })
  })

  it('maps already-handled transitions into stable UI feedback', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'ready',
      user: {
        id: 'auth-user-2',
        email: 'recipient@example.com',
      },
    })
    mocks.acceptFriendRequestUseCase.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'already-handled',
        message: 'This friend request has already been handled.',
      },
    })

    const formData = new FormData()
    formData.set('requestId', 'friend-4')
    formData.set('decision', 'accept')

    const result = await respondToFriendRequestAction(
      initialFriendRequestResponseFormState,
      formData,
    )

    expect(result).toEqual({
      status: 'error',
      code: 'already-handled',
      message: 'This friend request has already been handled.',
    })
  })
})
