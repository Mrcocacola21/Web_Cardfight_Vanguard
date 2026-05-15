import type { PieceId, PlayerId, ZoneId } from '../contracts'

import type {
  GamePieceState,
  GamePieceStatusState,
  PlayerState,
  ZoneKind,
  ZoneState,
} from './state'
import type { GamePieceLocation, GameStateIndex } from './state-index'

type PlayerReference = PlayerId | PlayerState

export function findPlayerById(
  index: GameStateIndex,
  playerId: PlayerId,
): PlayerState | undefined {
  return index.playersById.get(playerId)
}

export function findZoneById(
  index: GameStateIndex,
  zoneId: ZoneId,
): ZoneState | undefined {
  return index.zonesById.get(zoneId)
}

export function findPieceById(
  index: GameStateIndex,
  pieceId: PieceId,
): GamePieceState | undefined {
  return index.piecesById.get(pieceId)
}

export function findPieceStateById(
  index: GameStateIndex,
  pieceId: PieceId,
): GamePieceStatusState | undefined {
  return index.pieceStatesByPieceId.get(pieceId)
}

export function findPieceLocation(
  index: GameStateIndex,
  pieceId: PieceId,
): GamePieceLocation | undefined {
  return index.pieceLocationsByPieceId.get(pieceId)
}

export function listOwnedZonesByKind(
  index: GameStateIndex,
  player: PlayerReference,
  kind: ZoneKind,
): readonly ZoneState[] {
  return (
    index.ownedZonesByPlayerAndKind.get(resolvePlayerId(player))?.get(kind) ??
    []
  )
}

export function findOwnedZoneByKind(
  index: GameStateIndex,
  player: PlayerReference,
  kind: ZoneKind,
): ZoneState | undefined {
  return listOwnedZonesByKind(index, player, kind)[0]
}

export function findCurrentVanguardZone(
  index: GameStateIndex,
  player: PlayerReference,
): ZoneState | undefined {
  return findOwnedZoneByKind(index, player, 'vanguard_circle')
}

export function findCurrentVanguardPiece(
  index: GameStateIndex,
  player: PlayerReference,
): GamePieceState | undefined {
  const vanguardPieceId = findCurrentVanguardZone(index, player)?.occupants[0]
    ?.pieceId

  return vanguardPieceId === undefined
    ? undefined
    : findPieceById(index, vanguardPieceId)
}

export function resolvePrimaryOpponentPlayerId(
  index: GameStateIndex,
  playerId: PlayerId,
): PlayerId | undefined {
  return index.state.players.find((player) => player.playerId !== playerId)
    ?.playerId
}

function resolvePlayerId(player: PlayerReference): PlayerId {
  return typeof player === 'string' ? player : player.playerId
}
