import {
  STANDARD_FORMAT_ID,
  resolveGamePieceCardStats,
  resolveNextTurnPhase,
  type ActionId,
  type GameChoiceRequest,
  type GameId,
  type GameState,
  type PlayerId,
  type ZoneId,
} from '@web-vg/rules-core'
import { createDeck, type Deck, type DeckVersionId } from '@web-vg/decks'
import {
  validateDeck,
  type DeckValidationCardFacts,
} from '@web-vg/deck-validation'
import {
  createDeckBackedGameState,
  createMatchRoom,
  initializeMatchRoom,
  type InitializedMatchRoom,
  type MatchDeckValidationProof,
  type MatchRoomCommandSubmission,
  type MatchRoomId,
  type MatchRoomParticipantId,
} from '@web-vg/match-session'
import type {
  CardId,
  DeckId,
  DeckSection,
  GameplayCard,
  UserId,
} from '@web-vg/shared'

export const LOCAL_MATCH_PLAYER_ONE_ID = 'local-engine-player-1' as PlayerId
export const LOCAL_MATCH_PLAYER_TWO_ID = 'local-engine-player-2' as PlayerId
export const LOCAL_MATCH_PARTICIPANT_ONE_ID =
  'local-participant-1' as MatchRoomParticipantId
export const LOCAL_MATCH_PARTICIPANT_TWO_ID =
  'local-participant-2' as MatchRoomParticipantId

const LOCAL_MATCH_USER_ONE_ID = 'local-user-1' as UserId
const LOCAL_MATCH_USER_TWO_ID = 'local-user-2' as UserId
const LOCAL_MATCH_PLAYER_ONE_DECK_ID = 'local-demo-deck-aichi' as DeckId
const LOCAL_MATCH_PLAYER_TWO_DECK_ID = 'local-demo-deck-kai' as DeckId

export function createLocalPrototypeMatchRoom(
  roomId: string,
): InitializedMatchRoom {
  const normalizedRoomId = normalizeRoomId(roomId)
  const createdRoom = createMatchRoom({
    roomId: normalizedRoomId,
    formatId: STANDARD_FORMAT_ID,
    hostParticipantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
    createdAt: '2026-05-07T00:00:00.000Z',
    participants: [
      {
        participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
        seat: 0,
        userId: LOCAL_MATCH_USER_ONE_ID,
        displayName: 'Aichi Sendou',
        submittedDeckId: LOCAL_MATCH_PLAYER_ONE_DECK_ID,
      },
      {
        participantId: LOCAL_MATCH_PARTICIPANT_TWO_ID,
        seat: 1,
        userId: LOCAL_MATCH_USER_TWO_ID,
        displayName: 'Toshiki Kai',
        submittedDeckId: LOCAL_MATCH_PLAYER_TWO_DECK_ID,
      },
    ],
  })

  return initializeMatchRoom(createdRoom, {
    initialState: createInitialLocalGameState(normalizedRoomId),
    initializedAt: '2026-05-07T00:00:01.000Z',
    playerBindings: [
      {
        participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
        playerId: LOCAL_MATCH_PLAYER_ONE_ID,
      },
      {
        participantId: LOCAL_MATCH_PARTICIPANT_TWO_ID,
        playerId: LOCAL_MATCH_PLAYER_TWO_ID,
      },
    ],
  })
}

export function createReadyCommand(
  playerId: PlayerId,
  actionId: ActionId,
): MatchRoomCommandSubmission {
  return {
    source: {
      kind: 'participant',
      participantId: getParticipantIdForPlayer(playerId),
    },
    command: {
      kind: 'action',
      submission: {
        action: {
          actionId,
          type: 'match.ready',
          actor: {
            kind: 'player',
            playerId,
          },
        },
      },
    },
  }
}

