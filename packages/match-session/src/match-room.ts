import {
  PREMIUM_FORMAT_ID,
  STANDARD_FORMAT_ID,
  V_PREMIUM_FORMAT_ID,
  assertGameStateCardStatsComplete,
  assertGameStateInvariant,
  isPlayerGameAction,
  isSystemGameAction,
  premiumFormatAdapter,
  standardFormatAdapter,
  vPremiumFormatAdapter,
} from '@web-vg/rules-core'
import type {
  AcceptedEngineDispatchResult,
  BlockedEngineDispatchResult,
  EngineCommand,
  EngineDispatchResult,
  GameState,
  InvalidEngineDispatchResult,
  PlayerId,
} from '@web-vg/rules-core'
import type { Brand, DeckId, FormatId, UserId } from '@web-vg/shared'

export type MatchRoomId = Brand<string, 'MatchRoomId'>
export type MatchRoomParticipantId = Brand<string, 'MatchRoomParticipantId'>
export type MatchRoomClientSessionId = Brand<string, 'MatchRoomClientSessionId'>
export type MatchRoomEngineAdapterId = Brand<string, 'MatchRoomEngineAdapterId'>

export type MatchRoomLifecycleStatus =
  | 'created'
  | 'initialized'
  | 'in_progress'
  | 'completed'
  | 'aborted'

export const MATCH_ROOM_STANDARD_ENGINE_ADAPTER_ID =
  'rules-core:standard' as MatchRoomEngineAdapterId
export const MATCH_ROOM_V_PREMIUM_ENGINE_ADAPTER_ID =
  'rules-core:v-premium' as MatchRoomEngineAdapterId
export const MATCH_ROOM_PREMIUM_ENGINE_ADAPTER_ID =
  'rules-core:premium' as MatchRoomEngineAdapterId

export interface MatchRoomMetadata {
  readonly createdAt: string
  readonly updatedAt: string
  readonly initializedAt?: string
  readonly startedAt?: string
  readonly completedAt?: string
  readonly abortedAt?: string
}

export interface CreateMatchRoomParticipantInput {
  readonly participantId: MatchRoomParticipantId
  readonly seat: number
  readonly userId?: UserId
  readonly clientSessionId?: MatchRoomClientSessionId
  readonly displayName?: string
  readonly submittedDeckId?: DeckId
}

export interface MatchRoomParticipant extends CreateMatchRoomParticipantInput {
  readonly enginePlayerId?: PlayerId
}

export interface MatchRoomPlayerBinding {
  readonly participantId: MatchRoomParticipantId
  readonly playerId: PlayerId
}

interface MatchRoomBase<TStatus extends MatchRoomLifecycleStatus> {
  readonly roomId: MatchRoomId
  readonly formatId: FormatId
  readonly engineAdapterId: MatchRoomEngineAdapterId
  readonly status: TStatus
  readonly revision: number
  readonly participants: readonly MatchRoomParticipant[]
  readonly hostParticipantId?: MatchRoomParticipantId
  readonly metadata: MatchRoomMetadata
}

export interface CreatedMatchRoom extends MatchRoomBase<'created'> {
  readonly engineState?: never
}

export interface InitializedMatchRoom extends MatchRoomBase<'initialized'> {
  readonly engineState: GameState
}

export interface InProgressMatchRoom extends MatchRoomBase<'in_progress'> {
  readonly engineState: GameState
}

export interface CompletedMatchRoom extends MatchRoomBase<'completed'> {
  readonly engineState: GameState
}

export interface AbortedMatchRoom extends MatchRoomBase<'aborted'> {
  readonly engineState?: GameState
  readonly abortReason?: string
}

export type OpenMatchRoom = InitializedMatchRoom | InProgressMatchRoom
export type ClosedMatchRoom = CompletedMatchRoom | AbortedMatchRoom
export type MatchRoom =
  | CreatedMatchRoom
  | InitializedMatchRoom
  | InProgressMatchRoom
  | CompletedMatchRoom
  | AbortedMatchRoom
export type MatchRoomWithEngineState = MatchRoom & {
  readonly engineState: GameState
}

