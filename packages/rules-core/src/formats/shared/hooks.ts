import type { FormatId } from '@web-vg/shared'

import type { GameAction, GameActionSubmission } from '../../actions'
import type { PieceId } from '../../contracts'
import type { ZoneLocationReference } from '../../references'
import type {
  GameState,
  PlayerState,
  ZoneOccupantState,
  ZoneState,
} from '../../state'
import {
  createInvalidTransitionResult,
  type TransitionResult,
} from '../../transitions'
import {
  resolveZoneTransfer,
  type ZoneTransferResult,
} from '../../transitions/zone-transfer'
import type { FormatCommandDecision } from '../adapter'
import { findOwnedZoneByKind, prepareFormatPlayerCardAction } from '../helpers'

type ZoneReferencedAction = Extract<
  GameAction,
  {
    readonly from: ZoneLocationReference
    readonly to: ZoneLocationReference
  }
>

type OverlayCardAction = Extract<
  GameAction,
  {
    readonly actor: {
      readonly kind: 'player'
    }
    readonly pieceId: PieceId
    readonly from: ZoneLocationReference
    readonly to: ZoneLocationReference
  }
>

type SuccessfulZoneTransfer = Extract<ZoneTransferResult, { readonly ok: true }>

export interface ZoneKindReferenceGuardPolicy<
  TAction extends ZoneReferencedAction = ZoneReferencedAction,
> {
  readonly rejectedZoneKinds: readonly ZoneState['kind'][]
  readonly code?: Extract<
    FormatCommandDecision,
    { readonly status: 'invalid' }
  >['code']
  readonly message: (context: {
    readonly action: TAction
    readonly sourceZone?: ZoneState
    readonly destinationZone?: ZoneState
    readonly matchedZone: ZoneState
  }) => string
}

export interface DestinationZoneKindGuardPolicy<
  TAction extends ZoneReferencedAction = ZoneReferencedAction,
> {
  readonly rejectedZoneKinds: readonly ZoneState['kind'][]
  readonly code?: Extract<
    FormatCommandDecision,
    { readonly status: 'invalid' }
  >['code']
  readonly message: (context: {
    readonly action: TAction
    readonly destinationZone: ZoneState
    readonly sourceZone?: ZoneState
  }) => string
}

export interface PrepareFormatOverlayCardActionConfig<
  TAction extends OverlayCardAction,
> {
  readonly formatId: FormatId
  readonly formatLabel: string
  readonly currentState: GameState
  readonly submission: GameActionSubmission<TAction>
  readonly sourceKind: ZoneState['kind']
  readonly sourceLabel: string
  readonly destinationKind: ZoneState['kind']
  readonly destinationLabel: string
  readonly displacedZoneKind: ZoneState['kind']
  readonly displacedLabel: string
  readonly displacedZoneMustBeEmpty?: boolean
  readonly getExpectedDestinationPieceId?: (
    action: TAction,
  ) => PieceId | undefined
}

export interface PreparedFormatOverlayCardAction<
  TAction extends OverlayCardAction,
> {
  readonly transitionId: TransitionResult['transitionId']
  readonly action: TAction
  readonly actingPlayer: PlayerState
  readonly sourceZone: ZoneState
  readonly destinationZone: ZoneState
  readonly displacedZone: ZoneState
  readonly displacedOccupant: ZoneOccupantState
  readonly displacedRelocation: SuccessfulZoneTransfer
  readonly stateAfterDisplacedMove: GameState
  readonly primaryRelocation: SuccessfulZoneTransfer
}

export type PrepareFormatOverlayCardActionResult<
  TAction extends OverlayCardAction,
> =
  | {
      readonly ok: true
      readonly value: PreparedFormatOverlayCardAction<TAction>
    }
  | {
      readonly ok: false
      readonly result: TransitionResult
    }

export function findZoneById(
  currentState: GameState,
  zoneId: ZoneState['zoneId'],
): ZoneState | undefined {
  return currentState.zones.find((zone) => zone.zoneId === zoneId)
}

export function rejectZoneKindReferences<TAction extends ZoneReferencedAction>(
  currentState: GameState,
  action: TAction,
  policy: ZoneKindReferenceGuardPolicy<TAction>,
): FormatCommandDecision | undefined {
  const sourceZone = findZoneById(currentState, action.from.zoneId)
  const destinationZone = findZoneById(currentState, action.to.zoneId)
  const matchedZone =
    (sourceZone !== undefined &&
    policy.rejectedZoneKinds.includes(sourceZone.kind)
      ? sourceZone
      : undefined) ??
    (destinationZone !== undefined &&
    policy.rejectedZoneKinds.includes(destinationZone.kind)
      ? destinationZone
      : undefined)

  if (matchedZone === undefined) {
    return undefined
  }

  return {
    status: 'invalid',
    code: policy.code ?? 'format_rule_violation',
    message: policy.message({
      action,
      matchedZone,
      ...(sourceZone === undefined ? {} : { sourceZone }),
      ...(destinationZone === undefined ? {} : { destinationZone }),
    }),
  }
}

