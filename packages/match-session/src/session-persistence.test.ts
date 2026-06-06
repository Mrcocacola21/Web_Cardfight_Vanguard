import { describe, expect, it } from 'vitest'

import type {
  ActionId,
  EventId,
  GameEvent,
  GameState,
  PieceId,
  PlayerId,
  RequestId,
  TransitionId,
  ZoneId,
} from '@web-vg/rules-core'
import {
  STANDARD_FORMAT_ID,
  buildEngineCardStatsSnapshot,
} from '@web-vg/rules-core'
import type { CardId, UserId } from '@web-vg/shared'

import {
  createMatchRoom,
  initializeMatchRoom,
  submitMatchRoomCommand,
  type MatchRoomEngineAdapter,
  type MatchRoomId,
  type MatchRoomParticipantId,
} from './match-room'
import { projectMatchRoomForParticipant } from './projection'
import {
  appendRoomLifecycleEventToHistory,
  createSerializableMatchSessionDocument,
  deserializeMatchSessionDocument,
  recordMatchRoomCommandResult,
  restoreMatchSessionDocument,
  serializeMatchSessionDocument,
} from './session-persistence'
import type { SerializableMatchSessionDocument } from './session-persistence'

const ROOM_ID = 'room-session-persistence-1' as MatchRoomId
const PARTICIPANT_1 =
  'participant-session-persistence-1' as MatchRoomParticipantId
const PARTICIPANT_2 =
  'participant-session-persistence-2' as MatchRoomParticipantId
const PLAYER_1 = 'player-session-persistence-1' as PlayerId
const PLAYER_2 = 'player-session-persistence-2' as PlayerId
const ACTION_ID = 'action-session-persistence-1' as ActionId

