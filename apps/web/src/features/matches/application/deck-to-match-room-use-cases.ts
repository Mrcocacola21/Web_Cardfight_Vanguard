import { createDeck, type DeckVersionId } from '@web-vg/decks'
import type { CatalogCardEntityRecord } from '@web-vg/db/repositories/catalog'
import type { DeckDetailRecord } from '@web-vg/db/repositories/decks'
import type { ProfilesRepository } from '@web-vg/db/repositories/profiles'
import {
  STANDARD_FORMAT_ID,
  type ActionId,
  type GameState,
  type PlayerId,
} from '@web-vg/rules-core'
import {
  MATCH_ROOM_STANDARD_ENGINE_ADAPTER_ID,
  appendAcceptedMatchRoomCommandToHistory,
  createDeckBackedGameState,
  createMatchRoom,
  initializeMatchRoom,
  submitMatchRoomCommand,
  type MatchDeckValidationProof,
  type MatchRoomHistoryEntry,
  type MatchRoomId,
  type MatchRoomParticipantId,
  type MatchRoomWithEngineState,
  type PersistedMatchSessionAdapter,
} from '@web-vg/match-session'
import type {
  CardId,
  CardType,
  Clan,
  DeckId,
  DeckSection,
  EffectRefId,
  FormatId,
  GameplayCard,
  Grade,
  Keyword,
  Nation,
  TriggerType,
  UserId,
} from '@web-vg/shared'

type RepositoryResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: {
        readonly message: string
      }
    }

export type DeckToMatchRoomErrorCode =
  | 'profile-required'
  | 'room-access-denied'
  | 'deck-unavailable'
  | 'opponent-unavailable'
  | 'self-opponent'
  | 'unsupported-format'
  | 'catalog-unavailable'
  | 'deck-invalid'
  | 'bootstrap-failed'
  | 'room-persist-failed'
  | 'repository-failed'

export interface DeckToMatchRoomError {
  readonly code: DeckToMatchRoomErrorCode
  readonly message: string
}

export type DeckToMatchRoomResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: DeckToMatchRoomError
    }

export interface CreateDeckToMatchRoomCommand {
  readonly authUserId: string
  readonly deckId: string
  readonly opponentProfileId: string
}

export interface DeckToMatchRoomDeckRepository {
  getDeckDetailById(
    deckId: string,
  ): Promise<RepositoryResult<DeckDetailRecord | null>>
}

export interface DeckToMatchRoomCatalogRepository {
  getCardEntityById(
    cardEntityId: string,
  ): Promise<RepositoryResult<CatalogCardEntityRecord | null>>
}

export interface DeckToMatchRoomValidationService {
  validateDeck(input: {
    readonly deck: DeckDetailRecord
    readonly catalogCards: readonly CatalogCardEntityRecord[]
  }): Promise<MatchDeckValidationProof>
}

export interface DeckToMatchRoomIdFactory {
  createRoomId(): MatchRoomId
  createParticipantId(input: {
    readonly roomId: MatchRoomId
    readonly seat: 0 | 1
  }): MatchRoomParticipantId
  createPlayerId(input: {
    readonly roomId: MatchRoomId
    readonly seat: 0 | 1
  }): PlayerId
  createActionId(input: {
    readonly roomId: MatchRoomId
    readonly label: string
    readonly revision: number
  }): ActionId
}

export interface CreateDeckToMatchRoomServices {
  readonly profilesRepository: Pick<
    ProfilesRepository,
    'getProfileByAuthUserId' | 'getVisibleProfileById'
  >
  readonly decksRepository: DeckToMatchRoomDeckRepository
  readonly catalogRepository: DeckToMatchRoomCatalogRepository
  readonly validationService: DeckToMatchRoomValidationService
  readonly roomSessions: Pick<
    PersistedMatchSessionAdapter,
    'createPersistedRoom'
  >
  readonly idFactory: DeckToMatchRoomIdFactory
  readonly now: () => string
}

export interface CreateTwoDeckMatchRoomCommand {
  readonly authUserId: string
  readonly requesterProfileId: string
  readonly requesterDeckId: string
  readonly inviteeProfileId: string
  readonly inviteeDeckId: string
}

export interface CreateTwoDeckMatchRoomServices extends Omit<
  CreateDeckToMatchRoomServices,
  'profilesRepository'
