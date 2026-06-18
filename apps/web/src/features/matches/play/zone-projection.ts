import type {
  GamePieceFlagKey,
  GamePieceOrientation,
  GameState,
  EngineCardStats,
  PieceId,
  PlayerId,
  VisibleGamePieceState,
  VisibleGameState,
  VisiblePieceVisibility,
  VisiblePlayerState,
  VisibleZoneContentsVisibility,
  VisibleZoneState,
} from '@web-vg/rules-core'
import { projectGameStateForPlayer } from '@web-vg/rules-core'

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
  | 'order'
  | 'prison'
  | 'guardian'
  | 'energy'
  | 'other'

export interface ProjectedMatchBoardPiece {
  readonly refId: string
  readonly visibility: VisiblePieceVisibility
  readonly pieceId?: PieceId
  readonly cardDefinitionId?: GameState['pieces'][number]['cardDefinitionId']
  readonly card?: ProjectedMatchBoardCardDetails
  readonly ownerPlayerId?: PlayerId
  readonly controllerPlayerId?: PlayerId
  readonly slotId?: VisibleZoneState['occupants'][number]['slotId']
  readonly position: number
  readonly orientation?: GamePieceOrientation
  readonly flags: readonly GamePieceFlagKey[]
  readonly powerModifier?: number
  readonly criticalModifier?: number
}

export interface ProjectedMatchBoardCardDetails {
  readonly cardDefinitionId: EngineCardStats['cardDefinitionId']
  readonly name: string
  readonly cardType: EngineCardStats['cardType']
  readonly grade: EngineCardStats['grade']
  readonly nation?: EngineCardStats['nation']
  readonly clan?: EngineCardStats['clan']
  readonly power: EngineCardStats['power']
  readonly shield: EngineCardStats['shield']
  readonly critical: EngineCardStats['critical']
  readonly triggerType: EngineCardStats['triggerType']
  readonly keywords: EngineCardStats['keywords']
  readonly effectRefs: readonly string[]
  readonly imageUrl?: string
}

export interface ProjectedMatchBoardZone {
  readonly zoneId: VisibleZoneState['zoneId']
  readonly kind: VisibleZoneState['kind']
  readonly role: MatchBoardZoneRole
  readonly label: string
  readonly ownerPlayerId?: PlayerId
  readonly visibility: VisibleZoneState['visibility']
  readonly contentsVisibility: VisibleZoneContentsVisibility
  readonly layout: VisibleZoneState['layout']
  readonly occupantCount: number
  readonly slotIds: readonly NonNullable<
    VisibleZoneState['layout']['slotIds']
  >[number][]
  readonly pieces: readonly ProjectedMatchBoardPiece[]
}