export function createStartMatchCommand(
  actionId: ActionId,
  expectedRevision: number,
): MatchRoomCommandSubmission {
  return {
    source: {
      kind: 'system',
      source: 'local-session',
    },
    command: {
      kind: 'action',
      submission: {
        action: {
          actionId,
          type: 'match.start',
          actor: {
            kind: 'system',
            system: 'match-setup',
          },
        },
        expectedRevision,
      },
    },
  }
}

export function createBeginMulliganCommand(
  playerId: PlayerId,
  actionId: ActionId,
  expectedRevision: number,
): MatchRoomCommandSubmission {
  return {
    source: {
      kind: 'system',
      source: 'local-session',
    },
    command: {
      kind: 'action',
      submission: {
        action: {
          actionId,
          type: 'system.begin_mulligan',
          actor: {
            kind: 'system',
            system: 'match-setup',
          },
          playerId,
          handZoneId: getHandZoneId(playerId),
          deckZoneId: getDeckZoneId(playerId),
        },
        expectedRevision,
      },
    },
  }
}

export function createAdvancePhaseCommand(
  actionId: ActionId,
  expectedRevision: number,
  currentPhase: GameState['turn']['phase'],
): MatchRoomCommandSubmission {
  const nextPhase = resolveNextTurnPhase(currentPhase) ?? currentPhase

  return {
    source: {
      kind: 'system',
      source: 'local-session',
    },
    command: {
      kind: 'action',
      submission: {
        action: {
          actionId,
          type: 'system.advance_phase',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          nextPhase,
        },
        expectedRevision,
      },
    },
  }
}

export function createEndTurnCommand(
  playerId: PlayerId,
  actionId: ActionId,
  expectedRevision: number,
): MatchRoomCommandSubmission {
  return {
    source: {
      kind: 'participant',
      participantId: getParticipantIdForPlayer(playerId),
    },
    command: {
      kind: 'action',
      submission: {
        action: {
          actionId,
          type: 'turn.end_turn',
          actor: {
            kind: 'player',
            playerId,
          },
        },
        expectedRevision,
      },
    },
  }
}

export function createRideFirstRideDeckCardCommand(
  playerId: PlayerId,
  actionId: ActionId,
  expectedRevision: number,
  engineState: GameState,
): MatchRoomCommandSubmission | null {
  const rideDeckZone = findOwnedZoneByKind(engineState, playerId, 'ride_deck')
  const vanguardZone = findOwnedZoneByKind(
    engineState,
    playerId,
    'vanguard_circle',
  )
  const ridingPieceId = rideDeckZone?.occupants[0]?.pieceId

  if (
    rideDeckZone === undefined ||
    vanguardZone === undefined ||
    ridingPieceId === undefined
  ) {
    return null
  }

  return {
    source: {
      kind: 'participant',
      participantId: getParticipantIdForPlayer(playerId),
    },
    command: {
      kind: 'action',
      submission: {
        action: {
          actionId,
          type: 'card.ride',
          actor: {
            kind: 'player',
            playerId,
          },
          pieceId: ridingPieceId,
          from: {
            zoneId: rideDeckZone.zoneId,
          },
          to: {
            zoneId: vanguardZone.zoneId,
          },
          ...(vanguardZone.occupants[0]?.pieceId === undefined
            ? {}
            : {
                ridingOverPieceId: vanguardZone.occupants[0].pieceId,
              }),
        },
        expectedRevision,
      },
    },
  }
}

