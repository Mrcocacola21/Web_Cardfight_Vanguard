import { describe, expect, it } from 'vitest'

import type { CardId, GameplayCard } from '@web-vg/shared'

import { RulesInvariantError } from '../errors'
import type { GameState, PieceId, PlayerId, ZoneId } from '../index'
import {
  assertGameStateCardStatsComplete,
  assertGameStateInvariant,
} from '../state'

import {
  buildEngineCardStatsSnapshot,
  buildEngineCardStatsSnapshotFromGameplayCards,
  isNormalUnitCardStats,
  isOrderCardStats,
  isTriggerUnitCardStats,
  isUnitCardStats,
  requireGamePieceCardStats,
  resolveEngineCardStats,
  resolveGamePieceCardStats,
} from './card-stats'
import type { EngineCardStatsSnapshot } from './card-stats-contract'

const PLAYER_ID = 'player-card-stats' as PlayerId
const CARD_NORMAL_ID = 'card-normal-unit' as CardId
const CARD_TRIGGER_ID = 'card-critical-trigger' as CardId

describe('@web-vg/rules-core engine card stats bridge', () => {
  it('maps published gameplay cards into the engine-facing stats contract', () => {
    const snapshot = buildEngineCardStatsSnapshotFromGameplayCards([
      gameplayCard(CARD_NORMAL_ID, {
        cardType: 'normal-unit',
        grade: 3,
        power: 13000,
        shield: 0,
        critical: 1,
      }),
      gameplayCard(CARD_TRIGGER_ID, {
        cardType: 'trigger-unit',
        grade: 0,
        power: 5000,
        shield: 15000,
        critical: 1,
        triggerType: 'critical',
      }),
    ])

    const normalStats = resolveEngineCardStats(snapshot, CARD_NORMAL_ID)
    const triggerStats = resolveEngineCardStats(snapshot, CARD_TRIGGER_ID)

    expect(normalStats).toMatchObject({
      cardDefinitionId: CARD_NORMAL_ID,
      cardType: 'normal-unit',
      grade: 3,
      power: 13000,
      shield: 0,
      critical: 1,
      triggerType: null,
    })
    expect(triggerStats).toMatchObject({
      cardDefinitionId: CARD_TRIGGER_ID,
      cardType: 'trigger-unit',
      grade: 0,
      power: 5000,
      shield: 15000,
      critical: 1,
      triggerType: 'critical',
    })
    expect(isNormalUnitCardStats(normalStats!)).toBe(true)
    expect(isTriggerUnitCardStats(triggerStats!)).toBe(true)
    expect(isUnitCardStats(triggerStats!)).toBe(true)
    expect(isOrderCardStats(triggerStats!)).toBe(false)
  })

  it('normalizes snapshots deterministically by card definition id', () => {
    const normal = engineSnapshotCard(CARD_NORMAL_ID, {
      cardType: 'normal-unit',
      grade: 3,
      power: 13000,
      shield: 0,
      critical: 1,
      triggerType: null,
    })
    const trigger = engineSnapshotCard(CARD_TRIGGER_ID, {
      cardType: 'trigger-unit',
      grade: 0,
      power: 5000,
      shield: 15000,
      critical: 1,
      triggerType: 'critical',
    })

    expect(buildEngineCardStatsSnapshot([normal, trigger])).toEqual(
      buildEngineCardStatsSnapshot([trigger, normal]),
    )
  })

  it('fails predictably when published gameplay card data lacks required stats', () => {
    const cardMissingPower = omitGameplayCardPower(
      gameplayCard(CARD_NORMAL_ID, {
        cardType: 'normal-unit',
        grade: 3,
        power: 13000,
        shield: 0,
        critical: 1,
      }),
    )

    expect(() =>
      buildEngineCardStatsSnapshotFromGameplayCards([cardMissingPower]),
    ).toThrow(RulesInvariantError)

    expect(() =>
      buildEngineCardStatsSnapshot([
        engineSnapshotCard(CARD_TRIGGER_ID, {
          cardType: 'trigger-unit',
          grade: 0,
          power: 5000,
          shield: 15000,
          critical: 1,
          triggerType: null,
        }),
      ]),
    ).toThrow(RulesInvariantError)
  })

  it('resolves a runtime card piece through cardDefinitionId', () => {
    const state = makeGameState(
      buildEngineCardStatsSnapshotFromGameplayCards([
        gameplayCard(CARD_NORMAL_ID, {
          cardType: 'normal-unit',
          grade: 3,
          power: 13000,
          shield: 0,
          critical: 1,
        }),
      ]),
    )
    const piece = state.pieces[0]

    if (piece === undefined) {
      throw new Error('Expected card piece fixture.')
    }

    const result = resolveGamePieceCardStats(state, piece)

    expect(() => assertGameStateInvariant(state)).not.toThrow()
    expect(() => assertGameStateCardStatsComplete(state)).not.toThrow()
    expect(result).toMatchObject({
      ok: true,
      stats: {
        cardDefinitionId: CARD_NORMAL_ID,
        power: 13000,
        shield: 0,
        critical: 1,
        grade: 3,
        triggerType: null,
      },
    })
    expect(requireGamePieceCardStats(state, piece).power).toBe(13000)
  })

  it('reports missing card stats without silently returning undefined behavior', () => {
    const stateWithoutSnapshot = makeGameState()
    const piece = stateWithoutSnapshot.pieces[0]

    if (piece === undefined) {
      throw new Error('Expected card piece fixture.')
    }

    expect(
      resolveGamePieceCardStats(stateWithoutSnapshot, piece),
    ).toMatchObject({
      ok: false,
      issue: {
        code: 'missing_card_stats_snapshot',
      },
    })
    expect(() =>
      assertGameStateCardStatsComplete(stateWithoutSnapshot),
    ).toThrow(RulesInvariantError)

    const stateWithIncompleteSnapshot = makeGameState(
      buildEngineCardStatsSnapshotFromGameplayCards([
        gameplayCard('card-other' as CardId, {
          cardType: 'normal-unit',
          grade: 1,
          power: 8000,
          shield: 5000,
          critical: 1,
        }),
      ]),
    )

    expect(
      resolveGamePieceCardStats(stateWithIncompleteSnapshot, piece),
    ).toMatchObject({
      ok: false,
      issue: {
        code: 'missing_card_stats',
      },
    })
    expect(() => assertGameStateInvariant(stateWithIncompleteSnapshot)).toThrow(
      RulesInvariantError,
    )
  })
})

