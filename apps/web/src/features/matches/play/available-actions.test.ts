import { describe, expect, it } from 'vitest'

import * as matchSession from '@web-vg/match-session'
import type { MatchRoomWithEngineState } from '@web-vg/match-session'

import {
  LOCAL_MATCH_PLAYER_ONE_ID,
  LOCAL_MATCH_PLAYER_TWO_ID,
  createAdvancePhaseCommand,
  createBeginMulliganCommand,
  createConcedeCommand,
  createLocalActionId,
  createLocalPrototypeMatchRoom,
  createReadyCommand,
  createStartMatchCommand,
} from './local-match-room'
import { buildLocalMatchAvailableActions } from './available-actions'

describe('buildLocalMatchAvailableActions', () => {
  it('projects available and unavailable setup actions through the room boundary', () => {
    const room = createLocalPrototypeMatchRoom('available-actions-setup')
    const stateBeforeProjection = JSON.stringify(room.engineState)

    const projection = buildLocalMatchAvailableActions(room)

    expect(JSON.stringify(room.engineState)).toBe(stateBeforeProjection)
    expect(projection.mode).toBe('normal')
    expect(labels(projection.availableActions)).toEqual(
      expect.arrayContaining(['Ready Aichi', 'Ready Kai', 'Concede Kai']),
    )
    expect(
      projection.unavailableActions.find(
        (action) => action.label === 'Start match',
      )?.preview,
    ).toMatchObject({
      status: 'unavailable',
      code: 'invalid_action',
    })
  })

  it('surfaces turn-flow after match start and board actions in legal phases', () => {
    const room = startLocalMatch(
      createLocalPrototypeMatchRoom('available-actions-started'),
    )

    const projection = buildLocalMatchAvailableActions(room)

    expect(labels(projection.availableActions)).toEqual(
      expect.arrayContaining([
        'Begin mulligan',
        'Advance phase',
        'Concede Kai',
      ]),
    )
    expect(labels(projection.unavailableActions)).toEqual(
      expect.arrayContaining([
        'Ride first ride deck card',
        'Call first hand card',
      ]),
    )

    const rideRoom = advanceRoomToPhase(room, 'ride')
    const rideProjection = buildLocalMatchAvailableActions(rideRoom)

    expect(labels(rideProjection.availableActions)).toEqual(
      expect.arrayContaining(['Ride first ride deck card']),
    )
    expect(
      rideProjection.availableActions.find(
        (action) => action.label === 'Ride first ride deck card',
      )?.relatedZoneKinds,
    ).toEqual(['ride_deck', 'vanguard_circle', 'soul'])

    const rideAction = rideProjection.availableActions.find(
      (action) => action.label === 'Ride first ride deck card',
    )

    if (rideAction === undefined) {
      throw new Error('Expected ride command to be available.')
    }

    const rideSubmission = rideAction.createSubmission(
      createLocalActionId(rideRoom.revision, 30, 'ride-first-card'),
    )

    if (rideSubmission === null) {
      throw new Error('Expected ride action to create a submission.')
    }

    const riddenRoom = acceptCommand(rideRoom, rideSubmission)
    const mainRoom = advanceRoomToPhase(riddenRoom, 'main')
    const mainProjection = buildLocalMatchAvailableActions(mainRoom)

    expect(labels(mainProjection.availableActions)).toEqual(
      expect.arrayContaining(['Call first hand card']),
    )

    const endRoom = advanceRoomToPhase(mainRoom, 'end')
    const endProjection = buildLocalMatchAvailableActions(endRoom)

    expect(labels(endProjection.availableActions)).toEqual(
      expect.arrayContaining(['End turn']),
    )
  })

  it('keeps board availability downstream of core grade legality', () => {
    const room = startLocalMatch(
      createLocalPrototypeMatchRoom('available-actions-grade-legality'),
    )
    const mainWithoutRideRoom = advanceRoomToPhase(room, 'main')
    const projection = buildLocalMatchAvailableActions(mainWithoutRideRoom)

    expect(labels(projection.availableActions)).not.toContain(
      'Call first hand card',
    )
    expect(
      projection.unavailableActions.find(
        (action) => action.label === 'Call first hand card',
      )?.preview,
    ).toMatchObject({
      status: 'unavailable',
      code: 'call_grade_restricted',
    })
  })

  it('treats pending requests as action availability and blocks normal actions', () => {
    const startedRoom = startLocalMatch(
      createLocalPrototypeMatchRoom('available-actions-pending'),
    )
    const pendingRoom = acceptCommand(
      startedRoom,
      createBeginMulliganCommand(
        LOCAL_MATCH_PLAYER_ONE_ID,
        createLocalActionId(startedRoom.revision, 4, 'begin-mulligan'),
        startedRoom.engineState.revision,
      ),
    )

    const projection = buildLocalMatchAvailableActions(pendingRoom)

    expect(projection.mode).toBe('pending_request')
    expect(projection.pendingRequest?.type).toBe('mulligan.select_cards')
    expect(labels(projection.availableActions)).toEqual(
      expect.arrayContaining([
        'Keep current hand',
        'Mulligan first hand card',
        'Concede Kai',
      ]),
    )
    expect(
      projection.availableActions.find(
        (action) => action.label === 'Mulligan first hand card',
      )?.preview.eventTypes,
    ).toEqual(
      expect.arrayContaining([
        'piece.moved',
        'zone.shuffled',
        'cards.drawn',
        'mulligan.completed',
      ]),
    )
    expect(
      projection.blockedActions.find(
        (action) => action.label === 'Advance phase',
      )?.preview,
    ).toMatchObject({
      status: 'blocked',
      code: 'pending_request',
    })
  })

  it('renders a closed no-action state after completion', () => {
    const completedRoom = acceptCommand(
      createLocalPrototypeMatchRoom('available-actions-completed'),
      createConcedeCommand(
        LOCAL_MATCH_PLAYER_TWO_ID,
        createLocalActionId(1, 1, 'concede-kai'),
        0,
      ),
    )

    const projection = buildLocalMatchAvailableActions(completedRoom)

    expect(projection.mode).toBe('closed')
    expect(projection.availableActions).toHaveLength(0)
    expect(
      projection.unavailableActions.every(
        (action) => action.preview.code === 'room_closed',
      ),
    ).toBe(true)
  })
})