export interface CreateMatchRoomInput {
  readonly roomId: MatchRoomId
  readonly formatId: FormatId
  readonly engineAdapterId?: MatchRoomEngineAdapterId
  readonly participants: readonly CreateMatchRoomParticipantInput[]
  readonly hostParticipantId?: MatchRoomParticipantId
  readonly createdAt?: string
}

export interface InitializeMatchRoomInput {
  readonly initialState: GameState
  readonly playerBindings: readonly MatchRoomPlayerBinding[]
  readonly initializedAt?: string
}

export interface AbortMatchRoomInput {
  readonly reason?: string
  readonly abortedAt?: string
}

export interface MatchRoomEngineAdapter {
  readonly adapterId: MatchRoomEngineAdapterId
  readonly formatId: FormatId
  dispatch(
    currentState: GameState,
    command: EngineCommand,
  ): EngineDispatchResult
}

export type MatchRoomCommandSource =
  | {
      readonly kind: 'participant'
      readonly participantId: MatchRoomParticipantId
    }
  | {
      readonly kind: 'system'
      readonly source: 'local-session' | 'match-runtime' | (string & {})
    }

export interface MatchRoomCommandSubmission<
  TCommand extends EngineCommand = EngineCommand,
> {
  readonly source: MatchRoomCommandSource
  readonly command: TCommand
}

export type MatchRoomInvalidCommandCode =
  | 'room_not_initialized'
  | 'room_closed'
  | 'unknown_participant'
  | 'participant_not_bound_to_player'
  | 'actor_participant_mismatch'
  | 'player_command_requires_participant_source'
  | 'system_command_requires_system_source'
  | 'engine_adapter_not_found'
  | 'engine_adapter_format_mismatch'
  | InvalidEngineDispatchResult['code']

export interface AcceptedMatchRoomCommandResult {
  readonly status: 'accepted'
  readonly room: InitializedMatchRoom | InProgressMatchRoom | CompletedMatchRoom
  readonly engineResult: AcceptedEngineDispatchResult
}

export interface RoomLevelInvalidMatchRoomCommandResult {
  readonly status: 'invalid'
  readonly room: MatchRoom
  readonly code: MatchRoomInvalidCommandCode
  readonly message: string
}

export interface EngineInvalidMatchRoomCommandResult {
  readonly status: 'invalid'
  readonly room: OpenMatchRoom
  readonly code: InvalidEngineDispatchResult['code']
  readonly message: string
  readonly engineResult: InvalidEngineDispatchResult
}

export type InvalidMatchRoomCommandResult =
  | RoomLevelInvalidMatchRoomCommandResult
  | EngineInvalidMatchRoomCommandResult

export interface BlockedMatchRoomCommandResult {
  readonly status: 'blocked'
  readonly room: OpenMatchRoom
  readonly code: BlockedEngineDispatchResult['code']
  readonly message: string
  readonly blockingRequests: BlockedEngineDispatchResult['blockingRequests']
  readonly engineResult: BlockedEngineDispatchResult
}

export type MatchRoomCommandResult =
  | AcceptedMatchRoomCommandResult
  | InvalidMatchRoomCommandResult
  | BlockedMatchRoomCommandResult

export class MatchRoomInvariantError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MatchRoomInvariantError'
  }
}

export const defaultMatchRoomEngineAdapters: readonly MatchRoomEngineAdapter[] =
  [
    {
      adapterId: MATCH_ROOM_STANDARD_ENGINE_ADAPTER_ID,
      formatId: STANDARD_FORMAT_ID,
      dispatch(currentState, command) {
        return standardFormatAdapter.dispatch(currentState, command)
      },
    },
    {
      adapterId: MATCH_ROOM_V_PREMIUM_ENGINE_ADAPTER_ID,
      formatId: V_PREMIUM_FORMAT_ID,
      dispatch(currentState, command) {
        return vPremiumFormatAdapter.dispatch(currentState, command)
      },
    },
    {
      adapterId: MATCH_ROOM_PREMIUM_ENGINE_ADAPTER_ID,
      formatId: PREMIUM_FORMAT_ID,
      dispatch(currentState, command) {
        return premiumFormatAdapter.dispatch(currentState, command)
      },
    },
  ]

