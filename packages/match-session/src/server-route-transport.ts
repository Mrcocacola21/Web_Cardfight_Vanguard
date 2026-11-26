import type { BlockedEngineDispatchResult, GameEvent } from '@web-vg/rules-core'

import type {
  MatchRoomEngineAdapter,
  MatchRoomId,
  MatchRoomParticipantId,
} from './match-room'
import { systemMatchRoomClock, type MatchRoomClockSource } from './clock'
import type {
  PersistedMatchSessionAdapter,
  PersistedMatchSessionIssueCode,
} from './persisted-session-adapter'
import {
  MATCH_REALTIME_TRANSPORT_BASELINE,
  createRealtimeParticipantSnapshot,
  createRealtimeProjectedStatePushes,
  submitRealtimeClientCommand,
  type RealtimeClientCommand,
  type RealtimeClientCommandId,
  type RealtimeProjectedStatePush,
  type RealtimeRuntimeInvalidCode,
} from './realtime-runtime'
import type {
  MatchRoomHistoryEntry,
  MatchSessionSerializationIssueCode,
  SerializableMatchSessionDocument,
} from './session-persistence'

export type ServerRouteRealtimeTransportShape =
  'server_route_orchestration_with_projected_snapshots'

export const MATCH_SERVER_ROUTE_REALTIME_TRANSPORT_SHAPE =
  'server_route_orchestration_with_projected_snapshots' satisfies ServerRouteRealtimeTransportShape

export type ServerRouteRealtimeTransportIssueCode =
  | RealtimeRuntimeInvalidCode
  | PersistedMatchSessionIssueCode
  | MatchSessionSerializationIssueCode

export interface ServerRouteRealtimeCommandRequest {
  readonly command: RealtimeClientCommand
  readonly receivedAt?: string
}

export interface ServerRouteRealtimeSnapshotRequest {
  readonly roomId: MatchRoomId
  readonly participantId: MatchRoomParticipantId
  readonly requestedAt?: string
}

export interface ServerRouteRealtimeAcceptedCommandResponse {
  readonly transport: typeof MATCH_REALTIME_TRANSPORT_BASELINE
  readonly status: 'accepted'
  readonly commandId: RealtimeClientCommandId
  readonly roomId: MatchRoomId
  readonly participantId: MatchRoomParticipantId
  readonly roomRevision: number
  readonly engineRevision: number
  readonly acceptedHistoryEntryIds: readonly MatchRoomHistoryEntry['entryId'][]
  readonly projectedUpdate: RealtimeProjectedStatePush
}

export interface ServerRouteRealtimeInvalidCommandResponse {
  readonly transport: typeof MATCH_REALTIME_TRANSPORT_BASELINE
  readonly status: 'invalid'
  readonly commandId: RealtimeClientCommandId
  readonly roomId: MatchRoomId
  readonly participantId: MatchRoomParticipantId
  readonly code: ServerRouteRealtimeTransportIssueCode
  readonly message: string
  readonly projectedUpdate?: RealtimeProjectedStatePush
}

export interface ServerRouteRealtimeBlockedCommandResponse {
  readonly transport: typeof MATCH_REALTIME_TRANSPORT_BASELINE
  readonly status: 'blocked'
  readonly commandId: RealtimeClientCommandId
  readonly roomId: MatchRoomId
  readonly participantId: MatchRoomParticipantId
  readonly code: BlockedEngineDispatchResult['code']
  readonly message: string
  readonly projectedUpdate?: RealtimeProjectedStatePush
}

export type ServerRouteRealtimeCommandResponse =
  | ServerRouteRealtimeAcceptedCommandResponse
  | ServerRouteRealtimeInvalidCommandResponse
  | ServerRouteRealtimeBlockedCommandResponse

export type ServerRouteRealtimeSnapshotResponse =
  | {
      readonly transport: typeof MATCH_REALTIME_TRANSPORT_BASELINE
      readonly status: 'ok'
      readonly roomId: MatchRoomId
      readonly participantId: MatchRoomParticipantId
      readonly roomRevision: number
      readonly engineRevision: number
      readonly projectedUpdate: RealtimeProjectedStatePush
    }
  | {
      readonly transport: typeof MATCH_REALTIME_TRANSPORT_BASELINE
      readonly status: 'invalid'
      readonly roomId: MatchRoomId
      readonly participantId: MatchRoomParticipantId
      readonly code: ServerRouteRealtimeTransportIssueCode
      readonly message: string
    }

