import {
  STANDARD_FORMAT_ID,
  type ActionId,
  type GameChoiceRequest,
  type GameId,
  type GameState,
  type PieceId,
  type PlayerId,
  type ZoneId,
  type ZoneSlotId,
} from '@web-vg/rules-core'
import {
  createMatchRoom,
  initializeMatchRoom,
  type InitializedMatchRoom,
  type MatchRoomCommandSubmission,
  type MatchRoomId,
  type MatchRoomParticipantId,
} from '@web-vg/match-session'
import type { CardId, UserId } from '@web-vg/shared'

export const LOCAL_MATCH_PLAYER_ONE_ID = 'local-engine-player-1' as PlayerId
export const LOCAL_MATCH_PLAYER_TWO_ID = 'local-engine-player-2' as PlayerId
export const LOCAL_MATCH_PARTICIPANT_ONE_ID =
  'local-participant-1' as MatchRoomParticipantId
export const LOCAL_MATCH_PARTICIPANT_TWO_ID =
  'local-participant-2' as MatchRoomParticipantId

const LOCAL_MATCH_USER_ONE_ID = 'local-user-1' as UserId
const LOCAL_MATCH_USER_TWO_ID = 'local-user-2' as UserId

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
      },
      {
        participantId: LOCAL_MATCH_PARTICIPANT_TWO_ID,
        seat: 1,
        userId: LOCAL_MATCH_USER_TWO_ID,
        displayName: 'Toshiki Kai',
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
          type: 'system.advance_phase',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          nextPhase: 'draw',
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
  const callingPieceId = handZone?.occupants[0]?.pieceId
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
  const playerOneZones = createPlayerZones(LOCAL_MATCH_PLAYER_ONE_ID, 'p1')
  const playerTwoZones = createPlayerZones(LOCAL_MATCH_PLAYER_TWO_ID, 'p2')
  const playerOnePieces = createPlayerPieces(LOCAL_MATCH_PLAYER_ONE_ID, 'p1')
  const playerTwoPieces = createPlayerPieces(LOCAL_MATCH_PLAYER_TWO_ID, 'p2')

  return {
    gameId: `game:${roomId}` as GameId,
    formatId: STANDARD_FORMAT_ID,
    status: 'setup',
    revision: 0,
    turn: {
      turnNumber: 0,
      turnPlayerId: LOCAL_MATCH_PLAYER_ONE_ID,
      phase: 'pregame',
      step: 'setup',
    },
    players: [
      {
        playerId: LOCAL_MATCH_PLAYER_ONE_ID,
        seat: 0,
        status: 'waiting',
        ownedZoneIds: playerOneZones.map((zone) => zone.zoneId),
        counters: [],
        flags: [],
      },
      {
        playerId: LOCAL_MATCH_PLAYER_TWO_ID,
        seat: 1,
        status: 'waiting',
        ownedZoneIds: playerTwoZones.map((zone) => zone.zoneId),
        counters: [],
        flags: [],
      },
    ],
    zones: [...playerOneZones, ...playerTwoZones],
    pieces: [...playerOnePieces, ...playerTwoPieces],
    pieceStates: [
      {
        pieceId: pieceId('p1', 'starter'),
        orientation: 'stand',
        flags: [],
      },
      {
        pieceId: pieceId('p1', 'rear-guard-1'),
        orientation: 'rest',
        flags: ['locked'],
      },
      {
        pieceId: pieceId('p2', 'starter'),
        orientation: 'rest',
        flags: [],
      },
    ],
    flags: [],
    pendingRequests: [],
  }
}