export function createCallFirstHandCardCommand(
  playerId: PlayerId,
  actionId: ActionId,
  expectedRevision: number,
  engineState: GameState,
): MatchRoomCommandSubmission | null {
  const handZone = findOwnedZoneByKind(engineState, playerId, 'hand')
  const rearGuardZone = findOwnedZoneByKind(
    engineState,
    playerId,
    'rear_guard_circle',
  )
  const vanguardZone = findOwnedZoneByKind(
    engineState,
    playerId,
    'vanguard_circle',
  )
  const currentVanguardGrade =
    vanguardZone?.occupants[0]?.pieceId === undefined
      ? undefined
      : resolvePieceGrade(engineState, vanguardZone.occupants[0].pieceId)
  const firstHandPieceId = handZone?.occupants[0]?.pieceId
  const gradeLegalPieceId =
    currentVanguardGrade === undefined
      ? undefined
      : handZone?.occupants.find((occupant) => {
          const pieceGrade = resolvePieceGrade(engineState, occupant.pieceId)

          return pieceGrade !== undefined && pieceGrade <= currentVanguardGrade
        })?.pieceId
  const callingPieceId = gradeLegalPieceId ?? firstHandPieceId
  const targetSlotId = rearGuardZone?.layout.slotIds?.find(
    (slotId) =>
      !rearGuardZone.occupants.some((occupant) => occupant.slotId === slotId),
  )

  if (
    handZone === undefined ||
    rearGuardZone === undefined ||
    callingPieceId === undefined ||
    targetSlotId === undefined
  ) {
    return null
  }

  return {
    source: {
      kind: 'participant',
      participantId: getParticipantIdForPlayer(playerId),
    },
    command: {
      kind: 'action',
      submission: {
        action: {
          actionId,
          type: 'card.call',
          actor: {
            kind: 'player',
            playerId,
          },
          pieceId: callingPieceId,
          from: {
            zoneId: handZone.zoneId,
          },
          to: {
            zoneId: rearGuardZone.zoneId,
            slotId: targetSlotId,
          },
        },
        expectedRevision,
      },
    },
  }
}

export function createConcedeCommand(
  playerId: PlayerId,
  actionId: ActionId,
  expectedRevision: number,
): MatchRoomCommandSubmission {
  return {
    source: {
      kind: 'participant',
      participantId: getParticipantIdForPlayer(playerId),
    },
    command: {
      kind: 'action',
      submission: {
        action: {
          actionId,
          type: 'match.concede',
          actor: {
            kind: 'player',
            playerId,
          },
        },
        expectedRevision,
      },
    },
  }
}

export function createKeepHandChoiceCommand(
  request: Extract<
    GameChoiceRequest,
    { readonly type: 'mulligan.select_cards' }
  >,
  actionId: ActionId,
  expectedRevision: number,
): MatchRoomCommandSubmission {
  return {
    source: {
      kind: 'participant',
      participantId: getParticipantIdForPlayer(request.responderPlayerId),
    },
    command: {
      kind: 'choice_response',
      submission: {
        response: {
          requestId: request.requestId,
          responderPlayerId: request.responderPlayerId,
          type: 'answer.mulligan',
          returnedPieceIds: [],
          shuffledDeckPieceIds: request.currentDeckPieceIds,
        },
        expectedRevision,
      },
    },
  }
}

export function createMulliganFirstCardChoiceCommand(
  request: Extract<
    GameChoiceRequest,
    { readonly type: 'mulligan.select_cards' }
  >,
  actionId: ActionId,
  expectedRevision: number,
): MatchRoomCommandSubmission | null {
  const returnedPieceId = request.eligiblePieceIds[0]

  if (returnedPieceId === undefined) {
    return null
  }

  return {
    source: {
      kind: 'participant',
      participantId: getParticipantIdForPlayer(request.responderPlayerId),
    },
    command: {
      kind: 'choice_response',
      submission: {
        response: {
          requestId: request.requestId,
          responderPlayerId: request.responderPlayerId,
          type: 'answer.mulligan',
          returnedPieceIds: [returnedPieceId],
          shuffledDeckPieceIds: [
            ...request.currentDeckPieceIds,
            returnedPieceId,
          ],
        },
        expectedRevision,
      },
    },
  }
}

export function createLocalActionId(
  roomRevision: number,
  sequence: number,
  label: string,
): ActionId {
  return `local-action:${label}:room-r${roomRevision}:s${sequence}` as ActionId
}

