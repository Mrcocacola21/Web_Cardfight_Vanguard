import type { CardId, FormatId } from '@web-vg/shared'
import { describe, expect, it } from 'vitest'

import type { ActionId, PieceId, PlayerId, ZoneId } from '../contracts'
import { buildEngineCardStatsSnapshot } from '../cards'
import type { GameEvent } from '../events'
import { PERSONA_RIDE_KEYWORD, TWIN_DRIVE_KEYWORD } from '../keywords'
import type { BattleState, GameState, ZoneState } from '../state'
import { applyGameAction, isAppliedTransitionResult } from '../transitions'

import {
  CARDS_DRAWN_FINALIZE_EFFECT_IDENTITY,
  CHECK_TRIGGER_REVEAL_EFFECT_IDENTITY,
  PERSONA_RIDE_KEYWORD_EFFECT_IDENTITY,
  TWIN_DRIVE_KEYWORD_EFFECT_IDENTITY,
} from './samples'
import {
  PERSONA_RIDE_POWER_AMOUNT,
  PERSONA_RIDE_POWER_FLAG,
} from './first-effects'

const STANDARD_FORMAT_ID = 'standard' as FormatId
const PREMIUM_FORMAT_ID = 'premium' as FormatId
const PLAYER_1 = 'player-1' as PlayerId
const PLAYER_2 = 'player-2' as PlayerId

function makePlayerZones(
  playerId: PlayerId,
  zonePrefix: string,
  occupants: {
    readonly deck?: readonly PieceId[]
    readonly hand?: readonly PieceId[]
    readonly soul?: readonly PieceId[]
    readonly vanguard?: readonly PieceId[]
    readonly rearGuard?: readonly PieceId[]
    readonly damage?: readonly PieceId[]
  },
): readonly ZoneState[] {
  return [
    {
      zoneId: `${zonePrefix}-deck` as ZoneId,
      kind: 'deck',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'owner-private',
      layout: {
        ordering: 'ordered',
        occupancy: 'multi',
      },
      occupants: (occupants.deck ?? []).map((pieceId) => ({ pieceId })),
    },
    {
      zoneId: `${zonePrefix}-hand` as ZoneId,
      kind: 'hand',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'owner-private',
      layout: {
        ordering: 'unordered',
        occupancy: 'multi',
      },
      occupants: (occupants.hand ?? []).map((pieceId) => ({ pieceId })),
    },
    {
      zoneId: `${zonePrefix}-soul` as ZoneId,
      kind: 'soul',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'owner-private',
      layout: {
        ordering: 'unordered',
        occupancy: 'multi',
      },
      occupants: (occupants.soul ?? []).map((pieceId) => ({ pieceId })),
    },
    {
      zoneId: `${zonePrefix}-vg` as ZoneId,
      kind: 'vanguard_circle',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'public',
      layout: {
        ordering: 'unordered',
        occupancy: 'single',
      },
      occupants: (occupants.vanguard ?? []).map((pieceId) => ({ pieceId })),
    },
    {
      zoneId: `${zonePrefix}-rg` as ZoneId,
      kind: 'rear_guard_circle',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'public',
      layout: {
        ordering: 'unordered',
        occupancy: 'multi',
      },
      occupants: (occupants.rearGuard ?? []).map((pieceId) => ({ pieceId })),
    },
    {
      zoneId: `${zonePrefix}-damage` as ZoneId,
      kind: 'damage',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'public',
      layout: {
        ordering: 'ordered',
        occupancy: 'multi',
      },
      occupants: (occupants.damage ?? []).map((pieceId) => ({ pieceId })),
    },
  ]
}

