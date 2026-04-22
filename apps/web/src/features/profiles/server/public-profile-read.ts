import {
  createProfilesRepository,
  createSocialRepository,
  type RepositoryResult,
} from '@web-vg/db'
import type {
  ProfileRecord,
  VisibleProfileRecord,
} from '@web-vg/db/repositories/profiles'
import type {
  FriendRelationshipRecord,
  FriendshipRecord,
} from '@web-vg/db/repositories/social'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentAuthState } from '@/features/auth/server/auth-session'
import {
  resolveProfileViewerCategory,
  type ProfileViewerCategory,
} from '@/features/profiles/profile-privacy'
import type { PublicProfileRelationshipState } from '@/features/social/relationship-state'

export type PublicProfilePageState =
  | {
      readonly kind: 'ready'
      readonly profile: VisibleProfileRecord
      readonly isOwnerViewer: boolean
      readonly viewerProfileId: string | null
      readonly viewerCategory: ProfileViewerCategory
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
  readonly getVisibleProfileById: (
    profileId: string,
  ) => Promise<RepositoryResult<VisibleProfileRecord | null>>
  readonly getFriendRelationshipBetweenProfiles: (
    firstProfileId: string,
    secondProfileId: string,
  ) => Promise<RepositoryResult<FriendRelationshipRecord | null>>
  readonly getFriendshipBetweenProfiles: (
    firstProfileId: string,
    secondProfileId: string,
  ) => Promise<RepositoryResult<FriendshipRecord | null>>
}

function mapOwnerProfileRecordToVisibleProfile(
  profile: Pick<
    ProfileRecord,
    'id' | 'displayName' | 'avatarUrl' | 'bio' | 'visibility' | 'bioVisibility'
  >,
): VisibleProfileRecord {
  return {
    id: profile.id,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    visibility: profile.visibility,
    bioVisibility: profile.bioVisibility,
    bioVisible: true,
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
      profile: mapOwnerProfileRecordToVisibleProfile(ownerResult.data),
      isOwnerViewer: true,
      viewerProfileId,
      viewerCategory: 'owner',
      relationshipState: {
        kind: 'self',
      },
    }
  }

  const visibleResult = await dependencies.getVisibleProfileById(profileId)

  if (!visibleResult.ok) {
    return {
      kind: 'error',
      message: visibleResult.error.message,
    }
  }

  if (!visibleResult.data) {
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
    profile: visibleResult.data,
    isOwnerViewer: false,
    viewerProfileId,
    viewerCategory: resolveProfileViewerCategory({
      viewerProfileId,
      ownerProfileId: visibleResult.data.id,
      isFriend: relationshipState.kind === 'friend',
    }),
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
  const viewerProfileState = await resolveViewerProfileState(repository, client)

  if (!viewerProfileState.ok) {
    return {
      kind: 'error',
      message: viewerProfileState.message,
    }
  }

  return resolvePublicProfilePageState(profileId, {
    getViewerProfileId() {
      return Promise.resolve(viewerProfileState.viewerProfileId)
    },
    getProfileById(profileIdToLoad) {
      return repository.getProfileById(profileIdToLoad)
    },
    getVisibleProfileById(profileIdToLoad) {
      return repository.getVisibleProfileById(profileIdToLoad)
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

async function resolveViewerProfileState(
  repository: Pick<PublicProfilePageDependencies, never> & {
    getProfileByAuthUserId: (
      authUserId: string,
    ) => Promise<RepositoryResult<ProfileRecord | null>>
  },
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<
  | {
      readonly ok: true
      readonly viewerProfileId: string | null
    }
  | {
      readonly ok: false
      readonly message: string
    }
> {
  const authState = await getCurrentAuthState({ client })

  if (authState.kind === 'signed-out') {
    return {
      ok: true,
      viewerProfileId: null,
    }
  }

  if (authState.kind === 'error') {
    return {
      ok: false,
      message: authState.message,
    }
  }

  const viewerProfileResult = await repository.getProfileByAuthUserId(
    authState.user.id,
  )

  if (!viewerProfileResult.ok) {
    return {
      ok: false,
      message: viewerProfileResult.error.message,
    }
  }

  return {
    ok: true,
    viewerProfileId: viewerProfileResult.data?.id ?? null,
  }
}