export interface ServerRouteRealtimeTransport {
  submitCommand(
    request: ServerRouteRealtimeCommandRequest,
  ): Promise<ServerRouteRealtimeCommandResponse>

  loadParticipantSnapshot(
    request: ServerRouteRealtimeSnapshotRequest,
  ): Promise<ServerRouteRealtimeSnapshotResponse>
}

export function createServerRouteRealtimeTransport(input: {
  readonly sessions: PersistedMatchSessionAdapter
  readonly engineAdapters?: readonly MatchRoomEngineAdapter[]
  readonly clock?: MatchRoomClockSource
}): ServerRouteRealtimeTransport {
  const now = () => input.clock?.now() ?? systemMatchRoomClock.now()
  const adapterOption =
    input.engineAdapters === undefined
      ? {}
      : { engineAdapters: input.engineAdapters }

  return {
    async submitCommand(request) {
      const receivedAt = request.receivedAt ?? now()
      const loaded = await input.sessions.loadRoomSession(
        request.command.roomId,
      )

      if (!loaded.ok) {
        return {
          transport: MATCH_REALTIME_TRANSPORT_BASELINE,
          status: 'invalid',
          commandId: request.command.commandId,
          roomId: request.command.roomId,
          participantId: request.command.participantId,
          code: loaded.error.code,
          message: loaded.error.message,
        }
      }

      const runtimeResult = submitRealtimeClientCommand({
        document: loaded.data.document,
        command: request.command,
        ...(input.engineAdapters === undefined
          ? {}
          : { engineAdapters: input.engineAdapters }),
        receivedAt,
        ...(input.clock === undefined ? {} : { clock: input.clock }),
      })

      switch (runtimeResult.status) {
        case 'invalid':
          return createInvalidCommandResponse({
            command: request.command,
            document: loaded.data.document,
            code: runtimeResult.code,
            message: runtimeResult.message,
            serverNow: receivedAt,
            ...adapterOption,
          })
        case 'blocked':
          return createBlockedCommandResponse({
            command: request.command,
            document: loaded.data.document,
            code: runtimeResult.code,
            message: runtimeResult.message,
            serverNow: receivedAt,
            ...adapterOption,
          })
        case 'accepted': {
          const persisted = await input.sessions.persistAcceptedRoomTransition({
            currentDocument: loaded.data.document,
            result: runtimeResult.roomResult,
            recordedAt: receivedAt,
          })

          if (!persisted.ok) {
            return createInvalidCommandResponse({
              command: request.command,
              document: loaded.data.document,
              code: persisted.error.code,
              message: persisted.error.message,
              serverNow: receivedAt,
              ...adapterOption,
            })
          }

          // Persist the automatic battle steps too, each as its own transition.
          let persistedDocument = persisted.data.document
          const appendedHistory = [...persisted.data.appendedHistory]
          const events = [...runtimeResult.roomResult.engineResult.events]

          for (const followUp of runtimeResult.followUpResults) {
            const next = await input.sessions.persistAcceptedRoomTransition({
              currentDocument: persistedDocument,
              result: followUp,
              recordedAt: receivedAt,
            })

            if (!next.ok) {
              break
            }

            persistedDocument = next.data.document
            appendedHistory.push(...next.data.appendedHistory)
            events.push(...followUp.engineResult.events)
          }

          const projectedUpdate = createProjectedUpdateForParticipant({
            document: persistedDocument,
            participantId: request.command.participantId,
            acceptedHistory: appendedHistory,
            events,
            serverNow: receivedAt,
            ...adapterOption,
          })

          if (!projectedUpdate.ok) {
            return {
              transport: MATCH_REALTIME_TRANSPORT_BASELINE,
              status: 'invalid',
              commandId: request.command.commandId,
              roomId: request.command.roomId,
              participantId: request.command.participantId,
              code: projectedUpdate.code,
              message: projectedUpdate.message,
            }
          }

          return {
            transport: MATCH_REALTIME_TRANSPORT_BASELINE,
            status: 'accepted',
            commandId: request.command.commandId,
            roomId: request.command.roomId,
            participantId: request.command.participantId,
            roomRevision: projectedUpdate.push.roomRevision,
            engineRevision: projectedUpdate.push.engineRevision,
            acceptedHistoryEntryIds:
              projectedUpdate.push.acceptedHistoryEntryIds,
            projectedUpdate: projectedUpdate.push,
          }
        }
      }
    },

    async loadParticipantSnapshot(request) {
      const requestedAt = request.requestedAt ?? now()
      const loaded = await input.sessions.loadRoomSession(request.roomId)

      if (!loaded.ok) {
        return {
          transport: MATCH_REALTIME_TRANSPORT_BASELINE,
          status: 'invalid',
          roomId: request.roomId,
          participantId: request.participantId,
          code: loaded.error.code,
          message: loaded.error.message,
        }
      }

      const snapshot = createRealtimeParticipantSnapshot({
        document: loaded.data.document,
        participantId: request.participantId,
        serverNow: requestedAt,
        ...adapterOption,
      })

      if (!snapshot.ok) {
        return {
          transport: MATCH_REALTIME_TRANSPORT_BASELINE,
          status: 'invalid',
          roomId: request.roomId,
          participantId: request.participantId,
          code: snapshot.code,
          message: snapshot.message,
        }
      }

      return {
        transport: MATCH_REALTIME_TRANSPORT_BASELINE,
        status: 'ok',
        roomId: request.roomId,
        participantId: request.participantId,
        roomRevision: snapshot.push.roomRevision,
        engineRevision: snapshot.push.engineRevision,
        projectedUpdate: snapshot.push,
      }
    },
  }
}

