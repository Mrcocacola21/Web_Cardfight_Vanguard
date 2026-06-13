import type {
  ProjectedMatchRoomForParticipant,
  RealtimeProjectedStatePush,
} from '@web-vg/match-session'
import type {
  ActionId,
  EngineCommand,
  GameChoiceResponse,
  PlayerId,
  VisibleGameChoiceRequest,
  VisibleGameState,
} from '@web-vg/rules-core'

import {
  buildProjectedMatchEventLogEntries,
  type ProjectedMatchEventLogEntry,
} from './event-log'
import {
  buildMatchBoardProjectionFromVisibleState,
  type MatchBoardProjection,
} from './zone-projection'

export type MatchClientActionGroup =
  | 'decision'
  | 'setup'
  | 'turn_flow'
  | 'board'
  | 'match'

export type MatchClientActionStatus = 'available' | 'blocked' | 'unavailable'

export interface MatchClientActionPreview {
  readonly status: MatchClientActionStatus
  readonly resultStatus?: string
  readonly code?: string
  readonly message?: string
  readonly eventTypes: readonly string[]
  readonly blockingRequestIds: readonly string[]
}

export interface MatchClientActionView {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly group: MatchClientActionGroup
  readonly relatedPlayerId?: PlayerId
  readonly relatedZoneKinds: readonly string[]
  readonly status: MatchClientActionStatus
  readonly preview: MatchClientActionPreview
  readonly command?: ProjectedMatchClientCommand
}

export interface ProjectedMatchClientCommand {
  readonly payload: EngineCommand
}

export interface MatchClientActionPendingRequestBadge {
  readonly type: string
}

export interface MatchClientActionsProjection {
  readonly mode: 'normal' | 'pending_request' | 'closed'
  readonly perspectivePlayerId: PlayerId
  readonly pendingRequest?: MatchClientActionPendingRequestBadge
  readonly actions: readonly MatchClientActionView[]
  readonly availableActions: readonly MatchClientActionView[]
  readonly blockedActions: readonly MatchClientActionView[]
  readonly unavailableActions: readonly MatchClientActionView[]
}

export interface ProjectedMatchPlayerSummary {
  readonly playerId: PlayerId
  readonly label: string
  readonly seat: number
  readonly status: VisibleGameState['players'][number]['status']
  readonly zoneCount: number
  readonly pieceCount: number
  readonly flagCount: number
}

export interface ProjectedMatchRoomClientState {
  readonly source: 'participant_projection'
  readonly roomId: string
  readonly formatId: string
  readonly status: ProjectedMatchRoomForParticipant['status']
  readonly gameStatus: VisibleGameState['status']
  readonly roomRevision: number
  readonly engineRevision: number
  readonly viewer: ProjectedMatchRoomForParticipant['viewer']
  readonly participants: ProjectedMatchRoomForParticipant['participants']
  readonly clock: ProjectedMatchRoomForParticipant['clock']
  readonly turn: VisibleGameState['turn']
  readonly zoneCount: number
  readonly pieceCount: number
  readonly playerSummaries: readonly ProjectedMatchPlayerSummary[]
  readonly board: MatchBoardProjection
  readonly pendingRequests: readonly VisibleGameChoiceRequest[]
  readonly eventLogEntries: readonly ProjectedMatchEventLogEntry[]
  readonly acceptedHistoryEntryIds: readonly string[]
}

export type ProjectedMatchRoomClientStateIssueCode =
  | 'non_player_projection'
  | 'projection_viewer_mismatch'
  | 'projection_missing_viewer_player'

export type ProjectedMatchRoomClientStateResult =
  | {
      readonly ok: true
      readonly state: ProjectedMatchRoomClientState
    }
  | {
      readonly ok: false
      readonly code: ProjectedMatchRoomClientStateIssueCode
      readonly message: string
    }

