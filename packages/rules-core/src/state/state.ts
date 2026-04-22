import type { CardId, FormatId } from '@web-vg/shared'

import type {
  GameId,
  PieceId,
  PlayerId,
  ZoneId,
  ZoneSlotId,
} from '../contracts'
import type { GameChoiceRequest } from '../requests'

export type GameStatus =
  | 'setup'
  | 'ready'
  | 'in_progress'
  | 'awaiting_choice'
  | 'completed'
  | (string & {})
export type PlayerStatus =
  | 'ready'
  | 'active'
  | 'waiting'
  | 'defeated'
  | (string & {})
export type PhaseId = string & {}
export type StepId = string & {}
export type ZoneKind = string & {}
export type ZoneScope = 'player' | 'shared' | 'global' | (string & {})
export type VisibilityPolicy =
  | 'public'
  | 'owner-private'
  | 'controller-private'
  | 'hidden'
  | (string & {})
export type ZoneOrdering = 'ordered' | 'unordered'
export type ZoneOccupancy = 'single' | 'multi' | 'slotted'
export type GamePieceKind = 'card' | 'token' | 'marker' | (string & {})
export type GameFlagKey = string & {}
export type PlayerFlagKey = string & {}
export type PlayerCounterKey = string & {}

export interface TurnState {
  readonly turnNumber: number
  readonly turnPlayerId: PlayerId
  readonly priorityPlayerId?: PlayerId
  readonly phase: PhaseId
  readonly step?: StepId
}

export interface GameFlagState {
  readonly key: GameFlagKey
  readonly enabled: boolean
}

export interface PlayerCounterState {
  readonly key: PlayerCounterKey
  readonly amount: number
  readonly visibility: VisibilityPolicy
}

export interface PlayerFlagState {
  readonly key: PlayerFlagKey
  readonly enabled: boolean
  readonly visibility: VisibilityPolicy
}

export interface PlayerState {
  readonly playerId: PlayerId
  readonly seat: number
  readonly status: PlayerStatus
  readonly ownedZoneIds: readonly ZoneId[]
  readonly counters: readonly PlayerCounterState[]
  readonly flags: readonly PlayerFlagState[]
}

export interface ZoneLayoutState {
  readonly ordering: ZoneOrdering
  readonly occupancy: ZoneOccupancy
  readonly capacity?: number
  readonly slotIds?: readonly ZoneSlotId[]
}

export interface ZoneOccupantState {
  readonly pieceId: PieceId
  readonly slotId?: ZoneSlotId
}

export interface ZoneState {
  readonly zoneId: ZoneId
  readonly kind: ZoneKind
  readonly scope: ZoneScope
  readonly ownerPlayerId?: PlayerId
  readonly visibility: VisibilityPolicy
  readonly layout: ZoneLayoutState
  readonly occupants: readonly ZoneOccupantState[]
}

export interface GamePieceState {
  readonly pieceId: PieceId
  readonly kind: GamePieceKind
  readonly cardDefinitionId?: CardId
  readonly ownerPlayerId?: PlayerId
  readonly controllerPlayerId?: PlayerId
}

export interface GameState {
  readonly gameId: GameId
  readonly formatId: FormatId
  readonly status: GameStatus
  readonly revision: number
  readonly turn: TurnState
  readonly players: readonly PlayerState[]
  readonly zones: readonly ZoneState[]
  readonly pieces: readonly GamePieceState[]
  readonly flags: readonly GameFlagState[]
  readonly pendingRequests: readonly GameChoiceRequest[]
}
