import {
  assertGameStateCardStatsComplete,
  assertGameStateInvariant,
} from '@web-vg/rules-core'
import type { GameEvent } from '@web-vg/rules-core'
import type { Brand } from '@web-vg/shared'

import type {
  MatchRoom,
  AcceptedMatchRoomCommandResult,
  MatchRoomCommandResult,
  MatchRoomId,
  MatchRoomLifecycleStatus,
} from './match-room'
import { hasMatchRoomEngineState } from './match-room'
import { isMatchRoomClockStateLike } from './clock'

export type MatchRoomHistoryEntryId = Brand<string, 'MatchRoomHistoryEntryId'>
export type MatchRoomHistoryEventKind = 'engine_event' | 'room_lifecycle'
export type MatchSessionPersistenceModel = 'snapshot+event-history'

export const MATCH_SESSION_SERIALIZATION_VERSION = 1
export const MATCH_SESSION_PERSISTENCE_MODEL =
  'snapshot+event-history' satisfies MatchSessionPersistenceModel

export type RoomLifecycleHistoryEventType =
  | 'room.created'
  | 'room.initialized'
  | 'room.started'
  | 'room.completed'
  | 'room.aborted'

export interface RoomLifecycleHistoryEvent {
  readonly kind: 'room_lifecycle'
  readonly type: RoomLifecycleHistoryEventType
  readonly status: MatchRoomLifecycleStatus
  readonly reason?: string
}

export interface EngineHistoryEvent {
  readonly kind: 'engine_event'
  readonly transitionId: AcceptedMatchRoomCommandResult['engineResult']['transitionId']
  readonly event: GameEvent
}

export type MatchRoomHistoryEvent =
  | EngineHistoryEvent
  | RoomLifecycleHistoryEvent

export interface MatchRoomHistoryEntry {
  readonly entryId: MatchRoomHistoryEntryId
  readonly sequence: number
  readonly roomId: MatchRoomId
  readonly roomRevision: number
  readonly engineRevision?: number
  readonly recordedAt: string
  readonly event: MatchRoomHistoryEvent
}

export interface SerializableMatchSessionDocument {
  readonly version: typeof MATCH_SESSION_SERIALIZATION_VERSION
  readonly persistenceModel: MatchSessionPersistenceModel
  readonly room: MatchRoom
  readonly history: readonly MatchRoomHistoryEntry[]
}

export interface RestoredMatchSession {
  readonly room: MatchRoom
  readonly history: readonly MatchRoomHistoryEntry[]
}

export type MatchSessionSerializationIssueCode =
  | 'unsupported_version'
  | 'invalid_document_shape'
  | 'invalid_room_snapshot'
  | 'invalid_history_order'
  | 'invalid_json'

export type MatchSessionSerializationResult =
  | {
      readonly ok: true
      readonly document: SerializableMatchSessionDocument
    }
  | {
      readonly ok: false
      readonly code: MatchSessionSerializationIssueCode
      readonly message: string
    }

export type MatchSessionRestoreResult =
  | {
      readonly ok: true
      readonly session: RestoredMatchSession
    }
  | {
      readonly ok: false
      readonly code: MatchSessionSerializationIssueCode
      readonly message: string
    }

export type MatchSessionJsonResult =
  | {
      readonly ok: true
      readonly json: string
    }
  | {
      readonly ok: false
      readonly code: MatchSessionSerializationIssueCode
      readonly message: string
    }

export function createSerializableMatchSessionDocument(input: {
  readonly room: MatchRoom
  readonly history?: readonly MatchRoomHistoryEntry[]
}): MatchSessionSerializationResult {
  const document: SerializableMatchSessionDocument = {
    version: MATCH_SESSION_SERIALIZATION_VERSION,
    persistenceModel: MATCH_SESSION_PERSISTENCE_MODEL,
    room: input.room,
    history: input.history ?? [],
  }
  const validation = validateSerializableMatchSessionDocument(document)

  if (!validation.ok) {
    return validation
  }

  return {
    ok: true,
    document,
  }
}

