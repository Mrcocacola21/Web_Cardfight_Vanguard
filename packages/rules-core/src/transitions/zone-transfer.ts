import type { ActionId, EventId, TransitionId } from '../contracts'
import type { EventOrigin, PieceMovedEvent } from '../events'
import type { GamePieceStatusState, GameState, ZoneState } from '../state'
import type { ZoneTransferIntent, ZoneTransferRecord } from '../transfers'
import {
  applyZoneTransferFlagLifecycleDecision,
  resolveZoneTransferFlagLifecycleDecision,
  type ZoneTransferFlagLifecycleDecision,
} from '../transfers/flag-lifecycle'

import { relocatePieceBetweenZones } from './zone-relocation'

interface SuccessfulZoneTransfer {
  readonly ok: true
  readonly zones: readonly ZoneState[]
  readonly pieceStates: readonly GamePieceStatusState[]
  readonly transfer: ZoneTransferRecord
  readonly flagLifecycle: ZoneTransferFlagLifecycleDecision
}

interface SuccessfulZoneTransferSequence {
  readonly ok: true
  readonly zones: readonly ZoneState[]
  readonly pieceStates: readonly GamePieceStatusState[]
  readonly transfers: readonly ZoneTransferRecord[]
  readonly flagLifecycles: readonly ZoneTransferFlagLifecycleDecision[]
}

interface FailedZoneTransfer {
  readonly ok: false
  readonly code: 'invalid_action' | 'invalid_action_reference'
  readonly message: string
}

export type ZoneTransferResult = SuccessfulZoneTransfer | FailedZoneTransfer
export type ZoneTransferSequenceResult =
  | SuccessfulZoneTransferSequence
  | FailedZoneTransfer

export function resolveZoneTransfer(
  currentState: GameState,
  transfer: ZoneTransferIntent,
): ZoneTransferResult {
  const relocation = relocatePieceBetweenZones(
    currentState,
    transfer.pieceId,
    transfer.from,
    transfer.to,
  )

  if (!relocation.ok) {
    return relocation
  }

  const sourceZone = currentState.zones.find(
    (zone) => zone.zoneId === relocation.actualFrom.zoneId,
  )
  const destinationZone = currentState.zones.find(
    (zone) => zone.zoneId === relocation.actualTo.zoneId,
  )

  if (sourceZone === undefined || destinationZone === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Transfer for piece ${transfer.pieceId} could not resolve source or destination zone state for flag lifecycle policy.`,
    }
  }

  const flagLifecycle = resolveZoneTransferFlagLifecycleDecision({
    sourceZoneKind: sourceZone.kind,
    destinationZoneKind: destinationZone.kind,
    reason: transfer.reason,
  })

  return {
    ok: true,
    zones: relocation.zones,
    pieceStates: applyZoneTransferFlagLifecycleDecision(
      currentState.pieceStates,
      transfer.pieceId,
      flagLifecycle,
    ),
    transfer: {
      pieceId: transfer.pieceId,
      from: relocation.actualFrom,
      to: relocation.actualTo,
      reason: transfer.reason,
    },
    flagLifecycle,
  }
}

export function resolveZoneTransferSequence(
  currentState: GameState,
  transfers: readonly ZoneTransferIntent[],
): ZoneTransferSequenceResult {
  let workingState = currentState
  const resolvedTransfers: ZoneTransferRecord[] = []
  const resolvedFlagLifecycles: ZoneTransferFlagLifecycleDecision[] = []

  for (const transfer of transfers) {
    const result = resolveZoneTransfer(workingState, transfer)

    if (!result.ok) {
      return result
    }

    resolvedTransfers.push(result.transfer)
    resolvedFlagLifecycles.push(result.flagLifecycle)
    workingState = {
      ...workingState,
      zones: result.zones,
      pieceStates: result.pieceStates,
    }
  }

  return {
    ok: true,
    zones: workingState.zones,
    pieceStates: workingState.pieceStates,
    transfers: resolvedTransfers,
    flagLifecycles: resolvedFlagLifecycles,
  }
}

export function createTransferEventId(
  transitionId: TransitionId,
  sequence: number,
): `${TransitionId}:event:${number}` {
  return `${transitionId}:event:${sequence}`
}

export function createPieceMovedEvents(
  transitionId: TransitionId,
  transfers: readonly ZoneTransferRecord[],
  origin: EventOrigin,
  options: {
    readonly sourceActionId?: ActionId
    readonly startingSequence?: number
  } = {},
): readonly PieceMovedEvent[] {
  const startingSequence = options.startingSequence ?? 0

  return transfers.map((transfer, index) => {
    const sequence = startingSequence + index

    return {
      eventId: createTransferEventId(transitionId, sequence) as EventId,
      type: 'piece.moved',
      sequence,
      ...(options.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: options.sourceActionId,
          }),
      origin,
      pieceId: transfer.pieceId,
      from: transfer.from,
      to: transfer.to,
      reason: transfer.reason,
    }
  })
}