> {
  readonly profilesRepository: Pick<
    ProfilesRepository,
    'getProfileByAuthUserId' | 'getProfileById'
  >
}

export async function createDeckToMatchRoomUseCase(
  services: CreateDeckToMatchRoomServices,
  command: CreateDeckToMatchRoomCommand,
): Promise<
  DeckToMatchRoomResult<{
    readonly roomId: MatchRoomId
    readonly ownerProfileId: string
    readonly opponentProfileId: string
    readonly deckId: string
  }>
> {
  const ownerProfileResult =
    await services.profilesRepository.getProfileByAuthUserId(command.authUserId)

  if (!ownerProfileResult.ok) {
    return repositoryFailed(ownerProfileResult.error.message)
  }

  if (!ownerProfileResult.data) {
    return createDeckToMatchRoomError(
      'profile-required',
      'Create your profile before starting a multiplayer match room.',
    )
  }

  const deckResult = await services.decksRepository.getDeckDetailById(
    command.deckId,
  )

  if (!deckResult.ok) {
    return repositoryFailed(deckResult.error.message)
  }

  const deck = deckResult.data

  if (
    !deck ||
    deck.ownerProfileId !== ownerProfileResult.data.id ||
    !deck.currentVersion
  ) {
    return createDeckToMatchRoomError(
      'deck-unavailable',
      'Choose one of your own saved decks before starting a match room.',
    )
  }

  if (deck.format.id !== STANDARD_FORMAT_ID) {
    return createDeckToMatchRoomError(
      'unsupported-format',
      'Only Standard decks can start a Pre-Phase 21 gameplay room.',
    )
  }

  if (ownerProfileResult.data.id === command.opponentProfileId) {
    return createDeckToMatchRoomError(
      'self-opponent',
      'Choose a different visible profile as the opponent.',
    )
  }

  const opponentResult =
    await services.profilesRepository.getVisibleProfileById(
      command.opponentProfileId,
    )

  if (!opponentResult.ok) {
    return repositoryFailed(opponentResult.error.message)
  }

  if (!opponentResult.data) {
    return createDeckToMatchRoomError(
      'opponent-unavailable',
      'Select a visible opponent profile before starting a match room.',
    )
  }

  const catalogCardsResult = await loadCatalogCardsForDeck(
    services.catalogRepository,
    deck,
  )

  if (!catalogCardsResult.ok) {
    return catalogCardsResult
  }

  const validation = await services.validationService.validateDeck({
    deck,
    catalogCards: catalogCardsResult.data,
  })

  if (!validation.isValid || validation.errorCount > 0) {
    return createDeckToMatchRoomError(
      'deck-invalid',
      `Deck validation must pass before match room creation. ${validation.errorCount} error(s) reported by ${validation.source}.`,
    )
  }

  const roomId = services.idFactory.createRoomId()
  const participantOneId = services.idFactory.createParticipantId({
    roomId,
    seat: 0,
  })
  const participantTwoId = services.idFactory.createParticipantId({
    roomId,
    seat: 1,
  })
  const playerOneId = services.idFactory.createPlayerId({ roomId, seat: 0 })
  const playerTwoId = services.idFactory.createPlayerId({ roomId, seat: 1 })
  const createdAt = services.now()
  const domainDeck = createDomainDeckFromDetail(deck)
  const sparringDeck = createStandardSparringDeck(roomId)
  const gameState = createDeckBackedGameState({
    gameId: `game:${roomId}` as GameState['gameId'],
    formatId: STANDARD_FORMAT_ID,
    startingPlayerId: playerOneId,
    players: [
      {
        playerId: playerOneId,
        seat: 0,
        deckSnapshot: domainDeck.currentVersion.snapshot,
        cardDefinitions: catalogCardsResult.data.map(mapCatalogCardToGameplay),
        validation,
      },
      {
        playerId: playerTwoId,
        seat: 1,
        deckSnapshot: sparringDeck.deck.currentVersion.snapshot,
        cardDefinitions: sparringDeck.cardDefinitions,
        validation: sparringDeck.validation,
        runtimeKey: 'standard-sparring',
      },
    ],
  })

  if (!gameState.ok) {
    return createDeckToMatchRoomError('bootstrap-failed', gameState.message)
  }

  const initializedRoom = initializeMatchRoom(
    createMatchRoom({
      roomId,
      formatId: STANDARD_FORMAT_ID,
      engineAdapterId: MATCH_ROOM_STANDARD_ENGINE_ADAPTER_ID,
      hostParticipantId: participantOneId,
      createdAt,
      participants: [
        {
          participantId: participantOneId,
          seat: 0,
          userId: ownerProfileResult.data.id as UserId,
          displayName: ownerProfileResult.data.displayName,
          submittedDeckId: deck.id as DeckId,
        },
        {
          participantId: participantTwoId,
          seat: 1,
          userId: opponentResult.data.id as UserId,
          displayName: opponentResult.data.displayName,
          submittedDeckId: sparringDeck.deck.id,
        },
      ],
    }),
    {
      initialState: gameState.state,
      initializedAt: createdAt,
      playerBindings: [
        {
          participantId: participantOneId,
          playerId: playerOneId,
        },
        {
          participantId: participantTwoId,
          playerId: playerTwoId,
        },
      ],
    },
  )

  const startedRoomResult = startInitializedRoom({
    room: initializedRoom,
    roomId,
    participantOneId,
    participantTwoId,
    playerOneId,
    playerTwoId,
    idFactory: services.idFactory,
    recordedAt: createdAt,
  })

  if (!startedRoomResult.ok) {
    return createDeckToMatchRoomError(
      'bootstrap-failed',
      startedRoomResult.message,
    )
  }

  const persisted = await services.roomSessions.createPersistedRoom({
    room: startedRoomResult.room,
    history: startedRoomResult.history,
    recordedAt: createdAt,
  })

  if (!persisted.ok) {
    return createDeckToMatchRoomError(
      'room-persist-failed',
      persisted.error.message,
    )
  }

  return {
    ok: true,
    data: {
      roomId,
      ownerProfileId: ownerProfileResult.data.id,
      opponentProfileId: opponentResult.data.id,
      deckId: deck.id,
    },
  }
}

