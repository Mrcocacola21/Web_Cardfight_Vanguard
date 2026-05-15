import { describe, expect, it } from 'vitest'

import {
  STANDARD_FORMAT_ID,
  buildEngineCardStatsSnapshot,
  type EventId,
  type GameEvent,
  type GameState,
  type PieceId,
  type PlayerId,
  type ZoneId,
} from '@web-vg/rules-core'
import type { CardId, UserId } from '@web-vg/shared'

import {
  createMatchRoom,
  initializeMatchRoom,
  type MatchRoomId,
  type MatchRoomParticipantId,
} from './match-room'
import {
  projectMatchRoomForOmniscientViewer,
  projectMatchRoomForParticipant,
} from './projection'

const ROOM_ID = 'room-projection-1' as MatchRoomId
const PARTICIPANT_A = 'participant-projection-a' as MatchRoomParticipantId
const PARTICIPANT_B = 'participant-projection-b' as MatchRoomParticipantId
const PLAYER_A = 'projection-player-a' as PlayerId
const PLAYER_B = 'projection-player-b' as PlayerId

describe('@web-vg/match-session hidden information projection', () => {
  it('projects a live room for one participant without exposing canonical engine state', () => {
    const room = makeInitializedRoom()
    const result = projectMatchRoomForParticipant(room, PARTICIPANT_A)

    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error(result.message)
    }

    expect(result.projection).not.toHaveProperty('engineState')
    expect(result.projection.viewer).toEqual({
      participantId: PARTICIPANT_A,
      playerId: PLAYER_A,
    })
    expect(JSON.stringify(result.projection.visibleState)).toContain(
      'card-a-hand-secret',
    )
    expect(JSON.stringify(result.projection.visibleState)).not.toContain(
      'card-b-hand-secret',
    )
    expect(JSON.stringify(result.projection.visibleState)).not.toContain(
      'card-a-deck-secret',
    )
    expect(
      result.projection.visibleState.zones.find(
        (zone) => zone.zoneId === ('zone-a-deck' as ZoneId),
      )?.occupants[0],
    ).toMatchObject({
      visibility: 'masked',
    })
  })

  it('rejects unknown participant projections instead of falling back to full state', () => {
    const result = projectMatchRoomForParticipant(
      makeInitializedRoom(),
      'participant-projection-missing' as MatchRoomParticipantId,
    )

    expect(result).toMatchObject({
      ok: false,
      code: 'unknown_participant',
    })
  })

  it('projects event output without leaking hidden deck order', () => {
    const room = makeInitializedRoom()
    const result = projectMatchRoomForParticipant(room, PARTICIPANT_B, {
      events: [
        {
          eventId: 'event-room-shuffle-a' as EventId,
          type: 'zone.shuffled',
          sequence: 1,
          origin: {
            kind: 'system',
            system: 'rules-engine',
          },
          zoneId: 'zone-a-deck' as ZoneId,
          orderedPieceIds: ['piece-a-deck-secret' as PieceId],
        },
      ] satisfies readonly GameEvent[],
    })

    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error(result.message)
    }

    expect(result.projection.events[0]).toMatchObject({
      type: 'zone.shuffled',
      visibility: 'redacted',
      redactedFields: ['orderedPieceIds'],
    })
    expect(JSON.stringify(result.projection.events[0])).not.toContain(
      'piece-a-deck-secret',
    )
  })

  it('keeps an explicit omniscient projection for local development', () => {
    const result = projectMatchRoomForOmniscientViewer(makeInitializedRoom())

    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error(result.message)
    }

    expect(result.projection.visibleState.projectionMode).toBe('omniscient')
    expect(JSON.stringify(result.projection.visibleState)).toContain(
      'card-a-deck-secret',
    )
    expect(JSON.stringify(result.projection.visibleState)).toContain(
      'card-b-hand-secret',
    )
  })
})

function makeInitializedRoom() {
  return initializeMatchRoom(
    createMatchRoom({
      roomId: ROOM_ID,
      formatId: STANDARD_FORMAT_ID,
      hostParticipantId: PARTICIPANT_A,
      createdAt: '2026-05-09T00:00:00.000Z',
      participants: [
        {
          participantId: PARTICIPANT_A,
          seat: 0,
          userId: 'user-projection-a' as UserId,
          displayName: 'Aichi',
        },
        {
          participantId: PARTICIPANT_B,
          seat: 1,
          userId: 'user-projection-b' as UserId,
          displayName: 'Kai',
        },
      ],
    }),
    {
      initialState: makeProjectionState(),
      initializedAt: '2026-05-09T00:00:01.000Z',
      playerBindings: [
        {
          participantId: PARTICIPANT_A,
          playerId: PLAYER_A,
        },
        {
          participantId: PARTICIPANT_B,
          playerId: PLAYER_B,
        },
      ],
    },
  )
}

function makeProjectionState(): GameState {
  return {
    gameId: 'game-room-projection' as GameState['gameId'],
    formatId: STANDARD_FORMAT_ID,
    status: 'setup',
    revision: 0,
    turn: {
      turnNumber: 0,
      turnPlayerId: PLAYER_A,
      phase: 'pregame',
      step: 'setup',
    },
    players: [
      player(PLAYER_A, 0, ['zone-a-hand', 'zone-a-deck', 'zone-a-vanguard']),
      player(PLAYER_B, 1, ['zone-b-hand', 'zone-b-deck', 'zone-b-vanguard']),
    ],
    zones: [
      zone('zone-a-hand', 'hand', PLAYER_A, 'owner-private', [
        'piece-a-hand-secret',
      ]),
      zone('zone-a-deck', 'deck', PLAYER_A, 'owner-private', [
        'piece-a-deck-secret',
      ]),
      zone('zone-a-vanguard', 'vanguard_circle', PLAYER_A, 'public', [
        'piece-a-vanguard',
      ]),
      zone('zone-b-hand', 'hand', PLAYER_B, 'owner-private', [
        'piece-b-hand-secret',
      ]),
      zone('zone-b-deck', 'deck', PLAYER_B, 'owner-private', [
        'piece-b-deck-secret',
      ]),
      zone('zone-b-vanguard', 'vanguard_circle', PLAYER_B, 'public', [
        'piece-b-vanguard',
      ]),
    ],
    pieces: [
      piece('piece-a-hand-secret', 'card-a-hand-secret', PLAYER_A),
      piece('piece-a-deck-secret', 'card-a-deck-secret', PLAYER_A),
      piece('piece-a-vanguard', 'card-a-vanguard-public', PLAYER_A),
      piece('piece-b-hand-secret', 'card-b-hand-secret', PLAYER_B),
      piece('piece-b-deck-secret', 'card-b-deck-secret', PLAYER_B),
      piece('piece-b-vanguard', 'card-b-vanguard-public', PLAYER_B),
    ],
    cardStats: buildEngineCardStatsSnapshot(
      [
        'card-a-hand-secret',
        'card-a-deck-secret',
        'card-a-vanguard-public',
        'card-b-hand-secret',
        'card-b-deck-secret',
        'card-b-vanguard-public',
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