export function buildProjectedMatchRoomClientStateFromPush(
  push: RealtimeProjectedStatePush,
): ProjectedMatchRoomClientStateResult {
  return buildProjectedMatchRoomClientState({
    projection: push.projection,
    roomRevision: push.roomRevision,
    engineRevision: push.engineRevision,
    acceptedHistoryEntryIds: push.acceptedHistoryEntryIds,
  })
}

export function buildProjectedMatchRoomClientState(input: {
  readonly projection: ProjectedMatchRoomForParticipant
  readonly roomRevision?: number
  readonly engineRevision?: number
  readonly acceptedHistoryEntryIds?: readonly string[]
}): ProjectedMatchRoomClientStateResult {
  const { projection } = input
  const visibleState = projection.visibleState

  if (visibleState.projectionMode !== 'player') {
    return {
      ok: false,
      code: 'non_player_projection',
      message: `Match room ${projection.roomId} must use a player projection for the multiplayer client path.`,
    }
  }

  if (visibleState.viewerPlayerId !== projection.viewer.playerId) {
    return {
      ok: false,
      code: 'projection_viewer_mismatch',
      message: `Match room ${projection.roomId} projected viewer ${visibleState.viewerPlayerId ?? 'none'}, but the participant is bound to ${projection.viewer.playerId}.`,
    }
  }

  if (
    !visibleState.players.some(
      (player) => player.playerId === projection.viewer.playerId,
    )
  ) {
    return {
      ok: false,
      code: 'projection_missing_viewer_player',
      message: `Match room ${projection.roomId} projection does not include the viewer player ${projection.viewer.playerId}.`,
    }
  }

  const roomRevision = input.roomRevision ?? projection.revision
  const engineRevision = input.engineRevision ?? visibleState.revision

  return {
    ok: true,
    state: {
      source: 'participant_projection',
      roomId: projection.roomId,
      formatId: projection.formatId,
      status: projection.status,
      gameStatus: visibleState.status,
      roomRevision,
      engineRevision,
      viewer: projection.viewer,
      participants: projection.participants,
      clock: projection.clock,
      turn: visibleState.turn,
      zoneCount: visibleState.zones.length,
      pieceCount: visibleState.pieces.length,
      playerSummaries: buildPlayerSummaries(projection, visibleState),
      board: buildMatchBoardProjectionFromVisibleState(
        visibleState,
        projection.viewer.playerId,
      ),
      pendingRequests: visibleState.pendingRequests,
      eventLogEntries: buildProjectedMatchEventLogEntries(projection.events, {
        roomRevision,
        engineRevision,
        resolvePlayerLabel: (playerId) =>
          resolveProjectedPlayerLabel(projection, playerId),
      }),
      acceptedHistoryEntryIds: input.acceptedHistoryEntryIds ?? [],
    },
  }
}

export function createProjectedMatchActionsProjection(
  state: ProjectedMatchRoomClientState,
  actions: readonly MatchClientActionView[] = [],
): MatchClientActionsProjection {
  const pendingRequest = state.pendingRequests[0]

  return {
    mode:
      state.status === 'completed' || state.status === 'aborted'
        ? 'closed'
        : pendingRequest === undefined
          ? 'normal'
          : 'pending_request',
    perspectivePlayerId: state.viewer.playerId,
    ...(pendingRequest === undefined
      ? {}
      : {
          pendingRequest: {
            type: pendingRequest.type,
          },
        }),
    actions,
    availableActions: actions.filter((action) => action.status === 'available'),
    blockedActions: actions.filter((action) => action.status === 'blocked'),
    unavailableActions: actions.filter(
      (action) => action.status === 'unavailable',
    ),
  }
}