export async function createTwoDeckMatchRoomUseCase(
  services: CreateTwoDeckMatchRoomServices,
  command: CreateTwoDeckMatchRoomCommand,
): Promise<
  DeckToMatchRoomResult<{
    readonly roomId: MatchRoomId
    readonly requesterProfileId: string
    readonly inviteeProfileId: string
    readonly requesterDeckId: string
    readonly inviteeDeckId: string
  }>
> {
  const authProfileResult =
    await services.profilesRepository.getProfileByAuthUserId(command.authUserId)

  if (!authProfileResult.ok) {
    return repositoryFailed(authProfileResult.error.message)
  }

  if (!authProfileResult.data) {
    return createDeckToMatchRoomError(
      'profile-required',
      'Create your profile before starting a multiplayer match room.',
    )
  }

  if (
    authProfileResult.data.id !== command.requesterProfileId &&
    authProfileResult.data.id !== command.inviteeProfileId
  ) {
    return createDeckToMatchRoomError(
      'room-access-denied',
      'Only invited lobby participants can start this match room.',
    )
  }

  if (command.requesterProfileId === command.inviteeProfileId) {
    return createDeckToMatchRoomError(
      'self-opponent',
      'A match lobby needs two different player profiles.',
    )
  }

  const requesterProfileResult =
    await services.profilesRepository.getProfileById(command.requesterProfileId)
  const inviteeProfileResult = await services.profilesRepository.getProfileById(
    command.inviteeProfileId,
  )

  if (!requesterProfileResult.ok) {
    return repositoryFailed(requesterProfileResult.error.message)
  }

  if (!inviteeProfileResult.ok) {
    return repositoryFailed(inviteeProfileResult.error.message)
  }

  if (!requesterProfileResult.data || !inviteeProfileResult.data) {
    return createDeckToMatchRoomError(
      'opponent-unavailable',
      'Both lobby participants need existing app profiles before match start.',
    )
  }

  const requesterDeckResult = await loadOwnedStandardDeckForMatch({
    services,
    deckId: command.requesterDeckId,
    ownerProfileId: command.requesterProfileId,
    label: 'requester',
  })

  if (!requesterDeckResult.ok) {
    return requesterDeckResult
  }

  const inviteeDeckResult = await loadOwnedStandardDeckForMatch({
    services,
    deckId: command.inviteeDeckId,
    ownerProfileId: command.inviteeProfileId,
    label: 'invitee',
  })

  if (!inviteeDeckResult.ok) {
    return inviteeDeckResult
  }

  const roomId = services.idFactory.createRoomId()
  const participantOneId = services.idFactory.createParticipantId({
    roomId,
    seat: 0,
  })
  const participantTwoId = services.idFactory.createParticipantId({
    roomId,
    seat: 1,
  })
  const playerOneId = services.idFactory.createPlayerId({ roomId, seat: 0 })
  const playerTwoId = services.idFactory.createPlayerId({ roomId, seat: 1 })
  const createdAt = services.now()
  const gameState = createDeckBackedGameState({
    gameId: `game:${roomId}` as GameState['gameId'],
    formatId: STANDARD_FORMAT_ID,
    startingPlayerId: playerOneId,
    players: [
      {
        playerId: playerOneId,
        seat: 0,
        deckSnapshot:
          requesterDeckResult.data.domainDeck.currentVersion.snapshot,
        cardDefinitions: requesterDeckResult.data.cardDefinitions,
        validation: requesterDeckResult.data.validation,
      },
      {
        playerId: playerTwoId,
        seat: 1,
        deckSnapshot: inviteeDeckResult.data.domainDeck.currentVersion.snapshot,
        cardDefinitions: inviteeDeckResult.data.cardDefinitions,
        validation: inviteeDeckResult.data.validation,
      },
    ],
  })

  if (!gameState.ok) {
    return createDeckToMatchRoomError('bootstrap-failed', gameState.message)
  }

  const initializedRoom = initializeMatchRoom(
    createMatchRoom({
      roomId,
      formatId: STANDARD_FORMAT_ID,
      engineAdapterId: MATCH_ROOM_STANDARD_ENGINE_ADAPTER_ID,
      hostParticipantId: participantOneId,
      createdAt,
      participants: [
        {
          participantId: participantOneId,
          seat: 0,
          userId: requesterProfileResult.data.id as UserId,
          displayName: requesterProfileResult.data.displayName,
          submittedDeckId: requesterDeckResult.data.deck.id as DeckId,
        },
        {
          participantId: participantTwoId,
          seat: 1,
          userId: inviteeProfileResult.data.id as UserId,
          displayName: inviteeProfileResult.data.displayName,
          submittedDeckId: inviteeDeckResult.data.deck.id as DeckId,
        },
      ],
    }),
    {
      initialState: gameState.state,
      initializedAt: createdAt,
      playerBindings: [
        {
          participantId: participantOneId,
          playerId: playerOneId,
        },
        {
          participantId: participantTwoId,
          playerId: playerTwoId,
        },
      ],
    },
  )

  const startedRoomResult = startInitializedRoom({
    room: initializedRoom,
    roomId,
    participantOneId,
    participantTwoId,
    playerOneId,
    playerTwoId,
    idFactory: services.idFactory,
    recordedAt: createdAt,
  })

  if (!startedRoomResult.ok) {
    return createDeckToMatchRoomError(
      'bootstrap-failed',
      startedRoomResult.message,
    )
  }

  const persisted = await services.roomSessions.createPersistedRoom({
    room: startedRoomResult.room,
    history: startedRoomResult.history,
    recordedAt: createdAt,
  })

  if (!persisted.ok) {
    return createDeckToMatchRoomError(
      'room-persist-failed',
      persisted.error.message,
    )
  }

  return {
    ok: true,
    data: {
      roomId,
      requesterProfileId: requesterProfileResult.data.id,
      inviteeProfileId: inviteeProfileResult.data.id,
      requesterDeckId: requesterDeckResult.data.deck.id,
      inviteeDeckId: inviteeDeckResult.data.deck.id,
    },
  }
}