describe('@web-vg/match-session serialization and event history', () => {
  it('serializes and restores an active room snapshot with pending request truth', () => {
    const initializedRoom = makeInitializedRoom()
    const initialDocumentResult = createSerializableMatchSessionDocument({
      room: initializedRoom,
      history: appendRoomLifecycleEventToHistory({
        history: [],
        room: initializedRoom,
        type: 'room.initialized',
        recordedAt: '2026-05-10T00:00:00.000Z',
      }),
    })

    expect(initialDocumentResult.ok).toBe(true)

    if (!initialDocumentResult.ok) {
      throw new Error(initialDocumentResult.message)
    }

    const acceptedResult = submitMatchRoomCommand(
      initializedRoom,
      systemAdvancePhaseCommand(0),
      {
        engineAdapters: [
          adapterReturning(
            {
              ...initializedRoom.engineState,
              status: 'awaiting_choice',
              revision: 1,
              pendingRequests: [mulliganRequest()],
            },
            [mulliganStartedEvent()],
          ),
        ],
        submittedAt: '2026-05-10T00:00:01.000Z',
      },
    )

    expect(acceptedResult.status).toBe('accepted')

    if (acceptedResult.status !== 'accepted') {
      throw new Error(`Expected accepted result, got ${acceptedResult.status}.`)
    }

    const recordedResult = recordMatchRoomCommandResult({
      document: initialDocumentResult.document,
      result: acceptedResult,
      recordedAt: '2026-05-10T00:00:02.000Z',
    })

    expect(recordedResult.ok).toBe(true)

    if (!recordedResult.ok) {
      throw new Error(recordedResult.message)
    }

    const serialized = serializeMatchSessionDocument(recordedResult.document)

    expect(serialized.ok).toBe(true)

    if (!serialized.ok) {
      throw new Error(serialized.message)
    }

    const restored = deserializeMatchSessionDocument(serialized.json)

    expect(restored.ok).toBe(true)

    if (!restored.ok) {
      throw new Error(restored.message)
    }

    expect(restored.session.room.status).toBe('in_progress')
    expect(restored.session.history.map((entry) => entry.sequence)).toEqual([
      1, 2,
    ])
    expect(restored.session.history[1]).toMatchObject({
      entryId: 'room-session-persistence-1:history:2',
      roomRevision: 2,
      engineRevision: 1,
      event: {
        kind: 'engine_event',
        transitionId: 'transition-session-persistence-1',
      },
    })

    if (!('engineState' in restored.session.room)) {
      throw new Error('Expected restored room to include engine state.')
    }

    expect(restored.session.room.engineState.pendingRequests[0]).toMatchObject({
      requestId: 'request-session-mulligan',
      type: 'mulligan.select_cards',
    })
    expect(restored.session.room.clock.activeRequest).toMatchObject({
      requestId: 'request-session-mulligan',
      responderPlayerId: PLAYER_1,
      startedAt: '2026-05-10T00:00:01.000Z',
      deadlineAt: '2026-05-10T00:02:01.000Z',
    })
    expect(serialized.json).toContain('"activeRequest"')
    expect(serialized.json).toContain('"deadlineAt":"2026-05-10T00:02:01.000Z"')

    const projection = projectMatchRoomForParticipant(
      restored.session.room,
      PARTICIPANT_2,
    )

    expect(projection.ok).toBe(true)

    if (!projection.ok) {
      throw new Error(projection.message)
    }

    expect(JSON.stringify(projection.projection.visibleState)).not.toContain(
      'card-player-1-hand',
    )
    expect(projection.projection.visibleState.pendingRequests[0]).toMatchObject(
      {
        requestId: 'request-session-mulligan',
        visibilityToViewer: 'redacted',
      },
    )
  })

  it('restores completed rooms and preserves terminal canonical state', () => {
    const initializedRoom = makeInitializedRoom()
    const completedState: GameState = {
      ...initializedRoom.engineState,
      status: 'completed',
      revision: 1,
      pendingRequests: [],
      players: initializedRoom.engineState.players.map((player) =>
        player.playerId === PLAYER_2
          ? {
              ...player,
              status: 'defeated',
            }
          : player,
      ),
    }
    const acceptedResult = submitMatchRoomCommand(
      initializedRoom,
      systemAdvancePhaseCommand(0),
      {
        engineAdapters: [adapterReturning(completedState, [])],
        submittedAt: '2026-05-10T00:01:00.000Z',
      },
    )

    expect(acceptedResult.status).toBe('accepted')

    if (acceptedResult.status !== 'accepted') {
      throw new Error(`Expected accepted result, got ${acceptedResult.status}.`)
    }

    const document = createSerializableMatchSessionDocument({
      room: acceptedResult.room,
      history: appendRoomLifecycleEventToHistory({
        history: [],
        room: acceptedResult.room,
        type: 'room.completed',
        recordedAt: '2026-05-10T00:01:01.000Z',
      }),
    })

    expect(document.ok).toBe(true)

    if (!document.ok) {
      throw new Error(document.message)
    }

    const restored = restoreMatchSessionDocument(document.document)

    expect(restored.ok).toBe(true)

    if (!restored.ok) {
      throw new Error(restored.message)
    }

    expect(restored.session.room.status).toBe('completed')

    if (!('engineState' in restored.session.room)) {
      throw new Error(
        'Expected restored completed room to include engine state.',
      )
    }

    expect(restored.session.room.engineState.status).toBe('completed')
    expect(restored.session.room.engineState.players[1]?.status).toBe(
      'defeated',
    )
  })

  it('keeps invalid and blocked command attempts out of durable history', () => {
    const initializedRoom = makeInitializedRoom()
    const document = createSerializableMatchSessionDocument({
      room: initializedRoom,
    })

    expect(document.ok).toBe(true)

    if (!document.ok) {
      throw new Error(document.message)
    }

    const invalidResult = submitMatchRoomCommand(
      initializedRoom,
      systemAdvancePhaseCommand(99),
    )

    expect(invalidResult.status).toBe('invalid')

    const recorded = recordMatchRoomCommandResult({
      document: document.document,
      result: invalidResult,
      recordedAt: '2026-05-10T00:02:00.000Z',
    })

    expect(recorded.ok).toBe(true)

    if (!recorded.ok) {
      throw new Error(recorded.message)
    }

    expect(recorded.document).toEqual(document.document)

    const blockedResult = submitMatchRoomCommand(
      initializedRoom,
      systemAdvancePhaseCommand(0),
      {
        engineAdapters: [adapterReturningBlocked(initializedRoom.engineState)],
        submittedAt: '2026-05-10T00:02:01.000Z',
      },
    )

    expect(blockedResult.status).toBe('blocked')

    const recordedBlocked = recordMatchRoomCommandResult({
      document: document.document,
      result: blockedResult,
      recordedAt: '2026-05-10T00:02:02.000Z',
    })

    expect(recordedBlocked.ok).toBe(true)

    if (!recordedBlocked.ok) {
      throw new Error(recordedBlocked.message)
    }

    expect(recordedBlocked.document).toEqual(document.document)
  })

  it('rejects unsupported versions and out-of-order history', () => {
    const initializedRoom = makeInitializedRoom()
    const document = createSerializableMatchSessionDocument({
      room: initializedRoom,
      history: appendRoomLifecycleEventToHistory({
        history: [],
        room: initializedRoom,
        type: 'room.initialized',
        recordedAt: '2026-05-10T00:03:00.000Z',
      }),
    })

    expect(document.ok).toBe(true)

    if (!document.ok) {
      throw new Error(document.message)
    }

    expect(
      restoreMatchSessionDocument({
        ...document.document,
        version: 999,
      }),
    ).toMatchObject({
      ok: false,
      code: 'unsupported_version',
    })

    expect(
      restoreMatchSessionDocument({
        ...document.document,
        history: [
          {
            ...document.document.history[0],
            sequence: 2,
          },
        ],
      }),
    ).toMatchObject({
      ok: false,
      code: 'invalid_history_order',
    })
  })

  it('roundtrips the document through plain JSON without non-serializable runtime data', () => {
    const document = createSerializableMatchSessionDocument({
      room: makeInitializedRoom(),
    })

    expect(document.ok).toBe(true)

    if (!document.ok) {
      throw new Error(document.message)
    }

    const json = JSON.stringify(document.document)
    const parsed = JSON.parse(json) as SerializableMatchSessionDocument
    const restored = restoreMatchSessionDocument(parsed)

    expect(restored.ok).toBe(true)
    expect(json).not.toContain('function')
    expect(json).not.toContain('dispatch')
  })
})