export function buildProjectedMatchBrowserCommandActions(
  state: ProjectedMatchRoomClientState,
): readonly MatchClientActionView[] {
  const actions: MatchClientActionView[] = []
  const viewerPlayerId = state.viewer.playerId
  const viewerSummary = state.playerSummaries.find(
    (player) => player.playerId === viewerPlayerId,
  )
  const viewerLabel = viewerSummary?.label ?? viewerPlayerId

  if (isClosedRoom(state)) {
    return actions
  }

  const pendingRequest = state.pendingRequests[0]

  if (
    pendingRequest !== undefined &&
    pendingRequest.responderPlayerId === viewerPlayerId
  ) {
    actions.push(...buildPendingRequestActions(state, pendingRequest))
  }

  if (
    pendingRequest === undefined &&
    state.gameStatus === 'setup' &&
    viewerSummary?.status !== 'ready'
  ) {
    actions.push(
      createAvailableCommandAction({
        state,
        id: 'setup.ready.viewer',
        label: `Ready ${viewerLabel}`,
        description: 'Mark yourself ready through the server room.',
        group: 'setup',
        relatedPlayerId: viewerPlayerId,
        actionType: 'match.ready',
      }),
    )
  }

  if (
    pendingRequest === undefined &&
    state.gameStatus === 'in_progress' &&
    state.turn.turnPlayerId === viewerPlayerId
  ) {
    actions.push(
      createAvailableCommandAction({
        state,
        id: 'turn.end-turn.viewer',
        label: 'End turn',
        description: 'Submit turn end through the server room.',
        group: 'turn_flow',
        relatedPlayerId: viewerPlayerId,
        actionType: 'turn.end_turn',
      }),
    )
  }

  actions.push(
    createAvailableCommandAction({
      state,
      id: 'match.concede.viewer',
      label: `Concede ${viewerLabel}`,
      description: 'Concede this match through the authoritative room.',
      group: 'match',
      relatedPlayerId: viewerPlayerId,
      actionType: 'match.concede',
    }),
  )

  return actions
}

export function resolveProjectedPlayerLabel(
  projection: Pick<ProjectedMatchRoomForParticipant, 'participants'>,
  playerId: PlayerId,
): string {
  return (
    projection.participants.find(
      (participant) => participant.enginePlayerId === playerId,
    )?.displayName ?? playerId
  )
}

function buildPlayerSummaries(
  projection: ProjectedMatchRoomForParticipant,
  visibleState: VisibleGameState,
): readonly ProjectedMatchPlayerSummary[] {
  return visibleState.players.map((player) => {
    const ownedZones = visibleState.zones.filter(
      (zone) => zone.ownerPlayerId === player.playerId,
    )

    return {
      playerId: player.playerId,
      label: resolveProjectedPlayerLabel(projection, player.playerId),
      seat: player.seat,
      status: player.status,
      zoneCount: ownedZones.length,
      pieceCount: ownedZones.reduce(
        (total, zone) => total + zone.occupantCount,
        0,
      ),
      flagCount: player.flags.length,
    }
  })
}

function buildPendingRequestActions(
  state: ProjectedMatchRoomClientState,
  request: VisibleGameChoiceRequest,
): readonly MatchClientActionView[] {
  if (request.visibilityToViewer !== 'full') {
    return [
      createUnavailableAction({
        id: 'choice.redacted',
        label: 'Pending choice',
        description: 'This pending choice is not visible to this viewer.',
        group: 'decision',
        relatedPlayerId: request.responderPlayerId,
        code: 'choice_redacted',
        message: 'The server projection redacted this choice request.',
      }),
    ]
  }

  const actions: MatchClientActionView[] = []

  if (request.allowPass === true) {
    actions.push(
      createChoiceResponseAction({
        state,
        id: 'choice.pass',
        label: 'Pass choice',
        description: 'Resolve the pending request with a pass response.',
        response: {
          requestId: request.requestId,
          responderPlayerId: request.responderPlayerId,
          type: 'answer.pass',
          reason: 'pass',
        },
      }),
    )
  }

  if (request.type === 'confirm.boolean') {
    actions.push(
      createChoiceResponseAction({
        state,
        id: 'choice.confirm-accept',
        label: 'Accept choice',
        description: 'Resolve the pending confirmation as accepted.',
        response: {
          requestId: request.requestId,
          responderPlayerId: request.responderPlayerId,
          type: 'answer.boolean',
          accepted: true,
        },
      }),
      createChoiceResponseAction({
        state,
        id: 'choice.confirm-decline',
        label: 'Decline choice',
        description: 'Resolve the pending confirmation as declined.',
        response: {
          requestId: request.requestId,
          responderPlayerId: request.responderPlayerId,
          type: 'answer.boolean',
          accepted: false,
        },
      }),
    )
  }

  if (actions.length > 0) {
    return actions
  }

  return [
    createUnavailableAction({
      id: `choice.unsupported.${request.type}`,
      label: formatChoiceActionLabel(request.type),
      description:
        'This projected request is visible, but the first realtime client command catalog does not submit it yet.',
      group: 'decision',
      relatedPlayerId: request.responderPlayerId,
      code: 'projected_choice_not_submittable',
      message:
        'Submit support for this choice type is intentionally outside the first sync loop.',
    }),
  ]
}

