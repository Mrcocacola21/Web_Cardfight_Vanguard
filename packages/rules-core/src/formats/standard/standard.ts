import type { FormatId } from '@web-vg/shared'

import type {
  CallCardAction,
  GameActionSubmission,
  GameActionType,
  RideCardAction,
} from '../../actions'
import type { EngineCommand, EngineDispatchResult } from '../../boundary'
import type { EventId, TransitionId } from '../../contracts'
import { RulesInvariantError } from '../../errors'
import type { GameEvent } from '../../events'
import type { GameState, PlayerState, ZoneState } from '../../state'
import {
  advanceGameStateRevision,
  assertActionSubmissionRevision,
  createBlockedTransitionResult,
  createInvalidTransitionResult,
  createTransitionResult,
  type TransitionResult,
} from '../../transitions'
import { relocatePieceBetweenZones } from '../../transitions/zone-relocation'

import {
  createRulesFormatAdapter,
  type FormatCommandContext,
  type FormatCommandDecision,
} from '../adapter'

export const STANDARD_FORMAT_ID = 'standard' as FormatId

export const STANDARD_ZONE_KINDS = {
  rideDeck: 'ride_deck',
  vanguardCircle: 'vanguard_circle',
  soul: 'soul',
} as const

export type StandardZoneKind =
  (typeof STANDARD_ZONE_KINDS)[keyof typeof STANDARD_ZONE_KINDS]

export const STANDARD_FORMAT_ACTION_TYPES = [
  'match.ready',
  'match.start',
  'match.concede',
  'system.advance_phase',
  'zone.move_piece',
  'card.call',
  'card.ride',
] as const satisfies readonly GameActionType[]

export const standardFormatAdapter = createRulesFormatAdapter({
  formatId: STANDARD_FORMAT_ID,
  supportedActionTypes: STANDARD_FORMAT_ACTION_TYPES,
  evaluateCommand: evaluateStandardCommand,
  handleCommand(context) {
    if (context.command.kind !== 'action') {
      return undefined
    }

    const action = context.command.submission.action

    if (action.type !== 'card.ride') {
      return undefined
    }

    return applyStandardRideTransition(context.currentState, {
      ...context.command.submission,
      action,
    })
  },
})

export function dispatchStandardCommand(
  currentState: GameState,
  command: EngineCommand,
): EngineDispatchResult {
  return standardFormatAdapter.dispatch(currentState, command)
}

function evaluateStandardCommand(
  context: FormatCommandContext,
): FormatCommandDecision {
  if (context.command.kind !== 'action') {
    return { status: 'allow' }
  }

  switch (context.command.submission.action.type) {
    case 'card.call':
      return evaluateStandardCallAction(
        context.currentState,
        context.command.submission.action,
      )
    default:
      return { status: 'allow' }
  }
}

function evaluateStandardCallAction(
  currentState: GameState,
  action: CallCardAction,
): FormatCommandDecision {
  const sourceZone = currentState.zones.find(
    (zone) => zone.zoneId === action.from.zoneId,
  )
  const destinationZone = currentState.zones.find(
    (zone) => zone.zoneId === action.to.zoneId,
  )

  if (
    sourceZone?.kind === STANDARD_ZONE_KINDS.rideDeck ||
    destinationZone?.kind === STANDARD_ZONE_KINDS.rideDeck
  ) {
    return {
      status: 'invalid',
      code: 'format_rule_violation',
      message: `Standard adapter does not allow ${action.type} to move cards into or out of the ride deck.`,
    }
  }

  return { status: 'allow' }
}

