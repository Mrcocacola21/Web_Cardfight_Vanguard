import type {
  BlockedEngineDispatchResult,
  EngineCommand,
  GameEvent,
} from '@web-vg/rules-core'
import { isSystemGameAction } from '@web-vg/rules-core'
import type { Brand } from '@web-vg/shared'

import type {
  AcceptedMatchRoomCommandResult,
  AcceptedMatchRoomTimeoutResult,
  BlockedMatchRoomCommandResult,
  InvalidMatchRoomCommandResult,
  MatchRoomEngineAdapter,
  MatchRoomId,
  MatchRoomInvalidCommandCode,
  MatchRoomParticipantId,
} from './match-room'
import {
  hasMatchRoomEngineState,
  resolveMatchRoomTimeout,
  submitMatchRoomCommand,
} from './match-room'
import {
  projectMatchRoomForParticipant,
  type MatchRoomProjectionIssueCode,
  type ProjectedMatchRoomForParticipant,
} from './projection'
import { systemMatchRoomClock, type MatchRoomClockSource } from './clock'
import {
  recordMatchRoomCommandResult,
  type MatchRoomHistoryEntry,
  type MatchRoomHistoryEntryId,
  type MatchSessionSerializationIssueCode,
  type SerializableMatchSessionDocument,
} from './session-persistence'

export type RealtimeTransportBaseline =
  'websocket_commands_with_projected_snapshots'

export const MATCH_REALTIME_TRANSPORT_BASELINE =
  'websocket_commands_with_projected_snapshots' satisfies RealtimeTransportBaseline

export type RealtimeClientCommandId = Brand<string, 'RealtimeClientCommandId'>

export interface RealtimeClientCommand {
  readonly commandId: RealtimeClientCommandId
  readonly roomId: MatchRoomId
  readonly participantId: MatchRoomParticipantId
  readonly expectedRoomRevision?: number
  readonly payload: EngineCommand
}

export type RealtimeProjectedStatePushReason =
  | 'command_accepted'
  | 'timeout_resolved'
  | 'reconnect_snapshot'

export interface RealtimeProjectedStatePush {
  readonly type: 'projected_state'
  readonly reason: RealtimeProjectedStatePushReason
  readonly roomId: MatchRoomId
  readonly participantId: MatchRoomParticipantId
  readonly roomRevision: number
  readonly engineRevision: number
  readonly acceptedHistoryEntryIds: readonly MatchRoomHistoryEntryId[]
  readonly projection: ProjectedMatchRoomForParticipant
}

export type RealtimeRuntimeInvalidCode =
  | 'room_id_mismatch'
  | 'stale_room_revision'
  | 'client_system_action_forbidden'
  | 'missing_projection_target'
  | MatchRoomInvalidCommandCode
  | MatchRoomProjectionIssueCode
  | MatchSessionSerializationIssueCode

export interface RealtimeClientCommandAcceptedResult {
  readonly status: 'accepted'
  readonly commandId: RealtimeClientCommandId
  readonly roomId: MatchRoomId
  readonly participantId: MatchRoomParticipantId
  readonly document: SerializableMatchSessionDocument
  readonly roomResult: AcceptedMatchRoomCommandResult
  readonly acceptedHistory: readonly MatchRoomHistoryEntry[]
  readonly pushes: readonly RealtimeProjectedStatePush[]
}

export interface RealtimeClientCommandInvalidResult {
  readonly status: 'invalid'
  readonly commandId: RealtimeClientCommandId
  readonly roomId: MatchRoomId
  readonly participantId: MatchRoomParticipantId
  readonly document: SerializableMatchSessionDocument
  readonly code: RealtimeRuntimeInvalidCode
  readonly message: string
  readonly roomResult?: InvalidMatchRoomCommandResult
  readonly pushes: readonly RealtimeProjectedStatePush[]
}

export interface RealtimeClientCommandBlockedResult {
  readonly status: 'blocked'
  readonly commandId: RealtimeClientCommandId
  readonly roomId: MatchRoomId
  readonly participantId: MatchRoomParticipantId
  readonly document: SerializableMatchSessionDocument
  readonly code: BlockedEngineDispatchResult['code']
  readonly message: string
  readonly roomResult: BlockedMatchRoomCommandResult
  readonly blockingRequests: BlockedMatchRoomCommandResult['blockingRequests']
  readonly pushes: readonly RealtimeProjectedStatePush[]
}

