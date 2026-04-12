import type { ProfilesRepository } from '@web-vg/db/repositories/profiles'

export type ProfileApplicationErrorCode = 'repository-failed'

export interface ProfileApplicationError {
  readonly code: ProfileApplicationErrorCode
  readonly message: string
}

export type ProfileApplicationResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: ProfileApplicationError
    }

export type ProfileWriteRepository = Pick<
  ProfilesRepository,
  'ensureProfileByAuthUserId' | 'upsertProfileByAuthUserId'
>

export interface ProfileApplicationServices {
  readonly repository: ProfileWriteRepository
}

export function mapProfileRepositoryFailure(
  message: string,
): ProfileApplicationResult<never> {
  return {
    ok: false,
    error: {
      code: 'repository-failed',
      message,
    },
  }
}
