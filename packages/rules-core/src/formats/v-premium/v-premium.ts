import type { FormatId } from '@web-vg/shared'

import type {
  CallCardAction,
  GameActionSubmission,
  GameActionType,
  MovePieceAction,
  RideCardAction,
} from '../../actions'
import type { EngineCommand, EngineDispatchResult } from '../../boundary'
import type { RequestId, TransitionId } from '../../contracts'
import type { GameChoiceRequest, ZoneChoiceOption } from '../../requests'
import type { GameState, ZoneState } from '../../state'
import {
  applyGameAction,
  createInvalidTransitionResult,
  createTransitionResult,
  isAppliedTransitionResult,
  type TransitionResult,
} from '../../transitions'

import {
  createRulesFormatAdapter,
  type FormatCommandContext,
  type FormatCommandDecision,
} from '../adapter'
import {
  findZoneById,
  rejectDestinationZoneKinds,
  rejectZoneKindReferences,
} from '../shared'

export const V_PREMIUM_FORMAT_ID = 'v-premium' as FormatId

export const V_PREMIUM_FORMAT_GAMEPLAY_MARKERS = [
  'imaginary-gift',
  'over-trigger',
] as const

export const V_PREMIUM_ZONE_KINDS = {
  hand: 'hand',
  vanguardCircle: 'vanguard_circle',
  soul: 'soul',
  imaginaryGift: 'imaginary_gift',
} as const

export type VPremiumZoneKind =
  (typeof V_PREMIUM_ZONE_KINDS)[keyof typeof V_PREMIUM_ZONE_KINDS]

export const V_PREMIUM_FORMAT_ACTION_TYPES = [
  'match.ready',
  'match.start',
  'match.concede',
  'system.begin_mulligan',
  'system.drive_check',
  'system.damage_check',
  'piece.rest',
  'piece.stand',
  'piece.lock',
  'piece.unlock',
  'system.advance_phase',
  'system.resolve_mandatory_flow',
  'zone.shuffle',
  'zone.draw',
  'zone.move_piece',
  'card.call',
  'card.ride',
  'battle.declare_attack',
  'battle.commit_boost',
  'battle.guard',
] as const satisfies readonly GameActionType[]

export const vPremiumFormatAdapter = createRulesFormatAdapter({
  formatId: V_PREMIUM_FORMAT_ID,
  constructionBasis: 'clan-based',
  gameplayMarkers: V_PREMIUM_FORMAT_GAMEPLAY_MARKERS,
  supportedActionTypes: V_PREMIUM_FORMAT_ACTION_TYPES,
  evaluateCommand: evaluateVPremiumCommand,
  handleCommand(context) {
    if (context.command.kind !== 'action') {
      return undefined
    }

    const action = context.command.submission.action

    if (action.type !== 'card.ride') {
      return undefined
    }

    return applyVPremiumRideTransition(context.currentState, {
      ...context.command.submission,
      action,
    })
  },
})

export function dispatchVPremiumCommand(
  currentState: GameState,
  command: EngineCommand,
): EngineDispatchResult {
  return vPremiumFormatAdapter.dispatch(currentState, command)
}

function evaluateVPremiumCommand(
  context: FormatCommandContext,
): FormatCommandDecision {
  if (context.command.kind !== 'action') {
    return { status: 'allow' }
  }

  switch (context.command.submission.action.type) {
    case 'zone.move_piece':
    case 'card.call':
    case 'card.ride': {
      const rideDeckDecision = evaluateRideDeckReferenceGuard(
        context.currentState,
        context.command.submission.action,
      )

      if (rideDeckDecision !== undefined) {
        return rideDeckDecision
      }

      if (context.command.submission.action.type === 'card.call') {
        return evaluateVPremiumCallAction(
          context.currentState,
          context.command.submission.action,
        )
      }

      if (context.command.submission.action.type === 'card.ride') {
        return evaluateVPremiumRideAction(
          context.currentState,
          context.command.submission.action,
        )
      }

      return { status: 'allow' }
    }
    default:
      return { status: 'allow' }
  }
}

function evaluateRideDeckReferenceGuard(
  currentState: GameState,
  action: MovePieceAction | CallCardAction | RideCardAction,
): FormatCommandDecision | undefined {
  return rejectZoneKindReferences(currentState, action, {
    rejectedZoneKinds: ['ride_deck'],
    message: () =>
      'V Premium adapter rejects ride deck zone references because the format has no baseline ride deck.',
  })
}

