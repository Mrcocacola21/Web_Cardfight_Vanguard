import type { PieceId, PlayerId, ZoneId, ZoneSlotId } from '../contracts'
import type { GameState, ZoneOccupantState, ZoneState } from '../state'
import {
  buildGameStateIndex,
  findPieceLocation,
  listOwnedZonesByKind,
} from '../state'

export type BoardRow = 'front' | 'back'
export type BoardColumnKey = 'left' | 'center' | 'right'
export type BoardCircleKind = 'vanguard' | 'rear_guard'
export type BoardPositionSource = 'vanguard_circle' | 'slot_id' | 'zone_id'

export interface BoardPosition {
  readonly pieceId: PieceId
  readonly playerId: PlayerId
  readonly zoneId: ZoneId
  readonly slotId?: ZoneSlotId
  readonly circleKind: BoardCircleKind
  readonly row: BoardRow
  readonly column: BoardColumnKey
  readonly source: BoardPositionSource
}

export type BoardPositionIssueCode =
  | 'unknown_piece'
  | 'not_battlefield_zone'
  | 'missing_board_owner'
  | 'unresolved_board_position'

export interface BoardPositionIssue {
  readonly code: BoardPositionIssueCode
  readonly message: string
}

export type BoardPositionResult =
  | {
      readonly ok: true
      readonly position: BoardPosition
    }
  | {
      readonly ok: false
      readonly issue: BoardPositionIssue
    }

export interface BoardColumnState {
  readonly playerId: PlayerId
  readonly column: BoardColumnKey
  readonly positions: readonly BoardPosition[]
  readonly frontPositions: readonly BoardPosition[]
  readonly backPositions: readonly BoardPosition[]
  readonly vanguardPosition?: BoardPosition
}

export type BoostRelationResult =
  | {
      readonly ok: true
      readonly column: BoardColumnKey
      readonly attackerPosition: BoardPosition
      readonly boosterPosition: BoardPosition
    }
  | {
      readonly ok: false
      readonly issue: BoardPositionIssue
    }

interface BoardCoordinates {
  readonly row: BoardRow
  readonly column: BoardColumnKey
}

const BOARD_LOCATION_PATTERNS: readonly {
  readonly row: BoardRow
  readonly column: BoardColumnKey
  readonly fragments: readonly string[]
}[] = [
  {
    row: 'front',
    column: 'left',
    fragments: ['front-left', 'left-front'],
  },
  {
    row: 'front',
    column: 'center',
    fragments: ['front-center', 'center-front'],
  },
  {
    row: 'front',
    column: 'right',
    fragments: ['front-right', 'right-front'],
  },
  {
    row: 'back',
    column: 'left',
    fragments: ['back-left', 'left-back'],
  },
  {
    row: 'back',
    column: 'center',
    fragments: ['back-center', 'center-back'],
  },
  {
    row: 'back',
    column: 'right',
    fragments: ['back-right', 'right-back'],
  },
]

export function isBattlefieldZoneKind(zoneKind: ZoneState['kind']): boolean {
  return zoneKind === 'vanguard_circle' || zoneKind === 'rear_guard_circle'
}

export function isFrontRowBoardPosition(position: BoardPosition): boolean {
  return position.row === 'front'
}

export function isBackRowBoardPosition(position: BoardPosition): boolean {
  return position.row === 'back'
}

export function resolveBoardPositionForPiece(
  state: GameState,
  pieceId: PieceId,
  stateIndex = buildGameStateIndex(state),
): BoardPositionResult {
  const location = findPieceLocation(stateIndex, pieceId)

  if (location === undefined) {
    return {
      ok: false,
      issue: {
        code: 'unknown_piece',
        message: `Piece ${pieceId} is not located in the current game state.`,
      },
    }
  }

  return resolveBoardPositionForOccupant(location.zone, location.occupant)
}

export function resolveBoardPositionForOccupant(
  zone: ZoneState,
  occupant: ZoneOccupantState,
): BoardPositionResult {
  if (zone.kind === 'vanguard_circle') {
    if (zone.ownerPlayerId === undefined) {
      return missingBoardOwner(zone)
    }

    return {
      ok: true,
      position: {
        pieceId: occupant.pieceId,
        playerId: zone.ownerPlayerId,
        zoneId: zone.zoneId,
        circleKind: 'vanguard',
        row: 'front',
        column: 'center',
        source: 'vanguard_circle',
        ...(occupant.slotId === undefined ? {} : { slotId: occupant.slotId }),
      },
    }
  }

  if (zone.kind !== 'rear_guard_circle') {
    return {
      ok: false,
      issue: {
        code: 'not_battlefield_zone',
        message: `Zone ${zone.zoneId} is not a battlefield circle zone.`,
      },
    }
  }

  if (zone.ownerPlayerId === undefined) {
    return missingBoardOwner(zone)
  }

  const slotCoordinates =
    occupant.slotId === undefined
      ? undefined
      : parseBoardLocationName(occupant.slotId)
  const zoneCoordinates =
    slotCoordinates === undefined
      ? parseBoardLocationName(zone.zoneId)
      : undefined
  const coordinates = slotCoordinates ?? zoneCoordinates

  if (coordinates === undefined) {
    return {
      ok: false,
      issue: {
        code: 'unresolved_board_position',
        message: `Rear-guard piece ${occupant.pieceId} in zone ${zone.zoneId} must use a board slot or zone id containing front/back and left/center/right coordinates.`,
      },
    }
  }

  return {
    ok: true,
    position: {
      pieceId: occupant.pieceId,
      playerId: zone.ownerPlayerId,
      zoneId: zone.zoneId,
      circleKind: 'rear_guard',
      row: coordinates.row,
      column: coordinates.column,
      source: slotCoordinates === undefined ? 'zone_id' : 'slot_id',
      ...(occupant.slotId === undefined ? {} : { slotId: occupant.slotId }),
    },
  }
}