export interface MatchBoardSideProjection {
  readonly side: MatchBoardSideKind
  readonly player: VisiblePlayerState
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
  'order',
  'prison',
  'guardian',
  'energy',
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

const RESOURCE_ZONE_ROLES: readonly MatchBoardZoneRole[] = [
  'damage',
  'soul',
  'energy',
]

const DISCARD_ZONE_ROLES: readonly MatchBoardZoneRole[] = ['drop', 'bind']

const SUPPORT_ZONE_ROLES: readonly MatchBoardZoneRole[] = [
  'deck',
  'ride_deck',
  'g_deck',
  'damage',
  'soul',
  'drop',
  'bind',
  'order',
  'prison',
  'guardian',
  'energy',
]

export function buildMatchBoardProjection(
  state: GameState,
  perspectivePlayerId: PlayerId,
): MatchBoardProjection {
  const visibleState = projectGameStateForPlayer(state, perspectivePlayerId)

  if (!visibleState.ok) {
    return {
      perspectivePlayerId,
      opponentSides: [],
    }
  }

  return buildMatchBoardProjectionFromVisibleState(
    visibleState.state,
    perspectivePlayerId,
  )
}

export function buildMatchBoardProjectionFromVisibleState(
  state: VisibleGameState,
  perspectivePlayerId?: PlayerId,
): MatchBoardProjection {
  const resolvedPerspectivePlayerId =
    perspectivePlayerId ?? state.viewerPlayerId ?? state.players[0]?.playerId
  const currentPlayer =
    state.players.find(
      (player) => player.playerId === resolvedPerspectivePlayerId,
    ) ?? state.players[0]
  const pieceById = new Map(
    state.pieces.map((piece) => [piece.refId, piece] as const),
  )
  const cardStatsByDefinitionId = new Map(
    (state.cardStats?.cards ?? []).map(
      (card) => [card.cardDefinitionId as string, card] as const,
    ),
  )

  if (currentPlayer === undefined) {
    return {
      perspectivePlayerId:
        resolvedPerspectivePlayerId ?? ('unknown-player' as PlayerId),
      opponentSides: [],
    }
  }

  const sideForPlayer = (
    player: VisiblePlayerState,
    side: MatchBoardSideKind,
  ): MatchBoardSideProjection => {
    const zones = state.zones
      .filter((zone) => zone.ownerPlayerId === player.playerId)
      .map((zone) => projectZone(zone, pieceById, cardStatsByDefinitionId))
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
  zone: VisibleZoneState,
  pieceById: ReadonlyMap<string, VisibleGamePieceState>,
  cardStatsByDefinitionId: ReadonlyMap<string, EngineCardStats>,
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
    contentsVisibility: zone.contentsVisibility,
    layout: zone.layout,
    occupantCount: zone.occupantCount,
    slotIds: zone.layout.slotIds ?? [],
    pieces: zone.occupants.map((occupant) => {
      const piece = pieceById.get(occupant.refId)
      const cardStats =
        piece?.cardDefinitionId === undefined
          ? undefined
          : cardStatsByDefinitionId.get(piece.cardDefinitionId as string)

      return {
        refId: occupant.refId,
        visibility: occupant.visibility,
        ...(occupant.pieceId === undefined
          ? {}
          : { pieceId: occupant.pieceId }),
        ...(piece?.cardDefinitionId === undefined
          ? {}
          : { cardDefinitionId: piece.cardDefinitionId }),
        ...(cardStats === undefined ? {} : { card: mapCardStats(cardStats) }),
        ...(piece?.ownerPlayerId === undefined
          ? {}
          : { ownerPlayerId: piece.ownerPlayerId }),
        ...(piece?.controllerPlayerId === undefined
          ? {}
          : { controllerPlayerId: piece.controllerPlayerId }),
        ...(occupant.slotId === undefined ? {} : { slotId: occupant.slotId }),
        position: occupant.position,
        ...(piece?.orientation === undefined
          ? {}
          : { orientation: piece.orientation }),
        flags: piece?.flags ?? [],
        ...(piece?.powerModifier === undefined
          ? {}
          : { powerModifier: piece.powerModifier }),
        ...(piece?.criticalModifier === undefined
          ? {}
          : { criticalModifier: piece.criticalModifier }),
      }
    }),
  }
}

function mapCardStats(card: EngineCardStats): ProjectedMatchBoardCardDetails {
  return {
    cardDefinitionId: card.cardDefinitionId,
    name: card.name ?? formatCardDefinitionFallbackName(card.cardDefinitionId),
    cardType: card.cardType,
    grade: card.grade,
    ...(card.nation === undefined ? {} : { nation: card.nation }),
    ...(card.clan === undefined ? {} : { clan: card.clan }),
    power: card.power,
    shield: card.shield,
    critical: card.critical,
    triggerType: card.triggerType,
    keywords: card.keywords,
    effectRefs: card.effectRefs ?? [],
  }
}

function formatCardDefinitionFallbackName(cardDefinitionId: string): string {
  const lastSegment = cardDefinitionId.split(':').at(-1) ?? cardDefinitionId

  return lastSegment
    .split(/[-_.]/)
    .filter((part) => part.length > 0)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}

function getZoneRole(kind: VisibleZoneState['kind']): MatchBoardZoneRole {
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
    case 'order':
    case 'order_zone':
      return 'order'
    case 'prison':
    case 'prison_zone':
      return 'prison'
    case 'guardian':
    case 'guardian_circle':
      return 'guardian'
    case 'energy':
    case 'energy_zone':
      return 'energy'
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
  kind: VisibleZoneState['kind'],
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
    case 'order':
      return 'Order'
    case 'prison':
      return 'Prison'
    case 'guardian':
      return 'Guardian Circle'
    case 'energy':
      return 'Energy'
    case 'other':
      return kind
        .split('_')
        .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
        .join(' ')
  }
}
