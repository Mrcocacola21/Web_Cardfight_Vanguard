import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type {
  ActionId,
  GameChoiceRequest,
  GameState,
  RequestId,
  TransitionResult,
} from '../index'
import {
  applyGameAction,
  buildEngineCardStatsSnapshot,
  isAppliedTransitionResult,
  isBlockedTransitionResult,
  isInvalidTransitionResult,
} from '../index'

type TestBattleCombatState = NonNullable<
  NonNullable<GameState['battle']>['combat']
>
type TestBattleDamageState = NonNullable<
  NonNullable<GameState['battle']>['damage']
>

function makeCheckBattleState(
  options: {
    readonly pendingRequests?: readonly GameChoiceRequest[]
    readonly battle?: GameState['battle']
  } = {},
): GameState {
  const pendingRequests = options.pendingRequests ?? []
  const status = pendingRequests.length > 0 ? 'awaiting_choice' : 'in_progress'

  return {
    gameId: 'game-check-1' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status,
    revision: 0,
    turn: {
      turnNumber: 1,
      turnPlayerId: 'player-1' as GameState['turn']['turnPlayerId'],
      priorityPlayerId: 'player-1' as NonNullable<
        GameState['turn']['priorityPlayerId']
      >,
      phase: 'battle' as GameState['turn']['phase'],
      step: 'check-window' as NonNullable<GameState['turn']['step']>,
    },
    players: [
      {
        playerId: 'player-1' as GameState['players'][number]['playerId'],
        seat: 0,
        status: 'active',
        ownedZoneIds: [
          'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
          'zone-p1-deck' as GameState['zones'][number]['zoneId'],
          'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        ],
        counters: [],
        flags: [],
      },
      {
        playerId: 'player-2' as GameState['players'][number]['playerId'],
        seat: 1,
        status: 'waiting',
        ownedZoneIds: [
          'zone-p2-vanguard' as GameState['zones'][number]['zoneId'],
          'zone-p2-deck' as GameState['zones'][number]['zoneId'],
          'zone-p2-damage' as GameState['zones'][number]['zoneId'],
        ],
        counters: [],
        flags: [],
      },
    ],
    zones: [
      {
        zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
        kind: 'vanguard_circle',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'single',
        },
        occupants: [
          {
            pieceId:
              'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-p1-deck' as GameState['zones'][number]['zoneId'],
        kind: 'deck',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'owner-private',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: [
          {
            pieceId:
              'piece-drive-top' as GameState['pieces'][number]['pieceId'],
          },
          {
            pieceId:
              'piece-drive-next' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        kind: 'hand',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'owner-private',
        layout: {
          ordering: 'unordered',
          occupancy: 'multi',
        },
        occupants: [],
      },
      {
        zoneId: 'zone-p2-vanguard' as GameState['zones'][number]['zoneId'],
        kind: 'vanguard_circle',
        scope: 'player',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'single',
        },
        occupants: [
          {
            pieceId:
              'piece-p2-vanguard' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-p2-deck' as GameState['zones'][number]['zoneId'],
        kind: 'deck',
        scope: 'player',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        visibility: 'owner-private',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: [
          {
            pieceId:
              'piece-damage-top' as GameState['pieces'][number]['pieceId'],
          },
          {
            pieceId:
              'piece-damage-next' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-p2-damage' as GameState['zones'][number]['zoneId'],
        kind: 'damage',
        scope: 'player',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: [],
      },
    ],
    pieces: [
      {
        pieceId: 'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-p1-vanguard' as CardId,
      },
      {
        pieceId: 'piece-drive-top' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-drive-top' as CardId,
      },
      {
        pieceId: 'piece-drive-next' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-drive-next' as CardId,
      },
      {
        pieceId: 'piece-p2-vanguard' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-2' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-p2-vanguard' as CardId,
      },
      {
        pieceId: 'piece-damage-top' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-2' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-damage-top' as CardId,
      },
      {
        pieceId: 'piece-damage-next' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-2' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-damage-next' as CardId,
      },
    ],
    pieceStates: [],
    cardStats: buildEngineCardStatsSnapshot([
      {
        cardDefinitionId: 'card-p1-vanguard' as CardId,
        cardType: 'normal-unit',
        grade: 3,
        power: 13000,
        shield: 0,
        critical: 1,
        triggerType: null,
        keywords: [],
      },
      {
        cardDefinitionId: 'card-drive-top' as CardId,
        cardType: 'normal-unit',
        grade: 0,
        power: 5000,
        shield: 15000,
        critical: 1,
        triggerType: null,
        keywords: [],
      },
      {
        cardDefinitionId: 'card-drive-next' as CardId,
        cardType: 'normal-unit',
        grade: 1,
        power: 8000,
        shield: 5000,
        critical: 1,
        triggerType: null,
        keywords: [],
      },
      {
        cardDefinitionId: 'card-p2-vanguard' as CardId,
        cardType: 'normal-unit',
        grade: 3,
        power: 13000,
        shield: 0,
        critical: 1,
        triggerType: null,
        keywords: [],
      },
      {
        cardDefinitionId: 'card-damage-top' as CardId,
        cardType: 'normal-unit',
        grade: 0,
        power: 5000,
        shield: 15000,
        critical: 1,
        triggerType: null,
        keywords: [],
      },
      {
        cardDefinitionId: 'card-damage-next' as CardId,
        cardType: 'normal-unit',
        grade: 1,
        power: 8000,
        shield: 5000,
        critical: 1,
        triggerType: null,
        keywords: [],
      },
      {
        cardDefinitionId: 'card-p2-guardian' as CardId,
        cardType: 'normal-unit',
        grade: 1,
        power: 8000,
        shield: 10000,
        critical: 1,
        triggerType: null,
        keywords: [],
      },
    ]),
    flags: [],
    ...(options.battle === undefined
      ? {
          battle: {
            battleId: 'battle-check-1' as NonNullable<
              GameState['battle']
            >['battleId'],
            status: 'guard_resolved' as const,
            attackingPlayerId: 'player-1' as NonNullable<
              GameState['battle']
            >['attackingPlayerId'],
            defendingPlayerId: 'player-2' as NonNullable<
              GameState['battle']
            >['defendingPlayerId'],
            attackerPieceId: 'piece-p1-vanguard' as NonNullable<
              GameState['battle']
            >['attackerPieceId'],
            attackerZoneId: 'zone-p1-vanguard' as NonNullable<
              GameState['battle']
            >['attackerZoneId'],
            target: {
              kind: 'player' as const,
              playerId: 'player-2' as GameState['players'][number]['playerId'],
            },
            guardPieceIds: [],
          },
        }
      : {
          battle: options.battle,
        }),
    pendingRequests,
  }
}

function makeHitCombatSnapshot(
  options: {
    readonly attackPower?: number
    readonly shieldPower?: number
    readonly shieldComponents?: readonly TestBattleCombatState['shieldComponents'][number][]
  } = {},
): TestBattleCombatState {
  const attackPower = options.attackPower ?? 13000
  const shieldPower = options.shieldPower ?? 0
  const totalDefensePower = 13000 + shieldPower

  return {
    attackPower,
    attackerPowerComponents: [
      {
        source: 'attacker_base',
        pieceId: 'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
        amount: 13000,
      },
      ...(attackPower > 13000
        ? [
            {
              source: 'piece_power_modifier' as const,
              pieceId:
                'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
              amount: attackPower - 13000,
            },
          ]
        : []),
    ],
    defensePower: 13000,
    defensePowerComponents: [
      {
        source: 'defender_base',
        pieceId: 'piece-p2-vanguard' as GameState['pieces'][number]['pieceId'],
        amount: 13000,
      },
    ],
    shieldPower,
    shieldComponents: options.shieldComponents ?? [],
    totalDefensePower,
    result: 'hit',
  }
}

function makeDamageSnapshot(
  options: {
    readonly damageBefore?: number
    readonly damageAfter?: number
    readonly outcome?: TestBattleDamageState['outcome']
  } = {},
): TestBattleDamageState {
  const damageBefore = options.damageBefore ?? 0
  const damageAfter = options.damageAfter ?? 1

  return {
    playerId: 'player-2' as GameState['players'][number]['playerId'],
    damageZoneId: 'zone-p2-damage' as GameState['zones'][number]['zoneId'],
    damageBefore,
    damageAfter,
    defeatThreshold: 6,
    outcome: options.outcome ?? (damageAfter >= 6 ? 'lethal' : 'non_lethal'),
  }
}

function resolveCombat(state: GameState, actionId = 'action-combat-1') {
  return applyGameAction(state, {
    action: {
      actionId: actionId as ActionId,
      type: 'system.resolve_combat',
      actor: {
        kind: 'system',
        system: 'automatic-flow',
      },
      battleId: 'battle-check-1' as NonNullable<
        GameState['battle']
      >['battleId'],
    },
    expectedRevision: state.revision,
  })
}

function makePendingRequest(requestId = 'request-check-1'): GameChoiceRequest {
  return {
    requestId: requestId as RequestId,
    type: 'confirm.boolean',
    responderPlayerId: 'player-1' as GameState['players'][number]['playerId'],
    purpose: 'battle',
    visibility: 'responder-only',
  }
}

function countLocatedPieceOccurrences(
  state: GameState,
  pieceId: GameState['pieces'][number]['pieceId'],
): number {
  return state.zones
    .flatMap((zone) => zone.occupants)
    .filter((occupant) => occupant.pieceId === pieceId).length
}

function expectApplied(result: TransitionResult) {
  expect(isAppliedTransitionResult(result)).toBe(true)

  if (!isAppliedTransitionResult(result)) {
    throw new Error(
      `Expected an applied transition result, received ${result.status}.`,
    )
  }

  return result
}

function expectBlocked(result: TransitionResult) {
  expect(isBlockedTransitionResult(result)).toBe(true)

  if (!isBlockedTransitionResult(result)) {
    throw new Error(
      `Expected a blocked transition result, received ${result.status}.`,
    )
  }

  return result
}

function expectInvalid(result: TransitionResult) {
  expect(isInvalidTransitionResult(result)).toBe(true)

  if (!isInvalidTransitionResult(result)) {
    throw new Error(
      `Expected an invalid transition result, received ${result.status}.`,
    )
  }

  return result
}

describe('@web-vg/rules-core drive / damage check foundation', () => {
  it('applies a deterministic drive check and moves the revealed top card into hand', () => {
    const state = makeCheckBattleState()
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-drive-1' as ActionId,
        type: 'system.drive_check',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        battleId: 'battle-check-1' as NonNullable<
          GameState['battle']
        >['battleId'],
        playerId: 'player-1' as GameState['players'][number]['playerId'],
        fromZoneId: 'zone-p1-deck' as GameState['zones'][number]['zoneId'],
        toZoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        count: 1,
      },
      expectedRevision: state.revision,
    })
    const appliedResult = expectApplied(result)
    const deckZone = appliedResult.nextState.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p1-deck' as GameState['zones'][number]['zoneId']),
    )
    const handZone = appliedResult.nextState.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p1-hand' as GameState['zones'][number]['zoneId']),
    )

    expect(deckZone?.occupants).toEqual([
      {
        pieceId: 'piece-drive-next' as GameState['pieces'][number]['pieceId'],
      },
    ])
    expect(handZone?.occupants).toEqual([
      {
        pieceId: 'piece-drive-top' as GameState['pieces'][number]['pieceId'],
      },
    ])
    expect(appliedResult.nextState.battle).toMatchObject({
      status: 'drive_checked',
      lastCheck: {
        kind: 'drive',
        playerId: 'player-1',
        fromZoneId: 'zone-p1-deck',
        toZoneId: 'zone-p1-hand',
        triggerResolutionState: 'resolved_none',
        revealedCards: [
          {
            pieceId: 'piece-drive-top',
            cardDefinitionId: 'card-drive-top',
          },
        ],
      },
    })
    expect(
      countLocatedPieceOccurrences(
        appliedResult.nextState,
        'piece-drive-top' as GameState['pieces'][number]['pieceId'],
      ),
    ).toBe(1)
    expect(appliedResult.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'battle.drive_checked',
      'effect.resolved',
    ])
    expect(appliedResult.events[0]).toMatchObject({
      type: 'piece.moved',
      reason: 'drive_check',
    })
    expect(appliedResult.timingWindows.map((window) => window.point)).toEqual([
      'battle.drive_check',
      'battle.drive_check',
      'battle.drive_check',
    ])
  })

  it('rejects drive checks without a coherent battle context and blocks them behind pending requests', () => {
    const invalidState = makeCheckBattleState({
      battle: undefined,
    })
    const { battle: _battle, ...stateWithoutBattle } = invalidState
    const invalidResult = applyGameAction(stateWithoutBattle, {
      action: {
        actionId: 'action-drive-invalid-1' as ActionId,
        type: 'system.drive_check',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        battleId: 'battle-missing' as NonNullable<
          GameState['battle']
        >['battleId'],
        playerId: 'player-1' as GameState['players'][number]['playerId'],
        fromZoneId: 'zone-p1-deck' as GameState['zones'][number]['zoneId'],
        toZoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        count: 1,
      },
      expectedRevision: stateWithoutBattle.revision,
    })
    expectInvalid(invalidResult)

    const pendingRequest = makePendingRequest()
    const blockedState = makeCheckBattleState({
      pendingRequests: [pendingRequest],
    })
    const blockedResult = applyGameAction(blockedState, {
      action: {
        actionId: 'action-drive-blocked-1' as ActionId,
        type: 'system.drive_check',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        battleId: 'battle-check-1' as NonNullable<
          GameState['battle']
        >['battleId'],
        playerId: 'player-1' as GameState['players'][number]['playerId'],
        fromZoneId: 'zone-p1-deck' as GameState['zones'][number]['zoneId'],
        toZoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        count: 1,
      },
      expectedRevision: blockedState.revision,
    })
    const blockedTransition = expectBlocked(blockedResult)

    expect(blockedTransition.code).toBe('pending_request')
  })

  it('applies a deterministic damage check after drive check and moves the revealed top card into damage', () => {
    const state = makeCheckBattleState()
    const driveResult = expectApplied(
      applyGameAction(state, {
        action: {
          actionId: 'action-drive-2' as ActionId,
          type: 'system.drive_check',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          battleId: 'battle-check-1' as NonNullable<
            GameState['battle']
          >['battleId'],
          playerId: 'player-1' as GameState['players'][number]['playerId'],
          fromZoneId: 'zone-p1-deck' as GameState['zones'][number]['zoneId'],
          toZoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
          count: 1,
        },
        expectedRevision: state.revision,
      }),
    )
    const combatResult = expectApplied(
      resolveCombat(driveResult.nextState, 'action-combat-damage-1'),
    )
    const damageResult = applyGameAction(combatResult.nextState, {
      action: {
        actionId: 'action-damage-1' as ActionId,
        type: 'system.damage_check',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        battleId: 'battle-check-1' as NonNullable<
          GameState['battle']
        >['battleId'],
        playerId: 'player-2' as GameState['players'][number]['playerId'],
        fromZoneId: 'zone-p2-deck' as GameState['zones'][number]['zoneId'],
        toZoneId: 'zone-p2-damage' as GameState['zones'][number]['zoneId'],
        count: 1,
      },
      expectedRevision: combatResult.nextState.revision,
    })
    const appliedDamageResult = expectApplied(damageResult)
    const deckZone = appliedDamageResult.nextState.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p2-deck' as GameState['zones'][number]['zoneId']),
    )
    const damageZone = appliedDamageResult.nextState.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p2-damage' as GameState['zones'][number]['zoneId']),
    )

    expect(deckZone?.occupants).toEqual([
      {
        pieceId: 'piece-damage-next' as GameState['pieces'][number]['pieceId'],
      },
    ])
    expect(damageZone?.occupants).toEqual([
      {
        pieceId: 'piece-damage-top' as GameState['pieces'][number]['pieceId'],
      },
    ])
    expect(appliedDamageResult.nextState.battle).toMatchObject({
      status: 'damage_checked',
      lastCheck: {
        kind: 'damage',
        playerId: 'player-2',
        fromZoneId: 'zone-p2-deck',
        toZoneId: 'zone-p2-damage',
        triggerResolutionState: 'resolved_none',
        revealedCards: [
          {
            pieceId: 'piece-damage-top',
            cardDefinitionId: 'card-damage-top',
          },
        ],
      },
      damage: {
        playerId: 'player-2',
        damageZoneId: 'zone-p2-damage',
        damageBefore: 0,
        damageAfter: 1,
        defeatThreshold: 6,
        outcome: 'non_lethal',
      },
    })
    expect(
      countLocatedPieceOccurrences(
        appliedDamageResult.nextState,
        'piece-damage-top' as GameState['pieces'][number]['pieceId'],
      ),
    ).toBe(1)
    expect(appliedDamageResult.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'battle.damage_checked',
      'player.damage_changed',
      'effect.resolved',
    ])
    expect(appliedDamageResult.events[0]).toMatchObject({
      type: 'piece.moved',
      reason: 'damage_check',
    })
    expect(
      appliedDamageResult.timingWindows.map((window) => window.point),
    ).toEqual([
      'battle.damage_check',
      'battle.damage_check',
      'battle.damage_check',
    ])
  })

  it('completes and clears battle state through battle-scoped mandatory flow', () => {
    const state = makeCheckBattleState()
    const driveResult = expectApplied(
      applyGameAction(state, {
        action: {
          actionId: 'action-drive-complete-1' as ActionId,
          type: 'system.drive_check',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          battleId: 'battle-check-1' as NonNullable<
            GameState['battle']
          >['battleId'],
          playerId: 'player-1' as GameState['players'][number]['playerId'],
          fromZoneId: 'zone-p1-deck' as GameState['zones'][number]['zoneId'],
          toZoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
          count: 1,
        },
        expectedRevision: state.revision,
      }),
    )
    const combatResult = expectApplied(
      resolveCombat(driveResult.nextState, 'action-combat-complete-1'),
    )
    const damageResult = expectApplied(
      applyGameAction(combatResult.nextState, {
        action: {
          actionId: 'action-damage-complete-1' as ActionId,
          type: 'system.damage_check',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          battleId: 'battle-check-1' as NonNullable<
            GameState['battle']
          >['battleId'],
          playerId: 'player-2' as GameState['players'][number]['playerId'],
          fromZoneId: 'zone-p2-deck' as GameState['zones'][number]['zoneId'],
          toZoneId: 'zone-p2-damage' as GameState['zones'][number]['zoneId'],
          count: 1,
        },
        expectedRevision: combatResult.nextState.revision,
      }),
    )
    const completionResult = applyGameAction(damageResult.nextState, {
      action: {
        actionId: 'action-battle-complete-1' as ActionId,
        type: 'system.resolve_mandatory_flow',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        scope: 'battle',
      },
      expectedRevision: damageResult.nextState.revision,
    })
    const appliedCompletionResult = expectApplied(completionResult)

    expect(appliedCompletionResult.nextState.battle).toBeUndefined()
    expect(appliedCompletionResult.events.map((event) => event.type)).toEqual([
      'battle.completed',
    ])
    expect(appliedCompletionResult.events[0]).toMatchObject({
      type: 'battle.completed',
      battleId: 'battle-check-1',
      reason: 'damage_check_completed',
      guardPieceIds: [],
      cleanupMovedPieceIds: [],
      lastCheck: {
        kind: 'damage',
      },
    })
    expect(
      appliedCompletionResult.timingWindows.map((window) => window.window),
    ).toEqual(['before', 'on', 'after'])
    expect(appliedCompletionResult.timingWindows[1]).toMatchObject({
      point: 'battle.completion',
      relatedEventSequence: 0,
      battleId: 'battle-check-1',
    })
  })

  it('cleans committed guardians to drop while preserving the completed battle fact', () => {
    const baseState = makeCheckBattleState({
      battle: {
        battleId: 'battle-check-guard-cleanup' as NonNullable<
          GameState['battle']
        >['battleId'],
        status: 'damage_checked',
        attackingPlayerId: 'player-1' as NonNullable<
          GameState['battle']
        >['attackingPlayerId'],
        defendingPlayerId: 'player-2' as NonNullable<
          GameState['battle']
        >['defendingPlayerId'],
        attackerPieceId: 'piece-p1-vanguard' as NonNullable<
          GameState['battle']
        >['attackerPieceId'],
        attackerZoneId: 'zone-p1-vanguard' as NonNullable<
          GameState['battle']
        >['attackerZoneId'],
        target: {
          kind: 'player',
          playerId: 'player-2' as GameState['players'][number]['playerId'],
        },
        guardPieceIds: [
          'piece-p2-guardian' as GameState['pieces'][number]['pieceId'],
        ],
        guardZoneId: 'zone-p2-guardian' as GameState['zones'][number]['zoneId'],
        combat: makeHitCombatSnapshot({
          attackPower: 23000,
          shieldPower: 10000,
          shieldComponents: [
            {
              source: 'guard_shield',
              pieceId:
                'piece-p2-guardian' as GameState['pieces'][number]['pieceId'],
              amount: 10000,
            },
          ],
        }),
        damage: makeDamageSnapshot(),
        lastCheck: {
          kind: 'damage',
          playerId: 'player-2' as GameState['players'][number]['playerId'],
          fromZoneId: 'zone-p2-deck' as GameState['zones'][number]['zoneId'],
          toZoneId: 'zone-p2-damage' as GameState['zones'][number]['zoneId'],
          revealedCards: [
            {
              pieceId:
                'piece-damage-top' as GameState['pieces'][number]['pieceId'],
              cardDefinitionId: 'card-damage-top' as CardId,
            },
          ],
          triggerResolutionState: 'pending_future_engine',
        },
      },
    })
    const state: GameState = {
      ...baseState,
      players: baseState.players.map((player) =>
        player.playerId ===
        ('player-2' as GameState['players'][number]['playerId'])
          ? {
              ...player,
              ownedZoneIds: [
                ...player.ownedZoneIds,
                'zone-p2-guardian' as GameState['zones'][number]['zoneId'],
                'zone-p2-drop' as GameState['zones'][number]['zoneId'],
              ],
            }
          : player,
      ),
      zones: [
        ...baseState.zones,
        {
          zoneId: 'zone-p2-guardian' as GameState['zones'][number]['zoneId'],
          kind: 'guardian_circle',
          scope: 'player',
          ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
          visibility: 'public',
          layout: {
            ordering: 'unordered',
            occupancy: 'multi',
          },
          occupants: [
            {
              pieceId:
                'piece-p2-guardian' as GameState['pieces'][number]['pieceId'],
            },
          ],
        },
        {
          zoneId: 'zone-p2-drop' as GameState['zones'][number]['zoneId'],
          kind: 'drop',
          scope: 'player',
          ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
          visibility: 'public',
          layout: {
            ordering: 'ordered',
            occupancy: 'multi',
          },
          occupants: [],
        },
      ],
      pieces: [
        ...baseState.pieces,
        {
          pieceId:
            'piece-p2-guardian' as GameState['pieces'][number]['pieceId'],
          kind: 'card',
          ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
          controllerPlayerId:
            'player-2' as GameState['players'][number]['playerId'],
          cardDefinitionId: 'card-p2-guardian' as CardId,
        },
      ],
      pieceStates: [
        {
          pieceId:
            'piece-p2-guardian' as GameState['pieces'][number]['pieceId'],
          orientation: 'rest',
          flags: ['locked'],
        },
      ],
    }
    const completionResult = applyGameAction(state, {
      action: {
        actionId: 'action-battle-complete-guard-cleanup-1' as ActionId,
        type: 'system.resolve_mandatory_flow',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        scope: 'battle',
      },
      expectedRevision: state.revision,
    })
    const appliedCompletionResult = expectApplied(completionResult)
    const guardianZone = appliedCompletionResult.nextState.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p2-guardian' as GameState['zones'][number]['zoneId']),
    )
    const dropZone = appliedCompletionResult.nextState.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p2-drop' as GameState['zones'][number]['zoneId']),
    )

    expect(appliedCompletionResult.nextState.battle).toBeUndefined()
    expect(guardianZone?.occupants).toEqual([])
    expect(dropZone?.occupants).toEqual([
      {
        pieceId: 'piece-p2-guardian' as GameState['pieces'][number]['pieceId'],
      },
    ])
    expect(appliedCompletionResult.nextState.pieceStates).toEqual([])
    expect(appliedCompletionResult.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'battle.guardians_cleaned_up',
      'battle.completed',
    ])
    expect(appliedCompletionResult.events[0]).toMatchObject({
      type: 'piece.moved',
      reason: 'battle_cleanup',
    })
    expect(appliedCompletionResult.events[1]).toMatchObject({
      type: 'battle.guardians_cleaned_up',
      guardPieceIds: ['piece-p2-guardian'],
      fromZoneId: 'zone-p2-guardian',
      toZoneId: 'zone-p2-drop',
    })
    expect(appliedCompletionResult.events[2]).toMatchObject({
      type: 'battle.completed',
      cleanupMovedPieceIds: ['piece-p2-guardian'],
      cleanupFromZoneId: 'zone-p2-guardian',
      cleanupToZoneId: 'zone-p2-drop',
      guardPieceIds: ['piece-p2-guardian'],
    })
  })

  it('rejects invalid damage-check sequencing and does not corrupt battle state on repeated invalid attempts', () => {
    const state = makeCheckBattleState()
    const invalidResult = applyGameAction(state, {
      action: {
        actionId: 'action-damage-invalid-1' as ActionId,
        type: 'system.damage_check',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        battleId: 'battle-check-1' as NonNullable<
          GameState['battle']
        >['battleId'],
        playerId: 'player-2' as GameState['players'][number]['playerId'],
        fromZoneId: 'zone-p2-deck' as GameState['zones'][number]['zoneId'],
        toZoneId: 'zone-p2-damage' as GameState['zones'][number]['zoneId'],
        count: 1,
      },
      expectedRevision: state.revision,
    })
    const invalidTransition = expectInvalid(invalidResult)

    expect(invalidTransition.currentState).toEqual(state)

    const driveResult = expectApplied(
      applyGameAction(state, {
        action: {
          actionId: 'action-drive-3' as ActionId,
          type: 'system.drive_check',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          battleId: 'battle-check-1' as NonNullable<
            GameState['battle']
          >['battleId'],
          playerId: 'player-1' as GameState['players'][number]['playerId'],
          fromZoneId: 'zone-p1-deck' as GameState['zones'][number]['zoneId'],
          toZoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
          count: 1,
        },
        expectedRevision: state.revision,
      }),
    )
    const combatResult = expectApplied(
      resolveCombat(driveResult.nextState, 'action-combat-damage-2'),
    )
    const validDamageResult = expectApplied(
      applyGameAction(combatResult.nextState, {
        action: {
          actionId: 'action-damage-2' as ActionId,
          type: 'system.damage_check',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          battleId: 'battle-check-1' as NonNullable<
            GameState['battle']
          >['battleId'],
          playerId: 'player-2' as GameState['players'][number]['playerId'],
          fromZoneId: 'zone-p2-deck' as GameState['zones'][number]['zoneId'],
          toZoneId: 'zone-p2-damage' as GameState['zones'][number]['zoneId'],
          count: 1,
        },
        expectedRevision: combatResult.nextState.revision,
      }),
    )
    const repeatedInvalidResult = applyGameAction(validDamageResult.nextState, {
      action: {
        actionId: 'action-damage-invalid-2' as ActionId,
        type: 'system.damage_check',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        battleId: 'battle-check-1' as NonNullable<
          GameState['battle']
        >['battleId'],
        playerId: 'player-2' as GameState['players'][number]['playerId'],
        fromZoneId: 'zone-p2-deck' as GameState['zones'][number]['zoneId'],
        toZoneId: 'zone-p2-damage' as GameState['zones'][number]['zoneId'],
        count: 1,
      },
      expectedRevision: validDamageResult.nextState.revision,
    })
    const repeatedInvalidTransition = expectInvalid(repeatedInvalidResult)

    expect(repeatedInvalidTransition.currentState).toEqual(
      validDamageResult.nextState,
    )
  })
})
