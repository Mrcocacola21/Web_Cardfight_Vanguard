import { describe, expect, it } from 'vitest'

import type {
  ActionId,
  EventId,
  GameEvent,
  GameId,
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
  MATCH_ROOM_STANDARD_ENGINE_ADAPTER_ID,
  createMatchRoom,
  initializeMatchRoom,
  type MatchRoomEngineAdapter,
  type MatchRoomId,
  type MatchRoomParticipantId,
  type MatchRoomWithEngineState,
} from './match-room'
import {
  createRealtimeParticipantSnapshot,
  resolveRealtimeMatchRoomTimeout,
  submitRealtimeClientCommand,
  MATCH_REALTIME_TRANSPORT_BASELINE,
  type RealtimeClientCommand,
  type RealtimeClientCommandId,
} from './realtime-runtime'
import { createFixedMatchRoomClock } from './clock'
import {
  createSerializableMatchSessionDocument,
  type SerializableMatchSessionDocument,
} from './session-persistence'

type InitializedSessionDocument = SerializableMatchSessionDocument & {
  readonly room: MatchRoomWithEngineState
}

const ROOM_ID = 'room-realtime-1' as MatchRoomId
const PARTICIPANT_1 = 'participant-realtime-1' as MatchRoomParticipantId
const PARTICIPANT_2 = 'participant-realtime-2' as MatchRoomParticipantId
const USER_1 = 'user-realtime-1' as UserId
const USER_2 = 'user-realtime-2' as UserId
const PLAYER_1 = 'engine-player-realtime-1' as PlayerId
const PLAYER_2 = 'engine-player-realtime-2' as PlayerId