function applyStandardRideTransition(
  currentState: GameState,
  submission: GameActionSubmission<RideCardAction>,
): TransitionResult {
  const action = submission.action
  const transitionId = createStandardTransitionId(
    action.actionId,
    currentState.revision,
  )

  if (
    !isRevisionCompatible(() =>
      assertActionSubmissionRevision(submission, currentState),
    )
  ) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'revision_mismatch',
      `Action submission revision ${submission.expectedRevision} does not match game state revision ${currentState.revision}.`,
    )
  }

  const blockingRequest = currentState.pendingRequests[0]

  if (blockingRequest !== undefined) {
    return createBlockedTransitionResult(
      transitionId,
      currentState,
      currentState.pendingRequests,
      `Game state is waiting for request ${blockingRequest.requestId} before action ${action.type} can be applied.`,
    )
  }

  if (currentState.status !== 'in_progress') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires the match to be in progress.`,
    )
  }

  const actingPlayer = currentState.players.find(
    (player) => player.playerId === action.actor.playerId,
  )

  if (actingPlayer === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} references an unknown player ${action.actor.playerId}.`,
    )
  }

  const piece = currentState.pieces.find(
    (candidate) => candidate.pieceId === action.pieceId,
  )

  if (piece === undefined || piece.kind !== 'card') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} requires a runtime card piece ${action.pieceId}.`,
    )
  }

  const rideDeckZone = findOwnedZone(
    currentState,
    actingPlayer,
    STANDARD_ZONE_KINDS.rideDeck,
    action.from.zoneId,
  )

  if (rideDeckZone === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'format_rule_violation',
      `Standard ride actions require a ride deck zone owned by player ${actingPlayer.playerId}.`,
    )
  }

  const vanguardZone = findOwnedZone(
    currentState,
    actingPlayer,
    STANDARD_ZONE_KINDS.vanguardCircle,
    action.to.zoneId,
  )

  if (vanguardZone === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'format_rule_violation',
      `Standard ride actions require a vanguard circle zone owned by player ${actingPlayer.playerId}.`,
    )
  }

  const soulZone = currentState.zones.find(
    (zone) =>
      zone.ownerPlayerId === actingPlayer.playerId &&
      zone.kind === STANDARD_ZONE_KINDS.soul,
  )

  if (soulZone === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'format_rule_violation',
      `Standard ride actions require a soul zone owned by player ${actingPlayer.playerId}.`,
    )
  }

  const currentVanguard = vanguardZone.occupants[0]

  if (currentVanguard === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Standard ride action ${action.type} requires an existing vanguard to ride over.`,
    )
  }

  if (
    action.ridingOverPieceId !== undefined &&
    action.ridingOverPieceId !== currentVanguard.pieceId
  ) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Ride target ${action.ridingOverPieceId} does not match the current vanguard ${currentVanguard.pieceId}.`,
    )
  }

  const movePreviousVanguard = relocatePieceBetweenZones(
    currentState,
    currentVanguard.pieceId,
    {
      zoneId: vanguardZone.zoneId,
    },
    {
      zoneId: soulZone.zoneId,
    },
  )

  if (!movePreviousVanguard.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      movePreviousVanguard.code,
      movePreviousVanguard.message,
    )
  }

  const stateAfterSoulMove: GameState = {
    ...currentState,
    zones: movePreviousVanguard.zones,
  }
  const rideRelocation = relocatePieceBetweenZones(
    stateAfterSoulMove,
    action.pieceId,
    action.from,
    action.to,
  )

  if (!rideRelocation.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      rideRelocation.code,
      rideRelocation.message,
    )
  }

  const nextState = advanceGameStateRevision({
    ...stateAfterSoulMove,
    zones: rideRelocation.zones,
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
      eventId: createEventId(transitionId, 0),
      type: 'piece.moved',
      sequence: 0,
      sourceActionId: action.actionId,
      origin: {
        kind: 'system',
        system: 'automatic-flow',
      },
      pieceId: currentVanguard.pieceId,
      from: movePreviousVanguard.actualFrom,
      to: movePreviousVanguard.actualTo,
    },
    {
      eventId: createEventId(transitionId, 1),
      type: 'piece.moved',
      sequence: 1,
      sourceActionId: action.actionId,
      origin: {
        kind: 'player',
        playerId: actingPlayer.playerId,
      },
      pieceId: action.pieceId,
      from: rideRelocation.actualFrom,
      to: rideRelocation.actualTo,
    },
    {
      eventId: createEventId(transitionId, 2),
      type: 'card.rode',
      sequence: 2,
      sourceActionId: action.actionId,
      origin: {
        kind: 'player',
        playerId: actingPlayer.playerId,
      },
      pieceId: action.pieceId,
      from: rideRelocation.actualFrom,
      to: rideRelocation.actualTo,
      ridingOverPieceId: currentVanguard.pieceId,
    },
  ]

  return createTransitionResult(transitionId, nextState, events)
}

function findOwnedZone(
  currentState: GameState,
  player: PlayerState,
  kind: StandardZoneKind,
  zoneId: ZoneState['zoneId'],
): ZoneState | undefined {
  return currentState.zones.find(
    (zone) =>
      zone.zoneId === zoneId &&
      zone.ownerPlayerId === player.playerId &&
      zone.kind === kind,
  )
}

function createStandardTransitionId(
  actionId: RideCardAction['actionId'],
  revision: GameState['revision'],
): TransitionId {
  return `transition:format:standard:action:${actionId}:r${revision}` as TransitionId
}

function createEventId(transitionId: TransitionId, sequence: number): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}

function isRevisionCompatible(check: () => void): boolean {
  try {
    check()
    return true
  } catch (error) {
    if (error instanceof RulesInvariantError) {
      return false
    }

    throw error
  }
}
