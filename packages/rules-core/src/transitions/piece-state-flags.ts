import type {
  LockPieceAction,
  RestPieceAction,
  StandPieceAction,
  UnlockPieceAction,
} from '../actions'
import type { EventId, TransitionId } from '../contracts'
import type { EventOrigin, GameEvent } from '../events'
import type {
  GamePieceFlagKey,
  GamePieceOrientation,
  GamePieceState,
  GamePieceStatusState,
  GameState,
  ZoneState,
} from '../state'

import {
  advanceGameStateRevision,
  createInvalidTransitionResult,
  createTransitionResult,
  type TransitionResult,
} from './transition'

const DEFAULT_GAME_PIECE_ORIENTATION = 'stand' as GamePieceOrientation
export const LOCKED_PIECE_FLAG = 'locked' as GamePieceFlagKey

type PieceStateEventType =
  | 'piece.rested'
  | 'piece.stood'
  | 'piece.locked'
  | 'piece.unlocked'

interface PieceStateContext {
  readonly piece: GamePieceState
  readonly zone: ZoneState
  readonly state: GamePieceStatusState
}

interface SuccessfulPieceStateChange {
  readonly ok: true
  readonly pieceStates: readonly GamePieceStatusState[]
  readonly event: Extract<GameEvent, { readonly type: PieceStateEventType }>
}

interface FailedPieceStateChange {
  readonly ok: false
  readonly code: 'invalid_action' | 'invalid_action_reference'
  readonly message: string
}

type PieceStateChangeResult =
  | SuccessfulPieceStateChange
  | FailedPieceStateChange

export function resolveGamePieceStatusState(
  currentState: GameState,
  pieceId: GamePieceState['pieceId'],
): GamePieceStatusState {
  return (
    currentState.pieceStates.find(
      (pieceState) => pieceState.pieceId === pieceId,
    ) ?? {
      pieceId,
      orientation: DEFAULT_GAME_PIECE_ORIENTATION,
      flags: [],
    }
  )
}

export function hasGamePieceFlag(
  currentState: GameState,
  pieceId: GamePieceState['pieceId'],
  flag: GamePieceFlagKey,
): boolean {
  return resolveGamePieceStatusState(currentState, pieceId).flags.includes(flag)
}

export function isGamePieceStanding(
  currentState: GameState,
  pieceId: GamePieceState['pieceId'],
): boolean {
  return (
    resolveGamePieceStatusState(currentState, pieceId).orientation === 'stand'
  )
}

export function applyRestPieceTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: RestPieceAction,
): TransitionResult {
  return applyPieceStateTransition(
    transitionId,
    currentState,
    action,
    applyRestPieceStateChange(
      currentState,
      action.pieceId,
      transitionId,
      0,
      createActionEventOrigin(action),
      action.actionId,
    ),
  )
}

export function applyStandPieceTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: StandPieceAction,
): TransitionResult {
  return applyPieceStateTransition(
    transitionId,
    currentState,
    action,
    applyStandPieceStateChange(
      currentState,
      action.pieceId,
      transitionId,
      0,
      createActionEventOrigin(action),
      action.actionId,
    ),
  )
}

export function applyLockPieceTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: LockPieceAction,
): TransitionResult {
  return applyPieceStateTransition(
    transitionId,
    currentState,
    action,
    applyLockPieceStateChange(
      currentState,
      action.pieceId,
      transitionId,
      0,
      createActionEventOrigin(action),
      action.actionId,
    ),
  )
}

export function applyUnlockPieceTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: UnlockPieceAction,
): TransitionResult {
  return applyPieceStateTransition(
    transitionId,
    currentState,
    action,
    applyUnlockPieceStateChange(
      currentState,
      action.pieceId,
      transitionId,
      0,
      createActionEventOrigin(action),
      action.actionId,
    ),
  )
}

