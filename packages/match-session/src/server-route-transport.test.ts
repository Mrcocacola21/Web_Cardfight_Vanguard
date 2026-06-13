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
  createInMemoryPersistedMatchSessionStorage,
  createPersistedMatchSessionAdapter,
  type PersistedMatchSessionAdapter,
} from './persisted-session-adapter'
import { createFixedMatchRoomClock } from './clock'
import {
  MATCH_REALTIME_TRANSPORT_BASELINE,
  resolveRealtimeMatchRoomTimeout,
  type RealtimeClientCommand,
  type RealtimeClientCommandId,
} from './realtime-runtime'
import {
  MATCH_SERVER_ROUTE_REALTIME_TRANSPORT_SHAPE,
  createServerRouteRealtimeTransport,
} from './server-route-transport'
import {
  createSerializableMatchSessionDocument,
  type SerializableMatchSessionDocument,
} from './session-persistence'

type InitializedSessionDocument = SerializableMatchSessionDocument & {
  readonly room: MatchRoomWithEngineState
}

const ROOM_ID = 'room-server-route-transport-1' as MatchRoomId
const PARTICIPANT_1 =
  'participant-server-route-transport-1' as MatchRoomParticipantId
const PARTICIPANT_2 =
  'participant-server-route-transport-2' as MatchRoomParticipantId
const USER_1 = 'user-server-route-transport-1' as UserId
const USER_2 = 'user-server-route-transport-2' as UserId
const PLAYER_1 = 'player-server-route-transport-1' as PlayerId
const PLAYER_2 = 'player-server-route-transport-2' as PlayerId