interface MatchRuntimeDeckInput {
  readonly deck: DeckDetailRecord
  readonly domainDeck: ReturnType<typeof createDomainDeckFromDetail>
  readonly cardDefinitions: readonly GameplayCard[]
  readonly validation: MatchDeckValidationProof
}

async function loadOwnedStandardDeckForMatch(input: {
  readonly services:
    | CreateDeckToMatchRoomServices
    | CreateTwoDeckMatchRoomServices
  readonly deckId: string
  readonly ownerProfileId: string
  readonly label: string
}): Promise<DeckToMatchRoomResult<MatchRuntimeDeckInput>> {
  const deckResult = await input.services.decksRepository.getDeckDetailById(
    input.deckId,
  )

  if (!deckResult.ok) {
    return repositoryFailed(deckResult.error.message)
  }

  const deck = deckResult.data

  if (
    !deck ||
    deck.ownerProfileId !== input.ownerProfileId ||
    !deck.currentVersion
  ) {
    return createDeckToMatchRoomError(
      'deck-unavailable',
      `Choose one saved Standard deck owned by the ${input.label} profile before starting.`,
    )
  }

  if (deck.format.id !== STANDARD_FORMAT_ID) {
    return createDeckToMatchRoomError(
      'unsupported-format',
      'Only Standard decks can start a Pre-Phase 21 gameplay room.',
    )
  }

  const catalogCardsResult = await loadCatalogCardsForDeck(
    input.services.catalogRepository,
    deck,
  )

  if (!catalogCardsResult.ok) {
    return catalogCardsResult
  }

  const validation = await input.services.validationService.validateDeck({
    deck,
    catalogCards: catalogCardsResult.data,
  })

  if (!validation.isValid || validation.errorCount > 0) {
    return createDeckToMatchRoomError(
      'deck-invalid',
      `Deck validation must pass before match room creation. ${validation.errorCount} error(s) reported by ${validation.source}.`,
    )
  }

  return {
    ok: true,
    data: {
      deck,
      domainDeck: createDomainDeckFromDetail(deck),
      cardDefinitions: catalogCardsResult.data.map(mapCatalogCardToGameplay),
      validation,
    },
  }
}