function createInitialLocalGameState(roomId: MatchRoomId): GameState {
  const playerOneDeck = createLocalPrototypeDeck(
    LOCAL_MATCH_PLAYER_ONE_DECK_ID,
    LOCAL_MATCH_USER_ONE_ID,
  )
  const playerTwoDeck = createLocalPrototypeDeck(
    LOCAL_MATCH_PLAYER_TWO_DECK_ID,
    LOCAL_MATCH_USER_TWO_ID,
  )
  const bootstrapResult = createDeckBackedGameState({
    gameId: `game:${roomId}` as GameId,
    formatId: STANDARD_FORMAT_ID,
    startingPlayerId: LOCAL_MATCH_PLAYER_ONE_ID,
    players: [
      {
        playerId: LOCAL_MATCH_PLAYER_ONE_ID,
        seat: 0,
        runtimeKey: 'p1',
        deckSnapshot: playerOneDeck.currentVersion.snapshot,
        cardDefinitions: LOCAL_PROTOTYPE_GAMEPLAY_CARDS,
        validation: createLocalDeckValidationProof(playerOneDeck),
      },
      {
        playerId: LOCAL_MATCH_PLAYER_TWO_ID,
        seat: 1,
        runtimeKey: 'p2',
        deckSnapshot: playerTwoDeck.currentVersion.snapshot,
        cardDefinitions: LOCAL_PROTOTYPE_GAMEPLAY_CARDS,
        validation: createLocalDeckValidationProof(playerTwoDeck),
      },
    ],
  })

  if (!bootstrapResult.ok) {
    throw new Error(
      `Local prototype deck bootstrap failed: ${bootstrapResult.message}`,
    )
  }

  return bootstrapResult.state
}

const LOCAL_CARD_IDS = {
  ride0: 'local-catalog:keter:starting-sage' as CardId,
  ride1: 'local-catalog:keter:wayward-boost' as CardId,
  ride2: 'local-catalog:keter:skyfall-knight' as CardId,
  ride3: 'local-catalog:keter:apex-ruler' as CardId,
  mainG1A: 'local-catalog:keter:main-g1-a' as CardId,
  mainG1B: 'local-catalog:keter:main-g1-b' as CardId,
  mainG1C: 'local-catalog:keter:main-g1-c' as CardId,
  mainG2A: 'local-catalog:keter:main-g2-a' as CardId,
  mainG2B: 'local-catalog:keter:main-g2-b' as CardId,
  mainG2C: 'local-catalog:keter:main-g2-c' as CardId,
  mainG3A: 'local-catalog:keter:main-g3-a' as CardId,
  mainG3B: 'local-catalog:keter:main-g3-b' as CardId,
  mainG3C: 'local-catalog:keter:main-g3-c' as CardId,
  triggerCritical: 'local-catalog:keter:trigger-critical' as CardId,
  triggerDraw: 'local-catalog:keter:trigger-draw' as CardId,
  triggerFront: 'local-catalog:keter:trigger-front' as CardId,
  triggerHeal: 'local-catalog:keter:trigger-heal' as CardId,
} as const

const LOCAL_PROTOTYPE_MAIN_DECK = [
  deckCard('main', LOCAL_CARD_IDS.mainG1A, 4),
  deckCard('main', LOCAL_CARD_IDS.mainG1B, 4),
  deckCard('main', LOCAL_CARD_IDS.mainG1C, 4),
  deckCard('main', LOCAL_CARD_IDS.mainG2A, 4),
  deckCard('main', LOCAL_CARD_IDS.mainG2B, 4),
  deckCard('main', LOCAL_CARD_IDS.mainG2C, 4),
  deckCard('main', LOCAL_CARD_IDS.mainG3A, 4),
  deckCard('main', LOCAL_CARD_IDS.mainG3B, 4),
  deckCard('main', LOCAL_CARD_IDS.mainG3C, 2),
  deckCard('main', LOCAL_CARD_IDS.triggerCritical, 4),
  deckCard('main', LOCAL_CARD_IDS.triggerDraw, 4),
  deckCard('main', LOCAL_CARD_IDS.triggerFront, 4),
  deckCard('main', LOCAL_CARD_IDS.triggerHeal, 4),
] as const

