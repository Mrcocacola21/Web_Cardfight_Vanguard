import type { CallCardAction, RideCardAction } from '../actions'
import type { EventId, TransitionId } from '../contracts'
import type { GameEvent } from '../events'
import type {
  GamePieceState,
  GameState,
  GameStateIndex,
  PlayerState,
  ZoneState,
} from '../state'
import {
  buildGameStateIndex,
  findOwnedZoneByKind,
  findPieceById,
  findPlayerById,
  findZoneById,
} from '../state'

import {
  advanceGameStateRevision,
  createInvalidTransitionResult,
  createTransitionResult,
  createTransitionTimingWindowTriplet,
  type TransitionResult,
} from './transition'
import {
  resolveNormalCallGradeLegality,
  resolveNormalRideGradeLegality,
} from './vanguard-legality'
import { createPieceMovedEvents, resolveZoneTransfer } from './zone-transfer'

interface PreparedPlayerBoardCardAction<
  TAction extends CallCardAction | RideCardAction,
> {
  readonly action: TAction
  readonly actingPlayer: PlayerState
  readonly piece: GamePieceState & { readonly kind: 'card' }
  readonly sourceZone: ZoneState
  readonly destinationZone: ZoneState
  readonly stateIndex: GameStateIndex
}

interface PreparePlayerBoardCardActionOptions {
  readonly requiredStatus?: GameState['status']
  readonly sourceKind?: ZoneState['kind']
  readonly sourceLabel?: string
  readonly destinationKind: ZoneState['kind']
  readonly destinationLabel: string
}

type PreparedPlayerBoardCardActionResult<
  TAction extends CallCardAction | RideCardAction,
> =
  | {
      readonly ok: true
      readonly value: PreparedPlayerBoardCardAction<TAction>
    }
  | {
      readonly ok: false
      readonly result: TransitionResult
    }

const AUTOMATIC_FLOW_SYSTEM = 'automatic-flow' as const

export function applyRideCardTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: RideCardAction,
): TransitionResult {
  const preparedAction = preparePlayerBoardCardAction(
    transitionId,
    currentState,
    action,
    {
      destinationKind: 'vanguard_circle',
      destinationLabel: 'vanguard circle',
    },
  )

  if (!preparedAction.ok) {
    return preparedAction.result
  }

  const { actingPlayer, destinationZone, piece, stateIndex } =
    preparedAction.value
  const soulZone = findOwnedZoneByKind(stateIndex, actingPlayer, 'soul')

  if (soulZone === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} requires a soul zone owned by player ${actingPlayer.playerId}.`,
    )
  }

  const displacedOccupant = destinationZone.occupants[0]

  if (
    action.ridingOverPieceId !== undefined &&
    displacedOccupant?.pieceId !== action.ridingOverPieceId
  ) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Ride target ${action.ridingOverPieceId} does not match the current vanguard piece ${displacedOccupant?.pieceId ?? 'none'}.`,
    )
  }

  const gradeLegality = resolveNormalRideGradeLegality({
    currentState,
    actionType: action.type,
    actingPlayer,
    ridingPiece: piece,
    ...(displacedOccupant === undefined
      ? {}
      : { currentVanguardPieceId: displacedOccupant.pieceId }),
  })

  if (!gradeLegality.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      gradeLegality.code,
      gradeLegality.message,
    )
  }

  let workingState = currentState
  const events: GameEvent[] = []

  if (displacedOccupant !== undefined) {
    const displacedRelocation = resolveZoneTransfer(currentState, {
      pieceId: displacedOccupant.pieceId,
      from: {
        zoneId: destinationZone.zoneId,
      },
      to: {
        zoneId: soulZone.zoneId,
      },
      reason: 'ride_displacement',
    })

    if (!displacedRelocation.ok) {
      return createInvalidTransitionResult(
        transitionId,
        currentState,
        displacedRelocation.code,
        displacedRelocation.message,
      )
    }

    workingState = {
      ...currentState,
      zones: displacedRelocation.zones,
      pieceStates: displacedRelocation.pieceStates,
    }
    events.push(
      ...createPieceMovedEvents(
        transitionId,
        [displacedRelocation.transfer],
        {
          kind: 'system',
          system: AUTOMATIC_FLOW_SYSTEM,
        },
        {
          sourceActionId: action.actionId,
          startingSequence: events.length,
        },
      ),
    )
  }

  const primaryRelocation = resolveZoneTransfer(workingState, {
    pieceId: action.pieceId,
    from: action.from,
    to: action.to,
    reason: 'ride',
  })

  if (!primaryRelocation.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      primaryRelocation.code,
      primaryRelocation.message,
    )
  }

  const nextState = advanceGameStateRevision({
    ...workingState,
    zones: primaryRelocation.zones,
    pieceStates: primaryRelocation.pieceStates,
    pieces: currentState.pieces.map((candidate) =>
      candidate.pieceId === action.pieceId
        ? {
            ...candidate,
            controllerPlayerId: actingPlayer.playerId,
          }
        : candidate,
    ),
  })

  events.push(
    {
      ...createPieceMovedEvents(
        transitionId,
        [primaryRelocation.transfer],
        createPlayerEventOrigin(actingPlayer.playerId),
        {
          sourceActionId: action.actionId,
          startingSequence: events.length,
        },
      )[0]!,
    },
    {
      eventId: createEventId(transitionId, events.length + 1),
      type: 'card.rode',
      sequence: events.length + 1,
      sourceActionId: action.actionId,
      origin: createPlayerEventOrigin(actingPlayer.playerId),
      pieceId: action.pieceId,
      from: primaryRelocation.transfer.from,
      to: primaryRelocation.transfer.to,
      ...(displacedOccupant === undefined
        ? {}
        : {
            ridingOverPieceId: displacedOccupant.pieceId,
          }),
    },
  )

  const cardRodeEvent = events[events.length - 1] as Extract<
    GameEvent,
    { readonly type: 'card.rode' }
  >
  return createTransitionResult(transitionId, nextState, events, {
    timingWindows: createTransitionTimingWindowTriplet('card.ride', {
      relatedEventSequence: cardRodeEvent.sequence,
      pieceId: action.pieceId,
    }),
  })
}

