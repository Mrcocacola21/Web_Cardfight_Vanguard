import type { CardId, FormatId, Keyword } from '@web-vg/shared'

import type {
  BattleId,
  GameId,
  PieceId,
  PlayerId,
  RequestId,
  ZoneId,
  ZoneSlotId,
} from '../contracts'
import type { GameChoiceRequest } from '../requests'
import type { AttackTarget } from '../references'

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
export type GamePieceOrientation = 'stand' | 'rest'
export type GamePieceFlagKey = 'locked' | (string & {})
export type GameFlagKey = string & {}
export type PlayerFlagKey = string & {}
export type PlayerCounterKey = string & {}
export type BattleStatus =
  | 'attack_declared'
  | 'boost_declared'
  | 'guard_requested'
  | 'guard_resolved'
  | 'drive_checked'
  | 'damage_checked'
  | (string & {})
export type BattleCheckKind = 'drive' | 'damage'
export type CheckTriggerResolutionState =
  | 'pending_future_engine'
  | 'resolved_none'
  | (string & {})

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
  readonly keywords?: readonly Keyword[]
  readonly ownerPlayerId?: PlayerId
  readonly controllerPlayerId?: PlayerId
}

export interface GamePieceStatusState {
  readonly pieceId: PieceId
  readonly orientation: GamePieceOrientation
  readonly flags: readonly GamePieceFlagKey[]
}

export interface RevealedCheckCardState {
  readonly pieceId: PieceId
  readonly cardDefinitionId?: CardId
}

export interface BattleCheckState {
  readonly kind: BattleCheckKind
  readonly playerId: PlayerId
  readonly fromZoneId: ZoneId
  readonly toZoneId: ZoneId
  readonly revealedCards: readonly RevealedCheckCardState[]
  readonly triggerResolutionState: CheckTriggerResolutionState
}

export interface BattleState {
  readonly battleId: BattleId
  readonly status: BattleStatus
  readonly attackingPlayerId: PlayerId
  readonly defendingPlayerId: PlayerId
  readonly attackerPieceId: PieceId
  readonly attackerZoneId: ZoneId
  readonly target: AttackTarget
  readonly boostingPieceId?: PieceId
  readonly boostingZoneId?: ZoneId
  readonly guardPieceIds: readonly PieceId[]
  readonly guardZoneId?: ZoneId
  readonly guardRequestId?: RequestId
  readonly lastCheck?: BattleCheckState
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
  readonly pieceStates: readonly GamePieceStatusState[]
  readonly flags: readonly GameFlagState[]
  readonly battle?: BattleState
  readonly pendingRequests: readonly GameChoiceRequest[]
}
