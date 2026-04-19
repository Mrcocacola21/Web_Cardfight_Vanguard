import type {
  MatchHistoryRepository,
  StoredMatchRecord,
} from './match-history-repository'

export type MatchHistoryApplicationErrorCode =
  | 'profile-required'
  | 'match-not-found'
  | 'forbidden'
  | 'repository-failed'

export interface MatchHistoryApplicationError {
  readonly code: MatchHistoryApplicationErrorCode
  readonly message: string
}

export type MatchHistoryApplicationResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: MatchHistoryApplicationError
    }

export interface MatchHistoryApplicationServices {
  readonly repository: MatchHistoryRepository
}

export interface OwnedMatchRecordState {
  readonly ownerProfileId: string
  readonly matchRecord: StoredMatchRecord
}

export interface ResolveOwnedMatchRecordInput {
  readonly authUserId: string
  readonly matchId: string
  readonly forbiddenMessage: string
}

export async function resolveMatchHistoryOwnerProfile(
  services: MatchHistoryApplicationServices,
  authUserId: string,
): Promise<MatchHistoryApplicationResult<string>> {
  const profileResult =
    await services.repository.getOwnerProfileIdByAuthUserId(authUserId)

  if (!profileResult.ok) {
    return mapRepositoryFailure(profileResult.error.message)
  }

  if (!profileResult.data) {
    return {
      ok: false,
      error: {
        code: 'profile-required',
        message:
          'A persisted profile row is required before match-history actions can run.',
      },
    }
  }

  return {
    ok: true,
    data: profileResult.data,
  }
}

export async function resolveOwnedMatchRecord(
  services: MatchHistoryApplicationServices,
  input: ResolveOwnedMatchRecordInput,
): Promise<MatchHistoryApplicationResult<OwnedMatchRecordState>> {
  const ownerProfileResult = await resolveMatchHistoryOwnerProfile(
    services,
    input.authUserId,
  )

  if (!ownerProfileResult.ok) {
    return ownerProfileResult
  }

  const matchResult = await services.repository.getMatchRecordById(
    input.matchId,
  )

  if (!matchResult.ok) {
    return mapRepositoryFailure(matchResult.error.message)
  }

  if (!matchResult.data) {
    return {
      ok: false,
      error: {
        code: 'match-not-found',
        message: 'The requested match record could not be found.',
      },
    }
  }

  if (matchResult.data.ownerProfileId !== ownerProfileResult.data) {
    return {
      ok: false,
      error: {
        code: 'forbidden',
        message: input.forbiddenMessage,
      },
    }
  }

  return {
    ok: true,
    data: {
      ownerProfileId: ownerProfileResult.data,
      matchRecord: matchResult.data,
    },
  }
}

function mapRepositoryFailure(
  message: string,
): MatchHistoryApplicationResult<never> {
  return {
    ok: false,
    error: {
      code: 'repository-failed',
      message,
    },
  }
}
