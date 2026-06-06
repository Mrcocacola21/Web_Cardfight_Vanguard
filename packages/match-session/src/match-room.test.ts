import { describe, expect, expectTypeOf, it } from 'vitest'

import type {
  ActionId,
  GameState,
  PlayerId,
  RequestId,
  TransitionId,
} from '@web-vg/rules-core'
import {
  RulesInvariantError,
  STANDARD_FORMAT_ID,
  buildEngineCardStatsSnapshot,
} from '@web-vg/rules-core'
import type { CardId, UserId } from '@web-vg/shared'

import {
  MatchRoomInvariantError,
  createMatchRoom,
  findMatchRoomParticipantByPlayerId,
  getMatchRoomEngineRevision,
  hasMatchRoomEngineState,
  initializeMatchRoom,
  resolveMatchRoomTimeout,
  submitMatchRoomCommand,
} from './match-room'
import type {
  MatchRoom,
  MatchRoomEngineAdapter,
  MatchRoomId,
  MatchRoomParticipant,
  MatchRoomParticipantId,
} from './match-room'

type HasKey<TValue, TKey extends PropertyKey> = TKey extends keyof TValue
  ? true
  : false

const ROOM_ID = 'room-live-1' as MatchRoomId
const PARTICIPANT_1 = 'participant-1' as MatchRoomParticipantId
const PARTICIPANT_2 = 'participant-2' as MatchRoomParticipantId
const USER_1 = 'user-1' as UserId
const USER_2 = 'user-2' as UserId
const PLAYER_1 = 'engine-player-1' as PlayerId
const PLAYER_2 = 'engine-player-2' as PlayerId

function makeGameState(
  options: {
    readonly status?: Extract<GameState['status'], 'setup' | 'ready'>
    readonly revision?: number
  } = {},
): GameState {
  const status = options.status ?? 'setup'
  const playerStatus = status === 'ready' ? 'ready' : 'waiting'

  return {
    gameId: 'game-live-1' as GameState['gameId'],
    formatId: STANDARD_FORMAT_ID,
    status,
    revision: options.revision ?? 0,
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
        status: playerStatus,
        ownedZoneIds: [],
        counters: [],
        flags: [],
      },
      {
        playerId: PLAYER_2,
        seat: 1,
        status: playerStatus,
        ownedZoneIds: [],
        counters: [],
        flags: [],
      },
    ],
    zones: [],
    pieces: [],
    pieceStates: [],
    flags: [],
    pendingRequests: [],
  }
}