function createDeckToMatchRoomError(
  code: DeckToMatchRoomErrorCode,
  message: string,
): DeckToMatchRoomResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  }
}

function repositoryFailed(message: string): DeckToMatchRoomResult<never> {
  return createDeckToMatchRoomError('repository-failed', message)
}

async function loadCatalogCardsForDeck(
  repository: DeckToMatchRoomCatalogRepository,
  deck: DeckDetailRecord,
): Promise<DeckToMatchRoomResult<readonly CatalogCardEntityRecord[]>> {
  const currentVersion = deck.currentVersion

  if (!currentVersion) {
    return createDeckToMatchRoomError(
      'deck-unavailable',
      'The selected deck has no current version to bootstrap.',
    )
  }

  const cardIds = Array.from(
    new Set(currentVersion.cards.map((card) => card.cardEntityId)),
  ).sort((left, right) => left.localeCompare(right))
  const cards: CatalogCardEntityRecord[] = []

  for (const cardId of cardIds) {
    const result = await repository.getCardEntityById(cardId)

    if (!result.ok) {
      return createDeckToMatchRoomError(
        'catalog-unavailable',
        result.error.message,
      )
    }

    if (!result.data) {
      return createDeckToMatchRoomError(
        'catalog-unavailable',
        `Deck card ${cardId} is not available in the published catalog.`,
      )
    }

    cards.push(result.data)
  }

  return {
    ok: true,
    data: cards,
  }
}

function createDomainDeckFromDetail(deck: DeckDetailRecord) {
  const currentVersion = deck.currentVersion

  if (!currentVersion) {
    throw new Error('Deck detail must include a current version.')
  }

  return createDeck({
    id: deck.id as DeckId,
    ownerId: deck.ownerProfileId as UserId,
    formatId: deck.format.id as FormatId,
    name: deck.title,
    description: deck.description,
    tags: deck.tags,
    isFavorite: deck.isFavorite,
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
    currentVersionId: currentVersion.id as DeckVersionId,
    revision: currentVersion.versionNumber,
    cards: currentVersion.cards.map((card) => ({
      section: card.sectionKey as DeckSection,
      cardEntityId: card.cardEntityId as CardId,
      quantity: card.quantity,
    })),
  })
}

