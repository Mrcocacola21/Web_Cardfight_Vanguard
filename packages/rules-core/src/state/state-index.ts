import type { PieceId, PlayerId, ZoneId } from '../contracts'

import type {
  GamePieceState,
  GamePieceStatusState,
  GameState,
  PlayerState,
  ZoneKind,
  ZoneOccupantState,
  ZoneState,
} from './state'

export interface GamePieceLocation {
  readonly piece: GamePieceState
  readonly zone: ZoneState
  readonly occupant: ZoneOccupantState
}

export interface GameStateIndex {
  readonly state: GameState
  readonly playersById: ReadonlyMap<PlayerId, PlayerState>
  readonly zonesById: ReadonlyMap<ZoneId, ZoneState>
  readonly piecesById: ReadonlyMap<PieceId, GamePieceState>
  readonly pieceStatesByPieceId: ReadonlyMap<PieceId, GamePieceStatusState>
  readonly pieceLocationsByPieceId: ReadonlyMap<PieceId, GamePieceLocation>
  readonly ownedZonesByPlayerAndKind: ReadonlyMap<
    PlayerId,
    ReadonlyMap<ZoneKind, readonly ZoneState[]>
  >
}

export function buildGameStateIndex(state: GameState): GameStateIndex {
  const playersById = new Map<PlayerId, PlayerState>()
  const zonesById = new Map<ZoneId, ZoneState>()
  const piecesById = new Map<PieceId, GamePieceState>()
  const pieceStatesByPieceId = new Map<PieceId, GamePieceStatusState>()
  const pieceLocationsByPieceId = new Map<PieceId, GamePieceLocation>()
  const ownedZonesByPlayerAndKind = new Map<
    PlayerId,
    Map<ZoneKind, ZoneState[]>
  >()

  for (const player of state.players) {
    if (!playersById.has(player.playerId)) {
      playersById.set(player.playerId, player)
    }
  }

  for (const piece of state.pieces) {
    if (!piecesById.has(piece.pieceId)) {
      piecesById.set(piece.pieceId, piece)
    }
  }

  for (const pieceState of state.pieceStates) {
    if (!pieceStatesByPieceId.has(pieceState.pieceId)) {
      pieceStatesByPieceId.set(pieceState.pieceId, pieceState)
    }
  }

  for (const zone of state.zones) {
    if (!zonesById.has(zone.zoneId)) {
      zonesById.set(zone.zoneId, zone)
    }

    if (zone.ownerPlayerId !== undefined) {
      let zonesByKind = ownedZonesByPlayerAndKind.get(zone.ownerPlayerId)

      if (zonesByKind === undefined) {
        zonesByKind = new Map<ZoneKind, ZoneState[]>()
        ownedZonesByPlayerAndKind.set(zone.ownerPlayerId, zonesByKind)
      }

      const ownedZones = zonesByKind.get(zone.kind) ?? []
      ownedZones.push(zone)
      zonesByKind.set(zone.kind, ownedZones)
    }

    for (const occupant of zone.occupants) {
      if (pieceLocationsByPieceId.has(occupant.pieceId)) {
        continue
      }

      const piece = piecesById.get(occupant.pieceId)

      if (piece === undefined) {
        continue
      }

      pieceLocationsByPieceId.set(occupant.pieceId, {
        piece,
        zone,
        occupant,
      })
    }
  }

  return {
    state,
    playersById,
    zonesById,
    piecesById,
    pieceStatesByPieceId,
    pieceLocationsByPieceId,
    ownedZonesByPlayerAndKind,
  }
}
