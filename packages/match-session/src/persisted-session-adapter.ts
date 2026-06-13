import type {
  AcceptedMatchRoomCommandResult,
  AcceptedMatchRoomTimeoutResult,
  MatchRoom,
  MatchRoomCommandResult,
  MatchRoomId,
  MatchRoomLifecycleStatus,
} from './match-room'
import { systemMatchRoomClock, type MatchRoomClockSource } from './clock'
import {
  MATCH_SESSION_PERSISTENCE_MODEL,
  MATCH_SESSION_SERIALIZATION_VERSION,
  createSerializableMatchSessionDocument,
  deserializeMatchSessionDocument,
  recordMatchRoomCommandResult,
  restoreMatchSessionDocument,
  serializeMatchSessionDocument,
  type MatchRoomHistoryEntry,
  type MatchSessionSerializationIssueCode,
  type RestoredMatchSession,
  type SerializableMatchSessionDocument,
} from './session-persistence'

export type PersistedMatchSessionIssueCode =
  | 'room_not_found'
  | 'room_already_exists'
  | 'room_id_mismatch'
  | 'stale_room_revision'
  | 'non_monotonic_room_revision'
  | 'history_conflict'
  | 'serialization_failed'
  | 'storage_failed'
  | MatchSessionSerializationIssueCode

export interface PersistedMatchSessionIssue {
  readonly code: PersistedMatchSessionIssueCode
  readonly message: string
}

export type PersistedMatchSessionResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: PersistedMatchSessionIssue
    }

export interface PersistedMatchSessionStorageRecord {
  readonly roomId: MatchRoomId
  readonly document: unknown
  readonly persistedAt: string
}

export interface PersistedMatchSessionStorage {
  createRoomSession(input: {
    readonly document: SerializableMatchSessionDocument
    readonly persistedAt: string
  }): Promise<PersistedMatchSessionResult<PersistedMatchSessionStorageRecord>>

  loadRoomSession(
    roomId: MatchRoomId,
  ): Promise<PersistedMatchSessionResult<PersistedMatchSessionStorageRecord>>

  persistAcceptedRoomTransition(input: {
    readonly roomId: MatchRoomId
    readonly expectedRoomRevision: number
    readonly expectedHistoryLength: number
    readonly nextDocument: SerializableMatchSessionDocument
    readonly appendedHistory: readonly MatchRoomHistoryEntry[]
    readonly persistedAt: string
  }): Promise<PersistedMatchSessionResult<PersistedMatchSessionStorageRecord>>
}

export interface LoadedPersistedMatchSession {
  readonly document: SerializableMatchSessionDocument
  readonly session: RestoredMatchSession
  readonly persistedAt: string
}

export interface RestoredAuthoritativeMatchRoom {
  readonly room: MatchRoom
  readonly history: readonly MatchRoomHistoryEntry[]
  readonly document: SerializableMatchSessionDocument
  readonly persistedAt: string
}

export interface PersistedAcceptedRoomTransition {
  readonly document: SerializableMatchSessionDocument
  readonly session: RestoredMatchSession
  readonly appendedHistory: readonly MatchRoomHistoryEntry[]
  readonly previousRoomRevision: number
  readonly persistedAt: string
}

export type PersistedMatchRoomCommandPersistence =
  | {
      readonly persisted: true
      readonly transition: PersistedAcceptedRoomTransition
    }
  | {
      readonly persisted: false
      readonly document: SerializableMatchSessionDocument
      readonly appendedHistory: readonly []
      readonly reason: 'non_authoritative_command_result'
    }

export interface PersistedMatchSessionAdapter {
  createPersistedRoom(input: {
    readonly room: MatchRoom
    readonly history?: readonly MatchRoomHistoryEntry[]
    readonly recordedAt?: string
  }): Promise<PersistedMatchSessionResult<LoadedPersistedMatchSession>>

  loadRoomSession(
    roomId: MatchRoomId,
  ): Promise<PersistedMatchSessionResult<LoadedPersistedMatchSession>>

  restoreAuthoritativeRoom(
    roomId: MatchRoomId,
  ): Promise<PersistedMatchSessionResult<RestoredAuthoritativeMatchRoom>>

