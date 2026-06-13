import { createHash } from 'node:crypto'

import {
  hasMatchRoomEngineState,
  mapMatchRoomStatusToPersistedRoomStatus,
  restoreMatchSessionDocument,
  type MatchRoom,
  type MatchRoomHistoryEntry,
  type MatchRoomId,
  type MatchRoomParticipant,
  type MatchRoomParticipantId,
  type PersistedMatchSessionIssueCode,
  type PersistedMatchSessionResult,
  type PersistedMatchSessionStorage,
  type PersistedMatchSessionStorageRecord,
  type SerializableMatchSessionDocument,
} from '@web-vg/match-session'

import type { Json, Tables } from '../../generated/database.types'
import type { DbClient } from '../shared/client'

type MatchRoomRow = Pick<
  Tables<{ schema: 'gameplay' }, 'match_rooms'>,
  | 'id'
  | 'status'
  | 'latest_event_sequence'
  | 'latest_snapshot_sequence'
  | 'updated_at'
>
type RoomSnapshotRow = Pick<
  Tables<{ schema: 'gameplay' }, 'room_snapshots'>,
  | 'game_state_payload'
  | 'last_event_sequence'
  | 'snapshot_sequence'
  | 'is_current'
>
type RoomEventRow = Pick<
  Tables<{ schema: 'gameplay' }, 'room_events'>,
  'event_sequence' | 'event_payload'
>
type PendingChoiceRow = Pick<
  Tables<{ schema: 'gameplay' }, 'pending_choices'>,
  | 'choice_kind'
  | 'context_payload'
  | 'options_payload'
  | 'owner_kind'
  | 'owner_room_player_id'
  | 'status'
>

interface PersistedMatchSessionRpcRow {
  readonly room_id: string
  readonly persisted_at: string
  readonly document: unknown
}

interface GameplayRpcSchema {
  rpc(
    functionName:
      | 'create_persisted_match_session'
      | 'persist_accepted_match_session_transition',
    args: Record<string, unknown>,
  ): {
    single(): Promise<{
      readonly data: PersistedMatchSessionRpcRow | null
      readonly error: QueryErrorLike | null
    }>
  }
}

interface QueryErrorLike {
  readonly code?: string | null
  readonly message: string
  readonly details?: string | null
}

interface PersistedRoomPlayerPayload {
  readonly id: string
  readonly profile_id: string | null
  readonly seat_order: number
  readonly player_status:
    | 'joined'
    | 'ready'
    | 'active'
    | 'disconnected'
    | 'left'
  readonly submitted_deck_version_id: string | null
  readonly submitted_deck_snapshot: Json | null
}

interface PersistedRoomEventPayload {
  readonly event_sequence: number
  readonly actor_room_player_id: string | null
  readonly event_kind: string
  readonly source_kind:
    | 'player-action'
    | 'system'
    | 'effect'
    | 'trigger'
    | 'replacement'
    | 'continuous'
    | 'setup'
  readonly source_ref: string | null
  readonly event_payload: Json
  readonly created_at: string
}

interface PersistedPendingChoicePayload {
  readonly id: string
  readonly owner_kind: 'player' | 'system'
  readonly owner_room_player_id: string | null
  readonly choice_kind: string
  readonly opened_event_sequence: number
  readonly options_payload: Json
  readonly context_payload: Json
  readonly created_at: string
  readonly updated_at: string
}

interface PersistedMatchRoomPayload {
  readonly id: string
  readonly format_id: string
  readonly host_profile_id: string | null
  readonly status: 'setup' | 'active' | 'completed' | 'abandoned'
  readonly latest_event_sequence: number
  readonly latest_snapshot_sequence: number
  readonly created_at: string
  readonly started_at: string | null
  readonly ended_at: string | null
  readonly updated_at: string
}

interface PersistedRoomSnapshotPayload {
  readonly snapshot_sequence: number
  readonly last_event_sequence: number
  readonly turn_number: number | null
  readonly phase_key: string | null
  readonly active_room_player_id: string | null
  readonly game_state_payload: Json
  readonly created_at: string
}

