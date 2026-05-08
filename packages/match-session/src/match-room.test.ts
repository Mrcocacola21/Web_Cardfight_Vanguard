import { describe, expect, expectTypeOf, it } from 'vitest'

import type { ActionId, GameState, PlayerId } from '@web-vg/rules-core'
import { STANDARD_FORMAT_ID } from '@web-vg/rules-core'
import type { UserId } from '@web-vg/shared'

import {
  MatchRoomInvariantError,
  createMatchRoom,
  findMatchRoomParticipantByPlayerId,
  getMatchRoomEngineRevision,
  hasMatchRoomEngineState,
  initializeMatchRoom,
  submitMatchRoomCommand,
} from './match-room'
import type {
  MatchRoom,
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
})
