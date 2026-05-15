import type { TriggerType } from '@web-vg/shared'

import type {
  ActionId,
  BattleId,
  EffectDefinitionId,
  EventId,
  PieceId,
  PlayerId,
  RequestId,
  RequestOptionId,
  ZoneId,
} from '../contracts'
import type {
  AttackTarget,
  TargetReference,
  ZoneLocationReference,
} from '../references'
import type {
  ChoiceResponseSkipReason,
  GameChoiceRequestType,
  GameChoiceResponseType,
  RequestPurpose,
  RequestVisibility,
} from '../requests'
import type {
  BattleCombatState,
  BattleCheckState,
  BattleDamageState,
  CheckTriggerResolutionState,
  PhaseId,
  PlayerCounterKey,
  PlayerFlagKey,
  RevealedCheckCardState,
  StepId,
} from '../state'
import type { ZoneTransferReason } from '../transfers'

export type SystemEventSource =
  | 'rules-engine'
  | 'match-setup'
  | 'automatic-flow'
  | (string & {})

export interface PlayerEventOrigin {
  readonly kind: 'player'
  readonly playerId: PlayerId
}

export interface SystemEventOrigin {
  readonly kind: 'system'
  readonly system: SystemEventSource
}

export type EventOrigin = PlayerEventOrigin | SystemEventOrigin
export type EventSequenceNumber = number

export type MatchEndReason =
  | 'concede'
  | 'rules'
  | 'draw'
  | 'damage_defeat'
  | (string & {})
export type BattleCompletionReason =
  | 'damage_check_completed'
  | 'damage_defeat'
  | 'attack_missed'
  | (string & {})
export type ChoiceResponseOutcome =
  | 'selection_made'
  | 'branch_chosen'
  | 'boolean_confirmed'
  | 'boolean_declined'
  | 'optional_declined'
  | (string & {})

export type MatchEventType = 'match.started' | 'match.ended'

export type MulliganEventType = 'mulligan.started' | 'mulligan.completed'

export type TurnEventType =
  | 'turn.started'
  | 'turn.ended'
  | 'turn.cleanup_applied'
  | 'turn.phase_advanced'
  | 'turn.step_advanced'

export type PieceEventType =
  | 'piece.moved'
  | 'piece.rested'
  | 'piece.stood'
  | 'piece.locked'
  | 'piece.unlocked'

export type ZoneEventType = 'zone.shuffled'

export type CardEventType =
  | 'card.played'
  | 'card.rode'
  | 'card.called'
  | 'cards.drawn'

export type BattleEventType =
  | 'battle.attack_declared'
  | 'battle.boost_declared'
  | 'battle.guard_requested'
  | 'battle.intercept_declared'
  | 'battle.guard_declared'
  | 'battle.guard_passed'
  | 'battle.drive_checked'
  | 'battle.combat_resolved'
  | 'battle.attack_hit'
  | 'battle.attack_missed'
  | 'battle.damage_checked'
  | 'battle.guardians_cleaned_up'
  | 'battle.completed'

export type ChoiceEventType = 'choice.response_resolved'

export type PlayerResourceEventType =
  | 'player.counter_changed'
  | 'player.flag_changed'
  | 'player.damage_changed'
  | 'player.defeated'

export type ResourceEventType =
  | 'resource.counter_blasted'
  | 'resource.counter_charged'
  | 'resource.soul_blasted'
  | 'resource.soul_charged'

export type EffectEventType = 'effect.resolved'

export type TriggerEventType = 'trigger.revealed' | 'trigger.resolved'

export type GameEventType =
  | MatchEventType
  | MulliganEventType
  | TurnEventType
  | PieceEventType
  | ZoneEventType
  | CardEventType
  | BattleEventType
  | ChoiceEventType
  | PlayerResourceEventType
  | ResourceEventType
  | EffectEventType
  | TriggerEventType

export type EventType = GameEventType

interface EventBase<TType extends GameEventType, TOrigin extends EventOrigin> {
  readonly eventId: EventId
  readonly type: TType
  readonly sequence: EventSequenceNumber
  readonly sourceActionId?: ActionId
  readonly origin: TOrigin
}