  persistAcceptedRoomTransition(input: {
    readonly currentDocument: SerializableMatchSessionDocument
    readonly result:
      | AcceptedMatchRoomCommandResult
      | AcceptedMatchRoomTimeoutResult
    readonly recordedAt?: string
  }): Promise<PersistedMatchSessionResult<PersistedAcceptedRoomTransition>>

  persistMatchRoomCommandResult(input: {
    readonly currentDocument: SerializableMatchSessionDocument
    readonly result: MatchRoomCommandResult
    readonly recordedAt?: string
  }): Promise<PersistedMatchSessionResult<PersistedMatchRoomCommandPersistence>>
}

export function createPersistedMatchSessionAdapter(input: {
  readonly storage: PersistedMatchSessionStorage
  readonly clock?: MatchRoomClockSource
}): PersistedMatchSessionAdapter {
  const now = () => input.clock?.now() ?? systemMatchRoomClock.now()

  return {
    async createPersistedRoom(createInput) {
      const recordedAt = createInput.recordedAt ?? now()
      const document = createSerializableMatchSessionDocument({
        room: createInput.room,
        history: createInput.history ?? [],
      })

      if (!document.ok) {
        return adapterErr(document.code, document.message)
      }

      const stored = await input.storage.createRoomSession({
        document: document.document,
        persistedAt: recordedAt,
      })

      if (!stored.ok) {
        return stored
      }

      return loadStoredDocument(stored.data)
    },

    async loadRoomSession(roomId) {
      const stored = await input.storage.loadRoomSession(roomId)

      if (!stored.ok) {
        return stored
      }

      return loadStoredDocument(stored.data, roomId)
    },

    async restoreAuthoritativeRoom(roomId) {
      const loaded = await this.loadRoomSession(roomId)

      if (!loaded.ok) {
        return loaded
      }

      return adapterOk({
        room: loaded.data.session.room,
        history: loaded.data.session.history,
        document: loaded.data.document,
        persistedAt: loaded.data.persistedAt,
      })
    },

    async persistAcceptedRoomTransition(transitionInput) {
      const currentDocument = transitionInput.currentDocument
      const result = transitionInput.result
      const recordedAt = transitionInput.recordedAt ?? now()

      if (result.room.roomId !== currentDocument.room.roomId) {
        return adapterErr(
          'room_id_mismatch',
          `Accepted transition belongs to room ${result.room.roomId}, not ${currentDocument.room.roomId}.`,
        )
      }

      if (result.room.revision <= currentDocument.room.revision) {
        return adapterErr(
          'non_monotonic_room_revision',
          `Accepted transition for room ${currentDocument.room.roomId} must advance room revision beyond ${currentDocument.room.revision}.`,
        )
      }

      const recorded = recordMatchRoomCommandResult({
        document: currentDocument,
        result,
        recordedAt,
      })

      if (!recorded.ok) {
        return adapterErr(recorded.code, recorded.message)
      }

      const appendedHistory = recorded.document.history.slice(
        currentDocument.history.length,
      )
      const stored = await input.storage.persistAcceptedRoomTransition({
        roomId: currentDocument.room.roomId,
        expectedRoomRevision: currentDocument.room.revision,
        expectedHistoryLength: currentDocument.history.length,
        nextDocument: recorded.document,
        appendedHistory,
        persistedAt: recordedAt,
      })

      if (!stored.ok) {
        return stored
      }

      const loaded = loadStoredDocument(
        stored.data,
        currentDocument.room.roomId,
      )

      if (!loaded.ok) {
        return loaded
      }

      return adapterOk({
        document: loaded.data.document,
        session: loaded.data.session,
        appendedHistory,
        previousRoomRevision: currentDocument.room.revision,
        persistedAt: loaded.data.persistedAt,
      })
    },

    async persistMatchRoomCommandResult(commandInput) {
      if (commandInput.result.status !== 'accepted') {
        return adapterOk({
          persisted: false,
          document: commandInput.currentDocument,
          appendedHistory: [],
          reason: 'non_authoritative_command_result',
        })
      }

      const persisted = await this.persistAcceptedRoomTransition({
        currentDocument: commandInput.currentDocument,
        result: commandInput.result,
        ...(commandInput.recordedAt === undefined
          ? {}
          : { recordedAt: commandInput.recordedAt }),
      })

      if (!persisted.ok) {
        return persisted
      }

      return adapterOk({
        persisted: true,
        transition: persisted.data,
      })
    },
  }
}