export function applyRestPieceStateChange(
  currentState: GameState,
  pieceId: GamePieceState['pieceId'],
  transitionId: TransitionId,
  sequence: number,
  origin: EventOrigin,
  sourceActionId?: RestPieceAction['actionId'],
): PieceStateChangeResult {
  const context = resolvePieceStateContext(currentState, pieceId)

  if (!context.ok) {
    return context
  }

  if (context.value.state.orientation === 'rest') {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Piece ${pieceId} is already rested.`,
    }
  }

  if (context.value.state.flags.includes(LOCKED_PIECE_FLAG)) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Locked piece ${pieceId} cannot change orientation while locked.`,
    }
  }

  return {
    ok: true,
    pieceStates: upsertGamePieceStatusState(currentState, {
      ...context.value.state,
      orientation: 'rest',
    }),
    event: createPieceStateEvent(
      transitionId,
      sequence,
      'piece.rested',
      origin,
      pieceId,
      context.value.zone.zoneId,
      sourceActionId,
    ),
  }
}

export function applyStandPieceStateChange(
  currentState: GameState,
  pieceId: GamePieceState['pieceId'],
  transitionId: TransitionId,
  sequence: number,
  origin: EventOrigin,
  sourceActionId?: StandPieceAction['actionId'],
): PieceStateChangeResult {
  const context = resolvePieceStateContext(currentState, pieceId)

  if (!context.ok) {
    return context
  }

  if (context.value.state.orientation === 'stand') {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Piece ${pieceId} is already standing.`,
    }
  }

  if (context.value.state.flags.includes(LOCKED_PIECE_FLAG)) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Locked piece ${pieceId} cannot change orientation while locked.`,
    }
  }

  return {
    ok: true,
    pieceStates: upsertGamePieceStatusState(currentState, {
      ...context.value.state,
      orientation: 'stand',
    }),
    event: createPieceStateEvent(
      transitionId,
      sequence,
      'piece.stood',
      origin,
      pieceId,
      context.value.zone.zoneId,
      sourceActionId,
    ),
  }
}

export function applyLockPieceStateChange(
  currentState: GameState,
  pieceId: GamePieceState['pieceId'],
  transitionId: TransitionId,
  sequence: number,
  origin: EventOrigin,
  sourceActionId?: LockPieceAction['actionId'],
): PieceStateChangeResult {
  const context = resolvePieceStateContext(currentState, pieceId)

  if (!context.ok) {
    return context
  }

  if (context.value.state.flags.includes(LOCKED_PIECE_FLAG)) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Piece ${pieceId} is already locked.`,
    }
  }

  return {
    ok: true,
    pieceStates: upsertGamePieceStatusState(currentState, {
      ...context.value.state,
      flags: [...context.value.state.flags, LOCKED_PIECE_FLAG],
    }),
    event: createPieceStateEvent(
      transitionId,
      sequence,
      'piece.locked',
      origin,
      pieceId,
      context.value.zone.zoneId,
      sourceActionId,
    ),
  }
}

export function applyUnlockPieceStateChange(
  currentState: GameState,
  pieceId: GamePieceState['pieceId'],
  transitionId: TransitionId,
  sequence: number,
  origin: EventOrigin,
  sourceActionId?: UnlockPieceAction['actionId'],
): PieceStateChangeResult {
  const context = resolvePieceStateContext(currentState, pieceId)

  if (!context.ok) {
    return context
  }

  if (!context.value.state.flags.includes(LOCKED_PIECE_FLAG)) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Piece ${pieceId} is not locked.`,
    }
  }

  return {
    ok: true,
    pieceStates: upsertGamePieceStatusState(currentState, {
      ...context.value.state,
      flags: context.value.state.flags.filter(
        (flag) => flag !== LOCKED_PIECE_FLAG,
      ),
    }),
    event: createPieceStateEvent(
      transitionId,
      sequence,
      'piece.unlocked',
      origin,
      pieceId,
      context.value.zone.zoneId,
      sourceActionId,
    ),
  }
}

function applyPieceStateTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action:
    | RestPieceAction
    | StandPieceAction
    | LockPieceAction
    | UnlockPieceAction,
  result: PieceStateChangeResult,
): TransitionResult {
  if (currentState.status !== 'in_progress') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires the match to be in progress.`,
    )
  }

  if (!result.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      result.code,
      result.message,
    )
  }

  const nextState = advanceGameStateRevision({
    ...currentState,
    pieceStates: result.pieceStates,
  })

  return createTransitionResult(transitionId, nextState, [result.event])
}

function resolvePieceStateContext(
  currentState: GameState,
  pieceId: GamePieceState['pieceId'],
):
  | {
      readonly ok: true
      readonly value: PieceStateContext
    }
  | FailedPieceStateChange {
  const piece = currentState.pieces.find(
    (candidate) => candidate.pieceId === pieceId,
  )

  if (piece === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Piece ${pieceId} does not exist in the current game state.`,
    }
  }

  const zone = currentState.zones.find((candidate) =>
    candidate.occupants.some((occupant) => occupant.pieceId === pieceId),
  )

  if (zone === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Piece ${pieceId} is not currently located in a gameplay zone.`,
    }
  }

  if (zone.kind !== 'vanguard_circle' && zone.kind !== 'rear_guard_circle') {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Piece ${pieceId} must be on a vanguard or rear-guard circle to change board-state flags under the current foundation.`,
    }
  }

  return {
    ok: true,
    value: {
      piece,
      zone,
      state: resolveGamePieceStatusState(currentState, pieceId),
    },
  }
}

function upsertGamePieceStatusState(
  currentState: GameState,
  nextPieceState: GamePieceStatusState,
): readonly GamePieceStatusState[] {
  const normalizedState = normalizeGamePieceStatusState(nextPieceState)
  const existingIndex = currentState.pieceStates.findIndex(
    (pieceState) => pieceState.pieceId === nextPieceState.pieceId,
  )

  if (normalizedState === undefined) {
    return existingIndex === -1
      ? currentState.pieceStates
      : currentState.pieceStates.filter(
          (pieceState) => pieceState.pieceId !== nextPieceState.pieceId,
        )
  }

  if (existingIndex === -1) {
    return [...currentState.pieceStates, normalizedState]
  }

  return currentState.pieceStates.map((pieceState) =>
    pieceState.pieceId === normalizedState.pieceId
      ? normalizedState
      : pieceState,
  )
}

function normalizeGamePieceStatusState(
  pieceState: GamePieceStatusState,
): GamePieceStatusState | undefined {
  const nextFlags = Array.from(new Set(pieceState.flags))

  if (
    pieceState.orientation === DEFAULT_GAME_PIECE_ORIENTATION &&
    nextFlags.length === 0
  ) {
    return undefined
  }

  return {
    ...pieceState,
    flags: nextFlags,
  }
}

function createPieceStateEvent(
  transitionId: TransitionId,
  sequence: number,
  type: PieceStateEventType,
  origin: EventOrigin,
  pieceId: GamePieceState['pieceId'],
  zoneId: ZoneState['zoneId'],
  sourceActionId?: RestPieceAction['actionId'],
): Extract<GameEvent, { readonly type: PieceStateEventType }> {
  return {
    eventId: createEventId(transitionId, sequence),
    type,
    sequence,
    ...(sourceActionId === undefined
      ? {}
      : {
          sourceActionId,
        }),
    origin,
    pieceId,
    zoneId,
  } as Extract<GameEvent, { readonly type: PieceStateEventType }>
}

function createActionEventOrigin(
  action:
    | RestPieceAction
    | StandPieceAction
    | LockPieceAction
    | UnlockPieceAction,
): EventOrigin {
  return {
    kind: 'system',
    system: action.actor.system,
  }
}

function createEventId(transitionId: TransitionId, sequence: number): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}