function startInitializedRoom(input: {
  readonly room: ReturnType<typeof initializeMatchRoom>
  readonly roomId: MatchRoomId
  readonly participantOneId: MatchRoomParticipantId
  readonly participantTwoId: MatchRoomParticipantId
  readonly playerOneId: PlayerId
  readonly playerTwoId: PlayerId
  readonly idFactory: DeckToMatchRoomIdFactory
  readonly recordedAt: string
}):
  | {
      readonly ok: true
      readonly room: MatchRoomWithEngineState
      readonly history: readonly MatchRoomHistoryEntry[]
    }
  | {
      readonly ok: false
      readonly message: string
    } {
  let room: MatchRoomWithEngineState = input.room
  let history: readonly MatchRoomHistoryEntry[] = []

  const readyOne = submitMatchRoomCommand(
    room,
    {
      source: {
        kind: 'participant',
        participantId: input.participantOneId,
      },
      command: {
        kind: 'action',
        submission: {
          action: {
            actionId: input.idFactory.createActionId({
              roomId: input.roomId,
              label: 'ready-player-one',
              revision: room.engineState.revision,
            }),
            type: 'match.ready',
            actor: {
              kind: 'player',
              playerId: input.playerOneId,
            },
          },
          expectedRevision: room.engineState.revision,
        },
      },
    },
    {
      submittedAt: input.recordedAt,
    },
  )

  if (readyOne.status !== 'accepted') {
    return {
      ok: false,
      message: readyOne.message,
    }
  }

  room = readyOne.room
  history = appendAcceptedMatchRoomCommandToHistory({
    history,
    result: readyOne,
    recordedAt: input.recordedAt,
  })

  const readyTwo = submitMatchRoomCommand(
    room,
    {
      source: {
        kind: 'participant',
        participantId: input.participantTwoId,
      },
      command: {
        kind: 'action',
        submission: {
          action: {
            actionId: input.idFactory.createActionId({
              roomId: input.roomId,
              label: 'ready-player-two',
              revision: room.engineState.revision,
            }),
            type: 'match.ready',
            actor: {
              kind: 'player',
              playerId: input.playerTwoId,
            },
          },
          expectedRevision: room.engineState.revision,
        },
      },
    },
    {
      submittedAt: input.recordedAt,
    },
  )

  if (readyTwo.status !== 'accepted') {
    return {
      ok: false,
      message: readyTwo.message,
    }
  }

  room = readyTwo.room
  history = appendAcceptedMatchRoomCommandToHistory({
    history,
    result: readyTwo,
    recordedAt: input.recordedAt,
  })

  const start = submitMatchRoomCommand(
    room,
    {
      source: {
        kind: 'system',
        source: 'deck-to-match-product-flow',
      },
      command: {
        kind: 'action',
        submission: {
          action: {
            actionId: input.idFactory.createActionId({
              roomId: input.roomId,
              label: 'start-match',
              revision: room.engineState.revision,
            }),
            type: 'match.start',
            actor: {
              kind: 'system',
              system: 'match-setup',
            },
          },
          expectedRevision: room.engineState.revision,
        },
      },
    },
    {
      submittedAt: input.recordedAt,
    },
  )

  if (start.status !== 'accepted') {
    return {
      ok: false,
      message: start.message,
    }
  }

  return {
    ok: true,
    room: start.room,
    history: appendAcceptedMatchRoomCommandToHistory({
      history,
      result: start,
      recordedAt: input.recordedAt,
    }),
  }
}

function mapCatalogCardToGameplay(card: CatalogCardEntityRecord): GameplayCard {
  return {
    cardId: card.id as CardId,
    name: card.name,
    cardType: card.cardType as CardType,
    grade: card.grade as Grade,
    nation: card.nation as Nation,
    ...(card.clan === null ? {} : { clan: card.clan as Clan }),
    ...(card.triggerType === null
      ? {}
      : { triggerType: card.triggerType as TriggerType }),
    power: card.basePower ?? defaultPowerForGrade(card.grade),
    critical: card.baseCritical ?? 1,
    shield: card.baseShield ?? defaultShieldForCard(card.cardType, card.grade),
    keywords: card.keywords.map((keyword) => keyword as Keyword),
    effectRefs: card.effectRefs.map((key) => ({
      id: key as EffectRefId,
      sourceCardId: card.id as CardId,
      source: 'printed',
      key,
    })),
  }
}

function defaultPowerForGrade(grade: number): number {
  if (grade <= 0) {
    return 6000
  }

  if (grade === 1) {
    return 8000
  }

  if (grade === 2) {
    return 10000
  }

  return 13000
}

function defaultShieldForCard(cardType: string, grade: number): number {
  if (cardType === 'trigger-unit') {
    return 15000
  }

  return grade >= 3 ? 0 : 5000
}