function makeGameStateWithCard(
  options: { readonly includeCardStats?: boolean } = {},
): GameState {
  const baseState = makeGameState()
  const cardDefinitionId = 'card-session-vanguard' as CardId

  return {
    ...baseState,
    players: baseState.players.map((player) =>
      player.playerId === PLAYER_1
        ? {
            ...player,
            ownedZoneIds: [
              'zone-session-vanguard' as GameState['zones'][number]['zoneId'],
            ],
          }
        : player,
    ),
    zones: [
      {
        zoneId: 'zone-session-vanguard' as GameState['zones'][number]['zoneId'],
        kind: 'vanguard_circle',
        scope: 'player',
        ownerPlayerId: PLAYER_1,
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'single',
        },
        occupants: [
          {
            pieceId:
              'piece-session-vanguard' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
    ],
    pieces: [
      {
        pieceId:
          'piece-session-vanguard' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        cardDefinitionId,
        ownerPlayerId: PLAYER_1,
        controllerPlayerId: PLAYER_1,
      },
    ],
    ...(options.includeCardStats === true
      ? {
          cardStats: buildEngineCardStatsSnapshot([
            {
              cardDefinitionId,
              cardType: 'normal-unit',
              grade: 3,
              power: 13000,
              shield: 0,
              critical: 1,
              triggerType: null,
              keywords: [],
            },
          ]),
        }
      : {}),
  }
}

function makeCreatedRoom() {
  return createMatchRoom({
    roomId: ROOM_ID,
    formatId: STANDARD_FORMAT_ID,
    hostParticipantId: PARTICIPANT_1,
    createdAt: '2026-05-07T09:00:00.000Z',
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
  })
}

function makeInitializedRoom(initialState = makeGameState()) {
  return initializeMatchRoom(makeCreatedRoom(), {
    initialState,
    initializedAt: '2026-05-07T09:01:00.000Z',
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
  })
}

function makeConfirmRequest(
  requestId = 'request-confirm-1',
  responderPlayerId = PLAYER_1,
): GameState['pendingRequests'][number] {
  return {
    requestId: requestId as RequestId,
    type: 'confirm.boolean',
    responderPlayerId,
    purpose: 'rule',
    visibility: 'responder-only',
  }
}

function makeAcceptedAdapter(
  room: MatchRoom & { readonly engineState: GameState },
  nextState: GameState,
): MatchRoomEngineAdapter {
  return {
    adapterId: room.engineAdapterId,
    formatId: room.formatId,
    dispatch() {
      return {
        status: 'accepted',
        transitionId: 'transition-room-clock-accepted' as TransitionId,
        state: nextState,
        events: [],
        timingWindows: [],
        pendingRequests: nextState.pendingRequests,
      }
    },
  }
}

function systemAdvanceCommand(expectedRevision: number) {
  return {
    source: {
      kind: 'system',
      source: 'match-runtime',
    },
    command: {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-room-clock-advance' as ActionId,
          type: 'system.advance_phase',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          nextPhase: 'main',
        },
        expectedRevision,
      },
    },
  } as const
}