export interface MatchStartedEvent extends EventBase<
  'match.started',
  SystemEventOrigin
> {
  readonly startingPlayerId: PlayerId
}

export interface MatchEndedEvent extends EventBase<'match.ended', EventOrigin> {
  readonly reason: MatchEndReason
  readonly winnerPlayerId?: PlayerId
  readonly loserPlayerId?: PlayerId
}

export interface MulliganStartedEvent extends EventBase<
  'mulligan.started',
  SystemEventOrigin
> {
  readonly playerId: PlayerId
  readonly requestId: RequestId
  readonly handZoneId: ZoneId
  readonly deckZoneId: ZoneId
}

export interface MulliganCompletedEvent extends EventBase<
  'mulligan.completed',
  SystemEventOrigin
> {
  readonly playerId: PlayerId
  readonly requestId: RequestId
  readonly returnedPieceIds: readonly PieceId[]
  readonly drawnPieceIds: readonly PieceId[]
}

export interface TurnStartedEvent extends EventBase<
  'turn.started',
  SystemEventOrigin
> {
  readonly turnNumber: number
  readonly turnPlayerId: PlayerId
}

export interface TurnEndedEvent extends EventBase<'turn.ended', EventOrigin> {
  readonly turnNumber: number
  readonly turnPlayerId: PlayerId
}

export interface TurnCleanupAppliedEvent extends EventBase<
  'turn.cleanup_applied',
  SystemEventOrigin
> {
  readonly turnNumber: number
  readonly turnPlayerId: PlayerId
  readonly cleanedPieceIds: readonly PieceId[]
  readonly removedFlagPieceIds: readonly PieceId[]
  readonly clearedModifierPieceIds: readonly PieceId[]
}

export interface PhaseAdvancedEvent extends EventBase<
  'turn.phase_advanced',
  SystemEventOrigin
> {
  readonly turnNumber: number
  readonly previousPhase?: PhaseId
  readonly nextPhase: PhaseId
}

export interface StepAdvancedEvent extends EventBase<
  'turn.step_advanced',
  SystemEventOrigin
> {
  readonly turnNumber: number
  readonly phase: PhaseId
  readonly previousStep?: StepId
  readonly nextStep: StepId
}

export interface PieceMovedEvent extends EventBase<'piece.moved', EventOrigin> {
  readonly pieceId: PieceId
  readonly from: ZoneLocationReference
  readonly to: ZoneLocationReference
  readonly reason: ZoneTransferReason
}

interface PieceStateChangedEventFields {
  readonly pieceId: PieceId
  readonly zoneId: ZoneId
}

export interface PieceRestedEvent
  extends
    EventBase<'piece.rested', EventOrigin>,
    PieceStateChangedEventFields {}

export interface PieceStoodEvent
  extends EventBase<'piece.stood', EventOrigin>, PieceStateChangedEventFields {}

export interface PieceLockedEvent
  extends
    EventBase<'piece.locked', EventOrigin>,
    PieceStateChangedEventFields {}

export interface PieceUnlockedEvent
  extends
    EventBase<'piece.unlocked', EventOrigin>,
    PieceStateChangedEventFields {}

export interface ZoneShuffledEvent extends EventBase<
  'zone.shuffled',
  SystemEventOrigin
> {
  readonly zoneId: ZoneId
  readonly orderedPieceIds: readonly PieceId[]
}

interface CardCommittedEventFields {
  readonly pieceId: PieceId
  readonly from: ZoneLocationReference
  readonly to: ZoneLocationReference
}

export interface CardsDrawnEvent extends EventBase<
  'cards.drawn',
  SystemEventOrigin
> {
  readonly playerId: PlayerId
  readonly fromZoneId: ZoneId
  readonly toZoneId: ZoneId
  readonly pieceIds: readonly PieceId[]
}

export interface CardPlayedEvent
  extends
    EventBase<'card.played', PlayerEventOrigin>,
    CardCommittedEventFields {}

export interface CardRodeEvent
  extends EventBase<'card.rode', PlayerEventOrigin>, CardCommittedEventFields {
  readonly ridingOverPieceId?: PieceId
}