export function resolveDefaultMatchRoomEngineAdapterId(
  formatId: FormatId,
): MatchRoomEngineAdapterId | undefined {
  switch (formatId) {
    case STANDARD_FORMAT_ID:
      return MATCH_ROOM_STANDARD_ENGINE_ADAPTER_ID
    case V_PREMIUM_FORMAT_ID:
      return MATCH_ROOM_V_PREMIUM_ENGINE_ADAPTER_ID
    case PREMIUM_FORMAT_ID:
      return MATCH_ROOM_PREMIUM_ENGINE_ADAPTER_ID
    default:
      return undefined
  }
}

export function createMatchRoom(input: CreateMatchRoomInput): CreatedMatchRoom {
  const createdAt = input.createdAt ?? new Date().toISOString()
  const engineAdapterId =
    input.engineAdapterId ??
    resolveDefaultMatchRoomEngineAdapterId(input.formatId)

  assertMatchRoomInvariant(
    engineAdapterId !== undefined,
    `Match room ${input.roomId} requires an engine adapter id for format ${input.formatId}.`,
  )

  const participants = input.participants.map(createMatchRoomParticipant)

  assertRoomParticipants(participants, input.hostParticipantId)

  return {
    roomId: input.roomId,
    formatId: input.formatId,
    engineAdapterId,
    status: 'created',
    revision: 0,
    participants,
    ...(input.hostParticipantId === undefined
      ? {}
      : {
          hostParticipantId: input.hostParticipantId,
        }),
    metadata: {
      createdAt,
      updatedAt: createdAt,
    },
  }
}

export function initializeMatchRoom(
  room: MatchRoom,
  input: InitializeMatchRoomInput,
): InitializedMatchRoom {
  assertMatchRoomInvariant(
    room.status === 'created',
    `Only created match rooms can be initialized; room ${room.roomId} is ${room.status}.`,
  )
  assertMatchRoomInvariant(
    room.formatId === input.initialState.formatId,
    `Match room ${room.roomId} format ${room.formatId} does not match initial game format ${input.initialState.formatId}.`,
  )
  assertMatchRoomInvariant(
    input.initialState.status === 'setup' ||
      input.initialState.status === 'ready',
    `Match room ${room.roomId} must initialize from a setup or ready game state, received ${input.initialState.status}.`,
  )

  assertGameStateInvariant(input.initialState)
  assertGameStateCardStatsComplete(input.initialState)

  const participants = bindParticipantsToEnginePlayers(
    room.participants,
    input.playerBindings,
    input.initialState,
  )
  const initializedAt = input.initializedAt ?? new Date().toISOString()

  return {
    ...room,
    status: 'initialized',
    revision: room.revision + 1,
    participants,
    engineState: input.initialState,
    metadata: {
      ...room.metadata,
      initializedAt,
      updatedAt: initializedAt,
    },
  }
}

export function abortMatchRoom(
  room: MatchRoom,
  input: AbortMatchRoomInput = {},
): AbortedMatchRoom {
  assertMatchRoomInvariant(
    room.status !== 'completed',
    `Completed match room ${room.roomId} cannot be aborted.`,
  )
  assertMatchRoomInvariant(
    room.status !== 'aborted',
    `Match room ${room.roomId} is already aborted.`,
  )

  const abortedAt = input.abortedAt ?? new Date().toISOString()

  return {
    ...room,
    status: 'aborted',
    revision: room.revision + 1,
    metadata: {
      ...room.metadata,
      abortedAt,
      updatedAt: abortedAt,
    },
    ...(input.reason === undefined
      ? {}
      : {
          abortReason: input.reason,
        }),
  }
}

