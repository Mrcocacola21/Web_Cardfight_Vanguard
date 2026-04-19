import { createSocialRepository, type RepositoryResult } from '@web-vg/db'
import type { ProfileRecord } from '@web-vg/db/repositories/profiles'
import type {
  ActiveFriendRecord,
  IncomingFriendRequestRecord,
  OutgoingFriendRequestRecord,
} from '@web-vg/db/repositories/social'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentProfileState } from '@/features/profiles/server/profile-read'

const defaultFriendsDashboardSectionLimit = 25

export type FriendsDashboardPageState =
  | {
      readonly kind: 'ready'
      readonly viewerProfileId: string
      readonly viewerDisplayName: string
      readonly friends: readonly ActiveFriendRecord[]
      readonly incomingRequests: readonly IncomingFriendRequestRecord[]
      readonly outgoingRequests: readonly OutgoingFriendRequestRecord[]
    }
  | {
      readonly kind: 'profile-unavailable'
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }

interface FriendsDashboardReadDependencies {
  readonly listActiveFriendships: (
    ownerProfileId: string,
    limit: number,
  ) => Promise<RepositoryResult<readonly ActiveFriendRecord[]>>
  readonly listIncomingPendingFriendRequests: (
    recipientProfileId: string,
    limit: number,
  ) => Promise<RepositoryResult<readonly IncomingFriendRequestRecord[]>>
  readonly listOutgoingPendingFriendRequests: (
    requesterProfileId: string,
    limit: number,
  ) => Promise<RepositoryResult<readonly OutgoingFriendRequestRecord[]>>
}

export async function resolveFriendsDashboardPageState(
  viewerProfile: Pick<ProfileRecord, 'id' | 'displayName'>,
  dependencies: FriendsDashboardReadDependencies,
): Promise<FriendsDashboardPageState> {
  const [friendsResult, incomingRequestsResult, outgoingRequestsResult] =
    await Promise.all([
      dependencies.listActiveFriendships(
        viewerProfile.id,
        defaultFriendsDashboardSectionLimit,
      ),
      dependencies.listIncomingPendingFriendRequests(
        viewerProfile.id,
        defaultFriendsDashboardSectionLimit,
      ),
      dependencies.listOutgoingPendingFriendRequests(
        viewerProfile.id,
        defaultFriendsDashboardSectionLimit,
      ),
    ])

  if (!friendsResult.ok) {
    return {
      kind: 'error',
      message: friendsResult.error.message,
    }
  }

  if (!incomingRequestsResult.ok) {
    return {
      kind: 'error',
      message: incomingRequestsResult.error.message,
    }
  }

  if (!outgoingRequestsResult.ok) {
    return {
      kind: 'error',
      message: outgoingRequestsResult.error.message,
    }
  }

  return {
    kind: 'ready',
    viewerProfileId: viewerProfile.id,
    viewerDisplayName: viewerProfile.displayName,
    friends: friendsResult.data,
    incomingRequests: incomingRequestsResult.data,
    outgoingRequests: outgoingRequestsResult.data,
  }
}

export async function getFriendsDashboardPageState(): Promise<FriendsDashboardPageState> {
  const currentProfileState = await getCurrentProfileState()

  if (currentProfileState.kind === 'error') {
    return {
      kind: 'error',
      message: currentProfileState.message,
    }
  }

  if (currentProfileState.kind === 'signed-out') {
    return {
      kind: 'error',
      message: 'The friends dashboard requires an authenticated session.',
    }
  }

  if (!currentProfileState.profile) {
    return {
      kind: 'profile-unavailable',
    }
  }

  const client = await createSupabaseServerClient()
  const socialRepository = createSocialRepository(client)

  return resolveFriendsDashboardPageState(currentProfileState.profile, {
    listActiveFriendships(ownerProfileId, limit) {
      return socialRepository.listActiveFriendships(ownerProfileId, limit)
    },
    listIncomingPendingFriendRequests(recipientProfileId, limit) {
      return socialRepository.listIncomingPendingFriendRequests(
        recipientProfileId,
        limit,
      )
    },
    listOutgoingPendingFriendRequests(requesterProfileId, limit) {
      return socialRepository.listOutgoingPendingFriendRequests(
        requesterProfileId,
        limit,
      )
    },
  })
}
