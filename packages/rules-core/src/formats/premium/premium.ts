import type { FormatId } from '@web-vg/shared'

import type {
  CallCardAction,
  GameActionSubmission,
  GameActionType,
  MovePieceAction,
  PlayCardAction,
  RideCardAction,
} from '../../actions'
import type { EngineCommand, EngineDispatchResult } from '../../boundary'
import type { GameEvent } from '../../events'
import type { GameState } from '../../state'
import {
  advanceGameStateRevision,
  createTransitionResult,
  type TransitionResult,
} from '../../transitions'

import {
  createRulesFormatAdapter,
  type FormatCommandContext,
  type FormatCommandDecision,
} from '../adapter'
import { createFormatEventId } from '../helpers'
import {
  findZoneById,
  prepareFormatOverlayCardAction,
  rejectDestinationZoneKinds,
  rejectZoneKindReferences,
} from '../shared'
import { createPieceMovedEvents } from '../../transitions/zone-transfer'

export const PREMIUM_FORMAT_ID = 'premium' as FormatId

export const PREMIUM_FORMAT_GAMEPLAY_MARKERS = [
  'g-zone',
  'stride',
  'imaginary-gift',
  'over-trigger',
] as const

export const PREMIUM_ZONE_KINDS = {
  hand: 'hand',
  rearGuardCircle: 'rear_guard_circle',
  vanguardCircle: 'vanguard_circle',
  soul: 'soul',
  gZone: 'g_zone',
  heart: 'heart',
  imaginaryGift: 'imaginary_gift',
} as const

export type PremiumZoneKind =
  (typeof PREMIUM_ZONE_KINDS)[keyof typeof PREMIUM_ZONE_KINDS]

export const PREMIUM_FORMAT_ACTION_TYPES = [
  'match.ready',
  'match.start',
  'match.concede',
  'match.timeout',
  'system.begin_mulligan',
  'system.drive_check',
  'system.resolve_combat',
  'system.damage_check',
  'piece.rest',
  'piece.stand',
  'piece.lock',
  'piece.unlock',
  'turn.end_phase',
  'turn.end_turn',
  'system.advance_phase',
  'system.resolve_mandatory_flow',
  'zone.shuffle',
  'zone.draw',
  'zone.move_piece',
  'card.call',
  'card.ride',
  'card.play',
  'battle.declare_attack',
  'battle.commit_boost',
  'battle.guard',
] as const satisfies readonly GameActionType[]

export const premiumFormatAdapter = createRulesFormatAdapter({
  formatId: PREMIUM_FORMAT_ID,
  constructionBasis: 'clan-based',
  gameplayMarkers: PREMIUM_FORMAT_GAMEPLAY_MARKERS,
  supportedActionTypes: PREMIUM_FORMAT_ACTION_TYPES,
  evaluateCommand: evaluatePremiumCommand,
  handleCommand(context) {
    if (context.command.kind !== 'action') {
      return undefined
    }

    const action = context.command.submission.action

    if (action.type !== 'card.play') {
      return undefined
    }

    return applyPremiumStridePlayTransition(context.currentState, {
      ...context.command.submission,
      action,
    })
  },
})

export function dispatchPremiumCommand(
  currentState: GameState,
  command: EngineCommand,
): EngineDispatchResult {
  return premiumFormatAdapter.dispatch(currentState, command)
}

function evaluatePremiumCommand(
  context: FormatCommandContext,
): FormatCommandDecision {
  if (context.command.kind !== 'action') {
    return { status: 'allow' }
  }

  switch (context.command.submission.action.type) {
    case 'zone.move_piece':
      return (
        evaluatePremiumGenericZoneGuard(
          context.currentState,
          context.command.submission.action,
        ) ?? { status: 'allow' }
      )
    case 'card.call': {
      const structuralDecision = evaluatePremiumGenericZoneGuard(
        context.currentState,
        context.command.submission.action,
      )

      if (structuralDecision !== undefined) {
        return structuralDecision
      }

      return evaluatePremiumCallAction(
        context.currentState,
        context.command.submission.action,
      )
    }
    case 'card.ride': {
      const rideZoneGuard = rejectZoneKindReferences(
        context.currentState,
        context.command.submission.action,
        {
          rejectedZoneKinds: ['ride_deck'],
          message: () =>
            'Premium adapter rejects ride deck zone references because Premium has no baseline ride deck runtime structure.',
        },
      )

      if (rideZoneGuard !== undefined) {
        return rideZoneGuard
      }

      return evaluatePremiumRideAction(
        context.currentState,
        context.command.submission.action,
      )
    }
    case 'card.play':
      return evaluatePremiumPlayAction(
        context.currentState,
        context.command.submission.action,
      )
    default:
      return { status: 'allow' }
  }
}