describe('@web-vg/match-session realtime runtime contract', () => {
  it('accepts a participant command through the authoritative session path and pushes projected snapshots', () => {
    const document = makeSessionDocument()
    const nextState = {
      ...document.room.engineState,
      revision: document.room.engineState.revision + 1,
      status: 'ready',
      players: document.room.engineState.players.map((player) =>
        player.playerId === PLAYER_1
          ? { ...player, status: 'ready' as const }
          : player,
      ),
    } satisfies GameState
    const events = [makeMatchStartedEvent()]
    const result = submitRealtimeClientCommand({
      document,
      command: makeReadyCommand({
        participantId: PARTICIPANT_1,
        playerId: PLAYER_1,
        expectedRoomRevision: document.room.revision,
        expectedEngineRevision: document.room.engineState.revision,
      }),
      engineAdapters: [makeAcceptedAdapter(nextState, events)],
      receivedAt: '2026-05-15T09:00:00.000Z',
    })

    expect(result.status).toBe('accepted')

    if (result.status !== 'accepted') {
      throw new Error(`Expected accepted result, received ${result.status}.`)
    }

    expect(MATCH_REALTIME_TRANSPORT_BASELINE).toBe(
      'websocket_commands_with_projected_snapshots',
    )
    expect(result.document.room.revision).toBe(document.room.revision + 1)
    expect(result.acceptedHistory).toHaveLength(1)
    expect(result.document.history).toHaveLength(1)
    const acceptedHistoryEntry = result.acceptedHistory[0]

    expect(acceptedHistoryEntry).toBeDefined()

    if (acceptedHistoryEntry === undefined) {
      throw new Error('Expected one accepted history entry.')
    }

    expect(result.pushes.map((push) => push.participantId)).toEqual([
      PARTICIPANT_1,
      PARTICIPANT_2,
    ])
    expect(
      result.pushes.every((push) => push.reason === 'command_accepted'),
    ).toBe(true)
    expect(
      result.pushes.every(
        (push) =>
          push.roomRevision === result.document.room.revision &&
          push.engineRevision === result.roomResult.engineResult.state.revision,
      ),
    ).toBe(true)
    expect(
      result.pushes.every((push) =>
        push.acceptedHistoryEntryIds.includes(acceptedHistoryEntry.entryId),
      ),
    ).toBe(true)

    const playerOnePush = result.pushes.find(
      (push) => push.participantId === PARTICIPANT_1,
    )
    const playerTwoPush = result.pushes.find(
      (push) => push.participantId === PARTICIPANT_2,
    )

    expect(playerOnePush).toBeDefined()
    expect(playerTwoPush).toBeDefined()

    if (playerOnePush === undefined || playerTwoPush === undefined) {
      throw new Error('Expected both participant projections.')
    }

    expect(JSON.stringify(playerOnePush.projection.visibleState)).toContain(
      'piece-p1-hand-secret',
    )
    expect(JSON.stringify(playerOnePush.projection.visibleState)).not.toContain(
      'piece-p2-hand-secret',
    )
    expect(JSON.stringify(playerTwoPush.projection.visibleState)).toContain(
      'piece-p2-hand-secret',
    )
    expect(JSON.stringify(playerTwoPush.projection.visibleState)).not.toContain(
      'piece-p1-hand-secret',
    )
  })

  it('rejects stale room revisions before dispatch and keeps accepted history unchanged', () => {
    const document = makeSessionDocument()
    const result = submitRealtimeClientCommand({
      document,
      command: makeReadyCommand({
        participantId: PARTICIPANT_1,
        playerId: PLAYER_1,
        expectedRoomRevision: document.room.revision + 99,
        expectedEngineRevision: document.room.engineState.revision,
      }),
      engineAdapters: [
        makeAcceptedAdapter({ ...document.room.engineState, revision: 99 }, [
          makeMatchStartedEvent(),
        ]),
      ],
    })

    expect(result.status).toBe('invalid')

    if (result.status !== 'invalid') {
      throw new Error(`Expected invalid result, received ${result.status}.`)
    }

    expect(result.code).toBe('stale_room_revision')
    expect(result.document).toBe(document)
    expect(result.document.history).toHaveLength(0)
    expect(result.pushes).toEqual([])
  })

  it('keeps system actions server-owned at the realtime client boundary', () => {
    const document = makeSessionDocument()
    const result = submitRealtimeClientCommand({
      document,
      command: {
        commandId: 'realtime-command-system' as RealtimeClientCommandId,
        roomId: ROOM_ID,
        participantId: PARTICIPANT_1,
        expectedRoomRevision: document.room.revision,
        payload: {
          kind: 'action',
          submission: {
            expectedRevision: document.room.engineState.revision,
            action: {
              actionId: 'action-system-forbidden' as ActionId,
              type: 'system.advance_phase',
              actor: {
                kind: 'system',
                system: 'automatic-flow',
              },
              nextPhase: 'main',
            },
          },
        },
      },
      engineAdapters: [
        makeAcceptedAdapter({ ...document.room.engineState, revision: 99 }, [
          makeMatchStartedEvent(),
        ]),
      ],
    })

    expect(result.status).toBe('invalid')

    if (result.status !== 'invalid') {
      throw new Error(`Expected invalid result, received ${result.status}.`)
    }

    expect(result.code).toBe('client_system_action_forbidden')
    expect(result.document).toBe(document)
    expect(result.document.history).toHaveLength(0)
  })

  it('lets the session authority reject commands from the wrong participant', () => {
    const document = makeSessionDocument()
    const result = submitRealtimeClientCommand({
      document,
      command: makeReadyCommand({
        participantId: PARTICIPANT_2,
        playerId: PLAYER_1,
        expectedRoomRevision: document.room.revision,
        expectedEngineRevision: document.room.engineState.revision,
      }),
      engineAdapters: [
        makeAcceptedAdapter({ ...document.room.engineState, revision: 99 }, [
          makeMatchStartedEvent(),
        ]),
      ],
    })

    expect(result.status).toBe('invalid')

    if (result.status !== 'invalid') {
      throw new Error(`Expected invalid result, received ${result.status}.`)
    }

    expect(result.code).toBe('actor_participant_mismatch')
    expect(result.document).toBe(document)
    expect(result.pushes).toEqual([])
  })

  it('surfaces blocked engine results without mutating the persisted session document', () => {
    const document = makeSessionDocument()
    const result = submitRealtimeClientCommand({
      document,
      command: makeReadyCommand({
        participantId: PARTICIPANT_1,
        playerId: PLAYER_1,
        expectedRoomRevision: document.room.revision,
        expectedEngineRevision: document.room.engineState.revision,
      }),
      engineAdapters: [makeBlockedAdapter(document.room.engineState)],
    })

    expect(result.status).toBe('blocked')

    if (result.status !== 'blocked') {
      throw new Error(`Expected blocked result, received ${result.status}.`)
    }

    expect(result.code).toBe('pending_request')
    expect(result.document).toBe(document)
    expect(result.document.history).toHaveLength(0)
    expect(result.pushes).toEqual([])
  })

  it('rejects commands against closed rooms through the session authority', () => {
    const document = makeSessionDocument()
    const closedDocument: InitializedSessionDocument = {
      ...document,
      room: {
        ...document.room,
        status: 'completed',
        metadata: {
          ...document.room.metadata,
          completedAt: '2026-05-15T09:05:00.000Z',
          updatedAt: '2026-05-15T09:05:00.000Z',
        },
      },
    }
    const result = submitRealtimeClientCommand({
      document: closedDocument,
      command: makeReadyCommand({
        participantId: PARTICIPANT_1,
        playerId: PLAYER_1,
        expectedRoomRevision: closedDocument.room.revision,
        expectedEngineRevision: closedDocument.room.engineState.revision,
      }),
      engineAdapters: [
        makeAcceptedAdapter(
          { ...closedDocument.room.engineState, revision: 99 },
          [makeMatchStartedEvent()],
        ),
      ],
    })

    expect(result.status).toBe('invalid')

    if (result.status !== 'invalid') {
      throw new Error(`Expected invalid result, received ${result.status}.`)
    }

    expect(result.code).toBe('room_closed')
    expect(result.document).toBe(closedDocument)
    expect(result.pushes).toEqual([])
  })

  it('resolves expired request deadlines as authoritative realtime timeout pushes', () => {
    const document = makeSessionDocument()
    const request = makeConfirmRequest('request-realtime-timeout')
    const pendingState: GameState = {
      ...document.room.engineState,
      status: 'awaiting_choice',
      revision: document.room.engineState.revision + 1,
      pendingRequests: [request],
    }
    const pendingResult = submitRealtimeClientCommand({
      document,
      command: makeReadyCommand({
        participantId: PARTICIPANT_1,
        playerId: PLAYER_1,
        expectedRoomRevision: document.room.revision,
        expectedEngineRevision: document.room.engineState.revision,
      }),
      engineAdapters: [makeAcceptedAdapter(pendingState, [])],
      receivedAt: '2026-05-15T09:00:00.000Z',
    })

    expect(pendingResult.status).toBe('accepted')

    if (pendingResult.status !== 'accepted') {
      throw new Error(
        `Expected accepted pending result, received ${pendingResult.status}.`,
      )
    }

    expect(pendingResult.document.room.clock.activeRequest).toMatchObject({
      requestId: request.requestId,
      deadlineAt: '2026-05-15T09:02:00.000Z',
    })

    const timeoutResult = resolveRealtimeMatchRoomTimeout({
      document: pendingResult.document,
      clock: createFixedMatchRoomClock('2026-05-15T09:02:01.000Z'),
    })

    expect(timeoutResult.status).toBe('accepted')

    if (timeoutResult.status !== 'accepted') {
      throw new Error(
        `Expected accepted timeout, received ${timeoutResult.status}.`,
      )
    }

    expect(timeoutResult.timeoutResult.timeout).toMatchObject({
      kind: 'request',
      requestId: request.requestId,
      responderPlayerId: PLAYER_1,
      timeoutReason: 'request_timeout',
    })
    expect(timeoutResult.document.room.status).toBe('completed')
    expect(timeoutResult.document.room.clock.serverNow).toBe(
      '2026-05-15T09:02:01.000Z',
    )
    expect(timeoutResult.document.room.clock.activeRequest).toBeUndefined()
    expect(timeoutResult.acceptedHistory).toHaveLength(2)
    expect(timeoutResult.acceptedHistory[1]?.event).toMatchObject({
      kind: 'engine_event',
      event: {
        type: 'match.ended',
        reason: 'timeout',
        timeoutReason: 'request_timeout',
      },
    })
    expect(
      timeoutResult.pushes.every((push) => push.reason === 'timeout_resolved'),
    ).toBe(true)
    expect(
      timeoutResult.pushes.every(
        (push) =>
          push.projection.clock.serverNow === '2026-05-15T09:02:01.000Z',
      ),
    ).toBe(true)
    expect(
      timeoutResult.pushes.every(
        (push) => push.projection.clock.activeRequest === undefined,
      ),
    ).toBe(true)

    if (!('engineState' in timeoutResult.document.room)) {
      throw new Error('Expected timeout document room to include engine state.')
    }

    const staleResponse = submitRealtimeClientCommand({
      document: timeoutResult.document,
      command: makeConfirmResponseCommand({
        requestId: request.requestId,
        expectedRoomRevision: timeoutResult.document.room.revision,
        expectedEngineRevision:
          timeoutResult.document.room.engineState.revision,
      }),
      receivedAt: '2026-05-15T09:02:02.000Z',
    })

    expect(staleResponse.status).toBe('invalid')

    if (staleResponse.status !== 'invalid') {
      throw new Error(
        `Expected invalid stale response, received ${staleResponse.status}.`,
      )
    }

    expect(staleResponse.code).toBe('room_closed')
    expect(staleResponse.document).toBe(timeoutResult.document)
    expect(staleResponse.pushes).toEqual([])
  })

  it('can produce a reconnect snapshot from the canonical session document without network transport', () => {
    const document = makeSessionDocument()
    const snapshot = createRealtimeParticipantSnapshot({
      document,
      participantId: PARTICIPANT_1,
    })

    expect(snapshot.ok).toBe(true)

    if (!snapshot.ok) {
      throw new Error(snapshot.message)
    }

    expect(snapshot.push.reason).toBe('reconnect_snapshot')
    expect(snapshot.push.roomId).toBe(ROOM_ID)
    expect(snapshot.push.participantId).toBe(PARTICIPANT_1)
    expect(JSON.stringify(snapshot.push.projection.visibleState)).toContain(
      'piece-p1-hand-secret',
    )
    expect(JSON.stringify(snapshot.push.projection.visibleState)).not.toContain(
      'piece-p2-hand-secret',
    )
  })
})

