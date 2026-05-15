import type { ActionId, GameState, PlayerId } from '@web-vg/rules-core'
import * as matchSession from '@web-vg/match-session'
import type {
  MatchRoomCommandResult,
  MatchRoomCommandSubmission,
  MatchRoomWithEngineState,
} from '@web-vg/match-session'

import {
  LOCAL_MATCH_PLAYER_ONE_ID,
  LOCAL_MATCH_PLAYER_TWO_ID,
  createAdvancePhaseCommand,
  createBeginMulliganCommand,
  createCallFirstHandCardCommand,
  createConcedeCommand,
  createEndTurnCommand,
  createKeepHandChoiceCommand,
  createLocalActionId,
  createMulliganFirstCardChoiceCommand,
  createReadyCommand,
  createRideFirstRideDeckCardCommand,
  createStartMatchCommand,
} from './local-match-room'

export type LocalAvailableActionGroup =
  | 'decision'
  | 'setup'
  | 'turn_flow'
  | 'board'
  | 'match'

export type LocalAvailableActionStatus = 'available' | 'blocked' | 'unavailable'

export interface LocalAvailableActionIntent {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly group: LocalAvailableActionGroup
  readonly relatedPlayerId?: PlayerId
  readonly relatedZoneKinds: readonly string[]
  readonly status: LocalAvailableActionStatus
  readonly preview: LocalAvailableActionPreview
  createSubmission(actionId: ActionId): MatchRoomCommandSubmission | null
}

export interface LocalAvailableActionPreview {
  readonly status: LocalAvailableActionStatus
  readonly resultStatus?: MatchRoomCommandResult['status']
  readonly code?: string
  readonly message?: string
  readonly eventTypes: readonly string[]
  readonly blockingRequestIds: readonly string[]
}

export interface LocalAvailableActionsProjection {
  readonly mode: 'normal' | 'pending_request' | 'closed'
  readonly perspectivePlayerId: PlayerId
  readonly pendingRequest?: GameState['pendingRequests'][number]
  readonly actions: readonly LocalAvailableActionIntent[]
  readonly availableActions: readonly LocalAvailableActionIntent[]
  readonly blockedActions: readonly LocalAvailableActionIntent[]
  readonly unavailableActions: readonly LocalAvailableActionIntent[]
}

interface LocalAvailableActionCandidate {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly group: LocalAvailableActionGroup
  readonly relatedPlayerId?: PlayerId
  readonly relatedZoneKinds?: readonly string[]
  createSubmission(actionId: ActionId): MatchRoomCommandSubmission | null
}

const AVAILABILITY_PROBE_SUBMITTED_AT = '2026-05-07T00:00:02.000Z'

export function buildLocalMatchAvailableActions(
  room: MatchRoomWithEngineState,
  perspectivePlayerId: PlayerId = LOCAL_MATCH_PLAYER_ONE_ID,
): LocalAvailableActionsProjection {
  const pendingRequest = room.engineState.pendingRequests[0]
  const candidates = buildLocalPrototypeCandidates(room)
  const actions = candidates.map((candidate, index) =>
    projectCandidate(room, candidate, index),
  )

  return {
    mode:
      room.status === 'completed' || room.status === 'aborted'
        ? 'closed'
        : pendingRequest === undefined
          ? 'normal'
          : 'pending_request',
    perspectivePlayerId,
    ...(pendingRequest === undefined ? {} : { pendingRequest }),
    actions,
    availableActions: actions.filter((action) => action.status === 'available'),
    blockedActions: actions.filter((action) => action.status === 'blocked'),
    unavailableActions: actions.filter(
      (action) => action.status === 'unavailable',
    ),
  }
}