interface PersistedMatchSessionPayload {
  readonly room: PersistedMatchRoomPayload
  readonly roomPlayers: readonly PersistedRoomPlayerPayload[]
  readonly snapshot: PersistedRoomSnapshotPayload
  readonly events: readonly PersistedRoomEventPayload[]
  readonly pendingChoices: readonly PersistedPendingChoicePayload[]
  readonly document: Json
  readonly persistedAt: string
}

const matchRoomSelect =
  'id, status, latest_event_sequence, latest_snapshot_sequence, updated_at'
const roomSnapshotSelect =
  'game_state_payload, last_event_sequence, snapshot_sequence, is_current'
const roomEventSelect = 'event_sequence, event_payload'
const pendingChoiceSelect =
  'choice_kind, context_payload, options_payload, owner_kind, owner_room_player_id, status'
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const deterministicUuidNamespace = '6fddba6f-ff7b-4db6-8c5d-1345fd5f6013'

export function createDbPersistedMatchSessionStorage(
  client: DbClient,
): PersistedMatchSessionStorage {
  return {
    async createRoomSession(input) {
      const payloadResult = buildPersistedMatchSessionPayload({
        document: input.document,
        persistedAt: input.persistedAt,
        snapshotSequence: Math.max(1, input.document.room.revision),
        events: input.document.history,
      })

      if (!payloadResult.ok) {
        return payloadResult
      }

      const { data, error } = await gameplayRpc(client)
        .rpc('create_persisted_match_session', {
          create_payload: payloadResult.data,
        })
        .single()

      if (error) {
        return storageErrFromQueryError(error, {
          roomId: input.document.room.roomId,
          fallbackCode: 'storage_failed',
          fallbackMessage: `Failed to create persisted match room ${input.document.room.roomId}.`,
        })
      }

      return rpcRowToStorageRecord(data, input.document.room.roomId)
    },

    async loadRoomSession(roomId) {
      const { data: roomRow, error: roomError } = await client
        .schema('gameplay')
        .from('match_rooms')
        .select(matchRoomSelect)
        .eq('id', roomId as string)
        .maybeSingle()

      if (roomError) {
        return storageErr(
          'storage_failed',
          `Failed to load persisted match room ${roomId}.`,
          roomError,
        )
      }

      if (!roomRow) {
        return storageErr(
          'room_not_found',
          `Persisted match room ${roomId} was not found.`,
        )
      }

      const { data: snapshotRow, error: snapshotError } = await client
        .schema('gameplay')
        .from('room_snapshots')
        .select(roomSnapshotSelect)
        .eq('room_id', roomId as string)
        .eq('is_current', true)
        .maybeSingle()

      if (snapshotError) {
        return storageErr(
          'storage_failed',
          `Failed to load current snapshot for persisted match room ${roomId}.`,
          snapshotError,
        )
      }

      if (!snapshotRow) {
        return storageErr(
          'storage_failed',
          `Persisted match room ${roomId} has no current snapshot.`,
        )
      }

      const { data: eventRows, error: eventsError } = await client
        .schema('gameplay')
        .from('room_events')
        .select(roomEventSelect)
        .eq('room_id', roomId as string)
        .order('event_sequence', { ascending: true })

      if (eventsError) {
        return storageErr(
          'storage_failed',
          `Failed to load accepted history for persisted match room ${roomId}.`,
          eventsError,
        )
      }

      const { data: pendingRows, error: pendingError } = await client
        .schema('gameplay')
        .from('pending_choices')
        .select(pendingChoiceSelect)
        .eq('room_id', roomId as string)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })

      if (pendingError) {
        return storageErr(
          'storage_failed',
          `Failed to load pending choices for persisted match room ${roomId}.`,
          pendingError,
        )
      }

      return loadedRowsToStorageRecord({
        roomId,
        roomRow: roomRow as MatchRoomRow,
        snapshotRow: snapshotRow as RoomSnapshotRow,
        eventRows: (eventRows ?? []) as readonly RoomEventRow[],
        pendingRows: (pendingRows ?? []) as readonly PendingChoiceRow[],
      })
    },

    async persistAcceptedRoomTransition(input) {
      const payloadResult = buildPersistedMatchSessionPayload({
        document: input.nextDocument,
        persistedAt: input.persistedAt,
        expectedRoomRevision: input.expectedRoomRevision,
        expectedHistoryLength: input.expectedHistoryLength,
        snapshotSequence: Math.max(1, input.nextDocument.room.revision),
        events: input.appendedHistory,
      })

      if (!payloadResult.ok) {
        return payloadResult
      }

      if (input.nextDocument.room.roomId !== input.roomId) {
        return storageErr(
          'room_id_mismatch',
          `Accepted transition belongs to room ${input.nextDocument.room.roomId}, not ${input.roomId}.`,
        )
      }

      const { data, error } = await gameplayRpc(client)
        .rpc('persist_accepted_match_session_transition', {
          transition_payload: {
            ...payloadResult.data,
            expectedRoomRevision: input.expectedRoomRevision,
            expectedHistoryLength: input.expectedHistoryLength,
          },
        })
        .single()

      if (error) {
        return storageErrFromQueryError(error, {
          roomId: input.roomId,
          fallbackCode: 'storage_failed',
          fallbackMessage: `Failed to persist accepted transition for match room ${input.roomId}.`,
        })
      }

      return rpcRowToStorageRecord(data, input.roomId)
    },
  }
}

