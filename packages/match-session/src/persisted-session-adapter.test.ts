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
  hasMatchRoomEngineState,
  initializeMatchRoom,
  submitMatchRoomCommand,
  type MatchRoomCommandResult,
  type MatchRoomEngineAdapter,
  type MatchRoomId,
  type MatchRoomParticipantId,
  type MatchRoomWithEngineState,
} from './match-room'
import {
  createInMemoryPersistedMatchSessionStorage,
  createPersistedMatchSessionAdapter,
  type PersistedMatchSessionResult,
} from './persisted-session-adapter'
import { projectMatchRoomForParticipant } from './projection'
import {
  appendRoomLifecycleEventToHistory,
  type SerializableMatchSessionDocument,
} from './session-persistence'

const ROOM_ID = 'room-persisted-adapter-1' as MatchRoomId
const PARTICIPANT_1 =
  'participant-persisted-adapter-1' as MatchRoomParticipantId
const PARTICIPANT_2 =
  'participant-persisted-adapter-2' as MatchRoomParticipantId
const PLAYER_1 = 'player-persisted-adapter-1' as PlayerId
const PLAYER_2 = 'player-persisted-adapter-2' as PlayerId
const ACTION_ID = 'action-persisted-adapter-1' as ActionId

describe('@web-vg/match-session persisted session adapter', () => {
  it('creates and restores a persisted authoritative room document', async () => {
    const adapter = createPersistedMatchSessionAdapter({
      storage: createInMemoryPersistedMatchSessionStorage(),
    })
    const room = makeInitializedRoom()
    const history = appendRoomLifecycleEventToHistory({
      history: [],
      room,
      type: 'room.initialized',
      recordedAt: '2026-05-20T00:00:01.000Z',
    })

    const created = await adapter.createPersistedRoom({
      room,
      history,
      recordedAt: '2026-05-20T00:00:02.000Z',
    })

    expect(created.ok).toBe(true)

    const loaded = requireOk(created)

    expect(loaded.document.room).toEqual(room)
    expect(loaded.document.history).toEqual(history)
    expect(loaded.persistedAt).toBe('2026-05-20T00:00:02.000Z')

    const restored = await adapter.restoreAuthoritativeRoom(ROOM_ID)

    expect(restored.ok).toBe(true)

    const authoritative = requireOk(restored)

    expect(authoritative.room).toEqual(room)
    expect(authoritative.history).toEqual(history)
  })

  it('persists accepted transitions as an atomic snapshot and accepted history append', async () => {
    const adapter = createPersistedMatchSessionAdapter({
      storage: createInMemoryPersistedMatchSessionStorage(),
    })
    const created = requireOk(
      await adapter.createPersistedRoom({
        room: makeInitializedRoom(),
        recordedAt: '2026-05-20T00:01:00.000Z',
      }),
    )
    const createdRoom = requireEngineRoom(created.document)
    const accepted = requireAccepted(
      submitMatchRoomCommand(createdRoom, systemAdvancePhaseCommand(0), {
        engineAdapters: [
          adapterReturning(
            {
              ...createdRoom.engineState,
              status: 'awaiting_choice',
              revision: 1,
              pendingRequests: [mulliganRequest()],
            },
            [mulliganStartedEvent()],
          ),
        ],
        submittedAt: '2026-05-20T00:01:01.000Z',
      }),
    )

    const persisted = await adapter.persistAcceptedRoomTransition({
      currentDocument: created.document,
      result: accepted,
      recordedAt: '2026-05-20T00:01:02.000Z',
    })

    expect(persisted.ok).toBe(true)

    const transition = requireOk(persisted)

    expect(transition.previousRoomRevision).toBe(1)
    expect(transition.document.room.revision).toBe(2)
    expect(transition.appendedHistory).toHaveLength(1)
    expect(transition.document.history.map((entry) => entry.sequence)).toEqual([
      1,
    ])
    expect(transition.document.history[0]).toMatchObject({
      roomRevision: 2,
      engineRevision: 1,
      event: {
        kind: 'engine_event',
        transitionId: 'transition-persisted-adapter-1',
      },
    })

    const loaded = requireOk(await adapter.loadRoomSession(ROOM_ID))
    const loadedRoom = requireEngineRoom(loaded.document)

    expect(loaded.document.room.revision).toBe(2)
    expect(loaded.document.history).toEqual(transition.document.history)
    expect(loadedRoom.engineState.pendingRequests[0]).toMatchObject({
      requestId: 'request-persisted-adapter-mulligan',
      type: 'mulligan.select_cards',
    })
    expect(loadedRoom.clock.activeRequest).toMatchObject({
      requestId: 'request-persisted-adapter-mulligan',
      responderPlayerId: PLAYER_1,
      deadlineAt: '2026-05-20T00:03:01.000Z',
    })

    const projection = projectMatchRoomForParticipant(loadedRoom, PARTICIPANT_2)

    expect(projection.ok).toBe(true)

    if (!projection.ok) {
      throw new Error(projection.message)
    }

    expect(JSON.stringify(projection.projection.visibleState)).not.toContain(
      'card-player-1-hand',
    )
    expect(projection.projection.visibleState.pendingRequests[0]).toMatchObject(
      {
        requestId: 'request-persisted-adapter-mulligan',
        visibilityToViewer: 'redacted',
      },
    )
  })

  it('updates the current snapshot for completed rooms even when no engine history rows are emitted', async () => {
    const adapter = createPersistedMatchSessionAdapter({
      storage: createInMemoryPersistedMatchSessionStorage(),
    })
    const created = requireOk(
      await adapter.createPersistedRoom({
        room: makeInitializedRoom(),
        recordedAt: '2026-05-20T00:02:00.000Z',
      }),
    )
    const createdRoom = requireEngineRoom(created.document)
    const completedState: GameState = {
      ...createdRoom.engineState,
      status: 'completed',
      revision: 1,
      pendingRequests: [],
      players: createdRoom.engineState.players.map((player) =>
        player.playerId === PLAYER_2
          ? {
              ...player,
              status: 'defeated',
            }
          : player,
      ),
    }
    const accepted = requireAccepted(
      submitMatchRoomCommand(createdRoom, systemAdvancePhaseCommand(0), {
        engineAdapters: [adapterReturning(completedState, [])],
        submittedAt: '2026-05-20T00:02:01.000Z',
      }),
    )

    const persisted = requireOk(
      await adapter.persistAcceptedRoomTransition({
        currentDocument: created.document,
        result: accepted,
        recordedAt: '2026-05-20T00:02:02.000Z',
      }),
    )

    expect(persisted.appendedHistory).toEqual([])
    expect(persisted.document.room.status).toBe('completed')
    expect(requireEngineRoom(persisted.document).engineState.status).toBe(
      'completed',
    )

    const restored = requireOk(await adapter.restoreAuthoritativeRoom(ROOM_ID))

    expect(restored.room.status).toBe('completed')
    expect(restored.room.revision).toBe(2)
    expect(restored.history).toEqual([])

    if (!('engineState' in restored.room)) {
      throw new Error('Expected completed room to restore canonical state.')
    }

    expect(restored.room.engineState.players[1]?.status).toBe('defeated')
  })

  it('keeps invalid and blocked command results out of persisted authoritative history', async () => {
    const adapter = createPersistedMatchSessionAdapter({
      storage: createInMemoryPersistedMatchSessionStorage(),
    })
    const created = requireOk(
      await adapter.createPersistedRoom({
        room: makeInitializedRoom(),
        recordedAt: '2026-05-20T00:03:00.000Z',
      }),
    )
    const createdRoom = requireEngineRoom(created.document)
    const invalidResult = submitMatchRoomCommand(
      createdRoom,
      systemAdvancePhaseCommand(99),
    )

    expect(invalidResult.status).toBe('invalid')

    const persistedInvalid = requireOk(
      await adapter.persistMatchRoomCommandResult({
        currentDocument: created.document,
        result: invalidResult,
        recordedAt: '2026-05-20T00:03:01.000Z',
      }),
    )

    expect(persistedInvalid.persisted).toBe(false)

    const blockedResult = submitMatchRoomCommand(
      createdRoom,
      systemAdvancePhaseCommand(0),
      {
        engineAdapters: [adapterReturningBlocked(createdRoom.engineState)],
        submittedAt: '2026-05-20T00:03:02.000Z',
      },
    )

    expect(blockedResult.status).toBe('blocked')

    const persistedBlocked = requireOk(
      await adapter.persistMatchRoomCommandResult({
        currentDocument: created.document,
        result: blockedResult,
        recordedAt: '2026-05-20T00:03:03.000Z',
      }),
    )

    expect(persistedBlocked.persisted).toBe(false)

    const loaded = requireOk(await adapter.loadRoomSession(ROOM_ID))

    expect(loaded.document).toEqual(created.document)
    expect(loaded.document.history).toEqual([])
  })

  it('rejects stale accepted transitions without overwriting the current snapshot', async () => {
    const adapter = createPersistedMatchSessionAdapter({
      storage: createInMemoryPersistedMatchSessionStorage(),
    })
    const created = requireOk(
      await adapter.createPersistedRoom({
        room: makeInitializedRoom(),
        recordedAt: '2026-05-20T00:04:00.000Z',
      }),
    )
    const createdRoom = requireEngineRoom(created.document)
    const firstAccepted = requireAccepted(
      submitMatchRoomCommand(createdRoom, systemAdvancePhaseCommand(0), {
        engineAdapters: [
          adapterReturning(
            {
              ...createdRoom.engineState,
              status: 'in_progress',
              revision: 1,
            },
            [phaseAdvancedEvent(1)],
          ),
        ],
        submittedAt: '2026-05-20T00:04:01.000Z',
      }),
    )
    const firstPersist = requireOk(
      await adapter.persistAcceptedRoomTransition({
        currentDocument: created.document,
        result: firstAccepted,
        recordedAt: '2026-05-20T00:04:02.000Z',
      }),
    )
    const staleAccepted = requireAccepted(
      submitMatchRoomCommand(createdRoom, systemAdvancePhaseCommand(0), {
        engineAdapters: [
          adapterReturning(
            {
              ...createdRoom.engineState,
              status: 'in_progress',
              revision: 1,
              turn: {
                ...createdRoom.engineState.turn,
                phase: 'main',
              },
            },
            [phaseAdvancedEvent(2)],
          ),
        ],
        submittedAt: '2026-05-20T00:04:03.000Z',
      }),
    )

    const stalePersist = await adapter.persistAcceptedRoomTransition({
      currentDocument: created.document,
      result: staleAccepted,
      recordedAt: '2026-05-20T00:04:04.000Z',
    })

    expect(stalePersist).toMatchObject({
      ok: false,
      error: {
        code: 'stale_room_revision',
      },
    })

    const loaded = requireOk(await adapter.loadRoomSession(ROOM_ID))

    expect(loaded.document).toEqual(firstPersist.document)
  })

  it('surfaces malformed persisted documents as structured restore failures', async () => {
    const adapter = createPersistedMatchSessionAdapter({
      storage: {
        createRoomSession() {
          return Promise.reject(new Error('not used'))
        },
        loadRoomSession(roomId) {
          return Promise.resolve({
            ok: true,
            data: {
              roomId,
              persistedAt: '2026-05-20T00:05:00.000Z',
              document: {
                version: 999,
                persistenceModel: 'snapshot+event-history',
                room: {},
                history: [],
              },
            },
          })
        },
        persistAcceptedRoomTransition() {
          return Promise.reject(new Error('not used'))
        },
      },
    })

    const loaded = await adapter.loadRoomSession(ROOM_ID)

    expect(loaded).toMatchObject({
      ok: false,
      error: {
        code: 'unsupported_version',
      },
    })
  })
})

