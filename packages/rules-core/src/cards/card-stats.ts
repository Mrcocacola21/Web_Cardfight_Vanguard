import type {
  CardId,
  CardType,
  GameplayCard,
  TriggerType,
} from '@web-vg/shared'

import { assertRulesInvariant } from '../errors'
import type { GamePieceState, GameState } from '../state'

import type {
  CardStatsResolutionResult,
  EngineCardStats,
  EngineCardStatsSnapshot,
} from './card-stats-contract'

const CARD_TYPES = new Set<CardType>([
  'normal-unit',
  'trigger-unit',
  'normal-order',
  'blitz-order',
  'set-order',
  'token',
])

const TRIGGER_TYPES = new Set<TriggerType>([
  'critical',
  'draw',
  'front',
  'heal',
  'stand',
  'over',
])

export function buildEngineCardStatsSnapshot(
  cards: readonly EngineCardStats[],
): EngineCardStatsSnapshot {
  const snapshot: EngineCardStatsSnapshot = {
    cards: [...cards].sort(compareEngineCardStats),
  }

  assertEngineCardStatsSnapshotInvariant(snapshot)

  return snapshot
}

export function buildEngineCardStatsSnapshotFromGameplayCards(
  cards: readonly GameplayCard[],
): EngineCardStatsSnapshot {
  return buildEngineCardStatsSnapshot(cards.map(mapGameplayCardToEngineStats))
}

export function mapGameplayCardToEngineStats(
  card: GameplayCard,
): EngineCardStats {
  assertRulesInvariant(
    card.power !== undefined,
    `Gameplay card ${card.cardId} is missing required engine stat power.`,
  )
  assertRulesInvariant(
    card.shield !== undefined,
    `Gameplay card ${card.cardId} is missing required engine stat shield.`,
  )
  assertRulesInvariant(
    card.critical !== undefined,
    `Gameplay card ${card.cardId} is missing required engine stat critical.`,
  )

  return {
    cardDefinitionId: card.cardId,
    name: card.name,
    cardType: card.cardType,
    grade: card.grade,
    nation: card.nation,
    ...(card.clan === undefined ? {} : { clan: card.clan }),
    power: card.power,
    shield: card.shield,
    critical: card.critical,
    triggerType: card.triggerType ?? null,
    keywords: card.keywords,
    effectRefs: card.effectRefs.map((effect) => effect.id),
  }
}

export function assertEngineCardStatsSnapshotInvariant(
  snapshot: EngineCardStatsSnapshot,
): void {
  const cardDefinitionIds = snapshot.cards.map(
    (card) => card.cardDefinitionId as string,
  )

  assertRulesInvariant(
    new Set(cardDefinitionIds).size === cardDefinitionIds.length,
    'Engine card stats snapshot must not repeat card definition ids.',
  )

  for (const card of snapshot.cards) {
    assertEngineCardStatsInvariant(card)
  }
}

export function assertEngineCardStatsInvariant(card: EngineCardStats): void {
  assertRulesInvariant(
    isNonEmptyString(card.cardDefinitionId),
    'Engine card stats must reference a card definition id.',
  )
  assertRulesInvariant(
    CARD_TYPES.has(card.cardType),
    `Engine card stats ${card.cardDefinitionId} has unsupported card type ${card.cardType}.`,
  )
  assertRulesInvariant(
    isSafeIntegerInRange(card.grade, 0, 10),
    `Engine card stats ${card.cardDefinitionId} grade must be a safe integer between 0 and 10.`,
  )
  assertRulesInvariant(
    isNonNegativeSafeInteger(card.power),
    `Engine card stats ${card.cardDefinitionId} power must be a non-negative safe integer.`,
  )
  assertRulesInvariant(
    isNonNegativeSafeInteger(card.shield),
    `Engine card stats ${card.cardDefinitionId} shield must be a non-negative safe integer.`,
  )
  assertRulesInvariant(
    isNonNegativeSafeInteger(card.critical),
    `Engine card stats ${card.cardDefinitionId} critical must be a non-negative safe integer.`,
  )

  if (card.triggerType !== null) {
    assertRulesInvariant(
      TRIGGER_TYPES.has(card.triggerType),
      `Engine card stats ${card.cardDefinitionId} has unsupported trigger type ${card.triggerType}.`,
    )
  }

  assertRulesInvariant(
    card.cardType === 'trigger-unit'
      ? card.triggerType !== null
      : card.triggerType === null,
    `Engine card stats ${card.cardDefinitionId} trigger type must match trigger-unit card type.`,
  )
  assertRulesInvariant(
    new Set(card.keywords.map((keyword) => keyword as string)).size ===
      card.keywords.length,
    `Engine card stats ${card.cardDefinitionId} must not repeat keywords.`,
  )
}

export function resolveEngineCardStats(
  snapshot: EngineCardStatsSnapshot,
  cardDefinitionId: CardId,
): EngineCardStats | undefined {
  return snapshot.cards.find(
    (card) => card.cardDefinitionId === cardDefinitionId,
  )
}

export function requireEngineCardStats(
  snapshot: EngineCardStatsSnapshot,
  cardDefinitionId: CardId,
): EngineCardStats {
  const stats = resolveEngineCardStats(snapshot, cardDefinitionId)

  assertRulesInvariant(
    stats !== undefined,
    `Engine card stats snapshot is missing card definition ${cardDefinitionId}.`,
  )

  return stats
}

export function resolveGamePieceCardStats(
  state: GameState,
  piece: GamePieceState,
): CardStatsResolutionResult {
  if (state.cardStats === undefined) {
    return {
      ok: false,
      issue: {
        code: 'missing_card_stats_snapshot',
        message: `Game state ${state.gameId} does not include an engine card stats snapshot.`,
      },
    }
  }

  if (piece.cardDefinitionId === undefined) {
    return {
      ok: false,
      issue: {
        code: 'missing_card_definition_id',
        message: `Piece ${piece.pieceId} does not reference a card definition id.`,
      },
    }
  }

  const stats = resolveEngineCardStats(state.cardStats, piece.cardDefinitionId)

  if (stats === undefined) {
    return {
      ok: false,
      issue: {
        code: 'missing_card_stats',
        message: `Engine card stats snapshot is missing card definition ${piece.cardDefinitionId}.`,
      },
    }
  }

  return {
    ok: true,
    stats,
  }
}

export function requireGamePieceCardStats(
  state: GameState,
  piece: GamePieceState,
): EngineCardStats {
  const result = resolveGamePieceCardStats(state, piece)

  if (!result.ok) {
    assertRulesInvariant(false, result.issue.message)
  }

  return result.stats
}

export function isNormalUnitCardStats(stats: EngineCardStats): boolean {
  return stats.cardType === 'normal-unit'
}

export function isTriggerUnitCardStats(stats: EngineCardStats): boolean {
  return stats.cardType === 'trigger-unit'
}

export function isUnitCardStats(stats: EngineCardStats): boolean {
  return isNormalUnitCardStats(stats) || isTriggerUnitCardStats(stats)
}

export function isOrderCardStats(stats: EngineCardStats): boolean {
  return (
    stats.cardType === 'normal-order' ||
    stats.cardType === 'blitz-order' ||
    stats.cardType === 'set-order'
  )
}

function compareEngineCardStats(
  left: EngineCardStats,
  right: EngineCardStats,
): number {
  return (left.cardDefinitionId as string).localeCompare(
    right.cardDefinitionId as string,
  )
}

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

function isSafeIntegerInRange(
  value: number,
  min: number,
  max: number,
): boolean {
  return Number.isSafeInteger(value) && value >= min && value <= max
}
