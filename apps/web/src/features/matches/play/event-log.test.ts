import { describe, expect, it } from 'vitest'

import type {
  EffectDefinitionId,
  EventId,
  GameEvent,
  PieceId,
} from '@web-vg/rules-core'
import * as matchSession from '@web-vg/match-session'
import type { MatchRoomWithEngineState } from '@web-vg/match-session'

import {
  LOCAL_MATCH_PLAYER_ONE_ID,
  LOCAL_MATCH_PLAYER_TWO_ID,
  createAdvancePhaseCommand,
  createBeginMulliganCommand,
  createCallFirstHandCardCommand,
  createKeepHandChoiceCommand,
  createLocalActionId,
  createLocalPrototypeMatchRoom,
  createReadyCommand,
  createRideFirstRideDeckCardCommand,
  createStartMatchCommand,
} from './local-match-room'
import {
  appendAcceptedEngineEvents,
  buildLocalMatchEventLogEntries,
} from './event-log'

describe('local match event log', () => {
  it('starts empty and preserves room state while projecting entries', () => {
    const room = createLocalPrototypeMatchRoom('event-log-empty')
    const stateBeforeProjection = JSON.stringify(room.engineState)

    const entries = buildLocalMatchEventLogEntries([])

    expect(entries).toEqual([])
    expect(JSON.stringify(room.engineState)).toBe(stateBeforeProjection)
  })

  it('appends accepted engine events in emitted order with session metadata', () => {
    const { room, result } = startLocalMatch(
      createLocalPrototypeMatchRoom('event-log-start'),
    )

    const records = appendAcceptedEngineEvents([], result)
    const entries = buildLocalMatchEventLogEntries(records, {
      resolvePlayerLabel: (playerId) =>
        playerId === LOCAL_MATCH_PLAYER_ONE_ID ? 'Aichi Sendou' : 'Toshiki Kai',
    })

    expect(room.engineState.status).toBe('in_progress')
    expect(entries.map((entry) => entry.type)).toEqual([
      'match.started',
      'turn.started',
    ])
    expect(entries.map((entry) => entry.ordinal)).toEqual([1, 2])
    expect(entries[0]).toMatchObject({
      category: 'match',
      summary: 'Match started. Starting player: Aichi Sendou.',
      roomRevision: result.room.revision,
      engineRevision: result.room.engineState.revision,
    })
    expect(entries[1]?.summary).toBe('Turn 0 started for Aichi Sendou.')
  })

  it('formats card, piece, mulligan, and choice events without inventing entries', () => {
    const { room: startedRoom, result: startResult } = startLocalMatch(
      createLocalPrototypeMatchRoom('event-log-flow'),
    )
    let records = appendAcceptedEngineEvents([], startResult)

    const pendingResult = acceptCommand(
      startedRoom,
      createBeginMulliganCommand(
        LOCAL_MATCH_PLAYER_ONE_ID,
        createLocalActionId(startedRoom.revision, 4, 'begin-mulligan'),
        startedRoom.engineState.revision,
      ),
    )
    records = appendAcceptedEngineEvents(records, pendingResult)

    const mulliganRequest = pendingResult.room.engineState.pendingRequests[0]

    expect(mulliganRequest?.type).toBe('mulligan.select_cards')

    if (mulliganRequest?.type !== 'mulligan.select_cards') {
      throw new Error('Expected pending mulligan request.')
    }

    const choiceResult = acceptCommand(
      pendingResult.room,
      createKeepHandChoiceCommand(
        mulliganRequest,
        createLocalActionId(pendingResult.room.revision, 5, 'keep-hand'),
        pendingResult.room.engineState.revision,
      ),
    )
    records = appendAcceptedEngineEvents(records, choiceResult)
    const rideRoom = advanceRoomToPhase(choiceResult.room, 'ride')
    const rideSubmission = createRideFirstRideDeckCardCommand(
      LOCAL_MATCH_PLAYER_ONE_ID,
      createLocalActionId(rideRoom.revision, 6, 'ride-first-card'),
      rideRoom.engineState.revision,
      rideRoom.engineState,
    )

    expect(rideSubmission).not.toBeNull()

    if (rideSubmission === null) {
      throw new Error('Expected local ride command to be available.')
    }

    const rideResult = acceptCommand(rideRoom, rideSubmission)
    records = appendAcceptedEngineEvents(records, rideResult)

    const mainRoom = advanceRoomToPhase(rideResult.room, 'main')

    const callSubmission = createCallFirstHandCardCommand(
      LOCAL_MATCH_PLAYER_ONE_ID,
      createLocalActionId(mainRoom.revision, 7, 'call-first-hand-card'),
      mainRoom.engineState.revision,
      mainRoom.engineState,
    )

    expect(callSubmission).not.toBeNull()

    if (callSubmission === null) {
      throw new Error('Expected local call command to be available.')
    }

    const callResult = acceptCommand(mainRoom, callSubmission)
    records = appendAcceptedEngineEvents(records, callResult)

    const entries = buildLocalMatchEventLogEntries(records)

    expect(entries.map((entry) => entry.type)).toEqual([
      'match.started',
      'turn.started',
      'mulligan.started',
      'choice.response_resolved',
      'zone.shuffled',
      'mulligan.completed',
      'piece.moved',
      'piece.moved',
      'card.rode',
      'piece.moved',
      'card.called',
    ])
    expect(entries.map((entry) => entry.category)).toEqual([
      'match',
      'turn',
      'mulligan',
      'choice',
      'zone',
      'mulligan',
      'piece',
      'piece',
      'card',
      'piece',
      'card',
    ])
    expect(entries.at(-1)?.summary).toContain('was called')
  })

  it('keeps follow-up effect events visible as ordered engine facts', () => {
    const event: GameEvent = {
      eventId: 'event-effect-1' as EventId,
      type: 'effect.resolved',
      sequence: 3,
      origin: {
        kind: 'system',
        system: 'rules-engine',
      },
      effectDefinitionId:
        'effect:draw-finalize-cards-drawn' as EffectDefinitionId,
      sourcePieceId: 'p1:piece:starter' as PieceId,
      triggerEventSequence: 2,
      operationKinds: ['draw', 'counter_change'],
    }

    const entries = buildLocalMatchEventLogEntries([
      {
        recordId: 'transition-effect:event-effect-1',
        ordinal: 1,
        roomRevision: 7,
        engineRevision: 6,
        transitionId: 'transition-effect',
        event,
      },
    ])

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      ordinal: 1,
      sequence: 3,
      type: 'effect.resolved',
      category: 'effect',
      source: 'rules-engine',
      summary: 'Effect effect:draw-finalize-cards-drawn resolved.',
    })
    expect(entries[0]?.details).toEqual(
      expect.arrayContaining([
        { label: 'Effect', value: 'effect:draw-finalize-cards-drawn' },
        { label: 'Operations', value: 'draw, counter_change' },
      ]),
    )
  })
})

