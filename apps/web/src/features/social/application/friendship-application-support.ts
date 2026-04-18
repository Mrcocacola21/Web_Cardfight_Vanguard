import type { SocialRepository } from '@web-vg/db/repositories/social'

export type FriendshipApplicationErrorCode =
  | 'unauthorized'
  | 'actor-profile-unavailable'
  | 'invalid-target'
  | 'friendship-not-found'
  | 'repository-failed'

export interface FriendshipApplicationError {
  readonly code: FriendshipApplicationErrorCode
  readonly message: string
}

export type FriendshipApplicationResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: FriendshipApplicationError
    }

export type FriendshipWriteRepository = Pick<
  SocialRepository,
  'getFriendshipBetweenProfiles' | 'removeFriendship'
>

export interface FriendshipApplicationServices {
  readonly socialRepository: FriendshipWriteRepository
}

export function createFriendshipApplicationError(
  code: FriendshipApplicationErrorCode,
  message: string,
): FriendshipApplicationResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  }
}

export function mapFriendshipRepositoryFailure(
  message: string,
): FriendshipApplicationResult<never> {
  return createFriendshipApplicationError('repository-failed', message)
}