function makeDriveCheckState(options: {
  readonly attackerHasTwinDrive: boolean
}): GameState {
  const attackerPieceId = 'piece-attacker' as PieceId
  const driveTopPieceId = 'piece-drive-top' as PieceId
  const driveNextPieceId = 'piece-drive-next' as PieceId
  const targetPieceId = 'piece-target-vg' as PieceId
  const playerOneZones = makePlayerZones(PLAYER_1, 'p1', {
    deck: [driveTopPieceId, driveNextPieceId],
    vanguard: [attackerPieceId],
  })
  const playerTwoZones = makePlayerZones(PLAYER_2, 'p2', {
    vanguard: [targetPieceId],
  })

  return {
    gameId: 'game-first-effects-drive' as GameState['gameId'],
    formatId: STANDARD_FORMAT_ID,
    status: 'in_progress',
    revision: 0,
    turn: {
      turnNumber: 1,
      turnPlayerId: PLAYER_1,
      priorityPlayerId: PLAYER_1,
      phase: 'battle',
      step: 'drive',
    },
    players: [
      {
        playerId: PLAYER_1,
        seat: 0,
        status: 'active',
        ownedZoneIds: playerOneZones.map((zone) => zone.zoneId),
        counters: [],
        flags: [],
      },
      {
        playerId: PLAYER_2,
        seat: 1,
        status: 'waiting',
        ownedZoneIds: playerTwoZones.map((zone) => zone.zoneId),
        counters: [],
        flags: [],
      },
    ],
    zones: [...playerOneZones, ...playerTwoZones],
    pieces: [
      {
        pieceId: attackerPieceId,
        kind: 'card',
        cardDefinitionId: 'card-attacker' as CardId,
        ownerPlayerId: PLAYER_1,
        controllerPlayerId: PLAYER_1,
        ...(options.attackerHasTwinDrive
          ? {
              keywords: [TWIN_DRIVE_KEYWORD],
            }
          : {}),
      },
      {
        pieceId: driveTopPieceId,
        kind: 'card',
        cardDefinitionId: 'card-drive-top' as CardId,
        ownerPlayerId: PLAYER_1,
        controllerPlayerId: PLAYER_1,
      },
      {
        pieceId: driveNextPieceId,
        kind: 'card',
        cardDefinitionId: 'card-drive-next' as CardId,
        ownerPlayerId: PLAYER_1,
        controllerPlayerId: PLAYER_1,
      },
      {
        pieceId: targetPieceId,
        kind: 'card',
        cardDefinitionId: 'card-target' as CardId,
        ownerPlayerId: PLAYER_2,
        controllerPlayerId: PLAYER_2,
      },
    ],
    pieceStates: [],
    flags: [],
    battle: {
      battleId: 'battle-1' as BattleState['battleId'],
      status: 'guard_resolved',
      attackingPlayerId: PLAYER_1,
      defendingPlayerId: PLAYER_2,
      attackerPieceId,
      attackerZoneId: 'p1-vg' as ZoneId,
      target: {
        kind: 'piece',
        pieceId: targetPieceId,
      },
      guardPieceIds: [],
    },
    pendingRequests: [],
  }
}

function makePersonaRideState(options: {
  readonly formatId: FormatId
  readonly sameCardDefinition: boolean
}): GameState {
  const oldVanguardPieceId = 'piece-old-vg' as PieceId
  const newVanguardPieceId = 'piece-new-vg' as PieceId
  const rearGuardPieceId = 'piece-rg' as PieceId
  const deckPieceId = 'piece-persona-draw' as PieceId
  const playerOneZones = makePlayerZones(PLAYER_1, 'p1', {
    deck: [deckPieceId],
    hand: [newVanguardPieceId],
    vanguard: [oldVanguardPieceId],
    rearGuard: [rearGuardPieceId],
  })
  const playerTwoZones = makePlayerZones(PLAYER_2, 'p2', {
    vanguard: ['piece-p2-vg' as PieceId],
  })

  return {
    gameId: 'game-first-effects-ride' as GameState['gameId'],
    formatId: options.formatId,
    status: 'in_progress',
    revision: 0,
    turn: {
      turnNumber: 1,
      turnPlayerId: PLAYER_1,
      priorityPlayerId: PLAYER_1,
      phase: 'ride',
      step: 'ride',
    },
    players: [
      {
        playerId: PLAYER_1,
        seat: 0,
        status: 'active',
        ownedZoneIds: playerOneZones.map((zone) => zone.zoneId),
        counters: [],
        flags: [],
      },
      {
        playerId: PLAYER_2,
        seat: 1,
        status: 'waiting',
        ownedZoneIds: playerTwoZones.map((zone) => zone.zoneId),
        counters: [],
        flags: [],
      },
    ],
    zones: [...playerOneZones, ...playerTwoZones],
    pieces: [
      {
        pieceId: oldVanguardPieceId,
        kind: 'card',
        cardDefinitionId: 'card-persona' as CardId,
        ownerPlayerId: PLAYER_1,
        controllerPlayerId: PLAYER_1,
      },
      {
        pieceId: newVanguardPieceId,
        kind: 'card',
        cardDefinitionId: (options.sameCardDefinition
          ? 'card-persona'
          : 'card-other') as CardId,
        ownerPlayerId: PLAYER_1,
        controllerPlayerId: PLAYER_1,
        keywords: [PERSONA_RIDE_KEYWORD],
      },
      {
        pieceId: rearGuardPieceId,
        kind: 'card',
        cardDefinitionId: 'card-rear-guard' as CardId,
        ownerPlayerId: PLAYER_1,
        controllerPlayerId: PLAYER_1,
      },
      {
        pieceId: deckPieceId,
        kind: 'card',
        cardDefinitionId: 'card-drawn' as CardId,
        ownerPlayerId: PLAYER_1,
        controllerPlayerId: PLAYER_1,
      },
      {
        pieceId: 'piece-p2-vg' as PieceId,
        kind: 'card',
        cardDefinitionId: 'card-p2-vg' as CardId,
        ownerPlayerId: PLAYER_2,
        controllerPlayerId: PLAYER_2,
      },
    ],
    cardStats: buildEngineCardStatsSnapshot([
      makeUnitStats('card-persona' as CardId, 3),
      makeUnitStats('card-other' as CardId, 3),
      makeUnitStats('card-rear-guard' as CardId, 2),
      makeUnitStats('card-drawn' as CardId, 1),
      makeUnitStats('card-p2-vg' as CardId, 3),
    ]),
    pieceStates: [],
    flags: [],
    pendingRequests: [],
  }
}