function makeSessionDocument(): InitializedSessionDocument {
  const room = initializeMatchRoom(
    createMatchRoom({
      roomId: ROOM_ID,
      formatId: STANDARD_FORMAT_ID,
      hostParticipantId: PARTICIPANT_1,
      createdAt: '2026-05-15T08:50:00.000Z',
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
      initialState: makeRealtimeState(),
      initializedAt: '2026-05-15T08:55:00.000Z',
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
  const document = createSerializableMatchSessionDocument({ room })

  if (!document.ok) {
    throw new Error(document.message)
  }

  return document.document as InitializedSessionDocument
}

function makeReadyCommand(input: {
  readonly participantId: MatchRoomParticipantId
  readonly playerId: PlayerId
  readonly expectedRoomRevision: number
  readonly expectedEngineRevision: number
}): RealtimeClientCommand {
  return {
    commandId:
      `realtime-command-${input.participantId}` as RealtimeClientCommandId,
    roomId: ROOM_ID,
    participantId: input.participantId,
    expectedRoomRevision: input.expectedRoomRevision,
    payload: {
      kind: 'action',
      submission: {
        expectedRevision: input.expectedEngineRevision,
        action: {
          actionId: `action-ready-${input.playerId}` as ActionId,
          type: 'match.ready',
          actor: {
            kind: 'player',
            playerId: input.playerId,
          },
        },
      },
    },
  }
}

function makeConfirmResponseCommand(input: {
  readonly requestId: RequestId
  readonly expectedRoomRevision: number
  readonly expectedEngineRevision: number
}): RealtimeClientCommand {
  return {
    commandId: 'realtime-command-timeout-response' as RealtimeClientCommandId,
    roomId: ROOM_ID,
    participantId: PARTICIPANT_1,
    expectedRoomRevision: input.expectedRoomRevision,
    payload: {
      kind: 'choice_response',
      submission: {
        expectedRevision: input.expectedEngineRevision,
        response: {
          requestId: input.requestId,
          responderPlayerId: PLAYER_1,
          type: 'answer.boolean',
          accepted: true,
        },
      },
    },
  }
}

function makeAcceptedAdapter(
  state: GameState,
  events: readonly GameEvent[],
): MatchRoomEngineAdapter {
  return {
    adapterId: MATCH_ROOM_STANDARD_ENGINE_ADAPTER_ID,
    formatId: STANDARD_FORMAT_ID,
    dispatch() {
      return {
        status: 'accepted',
        transitionId: 'transition-realtime-accepted' as TransitionId,
        state,
        events,
        timingWindows: [],
        pendingRequests: state.pendingRequests,
      }
    },
  }
}

function makeBlockedAdapter(state: GameState): MatchRoomEngineAdapter {
  return {
    adapterId: MATCH_ROOM_STANDARD_ENGINE_ADAPTER_ID,
    formatId: STANDARD_FORMAT_ID,
    dispatch() {
      return {
        status: 'blocked',
        transitionId: 'transition-realtime-blocked' as TransitionId,
        state,
        events: [],
        timingWindows: [],
        pendingRequests: state.pendingRequests,
        code: 'pending_request',
        message: 'Engine is waiting on a pending request.',
        blockingRequests: [],
      }
    },
  }
}

function makeMatchStartedEvent(): GameEvent {
  return {
    eventId: 'event-realtime-started' as EventId,
    type: 'match.started',
    sequence: 1,
    origin: {
      kind: 'system',
      system: 'match-setup',
    },
    startingPlayerId: PLAYER_1,
  }
}

function makeConfirmRequest(
  requestId: string,
): GameState['pendingRequests'][number] {
  return {
    requestId: requestId as RequestId,
    type: 'confirm.boolean',
    responderPlayerId: PLAYER_1,
    purpose: 'rule',
    visibility: 'responder-only',
  }
}

function makeRealtimeState(): GameState {
  const zoneIds = {
    p1Hand: 'zone-p1-hand',
    p1Vanguard: 'zone-p1-vanguard',
    p2Hand: 'zone-p2-hand',
    p2Vanguard: 'zone-p2-vanguard',
  } as const

  return {
    gameId: 'game-realtime-1' as GameId,
    formatId: STANDARD_FORMAT_ID,
    status: 'setup',
    revision: 8,
    turn: {
      turnNumber: 0,
      turnPlayerId: PLAYER_1,
      phase: 'pregame',
      step: 'setup',
    },
    players: [
      {
        playerId: PLAYER_1,
        seat: 0,
        status: 'waiting',
        ownedZoneIds: [zoneIds.p1Hand, zoneIds.p1Vanguard].map(
          (zoneId) => zoneId as ZoneId,
        ),
        counters: [],
        flags: [],
      },
      {
        playerId: PLAYER_2,
        seat: 1,
        status: 'waiting',
        ownedZoneIds: [zoneIds.p2Hand, zoneIds.p2Vanguard].map(
          (zoneId) => zoneId as ZoneId,
        ),
        counters: [],
        flags: [],
      },
    ],
    zones: [
      zone(zoneIds.p1Hand, 'hand', PLAYER_1, 'owner-private', [
        'piece-p1-hand-secret',
      ]),
      zone(zoneIds.p1Vanguard, 'vanguard_circle', PLAYER_1, 'public', [
        'piece-p1-vanguard',
      ]),
      zone(zoneIds.p2Hand, 'hand', PLAYER_2, 'owner-private', [
        'piece-p2-hand-secret',
      ]),
      zone(zoneIds.p2Vanguard, 'vanguard_circle', PLAYER_2, 'public', [
        'piece-p2-vanguard',
      ]),
    ],
    pieces: [
      piece('piece-p1-hand-secret', 'card-p1-hand-secret', PLAYER_1),
      piece('piece-p1-vanguard', 'card-p1-vanguard', PLAYER_1),
      piece('piece-p2-hand-secret', 'card-p2-hand-secret', PLAYER_2),
      piece('piece-p2-vanguard', 'card-p2-vanguard', PLAYER_2),
    ],
    cardStats: buildEngineCardStatsSnapshot(
      [
        'card-p1-hand-secret',
        'card-p1-vanguard',
        'card-p2-hand-secret',
        'card-p2-vanguard',
      ].map((cardDefinitionId) => ({
        cardDefinitionId: cardDefinitionId as CardId,
        cardType: 'normal-unit',
        grade: 0,
        power: 6000,
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

function zone(
  zoneId: string,
  kind: GameState['zones'][number]['kind'],
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
      occupancy: kind === 'vanguard_circle' ? 'single' : 'multi',
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