export function resolveBoardColumn(
  state: GameState,
  playerId: PlayerId,
  column: BoardColumnKey,
): BoardColumnState {
  const stateIndex = buildGameStateIndex(state)
  const positions = [
    ...listOwnedZonesByKind(stateIndex, playerId, 'vanguard_circle'),
    ...listOwnedZonesByKind(stateIndex, playerId, 'rear_guard_circle'),
  ]
    .flatMap((zone) =>
      zone.occupants.flatMap((occupant) => {
        const result = resolveBoardPositionForOccupant(zone, occupant)

        return result.ok && result.position.column === column
          ? [result.position]
          : []
      }),
    )
    .sort(compareBoardPositions)

  const vanguardPosition = positions.find(
    (position) => position.circleKind === 'vanguard',
  )

  return {
    playerId,
    column,
    positions,
    frontPositions: positions.filter((position) => position.row === 'front'),
    backPositions: positions.filter((position) => position.row === 'back'),
    ...(vanguardPosition === undefined ? {} : { vanguardPosition }),
  }
}

export function resolveBoostRelation(
  state: GameState,
  attackerPieceId: PieceId,
  boosterPieceId: PieceId,
): BoostRelationResult {
  const stateIndex = buildGameStateIndex(state)
  const attackerPosition = resolveBoardPositionForPiece(
    state,
    attackerPieceId,
    stateIndex,
  )

  if (!attackerPosition.ok) {
    return attackerPosition
  }

  const boosterPosition = resolveBoardPositionForPiece(
    state,
    boosterPieceId,
    stateIndex,
  )

  if (!boosterPosition.ok) {
    return boosterPosition
  }

  if (attackerPosition.position.row !== 'front') {
    return {
      ok: false,
      issue: {
        code: 'unresolved_board_position',
        message: `Attacker piece ${attackerPieceId} must be on a front-row battlefield circle to receive boost.`,
      },
    }
  }

  if (
    boosterPosition.position.circleKind !== 'rear_guard' ||
    boosterPosition.position.row !== 'back'
  ) {
    return {
      ok: false,
      issue: {
        code: 'unresolved_board_position',
        message: `Booster piece ${boosterPieceId} must be on a back-row rear-guard circle.`,
      },
    }
  }

  if (
    attackerPosition.position.playerId !== boosterPosition.position.playerId
  ) {
    return {
      ok: false,
      issue: {
        code: 'unresolved_board_position',
        message: `Booster piece ${boosterPieceId} must share a battlefield owner with attacker piece ${attackerPieceId}.`,
      },
    }
  }

  if (attackerPosition.position.column !== boosterPosition.position.column) {
    return {
      ok: false,
      issue: {
        code: 'unresolved_board_position',
        message: `Booster piece ${boosterPieceId} is not in the same board column as attacker piece ${attackerPieceId}.`,
      },
    }
  }

  return {
    ok: true,
    column: attackerPosition.position.column,
    attackerPosition: attackerPosition.position,
    boosterPosition: boosterPosition.position,
  }
}

function parseBoardLocationName(value: string): BoardCoordinates | undefined {
  const normalizedValue = value.toLowerCase()

  for (const pattern of BOARD_LOCATION_PATTERNS) {
    if (
      pattern.fragments.some((fragment) => normalizedValue.includes(fragment))
    ) {
      return {
        row: pattern.row,
        column: pattern.column,
      }
    }
  }

  return undefined
}

function compareBoardPositions(left: BoardPosition, right: BoardPosition) {
  return (
    compareRows(left.row, right.row) ||
    compareCircleKinds(left.circleKind, right.circleKind) ||
    (left.zoneId as string).localeCompare(right.zoneId as string) ||
    ((left.slotId ?? '') as string).localeCompare(
      (right.slotId ?? '') as string,
    )
  )
}

function compareRows(left: BoardRow, right: BoardRow): number {
  return rowRank(left) - rowRank(right)
}

function compareCircleKinds(
  left: BoardCircleKind,
  right: BoardCircleKind,
): number {
  return circleKindRank(left) - circleKindRank(right)
}

function rowRank(row: BoardRow): number {
  return row === 'front' ? 0 : 1
}

function circleKindRank(circleKind: BoardCircleKind): number {
  return circleKind === 'vanguard' ? 0 : 1
}

function missingBoardOwner(zone: ZoneState): BoardPositionResult {
  return {
    ok: false,
    issue: {
      code: 'missing_board_owner',
      message: `Battlefield zone ${zone.zoneId} must declare an owner player id before board semantics can be resolved.`,
    },
  }
}