describe('@web-vg/match-session match room model', () => {
  it('creates a live room shell and initializes it around an engine GameState', () => {
    const createdRoom = makeCreatedRoom()
    const initialState = makeGameState()

    expect(createdRoom.status).toBe('created')
    expect(hasMatchRoomEngineState(createdRoom)).toBe(false)
    expect(createdRoom.formatId).toBe(STANDARD_FORMAT_ID)
    expect(
      createdRoom.participants.map((participant) => participant.seat),
    ).toEqual([0, 1])

    const initializedRoom = initializeMatchRoom(createdRoom, {
      initialState,
      initializedAt: '2026-05-07T09:01:00.000Z',
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
    })

    expect(initializedRoom.status).toBe('initialized')
    expect(initializedRoom.revision).toBe(1)
    expect(initializedRoom.engineState).toBe(initialState)
    expect(getMatchRoomEngineRevision(initializedRoom)).toBe(0)
    expect(
      findMatchRoomParticipantByPlayerId(initializedRoom, PLAYER_1)
        ?.participantId,
    ).toBe(PARTICIPANT_1)
    expect(initializedRoom.participants[0]?.userId).toBe(USER_1)
    expect(initializedRoom.participants[0]?.enginePlayerId).toBe(PLAYER_1)
    expect(initializedRoom.participants[0]?.userId).not.toBe(PLAYER_1)
  })

  it('requires explicit participant-to-engine-player bindings during initialization', () => {
    const createdRoom = makeCreatedRoom()
    const initialState = makeGameState()

    expect(() =>
      initializeMatchRoom(createdRoom, {
        initialState,
        playerBindings: [
          {
            participantId: PARTICIPANT_1,
            playerId: PLAYER_1,
          },
        ],
      }),
    ).toThrow(MatchRoomInvariantError)

    expect(() =>
      initializeMatchRoom(createdRoom, {
        initialState,
        playerBindings: [
          {
            participantId: PARTICIPANT_1,
            playerId: PLAYER_2,
          },
          {
            participantId: PARTICIPANT_2,
            playerId: PLAYER_1,
          },
        ],
      }),
    ).toThrow(MatchRoomInvariantError)
  })

  it('requires card stats before a card-backed match room can initialize', () => {
    const createdRoom = makeCreatedRoom()

    expect(() =>
      initializeMatchRoom(createdRoom, {
        initialState: makeGameStateWithCard(),
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
      }),
    ).toThrow(RulesInvariantError)

    const initializedRoom = initializeMatchRoom(createdRoom, {
      initialState: makeGameStateWithCard({ includeCardStats: true }),
      initializedAt: '2026-05-07T09:01:00.000Z',
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
    })

    expect(initializedRoom.engineState.cardStats?.cards[0]?.power).toBe(13000)
  })

  it('keeps room lifecycle separate from engine battle and turn phases', () => {
    const initializedRoom = makeInitializedRoom(
      makeGameState({
        status: 'ready',
      }),
    )

    const startResult = submitMatchRoomCommand(
      initializedRoom,
      {
        source: {
          kind: 'system',
          source: 'local-session',
        },
        command: {
          kind: 'action',
          submission: {
            action: {
              actionId: 'action-start-1' as ActionId,
              type: 'match.start',
              actor: {
                kind: 'system',
                system: 'match-setup',
              },
            },
            expectedRevision: 0,
          },
        },
      },
      {
        submittedAt: '2026-05-07T09:02:00.000Z',
      },
    )

    expect(startResult.status).toBe('accepted')

    if (startResult.status !== 'accepted') {
      throw new Error(
        `Expected accepted start, received ${startResult.status}.`,
      )
    }

    expect(startResult.room.status).toBe('in_progress')
    expect(startResult.room.engineState.status).toBe('in_progress')
    expect(startResult.room.engineState.turn.phase).toBe('pregame')
    expect(startResult.room.metadata.startedAt).toBe('2026-05-07T09:02:00.000Z')

    const concedeResult = submitMatchRoomCommand(
      startResult.room,
      {
        source: {
          kind: 'participant',
          participantId: PARTICIPANT_2,
        },
        command: {
          kind: 'action',
          submission: {
            action: {
              actionId: 'action-concede-1' as ActionId,
              type: 'match.concede',
              actor: {
                kind: 'player',
                playerId: PLAYER_2,
              },
            },
            expectedRevision: 1,
          },
        },
      },
      {
        submittedAt: '2026-05-07T09:03:00.000Z',
      },
    )

    expect(concedeResult.status).toBe('accepted')

    if (concedeResult.status !== 'accepted') {
      throw new Error(
        `Expected accepted concede, received ${concedeResult.status}.`,
      )
    }

    expect(concedeResult.room.status).toBe('completed')
    expect(concedeResult.room.engineState.status).toBe('completed')
    expect(concedeResult.room.metadata.completedAt).toBe(
      '2026-05-07T09:03:00.000Z',
    )
  })

  it('assigns session-owned turn and request deadlines from accepted runtime state', () => {
    const createdRoom = createMatchRoom({
      roomId: ROOM_ID,
      formatId: STANDARD_FORMAT_ID,
      hostParticipantId: PARTICIPANT_1,
      createdAt: '2026-05-07T09:00:00.000Z',
      clockSettings: {
        requestTimeoutMs: 5_000,
        turnTimeoutMs: 30_000,
      },
      participants: [
        {
          participantId: PARTICIPANT_1,
          seat: 0,
          userId: USER_1,
        },
        {
          participantId: PARTICIPANT_2,
          seat: 1,
          userId: USER_2,
        },
      ],
    })
    const initializedRoom = initializeMatchRoom(createdRoom, {
      initialState: makeGameState({ status: 'ready' }),
      initializedAt: '2026-05-07T09:01:00.000Z',
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
    })
    const startResult = submitMatchRoomCommand(
      initializedRoom,
      {
        source: {
          kind: 'system',
          source: 'local-session',
        },
        command: {
          kind: 'action',
          submission: {
            action: {
              actionId: 'action-start-clock-1' as ActionId,
              type: 'match.start',
              actor: {
                kind: 'system',
                system: 'match-setup',
              },
            },
            expectedRevision: initializedRoom.engineState.revision,
          },
        },
      },
      {
        submittedAt: '2026-05-07T09:02:00.000Z',
      },
    )

    expect(startResult.status).toBe('accepted')

    if (startResult.status !== 'accepted') {
      throw new Error(
        `Expected accepted start, received ${startResult.status}.`,
      )
    }

    expect(startResult.room.clock).toMatchObject({
      authority: 'match-session',
      serverNow: '2026-05-07T09:02:00.000Z',
      settings: {
        requestTimeoutMs: 5_000,
        turnTimeoutMs: 30_000,
      },
      activeTurn: {
        turnNumber: 0,
        turnPlayerId: PLAYER_1,
        startedAt: '2026-05-07T09:02:00.000Z',
        deadlineAt: '2026-05-07T09:02:30.000Z',
      },
    })
    expect(startResult.room.clock.activeRequest).toBeUndefined()

    const request = makeConfirmRequest('request-clock-1')
    const pendingState: GameState = {
      ...startResult.room.engineState,
      status: 'awaiting_choice',
      revision: startResult.room.engineState.revision + 1,
      pendingRequests: [request],
    }
    const pendingResult = submitMatchRoomCommand(
      startResult.room,
      systemAdvanceCommand(startResult.room.engineState.revision),
      {
        engineAdapters: [makeAcceptedAdapter(startResult.room, pendingState)],
        submittedAt: '2026-05-07T09:03:00.000Z',
      },
    )

    expect(pendingResult.status).toBe('accepted')

    if (pendingResult.status !== 'accepted') {
      throw new Error(
        `Expected accepted pending result, received ${pendingResult.status}.`,
      )
    }

    expect(pendingResult.room.clock.activeRequest).toMatchObject({
      requestId: request.requestId,
      responderPlayerId: PLAYER_1,
      startedAt: '2026-05-07T09:03:00.000Z',
      deadlineAt: '2026-05-07T09:03:05.000Z',
    })
    expect(pendingResult.room.clock.activeTurn).toEqual(
      startResult.room.clock.activeTurn,
    )
  })

  it('resolves expired request deadlines through a system-owned timeout path', () => {
    const request = makeConfirmRequest('request-timeout-1')
    const initializedRoom = makeInitializedRoom(
      makeGameState({ status: 'ready' }),
    )
    const pendingState: GameState = {
      ...initializedRoom.engineState,
      status: 'awaiting_choice',
      revision: initializedRoom.engineState.revision + 1,
      pendingRequests: [request],
    }
    const pendingResult = submitMatchRoomCommand(
      initializedRoom,
      systemAdvanceCommand(initializedRoom.engineState.revision),
      {
        engineAdapters: [makeAcceptedAdapter(initializedRoom, pendingState)],
        submittedAt: '2026-05-07T09:10:00.000Z',
      },
    )

    if (pendingResult.status !== 'accepted') {
      throw new Error(
        `Expected accepted pending setup, received ${pendingResult.status}.`,
      )
    }

    const timeoutResult = resolveMatchRoomTimeout(pendingResult.room, {
      checkedAt: '2026-05-07T09:12:01.000Z',
    })

    expect(timeoutResult.status).toBe('accepted')

    if (timeoutResult.status !== 'accepted') {
      throw new Error(
        `Expected accepted timeout, received ${timeoutResult.status}.`,
      )
    }

    expect(timeoutResult.timeout).toMatchObject({
      kind: 'request',
      requestId: request.requestId,
      responderPlayerId: PLAYER_1,
      timeoutReason: 'request_timeout',
    })
    expect(timeoutResult.room.status).toBe('completed')
    expect(timeoutResult.room.engineState.pendingRequests).toEqual([])
    expect(timeoutResult.room.clock.activeRequest).toBeUndefined()
    expect(timeoutResult.room.clock.activeTurn).toBeUndefined()
    expect(
      timeoutResult.engineResult.events.map((event) => event.type),
    ).toEqual(['player.defeated', 'match.ended'])
    expect(timeoutResult.engineResult.events[0]).toMatchObject({
      type: 'player.defeated',
      playerId: PLAYER_1,
      reason: 'timeout',
      timeoutReason: 'request_timeout',
    })
    expect(timeoutResult.engineResult.events[1]).toMatchObject({
      type: 'match.ended',
      reason: 'timeout',
      timeoutReason: 'request_timeout',
      loserPlayerId: PLAYER_1,
      winnerPlayerId: PLAYER_2,
    })
  })

  it('rejects stale participant responses after the authoritative request deadline', () => {
    const request = makeConfirmRequest('request-stale-timeout-1')
    const initializedRoom = makeInitializedRoom(
      makeGameState({ status: 'ready' }),
    )
    const pendingState: GameState = {
      ...initializedRoom.engineState,
      status: 'awaiting_choice',
      revision: initializedRoom.engineState.revision + 1,
      pendingRequests: [request],
    }
    const pendingResult = submitMatchRoomCommand(
      initializedRoom,
      systemAdvanceCommand(initializedRoom.engineState.revision),
      {
        engineAdapters: [makeAcceptedAdapter(initializedRoom, pendingState)],
        submittedAt: '2026-05-07T09:20:00.000Z',
      },
    )

    if (pendingResult.status !== 'accepted') {
      throw new Error(
        `Expected accepted pending setup, received ${pendingResult.status}.`,
      )
    }

    const staleResponse = submitMatchRoomCommand(
      pendingResult.room,
      {
        source: {
          kind: 'participant',
          participantId: PARTICIPANT_1,
        },
        command: {
          kind: 'choice_response',
          submission: {
            expectedRevision: pendingResult.room.engineState.revision,
            response: {
              requestId: request.requestId,
              responderPlayerId: PLAYER_1,
              type: 'answer.boolean',
              accepted: true,
            },
          },
        },
      },
      {
        submittedAt: '2026-05-07T09:22:01.000Z',
      },
    )

    expect(staleResponse.status).toBe('invalid')

    if (staleResponse.status !== 'invalid') {
      throw new Error(
        `Expected invalid stale response, received ${staleResponse.status}.`,
      )
    }

    expect(staleResponse.code).toBe('deadline_expired')
    expect('engineResult' in staleResponse).toBe(false)
    expect(staleResponse.room).toBe(pendingResult.room)
  })

  it('resolves queued request deadlines deterministically from the FIFO head', () => {
    const headRequest = makeConfirmRequest('request-timeout-head', PLAYER_2)
    const queuedRequest = makeConfirmRequest('request-timeout-tail', PLAYER_1)
    const initializedRoom = makeInitializedRoom(
      makeGameState({ status: 'ready' }),
    )
    const pendingState: GameState = {
      ...initializedRoom.engineState,
      status: 'awaiting_choice',
      revision: initializedRoom.engineState.revision + 1,
      pendingRequests: [headRequest, queuedRequest],
    }
    const pendingResult = submitMatchRoomCommand(
      initializedRoom,
      systemAdvanceCommand(initializedRoom.engineState.revision),
      {
        engineAdapters: [makeAcceptedAdapter(initializedRoom, pendingState)],
        submittedAt: '2026-05-07T09:30:00.000Z',
      },
    )

    if (pendingResult.status !== 'accepted') {
      throw new Error(
        `Expected accepted pending setup, received ${pendingResult.status}.`,
      )
    }

    expect(pendingResult.room.clock.activeRequest?.requestId).toBe(
      headRequest.requestId,
    )

    const timeoutResult = resolveMatchRoomTimeout(pendingResult.room, {
      checkedAt: '2026-05-07T09:32:01.000Z',
    })

    expect(timeoutResult.status).toBe('accepted')

    if (timeoutResult.status !== 'accepted') {
      throw new Error(
        `Expected accepted timeout, received ${timeoutResult.status}.`,
      )
    }

    expect(timeoutResult.timeout).toMatchObject({
      kind: 'request',
      requestId: headRequest.requestId,
      responderPlayerId: PLAYER_2,
    })
    expect(timeoutResult.engineResult.events[1]).toMatchObject({
      type: 'match.ended',
      loserPlayerId: PLAYER_2,
      winnerPlayerId: PLAYER_1,
    })
  })

  it('resolves turn deadlines when no active request owns the clock first', () => {
    const createdRoom = createMatchRoom({
      roomId: ROOM_ID,
      formatId: STANDARD_FORMAT_ID,
      createdAt: '2026-05-07T09:39:00.000Z',
      clockSettings: {
        requestTimeoutMs: 120_000,
        turnTimeoutMs: 10_000,
      },
      participants: [
        {
          participantId: PARTICIPANT_1,
          seat: 0,
        },
        {
          participantId: PARTICIPANT_2,
          seat: 1,
        },
      ],
    })
    const initializedRoom = initializeMatchRoom(createdRoom, {
      initialState: makeGameState({ status: 'ready' }),
      initializedAt: '2026-05-07T09:39:30.000Z',
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
    })
    const startResult = submitMatchRoomCommand(
      initializedRoom,
      {
        source: {
          kind: 'system',
          source: 'local-session',
        },
        command: {
          kind: 'action',
          submission: {
            action: {
              actionId: 'action-start-turn-clock-1' as ActionId,
              type: 'match.start',
              actor: {
                kind: 'system',
                system: 'match-setup',
              },
            },
            expectedRevision: initializedRoom.engineState.revision,
          },
        },
      },
      {
        submittedAt: '2026-05-07T09:40:00.000Z',
      },
    )

    if (startResult.status !== 'accepted') {
      throw new Error(
        `Expected accepted start, received ${startResult.status}.`,
      )
    }

    const timeoutResult = resolveMatchRoomTimeout(startResult.room, {
      checkedAt: '2026-05-07T09:40:10.000Z',
    })

    expect(timeoutResult.status).toBe('accepted')

    if (timeoutResult.status !== 'accepted') {
      throw new Error(
        `Expected accepted timeout, received ${timeoutResult.status}.`,
      )
    }

    expect(timeoutResult.timeout).toMatchObject({
      kind: 'turn',
      turnPlayerId: PLAYER_1,
      timeoutReason: 'turn_timeout',
    })
    expect(timeoutResult.engineResult.events[1]).toMatchObject({
      type: 'match.ended',
      timeoutReason: 'turn_timeout',
      loserPlayerId: PLAYER_1,
    })
  })

  it('routes participant commands through the engine without mutating the room ad hoc', () => {
    const initializedRoom = makeInitializedRoom()

    const acceptedResult = submitMatchRoomCommand(
      initializedRoom,
      {
        source: {
          kind: 'participant',
          participantId: PARTICIPANT_1,
        },
        command: {
          kind: 'action',
          submission: {
            action: {
              actionId: 'action-ready-1' as ActionId,
              type: 'match.ready',
              actor: {
                kind: 'player',
                playerId: PLAYER_1,
              },
            },
            expectedRevision: 0,
          },
        },
      },
      {
        submittedAt: '2026-05-07T09:02:00.000Z',
      },
    )

    expect(acceptedResult.status).toBe('accepted')

    if (acceptedResult.status !== 'accepted') {
      throw new Error(
        `Expected accepted ready action, received ${acceptedResult.status}.`,
      )
    }

    expect(acceptedResult.room).not.toBe(initializedRoom)
    expect(initializedRoom.engineState.revision).toBe(0)
    expect(initializedRoom.engineState.players[0]?.status).toBe('waiting')
    expect(acceptedResult.room.status).toBe('initialized')
    expect(acceptedResult.room.engineState.revision).toBe(1)
    expect(acceptedResult.room.engineState.players[0]?.status).toBe('ready')

    const staleResult = submitMatchRoomCommand(initializedRoom, {
      source: {
        kind: 'participant',
        participantId: PARTICIPANT_1,
      },
      command: {
        kind: 'action',
        submission: {
          action: {
            actionId: 'action-ready-stale' as ActionId,
            type: 'match.ready',
            actor: {
              kind: 'player',
              playerId: PLAYER_1,
            },
          },
          expectedRevision: 99,
        },
      },
    })

    expect(staleResult.status).toBe('invalid')
    expect(staleResult.room).toBe(initializedRoom)

    if (staleResult.status !== 'invalid' || !('engineResult' in staleResult)) {
      throw new Error('Expected stale command to be rejected by the engine.')
    }

    expect(staleResult.code).toBe('revision_mismatch')
    expect(staleResult.engineResult.state).toBe(initializedRoom.engineState)
  })

  it('rejects commands when participant identity does not match gameplay player identity', () => {
    const initializedRoom = makeInitializedRoom()
    const result = submitMatchRoomCommand(initializedRoom, {
      source: {
        kind: 'participant',
        participantId: PARTICIPANT_2,
      },
      command: {
        kind: 'action',
        submission: {
          action: {
            actionId: 'action-ready-wrong-participant' as ActionId,
            type: 'match.ready',
            actor: {
              kind: 'player',
              playerId: PLAYER_1,
            },
          },
          expectedRevision: 0,
        },
      },
    })

    expect(result.status).toBe('invalid')
    expect(result.room).toBe(initializedRoom)

    if (result.status !== 'invalid') {
      throw new Error(`Expected invalid command, received ${result.status}.`)
    }

    expect(result.code).toBe('actor_participant_mismatch')
    expect('engineResult' in result).toBe(false)
    expect(initializedRoom.engineState.revision).toBe(0)
  })

  it('keeps live room shape distinct from historical match record semantics', () => {
    const room = makeInitializedRoom()

    expect(room).not.toHaveProperty('playedAt')
    expect(room).not.toHaveProperty('ownerProfileId')
    expect(room).not.toHaveProperty('visibility')
    expect(room.participants[0]).not.toHaveProperty('result')
    expect(room.participants[0]).not.toHaveProperty('deckVersionId')

    expectTypeOf<HasKey<MatchRoom, 'playedAt'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<MatchRoom, 'ownerProfileId'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<MatchRoom, 'result'>>().toEqualTypeOf<false>()
    expectTypeOf<
      HasKey<MatchRoomParticipant, 'enginePlayerId'>
    >().toEqualTypeOf<true>()
    expectTypeOf<HasKey<MatchRoomParticipant, 'userId'>>().toEqualTypeOf<true>()
    expectTypeOf<
      HasKey<MatchRoomParticipant, 'playerId'>
    >().toEqualTypeOf<false>()
  })

  it('closes the room from engine-owned damage defeat state without session-side win heuristics', () => {
    const initializedRoom = makeInitializedRoom(
      makeGameState({ status: 'ready' }),
    )
    const completedState: GameState = {
      ...initializedRoom.engineState,
      status: 'completed',
      revision: initializedRoom.engineState.revision + 1,
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
    const adapter: MatchRoomEngineAdapter = {
      adapterId: initializedRoom.engineAdapterId,
      formatId: initializedRoom.formatId,
      dispatch() {
        return {
          status: 'accepted',
          transitionId: 'transition-damage-defeat-room-1' as TransitionId,
          state: completedState,
          events: [],
          timingWindows: [],
          pendingRequests: [],
        }
      },
    }

    const result = submitMatchRoomCommand(
      initializedRoom,
      {
        source: {
          kind: 'system',
          source: 'match-runtime',
        },
        command: {
          kind: 'action',
          submission: {
            action: {
              actionId: 'action-room-consume-damage-defeat-1' as ActionId,
              type: 'system.advance_phase',
              actor: {
                kind: 'system',
                system: 'automatic-flow',
              },
              nextPhase: 'battle',
            },
            expectedRevision: initializedRoom.engineState.revision,
          },
        },
      },
      {
        engineAdapters: [adapter],
        submittedAt: '2026-05-07T09:04:00.000Z',
      },
    )

    expect(result.status).toBe('accepted')

    if (result.status !== 'accepted') {
      throw new Error(
        `Expected accepted room command, received ${result.status}.`,
      )
    }

    expect(result.room.status).toBe('completed')
    expect(result.room.engineState).toBe(completedState)
    expect(result.room.metadata.completedAt).toBe('2026-05-07T09:04:00.000Z')
  })
})