function evaluateVPremiumCallAction(
  currentState: GameState,
  action: CallCardAction,
): FormatCommandDecision {
  return (
    rejectDestinationZoneKinds(currentState, action, {
      rejectedZoneKinds: [V_PREMIUM_ZONE_KINDS.imaginaryGift],
      message: ({ action: rejectedAction }) =>
        `V Premium adapter does not allow ${rejectedAction.type} to place runtime card pieces into the imaginary gift zone.`,
    }) ?? { status: 'allow' }
  )
}

function evaluateVPremiumRideAction(
  currentState: GameState,
  action: RideCardAction,
): FormatCommandDecision {
  const sourceZone = findZoneById(currentState, action.from.zoneId)

  if (sourceZone?.kind !== V_PREMIUM_ZONE_KINDS.hand) {
    return {
      status: 'invalid',
      code: 'format_rule_violation',
      message:
        'V Premium adapter currently requires card.ride to originate from hand.',
    }
  }

  return { status: 'allow' }
}

function applyVPremiumRideTransition(
  currentState: GameState,
  submission: GameActionSubmission<RideCardAction>,
): TransitionResult {
  const rideTransition = applyGameAction(currentState, submission)

  if (!isAppliedTransitionResult(rideTransition)) {
    return rideTransition
  }

  const giftRequest = createImaginaryGiftRequest(
    rideTransition.nextState,
    submission.action,
    submission.action.actor.playerId,
    rideTransition.transitionId,
  )

  if ('code' in giftRequest) {
    return createInvalidTransitionResult(
      rideTransition.transitionId,
      currentState,
      giftRequest.code,
      giftRequest.message,
    )
  }

  if (giftRequest.request === undefined) {
    return rideTransition
  }

  const nextState = {
    ...rideTransition.nextState,
    status: 'awaiting_choice' as const,
    pendingRequests: [giftRequest.request],
  }

  return createTransitionResult(
    rideTransition.transitionId,
    nextState,
    rideTransition.events,
  )
}

function createImaginaryGiftRequest(
  currentState: GameState,
  action: RideCardAction,
  responderPlayerId: GameState['players'][number]['playerId'],
  transitionId: TransitionId,
):
  | {
      readonly request: GameChoiceRequest
    }
  | {
      readonly request: undefined
    }
  | {
      readonly code: 'format_rule_violation'
      readonly message: string
    } {
  const giftZone = currentState.zones.find(
    (zone) =>
      zone.ownerPlayerId === responderPlayerId &&
      zone.kind === V_PREMIUM_ZONE_KINDS.imaginaryGift,
  )

  if (giftZone === undefined) {
    return { request: undefined }
  }

  const eligibleZones = resolveImaginaryGiftEligibleZones(giftZone)

  if ('code' in eligibleZones) {
    return eligibleZones
  }

  return {
    request: {
      requestId: `${transitionId}:request:imaginary-gift` as RequestId,
      type: 'choose.zone',
      responderPlayerId,
      purpose: 'effect',
      visibility: 'responder-only',
      minSelections: 1,
      maxSelections: 1,
      eligibleZones,
      context: {
        sourceActionId: action.actionId,
        relatedPieceIds: [action.pieceId],
        relatedZoneIds: [giftZone.zoneId],
      },
    },
  }
}

function resolveImaginaryGiftEligibleZones(giftZone: ZoneState):
  | readonly ZoneChoiceOption[]
  | {
      readonly code: 'format_rule_violation'
      readonly message: string
    } {
  switch (giftZone.layout.occupancy) {
    case 'single':
      if (giftZone.occupants.length > 0) {
        return {
          code: 'format_rule_violation',
          message: `V Premium imaginary gift zone ${giftZone.zoneId} has no open placement capacity.`,
        }
      }
      return [{ zoneId: giftZone.zoneId }]
    case 'multi':
      if (
        giftZone.layout.capacity !== undefined &&
        giftZone.occupants.length >= giftZone.layout.capacity
      ) {
        return {
          code: 'format_rule_violation',
          message: `V Premium imaginary gift zone ${giftZone.zoneId} has reached its declared capacity.`,
        }
      }
      return [{ zoneId: giftZone.zoneId }]
    case 'slotted': {
      const slotIds = giftZone.layout.slotIds ?? []
      const occupiedSlotIds = new Set(
        giftZone.occupants
          .map((occupant) => occupant.slotId)
          .filter(
            (slotId): slotId is NonNullable<typeof slotId> =>
              slotId !== undefined,
          ),
      )
      const availableSlotIds = slotIds.filter(
        (slotId) => !occupiedSlotIds.has(slotId),
      )

      if (availableSlotIds.length === 0) {
        return {
          code: 'format_rule_violation',
          message: `V Premium imaginary gift zone ${giftZone.zoneId} has no open gift slots.`,
        }
      }

      return [
        {
          zoneId: giftZone.zoneId,
          availableSlotIds,
        },
      ]
    }
  }
}
