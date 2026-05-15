import { describe, expect, it } from 'vitest'

import * as matchSession from '@web-vg/match-session'
import type {
  MatchRoomCommandSubmission,
  MatchRoomWithEngineState,
} from '@web-vg/match-session'

import {
  LOCAL_MATCH_PARTICIPANT_ONE_ID,
  LOCAL_MATCH_PARTICIPANT_TWO_ID,
  LOCAL_MATCH_PLAYER_ONE_ID,
  LOCAL_MATCH_PLAYER_TWO_ID,
  createBeginMulliganCommand,
  createLocalActionId,
  createLocalPrototypeMatchRoom,
  createMulliganFirstCardChoiceCommand,
  createReadyCommand,
  createStartMatchCommand,
} from './local-match-room'

describe('createLocalPrototypeMatchRoom', () => {
  it('bootstraps a reproducible two-player room with all prototype gameplay zones', () => {
    const room = createLocalPrototypeMatchRoom('tests-checkpoint-bootstrap')

    expect(room.status).toBe('initialized')
    expect(room.revision).toBe(1)
    expect(room.engineState.status).toBe('setup')
    expect(room.engineState.revision).toBe(0)
    expect(room.engineState.pendingRequests).toEqual([])

    expect(room.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
          displayName: 'Aichi Sendou',
          enginePlayerId: LOCAL_MATCH_PLAYER_ONE_ID,
          submittedDeckId: 'local-demo-deck-aichi',
        }),
        expect.objectContaining({
          participantId: LOCAL_MATCH_PARTICIPANT_TWO_ID,
          displayName: 'Toshiki Kai',
          enginePlayerId: LOCAL_MATCH_PLAYER_TWO_ID,
          submittedDeckId: 'local-demo-deck-kai',
        }),
      ]),
    )
    expect(room.participants[0]?.userId).not.toBe(
      room.participants[0]?.enginePlayerId,
    )

    for (const playerId of [
      LOCAL_MATCH_PLAYER_ONE_ID,
      LOCAL_MATCH_PLAYER_TWO_ID,
    ]) {
      const zoneKinds = room.engineState.zones
        .filter((zone) => zone.ownerPlayerId === playerId)
        .map((zone) => zone.kind)

      expect(zoneKinds).toEqual(
        expect.arrayContaining([
          'deck',
          'ride_deck',
          'g_deck',
          'hand',
          'vanguard_circle',
          'rear_guard_circle',
          'guardian_circle',
          'damage',
          'soul',
          'drop',
          'bind',
        ]),
      )
    }
  })

  it('resolves the prototype mulligan-return path through the room boundary', () => {
    const startedRoom = startLocalMatch(
      createLocalPrototypeMatchRoom('tests-checkpoint-mulligan'),
    )
    const pendingResult = acceptCommand(
      startedRoom,
      createBeginMulliganCommand(
        LOCAL_MATCH_PLAYER_ONE_ID,
        createLocalActionId(startedRoom.revision, 4, 'begin-mulligan'),
        startedRoom.engineState.revision,
      ),
    )
    const request = pendingResult.room.engineState.pendingRequests[0]

    expect(request?.type).toBe('mulligan.select_cards')

    if (request?.type !== 'mulligan.select_cards') {
      throw new Error('Expected pending mulligan request.')
    }

    const handBefore = findOwnedZone(
      pendingResult.room,
      LOCAL_MATCH_PLAYER_ONE_ID,
      'hand',
    )?.occupants.map((occupant) => occupant.pieceId)
    const firstDeckPieceBefore = request.currentDeckPieceIds[0]
    const choiceSubmission = createMulliganFirstCardChoiceCommand(
      request,
      createLocalActionId(pendingResult.room.revision, 5, 'mulligan-first'),
      pendingResult.room.engineState.revision,
    )

    expect(choiceSubmission).not.toBeNull()

    if (choiceSubmission === null) {
      throw new Error('Expected mulligan first-card choice to be available.')
    }

    const choiceResult = acceptCommand(pendingResult.room, choiceSubmission)
    const handAfter = findOwnedZone(
      choiceResult.room,
      LOCAL_MATCH_PLAYER_ONE_ID,
      'hand',
    )?.occupants.map((occupant) => occupant.pieceId)

    expect(pendingResult.room.engineState.pendingRequests).toHaveLength(1)
    expect(choiceResult.room.engineState.pendingRequests).toHaveLength(0)
    expect(choiceResult.room.engineState.status).toBe('in_progress')
    expect(choiceResult.engineResult.events.map((event) => event.type)).toEqual(
      [
        'choice.response_resolved',
        'piece.moved',
        'zone.shuffled',
        'piece.moved',
        'cards.drawn',
        'mulligan.completed',
      ],
    )
    expect(handAfter).toHaveLength(handBefore?.length ?? 0)
    expect(handAfter).not.toContain(handBefore?.[0])
    expect(handAfter).toContain(firstDeckPieceBefore)
  })

  it('can produce a player-visible projection for the local room without private-zone leakage', () => {
    const room = createLocalPrototypeMatchRoom('tests-checkpoint-projection')
    const result = matchSession.projectMatchRoomForParticipant(
      room,
      LOCAL_MATCH_PARTICIPANT_ONE_ID,
    )

    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error(result.message)
    }

    const playerOneDeck = result.projection.visibleState.zones.find(
      (zone) => zone.zoneId === 'p1:zone:deck',
    )
    const playerTwoHand = result.projection.visibleState.zones.find(
      (zone) => zone.zoneId === 'p2:zone:hand',
    )

    expect(result.projection).not.toHaveProperty('engineState')
    expect(playerOneDeck?.contentsVisibility).toBe('masked')
    expect(playerOneDeck?.occupants[0]).not.toHaveProperty('pieceId')
    expect(playerTwoHand?.contentsVisibility).toBe('masked')
    expect(playerTwoHand?.occupants[0]).not.toHaveProperty('pieceId')
    expect(JSON.stringify(result.projection.visibleState)).not.toContain(
      'p2:piece:main',
    )
  })

  it('can serialize and restore the deck-backed local room for reconnect-style inspection', () => {
    const room = createLocalPrototypeMatchRoom('tests-checkpoint-serialization')
    const document = matchSession.createSerializableMatchSessionDocument({
      room,
    })

    expect(document.ok).toBe(true)

    if (!document.ok) {
      throw new Error(document.message)
    }

    const serialized = matchSession.serializeMatchSessionDocument(
      document.document,
    )

    expect(serialized.ok).toBe(true)

    if (!serialized.ok) {
      throw new Error(serialized.message)
    }

    const restored = matchSession.deserializeMatchSessionDocument(
      serialized.json,
    )

    expect(restored.ok).toBe(true)

    if (!restored.ok) {
      throw new Error(restored.message)
    }

    expect(restored.session.room).toEqual(room)

    const projection = matchSession.projectMatchRoomForParticipant(
      restored.session.room,
      LOCAL_MATCH_PARTICIPANT_ONE_ID,
    )

    expect(projection.ok).toBe(true)
  })
})

