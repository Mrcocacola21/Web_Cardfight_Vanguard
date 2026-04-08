import {
  createProfilesRepository,
  type ProfileRecord,
  type PublicProfileRecord,
  type RepositoryResult,
} from '@web-vg/db'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentAuthState } from '@/features/auth/server/auth-session'

export type PublicProfilePageState =
  | {
      readonly kind: 'ready'
      readonly profile: PublicProfileRecord
      readonly isOwnerViewer: boolean
    }
  | {
      readonly kind: 'not-found'
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }

interface PublicProfilePageDependencies {
  readonly getViewerProfileId: () => Promise<string | null>
  readonly getProfileById: (
    profileId: string,
  ) => Promise<RepositoryResult<ProfileRecord | null>>
  readonly getPublicProfileById: (
    profileId: string,
  ) => Promise<RepositoryResult<PublicProfileRecord | null>>
}

function mapProfileRecordToPublicProfile(
  profile: Pick<ProfileRecord, 'id' | 'displayName' | 'avatarUrl' | 'bio'>,
): PublicProfileRecord {
  return {
    id: profile.id,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
  }
}

export async function resolvePublicProfilePageState(
  profileId: string,
  dependencies: PublicProfilePageDependencies,
): Promise<PublicProfilePageState> {
  const viewerProfileId = await dependencies.getViewerProfileId()

  if (viewerProfileId === profileId) {
    const ownerResult = await dependencies.getProfileById(profileId)

    if (!ownerResult.ok) {
      return {
        kind: 'error',
        message: ownerResult.error.message,
      }
    }

    if (!ownerResult.data) {
      return {
        kind: 'not-found',
      }
    }

    return {
      kind: 'ready',
      profile: mapProfileRecordToPublicProfile(ownerResult.data),
      isOwnerViewer: true,
    }
  }

  const publicResult = await dependencies.getPublicProfileById(profileId)

  if (!publicResult.ok) {
    return {
      kind: 'error',
      message: publicResult.error.message,
    }
  }

  if (!publicResult.data) {
    return {
      kind: 'not-found',
    }
  }

  return {
    kind: 'ready',
    profile: publicResult.data,
    isOwnerViewer: false,
  }
}

export async function getPublicProfilePageState(
  profileId: string,
): Promise<PublicProfilePageState> {
  const client = await createSupabaseServerClient()
  const repository = createProfilesRepository(client)

  return resolvePublicProfilePageState(profileId, {
    async getViewerProfileId() {
      const authState = await getCurrentAuthState({ client })

      if (authState.kind !== 'ready') {
        return null
      }

      const viewerProfileResult = await repository.getProfileByAuthUserId(
        authState.user.id,
      )

      if (!viewerProfileResult.ok) {
        return null
      }

      return viewerProfileResult.data?.id ?? null
    },
    getProfileById(profileIdToLoad) {
      return repository.getProfileById(profileIdToLoad)
    },
    getPublicProfileById(profileIdToLoad) {
      return repository.getPublicProfileById(profileIdToLoad)
    },
  })
}
