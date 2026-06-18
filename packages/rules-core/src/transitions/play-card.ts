import type { PlayCardAction } from '../actions'
import type { EventId, TransitionId } from '../contracts'
import type { GameEvent } from '../events'
import type { GameState } from '../state'
import {
  buildGameStateIndex,
  findPieceById,
  findPlayerById,
  findZoneById,
} from '../state'
import { isOrderCardStats, resolveGamePieceCardStats } from '../cards'

import {
  advanceGameStateRevision,
  createInvalidTransitionResult,
  createTransitionResult,
  createTransitionTimingWindowTriplet,
  type TransitionResult,
} from './transition'
import { createPieceMovedEvents, resolveZoneTransfer } from './zone-transfer'

export function applyPlayCardTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: PlayCardAction,
): TransitionResult {
  if (currentState.status !== 'in_progress') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires the match to be in progress.`,
    )
  }

  const stateIndex = buildGameStateIndex(currentState)
  const actingPlayer = findPlayerById(stateIndex, action.actor.playerId)
  const piece = findPieceById(stateIndex, action.pieceId)
  const sourceZone = findZoneById(stateIndex, action.from.zoneId)
  const destinationZone = findZoneById(stateIndex, action.to.zoneId)

  if (actingPlayer === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} references an unknown player ${action.actor.playerId}.`,
    )
  }

  if (piece === undefined || piece.kind !== 'card') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} requires a runtime card piece ${action.pieceId}.`,
    )
  }

  if (piece.ownerPlayerId !== actingPlayer.playerId) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} can only play cards owned by player ${actingPlayer.playerId}.`,
    )
  }

  if (
    sourceZone === undefined ||
    sourceZone.ownerPlayerId !== actingPlayer.playerId
  ) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} cannot use source zone ${action.from.zoneId} for player ${actingPlayer.playerId}.`,
    )
  }

  if (
    destinationZone === undefined ||
    destinationZone.ownerPlayerId !== actingPlayer.playerId
  ) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} cannot target zone ${action.to.zoneId} for player ${actingPlayer.playerId}.`,
    )
  }

  const stats = resolveGamePieceCardStats(currentState, piece)

  if (!stats.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      stats.issue.code,
      stats.issue.message,
    )
  }

  if (!isOrderCardStats(stats.stats)) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} can only play order cards through the current Standard order foundation.`,
    )
  }

  const destinationKinds =
    stats.stats.cardType === 'set-order'
      ? ['order_zone']
      : ['drop', 'order_zone']

  if (!destinationKinds.includes(destinationZone.kind)) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} cannot move ${stats.stats.cardType} to ${destinationZone.kind}.`,
    )
  }

  const relocation = resolveZoneTransfer(currentState, {
    pieceId: action.pieceId,
    from: action.from,
    to: action.to,
    reason: 'play',
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
  })
  const movedEvent = createPieceMovedEvents(
    transitionId,
    [relocation.transfer],
    {
      kind: 'player',
      playerId: actingPlayer.playerId,
    },
    {
      sourceActionId: action.actionId,
    },
  )[0]!
  const playedEvent: Extract<GameEvent, { readonly type: 'card.played' }> = {
    eventId: createEventId(transitionId, 1),
    type: 'card.played',
    sequence: 1,
    sourceActionId: action.actionId,
    origin: {
      kind: 'player',
      playerId: actingPlayer.playerId,
    },
    pieceId: action.pieceId,
    from: relocation.transfer.from,
    to: relocation.transfer.to,
  }

  return createTransitionResult(
    transitionId,
    nextState,
    [movedEvent, playedEvent],
    {
      timingWindows: createTransitionTimingWindowTriplet('card.play', {
        relatedEventSequence: playedEvent.sequence,
        pieceId: action.pieceId,
      }),
    },
  )
}

function createEventId(transitionId: TransitionId, sequence: number): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}