describe('@web-vg/match-session server route realtime transport', () => {
  it('uses server-route projected snapshots as the canonical Phase 20 transport baseline', () => {
    expect(MATCH_REALTIME_TRANSPORT_BASELINE).toBe(
      'server_route_commands_with_projected_snapshots',
    )
    expect(MATCH_SERVER_ROUTE_REALTIME_TRANSPORT_SHAPE).toBe(
      'server_route_orchestration_with_projected_snapshots',
    )
  })

  it('submits a participant command through persisted session authority and returns only that participant projection', async () => {
    const document = makeSessionDocument()
    const { sessions, transport } = makeTransport({
      document,
      engineAdapters: [
        makeAcceptedAdapter(
          {
            ...document.room.engineState,
            status: 'ready',
            revision: document.room.engineState.revision + 1,
            players: document.room.engineState.players.map((player) =>
              player.playerId === PLAYER_1
                ? {
                    ...player,
                    status: 'ready',
                  }
                : player,
            ),
          },
          [makeMatchStartedEvent()],
        ),
      ],
    })

    const response = await transport.submitCommand({
      command: makeReadyCommand({
        participantId: PARTICIPANT_1,
        playerId: PLAYER_1,
        expectedRoomRevision: document.room.revision,
        expectedEngineRevision: document.room.engineState.revision,
      }),
      receivedAt: '2026-05-21T10:00:00.000Z',
    })

    expect(response.status).toBe('accepted')

    if (response.status !== 'accepted') {
      throw new Error(`Expected accepted response, got ${response.status}.`)
    }

    expect(response.roomRevision).toBe(document.room.revision + 1)
    expect(response.engineRevision).toBe(document.room.engineState.revision + 1)
    expect(response.acceptedHistoryEntryIds).toHaveLength(1)
    expect(response.projectedUpdate.participantId).toBe(PARTICIPANT_1)
    expect(response.projectedUpdate.reason).toBe('command_accepted')
    expect(JSON.stringify(response)).not.toContain('engineState')
    expect(JSON.stringify(response)).not.toContain('card-p2-hand-secret')
    expect(
      JSON.stringify(response.projectedUpdate.projection.visibleState),
    ).toContain('card-p1-hand-secret')

    const persisted = await sessions.loadRoomSession(ROOM_ID)

    expect(persisted.ok).toBe(true)

    if (!persisted.ok) {
      throw new Error(persisted.error.message)
    }

    expect(persisted.data.document.room.revision).toBe(response.roomRevision)
    expect(persisted.data.document.history).toHaveLength(1)
    expect(persisted.data.document.history[0]?.entryId).toBe(
      response.acceptedHistoryEntryIds[0],
    )
  })

  it('loads reconnect snapshots through the same route transport without exposing canonical state', async () => {
    const document = makeSessionDocument()
    const { transport } = makeTransport({ document })

    const snapshot = await transport.loadParticipantSnapshot({
      roomId: ROOM_ID,
      participantId: PARTICIPANT_2,
      requestedAt: '2026-05-21T10:01:00.000Z',
    })

    expect(snapshot.status).toBe('ok')

    if (snapshot.status !== 'ok') {
      throw new Error(`Expected snapshot response, got ${snapshot.status}.`)
    }

    expect(snapshot.projectedUpdate.reason).toBe('reconnect_snapshot')
    expect(JSON.stringify(snapshot)).not.toContain('engineState')
    expect(JSON.stringify(snapshot)).toContain('card-p2-hand-secret')
    expect(JSON.stringify(snapshot)).not.toContain('card-p1-hand-secret')
  })

  it('lets the other participant observe a persisted accepted update through their own projected snapshot', async () => {
    const document = makeSessionDocument()
    const { transport } = makeTransport({
      document,
      engineAdapters: [
        makeAcceptedAdapter(
          {
            ...document.room.engineState,
            status: 'ready',
            revision: document.room.engineState.revision + 1,
            players: document.room.engineState.players.map((player) =>
              player.playerId === PLAYER_1
                ? {
                    ...player,
                    status: 'ready',
                  }
                : player,
            ),
          },
          [makeMatchStartedEvent()],
        ),
      ],
    })

    const commandResponse = await transport.submitCommand({
      command: makeReadyCommand({
        participantId: PARTICIPANT_1,
        playerId: PLAYER_1,
        expectedRoomRevision: document.room.revision,
        expectedEngineRevision: document.room.engineState.revision,
      }),
      receivedAt: '2026-05-21T10:01:30.000Z',
    })

    expect(commandResponse.status).toBe('accepted')

    if (commandResponse.status !== 'accepted') {
      throw new Error(
        `Expected accepted response, got ${commandResponse.status}.`,
      )
    }

    const otherParticipantSnapshot = await transport.loadParticipantSnapshot({
      roomId: ROOM_ID,
      participantId: PARTICIPANT_2,
      requestedAt: '2026-05-21T10:01:31.000Z',
    })

    expect(otherParticipantSnapshot.status).toBe('ok')

    if (otherParticipantSnapshot.status !== 'ok') {
      throw new Error(
        `Expected snapshot response, got ${otherParticipantSnapshot.status}.`,
      )
    }

    expect(otherParticipantSnapshot.roomRevision).toBe(
      commandResponse.roomRevision,
    )
    expect(otherParticipantSnapshot.engineRevision).toBe(
      commandResponse.engineRevision,
    )
    expect(otherParticipantSnapshot.projectedUpdate.participantId).toBe(
      PARTICIPANT_2,
    )
    expect(
      otherParticipantSnapshot.projectedUpdate.projection.visibleState.players.find(
        (player) => player.playerId === PLAYER_1,
      )?.status,
    ).toBe('ready')
    expect(JSON.stringify(otherParticipantSnapshot)).not.toContain(
      'engineState',
    )
    expect(JSON.stringify(otherParticipantSnapshot)).toContain(
      'card-p2-hand-secret',
    )
    expect(JSON.stringify(otherParticipantSnapshot)).not.toContain(
      'card-p1-hand-secret',
    )
  })

  it('keeps two participants converged through persisted route transport after stale and accepted updates', async () => {
    const document = makeSessionDocument()
    const afterParticipantOneReady = {
      ...document.room.engineState,
      status: 'ready',
      revision: document.room.engineState.revision + 1,
      players: document.room.engineState.players.map((player) =>
        player.playerId === PLAYER_1
          ? {
              ...player,
              status: 'ready' as const,
            }
          : player,
      ),
    }
    const afterParticipantTwoReady = {
      ...afterParticipantOneReady,
      revision: afterParticipantOneReady.revision + 1,
      players: afterParticipantOneReady.players.map((player) =>
        player.playerId === PLAYER_2
          ? {
              ...player,
              status: 'ready' as const,
            }
          : player,
      ),
    }
    const { sessions, transport } = makeTransport({
      document,
      engineAdapters: [
        makeQueuedAcceptedAdapter([
          {
            state: afterParticipantOneReady,
            events: [makeMatchStartedEvent('event-route-sync-ready-one', 1)],
          },
          {
            state: afterParticipantTwoReady,
            events: [makeMatchStartedEvent('event-route-sync-ready-two', 2)],
          },
        ]),
      ],
    })

    const participantOneResponse = await transport.submitCommand({
      command: makeReadyCommand({
        participantId: PARTICIPANT_1,
        playerId: PLAYER_1,
        expectedRoomRevision: document.room.revision,
        expectedEngineRevision: document.room.engineState.revision,
      }),
      receivedAt: '2026-05-21T10:01:00.000Z',
    })

    expect(participantOneResponse.status).toBe('accepted')

    if (participantOneResponse.status !== 'accepted') {
      throw new Error(
        `Expected participant one accepted, got ${participantOneResponse.status}.`,
      )
    }

    const staleParticipantTwoResponse = await transport.submitCommand({
      command: makeReadyCommand({
        participantId: PARTICIPANT_2,
        playerId: PLAYER_2,
        expectedRoomRevision: document.room.revision,
        expectedEngineRevision: document.room.engineState.revision,
      }),
      receivedAt: '2026-05-21T10:01:01.000Z',
    })

    expect(staleParticipantTwoResponse.status).toBe('invalid')

    if (staleParticipantTwoResponse.status !== 'invalid') {
      throw new Error(
        `Expected stale participant two response, got ${staleParticipantTwoResponse.status}.`,
      )
    }

    expect(staleParticipantTwoResponse.code).toBe('stale_room_revision')
    expect(staleParticipantTwoResponse.projectedUpdate?.participantId).toBe(
      PARTICIPANT_2,
    )
    expect(staleParticipantTwoResponse.projectedUpdate?.roomRevision).toBe(
      participantOneResponse.roomRevision,
    )
    expect(JSON.stringify(staleParticipantTwoResponse)).toContain(
      'card-p2-hand-secret',
    )
    expect(JSON.stringify(staleParticipantTwoResponse)).not.toContain(
      'card-p1-hand-secret',
    )

    const participantTwoResponse = await transport.submitCommand({
      command: makeReadyCommand({
        participantId: PARTICIPANT_2,
        playerId: PLAYER_2,
        expectedRoomRevision: participantOneResponse.roomRevision,
        expectedEngineRevision: participantOneResponse.engineRevision,
      }),
      receivedAt: '2026-05-21T10:01:02.000Z',
    })

    expect(participantTwoResponse.status).toBe('accepted')

    if (participantTwoResponse.status !== 'accepted') {
      throw new Error(
        `Expected participant two accepted, got ${participantTwoResponse.status}.`,
      )
    }

    const participantOneRecovered = await transport.loadParticipantSnapshot({
      roomId: ROOM_ID,
      participantId: PARTICIPANT_1,
      requestedAt: '2026-05-21T10:01:03.000Z',
    })

    expect(participantOneRecovered.status).toBe('ok')

    if (participantOneRecovered.status !== 'ok') {
      throw new Error(
        `Expected participant one recovered snapshot, got ${participantOneRecovered.status}.`,
      )
    }

    expect(participantOneRecovered.roomRevision).toBe(
      participantTwoResponse.roomRevision,
    )
    expect(participantOneRecovered.engineRevision).toBe(
      participantTwoResponse.engineRevision,
    )
    expect(
      participantOneRecovered.projectedUpdate.projection.visibleState.players.map(
        (player) => player.status,
      ),
    ).toEqual(['ready', 'ready'])
    expect(JSON.stringify(participantOneRecovered)).toContain(
      'card-p1-hand-secret',
    )
    expect(JSON.stringify(participantOneRecovered)).not.toContain(
      'card-p2-hand-secret',
    )
    expect(JSON.stringify(participantOneRecovered)).not.toContain('engineState')

    const persisted = await sessions.loadRoomSession(ROOM_ID)

    expect(persisted.ok).toBe(true)

    if (!persisted.ok) {
      throw new Error(persisted.error.message)
    }

    expect(persisted.data.document.room.revision).toBe(
      participantTwoResponse.roomRevision,
    )
    expect(persisted.data.document.history).toHaveLength(2)
  })

  it('rejects stale commands at the route boundary and leaves persisted history unchanged', async () => {
    const document = makeSessionDocument()
    const { sessions, transport } = makeTransport({
      document,
      engineAdapters: [
        makeAcceptedAdapter(
          {
            ...document.room.engineState,
            revision: document.room.engineState.revision + 1,
          },
          [makeMatchStartedEvent()],
        ),
      ],
    })

    const response = await transport.submitCommand({
      command: makeReadyCommand({
        participantId: PARTICIPANT_1,
        playerId: PLAYER_1,
        expectedRoomRevision: document.room.revision + 99,
        expectedEngineRevision: document.room.engineState.revision,
      }),
      receivedAt: '2026-05-21T10:02:00.000Z',
    })

    expect(response.status).toBe('invalid')

    if (response.status !== 'invalid') {
      throw new Error(`Expected invalid response, got ${response.status}.`)
    }

    expect(response.code).toBe('stale_room_revision')
    expect(response.projectedUpdate?.roomRevision).toBe(document.room.revision)
    expect(JSON.stringify(response)).not.toContain('engineState')

    const persisted = await sessions.loadRoomSession(ROOM_ID)

    expect(persisted.ok).toBe(true)

    if (!persisted.ok) {
      throw new Error(persisted.error.message)
    }

    expect(persisted.data.document.history).toEqual([])
    expect(persisted.data.document.room.revision).toBe(document.room.revision)
  })

  it('keeps system actions server-owned in the route command contract', async () => {
    const document = makeSessionDocument()
    const { transport } = makeTransport({ document })

    const response = await transport.submitCommand({
      command: {
        commandId: 'server-route-command-system' as RealtimeClientCommandId,
        roomId: ROOM_ID,
        participantId: PARTICIPANT_1,
        expectedRoomRevision: document.room.revision,
        payload: {
          kind: 'action',
          submission: {
            expectedRevision: document.room.engineState.revision,
            action: {
              actionId: 'action-system-forbidden-route' as ActionId,
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
      receivedAt: '2026-05-21T10:03:00.000Z',
    })

    expect(response.status).toBe('invalid')

    if (response.status !== 'invalid') {
      throw new Error(`Expected invalid response, got ${response.status}.`)
    }

    expect(response.code).toBe('client_system_action_forbidden')
    expect(response.projectedUpdate?.participantId).toBe(PARTICIPANT_1)
  })

  it('carries pending request and deadline state through projected route responses', async () => {
    const document = makeSessionDocument()
    const request = makeConfirmRequest()
    const { sessions, transport } = makeTransport({
      document,
      engineAdapters: [
        makeAcceptedAdapter(
          {
            ...document.room.engineState,
            status: 'awaiting_choice',
            revision: document.room.engineState.revision + 1,
            pendingRequests: [request],
          },
          [],
        ),
      ],
    })

    const response = await transport.submitCommand({
      command: makeReadyCommand({
        participantId: PARTICIPANT_1,
        playerId: PLAYER_1,
        expectedRoomRevision: document.room.revision,
        expectedEngineRevision: document.room.engineState.revision,
      }),
      receivedAt: '2026-05-21T10:04:00.000Z',
    })

    expect(response.status).toBe('accepted')

    if (response.status !== 'accepted') {
      throw new Error(`Expected accepted response, got ${response.status}.`)
    }

    expect(response.acceptedHistoryEntryIds).toEqual([])
    expect(
      response.projectedUpdate.projection.clock.activeRequest,
    ).toMatchObject({
      requestId: request.requestId,
      deadlineAt: '2026-05-21T10:06:00.000Z',
    })
    expect(
      response.projectedUpdate.projection.visibleState.pendingRequests[0],
    ).toMatchObject({
      requestId: request.requestId,
      visibilityToViewer: 'full',
    })

    const opponentSnapshot = await transport.loadParticipantSnapshot({
      roomId: ROOM_ID,
      participantId: PARTICIPANT_2,
      requestedAt: '2026-05-21T10:04:01.000Z',
    })

    expect(opponentSnapshot.status).toBe('ok')

    if (opponentSnapshot.status !== 'ok') {
      throw new Error(
        `Expected opponent snapshot, got ${opponentSnapshot.status}.`,
      )
    }

    expect(
      opponentSnapshot.projectedUpdate.projection.visibleState
        .pendingRequests[0],
    ).toMatchObject({
      requestId: request.requestId,
      visibilityToViewer: 'redacted',
    })

    const persisted = await sessions.loadRoomSession(ROOM_ID)

    expect(persisted.ok).toBe(true)

    if (!persisted.ok) {
      throw new Error(persisted.error.message)
    }

    expect(persisted.data.document.room.clock.activeRequest).toMatchObject({
      requestId: request.requestId,
      deadlineAt: '2026-05-21T10:06:00.000Z',
    })
  })

  it('recovers the latest persisted timeout outcome and rejects stale post-recovery commands', async () => {
    const document = makeSessionDocument()
    const request = makeConfirmRequest()
    const { sessions, transport } = makeTransport({
      document,
      engineAdapters: [
        makeAcceptedAdapter(
          {
            ...document.room.engineState,
            status: 'awaiting_choice',
            revision: document.room.engineState.revision + 1,
            pendingRequests: [request],
          },
          [],
        ),
      ],
    })

    const pendingResponse = await transport.submitCommand({
      command: makeReadyCommand({
        participantId: PARTICIPANT_1,
        playerId: PLAYER_1,
        expectedRoomRevision: document.room.revision,
        expectedEngineRevision: document.room.engineState.revision,
      }),
      receivedAt: '2026-05-21T10:04:00.000Z',
    })

    expect(pendingResponse.status).toBe('accepted')

    if (pendingResponse.status !== 'accepted') {
      throw new Error(
        `Expected accepted pending response, got ${pendingResponse.status}.`,
      )
    }

    const pendingDocument = await sessions.loadRoomSession(ROOM_ID)

    expect(pendingDocument.ok).toBe(true)

    if (!pendingDocument.ok) {
      throw new Error(pendingDocument.error.message)
    }

    const timeout = resolveRealtimeMatchRoomTimeout({
      document: pendingDocument.data.document,
      clock: createFixedMatchRoomClock('2026-05-21T10:06:01.000Z'),
    })

    expect(timeout.status).toBe('accepted')

    if (timeout.status !== 'accepted') {
      throw new Error(`Expected accepted timeout, got ${timeout.status}.`)
    }

    const persistedTimeout = await sessions.persistAcceptedRoomTransition({
      currentDocument: pendingDocument.data.document,
      result: timeout.timeoutResult,
      recordedAt: '2026-05-21T10:06:01.000Z',
    })

    expect(persistedTimeout.ok).toBe(true)

    if (!persistedTimeout.ok) {
      throw new Error(persistedTimeout.error.message)
    }

    const recovered = await transport.loadParticipantSnapshot({
      roomId: ROOM_ID,
      participantId: PARTICIPANT_1,
      requestedAt: '2026-05-21T10:06:02.000Z',
    })

    expect(recovered.status).toBe('ok')

    if (recovered.status !== 'ok') {
      throw new Error(`Expected recovered snapshot, got ${recovered.status}.`)
    }

    expect(recovered.projectedUpdate.reason).toBe('reconnect_snapshot')
    expect(recovered.roomRevision).toBe(
      persistedTimeout.data.document.room.revision,
    )
    expect(recovered.projectedUpdate.projection.status).toBe('completed')
    expect(
      recovered.projectedUpdate.projection.clock.activeRequest,
    ).toBeUndefined()
    expect(JSON.stringify(recovered)).not.toContain('engineState')
    expect(JSON.stringify(recovered)).not.toContain('card-p2-hand-secret')

    const staleAfterRecovery = await transport.submitCommand({
      command: makeReadyCommand({
        participantId: PARTICIPANT_1,
        playerId: PLAYER_1,
        expectedRoomRevision: pendingResponse.roomRevision,
        expectedEngineRevision: pendingResponse.engineRevision,
      }),
      receivedAt: '2026-05-21T10:06:03.000Z',
    })

    expect(staleAfterRecovery.status).toBe('invalid')

    if (staleAfterRecovery.status !== 'invalid') {
      throw new Error(
        `Expected stale command rejection, got ${staleAfterRecovery.status}.`,
      )
    }

    expect(staleAfterRecovery.code).toBe('stale_room_revision')
    expect(staleAfterRecovery.projectedUpdate?.roomRevision).toBe(
      recovered.roomRevision,
    )
  })

  it('keeps expired deadlines pending on snapshot load until a server-owned timeout runner persists the outcome', async () => {
    const document = makeSessionDocument()
    const request = makeConfirmRequest()
    const { sessions, transport } = makeTransport({
      document,
      engineAdapters: [
        makeAcceptedAdapter(
          {
            ...document.room.engineState,
            status: 'awaiting_choice',
            revision: document.room.engineState.revision + 1,
            pendingRequests: [request],
          },
          [],
        ),
      ],
    })

    const pendingResponse = await transport.submitCommand({
      command: makeReadyCommand({
        participantId: PARTICIPANT_1,
        playerId: PLAYER_1,
        expectedRoomRevision: document.room.revision,
        expectedEngineRevision: document.room.engineState.revision,
      }),
      receivedAt: '2026-05-21T10:04:00.000Z',
    })

    expect(pendingResponse.status).toBe('accepted')

    if (pendingResponse.status !== 'accepted') {
      throw new Error(
        `Expected accepted pending response, got ${pendingResponse.status}.`,
      )
    }

    const expiredSnapshot = await transport.loadParticipantSnapshot({
      roomId: ROOM_ID,
      participantId: PARTICIPANT_1,
      requestedAt: '2026-05-21T10:06:01.000Z',
    })

    expect(expiredSnapshot.status).toBe('ok')

    if (expiredSnapshot.status !== 'ok') {
      throw new Error(
        `Expected expired snapshot response, got ${expiredSnapshot.status}.`,
      )
    }

    expect(expiredSnapshot.roomRevision).toBe(pendingResponse.roomRevision)
    expect(expiredSnapshot.projectedUpdate.projection.status).toBe(
      'in_progress',
    )
    expect(expiredSnapshot.projectedUpdate.projection.visibleState.status).toBe(
      'awaiting_choice',
    )
    expect(
      expiredSnapshot.projectedUpdate.projection.clock.activeRequest,
    ).toMatchObject({
      requestId: request.requestId,
      deadlineAt: '2026-05-21T10:06:00.000Z',
    })
    expect(
      expiredSnapshot.projectedUpdate.projection.visibleState
        .pendingRequests[0],
    ).toMatchObject({
      requestId: request.requestId,
      visibilityToViewer: 'full',
    })

    const persisted = await sessions.loadRoomSession(ROOM_ID)

    expect(persisted.ok).toBe(true)

    if (!persisted.ok) {
      throw new Error(persisted.error.message)
    }

    expect(persisted.data.document.room.revision).toBe(
      pendingResponse.roomRevision,
    )
    expect(persisted.data.document.room.clock.activeRequest).toMatchObject({
      requestId: request.requestId,
      deadlineAt: '2026-05-21T10:06:00.000Z',
    })
  })

  it('returns room-not-found as a structured route transport failure', async () => {
    const { transport } = makeTransport({
      document: makeSessionDocument(),
    })

    const response = await transport.loadParticipantSnapshot({
      roomId: 'room-server-route-missing' as MatchRoomId,
      participantId: PARTICIPANT_1,
      requestedAt: '2026-05-21T10:05:00.000Z',
    })

    expect(response).toMatchObject({
      status: 'invalid',
      code: 'room_not_found',
    })
  })
})

function makeTransport(input: {
  readonly document: InitializedSessionDocument
  readonly engineAdapters?: readonly MatchRoomEngineAdapter[]
}): {
  readonly sessions: PersistedMatchSessionAdapter
  readonly transport: ReturnType<typeof createServerRouteRealtimeTransport>
} {
  const sessions = createPersistedMatchSessionAdapter({
    storage: createInMemoryPersistedMatchSessionStorage([input.document]),
  })

  return {
    sessions,
    transport: createServerRouteRealtimeTransport({
      sessions,
      ...(input.engineAdapters === undefined
        ? {}
        : { engineAdapters: input.engineAdapters }),
    }),
  }
}

function makeSessionDocument(): InitializedSessionDocument {
  const room = initializeMatchRoom(
    createMatchRoom({
      roomId: ROOM_ID,
      formatId: STANDARD_FORMAT_ID,
      hostParticipantId: PARTICIPANT_1,
      createdAt: '2026-05-21T09:50:00.000Z',
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
      initialState: makeState(),
      initializedAt: '2026-05-21T09:55:00.000Z',
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
      `server-route-command-ready-${input.participantId}` as RealtimeClientCommandId,
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

function makeQueuedAcceptedAdapter(
  steps: readonly {
    readonly state: GameState
    readonly events: readonly GameEvent[]
  }[],
): MatchRoomEngineAdapter {
  let index = 0

  return {
    adapterId: MATCH_ROOM_STANDARD_ENGINE_ADAPTER_ID,
    formatId: STANDARD_FORMAT_ID,
    dispatch() {
      const step = steps[Math.min(index, steps.length - 1)]

      index += 1

      if (step === undefined) {
        throw new Error('Queued accepted adapter requires at least one step.')
      }

      return {
        status: 'accepted',
        transitionId:
          `transition-server-route-accepted-${index}` as TransitionId,
        state: step.state,
        events: step.events,
        timingWindows: [],
        pendingRequests: step.state.pendingRequests,
      }
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
        transitionId: 'transition-server-route-accepted' as TransitionId,
        state,
        events,
        timingWindows: [],
        pendingRequests: state.pendingRequests,
      }
    },
  }
}

function makeMatchStartedEvent(
  eventId: string = 'event-server-route-started',
  sequence = 1,
): GameEvent {
  return {
    eventId: eventId as EventId,
    type: 'match.started',
    sequence,
    origin: {
      kind: 'system',
      system: 'match-setup',
    },
    startingPlayerId: PLAYER_1,
  }
}

function makeConfirmRequest(): GameState['pendingRequests'][number] {
  return {
    requestId: 'request-server-route-confirm' as RequestId,
    type: 'confirm.boolean',
    responderPlayerId: PLAYER_1,
    purpose: 'rule',
    visibility: 'responder-only',
  }
}

function makeState(): GameState {
  return {
    gameId: 'game-server-route-transport-1' as GameId,
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
      player(PLAYER_1, 0, ['zone-p1-hand', 'zone-p1-vanguard']),
      player(PLAYER_2, 1, ['zone-p2-hand', 'zone-p2-vanguard']),
    ],
    zones: [
      zone('zone-p1-hand', 'hand', PLAYER_1, 'owner-private', [
        'piece-p1-hand-secret',
      ]),
      zone('zone-p1-vanguard', 'vanguard_circle', PLAYER_1, 'public', [
        'piece-p1-vanguard',
      ]),
      zone('zone-p2-hand', 'hand', PLAYER_2, 'owner-private', [
        'piece-p2-hand-secret',
      ]),
      zone('zone-p2-vanguard', 'vanguard_circle', PLAYER_2, 'public', [
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

function player(
  playerId: PlayerId,
  seat: number,
  ownedZoneIds: readonly string[],
): GameState['players'][number] {
  return {
    playerId,
    seat,
    status: 'waiting',
    ownedZoneIds: ownedZoneIds.map((zoneId) => zoneId as ZoneId),
    counters: [],
    flags: [],
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
