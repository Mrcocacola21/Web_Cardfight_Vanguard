import {
  projectGameEventsForOmniscientViewer,
  projectGameEventsForPlayer,
  projectGameStateForOmniscientViewer,
  projectGameStateForPlayer,
} from '@web-vg/rules-core'
import type {
  GameEvent,
  PlayerId,
  VisibleGameEvent,
  VisibleGameState,
} from '@web-vg/rules-core'

import type {
  MatchRoom,
  MatchRoomLifecycleStatus,
  MatchRoomParticipant,
  MatchRoomParticipantId,
} from './match-room'
import { findMatchRoomParticipant, hasMatchRoomEngineState } from './match-room'
import { projectMatchRoomClock, type ProjectedMatchRoomClock } from './clock'

export interface ProjectedMatchRoomViewer {
  readonly participantId: MatchRoomParticipantId
  readonly playerId: PlayerId
}

export interface ProjectedMatchRoomForParticipant {
  readonly roomId: MatchRoom['roomId']
  readonly formatId: MatchRoom['formatId']
  readonly status: MatchRoomLifecycleStatus
  readonly revision: number
  readonly viewer: ProjectedMatchRoomViewer
  readonly participants: readonly MatchRoomParticipant[]
  readonly clock: ProjectedMatchRoomClock
  readonly visibleState: VisibleGameState
  readonly events: readonly VisibleGameEvent[]
}

export interface ProjectedMatchRoomForOmniscientViewer {
  readonly roomId: MatchRoom['roomId']
  readonly formatId: MatchRoom['formatId']
  readonly status: MatchRoomLifecycleStatus
  readonly revision: number
  readonly participants: readonly MatchRoomParticipant[]
  readonly clock: ProjectedMatchRoomClock
  readonly visibleState: VisibleGameState
  readonly events: readonly VisibleGameEvent[]
}

export type MatchRoomProjectionIssueCode =
  | 'room_not_initialized'
  | 'unknown_participant'
  | 'participant_not_bound_to_player'
  | 'unknown_viewer'

export type MatchRoomProjectionResult =
  | {
      readonly ok: true
      readonly projection: ProjectedMatchRoomForParticipant
    }
  | {
      readonly ok: false
      readonly code: MatchRoomProjectionIssueCode
      readonly message: string
    }

export type MatchRoomOmniscientProjectionResult =
  | {
      readonly ok: true
      readonly projection: ProjectedMatchRoomForOmniscientViewer
    }
  | {
      readonly ok: false
      readonly code: Extract<
        MatchRoomProjectionIssueCode,
        'room_not_initialized'
      >
      readonly message: string
    }

export function projectMatchRoomForParticipant(
  room: MatchRoom,
  participantId: MatchRoomParticipantId,
  options: {
    readonly events?: readonly GameEvent[]
    readonly serverNow?: string
  } = {},
): MatchRoomProjectionResult {
  if (!hasMatchRoomEngineState(room)) {
    return {
      ok: false,
      code: 'room_not_initialized',
      message: `Match room ${room.roomId} has no canonical engine state to project.`,
    }
  }

  const participant = findMatchRoomParticipant(room, participantId)

  if (participant === undefined) {
    return {
      ok: false,
      code: 'unknown_participant',
      message: `Cannot project match room ${room.roomId} for unknown participant ${participantId}.`,
    }
  }

  if (participant.enginePlayerId === undefined) {
    return {
      ok: false,
      code: 'participant_not_bound_to_player',
      message: `Cannot project match room ${room.roomId} for participant ${participantId} before an engine player binding exists.`,
    }
  }

  const visibleState = projectGameStateForPlayer(
    room.engineState,
    participant.enginePlayerId,
  )

  if (!visibleState.ok) {
    return visibleState
  }

  const visibleEvents = projectGameEventsForPlayer(
    room.engineState,
    participant.enginePlayerId,
    options.events ?? [],
  )

  if (!visibleEvents.ok) {
    return visibleEvents
  }

  return {
    ok: true,
    projection: {
      roomId: room.roomId,
      formatId: room.formatId,
      status: room.status,
      revision: room.revision,
      clock: projectMatchRoomClock(
        room.clock,
        options.serverNow === undefined ? {} : { serverNow: options.serverNow },
      ),
      viewer: {
        participantId,
        playerId: participant.enginePlayerId,
      },
      participants: room.participants,
      visibleState: visibleState.state,
      events: visibleEvents.events,
    },
  }
}

export function projectMatchRoomForOmniscientViewer(
  room: MatchRoom,
  options: {
    readonly events?: readonly GameEvent[]
    readonly serverNow?: string
  } = {},
): MatchRoomOmniscientProjectionResult {
  if (!hasMatchRoomEngineState(room)) {
    return {
      ok: false,
      code: 'room_not_initialized',
      message: `Match room ${room.roomId} has no canonical engine state to project.`,
    }
  }

  return {
    ok: true,
    projection: {
      roomId: room.roomId,
      formatId: room.formatId,
      status: room.status,
      revision: room.revision,
      participants: room.participants,
      clock: projectMatchRoomClock(
        room.clock,
        options.serverNow === undefined ? {} : { serverNow: options.serverNow },
      ),
      visibleState: projectGameStateForOmniscientViewer(room.engineState),
      events: projectGameEventsForOmniscientViewer(
        room.engineState,
        options.events ?? [],
      ),
    },
  }
}
