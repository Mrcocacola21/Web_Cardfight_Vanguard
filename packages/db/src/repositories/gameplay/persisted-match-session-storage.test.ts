import { afterEach, describe, expect, it } from 'vitest'

import {
  appendRoomLifecycleEventToHistory,
  createMatchRoom,
  createPersistedMatchSessionAdapter,
  createSerializableMatchSessionDocument,
  hasMatchRoomEngineState,
  initializeMatchRoom,
  recordMatchRoomCommandResult,
  submitMatchRoomCommand,
  type MatchRoomEngineAdapter,
  type MatchRoomHistoryEntry,
  type MatchRoomId,
  type MatchRoomParticipantId,
  type MatchRoomWithEngineState,
  type PersistedMatchSessionResult,
  type SerializableMatchSessionDocument,
} from '@web-vg/match-session'

import {
  createSequentialMockDbClient,
  type MockQueryInvocation,
} from '../shared/mock-db-client'
import { createDbPersistedMatchSessionStorage } from './persisted-match-session-storage'

const ROOM_ID = '00000000-0000-4000-8000-000000000201' as MatchRoomId
const ACTIVE_ROOM_ID = '00000000-0000-4000-8000-000000000202' as MatchRoomId
const COMPLETED_ROOM_ID = '00000000-0000-4000-8000-000000000203' as MatchRoomId
const PARTICIPANT_1 = 'participant-db-storage-1' as MatchRoomParticipantId
const PARTICIPANT_2 = 'participant-db-storage-2' as MatchRoomParticipantId

type GameState = MatchRoomWithEngineState['engineState']
type EngineHistoryEvent = Extract<
  MatchRoomHistoryEntry['event'],
  { readonly kind: 'engine_event' }
>
type GameEvent = EngineHistoryEvent['event']
type TransitionId = EngineHistoryEvent['transitionId']
type EngineActionCommand = Extract<
  Parameters<typeof submitMatchRoomCommand>[1]['command'],
  { readonly kind: 'action' }
>
type ActionId = EngineActionCommand['submission']['action']['actionId']
type PlayerId = GameState['players'][number]['playerId']
type ZoneId = GameState['zones'][number]['zoneId']
type PieceId = GameState['pieces'][number]['pieceId']
type CardId = NonNullable<GameState['pieces'][number]['cardDefinitionId']>
type RequestId = GameState['pendingRequests'][number]['requestId']
type EventId = GameEvent['eventId']
type UserId = NonNullable<
  Parameters<typeof createMatchRoom>[0]['participants'][number]['userId']
>

const PLAYER_1 = 'player-db-storage-1' as PlayerId
const PLAYER_2 = 'player-db-storage-2' as PlayerId
const ACTION_ID = 'action-db-storage-1' as ActionId
const USER_1 = '00000000-0000-4000-8000-000000000301' as UserId
const USER_2 = '00000000-0000-4000-8000-000000000302' as UserId
const FORMAT_ID = 'standard' as Parameters<
  typeof createMatchRoom
>[0]['formatId']

interface RpcPayloadForTest {
  readonly room: Record<string, unknown>
  readonly roomPlayers: readonly Record<string, unknown>[]
  readonly snapshot: Record<string, unknown>
  readonly events: readonly Record<string, unknown>[]
  readonly pendingChoices: readonly Record<string, unknown>[]
  readonly expectedRoomRevision?: unknown
  readonly expectedHistoryLength?: unknown
}