function startLocalMatch(
  room: MatchRoomWithEngineState,
): MatchRoomWithEngineState {
  const playerOneReadyRoom = acceptCommand(
    room,
    createReadyCommand(
      LOCAL_MATCH_PLAYER_ONE_ID,
      createLocalActionId(room.revision, 1, 'ready-aichi'),
    ),
  ).room
  const playerTwoReadyRoom = acceptCommand(
    playerOneReadyRoom,
    createReadyCommand(
      LOCAL_MATCH_PLAYER_TWO_ID,
      createLocalActionId(playerOneReadyRoom.revision, 2, 'ready-kai'),
    ),
  ).room

  return acceptCommand(
    playerTwoReadyRoom,
    createStartMatchCommand(
      createLocalActionId(playerTwoReadyRoom.revision, 3, 'start-match'),
      playerTwoReadyRoom.engineState.revision,
    ),
  ).room
}

function acceptCommand(
  room: MatchRoomWithEngineState,
  submission: MatchRoomCommandSubmission,
) {
  const result = matchSession.submitMatchRoomCommand(room, submission, {
    submittedAt: '2026-05-07T00:00:05.000Z',
  })

  expect(result.status).toBe('accepted')

  if (result.status !== 'accepted') {
    throw new Error(`Expected accepted command, received ${result.status}.`)
  }

  return result
}

function findOwnedZone(
  room: MatchRoomWithEngineState,
  playerId: typeof LOCAL_MATCH_PLAYER_ONE_ID,
  kind: MatchRoomWithEngineState['engineState']['zones'][number]['kind'],
) {
  return room.engineState.zones.find(
    (zone) => zone.ownerPlayerId === playerId && zone.kind === kind,
  )
}
