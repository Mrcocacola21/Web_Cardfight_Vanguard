import type {
  GamePieceFlagKey,
  GamePieceOrientation,
  GameState,
  PieceId,
  PlayerId,
} from '@web-vg/rules-core'

export type MatchBoardSideKind = 'current' | 'opponent'
export type MatchBoardZoneRole =
  | 'vanguard'
  | 'rear_guard'
  | 'hand'
  | 'deck'
  | 'ride_deck'
  | 'g_deck'
  | 'damage'
  | 'soul'
  | 'drop'
  | 'bind'
  | 'other'

export interface ProjectedMatchBoardPiece {
  readonly pieceId: PieceId
  readonly cardDefinitionId?: GameState['pieces'][number]['cardDefinitionId']
  readonly ownerPlayerId?: PlayerId
  readonly controllerPlayerId?: PlayerId
  readonly slotId?: GameState['zones'][number]['occupants'][number]['slotId']
  readonly position: number
  readonly orientation?: GamePieceOrientation
  readonly flags: readonly GamePieceFlagKey[]
}

export interface ProjectedMatchBoardZone {
  readonly zoneId: GameState['zones'][number]['zoneId']
  readonly kind: GameState['zones'][number]['kind']
  readonly role: MatchBoardZoneRole
  readonly label: string
  readonly ownerPlayerId?: PlayerId
  readonly visibility: GameState['zones'][number]['visibility']
  readonly layout: GameState['zones'][number]['layout']
  readonly slotIds: readonly NonNullable<
    GameState['zones'][number]['layout']['slotIds']
  >[number][]
  readonly pieces: readonly ProjectedMatchBoardPiece[]
}

export interface MatchBoardSideProjection {
  readonly side: MatchBoardSideKind
  readonly player: GameState['players'][number]
  readonly zones: readonly ProjectedMatchBoardZone[]
  readonly centralZones: readonly ProjectedMatchBoardZone[]
  readonly battlefieldZones: readonly ProjectedMatchBoardZone[]
  readonly handZones: readonly ProjectedMatchBoardZone[]
  readonly libraryZones: readonly ProjectedMatchBoardZone[]
  readonly resourceZones: readonly ProjectedMatchBoardZone[]
  readonly discardZones: readonly ProjectedMatchBoardZone[]
  readonly supportZones: readonly ProjectedMatchBoardZone[]
  readonly otherZones: readonly ProjectedMatchBoardZone[]
}

export interface MatchBoardProjection {
  readonly perspectivePlayerId: PlayerId
  readonly currentSide?: MatchBoardSideProjection
  readonly opponentSides: readonly MatchBoardSideProjection[]
}

const ZONE_ROLE_ORDER: readonly MatchBoardZoneRole[] = [
  'vanguard',
  'rear_guard',
  'hand',
  'deck',
  'ride_deck',
  'g_deck',
  'damage',
  'soul',
  'drop',
  'bind',
  'other',
]

const BATTLEFIELD_ZONE_ROLES: readonly MatchBoardZoneRole[] = [
  'vanguard',
  'rear_guard',
]

const HAND_ZONE_ROLES: readonly MatchBoardZoneRole[] = ['hand']

const LIBRARY_ZONE_ROLES: readonly MatchBoardZoneRole[] = [
  'deck',
  'ride_deck',
  'g_deck',
]

const RESOURCE_ZONE_ROLES: readonly MatchBoardZoneRole[] = ['damage', 'soul']

const DISCARD_ZONE_ROLES: readonly MatchBoardZoneRole[] = ['drop', 'bind']

const SUPPORT_ZONE_ROLES: readonly MatchBoardZoneRole[] = [
  'deck',
  'ride_deck',
  'g_deck',
  'damage',
  'soul',
  'drop',
  'bind',
]