export function submitMatchRoomCommand(
  room: MatchRoom,
  submission: MatchRoomCommandSubmission,
  options: {
    readonly engineAdapters?: readonly MatchRoomEngineAdapter[]
    readonly submittedAt?: string
  } = {},
): MatchRoomCommandResult {
  if (room.status === 'completed' || room.status === 'aborted') {
    return createRoomLevelInvalidResult(
      room,
      'room_closed',
      `Match room ${room.roomId} is ${room.status} and cannot accept gameplay commands.`,
    )
  }

  if (!isOpenMatchRoom(room)) {
    return createRoomLevelInvalidResult(
      room,
      'room_not_initialized',
      `Match room ${room.roomId} must be initialized before commands can be submitted.`,
    )
  }

  const sourceValidation = validateCommandSource(room, submission)

  if (!sourceValidation.ok) {
    return createRoomLevelInvalidResult(
      room,
      sourceValidation.code,
      sourceValidation.message,
    )
  }

  const adapter = resolveMatchRoomEngineAdapter(
    room,
    options.engineAdapters ?? defaultMatchRoomEngineAdapters,
  )

  if (adapter === undefined) {
    return createRoomLevelInvalidResult(
      room,
      'engine_adapter_not_found',
      `Match room ${room.roomId} cannot resolve engine adapter ${room.engineAdapterId}.`,
    )
  }

  if (adapter.formatId !== room.formatId) {
    return createRoomLevelInvalidResult(
      room,
      'engine_adapter_format_mismatch',
      `Match room ${room.roomId} adapter ${adapter.adapterId} is for format ${adapter.formatId}, not ${room.formatId}.`,
    )
  }

  const engineResult = adapter.dispatch(room.engineState, submission.command)

  switch (engineResult.status) {
    case 'accepted':
      return {
        status: 'accepted',
        room: advanceRoomAfterAcceptedEngineResult(
          room,
          engineResult,
          options.submittedAt ?? new Date().toISOString(),
        ),
        engineResult,
      }
    case 'invalid':
      return {
        status: 'invalid',
        room,
        code: engineResult.code,
        message: engineResult.message,
        engineResult,
      }
    case 'blocked':
      return {
        status: 'blocked',
        room,
        code: engineResult.code,
        message: engineResult.message,
        blockingRequests: engineResult.blockingRequests,
        engineResult,
      }
  }
}

export function hasMatchRoomEngineState(
  room: MatchRoom,
): room is MatchRoomWithEngineState {
  return 'engineState' in room && room.engineState !== undefined
}

export function getMatchRoomEngineRevision(
  room: MatchRoom,
): GameState['revision'] | undefined {
  return hasMatchRoomEngineState(room) ? room.engineState.revision : undefined
}

export function findMatchRoomParticipant(
  room: MatchRoom,
  participantId: MatchRoomParticipantId,
): MatchRoomParticipant | undefined {
  return room.participants.find(
    (participant) => participant.participantId === participantId,
  )
}

export function findMatchRoomParticipantByPlayerId(
  room: MatchRoom,
  playerId: PlayerId,
): MatchRoomParticipant | undefined {
  return room.participants.find(
    (participant) => participant.enginePlayerId === playerId,
  )
}

function createMatchRoomParticipant(
  input: CreateMatchRoomParticipantInput,
): MatchRoomParticipant {
  return {
    participantId: input.participantId,
    seat: input.seat,
    ...(input.userId === undefined ? {} : { userId: input.userId }),
    ...(input.clientSessionId === undefined
      ? {}
      : { clientSessionId: input.clientSessionId }),
    ...(input.displayName === undefined
      ? {}
      : { displayName: input.displayName }),
    ...(input.submittedDeckId === undefined
      ? {}
      : { submittedDeckId: input.submittedDeckId }),
  }
}