export type RealtimeClientCommandResult =
  | RealtimeClientCommandAcceptedResult
  | RealtimeClientCommandInvalidResult
  | RealtimeClientCommandBlockedResult

export interface RealtimeTimeoutAcceptedResult {
  readonly status: 'accepted'
  readonly document: SerializableMatchSessionDocument
  readonly timeoutResult: AcceptedMatchRoomTimeoutResult
  readonly acceptedHistory: readonly MatchRoomHistoryEntry[]
  readonly pushes: readonly RealtimeProjectedStatePush[]
}

export interface RealtimeTimeoutNotDueResult {
  readonly status: 'not_due'
  readonly document: SerializableMatchSessionDocument
  readonly checkedAt: string
  readonly pushes: readonly RealtimeProjectedStatePush[]
}

export interface RealtimeTimeoutInvalidResult {
  readonly status: 'invalid'
  readonly document: SerializableMatchSessionDocument
  readonly checkedAt: string
  readonly code: RealtimeRuntimeInvalidCode
  readonly message: string
  readonly pushes: readonly RealtimeProjectedStatePush[]
}

export type RealtimeTimeoutResolutionResult =
  | RealtimeTimeoutAcceptedResult
  | RealtimeTimeoutNotDueResult
  | RealtimeTimeoutInvalidResult

export type RealtimeProjectedStatePushesResult =
  | {
      readonly ok: true
      readonly pushes: readonly RealtimeProjectedStatePush[]
    }
  | {
      readonly ok: false
      readonly code: RealtimeRuntimeInvalidCode
      readonly message: string
    }

export type RealtimeParticipantSnapshotResult =
  | {
      readonly ok: true
      readonly push: RealtimeProjectedStatePush
    }
  | {
      readonly ok: false
      readonly code: RealtimeRuntimeInvalidCode
      readonly message: string
    }

export function submitRealtimeClientCommand(input: {
  readonly document: SerializableMatchSessionDocument
  readonly command: RealtimeClientCommand
  readonly engineAdapters?: readonly MatchRoomEngineAdapter[]
  readonly receivedAt?: string
  readonly clock?: MatchRoomClockSource
}): RealtimeClientCommandResult {
  const transportValidation = validateRealtimeClientCommand(input)

  if (!transportValidation.ok) {
    return createRealtimeInvalidCommandResult({
      document: input.document,
      command: input.command,
      code: transportValidation.code,
      message: transportValidation.message,
    })
  }

  const receivedAt =
    input.receivedAt ?? input.clock?.now() ?? systemMatchRoomClock.now()
  const roomResult = submitMatchRoomCommand(
    input.document.room,
    {
      source: {
        kind: 'participant',
        participantId: input.command.participantId,
      },
      command: input.command.payload,
    },
    {
      ...(input.engineAdapters === undefined
        ? {}
        : { engineAdapters: input.engineAdapters }),
      submittedAt: receivedAt,
      ...(input.clock === undefined ? {} : { clock: input.clock }),
    },
  )

  switch (roomResult.status) {
    case 'invalid':
      return createRealtimeInvalidCommandResult({
        document: input.document,
        command: input.command,
        code: roomResult.code,
        message: roomResult.message,
        roomResult,
      })
    case 'blocked':
      return {
        status: 'blocked',
        commandId: input.command.commandId,
        roomId: input.command.roomId,
        participantId: input.command.participantId,
        document: input.document,
        code: roomResult.code,
        message: roomResult.message,
        roomResult,
        blockingRequests: roomResult.blockingRequests,
        pushes: [],
      }
    case 'accepted':
      return createRealtimeAcceptedCommandResult({
        document: input.document,
        command: input.command,
        roomResult,
        receivedAt,
      })
  }
}