function labels(actions: readonly { readonly label: string }[]) {
  return actions.map((action) => action.label)
}

function startLocalMatch(
  room: MatchRoomWithEngineState,
): MatchRoomWithEngineState {
  const playerOneReadyRoom = acceptCommand(
    room,
    createReadyCommand(
      LOCAL_MATCH_PLAYER_ONE_ID,
      createLocalActionId(room.revision, 1, 'ready-aichi'),
    ),
  )
  const playerTwoReadyRoom = acceptCommand(
    playerOneReadyRoom,
    createReadyCommand(
      LOCAL_MATCH_PLAYER_TWO_ID,
      createLocalActionId(playerOneReadyRoom.revision, 2, 'ready-kai'),
    ),
  )

  return acceptCommand(
    playerTwoReadyRoom,
    createStartMatchCommand(
      createLocalActionId(playerTwoReadyRoom.revision, 3, 'start-match'),
      playerTwoReadyRoom.engineState.revision,
    ),
  )
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
    )
  }

  expect(nextRoom.engineState.turn.phase).toBe(targetPhase)

  return nextRoom
}

function acceptCommand(
  room: MatchRoomWithEngineState,
  submission: matchSession.MatchRoomCommandSubmission,
): MatchRoomWithEngineState {
  const result = matchSession.submitMatchRoomCommand(room, submission, {
    submittedAt: '2026-05-07T00:00:03.000Z',
  })

  expect(result.status).toBe('accepted')

  if (result.status !== 'accepted') {
    throw new Error(`Expected accepted command, received ${result.status}.`)
  }

  return result.room
}
