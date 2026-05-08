import { describe, expect, it } from 'vitest'

import * as matchSession from '@web-vg/match-session'
import type { MatchRoomWithEngineState } from '@web-vg/match-session'

import {
  LOCAL_MATCH_PLAYER_ONE_ID,
  LOCAL_MATCH_PLAYER_TWO_ID,
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

  it('surfaces turn-flow and board-development actions after match start', () => {
    const room = startLocalMatch(
      createLocalPrototypeMatchRoom('available-actions-started'),
    )

    const projection = buildLocalMatchAvailableActions(room)

    expect(labels(projection.availableActions)).toEqual(
      expect.arrayContaining([
        'Begin mulligan',
        'Advance phase',
        'Ride first ride deck card',
        'Call first hand card',
      ]),
    )
    expect(
      projection.availableActions.find(
        (action) => action.label === 'Ride first ride deck card',
      )?.relatedZoneKinds,
    ).toEqual(['ride_deck', 'vanguard_circle', 'soul'])
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
