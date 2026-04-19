'use server'

import { createProfilesRepository, createSocialRepository } from '@web-vg/db'
import { revalidatePath } from 'next/cache'

import { getCurrentAuthState } from '@/features/auth/server/auth-session'
import {
  acceptFriendRequestUseCase,
  declineFriendRequestUseCase,
  sendFriendRequestUseCase,
} from '@/features/social/application/friend-request-use-cases'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import {
  initialFriendRequestFormState,
  type FriendRequestFormState,
} from './friend-request-form-state'
import {
  initialFriendRequestResponseFormState,
  type FriendRequestResponseFormState,
} from './friend-request-response-form-state'

export async function sendFriendRequestAction(
  _previousState: FriendRequestFormState,
  formData: FormData,
): Promise<FriendRequestFormState> {
  const recipientProfileIdValue = formData.get('recipientProfileId')
  const recipientProfileId =
    typeof recipientProfileIdValue === 'string'
      ? recipientProfileIdValue.trim()
      : ''

  if (!recipientProfileId) {
    return {
      status: 'error',
      code: 'unavailable',
      message: 'This user is not available for friend requests.',
    }
  }

  const client = await createSupabaseServerClient()
  const authState = await getCurrentAuthState({ client })

  if (authState.kind === 'signed-out') {
    return {
      status: 'error',
      code: 'auth-required',
      message: 'Sign in before sending a friend request.',
    }
  }

  if (authState.kind === 'error') {
    return {
      status: 'error',
      code: 'unavailable',
      message: authState.message,
    }
  }

  const profilesRepository = createProfilesRepository(client)
  const senderProfileResult = await profilesRepository.getProfileByAuthUserId(
    authState.user.id,
  )

  if (!senderProfileResult.ok) {
    return {
      status: 'error',
      code: 'unavailable',
      message: senderProfileResult.error.message,
    }
  }

  const result = await sendFriendRequestUseCase(
    {
      profilesRepository,
      socialRepository: createSocialRepository(client),
    },
    {
      isAuthenticated: true,
      senderProfileId: senderProfileResult.data?.id ?? null,
      recipientProfileId,
    },
  )

  if (!result.ok) {
    return mapFriendRequestErrorToFormState(
      result.error.code,
      result.error.message,
    )
  }

  revalidatePath('/friends')
  revalidatePath(`/users/${recipientProfileId}`)

  return {
    status: 'success',
    code: 'request-sent',
    message: 'Friend request sent.',
  }
}

export async function respondToFriendRequestAction(
  _previousState: FriendRequestResponseFormState,
  formData: FormData,
): Promise<FriendRequestResponseFormState> {
  const requestIdValue = formData.get('requestId')
  const requestId =
    typeof requestIdValue === 'string' ? requestIdValue.trim() : ''
  const decisionValue = formData.get('decision')
  const decision =
    decisionValue === 'accept' || decisionValue === 'decline'
      ? decisionValue
      : null

  if (!requestId || !decision) {
    return {
      status: 'error',
      code: 'unavailable',
      message: 'This friend request is not available.',
    }
  }

  const client = await createSupabaseServerClient()
  const authState = await getCurrentAuthState({ client })

  if (authState.kind === 'signed-out') {
    return {
      status: 'error',
      code: 'auth-required',
      message: 'Sign in before managing friend requests.',
    }
  }

  if (authState.kind === 'error') {
    return {
      status: 'error',
      code: 'unavailable',
      message: authState.message,
    }
  }

  const profilesRepository = createProfilesRepository(client)
  const recipientProfileResult =
    await profilesRepository.getProfileByAuthUserId(authState.user.id)

  if (!recipientProfileResult.ok) {
    return {
      status: 'error',
      code: 'unavailable',
      message: recipientProfileResult.error.message,
    }
  }

  const services = {
    profilesRepository,
    socialRepository: createSocialRepository(client),
  }

  const result =
    decision === 'accept'
      ? await acceptFriendRequestUseCase(services, {
          isAuthenticated: true,
          recipientProfileId: recipientProfileResult.data?.id ?? null,
          requestId,
        })
      : await declineFriendRequestUseCase(services, {
          isAuthenticated: true,
          recipientProfileId: recipientProfileResult.data?.id ?? null,
          requestId,
        })

  if (!result.ok) {
    return mapFriendRequestResponseErrorToFormState(
      result.error.code,
      result.error.message,
    )
  }

  revalidatePath('/friends')
  revalidatePath(`/users/${result.data.requesterProfileId}`)

  return {
    status: 'success',
    code: decision === 'accept' ? 'accepted' : 'declined',
    message:
      decision === 'accept'
        ? 'Friend request accepted.'
        : 'Friend request declined.',
  }
}

function mapFriendRequestErrorToFormState(
  code:
    | 'unauthorized'
    | 'sender-unavailable'
    | 'actor-profile-unavailable'
    | 'self-request'
    | 'recipient-unavailable'
    | 'already-pending'
    | 'already-friends'
    | 'request-unavailable'
    | 'forbidden'
    | 'already-handled'
    | 'friendship-unavailable'
    | 'repository-failed',
  message: string,
): FriendRequestFormState {
  switch (code) {
    case 'unauthorized':
      return {
        status: 'error',
        code: 'auth-required',
        message: 'Sign in before sending a friend request.',
      }
    case 'self-request':
      return {
        status: 'error',
        code: 'self-request',
        message,
      }
    case 'already-pending':
      return {
        status: 'error',
        code: 'already-pending',
        message: 'A friend request is already pending for this user.',
      }
    case 'already-friends':
      return {
        status: 'error',
        code: 'already-friends',
        message,
      }
    case 'recipient-unavailable':
    case 'request-unavailable':
      return {
        status: 'error',
        code: 'request-unavailable',
        message:
          'This user is not available for a new friend request right now.',
      }
    case 'sender-unavailable':
    case 'actor-profile-unavailable':
    case 'forbidden':
    case 'already-handled':
    case 'friendship-unavailable':
    case 'repository-failed':
    default:
      return {
        status: 'error',
        code: 'unavailable',
        message,
      }
  }
}

function mapFriendRequestResponseErrorToFormState(
  code:
    | 'unauthorized'
    | 'sender-unavailable'
    | 'actor-profile-unavailable'
    | 'self-request'
    | 'recipient-unavailable'
    | 'already-pending'
    | 'already-friends'
    | 'request-unavailable'
    | 'forbidden'
    | 'already-handled'
    | 'friendship-unavailable'
    | 'repository-failed',
  message: string,
): FriendRequestResponseFormState {
  switch (code) {
    case 'unauthorized':
      return {
        status: 'error',
        code: 'auth-required',
        message: 'Sign in before managing friend requests.',
      }
    case 'forbidden':
      return {
        status: 'error',
        code: 'forbidden',
        message: 'Only the request recipient can manage this friend request.',
      }
    case 'already-handled':
      return {
        status: 'error',
        code: 'already-handled',
        message,
      }
    case 'request-unavailable':
      return {
        status: 'error',
        code: 'unavailable',
        message: 'This friend request is no longer available.',
      }
    case 'actor-profile-unavailable':
    case 'friendship-unavailable':
    case 'repository-failed':
    case 'sender-unavailable':
    case 'self-request':
    case 'recipient-unavailable':
    case 'already-pending':
    case 'already-friends':
    default:
      return {
        status: 'error',
        code: 'unavailable',
        message,
      }
  }
}

export { initialFriendRequestFormState, initialFriendRequestResponseFormState }