function gameplayRpc(client: DbClient): GameplayRpcSchema {
  return client.schema('gameplay') as unknown as GameplayRpcSchema
}

function buildPersistedMatchSessionPayload(input: {
  readonly document: SerializableMatchSessionDocument
  readonly persistedAt: string
  readonly snapshotSequence: number
  readonly events: readonly MatchRoomHistoryEntry[]
  readonly expectedRoomRevision?: number
  readonly expectedHistoryLength?: number
}): PersistedMatchSessionResult<PersistedMatchSessionPayload> {
  const restored = restoreMatchSessionDocument(input.document)

  if (!restored.ok) {
    return storageErr(restored.code, restored.message)
  }

  const roomId = String(input.document.room.roomId)

  if (!isUuid(roomId)) {
    return storageErr(
      'storage_failed',
      'DB-backed persisted match room must use a UUID-compatible room id.',
    )
  }

  const room = restored.session.room
  const historyLength = restored.session.history.length
  const roomPlayers = room.participants.map((participant) =>
    mapRoomParticipantToPayload(room, participant),
  )
  const roomPlayerIdsByPlayerId = indexRoomPlayerIdsByEnginePlayerId(
    room,
    roomPlayers,
  )
  const startedAt = resolvePersistedRoomStartedAt(room)
  const endedAt = resolvePersistedRoomEndedAt(room)
  const snapshotSequence = Math.max(1, input.snapshotSequence)

  return storageOk({
    room: {
      id: roomId,
      format_id: room.formatId as string,
      host_profile_id: resolveHostProfileId(room),
      status: mapMatchRoomStatusToPersistedRoomStatus(room.status),
      latest_event_sequence: historyLength,
      latest_snapshot_sequence: snapshotSequence,
      created_at: room.metadata.createdAt,
      started_at: startedAt,
      ended_at: endedAt,
      updated_at: input.persistedAt,
    },
    roomPlayers,
    snapshot: {
      snapshot_sequence: snapshotSequence,
      last_event_sequence: historyLength,
      turn_number: resolveSnapshotTurnNumber(room),
      phase_key: resolveSnapshotPhaseKey(room),
      active_room_player_id: resolveActiveRoomPlayerId(
        room,
        roomPlayerIdsByPlayerId,
      ),
      game_state_payload: input.document as unknown as Json,
      created_at: input.persistedAt,
    },
    events: input.events.map((entry) =>
      mapHistoryEntryToEventPayload({
        entry,
        room,
        roomPlayerIdsByPlayerId,
      }),
    ),
    pendingChoices: mapPendingChoicesToPayload({
      room,
      roomId,
      roomPlayerIdsByPlayerId,
      latestEventSequence: historyLength,
      persistedAt: input.persistedAt,
    }),
    document: input.document as unknown as Json,
    persistedAt: input.persistedAt,
  })
}