function gameplayCard(
  cardId: CardId,
  stats: {
    readonly cardType: GameplayCard['cardType']
    readonly grade: GameplayCard['grade']
    readonly power: number
    readonly shield: number
    readonly critical: number
    readonly triggerType?: GameplayCard['triggerType']
  },
): GameplayCard {
  return {
    cardId,
    name: cardId as string,
    cardType: stats.cardType,
    grade: stats.grade,
    nation: 'keter-sanctuary' as GameplayCard['nation'],
    power: stats.power,
    shield: stats.shield,
    critical: stats.critical,
    ...(stats.triggerType === undefined
      ? {}
      : {
          triggerType: stats.triggerType,
        }),
    keywords: [],
    effectRefs: [],
  }
}

function omitGameplayCardPower(card: GameplayCard): GameplayCard {
  const cardWithoutPower = { ...card } as { power?: number }

  delete cardWithoutPower.power

  return cardWithoutPower as GameplayCard
}

function engineSnapshotCard(
  cardDefinitionId: CardId,
  stats: Omit<
    NonNullable<EngineCardStatsSnapshot['cards'][number]>,
    'cardDefinitionId' | 'keywords'
  >,
): EngineCardStatsSnapshot['cards'][number] {
  return {
    cardDefinitionId,
    ...stats,
    keywords: [],
  }
}

function makeGameState(cardStats?: EngineCardStatsSnapshot): GameState {
  return {
    gameId: 'game-card-stats' as GameState['gameId'],
    formatId: 'standard' as GameState['formatId'],
    status: 'setup',
    revision: 0,
    turn: {
      turnNumber: 0,
      turnPlayerId: PLAYER_ID,
      phase: 'pregame',
      step: 'setup',
    },
    players: [
      {
        playerId: PLAYER_ID,
        seat: 0,
        status: 'waiting',
        ownedZoneIds: ['zone-vanguard' as ZoneId],
        counters: [],
        flags: [],
      },
    ],
    zones: [
      {
        zoneId: 'zone-vanguard' as ZoneId,
        kind: 'vanguard_circle',
        scope: 'player',
        ownerPlayerId: PLAYER_ID,
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'single',
        },
        occupants: [
          {
            pieceId: 'piece-vanguard' as PieceId,
          },
        ],
      },
    ],
    pieces: [
      {
        pieceId: 'piece-vanguard' as PieceId,
        kind: 'card',
        cardDefinitionId: CARD_NORMAL_ID,
        ownerPlayerId: PLAYER_ID,
        controllerPlayerId: PLAYER_ID,
      },
    ],
    ...(cardStats === undefined ? {} : { cardStats }),
    pieceStates: [],
    flags: [],
    pendingRequests: [],
  }
}