function createInvalidCommandResponse(input: {
  readonly command: RealtimeClientCommand
  readonly document: SerializableMatchSessionDocument
  readonly code: ServerRouteRealtimeTransportIssueCode
  readonly message: string
  readonly serverNow: string
  readonly engineAdapters?: readonly MatchRoomEngineAdapter[]
}): ServerRouteRealtimeInvalidCommandResponse {
  const snapshot = createRealtimeParticipantSnapshot({
    document: input.document,
    participantId: input.command.participantId,
    serverNow: input.serverNow,
    ...(input.engineAdapters === undefined
      ? {}
      : { engineAdapters: input.engineAdapters }),
  })

  return {
    transport: MATCH_REALTIME_TRANSPORT_BASELINE,
    status: 'invalid',
    commandId: input.command.commandId,
    roomId: input.command.roomId,
    participantId: input.command.participantId,
    code: input.code,
    message: input.message,
    ...(snapshot.ok ? { projectedUpdate: snapshot.push } : {}),
  }
}

function createBlockedCommandResponse(input: {
  readonly command: RealtimeClientCommand
  readonly document: SerializableMatchSessionDocument
  readonly code: BlockedEngineDispatchResult['code']
  readonly message: string
  readonly serverNow: string
  readonly engineAdapters?: readonly MatchRoomEngineAdapter[]
}): ServerRouteRealtimeBlockedCommandResponse {
  const snapshot = createRealtimeParticipantSnapshot({
    document: input.document,
    participantId: input.command.participantId,
    serverNow: input.serverNow,
    ...(input.engineAdapters === undefined
      ? {}
      : { engineAdapters: input.engineAdapters }),
  })

  return {
    transport: MATCH_REALTIME_TRANSPORT_BASELINE,
    status: 'blocked',
    commandId: input.command.commandId,
    roomId: input.command.roomId,
    participantId: input.command.participantId,
    code: input.code,
    message: input.message,
    ...(snapshot.ok ? { projectedUpdate: snapshot.push } : {}),
  }
}

function createProjectedUpdateForParticipant(input: {
  readonly document: SerializableMatchSessionDocument
  readonly participantId: MatchRoomParticipantId
  readonly acceptedHistory: readonly MatchRoomHistoryEntry[]
  readonly events: readonly GameEvent[]
  readonly serverNow: string
  readonly engineAdapters?: readonly MatchRoomEngineAdapter[]
}):
  | {
      readonly ok: true
      readonly push: RealtimeProjectedStatePush
    }
  | {
      readonly ok: false
      readonly code: RealtimeRuntimeInvalidCode
      readonly message: string
    } {
  const projectedUpdates = createRealtimeProjectedStatePushes({
    document: input.document,
    reason: 'command_accepted',
    events: input.events ?? [],
    acceptedHistory: input.acceptedHistory,
    serverNow: input.serverNow,
    ...(input.engineAdapters === undefined
      ? {}
      : { engineAdapters: input.engineAdapters }),
  })

  if (!projectedUpdates.ok) {
    return projectedUpdates
  }

  const push = projectedUpdates.pushes.find(
    (candidate) => candidate.participantId === input.participantId,
  )

  if (push === undefined) {
    return {
      ok: false,
      code: 'missing_projection_target',
      message: `Match room ${input.document.room.roomId} did not produce a projected update for participant ${input.participantId}.`,
    }
  }

  return {
    ok: true,
    push,
  }
}