describe('DB-backed persisted match session storage', () => {
  const cleanups: Array<() => void> = []

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.()
    }
  })

  it('creates a durable room through the gameplay create RPC with explicit table mapping', async () => {
    const room = makeInitializedRoom(ROOM_ID)
    const history = appendRoomLifecycleEventToHistory({
      history: [],
      room,
      type: 'room.initialized',
      recordedAt: '2026-06-07T10:00:01.000Z',
    })
    const document = requireDocument(room, history)
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expectRpc(query, 'create_persisted_match_session')

          const payload = readRpcPayload(query, 'create_payload')

          expect(payload.room).toMatchObject({
            id: ROOM_ID,
            format_id: 'standard',
            host_profile_id: USER_1,
            status: 'setup',
            latest_event_sequence: 1,
            latest_snapshot_sequence: 1,
            created_at: '2026-06-07T10:00:00.000Z',
            updated_at: '2026-06-07T10:00:02.000Z',
          })
          expect(payload.roomPlayers).toHaveLength(2)
          expect(requireArrayItem(payload.roomPlayers, 0)).toMatchObject({
            profile_id: USER_1,
            seat_order: 1,
            player_status: 'active',
          })
          expect(payload.snapshot).toMatchObject({
            snapshot_sequence: 1,
            last_event_sequence: 1,
            phase_key: 'pregame',
          })
          expect(payload.snapshot.game_state_payload).toEqual(document)
          expect(payload.events).toHaveLength(1)
          expect(requireArrayItem(payload.events, 0)).toMatchObject({
            event_sequence: 1,
            event_kind: 'room.initialized',
            source_kind: 'setup',
          })
          expect(payload.pendingChoices).toEqual([])
        },
        response: {
          data: {
            room_id: ROOM_ID,
            persisted_at: '2026-06-07T10:00:02.000Z',
            document,
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const adapter = createPersistedMatchSessionAdapter({
      storage: createDbPersistedMatchSessionStorage(mock.client),
    })
    const created = await adapter.createPersistedRoom({
      room,
      history,
      recordedAt: '2026-06-07T10:00:02.000Z',
    })

    expect(created.ok).toBe(true)
    expect(requireOk(created).document).toEqual(document)
  })

  it('persists an accepted transition as one gameplay RPC payload with snapshot, accepted events, and FIFO pending choices', async () => {
    const fixture = makePendingTransitionFixture(ACTIVE_ROOM_ID)
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expectRpc(query, 'persist_accepted_match_session_transition')

          const payload = readRpcPayload(query, 'transition_payload')

          expect(payload.expectedRoomRevision).toBe(1)
          expect(payload.expectedHistoryLength).toBe(0)
          expect(payload.room).toMatchObject({
            id: ACTIVE_ROOM_ID,
            status: 'active',
            latest_event_sequence: 1,
            latest_snapshot_sequence: 2,
            started_at: '2026-06-07T10:01:01.000Z',
          })
          expect(payload.snapshot).toMatchObject({
            snapshot_sequence: 2,
            last_event_sequence: 1,
            phase_key: 'pregame',
          })
          expect(payload.events).toHaveLength(1)
          expect(requireArrayItem(payload.events, 0)).toMatchObject({
            event_sequence: 1,
            event_kind: 'mulligan.started',
            source_kind: 'setup',
            source_ref:
              'transition-db-storage-1:event-db-storage-mulligan-started',
          })
          expect(payload.pendingChoices).toHaveLength(1)
          const pendingChoice = requireArrayItem(payload.pendingChoices, 0)

          expect(pendingChoice).toMatchObject({
            owner_kind: 'player',
            choice_kind: 'mulligan.select_cards',
            opened_event_sequence: 1,
          })
          expect(pendingChoice.context_payload).toMatchObject({
            requestId: 'request-db-storage-mulligan',
            queueIndex: 0,
            roomRevision: 2,
            engineRevision: 1,
            deadline: {
              requestId: 'request-db-storage-mulligan',
              deadlineAt: '2026-06-07T10:03:01.000Z',
            },
          })
          expect(pendingChoice.options_payload).toMatchObject({
            requestId: 'request-db-storage-mulligan',
            type: 'mulligan.select_cards',
          })
        },
        response: {
          data: {
            room_id: ACTIVE_ROOM_ID,
            persisted_at: '2026-06-07T10:01:02.000Z',
            document: fixture.nextDocument,
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const adapter = createPersistedMatchSessionAdapter({
      storage: createDbPersistedMatchSessionStorage(mock.client),
    })
    const persisted = await adapter.persistAcceptedRoomTransition({
      currentDocument: fixture.currentDocument,
      result: fixture.accepted,
      recordedAt: '2026-06-07T10:01:02.000Z',
    })

    expect(persisted.ok).toBe(true)

    const transition = requireOk(persisted)

    expect(transition.document.room.revision).toBe(2)
    expect(transition.appendedHistory).toHaveLength(1)
    expect(
      requireEngineRoom(transition.document).engineState.pendingRequests,
    ).toHaveLength(1)
  })

  it('loads and restores an active room from current snapshot while validating accepted history and pending-choice mirror rows', async () => {
    const fixture = makePendingTransitionFixture(ACTIVE_ROOM_ID)
    const document = fixture.nextDocument
    const pendingRequest =
      requireEngineRoom(document).engineState.pendingRequests[0]

    if (!pendingRequest) {
      throw new Error('Expected active fixture to contain a pending request.')
    }

    const mock = createSequentialMockDbClient([
      matchRoomLoadStep(ACTIVE_ROOM_ID, document, 'active'),
      snapshotLoadStep(ACTIVE_ROOM_ID, document),
      eventRowsLoadStep(ACTIVE_ROOM_ID, document.history),
      pendingRowsLoadStep(ACTIVE_ROOM_ID, [
        {
          choice_kind: pendingRequest.type,
          context_payload: {
            requestId: pendingRequest.requestId,
            queueIndex: 0,
          },
          options_payload: pendingRequest,
          owner_kind: 'player',
          owner_room_player_id: 'd773019c-f725-5c65-af41-50c91b203f3f',
          status: 'pending',
        },
      ]),
    ])

    cleanups.push(mock.assertConsumed)

    const adapter = createPersistedMatchSessionAdapter({
      storage: createDbPersistedMatchSessionStorage(mock.client),
    })
    const restored = await adapter.restoreAuthoritativeRoom(ACTIVE_ROOM_ID)

    expect(restored.ok).toBe(true)

    const authoritative = requireOk(restored)

    expect(authoritative.room).toEqual(document.room)
    expect(authoritative.history).toEqual(document.history)
    expect(
      requireEngineRoom(authoritative.document).clock.activeRequest,
    ).toMatchObject({
      requestId: 'request-db-storage-mulligan',
      deadlineAt: '2026-06-07T10:03:01.000Z',
    })
  })

  it('restores completed rooms without pending choices and without inventing history', async () => {
    const document = makeCompletedDocument(COMPLETED_ROOM_ID)
    const mock = createSequentialMockDbClient([
      matchRoomLoadStep(COMPLETED_ROOM_ID, document, 'completed'),
      snapshotLoadStep(COMPLETED_ROOM_ID, document),
      eventRowsLoadStep(COMPLETED_ROOM_ID, []),
      pendingRowsLoadStep(COMPLETED_ROOM_ID, []),
    ])

    cleanups.push(mock.assertConsumed)

    const adapter = createPersistedMatchSessionAdapter({
      storage: createDbPersistedMatchSessionStorage(mock.client),
    })
    const restored = await adapter.restoreAuthoritativeRoom(COMPLETED_ROOM_ID)

    expect(restored.ok).toBe(true)

    const room = requireOk(restored).room

    expect(room.status).toBe('completed')
    expect(room.revision).toBe(2)
    expect(
      requireEngineRoom({ ...document, room }).engineState.pendingRequests,
    ).toEqual([])
  })

  it('keeps invalid and blocked command results out of the DB-backed storage path', async () => {
    const room = makeInitializedRoom(ROOM_ID)
    const document = requireDocument(room, [])
    const mock = createSequentialMockDbClient([])
    const adapter = createPersistedMatchSessionAdapter({
      storage: createDbPersistedMatchSessionStorage(mock.client),
    })

    cleanups.push(mock.assertConsumed)

    const persisted = await adapter.persistMatchRoomCommandResult({
      currentDocument: document,
      result: {
        status: 'invalid',
        room,
        code: 'engine_adapter_not_found',
        message: 'Synthetic invalid command for DB storage test.',
      },
      recordedAt: '2026-06-07T10:05:00.000Z',
    })

    expect(persisted).toEqual({
      ok: true,
      data: {
        persisted: false,
        document,
        appendedHistory: [],
        reason: 'non_authoritative_command_result',
      },
    })
  })

  it('maps stale revision RPC failures to the persisted session stale write error', async () => {
    const fixture = makePendingTransitionFixture(ACTIVE_ROOM_ID)
    const storage = createDbPersistedMatchSessionStorage(
      createSequentialMockDbClient([
        {
          assert(query) {
            expectRpc(query, 'persist_accepted_match_session_transition')
          },
          response: {
            data: null,
            error: {
              code: 'VG002',
              message: 'Persisted match room revision is stale.',
              details: 'Room is at revision 2, not 1.',
            },
          },
        },
      ]).client,
    )

    const result = await storage.persistAcceptedRoomTransition({
      roomId: ACTIVE_ROOM_ID,
      expectedRoomRevision: 1,
      expectedHistoryLength: 0,
      nextDocument: fixture.nextDocument,
      appendedHistory: fixture.nextDocument.history,
      persistedAt: '2026-06-07T10:06:00.000Z',
    })

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'stale_room_revision',
      },
    })
  })

  it('rejects snapshot and accepted event row mismatches during load', async () => {
    const fixture = makePendingTransitionFixture(ACTIVE_ROOM_ID)
    const document = fixture.nextDocument
    const mock = createSequentialMockDbClient([
      matchRoomLoadStep(ACTIVE_ROOM_ID, document, 'active'),
      snapshotLoadStep(ACTIVE_ROOM_ID, document),
      eventRowsLoadStep(ACTIVE_ROOM_ID, []),
      pendingRowsLoadStep(ACTIVE_ROOM_ID, []),
    ])

    cleanups.push(mock.assertConsumed)

    const storage = createDbPersistedMatchSessionStorage(mock.client)
    const result = await storage.loadRoomSession(ACTIVE_ROOM_ID)

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'history_conflict',
      },
    })
  })
})