function requireOk<TData>(result: PersistedMatchSessionResult<TData>): TData {
  expect(result.ok).toBe(true)

  if (!result.ok) {
    throw new Error(result.error.message)
  }

  return result.data
}

function requireAccepted(result: MatchRoomCommandResult) {
  expect(result.status).toBe('accepted')

  if (result.status !== 'accepted') {
    throw new Error(`Expected accepted result, got ${result.status}.`)
  }

  return result
}

function requireEngineRoom(
  document: SerializableMatchSessionDocument,
): MatchRoomWithEngineState {
  expect(hasMatchRoomEngineState(document.room)).toBe(true)

  if (!hasMatchRoomEngineState(document.room)) {
    throw new Error('Expected persisted document to contain engine state.')
  }

  return document.room
}

function makeInitializedRoom() {
  return initializeMatchRoom(
    createMatchRoom({
      roomId: ROOM_ID,
      formatId: STANDARD_FORMAT_ID,
      hostParticipantId: PARTICIPANT_1,
      createdAt: '2026-05-20T00:00:00.000Z',
      participants: [
        {
          participantId: PARTICIPANT_1,
          seat: 0,
          userId: 'user-persisted-adapter-1' as UserId,
          displayName: 'Aichi',
        },
        {
          participantId: PARTICIPANT_2,
          seat: 1,
          userId: 'user-persisted-adapter-2' as UserId,
          displayName: 'Kai',
        },
      ],
    }),
    {
      initialState: makeGameState(),
      initializedAt: '2026-05-20T00:00:00.500Z',
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
    gameId: 'game-persisted-adapter-1' as GameState['gameId'],
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
        transitionId: 'transition-persisted-adapter-1' as TransitionId,
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
        transitionId: 'transition-persisted-adapter-blocked' as TransitionId,
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
    requestId: 'request-persisted-adapter-mulligan' as RequestId,
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
    eventId: 'event-persisted-adapter-mulligan-started' as EventId,
    type: 'mulligan.started',
    sequence: 1,
    origin: {
      kind: 'system',
      system: 'match-setup',
    },
    playerId: PLAYER_1,
    requestId: 'request-persisted-adapter-mulligan' as RequestId,
    handZoneId: 'zone-player-1-hand' as ZoneId,
    deckZoneId: 'zone-player-1-deck' as ZoneId,
  } satisfies GameEvent
}

function phaseAdvancedEvent(sequence: number) {
  return {
    eventId: `event-persisted-adapter-phase-${sequence}` as EventId,
    type: 'turn.phase_advanced',
    sequence,
    origin: {
      kind: 'system',
      system: 'automatic-flow',
    },
    turnNumber: 1,
    previousPhase: 'pregame',
    nextPhase: 'main',
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
