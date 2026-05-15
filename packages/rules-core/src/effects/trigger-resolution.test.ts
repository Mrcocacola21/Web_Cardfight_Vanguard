import type { CardId, FormatId, TriggerType } from '@web-vg/shared'
import { describe, expect, it } from 'vitest'

import { buildEngineCardStatsSnapshot } from '../cards'
import type {
  ActionId,
  PieceId,
  PlayerId,
  TransitionId,
  ZoneId,
} from '../contracts'
import type { GameEvent } from '../events'
import { createKeywordMechanicsRegistry } from '../keywords'
import type {
  BattleState,
  GamePieceStatusState,
  GameState,
  ZoneState,
} from '../state'
import {
  applyGameAction,
  isAppliedTransitionResult,
  isInvalidTransitionResult,
} from '../transitions'
import { applyDriveCheckTransition } from '../transitions/drive-damage-check'

import {
  CARDS_DRAWN_FINALIZE_EFFECT_IDENTITY,
  CHECK_TRIGGER_REVEAL_EFFECT_HANDLER_KEY,
  CHECK_TRIGGER_REVEAL_EFFECT_IDENTITY,
  coreEffectRegistry,
  createEffectHandlerRegistry,
  resolveEventTriggeredEffects,
} from './index'
import {
  OVER_TRIGGER_POWER_BONUS,
  TRIGGER_CRITICAL_BONUS,
  TRIGGER_POWER_BONUS,
} from './trigger-resolution'

const STANDARD_FORMAT_ID = 'standard' as FormatId
const PLAYER_1 = 'player-trigger-1' as PlayerId
const PLAYER_2 = 'player-trigger-2' as PlayerId

interface TriggerFixtureOptions {
  readonly checkKind: 'drive' | 'damage'
  readonly triggerType: TriggerType | null
  readonly p1DamageCount?: number
  readonly p2DamageCount?: number
  readonly p1RearGuards?: readonly PieceId[]
  readonly p2RearGuards?: readonly PieceId[]
  readonly restedPieceIds?: readonly PieceId[]
}

