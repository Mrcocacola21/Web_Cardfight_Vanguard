'use server'

import { createProfilesRepository } from '@web-vg/db'
import { revalidatePath } from 'next/cache'

import { saveCurrentProfileUseCase } from '@/features/profiles/application/profile-management-use-cases'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentAuthState } from '@/features/auth/server/auth-session'

import { validateProfileDraft } from './profile-validation'
import type { ProfileFormState } from './profile-form-state'

export async function saveCurrentProfileAction(
  _previousState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const client = await createSupabaseServerClient()
  const authState = await getCurrentAuthState({ client })

  if (authState.kind !== 'ready') {
    return {
      status: 'error',
      message:
        'You need an authenticated session before a profile can be saved.',
      fieldErrors: {},
    }
  }

  const displayNameValue = formData.get('displayName')
  const avatarUrlValue = formData.get('avatarUrl')
  const bioValue = formData.get('bio')
  const visibilityValue = formData.get('visibility')
  const bioVisibilityValue = formData.get('bioVisibility')

  const validation = validateProfileDraft({
    displayName: typeof displayNameValue === 'string' ? displayNameValue : '',
    avatarUrl: typeof avatarUrlValue === 'string' ? avatarUrlValue : '',
    bio: typeof bioValue === 'string' ? bioValue : '',
    visibility: typeof visibilityValue === 'string' ? visibilityValue : '',
    bioVisibility:
      typeof bioVisibilityValue === 'string' ? bioVisibilityValue : '',
  })

  if (!validation.ok) {
    return {
      status: 'error',
      message: 'Profile data is incomplete or invalid.',
      fieldErrors: validation.errors,
    }
  }

  const result = await saveCurrentProfileUseCase(
    {
      repository: createProfilesRepository(client),
    },
    {
      authUserId: authState.user.id,
      displayName: validation.data.displayName,
      avatarUrl: validation.data.avatarUrl,
      bio: validation.data.bio,
      visibility: validation.data.visibility,
      bioVisibility: validation.data.bioVisibility,
    },
  )

  if (!result.ok) {
    return {
      status: 'error',
      message: result.error.message,
      fieldErrors: {},
    }
  }

  revalidatePath('/profile')
  revalidatePath('/friends')
  revalidatePath('/users')
  revalidatePath(`/users/${result.data.profileId}`)

  return {
    status: 'success',
    message: 'Profile saved.',
    fieldErrors: {},
  }
}