function makeUnitStats(
  cardDefinitionId: CardId,
  grade: number,
): NonNullable<GameState['cardStats']>['cards'][number] {
  return {
    cardDefinitionId,
    cardType: 'normal-unit',
    grade: grade as NonNullable<
      GameState['cardStats']
    >['cards'][number]['grade'],
    power: 10000,
    shield: 5000,
    critical: 1,
    triggerType: null,
    keywords: [],
  }
}

function requireApplied(result: ReturnType<typeof applyGameAction>) {
  expect(isAppliedTransitionResult(result)).toBe(true)

  if (!isAppliedTransitionResult(result)) {
    throw new Error('Expected applied transition result.')
  }

  return result
}

function eventTypes(
  events: readonly GameEvent[],
): readonly GameEvent['type'][] {
  return events.map((event) => event.type)
}

function zonePieceIds(state: GameState, zoneId: string): readonly PieceId[] {
  const zone = state.zones.find((candidate) => candidate.zoneId === zoneId)

  if (zone === undefined) {
    throw new Error(`Expected zone ${zoneId}.`)
  }

  return zone.occupants.map((occupant) => occupant.pieceId)
}

function replaceZoneOccupants(
  state: GameState,
  zoneId: ZoneId,
  pieceIds: readonly PieceId[],
): GameState {
  const nextZones = state.zones.map((zone) =>
    zone.zoneId === zoneId
      ? {
          ...zone,
          occupants: pieceIds.map((pieceId) => ({ pieceId })),
        }
      : zone,
  )
  const locatedPieceIds = new Set(
    nextZones
      .flatMap((zone) => zone.occupants)
      .map((occupant) => occupant.pieceId as string),
  )

  return {
    ...state,
    zones: nextZones,
    pieces: state.pieces.filter((piece) =>
      locatedPieceIds.has(piece.pieceId as string),
    ),
    pieceStates: state.pieceStates.filter((pieceState) =>
      locatedPieceIds.has(pieceState.pieceId as string),
    ),
  }
}

