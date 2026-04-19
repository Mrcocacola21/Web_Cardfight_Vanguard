import {
  createMatchCreateApplicationError,
  mapMatchCreateRepositoryFailure,
  type MatchCreateApplicationResult,
  type MatchCreateApplicationServices,
} from './match-create-application-support'

export type ManualMatchEntryResult = 'win' | 'loss' | 'draw'

export interface CreateMatchRecordCommand {
  readonly authUserId: string
  readonly deckId: string
  readonly opponentProfileId: string
  readonly result: ManualMatchEntryResult
  readonly playedAt: string
  readonly notes: string | null
}

export type CreateMatchRecordResult = MatchCreateApplicationResult<{
  readonly matchId: string
  readonly ownerProfileId: string
  readonly opponentProfileId: string
}>

export async function createMatchRecordUseCase(
  services: MatchCreateApplicationServices,
  command: CreateMatchRecordCommand,
): Promise<CreateMatchRecordResult> {
  const ownerProfileIdResult = await resolveOwnerProfileId(
    services,
    command.authUserId,
  )

  if (!ownerProfileIdResult.ok) {
    return ownerProfileIdResult
  }

  const deckResult = await services.decksRepository.getDeckById(command.deckId)

  if (!deckResult.ok) {
    return mapMatchCreateRepositoryFailure(deckResult.error.message)
  }

  if (
    !deckResult.data ||
    deckResult.data.ownerProfileId !== ownerProfileIdResult.data ||
    !deckResult.data.currentVersion
  ) {
    return createMatchCreateApplicationError(
      'deck-unavailable',
      'Choose one of your own saved decks before recording a match.',
    )
  }

  if (ownerProfileIdResult.data === command.opponentProfileId) {
    return createMatchCreateApplicationError(
      'self-opponent',
      'You cannot record yourself as the opponent.',
    )
  }

  const opponentResult =
    await services.profilesRepository.getVisibleProfileById(
      command.opponentProfileId,
    )

  if (!opponentResult.ok) {
    return mapMatchCreateRepositoryFailure(opponentResult.error.message)
  }

  if (!opponentResult.data) {
    return createMatchCreateApplicationError(
      'opponent-unavailable',
      'Select a visible opponent profile before recording a match.',
    )
  }

  const createResult = await services.matchHistoryRepository.createMatchRecord({
    ownerProfileId: ownerProfileIdResult.data,
    formatId: deckResult.data.formatId,
    playedAt: command.playedAt,
    visibility: 'private',
    status: 'completed',
    source: 'manual',
    notes: command.notes,
    participants: [
      {
        profileId: ownerProfileIdResult.data,
        deckVersionId: deckResult.data.currentVersion.id,
        result: mapOwnerResultToParticipantResult(command.result),
        seatOrder: 1,
      },
      {
        profileId: command.opponentProfileId,
        result: mapOpponentResult(command.result),
        seatOrder: 2,
      },
    ],
  })

  if (!createResult.ok) {
    return mapMatchCreateRepositoryFailure(createResult.error.message)
  }

  return {
    ok: true,
    data: {
      matchId: createResult.data.id,
      ownerProfileId: ownerProfileIdResult.data,
      opponentProfileId: command.opponentProfileId,
    },
  }
}

async function resolveOwnerProfileId(
  services: MatchCreateApplicationServices,
  authUserId: string,
): Promise<MatchCreateApplicationResult<string>> {
  const ownerProfileResult =
    await services.matchHistoryRepository.getOwnerProfileIdByAuthUserId(
      authUserId,
    )

  if (!ownerProfileResult.ok) {
    return mapMatchCreateRepositoryFailure(ownerProfileResult.error.message)
  }

  if (!ownerProfileResult.data) {
    return createMatchCreateApplicationError(
      'profile-required',
      'Create your profile before recording match history.',
    )
  }

  return {
    ok: true,
    data: ownerProfileResult.data,
  }
}

function mapOwnerResultToParticipantResult(result: ManualMatchEntryResult) {
  switch (result) {
    case 'loss':
      return 'loss'
    case 'draw':
      return 'draw'
    case 'win':
    default:
      return 'win'
  }
}

function mapOpponentResult(result: ManualMatchEntryResult) {
  switch (result) {
    case 'loss':
      return 'win'
    case 'draw':
      return 'draw'
    case 'win':
    default:
      return 'loss'
  }
}
