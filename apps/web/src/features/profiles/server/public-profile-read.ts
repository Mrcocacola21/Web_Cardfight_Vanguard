import {
  createProfilesRepository,
  createSocialRepository,
  type RepositoryResult,
} from '@web-vg/db'
import type {
  ProfileRecord,
  PublicProfileRecord,
} from '@web-vg/db/repositories/profiles'
import type {
  FriendRelationshipRecord,
  FriendshipRecord,
} from '@web-vg/db/repositories/social'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentAuthState } from '@/features/auth/server/auth-session'
import type { PublicProfileRelationshipState } from '@/features/social/relationship-state'

export type PublicProfilePageState =
  | {
      readonly kind: 'ready'
      readonly profile: PublicProfileRecord
      readonly isOwnerViewer: boolean
      readonly viewerProfileId: string | null
      readonly relationshipState: PublicProfileRelationshipState
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
  readonly getFriendRelationshipBetweenProfiles: (
    firstProfileId: string,
    secondProfileId: string,
  ) => Promise<RepositoryResult<FriendRelationshipRecord | null>>
  readonly getFriendshipBetweenProfiles: (
    firstProfileId: string,
    secondProfileId: string,
  ) => Promise<RepositoryResult<FriendshipRecord | null>>
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
      viewerProfileId,
      relationshipState: {
        kind: 'self',
      },
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

  const relationshipState = await resolvePublicProfileRelationshipState(
    viewerProfileId,
    profileId,
    dependencies,
  )

  if ('message' in relationshipState) {
    return {
      kind: 'error',
      message: relationshipState.message,
    }
  }

  return {
    kind: 'ready',
    profile: publicResult.data,
    isOwnerViewer: false,
    viewerProfileId,
    relationshipState,
  }
}

async function resolvePublicProfileRelationshipState(
  viewerProfileId: string | null,
  profileId: string,
  dependencies: Pick<
    PublicProfilePageDependencies,
    'getFriendRelationshipBetweenProfiles' | 'getFriendshipBetweenProfiles'
  >,
): Promise<
  | PublicProfileRelationshipState
  | {
      readonly message: string
    }
> {
  if (!viewerProfileId) {
    return {
      kind: 'guest',
    }
  }

  const friendshipResult = await dependencies.getFriendshipBetweenProfiles(
    viewerProfileId,
    profileId,
  )

  if (!friendshipResult.ok) {
    return {
      message: friendshipResult.error.message,
    }
  }

  if (friendshipResult.data) {
    return {
      kind: 'friend',
      friendshipId: friendshipResult.data.id,
    }
  }

  const requestResult = await dependencies.getFriendRelationshipBetweenProfiles(
    viewerProfileId,
    profileId,
  )

  if (!requestResult.ok) {
    return {
      message: requestResult.error.message,
    }
  }

  if (!requestResult.data) {
    return {
      kind: 'none',
    }
  }

  if (requestResult.data.status === 'pending') {
    return {
      kind: 'pending',
      requestId: requestResult.data.id,
      direction:
        requestResult.data.requesterProfileId === viewerProfileId
          ? 'outgoing'
          : 'incoming',
    }
  }

  return {
    kind: 'history-locked',
    requestStatus: requestResult.data.status,
  }
}

export async function getPublicProfilePageState(
  profileId: string,
): Promise<PublicProfilePageState> {
  const client = await createSupabaseServerClient()
  const repository = createProfilesRepository(client)
  const socialRepository = createSocialRepository(client)

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
    getFriendRelationshipBetweenProfiles(firstProfileId, secondProfileId) {
      return socialRepository.getFriendRelationshipBetweenProfiles(
        firstProfileId,
        secondProfileId,
      )
    },
    getFriendshipBetweenProfiles(firstProfileId, secondProfileId) {
      return socialRepository.getFriendshipBetweenProfiles(
        firstProfileId,
        secondProfileId,
      )
    },
  })
}
