import type { ProfilesRepository } from '@web-vg/db/repositories/profiles'
import type { SocialRepository } from '@web-vg/db/repositories/social'

export type FriendRequestApplicationErrorCode =
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
  | 'repository-failed'

export interface FriendRequestApplicationError {
  readonly code: FriendRequestApplicationErrorCode
  readonly message: string
}

export type FriendRequestApplicationResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: FriendRequestApplicationError
    }

export type FriendRequestProfileReadRepository = Pick<
  ProfilesRepository,
  'getPublicProfileById'
>

export type FriendRequestWriteRepository = Pick<
  SocialRepository,
  | 'getFriendRelationshipBetweenProfiles'
  | 'getFriendRequestById'
  | 'createFriendRequest'
  | 'acceptFriendRequest'
  | 'declineFriendRequest'
  | 'getFriendshipBetweenProfiles'
>

export interface FriendRequestApplicationServices {
  readonly profilesRepository: FriendRequestProfileReadRepository
  readonly socialRepository: FriendRequestWriteRepository
}

export function createFriendRequestApplicationError(
  code: FriendRequestApplicationErrorCode,
  message: string,
): FriendRequestApplicationResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  }
}

export function mapFriendRequestRepositoryFailure(
  message: string,
): FriendRequestApplicationResult<never> {
  return createFriendRequestApplicationError('repository-failed', message)
}