export function createInMemoryPersistedMatchSessionStorage(
  initialDocuments: readonly SerializableMatchSessionDocument[] = [],
): PersistedMatchSessionStorage {
  const records = new Map<string, PersistedMatchSessionStorageRecord>()

  for (const document of initialDocuments) {
    const cloned = cloneSerializableDocument(document)

    if (!cloned.ok) {
      throw new Error(cloned.error.message)
    }

    records.set(document.room.roomId as string, {
      roomId: document.room.roomId,
      document: cloned.data,
      persistedAt: document.room.metadata.updatedAt,
    })
  }

  return {
    createRoomSession(input) {
      const roomId = input.document.room.roomId

      if (records.has(roomId as string)) {
        return resolvedStorageResult(
          adapterErr(
            'room_already_exists',
            `Persisted match room ${roomId} already exists.`,
          ),
        )
      }

      const cloned = cloneSerializableDocument(input.document)

      if (!cloned.ok) {
        return resolvedStorageResult(cloned)
      }

      const record = {
        roomId,
        document: cloned.data,
        persistedAt: input.persistedAt,
      } satisfies PersistedMatchSessionStorageRecord

      records.set(roomId as string, record)

      return resolvedStorageResult(adapterOk(cloneStorageRecord(record)))
    },

    loadRoomSession(roomId) {
      const record = records.get(roomId as string)

      if (record === undefined) {
        return resolvedStorageResult(
          adapterErr(
            'room_not_found',
            `Persisted match room ${roomId} was not found.`,
          ),
        )
      }

      return resolvedStorageResult(adapterOk(cloneStorageRecord(record)))
    },

    persistAcceptedRoomTransition(input) {
      const existing = records.get(input.roomId as string)

      if (existing === undefined) {
        return resolvedStorageResult(
          adapterErr(
            'room_not_found',
            `Persisted match room ${input.roomId} was not found.`,
          ),
        )
      }

      const current = restoreMatchSessionDocument(existing.document)

      if (!current.ok) {
        return resolvedStorageResult(adapterErr(current.code, current.message))
      }

      if (current.session.room.revision !== input.expectedRoomRevision) {
        return resolvedStorageResult(
          adapterErr(
            'stale_room_revision',
            `Persisted match room ${input.roomId} is at revision ${current.session.room.revision}, not ${input.expectedRoomRevision}.`,
          ),
        )
      }

      if (current.session.history.length !== input.expectedHistoryLength) {
        return resolvedStorageResult(
          adapterErr(
            'history_conflict',
            `Persisted match room ${input.roomId} has ${current.session.history.length} history entries, not ${input.expectedHistoryLength}.`,
          ),
        )
      }

      const historyValidation = validateAcceptedHistoryAppend({
        currentHistory: current.session.history,
        nextDocument: input.nextDocument,
        appendedHistory: input.appendedHistory,
      })

      if (!historyValidation.ok) {
        return resolvedStorageResult(historyValidation)
      }

      const cloned = cloneSerializableDocument(input.nextDocument)

      if (!cloned.ok) {
        return resolvedStorageResult(cloned)
      }

      const record = {
        roomId: input.roomId,
        document: cloned.data,
        persistedAt: input.persistedAt,
      } satisfies PersistedMatchSessionStorageRecord

      records.set(input.roomId as string, record)

      return resolvedStorageResult(adapterOk(cloneStorageRecord(record)))
    },
  }
}