const LOCAL_PROTOTYPE_RIDE_DECK = [
  deckCard('ride', LOCAL_CARD_IDS.ride0, 1),
  deckCard('ride', LOCAL_CARD_IDS.ride1, 1),
  deckCard('ride', LOCAL_CARD_IDS.ride2, 1),
  deckCard('ride', LOCAL_CARD_IDS.ride3, 1),
] as const

const LOCAL_PROTOTYPE_GAMEPLAY_CARDS: readonly GameplayCard[] = [
  gameplayCard(
    LOCAL_CARD_IDS.ride0,
    'Starting Sage, Local Seed',
    0,
    6000,
    5000,
  ),
  gameplayCard(
    LOCAL_CARD_IDS.ride1,
    'Wayward Boost, Local Seed',
    1,
    8000,
    5000,
  ),
  gameplayCard(
    LOCAL_CARD_IDS.ride2,
    'Skyfall Knight, Local Seed',
    2,
    10000,
    5000,
  ),
  gameplayCard(LOCAL_CARD_IDS.ride3, 'Apex Ruler, Local Seed', 3, 13000, 0),
  gameplayCard(LOCAL_CARD_IDS.mainG1A, 'Keter Main Grade 1 A', 1, 8000, 5000),
  gameplayCard(LOCAL_CARD_IDS.mainG1B, 'Keter Main Grade 1 B', 1, 8000, 5000),
  gameplayCard(LOCAL_CARD_IDS.mainG1C, 'Keter Main Grade 1 C', 1, 8000, 5000),
  gameplayCard(LOCAL_CARD_IDS.mainG2A, 'Keter Main Grade 2 A', 2, 10000, 5000),
  gameplayCard(LOCAL_CARD_IDS.mainG2B, 'Keter Main Grade 2 B', 2, 10000, 5000),
  gameplayCard(LOCAL_CARD_IDS.mainG2C, 'Keter Main Grade 2 C', 2, 10000, 5000),
  gameplayCard(LOCAL_CARD_IDS.mainG3A, 'Keter Main Grade 3 A', 3, 13000, 0),
  gameplayCard(LOCAL_CARD_IDS.mainG3B, 'Keter Main Grade 3 B', 3, 13000, 0),
  gameplayCard(LOCAL_CARD_IDS.mainG3C, 'Keter Main Grade 3 C', 3, 13000, 0),
  gameplayCard(
    LOCAL_CARD_IDS.triggerCritical,
    'Keter Critical Trigger',
    0,
    5000,
    15000,
    {
      cardType: 'trigger-unit',
      triggerType: 'critical',
    },
  ),
  gameplayCard(
    LOCAL_CARD_IDS.triggerDraw,
    'Keter Draw Trigger',
    0,
    5000,
    5000,
    {
      cardType: 'trigger-unit',
      triggerType: 'draw',
    },
  ),
  gameplayCard(
    LOCAL_CARD_IDS.triggerFront,
    'Keter Front Trigger',
    0,
    5000,
    15000,
    {
      cardType: 'trigger-unit',
      triggerType: 'front',
    },
  ),
  gameplayCard(
    LOCAL_CARD_IDS.triggerHeal,
    'Keter Heal Trigger',
    0,
    5000,
    15000,
    {
      cardType: 'trigger-unit',
      triggerType: 'heal',
    },
  ),
]

function createLocalPrototypeDeck(deckId: DeckId, ownerId: UserId): Deck {
  return createDeck({
    id: deckId,
    ownerId,
    formatId: STANDARD_FORMAT_ID,
    name: `Local prototype ${deckId}`,
    createdAt: '2026-05-07T00:00:00.000Z',
    currentVersionId: `${deckId}:version:1` as DeckVersionId,
    revision: 1,
    cards: [...LOCAL_PROTOTYPE_MAIN_DECK, ...LOCAL_PROTOTYPE_RIDE_DECK],
  })
}