export function createRealtimeProjectedStatePushes(input: {
  readonly document: SerializableMatchSessionDocument
  readonly reason: RealtimeProjectedStatePushReason
  readonly events?: readonly GameEvent[]
  readonly acceptedHistory?: readonly MatchRoomHistoryEntry[]
  readonly serverNow?: string
}): RealtimeProjectedStatePushesResult {
  const room = input.document.room

  if (!hasMatchRoomEngineState(room)) {
    return {
      ok: false,
      code: 'room_not_initialized',
      message: `Match room ${room.roomId} has no canonical state to project for realtime clients.`,
    }
  }

  const recipients = room.participants.filter(
    (participant) => participant.enginePlayerId !== undefined,
  )

  if (recipients.length === 0) {
    return {
      ok: false,
      code: 'missing_projection_target',
      message: `Match room ${room.roomId} has no bound participants for realtime projection.`,
    }
  }

  const acceptedHistoryEntryIds = (input.acceptedHistory ?? []).map(
    (entry) => entry.entryId,
  )
  const pushes: RealtimeProjectedStatePush[] = []

  for (const participant of recipients) {
    const projection = projectMatchRoomForParticipant(
      room,
      participant.participantId,
      {
        events: input.events ?? [],
        ...(input.serverNow === undefined
          ? {}
          : { serverNow: input.serverNow }),
      },
    )

    if (!projection.ok) {
      return {
        ok: false,
        code: projection.code,
        message: projection.message,
      }
    }

    pushes.push({
      type: 'projected_state',
      reason: input.reason,
      roomId: room.roomId,
      participantId: participant.participantId,
      roomRevision: room.revision,
      engineRevision: room.engineState.revision,
      acceptedHistoryEntryIds,
      projection: projection.projection,
    })
  }

  return {
    ok: true,
    pushes,
  }
}

export function createRealtimeParticipantSnapshot(input: {
  readonly document: SerializableMatchSessionDocument
  readonly participantId: MatchRoomParticipantId
  readonly serverNow?: string
}): RealtimeParticipantSnapshotResult {
  const room = input.document.room

  if (!hasMatchRoomEngineState(room)) {
    return {
      ok: false,
      code: 'room_not_initialized',
      message: `Match room ${room.roomId} has no canonical state to project for realtime clients.`,
    }
  }

  const projection = projectMatchRoomForParticipant(
    room,
    input.participantId,
    input.serverNow === undefined ? {} : { serverNow: input.serverNow },
  )

  if (!projection.ok) {
    return {
      ok: false,
      code: projection.code,
      message: projection.message,
    }
  }

  return {
    ok: true,
    push: {
      type: 'projected_state',
      reason: 'reconnect_snapshot',
      roomId: room.roomId,
      participantId: input.participantId,
      roomRevision: room.revision,
      engineRevision: room.engineState.revision,
      acceptedHistoryEntryIds: [],
      projection: projection.projection,
    },
  }
}

export function resolveRealtimeMatchRoomTimeout(input: {
  readonly document: SerializableMatchSessionDocument
  readonly engineAdapters?: readonly MatchRoomEngineAdapter[]
  readonly checkedAt?: string
  readonly clock?: MatchRoomClockSource
}): RealtimeTimeoutResolutionResult {
  const checkedAt =
    input.checkedAt ?? input.clock?.now() ?? systemMatchRoomClock.now()
  const timeoutResult = resolveMatchRoomTimeout(input.document.room, {
    ...(input.engineAdapters === undefined
      ? {}
      : { engineAdapters: input.engineAdapters }),
    checkedAt,
    ...(input.clock === undefined ? {} : { clock: input.clock }),
  })

  if (timeoutResult.status === 'not_due') {
    return {
      status: 'not_due',
      document: input.document,
      checkedAt,
      pushes: [],
    }
  }

  if (timeoutResult.status === 'invalid') {
    return {
      status: 'invalid',
      document: input.document,
      checkedAt,
      code: timeoutResult.code,
      message: timeoutResult.message,
      pushes: [],
    }
  }

  const recorded = recordMatchRoomCommandResult({
    document: input.document,
    result: timeoutResult,
    recordedAt: checkedAt,
  })

  if (!recorded.ok) {
    return {
      status: 'invalid',
      document: input.document,
      checkedAt,
      code: recorded.code,
      message: recorded.message,
      pushes: [],
    }
  }

  const acceptedHistory = recorded.document.history.slice(
    input.document.history.length,
  )
  const pushResult = createRealtimeProjectedStatePushes({
    document: recorded.document,
    reason: 'timeout_resolved',
    events: timeoutResult.engineResult.events,
    acceptedHistory,
    serverNow: checkedAt,
  })

  if (!pushResult.ok) {
    return {
      status: 'invalid',
      document: recorded.document,
      checkedAt,
      code: pushResult.code,
      message: pushResult.message,
      pushes: [],
    }
  }

  return {
    status: 'accepted',
    document: recorded.document,
    timeoutResult,
    acceptedHistory,
    pushes: pushResult.pushes,
  }
}