function buildLocalPrototypeCandidates(
  room: MatchRoomWithEngineState,
): readonly LocalAvailableActionCandidate[] {
  const state = room.engineState
  const activePlayerId = state.turn.turnPlayerId
  const pendingRequest = state.pendingRequests[0]
  const candidates: LocalAvailableActionCandidate[] = []

  if (pendingRequest?.type === 'mulligan.select_cards') {
    candidates.push({
      id: 'choice.keep-hand',
      label: 'Keep current hand',
      description:
        'Resolve the pending mulligan request without returning cards.',
      group: 'decision',
      relatedPlayerId: pendingRequest.responderPlayerId,
      relatedZoneKinds: ['hand', 'deck'],
      createSubmission: (actionId) =>
        createKeepHandChoiceCommand(pendingRequest, actionId, state.revision),
    })
    candidates.push({
      id: 'choice.mulligan-first-card',
      label: 'Mulligan first hand card',
      description:
        'Return the first eligible hand card and draw a replacement through the pending request.',
      group: 'decision',
      relatedPlayerId: pendingRequest.responderPlayerId,
      relatedZoneKinds: ['hand', 'deck'],
      createSubmission: (actionId) =>
        createMulliganFirstCardChoiceCommand(
          pendingRequest,
          actionId,
          state.revision,
        ),
    })
  }

  candidates.push(
    {
      id: 'ready.player-one',
      label: 'Ready Aichi',
      description: 'Mark Aichi as ready for match start.',
      group: 'setup',
      relatedPlayerId: LOCAL_MATCH_PLAYER_ONE_ID,
      createSubmission: (actionId) =>
        createReadyCommand(LOCAL_MATCH_PLAYER_ONE_ID, actionId),
    },
    {
      id: 'ready.player-two',
      label: 'Ready Kai',
      description: 'Mark Kai as ready for match start.',
      group: 'setup',
      relatedPlayerId: LOCAL_MATCH_PLAYER_TWO_ID,
      createSubmission: (actionId) =>
        createReadyCommand(LOCAL_MATCH_PLAYER_TWO_ID, actionId),
    },
    {
      id: 'match.start',
      label: 'Start match',
      description: 'Start the game after both players are ready.',
      group: 'setup',
      createSubmission: (actionId) =>
        createStartMatchCommand(actionId, state.revision),
    },
    {
      id: 'mulligan.begin',
      label: 'Begin mulligan',
      description: 'Open the active player mulligan choice request.',
      group: 'turn_flow',
      relatedPlayerId: activePlayerId,
      relatedZoneKinds: ['hand', 'deck'],
      createSubmission: (actionId) =>
        createBeginMulliganCommand(activePlayerId, actionId, state.revision),
    },
    {
      id: 'phase.advance',
      label: 'Advance phase',
      description: 'Advance the turn to the next legal engine phase.',
      group: 'turn_flow',
      relatedPlayerId: activePlayerId,
      createSubmission: (actionId) =>
        createAdvancePhaseCommand(actionId, state.revision, state.turn.phase),
    },
    {
      id: 'turn.end-turn',
      label: 'End turn',
      description: 'End the current turn and switch to the next active player.',
      group: 'turn_flow',
      relatedPlayerId: activePlayerId,
      createSubmission: (actionId) =>
        createEndTurnCommand(activePlayerId, actionId, state.revision),
    },
    {
      id: 'board.ride-first-ride-deck-card',
      label: 'Ride first ride deck card',
      description:
        'Ride the first available card from the active player ride deck.',
      group: 'board',
      relatedPlayerId: activePlayerId,
      relatedZoneKinds: ['ride_deck', 'vanguard_circle', 'soul'],
      createSubmission: (actionId) =>
        createRideFirstRideDeckCardCommand(
          activePlayerId,
          actionId,
          state.revision,
          state,
        ),
    },
    {
      id: 'board.call-first-hand-card',
      label: 'Call first hand card',
      description:
        'Call the first available hand card to an empty rear-guard slot.',
      group: 'board',
      relatedPlayerId: activePlayerId,
      relatedZoneKinds: ['hand', 'rear_guard_circle'],
      createSubmission: (actionId) =>
        createCallFirstHandCardCommand(
          activePlayerId,
          actionId,
          state.revision,
          state,
        ),
    },
    {
      id: 'match.concede-kai',
      label: 'Concede Kai',
      description: 'Submit Kai concession through the room boundary.',
      group: 'match',
      relatedPlayerId: LOCAL_MATCH_PLAYER_TWO_ID,
      createSubmission: (actionId) =>
        createConcedeCommand(
          LOCAL_MATCH_PLAYER_TWO_ID,
          actionId,
          state.revision,
        ),
    },
  )

  return candidates.map((candidate) => ({
    ...candidate,
    relatedZoneKinds: candidate.relatedZoneKinds ?? [],
  }))
}

function projectCandidate(
  room: MatchRoomWithEngineState,
  candidate: LocalAvailableActionCandidate,
  index: number,
): LocalAvailableActionIntent {
  const probeActionId = createLocalActionId(
    room.revision,
    index + 1,
    `availability-${candidate.id}`,
  )
  const probeSubmission = candidate.createSubmission(probeActionId)

  if (probeSubmission === null) {
    const preview: LocalAvailableActionPreview = {
      status: 'unavailable',
      code: 'command_not_available',
      message: 'The current engine state cannot form this prototype command.',
      eventTypes: [],
      blockingRequestIds: [],
    }

    return {
      ...candidate,
      relatedZoneKinds: candidate.relatedZoneKinds ?? [],
      status: 'unavailable',
      preview,
    }
  }

  const probeResult = matchSession.submitMatchRoomCommand(
    room,
    probeSubmission,
    {
      submittedAt: AVAILABILITY_PROBE_SUBMITTED_AT,
    },
  )
  const preview = createPreview(probeResult)

  return {
    ...candidate,
    relatedZoneKinds: candidate.relatedZoneKinds ?? [],
    status: preview.status,
    preview,
  }
}

function createPreview(
  result: MatchRoomCommandResult,
): LocalAvailableActionPreview {
  switch (result.status) {
    case 'accepted':
      return {
        status: 'available',
        resultStatus: result.status,
        eventTypes: result.engineResult.events.map((event) => event.type),
        blockingRequestIds: [],
      }
    case 'blocked':
      return {
        status: 'blocked',
        resultStatus: result.status,
        code: result.code,
        message: result.message,
        eventTypes: [],
        blockingRequestIds: result.blockingRequests.map(
          (request) => request.requestId,
        ),
      }
    case 'invalid':
      return {
        status: 'unavailable',
        resultStatus: result.status,
        code: result.code,
        message: result.message,
        eventTypes: [],
        blockingRequestIds: [],
      }
  }
}