function makeInitializedRoom() {
  return initializeMatchRoom(
    createMatchRoom({
      roomId: ROOM_ID,
      formatId: STANDARD_FORMAT_ID,
      hostParticipantId: PARTICIPANT_1,
      createdAt: '2026-05-10T00:00:00.000Z',
      participants: [
        {
          participantId: PARTICIPANT_1,
          seat: 0,
          userId: 'user-session-persistence-1' as UserId,
          displayName: 'Aichi',
        },
        {
          participantId: PARTICIPANT_2,
          seat: 1,
          userId: 'user-session-persistence-2' as UserId,
          displayName: 'Kai',
        },
      ],
    }),
    {
      initialState: makeGameState(),
      initializedAt: '2026-05-10T00:00:00.500Z',
      playerBindings: [
        {
          participantId: PARTICIPANT_1,
          playerId: PLAYER_1,
        },
        {
          participantId: PARTICIPANT_2,
          playerId: PLAYER_2,
        },
      ],
    },
  )
}

function makeGameState(): GameState {
  return {
    gameId: 'game-session-persistence-1' as GameState['gameId'],
    formatId: STANDARD_FORMAT_ID,
    status: 'setup',
    revision: 0,
    turn: {
      turnNumber: 0,
      turnPlayerId: PLAYER_1,
      phase: 'pregame',
      step: 'setup',
    },
    players: [
      player(PLAYER_1, 0, ['zone-player-1-hand', 'zone-player-1-deck']),
      player(PLAYER_2, 1, ['zone-player-2-hand', 'zone-player-2-deck']),
    ],
    zones: [
      zone('zone-player-1-hand', 'hand', PLAYER_1, 'owner-private', [
        'piece-player-1-hand',
      ]),
      zone('zone-player-1-deck', 'deck', PLAYER_1, 'owner-private', [
        'piece-player-1-deck',
      ]),
      zone('zone-player-2-hand', 'hand', PLAYER_2, 'owner-private', [
        'piece-player-2-hand',
      ]),
      zone('zone-player-2-deck', 'deck', PLAYER_2, 'owner-private', [
        'piece-player-2-deck',
      ]),
    ],
    pieces: [
      piece('piece-player-1-hand', 'card-player-1-hand', PLAYER_1),
      piece('piece-player-1-deck', 'card-player-1-deck', PLAYER_1),
      piece('piece-player-2-hand', 'card-player-2-hand', PLAYER_2),
      piece('piece-player-2-deck', 'card-player-2-deck', PLAYER_2),
    ],
    cardStats: buildEngineCardStatsSnapshot(
      [
        'card-player-1-hand',
        'card-player-1-deck',
        'card-player-2-hand',
        'card-player-2-deck',
      ].map((cardId) => ({
        cardDefinitionId: cardId as CardId,
        cardType: 'normal-unit',
        grade: 1,
        power: 8000,
        shield: 5000,
        critical: 1,
        triggerType: null,
        keywords: [],
      })),
    ),
    pieceStates: [],
    flags: [],
    pendingRequests: [],
  }
}

