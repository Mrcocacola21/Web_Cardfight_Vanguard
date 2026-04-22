import type { PieceId } from '../contracts'
import type { ZoneLocationReference } from '../references'
import type { GameState, ZoneOccupantState, ZoneState } from '../state'

interface PieceLocation {
  readonly zone: ZoneState
  readonly zoneIndex: number
  readonly occupant: ZoneOccupantState
  readonly occupantIndex: number
}

interface SuccessfulRelocation {
  readonly ok: true
  readonly zones: readonly ZoneState[]
  readonly actualFrom: ZoneLocationReference
  readonly actualTo: ZoneLocationReference
}

interface ResolvedDestination {
  readonly ok: true
  readonly occupants: readonly ZoneOccupantState[]
  readonly actualTo: ZoneLocationReference
}

interface FailedRelocation {
  readonly ok: false
  readonly code: 'invalid_action' | 'invalid_action_reference'
  readonly message: string
}

export type PieceRelocationResult = SuccessfulRelocation | FailedRelocation

export function relocatePieceBetweenZones(
  currentState: GameState,
  pieceId: PieceId,
  from: ZoneLocationReference,
  to: ZoneLocationReference,
): PieceRelocationResult {
  const pieceLocation = locatePiece(currentState, pieceId)

  if (pieceLocation === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Piece ${pieceId} does not exist in the current game state.`,
    }
  }

  if (pieceLocation.zone.zoneId !== from.zoneId) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Piece ${pieceId} is not located in source zone ${from.zoneId}.`,
    }
  }

  if (
    from.slotId !== undefined &&
    pieceLocation.occupant.slotId !== from.slotId
  ) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Piece ${pieceId} is not located in source slot ${from.slotId}.`,
    }
  }

  if (!isSourcePositionCompatible(pieceLocation, from)) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Piece ${pieceId} is not located at source position ${from.position}.`,
    }
  }

  if (from.zoneId === to.zoneId) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Foundation reducer does not implement same-zone relocation for ${pieceId} yet.`,
    }
  }

  const destinationZoneIndex = currentState.zones.findIndex(
    (zone) => zone.zoneId === to.zoneId,
  )

  if (destinationZoneIndex < 0) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Destination zone ${to.zoneId} does not exist in the current game state.`,
    }
  }

  const destinationZone = currentState.zones[destinationZoneIndex]

  if (destinationZone === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Destination zone ${to.zoneId} does not exist in the current game state.`,
    }
  }

  const destinationResolution = resolveDestinationLocation(
    destinationZone,
    to,
    pieceId,
  )

  if (!destinationResolution.ok) {
    return destinationResolution
  }

  const nextSourceOccupants = pieceLocation.zone.occupants.filter(
    (_, occupantIndex) => occupantIndex !== pieceLocation.occupantIndex,
  )
  const nextDestinationOccupants = destinationResolution.occupants
  const zones = currentState.zones.map((zone, zoneIndex) => {
    if (zoneIndex === pieceLocation.zoneIndex) {
      return {
        ...zone,
        occupants: nextSourceOccupants,
      }
    }

    if (zoneIndex === destinationZoneIndex) {
      return {
        ...zone,
        occupants: nextDestinationOccupants,
      }
    }

    return zone
  })

  return {
    ok: true,
    zones,
    actualFrom: createResolvedSourceLocation(pieceLocation),
    actualTo: destinationResolution.actualTo,
  }
}

function locatePiece(
  currentState: GameState,
  pieceId: PieceId,
): PieceLocation | undefined {
  for (const [zoneIndex, zone] of currentState.zones.entries()) {
    const occupantIndex = zone.occupants.findIndex(
      (occupant) => occupant.pieceId === pieceId,
    )

    if (occupantIndex < 0) {
      continue
    }

    const occupant = zone.occupants[occupantIndex]

    if (occupant === undefined) {
      continue
    }

    return {
      zone,
      zoneIndex,
      occupant,
      occupantIndex,
    }
  }

  return undefined
}

function isSourcePositionCompatible(
  pieceLocation: PieceLocation,
  from: ZoneLocationReference,
): boolean {
  if (from.position === undefined) {
    return true
  }

  return (
    pieceLocation.zone.layout.ordering === 'ordered' &&
    pieceLocation.occupantIndex === from.position
  )
}

function resolveDestinationLocation(
  destinationZone: ZoneState,
  destination: ZoneLocationReference,
  pieceId: PieceId,
): ResolvedDestination | FailedRelocation {
  switch (destinationZone.layout.occupancy) {
    case 'single':
      if (
        destination.slotId !== undefined ||
        destination.position !== undefined
      ) {
        return {
          ok: false,
          code: 'invalid_action',
          message: `Single-occupancy zone ${destinationZone.zoneId} does not accept slots or explicit positions.`,
        }
      }
      if (destinationZone.occupants.length > 0) {
        return {
          ok: false,
          code: 'invalid_action',
          message: `Single-occupancy zone ${destinationZone.zoneId} is already occupied.`,
        }
      }
      return {
        ok: true,
        occupants: [{ pieceId }],
        actualTo: { zoneId: destinationZone.zoneId },
      }
    case 'multi':
      if (destination.slotId !== undefined) {
        return {
          ok: false,
          code: 'invalid_action',
          message: `Multi-occupancy zone ${destinationZone.zoneId} does not accept slot identifiers.`,
        }
      }
      return resolveMultiOccupancyDestination(
        destinationZone,
        destination,
        pieceId,
      )
    case 'slotted':
      return resolveSlottedDestination(destinationZone, destination, pieceId)
  }
}

function resolveMultiOccupancyDestination(
  destinationZone: ZoneState,
  destination: ZoneLocationReference,
  pieceId: PieceId,
): ResolvedDestination | FailedRelocation {
  if (
    destinationZone.layout.capacity !== undefined &&
    destinationZone.occupants.length >= destinationZone.layout.capacity
  ) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Destination zone ${destinationZone.zoneId} has reached its declared capacity.`,
    }
  }

  if (destinationZone.layout.ordering === 'unordered') {
    if (destination.position !== undefined) {
      return {
        ok: false,
        code: 'invalid_action',
        message: `Unordered zone ${destinationZone.zoneId} does not accept explicit positions.`,
      }
    }
    return {
      ok: true,
      occupants: [...destinationZone.occupants, { pieceId }],
      actualTo: { zoneId: destinationZone.zoneId },
    }
  }

  const insertIndex = destination.position ?? destinationZone.occupants.length

  if (
    !Number.isSafeInteger(insertIndex) ||
    insertIndex < 0 ||
    insertIndex > destinationZone.occupants.length
  ) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Ordered zone ${destinationZone.zoneId} received an invalid insert position ${destination.position}.`,
    }
  }

  const occupants = [...destinationZone.occupants]
  occupants.splice(insertIndex, 0, { pieceId })

  return {
    ok: true,
    occupants,
    actualTo: {
      zoneId: destinationZone.zoneId,
      position: insertIndex,
    },
  }
}

function resolveSlottedDestination(
  destinationZone: ZoneState,
  destination: ZoneLocationReference,
  pieceId: PieceId,
): ResolvedDestination | FailedRelocation {
  if (destination.position !== undefined) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Slotted zone ${destinationZone.zoneId} does not accept ordered positions.`,
    }
  }

  if (destination.slotId === undefined) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Slotted zone ${destinationZone.zoneId} requires a target slot id.`,
    }
  }

  const slotIds = destinationZone.layout.slotIds ?? []

  if (!slotIds.includes(destination.slotId)) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Slotted zone ${destinationZone.zoneId} does not contain slot ${destination.slotId}.`,
    }
  }

  if (
    destinationZone.occupants.some(
      (occupant) => occupant.slotId === destination.slotId,
    )
  ) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Destination slot ${destination.slotId} in zone ${destinationZone.zoneId} is already occupied.`,
    }
  }

  return {
    ok: true,
    occupants: [
      ...destinationZone.occupants,
      {
        pieceId,
        slotId: destination.slotId,
      },
    ],
    actualTo: {
      zoneId: destinationZone.zoneId,
      slotId: destination.slotId,
    },
  }
}

function createResolvedSourceLocation(
  pieceLocation: PieceLocation,
): ZoneLocationReference {
  return {
    zoneId: pieceLocation.zone.zoneId,
    ...(pieceLocation.occupant.slotId === undefined
      ? {}
      : {
          slotId: pieceLocation.occupant.slotId,
        }),
    ...(pieceLocation.zone.layout.ordering === 'ordered'
      ? {
          position: pieceLocation.occupantIndex,
        }
      : {}),
  }
}