function createPlayerZones(playerId: PlayerId, prefix: 'p1' | 'p2') {
  return [
    {
      zoneId: zoneId(prefix, 'deck'),
      kind: 'deck',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'owner-private',
      layout: {
        ordering: 'ordered',
        occupancy: 'multi',
      },
      occupants: [
        {
          pieceId: pieceId(prefix, 'deck-1'),
        },
        {
          pieceId: pieceId(prefix, 'deck-2'),
        },
        {
          pieceId: pieceId(prefix, 'deck-3'),
        },
      ],
    },
    {
      zoneId: zoneId(prefix, 'ride-deck'),
      kind: 'ride_deck',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'owner-private',
      layout: {
        ordering: 'ordered',
        occupancy: 'multi',
      },
      occupants: [
        {
          pieceId: pieceId(prefix, 'ride-deck-0'),
        },
        {
          pieceId: pieceId(prefix, 'ride-deck-1'),
        },
      ],
    },
    {
      zoneId: zoneId(prefix, 'g-deck'),
      kind: 'g_deck',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'owner-private',
      layout: {
        ordering: 'ordered',
        occupancy: 'multi',
      },
      occupants: [
        {
          pieceId: pieceId(prefix, 'g-deck-1'),
        },
      ],
    },
    {
      zoneId: zoneId(prefix, 'hand'),
      kind: 'hand',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'owner-private',
      layout: {
        ordering: 'unordered',
        occupancy: 'multi',
      },
      occupants: [
        {
          pieceId: pieceId(prefix, 'hand-1'),
        },
        {
          pieceId: pieceId(prefix, 'hand-2'),
        },
      ],
    },
    {
      zoneId: zoneId(prefix, 'vanguard'),
      kind: 'vanguard_circle',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'public',
      layout: {
        ordering: 'unordered',
        occupancy: 'single',
      },
      occupants: [
        {
          pieceId: pieceId(prefix, 'starter'),
        },
      ],
    },
    {
      zoneId: zoneId(prefix, 'rear-guard'),
      kind: 'rear_guard_circle',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'public',
      layout: {
        ordering: 'unordered',
        occupancy: 'slotted',
        slotIds: [
          `${prefix}:front-left` as ZoneSlotId,
          `${prefix}:front-right` as ZoneSlotId,
        ],
      },
      occupants: [
        {
          pieceId: pieceId(prefix, 'rear-guard-1'),
          slotId: `${prefix}:front-left` as ZoneSlotId,
        },
      ],
    },
    {
      zoneId: zoneId(prefix, 'damage'),
      kind: 'damage',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'public',
      layout: {
        ordering: 'ordered',
        occupancy: 'multi',
      },
      occupants: [
        {
          pieceId: pieceId(prefix, 'damage-1'),
        },
      ],
    },
    {
      zoneId: zoneId(prefix, 'soul'),
      kind: 'soul',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'public',
      layout: {
        ordering: 'ordered',
        occupancy: 'multi',
      },
      occupants: [
        {
          pieceId: pieceId(prefix, 'soul-1'),
        },
      ],
    },
    {
      zoneId: zoneId(prefix, 'drop'),
      kind: 'drop',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'public',
      layout: {
        ordering: 'ordered',
        occupancy: 'multi',
      },
      occupants: [],
    },
    {
      zoneId: zoneId(prefix, 'bind'),
      kind: 'bind',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'public',
      layout: {
        ordering: 'ordered',
        occupancy: 'multi',
      },
      occupants: [],
    },
  ] as const satisfies GameState['zones']
}

function createPlayerPieces(playerId: PlayerId, prefix: 'p1' | 'p2') {
  return [
    {
      pieceId: pieceId(prefix, 'deck-1'),
      kind: 'card',
      cardDefinitionId: `${prefix}:card:deck-1` as CardId,
      ownerPlayerId: playerId,
      controllerPlayerId: playerId,
    },
    {
      pieceId: pieceId(prefix, 'deck-2'),
      kind: 'card',
      cardDefinitionId: `${prefix}:card:deck-2` as CardId,
      ownerPlayerId: playerId,
      controllerPlayerId: playerId,
    },
    {
      pieceId: pieceId(prefix, 'deck-3'),
      kind: 'card',
      cardDefinitionId: `${prefix}:card:deck-3` as CardId,
      ownerPlayerId: playerId,
      controllerPlayerId: playerId,
    },
    {
      pieceId: pieceId(prefix, 'hand-1'),
      kind: 'card',
      cardDefinitionId: `${prefix}:card:hand-1` as CardId,
      ownerPlayerId: playerId,
      controllerPlayerId: playerId,
    },
    {
      pieceId: pieceId(prefix, 'hand-2'),
      kind: 'card',
      cardDefinitionId: `${prefix}:card:hand-2` as CardId,
      ownerPlayerId: playerId,
      controllerPlayerId: playerId,
    },
    {
      pieceId: pieceId(prefix, 'ride-deck-0'),
      kind: 'card',
      cardDefinitionId: `${prefix}:card:ride-deck-0` as CardId,
      ownerPlayerId: playerId,
      controllerPlayerId: playerId,
    },
    {
      pieceId: pieceId(prefix, 'ride-deck-1'),
      kind: 'card',
      cardDefinitionId: `${prefix}:card:ride-deck-1` as CardId,
      ownerPlayerId: playerId,
      controllerPlayerId: playerId,
    },
    {
      pieceId: pieceId(prefix, 'g-deck-1'),
      kind: 'card',
      cardDefinitionId: `${prefix}:card:g-deck-1` as CardId,
      ownerPlayerId: playerId,
      controllerPlayerId: playerId,
    },
    {
      pieceId: pieceId(prefix, 'starter'),
      kind: 'card',
      cardDefinitionId: `${prefix}:card:starter` as CardId,
      ownerPlayerId: playerId,
      controllerPlayerId: playerId,
    },
    {
      pieceId: pieceId(prefix, 'rear-guard-1'),
      kind: 'card',
      cardDefinitionId: `${prefix}:card:rear-guard-1` as CardId,
      ownerPlayerId: playerId,
      controllerPlayerId: playerId,
    },
    {
      pieceId: pieceId(prefix, 'damage-1'),
      kind: 'card',
      cardDefinitionId: `${prefix}:card:damage-1` as CardId,
      ownerPlayerId: playerId,
      controllerPlayerId: playerId,
    },
    {
      pieceId: pieceId(prefix, 'soul-1'),
      kind: 'card',
      cardDefinitionId: `${prefix}:card:soul-1` as CardId,
      ownerPlayerId: playerId,
      controllerPlayerId: playerId,
    },
  ] as const satisfies GameState['pieces']
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

function zoneId(prefix: 'p1' | 'p2', key: string): ZoneId {
  return `${prefix}:zone:${key}` as ZoneId
}

function pieceId(prefix: 'p1' | 'p2', key: string): PieceId {
  return `${prefix}:piece:${key}` as PieceId
}