function createLocalDeckValidationProof(deck: Deck): MatchDeckValidationProof {
  const result = validateDeck({
    deck,
    context: {
      cardFacts: createLocalCardFactsMap(),
    },
  })

  return {
    isValid: result.isValid,
    source: 'deck-validation',
    errorCount: result.summary.errorCount,
    issueCodes: result.issues.map((issue) => issue.code),
  }
}

function createLocalCardFactsMap(): ReadonlyMap<
  CardId,
  DeckValidationCardFacts
> {
  return new Map(
    LOCAL_PROTOTYPE_GAMEPLAY_CARDS.map((card) => [
      card.cardId,
      {
        grade: card.grade,
        cardType: card.cardType,
        nation: card.nation,
        clan: card.clan ?? null,
        legalInFormats: [STANDARD_FORMAT_ID],
        premiumGDeckEligible: false,
        triggerType: card.triggerType ?? null,
      },
    ]),
  )
}

function deckCard(
  section: DeckSection,
  cardEntityId: CardId,
  quantity: number,
): NonNullable<Parameters<typeof createDeck>[0]['cards']>[number] {
  return {
    section,
    cardEntityId,
    quantity,
  }
}

function gameplayCard(
  cardId: CardId,
  name: string,
  grade: GameplayCard['grade'],
  power: number,
  shield: number,
  options: {
    readonly cardType?: GameplayCard['cardType']
    readonly triggerType?: GameplayCard['triggerType']
  } = {},
): GameplayCard {
  return {
    cardId,
    name,
    cardType: options.cardType ?? 'normal-unit',
    grade,
    nation: 'keter-sanctuary' as GameplayCard['nation'],
    power,
    shield,
    critical: 1,
    ...(options.triggerType === undefined
      ? {}
      : {
          triggerType: options.triggerType,
        }),
    keywords: [],
    effectRefs: [],
  }
}

function normalizeRoomId(roomId: string): MatchRoomId {
  const trimmedRoomId = roomId.trim()

  return (
    trimmedRoomId.length > 0 ? trimmedRoomId : 'local-prototype'
  ) as MatchRoomId
}

function getParticipantIdForPlayer(playerId: PlayerId): MatchRoomParticipantId {
  return playerId === LOCAL_MATCH_PLAYER_TWO_ID
    ? LOCAL_MATCH_PARTICIPANT_TWO_ID
    : LOCAL_MATCH_PARTICIPANT_ONE_ID
}

function getHandZoneId(playerId: PlayerId): ZoneId {
  return playerId === LOCAL_MATCH_PLAYER_TWO_ID
    ? zoneId('p2', 'hand')
    : zoneId('p1', 'hand')
}

function getDeckZoneId(playerId: PlayerId): ZoneId {
  return playerId === LOCAL_MATCH_PLAYER_TWO_ID
    ? zoneId('p2', 'deck')
    : zoneId('p1', 'deck')
}

function findOwnedZoneByKind(
  engineState: GameState,
  playerId: PlayerId,
  kind: GameState['zones'][number]['kind'],
) {
  return engineState.zones.find(
    (zone) => zone.ownerPlayerId === playerId && zone.kind === kind,
  )
}

function resolvePieceGrade(
  engineState: GameState,
  pieceId: GameState['pieces'][number]['pieceId'],
): number | undefined {
  const piece = engineState.pieces.find(
    (candidate) => candidate.pieceId === pieceId,
  )

  if (piece === undefined) {
    return undefined
  }

  const stats = resolveGamePieceCardStats(engineState, piece)

  return stats.ok ? stats.stats.grade : undefined
}

function zoneId(prefix: 'p1' | 'p2', key: string): ZoneId {
  return `${prefix}:zone:${key}` as ZoneId
}