function makeTriggerState(options: TriggerFixtureOptions): GameState {
  const triggerPieceId = 'piece-trigger-top' as PieceId
  const drawPieceId = 'piece-trigger-draw' as PieceId
  const p1DamagePieces = createDamagePieces(
    PLAYER_1,
    'p1',
    options.p1DamageCount ?? 0,
  )
  const p2DamagePieces = createDamagePieces(
    PLAYER_2,
    'p2',
    options.p2DamageCount ?? 0,
  )
  const p1RearGuardPieceIds =
    options.p1RearGuards ?? (['piece-p1-rg' as PieceId] as const)
  const p2RearGuardPieceIds =
    options.p2RearGuards ?? (['piece-p2-rg' as PieceId] as const)
  const zones = [
    ...makePlayerZones(PLAYER_1, 'p1', {
      deck: options.checkKind === 'drive' ? [triggerPieceId, drawPieceId] : [],
      vanguard: ['piece-p1-vg' as PieceId],
      rearGuard: p1RearGuardPieceIds,
      damage: p1DamagePieces.map((piece) => piece.pieceId),
    }),
    ...makePlayerZones(PLAYER_2, 'p2', {
      deck: options.checkKind === 'damage' ? [triggerPieceId, drawPieceId] : [],
      vanguard: ['piece-p2-vg' as PieceId],
      rearGuard: p2RearGuardPieceIds,
      damage: p2DamagePieces.map((piece) => piece.pieceId),
    }),
  ]
  const pieces = [
    makePiece('piece-p1-vg' as PieceId, PLAYER_1, 'card-p1-vg' as CardId),
    makePiece('piece-p2-vg' as PieceId, PLAYER_2, 'card-p2-vg' as CardId),
    ...p1RearGuardPieceIds.map((pieceId, index) =>
      makePiece(pieceId, PLAYER_1, `card-p1-rg-${index}` as CardId),
    ),
    ...p2RearGuardPieceIds.map((pieceId, index) =>
      makePiece(pieceId, PLAYER_2, `card-p2-rg-${index}` as CardId),
    ),
    makePiece(
      triggerPieceId,
      options.checkKind === 'drive' ? PLAYER_1 : PLAYER_2,
      'card-trigger-top' as CardId,
    ),
    makePiece(
      drawPieceId,
      options.checkKind === 'drive' ? PLAYER_1 : PLAYER_2,
      'card-trigger-draw' as CardId,
    ),
    ...p1DamagePieces,
    ...p2DamagePieces,
  ]

  return {
    gameId: 'game-trigger-resolution' as GameState['gameId'],
    formatId: STANDARD_FORMAT_ID,
    status: 'in_progress',
    revision: 0,
    turn: {
      turnNumber: 1,
      turnPlayerId: PLAYER_1,
      priorityPlayerId: PLAYER_1,
      phase: 'battle',
      step: options.checkKind,
    },
    players: [
      {
        playerId: PLAYER_1,
        seat: 0,
        status: 'active',
        ownedZoneIds: zones
          .filter((zone) => zone.ownerPlayerId === PLAYER_1)
          .map((zone) => zone.zoneId),
        counters: [],
        flags: [],
      },
      {
        playerId: PLAYER_2,
        seat: 1,
        status: 'waiting',
        ownedZoneIds: zones
          .filter((zone) => zone.ownerPlayerId === PLAYER_2)
          .map((zone) => zone.zoneId),
        counters: [],
        flags: [],
      },
    ],
    zones,
    pieces,
    cardStats: buildEngineCardStatsSnapshot(
      pieces.map((piece) => ({
        cardDefinitionId: piece.cardDefinitionId as CardId,
        cardType:
          piece.cardDefinitionId === ('card-trigger-top' as CardId) &&
          options.triggerType !== null
            ? 'trigger-unit'
            : 'normal-unit',
        grade:
          piece.cardDefinitionId === ('card-p1-vg' as CardId) ||
          piece.cardDefinitionId === ('card-p2-vg' as CardId)
            ? 3
            : 0,
        power:
          piece.cardDefinitionId === ('card-p1-vg' as CardId) ||
          piece.cardDefinitionId === ('card-p2-vg' as CardId)
            ? 13000
            : 5000,
        shield: 15000,
        critical: 1,
        triggerType:
          piece.cardDefinitionId === ('card-trigger-top' as CardId)
            ? options.triggerType
            : null,
        keywords: [],
      })),
    ),
    pieceStates: (options.restedPieceIds ?? []).map((pieceId) => ({
      pieceId,
      orientation: 'rest',
      flags: [],
    })),
    flags: [],
    battle:
      options.checkKind === 'drive'
        ? {
            battleId: 'battle-trigger-1' as BattleState['battleId'],
            status: 'guard_resolved',
            attackingPlayerId: PLAYER_1,
            defendingPlayerId: PLAYER_2,
            attackerPieceId: 'piece-p1-vg' as PieceId,
            attackerZoneId: 'p1-vg' as ZoneId,
            target: {
              kind: 'piece',
              pieceId: 'piece-p2-vg' as PieceId,
            },
            guardPieceIds: [],
          }
        : {
            battleId: 'battle-trigger-1' as BattleState['battleId'],
            status: 'combat_resolved',
            attackingPlayerId: PLAYER_1,
            defendingPlayerId: PLAYER_2,
            attackerPieceId: 'piece-p1-vg' as PieceId,
            attackerZoneId: 'p1-vg' as ZoneId,
            target: {
              kind: 'player',
              playerId: PLAYER_2,
            },
            guardPieceIds: [],
            combat: {
              attackPower: 13000,
              attackerPowerComponents: [
                {
                  source: 'attacker_base',
                  pieceId: 'piece-p1-vg' as PieceId,
                  amount: 13000,
                },
              ],
              defensePower: 13000,
              defensePowerComponents: [
                {
                  source: 'defender_base',
                  pieceId: 'piece-p2-vg' as PieceId,
                  amount: 13000,
                },
              ],
              shieldPower: 0,
              shieldComponents: [],
              totalDefensePower: 13000,
              result: 'hit',
            },
          },
    pendingRequests: [],
  }
}

function makePlayerZones(
  playerId: PlayerId,
  zonePrefix: string,
  occupants: {
    readonly deck: readonly PieceId[]
    readonly vanguard: readonly PieceId[]
    readonly rearGuard: readonly PieceId[]
    readonly damage: readonly PieceId[]
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
      occupants: occupants.deck.map((pieceId) => ({ pieceId })),
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
      occupants: [],
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
      occupants: occupants.vanguard.map((pieceId) => ({ pieceId })),
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
      occupants: occupants.rearGuard.map((pieceId) => ({ pieceId })),
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
      occupants: occupants.damage.map((pieceId) => ({ pieceId })),
    },
    {
      zoneId: `${zonePrefix}-drop` as ZoneId,
      kind: 'drop',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'public',
      layout: {
        ordering: 'ordered',
        occupancy: 'multi',
      },
      occupants: [],
    },
  ]
}