function startLocalMatch(room: MatchRoomWithEngineState) {
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
  const result = acceptCommand(
    playerTwoReadyRoom,
    createStartMatchCommand(
      createLocalActionId(playerTwoReadyRoom.revision, 3, 'start-match'),
      playerTwoReadyRoom.engineState.revision,
    ),
  )

  return {
    room: result.room,
    result,
  }
}

function advanceRoomToPhase(
  room: MatchRoomWithEngineState,
  targetPhase: string,
): MatchRoomWithEngineState {
  let nextRoom = room

  for (
    let sequence = 10;
    sequence < 20 && nextRoom.engineState.turn.phase !== targetPhase;
    sequence += 1
  ) {
    nextRoom = acceptCommand(
      nextRoom,
      createAdvancePhaseCommand(
        createLocalActionId(
          nextRoom.revision,
          sequence,
          `advance-${targetPhase}`,
        ),
        nextRoom.engineState.revision,
        nextRoom.engineState.turn.phase,
      ),
    ).room
  }

  expect(nextRoom.engineState.turn.phase).toBe(targetPhase)

  return nextRoom
}

function acceptCommand(
  room: MatchRoomWithEngineState,
  submission: matchSession.MatchRoomCommandSubmission,
) {
  const result = matchSession.submitMatchRoomCommand(room, submission, {
    submittedAt: '2026-05-07T00:00:04.000Z',
  })

  expect(result.status).toBe('accepted')

  if (result.status !== 'accepted') {
    throw new Error(`Expected accepted command, received ${result.status}.`)
  }

  return result
}