function adapterReturning(
  state: GameState,
  events: readonly GameEvent[],
): MatchRoomEngineAdapter {
  return {
    adapterId: 'rules-core:standard' as MatchRoomEngineAdapter['adapterId'],
    formatId: STANDARD_FORMAT_ID,
    dispatch() {
      return {
        status: 'accepted',
        transitionId: 'transition-session-persistence-1' as TransitionId,
        state,
        events,
        timingWindows: [],
        pendingRequests: state.pendingRequests,
      }
    },
  }
}

function adapterReturningBlocked(state: GameState): MatchRoomEngineAdapter {
  const request = mulliganRequest()
  const blockedState: GameState = {
    ...state,
    status: 'awaiting_choice',
    pendingRequests: [request],
  }

  return {
    adapterId: 'rules-core:standard' as MatchRoomEngineAdapter['adapterId'],
    formatId: STANDARD_FORMAT_ID,
    dispatch() {
      return {
        status: 'blocked',
        transitionId: 'transition-session-persistence-blocked' as TransitionId,
        state: blockedState,
        events: [],
        timingWindows: [],
        pendingRequests: blockedState.pendingRequests,
        code: 'pending_request',
        message: 'Pending request must be answered first.',
        blockingRequests: [request],
      }
    },
  }
}

function systemAdvancePhaseCommand(expectedRevision: number) {
  return {
    source: {
      kind: 'system',
      source: 'match-runtime',
    },
    command: {
      kind: 'action',
      submission: {
        action: {
          actionId: ACTION_ID,
          type: 'system.advance_phase',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          nextPhase: 'pregame',
        },
        expectedRevision,
      },
    },
  } as const
}

function mulliganRequest(): GameState['pendingRequests'][number] {
  return {
    requestId: 'request-session-mulligan' as RequestId,
    type: 'mulligan.select_cards',
    responderPlayerId: PLAYER_1,
    purpose: 'rule',
    visibility: 'responder-only',
    handZoneId: 'zone-player-1-hand' as ZoneId,
    deckZoneId: 'zone-player-1-deck' as ZoneId,
    minSelections: 0,
    maxSelections: 1,
    eligiblePieceIds: ['piece-player-1-hand' as PieceId],
    currentDeckPieceIds: ['piece-player-1-deck' as PieceId],
  }
}

function mulliganStartedEvent() {
  return {
    eventId: 'event-session-mulligan-started' as EventId,
    type: 'mulligan.started',
    sequence: 1,
    origin: {
      kind: 'system',
      system: 'match-setup',
    },
    playerId: PLAYER_1,
    requestId: 'request-session-mulligan' as RequestId,
    handZoneId: 'zone-player-1-hand' as ZoneId,
    deckZoneId: 'zone-player-1-deck' as ZoneId,
  } satisfies GameEvent
}

function player(
  playerId: PlayerId,
  seat: number,
  ownedZoneIds: readonly string[],
): GameState['players'][number] {
  return {
    playerId,
    seat,
    status: seat === 0 ? 'active' : 'waiting',
    ownedZoneIds: ownedZoneIds.map((zoneId) => zoneId as ZoneId),
    counters: [],
    flags: [],
  }
}

function zone(
  zoneId: string,
  kind: string,
  ownerPlayerId: PlayerId,
  visibility: GameState['zones'][number]['visibility'],
  pieceIds: readonly string[],
): GameState['zones'][number] {
  return {
    zoneId: zoneId as ZoneId,
    kind,
    scope: 'player',
    ownerPlayerId,
    visibility,
    layout: {
      ordering: kind === 'hand' ? 'unordered' : 'ordered',
      occupancy: 'multi',
    },
    occupants: pieceIds.map((pieceId) => ({
      pieceId: pieceId as PieceId,
    })),
  }
}

function piece(
  pieceId: string,
  cardDefinitionId: string,
  playerId: PlayerId,
): GameState['pieces'][number] {
  return {
    pieceId: pieceId as PieceId,
    kind: 'card',
    cardDefinitionId: cardDefinitionId as CardId,
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
  }
}