export interface CardCalledEvent
  extends
    EventBase<'card.called', PlayerEventOrigin>,
    CardCommittedEventFields {}

export interface AttackDeclaredEvent extends EventBase<
  'battle.attack_declared',
  PlayerEventOrigin
> {
  readonly battleId: BattleId
  readonly attackerPieceId: PieceId
  readonly target: AttackTarget
}

export interface BoostDeclaredEvent extends EventBase<
  'battle.boost_declared',
  PlayerEventOrigin
> {
  readonly battleId: BattleId
  readonly attackerPieceId: PieceId
  readonly boosterPieceId: PieceId
}

export interface GuardRequestedEvent extends EventBase<
  'battle.guard_requested',
  PlayerEventOrigin
> {
  readonly battleId: BattleId
  readonly requestId: RequestId
  readonly defendingPlayerId: PlayerId
  readonly attackerPieceId: PieceId
}

export interface GuardDeclaredEvent extends EventBase<
  'battle.guard_declared',
  PlayerEventOrigin
> {
  readonly battleId: BattleId
  readonly guardianPieceIds: readonly PieceId[]
  readonly handPieceIds?: readonly PieceId[]
  readonly interceptPieceIds?: readonly PieceId[]
  readonly handZoneId: ZoneId
  readonly guardZoneId: ZoneId
  readonly attackerPieceId: PieceId
}

export interface InterceptDeclaredEvent extends EventBase<
  'battle.intercept_declared',
  PlayerEventOrigin
> {
  readonly battleId: BattleId
  readonly interceptPieceIds: readonly PieceId[]
  readonly fromZoneIds: readonly ZoneId[]
  readonly guardZoneId: ZoneId
  readonly attackerPieceId: PieceId
}

export interface GuardPassedEvent extends EventBase<
  'battle.guard_passed',
  PlayerEventOrigin
> {
  readonly battleId: BattleId
  readonly requestId: RequestId
  readonly handZoneId: ZoneId
  readonly guardZoneId: ZoneId
  readonly attackerPieceId: PieceId
}

interface CheckResolvedEventFields {
  readonly battleId: BattleId
  readonly playerId: PlayerId
  readonly fromZoneId: ZoneId
  readonly toZoneId: ZoneId
  readonly revealedCards: readonly RevealedCheckCardState[]
  readonly triggerResolutionState: CheckTriggerResolutionState
}

export interface DriveCheckedEvent
  extends
    EventBase<'battle.drive_checked', SystemEventOrigin>,
    CheckResolvedEventFields {}

export interface DamageCheckedEvent
  extends
    EventBase<'battle.damage_checked', SystemEventOrigin>,
    CheckResolvedEventFields {
  readonly damage: BattleDamageState
}

export interface CombatResolvedEvent extends EventBase<
  'battle.combat_resolved',
  SystemEventOrigin
> {
  readonly battleId: BattleId
  readonly attackerPieceId: PieceId
  readonly target: AttackTarget
  readonly combat: BattleCombatState
}

interface AttackResultEventFields {
  readonly battleId: BattleId
  readonly attackerPieceId: PieceId
  readonly target: AttackTarget
  readonly attackPower: number
  readonly totalDefensePower: number
}

export interface AttackHitEvent
  extends
    EventBase<'battle.attack_hit', SystemEventOrigin>,
    AttackResultEventFields {}

export interface AttackMissedEvent
  extends
    EventBase<'battle.attack_missed', SystemEventOrigin>,
    AttackResultEventFields {}

export interface BattleCompletedEvent extends EventBase<
  'battle.completed',
  SystemEventOrigin
> {
  readonly battleId: BattleId
  readonly reason: BattleCompletionReason
  readonly attackingPlayerId: PlayerId
  readonly defendingPlayerId: PlayerId
  readonly attackerPieceId: PieceId
  readonly attackerZoneId: ZoneId
  readonly target: AttackTarget
  readonly boostingPieceId?: PieceId
  readonly boostingZoneId?: ZoneId
  readonly guardPieceIds: readonly PieceId[]
  readonly guardZoneId?: ZoneId
  readonly lastCheck?: BattleCheckState
  readonly combat?: BattleCombatState
  readonly damage?: BattleDamageState
  readonly cleanupMovedPieceIds: readonly PieceId[]
  readonly cleanupFromZoneId?: ZoneId
  readonly cleanupToZoneId?: ZoneId
}