function expectRpc(query: MockQueryInvocation, functionName: string): void {
  expect(query.schema).toBe('gameplay')
  expect(query.table).toBe(functionName)
  expect(query.operation).toBe('rpc')
  expect(query.cardinality).toBe('single')
}

function readRpcPayload(
  query: MockQueryInvocation,
  key: 'create_payload' | 'transition_payload',
): RpcPayloadForTest {
  const values = query.values as Record<string, unknown>
  const payload = values[key]

  if (
    !isRecord(payload) ||
    !isRecord(payload.room) ||
    !Array.isArray(payload.roomPlayers) ||
    !isRecord(payload.snapshot) ||
    !Array.isArray(payload.events) ||
    !Array.isArray(payload.pendingChoices)
  ) {
    throw new Error(`Expected RPC ${key} to contain a payload object.`)
  }

  return {
    room: payload.room,
    roomPlayers: payload.roomPlayers.filter(isRecord),
    snapshot: payload.snapshot,
    events: payload.events.filter(isRecord),
    pendingChoices: payload.pendingChoices.filter(isRecord),
    expectedRoomRevision: payload.expectedRoomRevision,
    expectedHistoryLength: payload.expectedHistoryLength,
  }
}

function matchRoomLoadStep(
  roomId: MatchRoomId,
  document: SerializableMatchSessionDocument,
  status: 'active' | 'completed',
) {
  return {
    assert(query: MockQueryInvocation) {
      expect(query.schema).toBe('gameplay')
      expect(query.table).toBe('match_rooms')
      expect(query.cardinality).toBe('maybeSingle')
      expect(query.filters).toEqual([
        {
          type: 'eq',
          column: 'id',
          value: roomId,
        },
      ])
    },
    response: {
      data: {
        id: roomId,
        status,
        latest_event_sequence: document.history.length,
        latest_snapshot_sequence: Math.max(1, document.room.revision),
        updated_at: document.room.metadata.updatedAt,
      },
      error: null,
    },
  }
}

