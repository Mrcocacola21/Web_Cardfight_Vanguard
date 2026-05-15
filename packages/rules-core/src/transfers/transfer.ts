import type { PieceId } from '../contracts'
import type { ZoneLocationReference } from '../references'

export type ZoneTransferReason =
  | 'generic'
  | 'draw'
  | 'mulligan_return'
  | 'mulligan_draw'
  | 'ride'
  | 'ride_displacement'
  | 'call'
  | 'guard'
  | 'drive_check'
  | 'damage_check'
  | 'battle_cleanup'
  | 'retire'
  | 'bind'
  | 'soul'
  | 'soul_blast'
  | 'soul_charge'
  | 'intercept'
  | 'format'
  | (string & {})

export interface ZoneTransferIntent {
  readonly pieceId: PieceId
  readonly from: ZoneLocationReference
  readonly to: ZoneLocationReference
  readonly reason: ZoneTransferReason
}

export type ZoneTransferRecord = ZoneTransferIntent