function evaluatePremiumGenericZoneGuard(
  currentState: GameState,
  action: MovePieceAction | CallCardAction,
): FormatCommandDecision | undefined {
  const rideDeckDecision = rejectZoneKindReferences(currentState, action, {
    rejectedZoneKinds: ['ride_deck'],
    message: () =>
      'Premium adapter rejects ride deck zone references because Premium has no baseline ride deck runtime structure.',
  })

  if (rideDeckDecision !== undefined) {
    return rideDeckDecision
  }

  return rejectZoneKindReferences(currentState, action, {
    rejectedZoneKinds: [
      PREMIUM_ZONE_KINDS.gZone,
      PREMIUM_ZONE_KINDS.heart,
      PREMIUM_ZONE_KINDS.imaginaryGift,
    ],
    message: ({ action: rejectedAction, matchedZone }) =>
      `Premium adapter reserves zone kind ${matchedZone.kind} for Premium-specific transitions instead of generic ${rejectedAction.type} movement.`,
  })
}

function evaluatePremiumCallAction(
  currentState: GameState,
  action: CallCardAction,
): FormatCommandDecision {
  return (
    rejectDestinationZoneKinds(currentState, action, {
      rejectedZoneKinds: [PREMIUM_ZONE_KINDS.imaginaryGift],
      message: ({ action: rejectedAction }) =>
        `Premium adapter does not allow ${rejectedAction.type} to place runtime card pieces into the imaginary gift zone.`,
    }) ?? { status: 'allow' }
  )
}

function evaluatePremiumRideAction(
  currentState: GameState,
  action: RideCardAction,
): FormatCommandDecision {
  const sourceZone = findZoneById(currentState, action.from.zoneId)

  if (sourceZone?.kind !== PREMIUM_ZONE_KINDS.hand) {
    return {
      status: 'invalid',
      code: 'format_rule_violation',
      message:
        'Premium adapter currently requires card.ride to originate from hand.',
    }
  }

  return { status: 'allow' }
}

function evaluatePremiumPlayAction(
  currentState: GameState,
  action: PlayCardAction,
): FormatCommandDecision {
  const sourceZone = findZoneById(currentState, action.from.zoneId)
  const destinationZone = findZoneById(currentState, action.to.zoneId)
  const rideDeckDecision = rejectZoneKindReferences(currentState, action, {
    rejectedZoneKinds: ['ride_deck'],
    message: () =>
      'Premium adapter rejects ride deck zone references because Premium has no baseline ride deck runtime structure.',
  })

  if (rideDeckDecision !== undefined) {
    return rideDeckDecision
  }

  if (sourceZone?.kind !== PREMIUM_ZONE_KINDS.gZone) {
    return {
      status: 'invalid',
      code: 'format_rule_violation',
      message:
        'Premium adapter currently interprets card.play only as a G zone stride-like play foundation.',
    }
  }

  if (destinationZone?.kind !== PREMIUM_ZONE_KINDS.vanguardCircle) {
    return {
      status: 'invalid',
      code: 'format_rule_violation',
      message:
        'Premium adapter requires card.play to target the acting player vanguard circle when using the stride-like foundation.',
    }
  }

  return { status: 'allow' }
}

function applyPremiumStridePlayTransition(
  currentState: GameState,
  submission: GameActionSubmission<PlayCardAction>,
): TransitionResult {
  const overlayAction = prepareFormatOverlayCardAction({
    formatId: PREMIUM_FORMAT_ID,
    formatLabel: 'Premium',
    currentState,
    submission,
    sourceKind: PREMIUM_ZONE_KINDS.gZone,
    sourceLabel: 'G zone',
    destinationKind: PREMIUM_ZONE_KINDS.vanguardCircle,
    destinationLabel: 'vanguard circle',
    displacedZoneKind: PREMIUM_ZONE_KINDS.heart,
    displacedLabel: 'heart zone',
    displacedZoneMustBeEmpty: true,
  })

  if (!overlayAction.ok) {
    return overlayAction.result
  }

  const {
    transitionId,
    action,
    actingPlayer,
    displacedRelocation,
    stateAfterDisplacedMove,
    primaryRelocation,
  } = overlayAction.value

  const nextState = advanceGameStateRevision({
    ...stateAfterDisplacedMove,
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
  const events: readonly GameEvent[] = [
    ...createPieceMovedEvents(
      transitionId,
      [displacedRelocation.transfer],
      {
        kind: 'system',
        system: 'automatic-flow',
      },
      {
        sourceActionId: action.actionId,
      },
    ),
    ...createPieceMovedEvents(
      transitionId,
      [primaryRelocation.transfer],
      {
        kind: 'player',
        playerId: actingPlayer.playerId,
      },
      {
        sourceActionId: action.actionId,
        startingSequence: 1,
      },
    ),
    {
      eventId: createFormatEventId(transitionId, 2),
      type: 'card.played',
      sequence: 2,
      sourceActionId: action.actionId,
      origin: {
        kind: 'player',
        playerId: actingPlayer.playerId,
      },
      pieceId: action.pieceId,
      from: primaryRelocation.transfer.from,
      to: primaryRelocation.transfer.to,
    },
  ]

  return createTransitionResult(transitionId, nextState, events)
}