function createStandardSparringDeck(roomId: MatchRoomId) {
  const deckId = `standard-sparring:${roomId}` as DeckId
  const cardIds = {
    ride0: `${deckId}:ride-0` as CardId,
    ride1: `${deckId}:ride-1` as CardId,
    ride2: `${deckId}:ride-2` as CardId,
    ride3: `${deckId}:ride-3` as CardId,
    mainG1: `${deckId}:main-g1` as CardId,
    mainG2: `${deckId}:main-g2` as CardId,
    mainG3: `${deckId}:main-g3` as CardId,
    triggerCritical: `${deckId}:trigger-critical` as CardId,
    triggerDraw: `${deckId}:trigger-draw` as CardId,
    triggerFront: `${deckId}:trigger-front` as CardId,
    triggerHeal: `${deckId}:trigger-heal` as CardId,
  }
  const cardDefinitions: readonly GameplayCard[] = [
    sparringCard(cardIds.ride0, 'Sparring Grade 0', 0, 6000, 5000),
    sparringCard(cardIds.ride1, 'Sparring Grade 1', 1, 8000, 5000),
    sparringCard(cardIds.ride2, 'Sparring Grade 2', 2, 10000, 5000),
    sparringCard(cardIds.ride3, 'Sparring Grade 3', 3, 13000, 0),
    sparringCard(cardIds.mainG1, 'Sparring Main Grade 1', 1, 8000, 5000),
    sparringCard(cardIds.mainG2, 'Sparring Main Grade 2', 2, 10000, 5000),
    sparringCard(cardIds.mainG3, 'Sparring Main Grade 3', 3, 13000, 0),
    sparringCard(
      cardIds.triggerCritical,
      'Sparring Critical Trigger',
      0,
      5000,
      15000,
      {
        cardType: 'trigger-unit',
        triggerType: 'critical',
      },
    ),
    sparringCard(cardIds.triggerDraw, 'Sparring Draw Trigger', 0, 5000, 5000, {
      cardType: 'trigger-unit',
      triggerType: 'draw',
    }),
    sparringCard(
      cardIds.triggerFront,
      'Sparring Front Trigger',
      0,
      5000,
      15000,
      {
        cardType: 'trigger-unit',
        triggerType: 'front',
      },
    ),
    sparringCard(cardIds.triggerHeal, 'Sparring Heal Trigger', 0, 5000, 15000, {
      cardType: 'trigger-unit',
      triggerType: 'heal',
    }),
  ]

  return {
    deck: createDeck({
      id: deckId,
      ownerId: 'system-standard-sparring' as UserId,
      formatId: STANDARD_FORMAT_ID,
      name: 'Standard sparring deck',
      createdAt: '2026-06-18T00:00:00.000Z',
      currentVersionId: `${deckId}:version:1` as DeckVersionId,
      revision: 1,
      cards: [
        deckCard('ride', cardIds.ride0, 1),
        deckCard('ride', cardIds.ride1, 1),
        deckCard('ride', cardIds.ride2, 1),
        deckCard('ride', cardIds.ride3, 1),
        deckCard('main', cardIds.mainG1, 14),
        deckCard('main', cardIds.mainG2, 12),
        deckCard('main', cardIds.mainG3, 8),
        deckCard('main', cardIds.triggerCritical, 4),
        deckCard('main', cardIds.triggerDraw, 4),
        deckCard('main', cardIds.triggerFront, 4),
        deckCard('main', cardIds.triggerHeal, 4),
      ],
    }),
    cardDefinitions,
    validation: {
      isValid: true,
      source: 'server-standard-sparring-fixture',
      errorCount: 0,
      issueCodes: [],
    } satisfies MatchDeckValidationProof,
  }
}

function deckCard(
  section: DeckSection,
  cardEntityId: CardId,
  quantity: number,
) {
  return {
    section,
    cardEntityId,
    quantity,
  }
}

function sparringCard(
  cardId: CardId,
  name: string,
  grade: Grade,
  power: number,
  shield: number,
  options: {
    readonly cardType?: CardType
    readonly triggerType?: TriggerType
  } = {},
): GameplayCard {
  return {
    cardId,
    name,
    cardType: options.cardType ?? 'normal-unit',
    grade,
    nation: 'keter-sanctuary' as Nation,
    ...(options.triggerType === undefined
      ? {}
      : { triggerType: options.triggerType }),
    power,
    critical: 1,
    shield,
    keywords: [],
    effectRefs: [],
  }
}