function mapRoomParticipantToPayload(
  room: MatchRoom,
  participant: MatchRoomParticipant,
): PersistedRoomPlayerPayload {
  return {
    id: createRoomPlayerId(room.roomId, participant.participantId),
    profile_id: isUuid(participant.userId) ? participant.userId : null,
    seat_order: participant.seat + 1,
    player_status:
      participant.enginePlayerId === undefined ? 'joined' : 'active',
    submitted_deck_version_id: null,
    submitted_deck_snapshot:
      participant.submittedDeckId === undefined
        ? null
        : ({
            submittedDeckId: participant.submittedDeckId,
          } as unknown as Json),
  }
}

function indexRoomPlayerIdsByEnginePlayerId(
  room: MatchRoom,
  roomPlayers: readonly PersistedRoomPlayerPayload[],
): ReadonlyMap<string, string> {
  const roomPlayerIdsByPlayerId = new Map<string, string>()

  for (const [index, participant] of room.participants.entries()) {
    if (participant.enginePlayerId === undefined) {
      continue
    }

    const roomPlayer = roomPlayers[index]

    if (roomPlayer !== undefined) {
      roomPlayerIdsByPlayerId.set(
        participant.enginePlayerId as string,
        roomPlayer.id,
      )
    }
  }

  return roomPlayerIdsByPlayerId
}

function mapHistoryEntryToEventPayload(input: {
  readonly entry: MatchRoomHistoryEntry
  readonly room: MatchRoom
  readonly roomPlayerIdsByPlayerId: ReadonlyMap<string, string>
}): PersistedRoomEventPayload {
  const event = input.entry.event

  if (event.kind === 'room_lifecycle') {
    return {
      event_sequence: input.entry.sequence,
      actor_room_player_id: null,
      event_kind: event.type,
      source_kind:
        event.type === 'room.created' ||
        event.type === 'room.initialized' ||
        event.type === 'room.started'
          ? 'setup'
          : 'system',
      source_ref: input.entry.entryId as string,
      event_payload: input.entry as unknown as Json,
      created_at: input.entry.recordedAt,
    }
  }

  const gameEvent = event.event
  const actorRoomPlayerId =
    gameEvent.origin.kind === 'player'
      ? (input.roomPlayerIdsByPlayerId.get(
          gameEvent.origin.playerId as string,
        ) ?? null)
      : null

  return {
    event_sequence: input.entry.sequence,
    actor_room_player_id: actorRoomPlayerId,
    event_kind: gameEvent.type,
    source_kind: resolveGameEventSourceKind(gameEvent),
    source_ref: `${event.transitionId}:${gameEvent.eventId}`,
    event_payload: input.entry as unknown as Json,
    created_at: input.entry.recordedAt,
  }
}

function resolveGameEventSourceKind(
  event: MatchRoomHistoryEntry['event'] extends infer TEvent
    ? TEvent extends { readonly kind: 'engine_event'; readonly event: infer T }
      ? T
      : never
    : never,
): PersistedRoomEventPayload['source_kind'] {
  if (!isRecord(event) || typeof event.type !== 'string') {
    return 'system'
  }

  if (event.type.startsWith('effect.')) {
    return 'effect'
  }

  if (event.type.startsWith('trigger.')) {
    return 'trigger'
  }

  if (isRecord(event.origin) && event.origin.kind === 'player') {
    return 'player-action'
  }

  if (
    isRecord(event.origin) &&
    event.origin.kind === 'system' &&
    event.origin.system === 'match-setup'
  ) {
    return 'setup'
  }

  return 'system'
}

