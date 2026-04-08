import {
  createProfilesRepository,
  type ProfileRecord,
  type RepositoryResult,
} from '@web-vg/db'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getCurrentAuthState,
  type AuthUserRecord,
} from '@/features/auth/server/auth-session'

export type CurrentProfileState =
  | {
      readonly kind: 'signed-out'
    }
  | {
      readonly kind: 'ready'
      readonly profile: ProfileRecord | null
      readonly authUser: AuthUserRecord
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }

export async function getCurrentProfileState(): Promise<CurrentProfileState> {
  const client = await createSupabaseServerClient()
  const authState = await getCurrentAuthState({ client })

  if (authState.kind === 'error') {
    return {
      kind: 'error',
      message: authState.message,
    }
  }

  if (authState.kind === 'signed-out') {
    return {
      kind: 'signed-out',
    }
  }

  const repository = createProfilesRepository(client)
  const result = await repository.getProfileByAuthUserId(authState.user.id)

  if (!result.ok) {
    return {
      kind: 'error',
      message: result.error.message,
    }
  }

  return {
    kind: 'ready',
    authUser: authState.user,
    profile: result.data,
  }
}

export async function getProfileById(
  profileId: string,
): Promise<RepositoryResult<ProfileRecord | null>> {
  const client = await createSupabaseServerClient()
  const repository = createProfilesRepository(client)

  return repository.getProfileById(profileId)
}