function loadStoredDocument(
  record: PersistedMatchSessionStorageRecord,
  expectedRoomId?: MatchRoomId,
): PersistedMatchSessionResult<LoadedPersistedMatchSession> {
  const restored = restoreMatchSessionDocument(record.document)

  if (!restored.ok) {
    return adapterErr(restored.code, restored.message)
  }

  if (restored.session.room.roomId !== record.roomId) {
    return adapterErr(
      'room_id_mismatch',
      `Persisted record for room ${record.roomId} restored room ${restored.session.room.roomId}.`,
    )
  }

  if (
    expectedRoomId !== undefined &&
    restored.session.room.roomId !== expectedRoomId
  ) {
    return adapterErr(
      'room_id_mismatch',
      `Persisted record for room ${record.roomId} restored room ${restored.session.room.roomId}, not ${expectedRoomId}.`,
    )
  }

  return adapterOk({
    document: {
      version: MATCH_SESSION_SERIALIZATION_VERSION,
      persistenceModel: MATCH_SESSION_PERSISTENCE_MODEL,
      room: restored.session.room,
      history: restored.session.history,
    },
    session: restored.session,
    persistedAt: record.persistedAt,
  })
}

function validateAcceptedHistoryAppend(input: {
  readonly currentHistory: readonly MatchRoomHistoryEntry[]
  readonly nextDocument: SerializableMatchSessionDocument
  readonly appendedHistory: readonly MatchRoomHistoryEntry[]
}): PersistedMatchSessionResult<void> {
  const expectedAppendedHistory = input.nextDocument.history.slice(
    input.currentHistory.length,
  )

  if (expectedAppendedHistory.length !== input.appendedHistory.length) {
    return adapterErr(
      'history_conflict',
      `Accepted transition expected ${expectedAppendedHistory.length} appended history entries, received ${input.appendedHistory.length}.`,
    )
  }

  for (const [index, entry] of input.currentHistory.entries()) {
    if (input.nextDocument.history[index]?.entryId !== entry.entryId) {
      return adapterErr(
        'history_conflict',
        `Accepted transition changed persisted history entry ${entry.entryId}.`,
      )
    }
  }

  for (const [index, entry] of input.appendedHistory.entries()) {
    const expected = expectedAppendedHistory[index]

    if (expected === undefined || expected.entryId !== entry.entryId) {
      return adapterErr(
        'history_conflict',
        `Accepted transition appended unexpected history entry ${entry.entryId}.`,
      )
    }
  }

  return adapterOk(undefined)
}

function cloneStorageRecord(
  record: PersistedMatchSessionStorageRecord,
): PersistedMatchSessionStorageRecord {
  const cloned =
    isSerializableMatchSessionDocument(record.document) === true
      ? cloneSerializableDocument(record.document)
      : undefined

  if (cloned?.ok === true) {
    return {
      ...record,
      document: cloned.data,
    }
  }

  return {
    ...record,
    document: JSON.parse(JSON.stringify(record.document)) as unknown,
  }
}

function cloneSerializableDocument(
  document: SerializableMatchSessionDocument,
): PersistedMatchSessionResult<SerializableMatchSessionDocument> {
  const serialized = serializeMatchSessionDocument(document)

  if (!serialized.ok) {
    return adapterErr(serialized.code, serialized.message)
  }

  const restored = deserializeMatchSessionDocument(serialized.json)

  if (!restored.ok) {
    return adapterErr(restored.code, restored.message)
  }

  return adapterOk({
    version: document.version,
    persistenceModel: document.persistenceModel,
    room: restored.session.room,
    history: restored.session.history,
  })
}

function isSerializableMatchSessionDocument(
  value: unknown,
): value is SerializableMatchSessionDocument {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    'persistenceModel' in value &&
    'room' in value &&
    'history' in value
  )
}

function resolvedStorageResult<TData>(
  result: PersistedMatchSessionResult<TData>,
): Promise<PersistedMatchSessionResult<TData>> {
  return Promise.resolve(result)
}

function adapterOk<TData>(data: TData): PersistedMatchSessionResult<TData> {
  return {
    ok: true,
    data,
  }
}

function adapterErr<TData = never>(
  code: PersistedMatchSessionIssueCode,
  message: string,
): PersistedMatchSessionResult<TData> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  }
}

export function mapMatchRoomStatusToPersistedRoomStatus(
  status: MatchRoomLifecycleStatus,
): 'setup' | 'active' | 'completed' | 'abandoned' {
  switch (status) {
    case 'created':
    case 'initialized':
      return 'setup'
    case 'in_progress':
      return 'active'
    case 'completed':
      return 'completed'
    case 'aborted':
      return 'abandoned'
  }
}