function mapPendingChoicesToPayload(input: {
  readonly room: MatchRoom
  readonly roomId: string
  readonly roomPlayerIdsByPlayerId: ReadonlyMap<string, string>
  readonly latestEventSequence: number
  readonly persistedAt: string
}): readonly PersistedPendingChoicePayload[] {
  if (!hasMatchRoomEngineState(input.room)) {
    return []
  }

  const engineState = input.room.engineState

  return engineState.pendingRequests.map((request, queueIndex) => {
    const ownerRoomPlayerId =
      input.roomPlayerIdsByPlayerId.get(request.responderPlayerId as string) ??
      null
    const requestDeadline =
      input.room.clock.activeRequest?.requestId === request.requestId
        ? input.room.clock.activeRequest
        : undefined

    return {
      id: createPendingChoiceId(input.roomId, request.requestId as string),
      owner_kind: ownerRoomPlayerId === null ? 'system' : 'player',
      owner_room_player_id: ownerRoomPlayerId,
      choice_kind: request.type,
      opened_event_sequence: input.latestEventSequence,
      options_payload: request as unknown as Json,
      context_payload: {
        requestId: request.requestId,
        queueIndex,
        responderPlayerId: request.responderPlayerId,
        roomRevision: input.room.revision,
        engineRevision: engineState.revision,
        ...(requestDeadline === undefined
          ? {}
          : {
              deadline: requestDeadline,
            }),
      } as unknown as Json,
      created_at: input.persistedAt,
      updated_at: input.persistedAt,
    }
  })
}

function loadedRowsToStorageRecord(input: {
  readonly roomId: MatchRoomId
  readonly roomRow: MatchRoomRow
  readonly snapshotRow: RoomSnapshotRow
  readonly eventRows: readonly RoomEventRow[]
  readonly pendingRows: readonly PendingChoiceRow[]
}): PersistedMatchSessionResult<PersistedMatchSessionStorageRecord> {
  const restored = restoreMatchSessionDocument(
    input.snapshotRow.game_state_payload,
  )

  if (!restored.ok) {
    return storageErr(restored.code, restored.message)
  }

  if (restored.session.room.roomId !== input.roomId) {
    return storageErr(
      'room_id_mismatch',
      `Persisted match room ${input.roomId} current snapshot restored room ${restored.session.room.roomId}.`,
    )
  }

  const historyValidation = validateLoadedHistoryRows({
    roomId: input.roomId,
    expectedHistory: restored.session.history,
    roomRow: input.roomRow,
    snapshotRow: input.snapshotRow,
    eventRows: input.eventRows,
  })

  if (!historyValidation.ok) {
    return historyValidation
  }

  const pendingValidation = validateLoadedPendingChoices({
    room: restored.session.room,
    pendingRows: input.pendingRows,
  })

  if (!pendingValidation.ok) {
    return pendingValidation
  }

  return storageOk({
    roomId: input.roomId,
    document: input.snapshotRow.game_state_payload,
    persistedAt: input.roomRow.updated_at,
  })
}

function validateLoadedHistoryRows(input: {
  readonly roomId: MatchRoomId
  readonly expectedHistory: readonly MatchRoomHistoryEntry[]
  readonly roomRow: MatchRoomRow
  readonly snapshotRow: RoomSnapshotRow
  readonly eventRows: readonly RoomEventRow[]
}): PersistedMatchSessionResult<void> {
  if (input.roomRow.latest_event_sequence !== input.expectedHistory.length) {
    return storageErr(
      'history_conflict',
      `Persisted match room ${input.roomId} latest event sequence ${input.roomRow.latest_event_sequence} does not match snapshot history length ${input.expectedHistory.length}.`,
    )
  }

  if (input.snapshotRow.last_event_sequence !== input.expectedHistory.length) {
    return storageErr(
      'history_conflict',
      `Persisted match room ${input.roomId} current snapshot last event sequence ${input.snapshotRow.last_event_sequence} does not match snapshot history length ${input.expectedHistory.length}.`,
    )
  }

  if (input.eventRows.length !== input.expectedHistory.length) {
    return storageErr(
      'history_conflict',
      `Persisted match room ${input.roomId} has ${input.eventRows.length} accepted event rows, not ${input.expectedHistory.length}.`,
    )
  }

  for (const [index, entry] of input.expectedHistory.entries()) {
    const eventRow = input.eventRows[index]

    if (eventRow?.event_sequence !== entry.sequence) {
      return storageErr(
        'history_conflict',
        `Persisted match room ${input.roomId} event row ${index + 1} is out of sequence.`,
      )
    }

    if (!historyPayloadMatchesEntry(eventRow.event_payload, entry)) {
      return storageErr(
        'history_conflict',
        `Persisted match room ${input.roomId} event row ${entry.sequence} does not match the current snapshot history entry.`,
      )
    }
  }

  return storageOk(undefined)
}

