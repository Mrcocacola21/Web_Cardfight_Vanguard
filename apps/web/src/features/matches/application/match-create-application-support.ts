import type { DecksRepository } from '@web-vg/db/repositories/decks'
import type { ProfilesRepository } from '@web-vg/db/repositories/profiles'

import type { MatchHistoryRepository } from './match-history-repository'

export type MatchCreateApplicationErrorCode =
  | 'profile-required'
  | 'deck-unavailable'
  | 'opponent-unavailable'
  | 'self-opponent'
  | 'repository-failed'

export interface MatchCreateApplicationError {
  readonly code: MatchCreateApplicationErrorCode
  readonly message: string
}

export type MatchCreateApplicationResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: MatchCreateApplicationError
    }

export type MatchCreateWriteRepository = Pick<
  MatchHistoryRepository,
  'getOwnerProfileIdByAuthUserId' | 'createMatchRecord'
>

export type MatchCreateDeckReadRepository = Pick<DecksRepository, 'getDeckById'>

export type MatchCreateProfileReadRepository = Pick<
  ProfilesRepository,
  'getVisibleProfileById'
>

export interface MatchCreateApplicationServices {
  readonly matchHistoryRepository: MatchCreateWriteRepository
  readonly decksRepository: MatchCreateDeckReadRepository
  readonly profilesRepository: MatchCreateProfileReadRepository
}

export function createMatchCreateApplicationError(
  code: MatchCreateApplicationErrorCode,
  message: string,
): MatchCreateApplicationResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  }
}

export function mapMatchCreateRepositoryFailure(
  message: string,
): MatchCreateApplicationResult<never> {
  return createMatchCreateApplicationError('repository-failed', message)
}
