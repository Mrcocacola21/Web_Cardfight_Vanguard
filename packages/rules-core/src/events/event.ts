import type { ActionId, EventId, PieceId, PlayerId, ZoneId } from '../contracts'
import type { AttackTarget, ZoneLocationReference } from '../references'
import type { PhaseId, PlayerCounterKey, PlayerFlagKey, StepId } from '../state'

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

export type MatchEndReason = 'concede' | 'rules' | 'draw' | (string & {})

export type MatchEventType = 'match.started' | 'match.ended'

export type TurnEventType =
  | 'turn.started'
  | 'turn.ended'
  | 'turn.phase_advanced'
  | 'turn.step_advanced'

export type PieceEventType = 'piece.moved'

export type CardEventType = 'card.played' | 'card.rode' | 'card.called'

export type BattleEventType = 'battle.attack_declared' | 'battle.guard_declared'

export type PlayerResourceEventType =
  | 'player.counter_changed'
  | 'player.flag_changed'

export type GameEventType =
  | MatchEventType
  | TurnEventType
  | PieceEventType
  | CardEventType
  | BattleEventType
  | PlayerResourceEventType

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
}

interface CardCommittedEventFields {
  readonly pieceId: PieceId
  readonly from: ZoneLocationReference
  readonly to: ZoneLocationReference
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
  readonly attackerPieceId: PieceId
  readonly target: AttackTarget
}

export interface GuardDeclaredEvent extends EventBase<
  'battle.guard_declared',
  PlayerEventOrigin
> {
  readonly guardianPieceIds: readonly PieceId[]
  readonly fromZoneId: ZoneId
  readonly againstAttackerPieceId: PieceId
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

export type MatchEvent = MatchStartedEvent | MatchEndedEvent

export type TurnEvent =
  | TurnStartedEvent
  | TurnEndedEvent
  | PhaseAdvancedEvent
  | StepAdvancedEvent

export type PieceEvent = PieceMovedEvent

export type CardEvent = CardPlayedEvent | CardRodeEvent | CardCalledEvent

export type BattleEvent = AttackDeclaredEvent | GuardDeclaredEvent

export type PlayerResourceEvent =
  | PlayerCounterChangedEvent
  | PlayerFlagChangedEvent

export type GameEvent =
  | MatchEvent
  | TurnEvent
  | PieceEvent
  | CardEvent
  | BattleEvent
  | PlayerResourceEvent

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