function assertRoomParticipants(
  participants: readonly MatchRoomParticipant[],
  hostParticipantId: MatchRoomParticipantId | undefined,
): void {
  assertMatchRoomInvariant(
    participants.length > 0,
    'Match rooms must contain at least one participant.',
  )

  for (const participant of participants) {
    assertMatchRoomInvariant(
      Number.isSafeInteger(participant.seat) && participant.seat >= 0,
      `Match room participant ${participant.participantId} must use a non-negative integer seat.`,
    )
  }

  assertUniqueStrings(
    participants.map((participant) => participant.participantId as string),
    'Match room participants must not repeat participant ids.',
  )
  assertUniqueStrings(
    participants.map((participant) => participant.seat.toString()),
    'Match room participants must not repeat seats.',
  )
  assertUniqueStrings(
    participants
      .map((participant) => participant.userId)
      .filter((userId): userId is UserId => userId !== undefined)
      .map((userId) => userId as string),
    'Match room participants must not repeat user ids.',
  )

  if (hostParticipantId !== undefined) {
    assertMatchRoomInvariant(
      participants.some(
        (participant) => participant.participantId === hostParticipantId,
      ),
      `Host participant ${hostParticipantId} must belong to the match room.`,
    )
  }
}

function bindParticipantsToEnginePlayers(
  participants: readonly MatchRoomParticipant[],
  bindings: readonly MatchRoomPlayerBinding[],
  initialState: GameState,
): readonly MatchRoomParticipant[] {
  assertMatchRoomInvariant(
    bindings.length === participants.length,
    `Initial game ${initialState.gameId} must bind every room participant to exactly one engine player.`,
  )
  assertMatchRoomInvariant(
    bindings.length === initialState.players.length,
    `Initial game ${initialState.gameId} must bind every engine player to exactly one room participant.`,
  )

  assertUniqueStrings(
    bindings.map((binding) => binding.participantId as string),
    'Initial match room player bindings must not repeat participant ids.',
  )
  assertUniqueStrings(
    bindings.map((binding) => binding.playerId as string),
    'Initial match room player bindings must not repeat engine player ids.',
  )

  const participantsById = new Map(
    participants.map(
      (participant) =>
        [participant.participantId as string, participant] as const,
    ),
  )
  const playersById = new Map(
    initialState.players.map(
      (player) => [player.playerId as string, player] as const,
    ),
  )
  const bindingByParticipantId = new Map(
    bindings.map(
      (binding) => [binding.participantId as string, binding.playerId] as const,
    ),
  )

  for (const binding of bindings) {
    assertMatchRoomInvariant(
      participantsById.has(binding.participantId as string),
      `Player binding references unknown participant ${binding.participantId}.`,
    )
    assertMatchRoomInvariant(
      playersById.has(binding.playerId as string),
      `Player binding references unknown engine player ${binding.playerId}.`,
    )
  }

  return participants.map((participant) => {
    const playerId = bindingByParticipantId.get(
      participant.participantId as string,
    )

    assertMatchRoomInvariant(
      playerId !== undefined,
      `Participant ${participant.participantId} is missing an engine player binding.`,
    )

    const player = playersById.get(playerId as string)

    assertMatchRoomInvariant(
      player !== undefined,
      `Participant ${participant.participantId} is bound to unknown engine player ${playerId}.`,
    )
    assertMatchRoomInvariant(
      player.seat === participant.seat,
      `Participant ${participant.participantId} seat ${participant.seat} must match engine player ${player.playerId} seat ${player.seat}.`,
    )

    return {
      ...participant,
      enginePlayerId: playerId,
    }
  })
}

function validateCommandSource(
  room: OpenMatchRoom,
  submission: MatchRoomCommandSubmission,
):
  | {
      readonly ok: true
    }
  | {
      readonly ok: false
      readonly code: MatchRoomInvalidCommandCode
      readonly message: string
    } {
  const command = submission.command

  if (command.kind === 'choice_response') {
    return validateParticipantPlayerReference(
      room,
      submission.source,
      command.submission.response.responderPlayerId,
      `Choice response ${command.submission.response.requestId}`,
    )
  }

  const action = command.submission.action

  if (isPlayerGameAction(action)) {
    return validateParticipantPlayerReference(
      room,
      submission.source,
      action.actor.playerId,
      `Action ${action.actionId}`,
    )
  }

  if (isSystemGameAction(action) && submission.source.kind !== 'system') {
    return {
      ok: false,
      code: 'system_command_requires_system_source',
      message: `System action ${action.actionId} must be submitted through a room system source.`,
    }
  }

  return { ok: true }
}