export interface BattleGuardiansCleanedUpEvent extends EventBase<
  'battle.guardians_cleaned_up',
  SystemEventOrigin
> {
  readonly battleId: BattleId
  readonly defendingPlayerId: PlayerId
  readonly guardPieceIds: readonly PieceId[]
  readonly fromZoneId: ZoneId
  readonly toZoneId: ZoneId
}

export interface ChoiceResponseResolvedEvent extends EventBase<
  'choice.response_resolved',
  PlayerEventOrigin
> {
  readonly requestId: RequestId
  readonly requestType: GameChoiceRequestType
  readonly responseType: GameChoiceResponseType
  readonly responderPlayerId: PlayerId
  readonly purpose: RequestPurpose
  readonly visibility: RequestVisibility
  readonly outcome: ChoiceResponseOutcome
  readonly selectedPieceIds?: readonly PieceId[]
  readonly selectedTargets?: readonly TargetReference[]
  readonly selectedLocations?: readonly ZoneLocationReference[]
  readonly selectedOptionIds?: readonly RequestOptionId[]
  readonly accepted?: boolean
  readonly skipReason?: ChoiceResponseSkipReason
  readonly returnedPieceIds?: readonly PieceId[]
}

export interface PlayerCounterChangedEvent extends EventBase<
  'player.counter_changed',
  EventOrigin
> {
  readonly playerId: PlayerId
  readonly counterKey: PlayerCounterKey
  readonly previousAmount: number
  readonly nextAmount: number
}

export interface PlayerFlagChangedEvent extends EventBase<
  'player.flag_changed',
  EventOrigin
> {
  readonly playerId: PlayerId
  readonly flagKey: PlayerFlagKey
  readonly previousEnabled: boolean
  readonly nextEnabled: boolean
}

export interface PlayerDamageChangedEvent extends EventBase<
  'player.damage_changed',
  SystemEventOrigin
> {
  readonly playerId: PlayerId
  readonly battleId?: BattleId
  readonly damageZoneId: ZoneId
  readonly previousDamage: number
  readonly nextDamage: number
  readonly defeatThreshold: number
  readonly outcome: BattleDamageState['outcome']
  readonly movedPieceIds: readonly PieceId[]
}

export interface PlayerDefeatedEvent extends EventBase<
  'player.defeated',
  SystemEventOrigin
> {
  readonly playerId: PlayerId
  readonly reason: 'damage' | (string & {})
  readonly damageCount?: number
  readonly defeatThreshold?: number
}

export interface CounterBlastedEvent extends EventBase<
  'resource.counter_blasted',
  SystemEventOrigin
> {
  readonly playerId: PlayerId
  readonly fromZoneId: ZoneId
  readonly pieceIds: readonly PieceId[]
  readonly count: number
}

export interface CounterChargedEvent extends EventBase<
  'resource.counter_charged',
  SystemEventOrigin
> {
  readonly playerId: PlayerId
  readonly toZoneId: ZoneId
  readonly pieceIds: readonly PieceId[]
  readonly count: number
}

export interface SoulBlastedEvent extends EventBase<
  'resource.soul_blasted',
  SystemEventOrigin
> {
  readonly playerId: PlayerId
  readonly fromZoneId: ZoneId
  readonly toZoneId: ZoneId
  readonly pieceIds: readonly PieceId[]
  readonly count: number
}

export interface SoulChargedEvent extends EventBase<
  'resource.soul_charged',
  SystemEventOrigin
> {
  readonly playerId: PlayerId
  readonly fromZoneId: ZoneId
  readonly toZoneId: ZoneId
  readonly pieceIds: readonly PieceId[]
  readonly count: number
}

export interface EffectResolvedEvent extends EventBase<
  'effect.resolved',
  SystemEventOrigin
> {
  readonly effectDefinitionId: EffectDefinitionId
  readonly sourcePieceId?: PieceId
  readonly triggerEventSequence?: EventSequenceNumber
  readonly operationKinds: readonly string[]
}