function createDamagePieces(
  playerId: PlayerId,
  prefix: 'p1' | 'p2',
  count: number,
): readonly GameState['pieces'][number][] {
  return Array.from({ length: count }, (_, index) =>
    makePiece(
      `piece-${prefix}-damage-${index + 1}` as PieceId,
      playerId,
      `card-${prefix}-damage-${index + 1}` as CardId,
    ),
  )
}

function makePiece(
  pieceId: PieceId,
  playerId: PlayerId,
  cardDefinitionId: CardId,
): GameState['pieces'][number] {
  return {
    pieceId,
    kind: 'card',
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    cardDefinitionId,
  }
}

function applyCheck(state: GameState) {
  const checkKind =
    state.battle?.status === 'guard_resolved' ? 'drive' : 'damage'

  return applyGameAction(state, {
    action:
      checkKind === 'drive'
        ? {
            actionId: 'action-trigger-drive' as ActionId,
            type: 'system.drive_check',
            actor: {
              kind: 'system',
              system: 'automatic-flow',
            },
            battleId: 'battle-trigger-1' as BattleState['battleId'],
            playerId: PLAYER_1,
            fromZoneId: 'p1-deck' as ZoneId,
            toZoneId: 'p1-hand' as ZoneId,
            count: 1,
          }
        : {
            actionId: 'action-trigger-damage' as ActionId,
            type: 'system.damage_check',
            actor: {
              kind: 'system',
              system: 'automatic-flow',
            },
            battleId: 'battle-trigger-1' as BattleState['battleId'],
            playerId: PLAYER_2,
            fromZoneId: 'p2-deck' as ZoneId,
            toZoneId: 'p2-damage' as ZoneId,
            count: 1,
          },
    expectedRevision: state.revision,
  })
}

function requireApplied(result: ReturnType<typeof applyGameAction>) {
  expect(isAppliedTransitionResult(result)).toBe(true)

  if (!isAppliedTransitionResult(result)) {
    throw new Error(`Expected applied result, received ${result.status}.`)
  }

  return result
}

function requireInvalid(result: ReturnType<typeof applyGameAction>) {
  expect(isInvalidTransitionResult(result)).toBe(true)

  if (!isInvalidTransitionResult(result)) {
    throw new Error(`Expected invalid result, received ${result.status}.`)
  }

  return result
}

function eventTypes(
  events: readonly GameEvent[],
): readonly GameEvent['type'][] {
  return events.map((event) => event.type)
}

function pieceState(
  state: GameState,
  pieceId: PieceId,
): GamePieceStatusState | undefined {
  return state.pieceStates.find((candidate) => candidate.pieceId === pieceId)
}

function zonePieceIds(state: GameState, zoneId: string): readonly PieceId[] {
  const zone = state.zones.find((candidate) => candidate.zoneId === zoneId)

  if (zone === undefined) {
    throw new Error(`Expected zone ${zoneId}.`)
  }

  return zone.occupants.map((occupant) => occupant.pieceId)
}

function triggerResolvedEvents(
  events: readonly GameEvent[],
): readonly Extract<GameEvent, { readonly type: 'trigger.resolved' }>[] {
  return events.filter(
    (
      event,
    ): event is Extract<GameEvent, { readonly type: 'trigger.resolved' }> =>
      event.type === 'trigger.resolved',
  )
}

