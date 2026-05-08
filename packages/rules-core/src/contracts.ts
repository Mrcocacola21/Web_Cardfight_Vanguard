import type { Brand } from '@web-vg/shared'

export type GameId = Brand<string, 'RulesGameId'>
export type PlayerId = Brand<string, 'RulesPlayerId'>
export type ZoneId = Brand<string, 'RulesZoneId'>
export type ZoneSlotId = Brand<string, 'RulesZoneSlotId'>
export type PieceId = Brand<string, 'RulesPieceId'>
export type ActionId = Brand<string, 'RulesActionId'>
export type EventId = Brand<string, 'RulesEventId'>
export type EffectDefinitionId = Brand<string, 'RulesEffectDefinitionId'>
export type RequestId = Brand<string, 'RulesRequestId'>
export type RequestOptionId = Brand<string, 'RulesRequestOptionId'>
export type TransitionId = Brand<string, 'RulesTransitionId'>
export type BattleId = Brand<string, 'RulesBattleId'>