export function buildMatchBoardProjection(
  state: GameState,
  perspectivePlayerId: PlayerId,
): MatchBoardProjection {
  const currentPlayer =
    state.players.find((player) => player.playerId === perspectivePlayerId) ??
    state.players[0]
  const pieceById = new Map(
    state.pieces.map((piece) => [piece.pieceId as string, piece] as const),
  )
  const pieceStateById = new Map(
    state.pieceStates.map(
      (pieceState) => [pieceState.pieceId as string, pieceState] as const,
    ),
  )

  if (currentPlayer === undefined) {
    return {
      perspectivePlayerId,
      opponentSides: [],
    }
  }

  const sideForPlayer = (
    player: GameState['players'][number],
    side: MatchBoardSideKind,
  ): MatchBoardSideProjection => {
    const zones = state.zones
      .filter((zone) => zone.ownerPlayerId === player.playerId)
      .map((zone) => projectZone(zone, pieceById, pieceStateById))
      .sort(compareProjectedZones)
    const centralZones = zones.filter((zone) =>
      BATTLEFIELD_ZONE_ROLES.includes(zone.role),
    )
    const battlefieldZones = centralZones
    const handZones = zones.filter((zone) =>
      HAND_ZONE_ROLES.includes(zone.role),
    )
    const libraryZones = zones.filter((zone) =>
      LIBRARY_ZONE_ROLES.includes(zone.role),
    )
    const resourceZones = zones.filter((zone) =>
      RESOURCE_ZONE_ROLES.includes(zone.role),
    )
    const discardZones = zones.filter((zone) =>
      DISCARD_ZONE_ROLES.includes(zone.role),
    )
    const supportZones = zones.filter((zone) =>
      SUPPORT_ZONE_ROLES.includes(zone.role),
    )
    const otherZones = zones.filter(
      (zone) =>
        !BATTLEFIELD_ZONE_ROLES.includes(zone.role) &&
        !HAND_ZONE_ROLES.includes(zone.role) &&
        !SUPPORT_ZONE_ROLES.includes(zone.role),
    )

    return {
      side,
      player,
      zones,
      centralZones,
      battlefieldZones,
      handZones,
      libraryZones,
      resourceZones,
      discardZones,
      supportZones,
      otherZones,
    }
  }

  return {
    perspectivePlayerId: currentPlayer.playerId,
    currentSide: sideForPlayer(currentPlayer, 'current'),
    opponentSides: state.players
      .filter((player) => player.playerId !== currentPlayer.playerId)
      .map((player) => sideForPlayer(player, 'opponent')),
  }
}

function projectZone(
  zone: GameState['zones'][number],
  pieceById: ReadonlyMap<string, GameState['pieces'][number]>,
  pieceStateById: ReadonlyMap<string, GameState['pieceStates'][number]>,
): ProjectedMatchBoardZone {
  const role = getZoneRole(zone.kind)

  return {
    zoneId: zone.zoneId,
    kind: zone.kind,
    role,
    label: formatZoneRoleLabel(role, zone.kind),
    ...(zone.ownerPlayerId === undefined
      ? {}
      : { ownerPlayerId: zone.ownerPlayerId }),
    visibility: zone.visibility,
    layout: zone.layout,
    slotIds: zone.layout.slotIds ?? [],
    pieces: zone.occupants.map((occupant, position) => {
      const piece = pieceById.get(occupant.pieceId as string)
      const pieceState = pieceStateById.get(occupant.pieceId as string)

      return {
        pieceId: occupant.pieceId,
        ...(piece?.cardDefinitionId === undefined
          ? {}
          : { cardDefinitionId: piece.cardDefinitionId }),
        ...(piece?.ownerPlayerId === undefined
          ? {}
          : { ownerPlayerId: piece.ownerPlayerId }),
        ...(piece?.controllerPlayerId === undefined
          ? {}
          : { controllerPlayerId: piece.controllerPlayerId }),
        ...(occupant.slotId === undefined ? {} : { slotId: occupant.slotId }),
        position,
        ...(pieceState?.orientation === undefined
          ? {}
          : { orientation: pieceState.orientation }),
        flags: pieceState?.flags ?? [],
      }
    }),
  }
}

function getZoneRole(
  kind: GameState['zones'][number]['kind'],
): MatchBoardZoneRole {
  switch (kind) {
    case 'vanguard_circle':
      return 'vanguard'
    case 'rear_guard_circle':
      return 'rear_guard'
    case 'hand':
      return 'hand'
    case 'deck':
    case 'main_deck':
      return 'deck'
    case 'ride_deck':
      return 'ride_deck'
    case 'g_deck':
    case 'g_zone':
      return 'g_deck'
    case 'damage':
    case 'damage_zone':
      return 'damage'
    case 'soul':
      return 'soul'
    case 'drop':
    case 'drop_zone':
      return 'drop'
    case 'bind':
    case 'bind_zone':
      return 'bind'
    default:
      return 'other'
  }
}

function compareProjectedZones(
  left: ProjectedMatchBoardZone,
  right: ProjectedMatchBoardZone,
): number {
  const leftRoleIndex = ZONE_ROLE_ORDER.indexOf(left.role)
  const rightRoleIndex = ZONE_ROLE_ORDER.indexOf(right.role)

  if (leftRoleIndex !== rightRoleIndex) {
    return leftRoleIndex - rightRoleIndex
  }

  return left.kind.localeCompare(right.kind)
}

function formatZoneRoleLabel(
  role: MatchBoardZoneRole,
  kind: GameState['zones'][number]['kind'],
): string {
  switch (role) {
    case 'vanguard':
      return 'Vanguard'
    case 'rear_guard':
      return 'Rear-guard'
    case 'hand':
      return 'Hand'
    case 'deck':
      return 'Deck'
    case 'ride_deck':
      return 'Ride deck'
    case 'g_deck':
      return 'G deck'
    case 'damage':
      return 'Damage'
    case 'soul':
      return 'Soul'
    case 'drop':
      return 'Drop'
    case 'bind':
      return 'Bind'
    case 'other':
      return kind
        .split('_')
        .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
        .join(' ')
  }
}