function snapshotLoadStep(
  roomId: MatchRoomId,
  document: SerializableMatchSessionDocument,
) {
  return {
    assert(query: MockQueryInvocation) {
      expect(query.schema).toBe('gameplay')
      expect(query.table).toBe('room_snapshots')
      expect(query.cardinality).toBe('maybeSingle')
      expect(query.filters).toEqual([
        {
          type: 'eq',
          column: 'room_id',
          value: roomId,
        },
        {
          type: 'eq',
          column: 'is_current',
          value: true,
        },
      ])
    },
    response: {
      data: {
        game_state_payload: document,
        last_event_sequence: document.history.length,
        snapshot_sequence: Math.max(1, document.room.revision),
        is_current: true,
      },
      error: null,
    },
  }
}

function eventRowsLoadStep(
  roomId: MatchRoomId,
  history: readonly MatchRoomHistoryEntry[],
) {
  return {
    assert(query: MockQueryInvocation) {
      expect(query.schema).toBe('gameplay')
      expect(query.table).toBe('room_events')
      expect(query.filters).toEqual([
        {
          type: 'eq',
          column: 'room_id',
          value: roomId,
        },
      ])
      expect(query.orders).toEqual([
        {
          column: 'event_sequence',
          ascending: true,
        },
      ])
    },
    response: {
      data: history.map((entry) => ({
        event_sequence: entry.sequence,
        event_payload: entry,
      })),
      error: null,
    },
  }
}

