import { describe, expect, it } from 'vitest'

import {
  projectMatchRoomForParticipant,
  submitMatchRoomCommand,
  type MatchRoomCommandSubmission,
  type MatchRoomWithEngineState,
  type ProjectedMatchRoomForParticipant,
} from '@web-vg/match-session'
import type { EventId, GameEvent, GameState, ZoneId } from '@web-vg/rules-core'

import {
  LOCAL_MATCH_PARTICIPANT_ONE_ID,
  LOCAL_MATCH_PLAYER_ONE_ID,
  LOCAL_MATCH_PLAYER_TWO_ID,
  createBeginMulliganCommand,
  createLocalActionId,
  createLocalPrototypeMatchRoom,
  createReadyCommand,
  createStartMatchCommand,
} from './local-match-room'
import {
  buildProjectedMatchBrowserCommandActions,
  buildProjectedMatchRoomClientState,
  createProjectedMatchActionsProjection,
} from './projected-client-state'

describe('projected match room client state', () => {
  it('builds the multiplayer client shape from participant projection without canonical engine state', () => {
    const clientState = buildClientState(
      createLocalPrototypeMatchRoom('projected-client-board'),
    )
    const opponentHand = clientState.board.opponentSides[0]?.handZones[0]
    const currentHand = clientState.board.currentSide?.handZones[0]

    expect(clientState.source).toBe('participant_projection')
    expect(JSON.stringify(clientState)).not.toContain('engineState')
    expect(clientState.viewer.playerId).toBe(LOCAL_MATCH_PLAYER_ONE_ID)
    expect(currentHand?.pieces.some((piece) => piece.cardDefinitionId)).toBe(
      true,
    )
    expect(
      opponentHand?.pieces.every((piece) => piece.visibility === 'masked'),
    ).toBe(true)
    expect(JSON.stringify(opponentHand)).not.toContain('cardDefinitionId')
    expect(JSON.stringify(opponentHand)).not.toContain('pieceId')
  })

  it('formats event log entries from participant-safe projected events only', () => {
    const room = createLocalPrototypeMatchRoom('projected-client-events')
    const opponentHandPieceId = findOwnedZone(room.engineState, 'hand')
      ?.occupants[0]?.pieceId

    if (opponentHandPieceId === undefined) {
      throw new Error('Expected opponent hand piece in local fixture.')
    }

    const clientState = buildClientState(room, [
      {
        eventId: 'projected-event-draw' as EventId,
        type: 'cards.drawn',
        sequence: 1,
        origin: {
          kind: 'system',
          system: 'rules-engine',
        },
        playerId: LOCAL_MATCH_PLAYER_TWO_ID,
        fromZoneId: 'p2:zone:deck' as ZoneId,
        toZoneId: 'p2:zone:hand' as ZoneId,
        pieceIds: [opponentHandPieceId],
      },
    ])

    expect(clientState.eventLogEntries).toHaveLength(1)
    expect(clientState.eventLogEntries[0]).toMatchObject({
      type: 'cards.drawn',
      summary: 'Toshiki Kai drew 1 cards.',
    })
    expect(JSON.stringify(clientState.eventLogEntries[0])).toContain('redacted')
    expect(JSON.stringify(clientState.eventLogEntries[0])).not.toContain(
      opponentHandPieceId,
    )
  })

  it('surfaces pending requests and default action mode from projected session truth', () => {
    const room = createLocalPrototypeMatchRoom('projected-client-pending')
    const readyRoom = acceptCommand(
      room,
      createReadyCommand(
        LOCAL_MATCH_PLAYER_ONE_ID,
        createLocalActionId(room.revision, 1, 'ready-aichi'),
      ),
    )
    const readyBothRoom = acceptCommand(
      readyRoom,
      createReadyCommand(
        LOCAL_MATCH_PLAYER_TWO_ID,
        createLocalActionId(readyRoom.revision, 2, 'ready-kai'),
      ),
    )
    const startedRoom = acceptCommand(
      readyBothRoom,
      createStartMatchCommand(
        createLocalActionId(readyBothRoom.revision, 3, 'start-match'),
        readyBothRoom.engineState.revision,
      ),
    )
    const pendingRoom = acceptCommand(
      startedRoom,
      createBeginMulliganCommand(
        LOCAL_MATCH_PLAYER_ONE_ID,
        createLocalActionId(startedRoom.revision, 4, 'begin-mulligan'),
        startedRoom.engineState.revision,
      ),
    )

    const clientState = buildClientState(pendingRoom)
    const actions = createProjectedMatchActionsProjection(clientState)

    expect(clientState.pendingRequests[0]).toMatchObject({
      type: 'mulligan.select_cards',
      visibilityToViewer: 'full',
    })
    expect(JSON.stringify(clientState.pendingRequests[0])).not.toContain(
      'eligiblePieceIds',
    )
    expect(actions).toMatchObject({
      mode: 'pending_request',
      pendingRequest: {
        type: 'mulligan.select_cards',
      },
    })
    expect(actions.availableActions).toHaveLength(0)
  })

  it('builds browser command descriptors from participant projection without canonical room mutation', () => {
    const room = createLocalPrototypeMatchRoom('projected-client-commands')
    const clientState = buildClientState(room)
    const actions = buildProjectedMatchBrowserCommandActions(clientState)
    const readyAction = actions.find(
      (action) => action.id === 'setup.ready.viewer',
    )
    const concedeAction = actions.find(
      (action) => action.id === 'match.concede.viewer',
    )

    expect(readyAction).toBeDefined()
    expect(concedeAction).toBeDefined()

    if (readyAction === undefined || concedeAction === undefined) {
      throw new Error('Expected ready and concede projected actions.')
    }

    expect(readyAction.command?.payload).toMatchObject({
      kind: 'action',
      submission: {
        expectedRevision: clientState.engineRevision,
        action: {
          type: 'match.ready',
          actor: {
            kind: 'player',
            playerId: LOCAL_MATCH_PLAYER_ONE_ID,
          },
        },
      },
    })
    expect(concedeAction.command?.payload).toMatchObject({
      kind: 'action',
      submission: {
        expectedRevision: clientState.engineRevision,
        action: {
          type: 'match.concede',
          actor: {
            kind: 'player',
          },
        },
      },
    })
    expect(JSON.stringify(actions)).not.toContain('"kind":"system"')
    expect(JSON.stringify(actions)).not.toContain('engineState')
  })

  it('rejects omniscient projections instead of accepting a god-view payload', () => {
    const projection = projectLocalRoom(
      createLocalPrototypeMatchRoom('projected-client-omniscient-rejected'),
    )
    const { viewerPlayerId: _viewerPlayerId, ...visibleStateWithoutViewer } =
      projection.visibleState
    const result = buildProjectedMatchRoomClientState({
      projection: {
        ...projection,
        visibleState: {
          ...visibleStateWithoutViewer,
          projectionMode: 'omniscient',
        },
      },
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'non_player_projection',
    })
  })
})