function createRealtimeAcceptedCommandResult(input: {
  readonly document: SerializableMatchSessionDocument
  readonly command: RealtimeClientCommand
  readonly roomResult: AcceptedMatchRoomCommandResult
  readonly receivedAt: string
}): RealtimeClientCommandResult {
  const recorded = recordMatchRoomCommandResult({
    document: input.document,
    result: input.roomResult,
    recordedAt: input.receivedAt,
  })

  if (!recorded.ok) {
    return createRealtimeInvalidCommandResult({
      document: input.document,
      command: input.command,
      code: recorded.code,
      message: recorded.message,
    })
  }

  const acceptedHistory = recorded.document.history.slice(
    input.document.history.length,
  )
  const pushResult = createRealtimeProjectedStatePushes({
    document: recorded.document,
    reason: 'command_accepted',
    events: input.roomResult.engineResult.events,
    acceptedHistory,
    serverNow: input.receivedAt,
  })

  if (!pushResult.ok) {
    return createRealtimeInvalidCommandResult({
      document: recorded.document,
      command: input.command,
      code: pushResult.code,
      message: pushResult.message,
    })
  }

  return {
    status: 'accepted',
    commandId: input.command.commandId,
    roomId: input.command.roomId,
    participantId: input.command.participantId,
    document: recorded.document,
    roomResult: input.roomResult,
    acceptedHistory,
    pushes: pushResult.pushes,
  }
}

function createRealtimeInvalidCommandResult(input: {
  readonly document: SerializableMatchSessionDocument
  readonly command: RealtimeClientCommand
  readonly code: RealtimeRuntimeInvalidCode
  readonly message: string
  readonly roomResult?: InvalidMatchRoomCommandResult
}): RealtimeClientCommandInvalidResult {
  return {
    status: 'invalid',
    commandId: input.command.commandId,
    roomId: input.command.roomId,
    participantId: input.command.participantId,
    document: input.document,
    code: input.code,
    message: input.message,
    ...(input.roomResult === undefined ? {} : { roomResult: input.roomResult }),
    pushes: [],
  }
}

function validateRealtimeClientCommand(input: {
  readonly document: SerializableMatchSessionDocument
  readonly command: RealtimeClientCommand
}):
  | {
      readonly ok: true
    }
  | {
      readonly ok: false
      readonly code: RealtimeRuntimeInvalidCode
      readonly message: string
    } {
  const room = input.document.room
  const command = input.command

  if (command.roomId !== room.roomId) {
    return {
      ok: false,
      code: 'room_id_mismatch',
      message: `Realtime command ${command.commandId} targets room ${command.roomId}, but the authoritative session is ${room.roomId}.`,
    }
  }

  if (
    command.expectedRoomRevision !== undefined &&
    command.expectedRoomRevision !== room.revision
  ) {
    return {
      ok: false,
      code: 'stale_room_revision',
      message: `Realtime command ${command.commandId} expected room revision ${command.expectedRoomRevision}, but the authoritative room is at revision ${room.revision}.`,
    }
  }

  if (
    command.payload.kind === 'action' &&
    isSystemGameAction(command.payload.submission.action)
  ) {
    return {
      ok: false,
      code: 'client_system_action_forbidden',
      message: `Realtime client command ${command.commandId} cannot submit system action ${command.payload.submission.action.actionId}.`,
    }
  }

  return { ok: true }
}