export function serializeMatchSessionDocument(
  document: SerializableMatchSessionDocument,
): MatchSessionJsonResult {
  const validation = validateSerializableMatchSessionDocument(document)

  if (!validation.ok) {
    return validation
  }

  return {
    ok: true,
    json: JSON.stringify(document),
  }
}

export function restoreMatchSessionDocument(
  document: unknown,
): MatchSessionRestoreResult {
  const validation = validateSerializableMatchSessionDocument(document)

  if (!validation.ok) {
    return validation
  }

  return {
    ok: true,
    session: {
      room: validation.document.room,
      history: validation.document.history,
    },
  }
}

export function deserializeMatchSessionDocument(
  json: string,
): MatchSessionRestoreResult {
  try {
    return restoreMatchSessionDocument(JSON.parse(json) as unknown)
  } catch (error) {
    return {
      ok: false,
      code: 'invalid_json',
      message:
        error instanceof Error
          ? error.message
          : 'Match session JSON could not be parsed.',
    }
  }
}

export function appendRoomLifecycleEventToHistory(input: {
  readonly history: readonly MatchRoomHistoryEntry[]
  readonly room: MatchRoom
  readonly type: RoomLifecycleHistoryEventType
  readonly recordedAt: string
  readonly reason?: string
}): readonly MatchRoomHistoryEntry[] {
  return [
    ...input.history,
    createHistoryEntry({
      history: input.history,
      room: input.room,
      recordedAt: input.recordedAt,
      event: {
        kind: 'room_lifecycle',
        type: input.type,
        status: input.room.status,
        ...(input.reason === undefined ? {} : { reason: input.reason }),
      },
    }),
  ]
}

export function appendAcceptedMatchRoomCommandToHistory(input: {
  readonly history: readonly MatchRoomHistoryEntry[]
  readonly result: AcceptedMatchRoomCommandResult
  readonly recordedAt: string
}): readonly MatchRoomHistoryEntry[] {
  const entries = [...input.history]

  for (const event of input.result.engineResult.events) {
    entries.push(
      createHistoryEntry({
        history: entries,
        room: input.result.room,
        recordedAt: input.recordedAt,
        event: {
          kind: 'engine_event',
          transitionId: input.result.engineResult.transitionId,
          event,
        },
      }),
    )
  }

  return entries
}

export function recordMatchRoomCommandResult(input: {
  readonly document: SerializableMatchSessionDocument
  readonly result: MatchRoomCommandResult
  readonly recordedAt: string
}): MatchSessionSerializationResult {
  const nextDocument =
    input.result.status === 'accepted'
      ? {
          ...input.document,
          room: input.result.room,
          history: appendAcceptedMatchRoomCommandToHistory({
            history: input.document.history,
            result: input.result,
            recordedAt: input.recordedAt,
          }),
        }
      : input.document

  return createSerializableMatchSessionDocument({
    room: nextDocument.room,
    history: nextDocument.history,
  })
}

export function validateSerializableMatchSessionDocument(
  document: unknown,
): MatchSessionSerializationResult {
  if (!isRecord(document)) {
    return {
      ok: false,
      code: 'invalid_document_shape',
      message: 'Serialized match session document must be an object.',
    }
  }

  if (document.version !== MATCH_SESSION_SERIALIZATION_VERSION) {
    return {
      ok: false,
      code: 'unsupported_version',
      message: `Unsupported match session serialization version ${String(document.version)}.`,
    }
  }

  if (document.persistenceModel !== MATCH_SESSION_PERSISTENCE_MODEL) {
    return {
      ok: false,
      code: 'invalid_document_shape',
      message: `Serialized match session persistence model must be ${MATCH_SESSION_PERSISTENCE_MODEL}.`,
    }
  }

  if (!isMatchRoomSnapshotLike(document.room)) {
    return {
      ok: false,
      code: 'invalid_room_snapshot',
      message:
        'Serialized match session document is missing a valid room snapshot.',
    }
  }

  if (!Array.isArray(document.history)) {
    return {
      ok: false,
      code: 'invalid_document_shape',
      message: 'Serialized match session history must be an array.',
    }
  }

  const room = document.room
  const history = document.history as readonly MatchRoomHistoryEntry[]
  const roomValidation = validateRoomSnapshot(room)

  if (!roomValidation.ok) {
    return roomValidation
  }

  const historyValidation = validateHistory(room.roomId, history)

  if (!historyValidation.ok) {
    return historyValidation
  }

  return {
    ok: true,
    document: {
      version: MATCH_SESSION_SERIALIZATION_VERSION,
      persistenceModel: MATCH_SESSION_PERSISTENCE_MODEL,
      room,
      history,
    },
  }
}

