import type { PieceId, ZoneId } from '../contracts'
import type { ZoneLocationReference } from '../references'
import type {
  GamePieceStatusState,
  GameState,
  ZoneOccupantState,
  ZoneState,
} from '../state'
import type { ZoneTransferReason } from '../transfers'

import { resolveZoneTransferSequence } from './zone-transfer'

interface SuccessfulOrderedZoneReorder {
  readonly ok: true
  readonly zones: readonly ZoneState[]
  readonly zone: ZoneState
}

interface SuccessfulPieceMoveSequence {
  readonly ok: true
  readonly zones: readonly ZoneState[]
  readonly pieceStates: readonly GamePieceStatusState[]
  readonly movedPieces: readonly PieceZoneMovement[]
}

interface FailedOrderedZoneOperation {
  readonly ok: false
  readonly code: 'invalid_action' | 'invalid_action_reference'
  readonly message: string
}

export interface PieceZoneMovement {
  readonly pieceId: PieceId
  readonly from: ZoneLocationReference
  readonly to: ZoneLocationReference
  readonly reason: ZoneTransferReason
}

export type OrderedZoneReorderResult =
  | SuccessfulOrderedZoneReorder
  | FailedOrderedZoneOperation

export type PieceMoveSequenceResult =
  | SuccessfulPieceMoveSequence
  | FailedOrderedZoneOperation

export function findZoneById(
  currentState: GameState,
  zoneId: ZoneId,
): ZoneState | undefined {
  return currentState.zones.find((zone) => zone.zoneId === zoneId)
}

export function reorderOrderedMultiZoneOccupants(
  currentState: GameState,
  zoneId: ZoneId,
  orderedPieceIds: readonly PieceId[],
): OrderedZoneReorderResult {
  const zone = findZoneById(currentState, zoneId)

  if (zone === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Zone ${zoneId} does not exist in the current game state.`,
    }
  }

  if (zone.layout.ordering !== 'ordered' || zone.layout.occupancy !== 'multi') {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Zone ${zoneId} must be an ordered multi-occupancy zone to support deterministic shuffling.`,
    }
  }

  if (new Set(orderedPieceIds).size !== orderedPieceIds.length) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Zone ${zoneId} received a shuffled order with duplicate piece ids.`,
    }
  }

  if (orderedPieceIds.length !== zone.occupants.length) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Zone ${zoneId} received a shuffled order with ${orderedPieceIds.length} piece ids, but the zone currently holds ${zone.occupants.length}.`,
    }
  }

  const occupantsByPieceId = new Map(
    zone.occupants.map((occupant) => [occupant.pieceId, occupant] as const),
  )

  for (const pieceId of orderedPieceIds) {
    if (!occupantsByPieceId.has(pieceId)) {
      return {
        ok: false,
        code: 'invalid_action_reference',
        message: `Zone ${zoneId} cannot be reordered with unknown piece ${pieceId}.`,
      }
    }
  }

  const reorderedOccupants = orderedPieceIds.map((pieceId) => {
    const occupant = occupantsByPieceId.get(pieceId)

    if (occupant === undefined) {
      throw new Error(
        `Expected occupant ${pieceId} while reordering zone ${zoneId}.`,
      )
    }

    return occupant
  })
  const nextZone: ZoneState = {
    ...zone,
    occupants: reorderedOccupants,
  }
  const nextZones = currentState.zones.map((candidate) =>
    candidate.zoneId === zoneId ? nextZone : candidate,
  )

  return {
    ok: true,
    zones: nextZones,
    zone: nextZone,
  }
}

export function movePiecesByIdBetweenZones(
  currentState: GameState,
  pieceIds: readonly PieceId[],
  fromZoneId: ZoneId,
  toZoneId: ZoneId,
  reason: ZoneTransferReason,
): PieceMoveSequenceResult {
  const transferResult = resolveZoneTransferSequence(
    currentState,
    pieceIds.map((pieceId) => ({
      pieceId,
      from: {
        zoneId: fromZoneId,
      },
      to: {
        zoneId: toZoneId,
      },
      reason,
    })),
  )

  if (!transferResult.ok) {
    return transferResult
  }

  return {
    ok: true,
    zones: transferResult.zones,
    pieceStates: transferResult.pieceStates,
    movedPieces: transferResult.transfers,
  }
}

export function drawTopPiecesBetweenZones(
  currentState: GameState,
  fromZoneId: ZoneId,
  toZoneId: ZoneId,
  count: number,
  reason: ZoneTransferReason,
): PieceMoveSequenceResult {
  const sourceZone = findZoneById(currentState, fromZoneId)

  if (sourceZone === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Source zone ${fromZoneId} does not exist in the current game state.`,
    }
  }

  if (
    sourceZone.layout.ordering !== 'ordered' ||
    sourceZone.layout.occupancy !== 'multi'
  ) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Source zone ${fromZoneId} must be an ordered multi-occupancy zone to support drawing from the top.`,
    }
  }

  if (!Number.isSafeInteger(count) || count <= 0) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Draw count ${count} must be a positive safe integer.`,
    }
  }

  if (sourceZone.occupants.length < count) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Source zone ${fromZoneId} does not contain enough pieces to draw ${count} card(s).`,
    }
  }

  const topPieceIds = sourceZone.occupants
    .slice(0, count)
    .map((occupant: ZoneOccupantState) => occupant.pieceId)

  return movePiecesByIdBetweenZones(
    currentState,
    topPieceIds,
    fromZoneId,
    toZoneId,
    reason,
  )
}