function validateLoadedPendingChoices(input: {
  readonly room: MatchRoom
  readonly pendingRows: readonly PendingChoiceRow[]
}): PersistedMatchSessionResult<void> {
  const pendingRequests = hasMatchRoomEngineState(input.room)
    ? input.room.engineState.pendingRequests
    : []

  if (input.pendingRows.length !== pendingRequests.length) {
    return storageErr(
      'storage_failed',
      `Persisted match room ${input.room.roomId} has ${input.pendingRows.length} pending choice rows, not ${pendingRequests.length}.`,
    )
  }

  const rowsByRequestId = new Map<string, PendingChoiceRow>()

  for (const row of input.pendingRows) {
    const context = row.context_payload
    const requestId =
      isRecord(context) && typeof context.requestId === 'string'
        ? context.requestId
        : undefined

    if (requestId === undefined) {
      return storageErr(
        'storage_failed',
        `Persisted match room ${input.room.roomId} has a pending choice row without requestId context.`,
      )
    }

    rowsByRequestId.set(requestId, row)
  }

  for (const [queueIndex, request] of pendingRequests.entries()) {
    const row = rowsByRequestId.get(request.requestId as string)

    if (row === undefined) {
      return storageErr(
        'storage_failed',
        `Persisted match room ${input.room.roomId} is missing pending choice row ${request.requestId}.`,
      )
    }

    const context = row.context_payload

    if (
      !isRecord(context) ||
      context.queueIndex !== queueIndex ||
      row.choice_kind !== request.type ||
      row.status !== 'pending'
    ) {
      return storageErr(
        'storage_failed',
        `Persisted match room ${input.room.roomId} pending choice row ${request.requestId} does not match the canonical FIFO request.`,
      )
    }
  }

  return storageOk(undefined)
}

function historyPayloadMatchesEntry(
  payload: Json,
  entry: MatchRoomHistoryEntry,
): boolean {
  return (
    isRecord(payload) &&
    payload.entryId === entry.entryId &&
    payload.sequence === entry.sequence &&
    payload.roomId === entry.roomId
  )
}

function rpcRowToStorageRecord(
  row: PersistedMatchSessionRpcRow | null,
  expectedRoomId: MatchRoomId,
): PersistedMatchSessionResult<PersistedMatchSessionStorageRecord> {
  if (!row) {
    return storageErr(
      'storage_failed',
      `Persisted match room ${expectedRoomId} write completed without returning a storage record.`,
    )
  }

  if (row.room_id !== expectedRoomId) {
    return storageErr(
      'room_id_mismatch',
      `Persisted storage returned room ${row.room_id}, not ${expectedRoomId}.`,
    )
  }

  return storageOk({
    roomId: expectedRoomId,
    document: row.document,
    persistedAt: row.persisted_at,
  })
}