function createHistoryEntry(input: {
  readonly history: readonly MatchRoomHistoryEntry[]
  readonly room: MatchRoom
  readonly recordedAt: string
  readonly event: MatchRoomHistoryEvent
}): MatchRoomHistoryEntry {
  const sequence = input.history.length + 1

  return {
    entryId: createMatchRoomHistoryEntryId(input.room.roomId, sequence),
    sequence,
    roomId: input.room.roomId,
    roomRevision: input.room.revision,
    ...(hasMatchRoomEngineState(input.room)
      ? { engineRevision: input.room.engineState.revision }
      : {}),
    recordedAt: input.recordedAt,
    event: input.event,
  }
}

function createMatchRoomHistoryEntryId(
  roomId: MatchRoomId,
  sequence: number,
): MatchRoomHistoryEntryId {
  return `${roomId}:history:${sequence}` as MatchRoomHistoryEntryId
}

function validateRoomSnapshot(
  room: MatchRoom,
): MatchSessionSerializationResult | { readonly ok: true } {
  try {
    if (hasMatchRoomEngineState(room)) {
      assertGameStateInvariant(room.engineState)
      assertGameStateCardStatsComplete(room.engineState)
    }
  } catch (error) {
    return {
      ok: false,
      code: 'invalid_room_snapshot',
      message:
        error instanceof Error
          ? error.message
          : 'Serialized match session room snapshot is invalid.',
    }
  }

  return { ok: true }
}

function validateHistory(
  roomId: MatchRoomId,
  history: readonly MatchRoomHistoryEntry[],
): MatchSessionSerializationResult | { readonly ok: true } {
  for (const [index, entry] of history.entries()) {
    const expectedSequence = index + 1
    const expectedEntryId = createMatchRoomHistoryEntryId(
      roomId,
      expectedSequence,
    )

    if (!isHistoryEntryLike(entry)) {
      return {
        ok: false,
        code: 'invalid_history_order',
        message: `Match room history entry at index ${index} is malformed.`,
      }
    }

    if (
      entry.roomId !== roomId ||
      entry.sequence !== expectedSequence ||
      entry.entryId !== expectedEntryId
    ) {
      return {
        ok: false,
        code: 'invalid_history_order',
        message: `Match room history entry ${entry.entryId} is out of order or belongs to another room.`,
      }
    }
  }

  return { ok: true }
}

function isMatchRoomSnapshotLike(value: unknown): value is MatchRoom {
  return (
    isRecord(value) &&
    typeof value.roomId === 'string' &&
    typeof value.formatId === 'string' &&
    typeof value.engineAdapterId === 'string' &&
    typeof value.status === 'string' &&
    Number.isSafeInteger(value.revision) &&
    Array.isArray(value.participants) &&
    isRecord(value.metadata) &&
    isMatchRoomClockStateLike(value.clock)
  )
}

function isHistoryEntryLike(value: unknown): value is MatchRoomHistoryEntry {
  return (
    isRecord(value) &&
    typeof value.entryId === 'string' &&
    Number.isSafeInteger(value.sequence) &&
    typeof value.roomId === 'string' &&
    Number.isSafeInteger(value.roomRevision) &&
    typeof value.recordedAt === 'string' &&
    isRecord(value.event) &&
    (value.event.kind === 'engine_event' ||
      value.event.kind === 'room_lifecycle')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
