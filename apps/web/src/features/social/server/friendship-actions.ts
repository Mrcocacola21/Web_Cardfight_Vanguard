'use server'

import { createProfilesRepository, createSocialRepository } from '@web-vg/db'
import { revalidatePath } from 'next/cache'

import { getCurrentAuthState } from '@/features/auth/server/auth-session'
import { removeFriendUseCase } from '@/features/social/application/friendship-use-cases'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import {
  initialFriendRemovalFormState,
  type FriendRemovalFormState,
} from './friend-removal-form-state'

export async function removeFriendAction(
  _previousState: FriendRemovalFormState,
  formData: FormData,
): Promise<FriendRemovalFormState> {
  const targetProfileIdValue = formData.get('targetProfileId')
  const targetProfileId =
    typeof targetProfileIdValue === 'string' ? targetProfileIdValue.trim() : ''

  if (!targetProfileId) {
    return {
      status: 'error',
      code: 'unavailable',
      message: 'This friendship is not available.',
    }
  }

  const client = await createSupabaseServerClient()
  const authState = await getCurrentAuthState({ client })

  if (authState.kind === 'signed-out') {
    return {
      status: 'error',
      code: 'auth-required',
      message: 'Sign in before removing a friend.',
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
  const actorProfileResult = await profilesRepository.getProfileByAuthUserId(
    authState.user.id,
  )

  if (!actorProfileResult.ok) {
    return {
      status: 'error',
      code: 'unavailable',
      message: actorProfileResult.error.message,
    }
  }

  const result = await removeFriendUseCase(
    {
      socialRepository: createSocialRepository(client),
    },
    {
      isAuthenticated: true,
      actorProfileId: actorProfileResult.data?.id ?? null,
      targetProfileId,
    },
  )

  if (!result.ok) {
    return mapFriendRemovalErrorToFormState(
      result.error.code,
      result.error.message,
    )
  }

  revalidatePath(`/users/${targetProfileId}`)

  return {
    status: 'success',
    code: 'removed',
    message: 'Friend removed.',
  }
}

function mapFriendRemovalErrorToFormState(
  code:
    | 'unauthorized'
    | 'actor-profile-unavailable'
    | 'invalid-target'
    | 'friendship-not-found'
    | 'repository-failed',
  message: string,
): FriendRemovalFormState {
  switch (code) {
    case 'unauthorized':
      return {
        status: 'error',
        code: 'auth-required',
        message: 'Sign in before removing a friend.',
      }
    case 'friendship-not-found':
      return {
        status: 'error',
        code: 'friendship-not-found',
        message: 'This friendship is no longer active.',
      }
    case 'actor-profile-unavailable':
    case 'invalid-target':
    case 'repository-failed':
    default:
      return {
        status: 'error',
        code: 'unavailable',
        message,
      }
  }
}

export { initialFriendRemovalFormState }