function validateParticipantPlayerReference(
  room: OpenMatchRoom,
  source: MatchRoomCommandSource,
  playerId: PlayerId,
  label: string,
):
  | {
      readonly ok: true
    }
  | {
      readonly ok: false
      readonly code: MatchRoomInvalidCommandCode
      readonly message: string
    } {
  if (source.kind !== 'participant') {
    return {
      ok: false,
      code: 'player_command_requires_participant_source',
      message: `${label} references engine player ${playerId} and must be submitted by a room participant.`,
    }
  }

  const participant = findMatchRoomParticipant(room, source.participantId)

  if (participant === undefined) {
    return {
      ok: false,
      code: 'unknown_participant',
      message: `${label} was submitted by unknown participant ${source.participantId}.`,
    }
  }

  if (participant.enginePlayerId === undefined) {
    return {
      ok: false,
      code: 'participant_not_bound_to_player',
      message: `${label} was submitted by participant ${source.participantId}, but that participant is not bound to an engine player.`,
    }
  }

  if (participant.enginePlayerId !== playerId) {
    return {
      ok: false,
      code: 'actor_participant_mismatch',
      message: `${label} references engine player ${playerId}, but participant ${source.participantId} is bound to ${participant.enginePlayerId}.`,
    }
  }

  return { ok: true }
}

function resolveMatchRoomEngineAdapter(
  room: MatchRoom,
  adapters: readonly MatchRoomEngineAdapter[],
): MatchRoomEngineAdapter | undefined {
  return adapters.find((adapter) => adapter.adapterId === room.engineAdapterId)
}

function advanceRoomAfterAcceptedEngineResult(
  room: OpenMatchRoom,
  engineResult: AcceptedEngineDispatchResult,
  submittedAt: string,
): InitializedMatchRoom | InProgressMatchRoom | CompletedMatchRoom {
  const status = deriveRoomStatusAfterEngineState(room, engineResult.state)
  const metadata = advanceRoomMetadata(room.metadata, status, submittedAt)

  return {
    ...room,
    status,
    revision: room.revision + 1,
    engineState: engineResult.state,
    metadata,
  } as InitializedMatchRoom | InProgressMatchRoom | CompletedMatchRoom
}

function deriveRoomStatusAfterEngineState(
  room: OpenMatchRoom,
  state: GameState,
):
  | InitializedMatchRoom['status']
  | InProgressMatchRoom['status']
  | CompletedMatchRoom['status'] {
  switch (state.status) {
    case 'completed':
      return 'completed'
    case 'in_progress':
    case 'awaiting_choice':
      return 'in_progress'
    case 'setup':
    case 'ready':
      return room.status === 'in_progress' ? 'in_progress' : 'initialized'
    default:
      return room.status === 'initialized' ? 'initialized' : 'in_progress'
  }
}

function advanceRoomMetadata(
  metadata: MatchRoomMetadata,
  status:
    | InitializedMatchRoom['status']
    | InProgressMatchRoom['status']
    | CompletedMatchRoom['status'],
  updatedAt: string,
): MatchRoomMetadata {
  const base = {
    ...metadata,
    updatedAt,
  }

  if (status === 'in_progress' && metadata.startedAt === undefined) {
    return {
      ...base,
      startedAt: updatedAt,
    }
  }

  if (status === 'completed' && metadata.completedAt === undefined) {
    return {
      ...base,
      completedAt: updatedAt,
    }
  }

  return base
}

function isOpenMatchRoom(room: MatchRoom): room is OpenMatchRoom {
  return (
    (room.status === 'initialized' || room.status === 'in_progress') &&
    hasMatchRoomEngineState(room)
  )
}

function createRoomLevelInvalidResult(
  room: MatchRoom,
  code: MatchRoomInvalidCommandCode,
  message: string,
): RoomLevelInvalidMatchRoomCommandResult {
  return {
    status: 'invalid',
    room,
    code,
    message,
  }
}

function assertMatchRoomInvariant(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    throw new MatchRoomInvariantError(message)
  }
}

function assertUniqueStrings(values: readonly string[], message: string): void {
  assertMatchRoomInvariant(new Set(values).size === values.length, message)
}
