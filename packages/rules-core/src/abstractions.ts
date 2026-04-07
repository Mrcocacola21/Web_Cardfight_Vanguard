import type {
  Brand,
  CardId,
  EffectRefId,
  FormatId,
  GameplayCard,
} from '@web-vg/shared'

import type { GameplayFormatProjection } from './gameplay'

export type GameId = Brand<string, 'GameId'>
export type GamePlayerId = Brand<string, 'GamePlayerId'>
export type CardInstanceId = Brand<string, 'CardInstanceId'>
export type GameActionId = Brand<string, 'GameActionId'>
export type GameEventId = Brand<string, 'GameEventId'>
export type PendingEffectId = Brand<string, 'PendingEffectId'>
export type EffectHandlerKey = Brand<string, 'EffectHandlerKey'>

export type TurnPhase = 'ride' | 'main' | 'battle' | 'end' | (string & {})

export type PlayerStatus = 'active' | 'waiting' | 'defeated'

export type GameZone =
  | 'deck'
  | 'hand'
  | 'drop'
  | 'damage'
  | 'soul'
  | 'field'
  | 'ride-deck'
  | 'g-zone'
  | 'order-zone'
  | (string & {})

export type CardOrientation = 'stand' | 'rest'

export interface ZoneState {
  readonly zone: GameZone
  readonly cardInstanceIds: readonly CardInstanceId[]
}

export interface PlayerState {
  readonly playerId: GamePlayerId
  readonly status: PlayerStatus
  readonly zones: readonly ZoneState[]
}

export interface CardModifier {
  readonly kind: 'power' | 'critical' | 'shield' | (string & {})
  readonly amount: number
  readonly sourceEventId?: GameEventId
}

export interface CardInstance {
  readonly instanceId: CardInstanceId
  readonly cardId: CardId
  readonly ownerId: GamePlayerId
  readonly controllerId: GamePlayerId
  readonly zone: GameZone
  readonly faceUp: boolean
  readonly orientation?: CardOrientation
  readonly modifiers: readonly CardModifier[]
}

export type GameActionKind =
  | 'play-card'
  | 'ride'
  | 'attack'
  | 'activate-ability'
  | 'pass-priority'
  | (string & {})

export interface GameAction {
  readonly actionId: GameActionId
  readonly kind: GameActionKind
  readonly playerId: GamePlayerId
  readonly sourceInstanceId?: CardInstanceId
  readonly targetInstanceIds?: readonly CardInstanceId[]
  readonly effectRefId?: EffectRefId
}

export type GameEventKind =
  | 'card-moved'
  | 'attack-declared'
  | 'damage-dealt'
  | 'ability-activated'
  | 'turn-advanced'
  | 'effect-enqueued'
  | (string & {})

export interface GameEvent {
  readonly eventId: GameEventId
  readonly kind: GameEventKind
  readonly relatedActionId?: GameActionId
  readonly sourcePlayerId?: GamePlayerId
  readonly sourceInstanceId?: CardInstanceId
  readonly targetInstanceId?: CardInstanceId
  readonly effectRefId?: EffectRefId
}

export interface PendingEffect {
  readonly pendingEffectId: PendingEffectId
  readonly effectRefId: EffectRefId
  readonly sourceInstanceId?: CardInstanceId
  readonly triggeringEventId?: GameEventId
}

export interface GameState {
  readonly gameId: GameId
  readonly formatId: FormatId
  readonly activePlayerId: GamePlayerId
  readonly turnNumber: number
  readonly phase: TurnPhase
  readonly players: readonly PlayerState[]
  readonly cardInstances: readonly CardInstance[]
  readonly pendingEvents: readonly GameEvent[]
  readonly pendingEffects: readonly PendingEffect[]
}

export interface EffectRegistration {
  readonly effectRefId: EffectRefId
  readonly handlerKey: EffectHandlerKey
}

export interface GameContext {
  readonly state: GameState
  readonly format: GameplayFormatProjection
  readonly cards: readonly GameplayCard[]
  readonly effectRegistry: EffectRegistry
}

export interface ActionContext {
  readonly game: GameContext
  readonly action: GameAction
}

export interface EffectContext {
  readonly game: GameContext
  readonly sourceInstanceId?: CardInstanceId
  readonly triggeringAction?: GameAction
  readonly triggeringEvent?: GameEvent
  readonly effectRefId: EffectRefId
}

export interface EffectHandler {
  readonly key: EffectHandlerKey
  handle(context: EffectContext): readonly GameEvent[]
}

export interface EffectRegistry {
  readonly registrations: readonly EffectRegistration[]
  readonly handlers: readonly EffectHandler[]
}