describe('@web-vg/rules-core first working effects', () => {
  it('applies twin-drive through keyword, registry, and declarative effect resolution', () => {
    const result = requireApplied(
      applyGameAction(makeDriveCheckState({ attackerHasTwinDrive: true }), {
        action: {
          actionId: 'action-drive-twin' as ActionId,
          type: 'system.drive_check',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          battleId: 'battle-1' as BattleState['battleId'],
          playerId: PLAYER_1,
          fromZoneId: 'p1-deck' as ZoneId,
          toZoneId: 'p1-hand' as ZoneId,
          count: 1,
        },
      }),
    )

    expect(eventTypes(result.events)).toEqual([
      'effect.resolved',
      'piece.moved',
      'piece.moved',
      'battle.drive_checked',
      'effect.resolved',
    ])
    expect(result.events[0]).toMatchObject({
      type: 'effect.resolved',
      effectDefinitionId: TWIN_DRIVE_KEYWORD_EFFECT_IDENTITY.id,
      sourcePieceId: 'piece-attacker',
      operationKinds: ['adjust_check_count'],
    })
    expect(result.events[4]).toMatchObject({
      type: 'effect.resolved',
      effectDefinitionId: CHECK_TRIGGER_REVEAL_EFFECT_IDENTITY.id,
      triggerEventSequence: 3,
      operationKinds: ['trigger_check_none'],
    })
    expect(zonePieceIds(result.nextState, 'p1-hand')).toEqual([
      'piece-drive-top',
      'piece-drive-next',
    ])
    expect(result.nextState.battle?.lastCheck?.revealedCards).toHaveLength(2)
    expect(result.nextState.battle?.lastCheck?.triggerResolutionState).toBe(
      'resolved_none',
    )
    expect(result.timingWindows[1]).toMatchObject({
      point: 'battle.drive_check',
      window: 'on',
      relatedEventSequence: 3,
    })
  })

  it('does not apply twin-drive when the source unit lacks the keyword', () => {
    const result = requireApplied(
      applyGameAction(makeDriveCheckState({ attackerHasTwinDrive: false }), {
        action: {
          actionId: 'action-drive-plain' as ActionId,
          type: 'system.drive_check',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          battleId: 'battle-1' as BattleState['battleId'],
          playerId: PLAYER_1,
          fromZoneId: 'p1-deck' as ZoneId,
          toZoneId: 'p1-hand' as ZoneId,
          count: 1,
        },
      }),
    )

    expect(eventTypes(result.events)).toEqual([
      'piece.moved',
      'battle.drive_checked',
      'effect.resolved',
    ])
    expect(result.events[2]).toMatchObject({
      type: 'effect.resolved',
      effectDefinitionId: CHECK_TRIGGER_REVEAL_EFFECT_IDENTITY.id,
      triggerEventSequence: 1,
      operationKinds: ['trigger_check_none'],
    })
    expect(zonePieceIds(result.nextState, 'p1-hand')).toEqual([
      'piece-drive-top',
    ])
    expect(result.nextState.battle?.lastCheck?.revealedCards).toHaveLength(1)
    expect(result.nextState.battle?.lastCheck?.triggerResolutionState).toBe(
      'resolved_none',
    )
  })

  it('applies persona ride as a hybrid post-ride effect with draw and power flags', () => {
    const result = requireApplied(
      applyGameAction(
        makePersonaRideState({
          formatId: STANDARD_FORMAT_ID,
          sameCardDefinition: true,
        }),
        {
          action: {
            actionId: 'action-persona-ride' as ActionId,
            type: 'card.ride',
            actor: {
              kind: 'player',
              playerId: PLAYER_1,
            },
            pieceId: 'piece-new-vg' as PieceId,
            ridingOverPieceId: 'piece-old-vg' as PieceId,
            from: {
              zoneId: 'p1-hand' as ZoneId,
            },
            to: {
              zoneId: 'p1-vg' as ZoneId,
            },
          },
        },
      ),
    )

    expect(eventTypes(result.events)).toEqual([
      'piece.moved',
      'piece.moved',
      'card.rode',
      'effect.resolved',
      'piece.moved',
      'cards.drawn',
      'effect.resolved',
    ])
    expect(result.events[3]).toMatchObject({
      type: 'effect.resolved',
      effectDefinitionId: PERSONA_RIDE_KEYWORD_EFFECT_IDENTITY.id,
      sourcePieceId: 'piece-new-vg',
      triggerEventSequence: 2,
      operationKinds: ['draw_cards', 'apply_power_modifier'],
    })
    expect(result.events[6]).toMatchObject({
      type: 'effect.resolved',
      effectDefinitionId: CARDS_DRAWN_FINALIZE_EFFECT_IDENTITY.id,
      triggerEventSequence: 5,
      operationKinds: ['typed_handler'],
    })
    expect(zonePieceIds(result.nextState, 'p1-hand')).toEqual([
      'piece-persona-draw',
    ])
    expect(zonePieceIds(result.nextState, 'p1-deck')).toEqual([])
    expect(
      result.nextState.pieceStates.find(
        (pieceState) => pieceState.pieceId === 'piece-new-vg',
      ),
    ).toMatchObject({
      flags: [PERSONA_RIDE_POWER_FLAG],
      powerModifier: PERSONA_RIDE_POWER_AMOUNT,
    })
    expect(
      result.nextState.pieceStates.find(
        (pieceState) => pieceState.pieceId === 'piece-rg',
      ),
    ).toMatchObject({
      flags: [PERSONA_RIDE_POWER_FLAG],
      powerModifier: PERSONA_RIDE_POWER_AMOUNT,
    })
    expect(result.timingWindows.map((window) => window.point)).toEqual([
      'card.ride',
      'card.ride',
      'card.ride',
      'zone.transfer',
    ])
  })

  it('turns persona ride effect draw from an empty deck into deck-out loss', () => {
    const result = requireApplied(
      applyGameAction(
        replaceZoneOccupants(
          makePersonaRideState({
            formatId: STANDARD_FORMAT_ID,
            sameCardDefinition: true,
          }),
          'p1-deck' as ZoneId,
          [],
        ),
        {
          action: {
            actionId: 'action-persona-empty-deck' as ActionId,
            type: 'card.ride',
            actor: {
              kind: 'player',
              playerId: PLAYER_1,
            },
            pieceId: 'piece-new-vg' as PieceId,
            ridingOverPieceId: 'piece-old-vg' as PieceId,
            from: {
              zoneId: 'p1-hand' as ZoneId,
            },
            to: {
              zoneId: 'p1-vg' as ZoneId,
            },
          },
        },
      ),
    )

    expect(result.nextState.status).toBe('completed')
    expect(eventTypes(result.events)).toEqual([
      'piece.moved',
      'piece.moved',
      'card.rode',
      'effect.resolved',
      'cards.deck_out',
      'player.defeated',
      'match.ended',
    ])
    expect(result.events[4]).toMatchObject({
      type: 'cards.deck_out',
      playerId: PLAYER_1,
      fromZoneId: 'p1-deck',
      requiredCount: 1,
      availableCount: 0,
      reason: 'effect',
    })
    expect(result.events[6]).toMatchObject({
      type: 'match.ended',
      reason: 'deck_out',
      loserPlayerId: PLAYER_1,
      winnerPlayerId: PLAYER_2,
    })
    expect(result.timingWindows.map((window) => window.point)).toEqual([
      'card.ride',
      'card.ride',
      'card.ride',
    ])
  })

  it('does not apply persona ride outside its scoped conditions', () => {
    const premiumResult = requireApplied(
      applyGameAction(
        makePersonaRideState({
          formatId: PREMIUM_FORMAT_ID,
          sameCardDefinition: true,
        }),
        {
          action: {
            actionId: 'action-persona-premium' as ActionId,
            type: 'card.ride',
            actor: {
              kind: 'player',
              playerId: PLAYER_1,
            },
            pieceId: 'piece-new-vg' as PieceId,
            ridingOverPieceId: 'piece-old-vg' as PieceId,
            from: {
              zoneId: 'p1-hand' as ZoneId,
            },
            to: {
              zoneId: 'p1-vg' as ZoneId,
            },
          },
        },
      ),
    )

    expect(eventTypes(premiumResult.events)).toEqual([
      'piece.moved',
      'piece.moved',
      'card.rode',
    ])
    expect(zonePieceIds(premiumResult.nextState, 'p1-deck')).toEqual([
      'piece-persona-draw',
    ])

    const differentCardResult = requireApplied(
      applyGameAction(
        makePersonaRideState({
          formatId: STANDARD_FORMAT_ID,
          sameCardDefinition: false,
        }),
        {
          action: {
            actionId: 'action-persona-different-card' as ActionId,
            type: 'card.ride',
            actor: {
              kind: 'player',
              playerId: PLAYER_1,
            },
            pieceId: 'piece-new-vg' as PieceId,
            ridingOverPieceId: 'piece-old-vg' as PieceId,
            from: {
              zoneId: 'p1-hand' as ZoneId,
            },
            to: {
              zoneId: 'p1-vg' as ZoneId,
            },
          },
        },
      ),
    )

    expect(eventTypes(differentCardResult.events)).toEqual([
      'piece.moved',
      'piece.moved',
      'card.rode',
    ])
    expect(zonePieceIds(differentCardResult.nextState, 'p1-deck')).toEqual([
      'piece-persona-draw',
    ])
  })
})