export type TriggerCheckKind = 'drive' | 'damage'
export type TriggerResolutionOutcome = 'applied' | 'not_applicable'

export interface TriggerHealConditionState {
  readonly met: boolean
  readonly playerDamage: number
  readonly opponentDamage: number
}

export interface TriggerRevealedEvent extends EventBase<
  'trigger.revealed',
  SystemEventOrigin
> {
  readonly battleId: BattleId
  readonly checkKind: TriggerCheckKind
  readonly playerId: PlayerId
  readonly revealedPieceId: PieceId
  readonly cardDefinitionId?: RevealedCheckCardState['cardDefinitionId']
  readonly triggerType: TriggerType
  readonly sourceCheckEventSequence: EventSequenceNumber
}

export interface TriggerResolvedEvent extends EventBase<
  'trigger.resolved',
  SystemEventOrigin
> {
  readonly battleId: BattleId
  readonly checkKind: TriggerCheckKind
  readonly playerId: PlayerId
  readonly revealedPieceId: PieceId
  readonly triggerType: TriggerType
  readonly sourceCheckEventSequence: EventSequenceNumber
  readonly outcome: TriggerResolutionOutcome
  readonly powerAmount?: number
  readonly powerTargetPieceIds?: readonly PieceId[]
  readonly criticalAmount?: number
  readonly criticalTargetPieceId?: PieceId
  readonly drawnPieceIds?: readonly PieceId[]
  readonly stoodPieceId?: PieceId
  readonly healedPieceId?: PieceId
  readonly healCondition?: TriggerHealConditionState
  readonly overTriggerApplied?: boolean
}

export type MatchEvent = MatchStartedEvent | MatchEndedEvent

export type MulliganEvent = MulliganStartedEvent | MulliganCompletedEvent

export type TurnEvent =
  | TurnStartedEvent
  | TurnEndedEvent
  | TurnCleanupAppliedEvent
  | PhaseAdvancedEvent
  | StepAdvancedEvent

export type PieceEvent =
  | PieceMovedEvent
  | PieceRestedEvent
  | PieceStoodEvent
  | PieceLockedEvent
  | PieceUnlockedEvent

export type ZoneEvent = ZoneShuffledEvent

export type CardEvent =
  | CardPlayedEvent
  | CardRodeEvent
  | CardCalledEvent
  | CardsDrawnEvent

export type BattleEvent =
  | AttackDeclaredEvent
  | BoostDeclaredEvent
  | GuardRequestedEvent
  | InterceptDeclaredEvent
  | GuardDeclaredEvent
  | GuardPassedEvent
  | DriveCheckedEvent
  | CombatResolvedEvent
  | AttackHitEvent
  | AttackMissedEvent
  | DamageCheckedEvent
  | BattleGuardiansCleanedUpEvent
  | BattleCompletedEvent

export type ChoiceEvent = ChoiceResponseResolvedEvent

export type PlayerResourceEvent =
  | PlayerCounterChangedEvent
  | PlayerFlagChangedEvent
  | PlayerDamageChangedEvent
  | PlayerDefeatedEvent

export type ResourceEvent =
  | CounterBlastedEvent
  | CounterChargedEvent
  | SoulBlastedEvent
  | SoulChargedEvent

export type EffectEvent = EffectResolvedEvent

export type TriggerEvent = TriggerRevealedEvent | TriggerResolvedEvent

export type GameEvent =
  | MatchEvent
  | MulliganEvent
  | TurnEvent
  | PieceEvent
  | ZoneEvent
  | CardEvent
  | BattleEvent
  | ChoiceEvent
  | PlayerResourceEvent
  | ResourceEvent
  | EffectEvent
  | TriggerEvent

export function isPlayerOriginatedEvent(
  event: GameEvent,
): event is Extract<GameEvent, { readonly origin: PlayerEventOrigin }> {
  return event.origin.kind === 'player'
}

export function isSystemOriginatedEvent(
  event: GameEvent,
): event is Extract<GameEvent, { readonly origin: SystemEventOrigin }> {
  return event.origin.kind === 'system'
}