function pendingRowsLoadStep(
  roomId: MatchRoomId,
  rows: readonly Record<string, unknown>[],
) {
  return {
    assert(query: MockQueryInvocation) {
      expect(query.schema).toBe('gameplay')
      expect(query.table).toBe('pending_choices')
      expect(query.filters).toEqual([
        {
          type: 'eq',
          column: 'room_id',
          value: roomId,
        },
        {
          type: 'eq',
          column: 'status',
          value: 'pending',
        },
      ])
      expect(query.orders).toEqual([
        {
          column: 'created_at',
          ascending: true,
        },
        {
          column: 'id',
          ascending: true,
        },
      ])
    },
    response: {
      data: rows,
      error: null,
    },
  }
}

function makePendingTransitionFixture(roomId: MatchRoomId) {
  const room = makeInitializedRoom(roomId)
  const currentDocument = requireDocument(room, [])
  const accepted = requireAccepted(
    submitMatchRoomCommand(room, systemAdvancePhaseCommand(0), {
      engineAdapters: [
        adapterReturning(
          {
            ...room.engineState,
            status: 'awaiting_choice',
            revision: 1,
            pendingRequests: [mulliganRequest()],
          },
          [mulliganStartedEvent()],
        ),
      ],
      submittedAt: '2026-06-07T10:01:01.000Z',
    }),
  )
  const recorded = recordMatchRoomCommandResult({
    document: currentDocument,
    result: accepted,
    recordedAt: '2026-06-07T10:01:02.000Z',
  })

  if (!recorded.ok) {
    throw new Error(recorded.message)
  }

  return {
    currentDocument,
    accepted,
    nextDocument: recorded.document,
  }
}

