import type { CardId, FormatId, Keyword, TriggerType } from '@web-vg/shared'

import type {
  ActionId,
  BattleId,
  EffectDefinitionId,
  GameId,
  PieceId,
  PlayerId,
  RequestId,
  ZoneId,
  ZoneSlotId,
} from '../contracts'
import type { GameChoiceRequest } from '../requests'
import type { AttackTarget } from '../references'
import type { EngineCardStatsSnapshot } from '../cards/card-stats-contract'

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
  | 'combat_resolved'
  | 'damage_checked'
  | (string & {})
export type BattleCheckKind = 'drive' | 'damage'
export type BattleCombatResult = 'hit' | 'miss'
export type BattleDamageOutcome = 'non_lethal' | 'lethal'
export type CheckTriggerResolutionState =
  | 'pending_resolution'
  | 'awaiting_choice'
  | 'resolved_none'
  | 'resolved_triggers'
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
  readonly powerModifier?: number
  readonly criticalModifier?: number
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
  readonly triggerContinuation?: TriggerResolutionContinuationState
}

export interface TriggerResolutionContinuationState {
  readonly requestId: RequestId
  readonly effectDefinitionId: EffectDefinitionId
  readonly sourceActionId?: ActionId
  readonly sourceCheckEventSequence: number
  readonly revealedCardIndex: number
  readonly nextRevealedCardIndex: number
  readonly resolvedTriggers: number
  readonly operationKinds: readonly string[]
  readonly triggerType: TriggerType
  readonly revealedPieceId: PieceId
  readonly powerAmount?: number
  readonly criticalAmount?: number
  readonly powerEligiblePieceIds?: readonly PieceId[]
  readonly criticalEligiblePieceIds?: readonly PieceId[]
  readonly standEligiblePieceIds?: readonly PieceId[]
  readonly healEligiblePieceIds?: readonly PieceId[]
  readonly healCondition?: TriggerHealContinuationState
}

export interface TriggerHealContinuationState {
  readonly met: boolean
  readonly playerDamage: number
  readonly opponentDamage: number
}

export interface BattleCombatPowerComponentState {
  readonly source:
    | 'attacker_base'
    | 'booster_base'
    | 'defender_base'
    | 'piece_power_modifier'
    | 'guard_shield'
    | (string & {})
  readonly pieceId?: PieceId
  readonly amount: number
}

export interface BattleCombatCriticalComponentState {
  readonly source:
    | 'attacker_base_critical'
    | 'piece_critical_modifier'
    | (string & {})
  readonly pieceId?: PieceId
  readonly amount: number
}

export interface BattleCombatState {
  readonly attackPower: number
  readonly attackerPowerComponents: readonly BattleCombatPowerComponentState[]
  readonly attackCritical: number
  readonly attackerCriticalComponents: readonly BattleCombatCriticalComponentState[]
  readonly defensePower: number
  readonly defensePowerComponents: readonly BattleCombatPowerComponentState[]
  readonly shieldPower: number
  readonly shieldComponents: readonly BattleCombatPowerComponentState[]
  readonly totalDefensePower: number
  readonly damageCheckCount: number
  readonly result: BattleCombatResult
}

export interface BattleDamageState {
  readonly playerId: PlayerId
  readonly damageZoneId: ZoneId
  readonly damageBefore: number
  readonly damageAfter: number
  readonly defeatThreshold: number
  readonly outcome: BattleDamageOutcome
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
  readonly combat?: BattleCombatState
  readonly damage?: BattleDamageState
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
  readonly cardStats?: EngineCardStatsSnapshot
  readonly pieceStates: readonly GamePieceStatusState[]
  readonly flags: readonly GameFlagState[]
  readonly battle?: BattleState
  /**
   * Ordered FIFO queue of pending choice requests.
   *
   * **Contract:**
   * - Index 0 is always the **active** request that the game is currently awaiting
   *   a response for. When `status === 'awaiting_choice'`, exactly one request
   *   at index 0 must be present and must be the target of the next choice response.
   * - When a choice response is resolved, the head request is consumed
   *   (`pendingRequests.slice(1)`). If the same suspended resolution flow creates
   *   an immediate continuation request, that request becomes the new head before
   *   older queued requests; unrelated follow-up requests are appended to the tail.
   * - Transitions that set `status = 'awaiting_choice'` must ensure
   *   `pendingRequests.length >= 1`.
   * - When `pendingRequests.length === 0`, `status` must not be `'awaiting_choice'`.
   */
  readonly pendingRequests: readonly GameChoiceRequest[]
}