export function rejectDestinationZoneKinds<
  TAction extends ZoneReferencedAction,
>(
  currentState: GameState,
  action: TAction,
  policy: DestinationZoneKindGuardPolicy<TAction>,
): FormatCommandDecision | undefined {
  const sourceZone = findZoneById(currentState, action.from.zoneId)
  const destinationZone = findZoneById(currentState, action.to.zoneId)

  if (
    destinationZone === undefined ||
    !policy.rejectedZoneKinds.includes(destinationZone.kind)
  ) {
    return undefined
  }

  return {
    status: 'invalid',
    code: policy.code ?? 'format_rule_violation',
    message: policy.message({
      action,
      destinationZone,
      ...(sourceZone === undefined ? {} : { sourceZone }),
    }),
  }
}

export function prepareFormatOverlayCardAction<
  TAction extends OverlayCardAction,
>(
  config: PrepareFormatOverlayCardActionConfig<TAction>,
): PrepareFormatOverlayCardActionResult<TAction> {
  const preparedAction = prepareFormatPlayerCardAction(
    config.formatId,
    config.currentState,
    config.submission,
  )

  if (!preparedAction.ok) {
    return preparedAction
  }

  const { action, actingPlayer, transitionId } = preparedAction.value
  const sourceZone = findOwnedZoneByKind(
    config.currentState,
    actingPlayer,
    config.sourceKind,
    action.from.zoneId,
  )

  if (sourceZone === undefined) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        config.currentState,
        'format_rule_violation',
        `${config.formatLabel} ${action.type} requires a ${config.sourceLabel} zone owned by player ${actingPlayer.playerId}.`,
      ),
    }
  }

  const destinationZone = findOwnedZoneByKind(
    config.currentState,
    actingPlayer,
    config.destinationKind,
    action.to.zoneId,
  )

  if (destinationZone === undefined) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        config.currentState,
        'format_rule_violation',
        `${config.formatLabel} ${action.type} requires a ${config.destinationLabel} zone owned by player ${actingPlayer.playerId}.`,
      ),
    }
  }

  const displacedZone = findOwnedZoneByKind(
    config.currentState,
    actingPlayer,
    config.displacedZoneKind,
  )

  if (displacedZone === undefined) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        config.currentState,
        'format_rule_violation',
        `${config.formatLabel} ${action.type} requires a ${config.displacedLabel} zone owned by player ${actingPlayer.playerId}.`,
      ),
    }
  }

  if (
    config.displacedZoneMustBeEmpty === true &&
    displacedZone.occupants.length > 0
  ) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        config.currentState,
        'format_rule_violation',
        `${config.formatLabel} ${config.displacedLabel} ${displacedZone.zoneId} must be empty before ${action.type} can resolve.`,
      ),
    }
  }

  const displacedOccupant = destinationZone.occupants[0]

  if (displacedOccupant === undefined) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        config.currentState,
        'invalid_action',
        `${config.formatLabel} ${action.type} requires an existing ${config.destinationLabel} piece to move into ${config.displacedLabel}.`,
      ),
    }
  }

  const expectedDestinationPieceId =
    config.getExpectedDestinationPieceId?.(action)

  if (
    expectedDestinationPieceId !== undefined &&
    expectedDestinationPieceId !== displacedOccupant.pieceId
  ) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        config.currentState,
        'invalid_action_reference',
        `Overlay target ${expectedDestinationPieceId} does not match the current ${config.destinationLabel} piece ${displacedOccupant.pieceId}.`,
      ),
    }
  }

  const displacedRelocation = resolveZoneTransfer(config.currentState, {
    pieceId: displacedOccupant.pieceId,
    from: {
      zoneId: destinationZone.zoneId,
    },
    to: {
      zoneId: displacedZone.zoneId,
    },
    reason: 'format',
  })

  if (!displacedRelocation.ok) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        config.currentState,
        displacedRelocation.code,
        displacedRelocation.message,
      ),
    }
  }

  const stateAfterDisplacedMove: GameState = {
    ...config.currentState,
    zones: displacedRelocation.zones,
    pieceStates: displacedRelocation.pieceStates,
  }
  const primaryRelocation = resolveZoneTransfer(stateAfterDisplacedMove, {
    pieceId: action.pieceId,
    from: action.from,
    to: action.to,
    reason: 'format',
  })

  if (!primaryRelocation.ok) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        config.currentState,
        primaryRelocation.code,
        primaryRelocation.message,
      ),
    }
  }

  return {
    ok: true,
    value: {
      transitionId,
      action,
      actingPlayer,
      sourceZone,
      destinationZone,
      displacedZone,
      displacedOccupant,
      displacedRelocation,
      stateAfterDisplacedMove,
      primaryRelocation,
    },
  }
}