function makeCompletedDocument(roomId: MatchRoomId) {
  const room = makeInitializedRoom(roomId)
  const completedState: GameState = {
    ...room.engineState,
    status: 'completed',
    revision: 1,
    pendingRequests: [],
    players: room.engineState.players.map((player) =>
      player.playerId === PLAYER_2
        ? {
            ...player,
            status: 'defeated',
          }
        : player,
    ),
  }
  const accepted = requireAccepted(
    submitMatchRoomCommand(room, systemAdvancePhaseCommand(0), {
      engineAdapters: [adapterReturning(completedState, [])],
      submittedAt: '2026-06-07T10:04:01.000Z',
    }),
  )
  const document = requireDocument(room, [])
  const recorded = recordMatchRoomCommandResult({
    document,
    result: accepted,
    recordedAt: '2026-06-07T10:04:02.000Z',
  })

  if (!recorded.ok) {
    throw new Error(recorded.message)
  }

  return recorded.document
}

function makeInitializedRoom(roomId: MatchRoomId): MatchRoomWithEngineState {
  const room = initializeMatchRoom(
    createMatchRoom({
      roomId,
      formatId: FORMAT_ID,
      hostParticipantId: PARTICIPANT_1,
      createdAt: '2026-06-07T10:00:00.000Z',
      participants: [
        {
          participantId: PARTICIPANT_1,
          seat: 0,
          userId: USER_1,
          displayName: 'Aichi',
        },
        {
          participantId: PARTICIPANT_2,
          seat: 1,
          userId: USER_2,
          displayName: 'Kai',
        },
      ],
    }),
    {
      initialState: makeGameState(),
      initializedAt: '2026-06-07T10:00:00.500Z',
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

  if (!hasMatchRoomEngineState(room)) {
    throw new Error('Expected initialized room to include engine state.')
  }

  return room
}

function makeGameState(): GameState {
  return {
    gameId: 'game-db-storage-1' as GameState['gameId'],
    formatId: FORMAT_ID,
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
    cardStats: buildCardStatsSnapshot(
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
    formatId: FORMAT_ID,
    dispatch() {
      return {
        status: 'accepted' as const,
        transitionId: 'transition-db-storage-1' as TransitionId,
        state,
        events,
        timingWindows: [],
        pendingRequests: state.pendingRequests,
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
    requestId: 'request-db-storage-mulligan' as RequestId,
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
    eventId: 'event-db-storage-mulligan-started' as EventId,
    type: 'mulligan.started',
    sequence: 1,
    origin: {
      kind: 'system',
      system: 'match-setup',
    },
    playerId: PLAYER_1,
    requestId: 'request-db-storage-mulligan' as RequestId,
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

function requireDocument(
  room: MatchRoomWithEngineState,
  history: readonly MatchRoomHistoryEntry[],
): SerializableMatchSessionDocument {
  const document = createSerializableMatchSessionDocument({ room, history })

  if (!document.ok) {
    throw new Error(document.message)
  }

  return document.document
}

function requireEngineRoom(
  document: SerializableMatchSessionDocument,
): MatchRoomWithEngineState {
  if (!hasMatchRoomEngineState(document.room)) {
    throw new Error('Expected document to contain engine state.')
  }

  return document.room
}

function requireAccepted(result: ReturnType<typeof submitMatchRoomCommand>) {
  if (result.status !== 'accepted') {
    throw new Error(
      `Expected accepted command result, received ${result.status}.`,
    )
  }

  return result
}

function requireOk<TData>(result: PersistedMatchSessionResult<TData>): TData {
  expect(result.ok).toBe(true)

  if (!result.ok) {
    throw new Error(result.error.message)
  }

  return result.data
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function buildCardStatsSnapshot(
  cards: NonNullable<GameState['cardStats']>['cards'],
): NonNullable<GameState['cardStats']> {
  return {
    cards: [...cards].sort((left, right) =>
      String(left.cardDefinitionId).localeCompare(
        String(right.cardDefinitionId),
      ),
    ),
  }
}

function requireArrayItem<TItem>(
  items: readonly TItem[],
  index: number,
): TItem {
  const item = items[index]

  if (item === undefined) {
    throw new Error(`Expected array item ${index} to be present.`)
  }

  return item
}
