import type { GamePieceFlagKey, GamePieceStatusState, ZoneKind } from '../state'

import type { ZoneTransferReason } from './transfer'

export type ZoneTransferFlagLifecycleDisposition = 'preserve' | 'reset'
export type ZoneTransferOrientationPolicy = 'preserve' | 'stand'
export type ZoneTransferFlagPolicy = 'preserve' | 'clear'

export interface ZoneTransferFlagLifecycleContext {
  readonly sourceZoneKind: ZoneKind
  readonly destinationZoneKind: ZoneKind
  readonly reason: ZoneTransferReason
}

export interface ZoneTransferFlagLifecycleDecision {
  readonly disposition: ZoneTransferFlagLifecycleDisposition
  readonly orientation: ZoneTransferOrientationPolicy
  readonly flags: ZoneTransferFlagPolicy
  readonly rationale:
    | 'main_unit_circle_to_main_unit_circle'
    | 'entered_or_left_runtime_unit_context'
}

const MAIN_UNIT_ZONE_KINDS = [
  'vanguard_circle',
  'rear_guard_circle',
] as const satisfies readonly ZoneKind[]

export function resolveZoneTransferFlagLifecycleDecision(
  context: ZoneTransferFlagLifecycleContext,
): ZoneTransferFlagLifecycleDecision {
  if (
    isMainUnitZoneKind(context.sourceZoneKind) &&
    isMainUnitZoneKind(context.destinationZoneKind)
  ) {
    return {
      disposition: 'preserve',
      orientation: 'preserve',
      flags: 'preserve',
      rationale: 'main_unit_circle_to_main_unit_circle',
    }
  }

  return {
    disposition: 'reset',
    orientation: 'stand',
    flags: 'clear',
    rationale: 'entered_or_left_runtime_unit_context',
  }
}

export function applyZoneTransferFlagLifecycleDecision(
  pieceStates: readonly GamePieceStatusState[],
  pieceId: GamePieceStatusState['pieceId'],
  decision: ZoneTransferFlagLifecycleDecision,
): readonly GamePieceStatusState[] {
  if (decision.disposition === 'preserve') {
    return pieceStates
  }

  return pieceStates.filter((pieceState) => pieceState.pieceId !== pieceId)
}

export function isMainUnitZoneKind(zoneKind: ZoneKind): boolean {
  return (MAIN_UNIT_ZONE_KINDS as readonly string[]).includes(
    zoneKind as string,
  )
}

export const ZONE_TRANSFER_PRESERVED_FLAG_KEYS = [
  'locked',
] as const satisfies readonly GamePieceFlagKey[]