export function applyCallCardTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: CallCardAction,
): TransitionResult {
  const preparedAction = preparePlayerBoardCardAction(
    transitionId,
    currentState,
    action,
    {
      sourceKind: 'hand',
      sourceLabel: 'hand',
      destinationKind: 'rear_guard_circle',
      destinationLabel: 'rear-guard circle',
    },
  )

  if (!preparedAction.ok) {
    return preparedAction.result
  }

  const { actingPlayer, piece } = preparedAction.value
  const gradeLegality = resolveNormalCallGradeLegality({
    currentState,
    actionType: action.type,
    actingPlayer,
    callingPiece: piece,
  })

  if (!gradeLegality.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      gradeLegality.code,
      gradeLegality.message,
    )
  }

  const relocation = resolveZoneTransfer(currentState, {
    pieceId: action.pieceId,
    from: action.from,
    to: action.to,
    reason: 'call',
  })

  if (!relocation.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      relocation.code,
      relocation.message,
    )
  }

  const nextState = advanceGameStateRevision({
    ...currentState,
    zones: relocation.zones,
    pieceStates: relocation.pieceStates,
    pieces: currentState.pieces.map((candidate) =>
      candidate.pieceId === action.pieceId
        ? {
            ...candidate,
            controllerPlayerId: actingPlayer.playerId,
          }
        : candidate,
    ),
  })
  const events: readonly GameEvent[] = [
    {
      ...createPieceMovedEvents(
        transitionId,
        [relocation.transfer],
        createPlayerEventOrigin(actingPlayer.playerId),
        {
          sourceActionId: action.actionId,
        },
      )[0]!,
    },
    {
      eventId: createEventId(transitionId, 1),
      type: 'card.called',
      sequence: 1,
      sourceActionId: action.actionId,
      origin: createPlayerEventOrigin(actingPlayer.playerId),
      pieceId: action.pieceId,
      from: relocation.transfer.from,
      to: relocation.transfer.to,
    },
  ]

  return createTransitionResult(transitionId, nextState, events)
}

function preparePlayerBoardCardAction<
  TAction extends CallCardAction | RideCardAction,
>(
  transitionId: TransitionId,
  currentState: GameState,
  action: TAction,
  options: PreparePlayerBoardCardActionOptions,
): PreparedPlayerBoardCardActionResult<TAction> {
  const requiredStatus = options.requiredStatus ?? 'in_progress'

  if (currentState.status !== requiredStatus) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action',
        `Action ${action.type} requires the match to be in ${requiredStatus} state.`,
      ),
    }
  }

  const stateIndex = buildGameStateIndex(currentState)
  const actingPlayer = findPlayerById(stateIndex, action.actor.playerId)

  if (actingPlayer === undefined) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action_reference',
        `Action ${action.type} references an unknown player ${action.actor.playerId}.`,
      ),
    }
  }

  const piece = findPieceById(stateIndex, action.pieceId)

  if (piece === undefined || piece.kind !== 'card') {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action_reference',
        `Action ${action.type} requires a runtime card piece ${action.pieceId}.`,
      ),
    }
  }

  const sourceZone = findZoneById(stateIndex, action.from.zoneId)

  if (
    sourceZone === undefined ||
    sourceZone.ownerPlayerId !== actingPlayer.playerId
  ) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action_reference',
        `Action ${action.type} cannot use source zone ${action.from.zoneId} for player ${actingPlayer.playerId}.`,
      ),
    }
  }

  if (
    options.sourceKind !== undefined &&
    sourceZone.kind !== options.sourceKind
  ) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action',
        `Action ${action.type} requires a ${options.sourceLabel ?? options.sourceKind} source zone for player ${actingPlayer.playerId}.`,
      ),
    }
  }

  const destinationZone = findZoneById(stateIndex, action.to.zoneId)

  if (
    destinationZone === undefined ||
    destinationZone.ownerPlayerId !== actingPlayer.playerId
  ) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action_reference',
        `Action ${action.type} cannot target zone ${action.to.zoneId} for player ${actingPlayer.playerId}.`,
      ),
    }
  }

  if (destinationZone.kind !== options.destinationKind) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action',
        `Action ${action.type} requires a ${options.destinationLabel} destination zone for player ${actingPlayer.playerId}.`,
      ),
    }
  }

  return {
    ok: true,
    value: {
      action,
      actingPlayer,
      piece: piece as GamePieceState & { readonly kind: 'card' },
      sourceZone,
      destinationZone,
      stateIndex,
    },
  }
}

function createEventId(transitionId: TransitionId, sequence: number): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}

function createPlayerEventOrigin(
  playerId: PlayerState['playerId'],
): Extract<GameEvent['origin'], { readonly kind: 'player' }> {
  return {
    kind: 'player',
    playerId,
  }
}