function storageErrFromQueryError<TData>(
  error: QueryErrorLike,
  input: {
    readonly roomId: MatchRoomId
    readonly fallbackCode: PersistedMatchSessionIssueCode
    readonly fallbackMessage: string
  },
): PersistedMatchSessionResult<TData> {
  switch (error.code) {
    case '23505':
      return storageErr(
        'room_already_exists',
        `Persisted match room ${input.roomId} already exists.`,
        error,
      )
    case 'P0002':
    case 'VG001':
      return storageErr(
        'room_not_found',
        `Persisted match room ${input.roomId} was not found.`,
        error,
      )
    case 'VG002':
      return storageErr(
        'stale_room_revision',
        `Persisted match room ${input.roomId} is not at the expected revision.`,
        error,
      )
    case 'VG003':
      return storageErr(
        'history_conflict',
        `Persisted match room ${input.roomId} history did not match the expected accepted history boundary.`,
        error,
      )
    default:
      return storageErr(input.fallbackCode, input.fallbackMessage, error)
  }
}

function resolveHostProfileId(room: MatchRoom): string | null {
  const hostParticipant =
    room.hostParticipantId === undefined
      ? undefined
      : room.participants.find(
          (participant) => participant.participantId === room.hostParticipantId,
        )

  return isUuid(hostParticipant?.userId) ? hostParticipant.userId : null
}

function resolvePersistedRoomStartedAt(room: MatchRoom): string | null {
  if (
    room.status === 'created' ||
    (room.status === 'initialized' && room.metadata.startedAt === undefined)
  ) {
    return null
  }

  return (
    room.metadata.startedAt ??
    room.metadata.initializedAt ??
    room.metadata.createdAt
  )
}

function resolvePersistedRoomEndedAt(room: MatchRoom): string | null {
  switch (room.status) {
    case 'completed':
      return room.metadata.completedAt ?? room.metadata.updatedAt
    case 'aborted':
      return room.metadata.abortedAt ?? room.metadata.updatedAt
    case 'created':
    case 'initialized':
    case 'in_progress':
      return null
  }
}

function resolveSnapshotTurnNumber(room: MatchRoom): number | null {
  if (!hasMatchRoomEngineState(room)) {
    return null
  }

  return room.engineState.turn.turnNumber > 0
    ? room.engineState.turn.turnNumber
    : null
}

function resolveSnapshotPhaseKey(room: MatchRoom): string | null {
  return hasMatchRoomEngineState(room) ? room.engineState.turn.phase : null
}

function resolveActiveRoomPlayerId(
  room: MatchRoom,
  roomPlayerIdsByPlayerId: ReadonlyMap<string, string>,
): string | null {
  if (!hasMatchRoomEngineState(room)) {
    return null
  }

  return (
    roomPlayerIdsByPlayerId.get(room.engineState.turn.turnPlayerId as string) ??
    null
  )
}

function createRoomPlayerId(
  roomId: MatchRoomId,
  participantId: MatchRoomParticipantId,
): string {
  return createUuidV5(
    deterministicUuidNamespace,
    `${roomId}:room-player:${participantId}`,
  )
}

function createPendingChoiceId(roomId: string, requestId: string): string {
  return createUuidV5(
    deterministicUuidNamespace,
    `${roomId}:pending-choice:${requestId}`,
  )
}

function createUuidV5(namespaceUuid: string, name: string): string {
  const namespaceBytes = uuidToBytes(namespaceUuid)
  const nameBytes = Buffer.from(name, 'utf8')
  const hash = createHash('sha1')
    .update(namespaceBytes)
    .update(nameBytes)
    .digest()
    .subarray(0, 16)

  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x50
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80

  return bytesToUuid(hash)
}

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replaceAll('-', ''), 'hex')
}

function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString('hex')

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function storageOk<TData>(data: TData): PersistedMatchSessionResult<TData> {
  return {
    ok: true,
    data,
  }
}

function storageErr<TData = never>(
  code: PersistedMatchSessionIssueCode,
  message: string,
  error?: QueryErrorLike,
): PersistedMatchSessionResult<TData> {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(error?.details || error?.message
        ? {
            message: error.details
              ? `${message} ${error.details}`
              : `${message} ${error.message}`,
          }
        : {}),
    },
  }
}