function createAvailableCommandAction(input: {
  readonly state: ProjectedMatchRoomClientState
  readonly id: string
  readonly label: string
  readonly description: string
  readonly group: MatchClientActionGroup
  readonly relatedPlayerId: PlayerId
  readonly actionType: 'match.ready' | 'match.concede' | 'turn.end_turn'
}): MatchClientActionView {
  return {
    id: input.id,
    label: input.label,
    description: input.description,
    group: input.group,
    relatedPlayerId: input.relatedPlayerId,
    relatedZoneKinds: [],
    status: 'available',
    preview: createAvailablePreview(),
    command: {
      payload: {
        kind: 'action',
        submission: {
          expectedRevision: input.state.engineRevision,
          action: {
            actionId: createProjectedActionId(input.state, input.id),
            type: input.actionType,
            actor: {
              kind: 'player',
              playerId: input.relatedPlayerId,
            },
          },
        },
      },
    },
  }
}

function createChoiceResponseAction(input: {
  readonly state: ProjectedMatchRoomClientState
  readonly id: string
  readonly label: string
  readonly description: string
  readonly response: GameChoiceResponse
}): MatchClientActionView {
  return {
    id: input.id,
    label: input.label,
    description: input.description,
    group: 'decision',
    relatedPlayerId: input.response.responderPlayerId,
    relatedZoneKinds: [],
    status: 'available',
    preview: createAvailablePreview(),
    command: {
      payload: {
        kind: 'choice_response',
        submission: {
          expectedRevision: input.state.engineRevision,
          response: input.response,
        },
      },
    },
  }
}

function createUnavailableAction(input: {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly group: MatchClientActionGroup
  readonly relatedPlayerId?: PlayerId
  readonly code: string
  readonly message: string
}): MatchClientActionView {
  return {
    id: input.id,
    label: input.label,
    description: input.description,
    group: input.group,
    ...(input.relatedPlayerId === undefined
      ? {}
      : { relatedPlayerId: input.relatedPlayerId }),
    relatedZoneKinds: [],
    status: 'unavailable',
    preview: {
      status: 'unavailable',
      code: input.code,
      message: input.message,
      eventTypes: [],
      blockingRequestIds: [],
    },
  }
}

function createAvailablePreview(): MatchClientActionPreview {
  return {
    status: 'available',
    eventTypes: [],
    blockingRequestIds: [],
  }
}

function createProjectedActionId(
  state: ProjectedMatchRoomClientState,
  actionId: string,
): ActionId {
  return `projected-action:${state.roomId}:room-r${state.roomRevision}:engine-r${state.engineRevision}:${actionId}` as ActionId
}

function isClosedRoom(state: ProjectedMatchRoomClientState): boolean {
  return state.status === 'completed' || state.status === 'aborted'
}

function formatChoiceActionLabel(type: VisibleGameChoiceRequest['type']) {
  return type
    .split('.')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}