describe('@web-vg/rules-core trigger resolution foundation', () => {
  it('keeps raw check transitions reveal-only until the effect runtime dispatches the trigger handler', () => {
    const state = makeTriggerState({
      checkKind: 'drive',
      triggerType: 'critical',
    })
    const baseResult = requireApplied(
      applyDriveCheckTransition(
        'transition-trigger-raw-check' as TransitionId,
        state,
        {
          actionId: 'action-trigger-raw-check' as ActionId,
          type: 'system.drive_check',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          battleId: 'battle-trigger-1' as BattleState['battleId'],
          playerId: PLAYER_1,
          fromZoneId: 'p1-deck' as ZoneId,
          toZoneId: 'p1-hand' as ZoneId,
          count: 1,
        },
      ),
    )

    expect(eventTypes(baseResult.events)).toEqual([
      'piece.moved',
      'battle.drive_checked',
    ])
    expect(
      baseResult.events.some((event) => event.type === 'trigger.resolved'),
    ).toBe(false)
    expect(pieceState(baseResult.nextState, 'piece-p1-vg' as PieceId)).toBe(
      undefined,
    )
    expect(baseResult.nextState.battle?.lastCheck?.triggerResolutionState).toBe(
      'pending_future_engine',
    )
  })

  it('fails explicitly instead of applying trigger consequences when the check trigger handler is missing', () => {
    const state = makeTriggerState({
      checkKind: 'drive',
      triggerType: 'critical',
    })
    const baseResult = requireApplied(
      applyDriveCheckTransition(
        'transition-trigger-missing-handler' as TransitionId,
        state,
        {
          actionId: 'action-trigger-missing-handler' as ActionId,
          type: 'system.drive_check',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          battleId: 'battle-trigger-1' as BattleState['battleId'],
          playerId: PLAYER_1,
          fromZoneId: 'p1-deck' as ZoneId,
          toZoneId: 'p1-hand' as ZoneId,
          count: 1,
        },
      ),
    )
    const result = requireInvalid(
      resolveEventTriggeredEffects({
        currentState: state,
        result: baseResult,
        environment: {
          effectRegistry: coreEffectRegistry,
          effectHandlers: createEffectHandlerRegistry([]),
          keywordMechanics: createKeywordMechanicsRegistry([]),
        },
      }),
    )

    expect(result.code).toBe('invalid_action')
    expect(result.message).toContain(
      `requires runtime handler ${CHECK_TRIGGER_REVEAL_EFFECT_HANDLER_KEY}`,
    )
    expect(result.message).toContain(CHECK_TRIGGER_REVEAL_EFFECT_IDENTITY.id)
  })

  it('routes Critical trigger through the check effect and applies power plus critical', () => {
    const result = requireApplied(
      applyCheck(
        makeTriggerState({
          checkKind: 'drive',
          triggerType: 'critical',
        }),
      ),
    )

    expect(eventTypes(result.events)).toEqual([
      'piece.moved',
      'battle.drive_checked',
      'trigger.revealed',
      'trigger.resolved',
      'effect.resolved',
    ])
    expect(
      pieceState(result.nextState, 'piece-p1-vg' as PieceId),
    ).toMatchObject({
      powerModifier: TRIGGER_POWER_BONUS,
      criticalModifier: TRIGGER_CRITICAL_BONUS,
    })
    expect(result.nextState.battle?.lastCheck?.triggerResolutionState).toBe(
      'resolved_triggers',
    )
    expect(result.events.at(-1)).toMatchObject({
      type: 'effect.resolved',
      effectDefinitionId: CHECK_TRIGGER_REVEAL_EFFECT_IDENTITY.id,
      operationKinds: ['trigger_power', 'trigger_critical'],
    })
  })

  it('resolves Draw trigger with power and a real draw event', () => {
    const result = requireApplied(
      applyCheck(
        makeTriggerState({
          checkKind: 'drive',
          triggerType: 'draw',
        }),
      ),
    )

    expect(eventTypes(result.events)).toEqual([
      'piece.moved',
      'battle.drive_checked',
      'trigger.revealed',
      'piece.moved',
      'cards.drawn',
      'trigger.resolved',
      'effect.resolved',
      'effect.resolved',
    ])
    expect(zonePieceIds(result.nextState, 'p1-hand')).toEqual([
      'piece-trigger-top',
      'piece-trigger-draw',
    ])
    expect(
      pieceState(result.nextState, 'piece-p1-vg' as PieceId),
    ).toMatchObject({
      powerModifier: TRIGGER_POWER_BONUS,
    })
    expect(triggerResolvedEvents(result.events)[0]).toMatchObject({
      triggerType: 'draw',
      drawnPieceIds: ['piece-trigger-draw'],
      powerTargetPieceIds: ['piece-p1-vg'],
    })
    expect(result.events[7]).toMatchObject({
      type: 'effect.resolved',
      effectDefinitionId: CARDS_DRAWN_FINALIZE_EFFECT_IDENTITY.id,
      triggerEventSequence: 4,
      operationKinds: ['typed_handler'],
    })
  })

  it('keeps Draw trigger runtime deterministic for identical check input', () => {
    const first = requireApplied(
      applyCheck(
        makeTriggerState({
          checkKind: 'drive',
          triggerType: 'draw',
        }),
      ),
    )
    const second = requireApplied(
      applyCheck(
        makeTriggerState({
          checkKind: 'drive',
          triggerType: 'draw',
        }),
      ),
    )

    expect(second.events).toEqual(first.events)
    expect(second.timingWindows).toEqual(first.timingWindows)
    expect(second.nextState).toEqual(first.nextState)
  })

  it('resolves Front trigger across controlled battle units', () => {
    const result = requireApplied(
      applyCheck(
        makeTriggerState({
          checkKind: 'drive',
          triggerType: 'front',
          p1RearGuards: [
            'piece-p1-rg-a' as PieceId,
            'piece-p1-rg-b' as PieceId,
          ],
        }),
      ),
    )

    expect(
      pieceState(result.nextState, 'piece-p1-vg' as PieceId),
    ).toMatchObject({
      powerModifier: TRIGGER_POWER_BONUS,
    })
    expect(
      pieceState(result.nextState, 'piece-p1-rg-a' as PieceId),
    ).toMatchObject({
      powerModifier: TRIGGER_POWER_BONUS,
    })
    expect(
      pieceState(result.nextState, 'piece-p1-rg-b' as PieceId),
    ).toMatchObject({
      powerModifier: TRIGGER_POWER_BONUS,
    })
    expect(triggerResolvedEvents(result.events)[0]).toMatchObject({
      triggerType: 'front',
      powerTargetPieceIds: ['piece-p1-vg', 'piece-p1-rg-a', 'piece-p1-rg-b'],
    })
  })

  it('resolves Heal trigger after damage placement and prevents lethal when condition passes', () => {
    const result = requireApplied(
      applyCheck(
        makeTriggerState({
          checkKind: 'damage',
          triggerType: 'heal',
          p1DamageCount: 5,
          p2DamageCount: 5,
        }),
      ),
    )

    expect(result.nextState.battle).toMatchObject({
      status: 'damage_checked',
      damage: {
        damageBefore: 5,
        damageAfter: 5,
        outcome: 'non_lethal',
      },
    })
    expect(zonePieceIds(result.nextState, 'p2-drop')).toEqual([
      'piece-p2-damage-1',
    ])
    expect(
      pieceState(result.nextState, 'piece-p2-vg' as PieceId),
    ).toMatchObject({
      powerModifier: TRIGGER_POWER_BONUS,
    })
    expect(
      result.events.filter((event) => event.type === 'player.damage_changed'),
    ).toHaveLength(2)
    expect(triggerResolvedEvents(result.events)[0]).toMatchObject({
      triggerType: 'heal',
      healedPieceId: 'piece-p2-damage-1',
      healCondition: {
        met: true,
        playerDamage: 6,
        opponentDamage: 5,
      },
    })
  })

  it('resolves Heal trigger without healing when the damage condition fails', () => {
    const result = requireApplied(
      applyCheck(
        makeTriggerState({
          checkKind: 'damage',
          triggerType: 'heal',
          p1DamageCount: 5,
          p2DamageCount: 3,
        }),
      ),
    )

    expect(result.nextState.battle).toMatchObject({
      damage: {
        damageBefore: 3,
        damageAfter: 4,
        outcome: 'non_lethal',
      },
    })
    expect(zonePieceIds(result.nextState, 'p2-drop')).toEqual([])
    expect(triggerResolvedEvents(result.events)[0]).toMatchObject({
      triggerType: 'heal',
      healCondition: {
        met: false,
        playerDamage: 4,
        opponentDamage: 5,
      },
    })
  })

  it('resolves Stand trigger by standing an eligible rested rear-guard and applying power', () => {
    const result = requireApplied(
      applyCheck(
        makeTriggerState({
          checkKind: 'drive',
          triggerType: 'stand',
          p1RearGuards: ['piece-p1-rg-rested' as PieceId],
          restedPieceIds: ['piece-p1-rg-rested' as PieceId],
        }),
      ),
    )

    expect(eventTypes(result.events)).toContain('piece.stood')
    expect(
      pieceState(result.nextState, 'piece-p1-rg-rested' as PieceId),
    ).toBeUndefined()
    expect(
      pieceState(result.nextState, 'piece-p1-vg' as PieceId),
    ).toMatchObject({
      powerModifier: TRIGGER_POWER_BONUS,
    })
    expect(triggerResolvedEvents(result.events)[0]).toMatchObject({
      triggerType: 'stand',
      stoodPieceId: 'piece-p1-rg-rested',
      powerTargetPieceIds: ['piece-p1-vg'],
    })
  })

  it('auto-selects the first eligible Stand trigger target deterministically', () => {
    const result = requireApplied(
      applyCheck(
        makeTriggerState({
          checkKind: 'drive',
          triggerType: 'stand',
          p1RearGuards: [
            'piece-p1-rg-first-rested' as PieceId,
            'piece-p1-rg-second-rested' as PieceId,
          ],
          restedPieceIds: [
            'piece-p1-rg-first-rested' as PieceId,
            'piece-p1-rg-second-rested' as PieceId,
          ],
        }),
      ),
    )

    expect(triggerResolvedEvents(result.events)[0]).toMatchObject({
      triggerType: 'stand',
      stoodPieceId: 'piece-p1-rg-first-rested',
    })
    expect(
      pieceState(result.nextState, 'piece-p1-rg-first-rested' as PieceId),
    ).toBeUndefined()
    expect(
      pieceState(result.nextState, 'piece-p1-rg-second-rested' as PieceId),
    ).toMatchObject({
      orientation: 'rest',
    })
  })

  it('keeps Stand trigger structured when no stand target is available', () => {
    const result = requireApplied(
      applyCheck(
        makeTriggerState({
          checkKind: 'drive',
          triggerType: 'stand',
          p1RearGuards: [],
          restedPieceIds: [],
        }),
      ),
    )
    const resolvedTrigger = triggerResolvedEvents(result.events)[0]

    expect(eventTypes(result.events)).not.toContain('piece.stood')
    expect(resolvedTrigger).toMatchObject({
      triggerType: 'stand',
      outcome: 'applied',
      powerTargetPieceIds: ['piece-p1-vg'],
    })
    expect(
      resolvedTrigger === undefined || 'stoodPieceId' in resolvedTrigger,
    ).toBe(false)
    expect(result.events.at(-1)).toMatchObject({
      type: 'effect.resolved',
      effectDefinitionId: CHECK_TRIGGER_REVEAL_EFFECT_IDENTITY.id,
      operationKinds: ['trigger_power', 'trigger_stand'],
    })
  })

  it('resolves Over Trigger as a bounded special trigger with broadcast power and draw', () => {
    const result = requireApplied(
      applyCheck(
        makeTriggerState({
          checkKind: 'drive',
          triggerType: 'over',
          p1RearGuards: ['piece-p1-rg-over' as PieceId],
        }),
      ),
    )

    expect(
      pieceState(result.nextState, 'piece-p1-vg' as PieceId),
    ).toMatchObject({
      powerModifier: OVER_TRIGGER_POWER_BONUS,
    })
    expect(
      pieceState(result.nextState, 'piece-p1-rg-over' as PieceId),
    ).toMatchObject({
      powerModifier: OVER_TRIGGER_POWER_BONUS,
    })
    expect(zonePieceIds(result.nextState, 'p1-hand')).toEqual([
      'piece-trigger-top',
      'piece-trigger-draw',
    ])
    expect(triggerResolvedEvents(result.events)[0]).toMatchObject({
      triggerType: 'over',
      overTriggerApplied: true,
      drawnPieceIds: ['piece-trigger-draw'],
      powerAmount: OVER_TRIGGER_POWER_BONUS,
    })
  })

  it('keeps no-trigger checks deterministic and marks them resolved without trigger events', () => {
    const result = requireApplied(
      applyCheck(
        makeTriggerState({
          checkKind: 'drive',
          triggerType: null,
        }),
      ),
    )

    expect(result.nextState.battle?.lastCheck?.triggerResolutionState).toBe(
      'resolved_none',
    )
    expect(
      result.events.some((event) => event.type === 'trigger.revealed'),
    ).toBe(false)
    expect(result.events.at(-1)).toMatchObject({
      type: 'effect.resolved',
      effectDefinitionId: CHECK_TRIGGER_REVEAL_EFFECT_IDENTITY.id,
      operationKinds: ['trigger_check_none'],
    })
  })
})
