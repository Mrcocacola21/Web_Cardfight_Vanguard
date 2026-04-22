import type { PieceId, PlayerId, ZoneId, ZoneSlotId } from './contracts'

export interface ZoneLocationReference {
  readonly zoneId: ZoneId
  readonly slotId?: ZoneSlotId
  readonly position?: number
}

export interface PlayerTargetReference {
  readonly kind: 'player'
  readonly playerId: PlayerId
}

export interface PieceTargetReference {
  readonly kind: 'piece'
  readonly pieceId: PieceId
}

export type TargetReference = PlayerTargetReference | PieceTargetReference

export type AttackPlayerTarget = PlayerTargetReference
export type AttackPieceTarget = PieceTargetReference
export type AttackTarget = TargetReference