function buildClientState(
  room: MatchRoomWithEngineState,
  events: readonly GameEvent[] = [],
) {
  const result = buildProjectedMatchRoomClientState({
    projection: projectLocalRoom(room, events),
  })

  expect(result.ok).toBe(true)

  if (!result.ok) {
    throw new Error(result.message)
  }

  return result.state
}

function projectLocalRoom(
  room: MatchRoomWithEngineState,
  events: readonly GameEvent[] = [],
): ProjectedMatchRoomForParticipant {
  const projection = projectMatchRoomForParticipant(
    room,
    LOCAL_MATCH_PARTICIPANT_ONE_ID,
    {
      events,
    },
  )

  expect(projection.ok).toBe(true)

  if (!projection.ok) {
    throw new Error(projection.message)
  }

  return projection.projection
}

function acceptCommand(
  room: MatchRoomWithEngineState,
  submission: MatchRoomCommandSubmission,
): MatchRoomWithEngineState {
  const result = submitMatchRoomCommand(room, submission, {
    submittedAt: '2026-05-07T00:00:04.000Z',
  })

  expect(result.status).toBe('accepted')

  if (result.status !== 'accepted') {
    throw new Error(`Expected accepted command, received ${result.status}.`)
  }

  return result.room
}

function findOwnedZone(
  state: GameState,
  kind: GameState['zones'][number]['kind'],
) {
  return state.zones.find(
    (zone) =>
      zone.ownerPlayerId === LOCAL_MATCH_PLAYER_TWO_ID && zone.kind === kind,
  )
}
