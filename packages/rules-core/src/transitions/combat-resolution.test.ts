import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type {
  ActionId,
  GameChoiceRequest,
  GameChoiceResponseSubmission,
  GameState,
  RequestId,
  TransitionResult,
} from '../index'
import {
  applyGameAction,
  applyGameChoiceResponse,
  buildEngineCardStatsSnapshot,
  isAppliedTransitionResult,
  isBlockedTransitionResult,
  isInvalidTransitionResult,
} from '../index'
import { PERSONA_RIDE_POWER_FLAG } from '../effects/first-effects'

function makeCombatState(
  options: {
    readonly pendingRequests?: readonly GameChoiceRequest[]
    readonly battle?: GameState['battle']
  } = {},
): GameState {
  const pendingRequests = options.pendingRequests ?? []
  const status = pendingRequests.length > 0 ? 'awaiting_choice' : 'in_progress'
  const committedGuardPieceIds = new Set(
    (options.battle?.guardPieceIds ?? []).map((pieceId) => pieceId as string),
  )

  return {
    gameId: 'game-combat-1' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status,
    revision: 0,
    turn: {
      turnNumber: 2,
      turnPlayerId: 'player-1' as GameState['turn']['turnPlayerId'],
      priorityPlayerId: 'player-1' as NonNullable<
        GameState['turn']['priorityPlayerId']
      >,
      phase: 'battle' as GameState['turn']['phase'],
      step: 'combat-window' as NonNullable<GameState['turn']['step']>,
    },
    players: [
      {
        playerId: 'player-1' as GameState['players'][number]['playerId'],
        seat: 0,
        status: 'active',
        ownedZoneIds: [
          'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
          'zone-p1-front-left' as GameState['zones'][number]['zoneId'],
          'zone-p1-back-left' as GameState['zones'][number]['zoneId'],
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
          'zone-p2-hand' as GameState['zones'][number]['zoneId'],
          'zone-p2-guardian' as GameState['zones'][number]['zoneId'],
          'zone-p2-drop' as GameState['zones'][number]['zoneId'],
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
        zoneId: 'zone-p1-front-left' as GameState['zones'][number]['zoneId'],
        kind: 'rear_guard_circle',
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
              'piece-p1-attacker' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-p1-back-left' as GameState['zones'][number]['zoneId'],
        kind: 'rear_guard_circle',
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
              'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
          },
        ],
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
        zoneId: 'zone-p2-hand' as GameState['zones'][number]['zoneId'],
        kind: 'hand',
        scope: 'player',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        visibility: 'owner-private',
        layout: {
          ordering: 'unordered',
          occupancy: 'multi',
        },
        occupants: [
          {
            pieceId:
              'piece-p2-guard-5000' as GameState['pieces'][number]['pieceId'],
          },
          {
            pieceId:
              'piece-p2-guard-10000' as GameState['pieces'][number]['pieceId'],
          },
        ].filter(
          (occupant) => !committedGuardPieceIds.has(occupant.pieceId as string),
        ),
      },
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
        occupants:
          options.battle?.guardPieceIds.map((pieceId) => ({ pieceId })) ?? [],
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
      {
        pieceId: 'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-p1-vanguard' as CardId,
      },
      {
        pieceId: 'piece-p1-attacker' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-p1-attacker' as CardId,
      },
      {
        pieceId: 'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-p1-booster' as CardId,
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
        pieceId:
          'piece-p2-guard-5000' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-2' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-p2-guard-5000' as CardId,
      },
      {
        pieceId:
          'piece-p2-guard-10000' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-2' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-p2-guard-10000' as CardId,
      },
    ],
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
        cardDefinitionId: 'card-p1-attacker' as CardId,
        cardType: 'normal-unit',
        grade: 2,
        power: 10000,
        shield: 5000,
        critical: 1,
        triggerType: null,
        keywords: [],
      },
      {
        cardDefinitionId: 'card-p1-booster' as CardId,
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
        cardDefinitionId: 'card-p2-guard-5000' as CardId,
        cardType: 'normal-unit',
        grade: 2,
        power: 10000,
        shield: 5000,
        critical: 1,
        triggerType: null,
        keywords: [],
      },
      {
        cardDefinitionId: 'card-p2-guard-10000' as CardId,
        cardType: 'normal-unit',
        grade: 1,
        power: 8000,
        shield: 10000,
        critical: 1,
        triggerType: null,
        keywords: [],
      },
    ]),
    pieceStates: [],
    flags: [],
    ...(options.battle === undefined ? {} : { battle: options.battle }),
    pendingRequests,
  }
}

function makeBattle(
  options: {
    readonly status?: NonNullable<GameState['battle']>['status']
    readonly attackerPieceId?: GameState['pieces'][number]['pieceId']
    readonly attackerZoneId?: GameState['zones'][number]['zoneId']
    readonly boostingPieceId?: GameState['pieces'][number]['pieceId']
    readonly boostingZoneId?: GameState['zones'][number]['zoneId']
    readonly guardPieceIds?: readonly GameState['pieces'][number]['pieceId'][]
  } = {},
): NonNullable<GameState['battle']> {
  return {
    battleId: 'battle-combat-1' as NonNullable<GameState['battle']>['battleId'],
    status: options.status ?? 'guard_resolved',
    attackingPlayerId: 'player-1' as NonNullable<
      GameState['battle']
    >['attackingPlayerId'],
    defendingPlayerId: 'player-2' as NonNullable<
      GameState['battle']
    >['defendingPlayerId'],
    attackerPieceId:
      options.attackerPieceId ??
      ('piece-p1-attacker' as GameState['pieces'][number]['pieceId']),
    attackerZoneId:
      options.attackerZoneId ??
      ('zone-p1-front-left' as GameState['zones'][number]['zoneId']),
    target: {
      kind: 'player',
      playerId: 'player-2' as GameState['players'][number]['playerId'],
    },
    ...(options.boostingPieceId === undefined
      ? {}
      : {
          boostingPieceId: options.boostingPieceId,
          boostingZoneId: options.boostingZoneId,
        }),
    guardPieceIds: options.guardPieceIds ?? [],
    guardZoneId: 'zone-p2-guardian' as GameState['zones'][number]['zoneId'],
  }
}

function makePendingRequest(): GameChoiceRequest {
  return {
    requestId: 'request-combat-blocked-1' as RequestId,
    type: 'confirm.boolean',
    responderPlayerId: 'player-1' as GameState['players'][number]['playerId'],
    purpose: 'battle',
    visibility: 'responder-only',
  }
}

function resolveCombat(state: GameState, actionId = 'action-resolve-combat-1') {
  return applyGameAction(state, {
    action: {
      actionId: actionId as ActionId,
      type: 'system.resolve_combat',
      actor: {
        kind: 'system',
        system: 'automatic-flow',
      },
      battleId:
        state.battle?.battleId ??
        ('battle-combat-1' as NonNullable<GameState['battle']>['battleId']),
    },
    expectedRevision: state.revision,
  })
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

describe('@web-vg/rules-core combat math foundation', () => {
  it('uses attacker base power and does not auto-add an uncommitted booster', () => {
    const state = makeCombatState({
      battle: makeBattle(),
    })
    const result = expectApplied(resolveCombat(state))

    expect(result.nextState.battle).toMatchObject({
      status: 'combat_resolved',
      combat: {
        attackPower: 10000,
        defensePower: 13000,
        shieldPower: 0,
        totalDefensePower: 13000,
        result: 'miss',
        attackerPowerComponents: [
          {
            source: 'attacker_base',
            pieceId: 'piece-p1-attacker',
            amount: 10000,
          },
        ],
      },
    })
    expect(
      result.nextState.battle?.combat?.attackerPowerComponents.some(
        (component) => component.source === 'booster_base',
      ),
    ).toBe(false)
    expect(result.events.map((event) => event.type)).toEqual([
      'battle.combat_resolved',
      'battle.attack_missed',
    ])
    expect(result.timingWindows.map((window) => window.point)).toEqual([
      'battle.combat',
      'battle.combat',
      'battle.combat',
    ])
  })

  it('adds only the committed booster contribution and produces an explicit hit', () => {
    const state = makeCombatState({
      battle: makeBattle({
        boostingPieceId:
          'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
        boostingZoneId:
          'zone-p1-back-left' as GameState['zones'][number]['zoneId'],
      }),
    })
    const result = expectApplied(resolveCombat(state))

    expect(result.nextState.battle?.combat).toMatchObject({
      attackPower: 18000,
      defensePower: 13000,
      shieldPower: 0,
      totalDefensePower: 13000,
      result: 'hit',
      attackerPowerComponents: [
        {
          source: 'attacker_base',
          pieceId: 'piece-p1-attacker',
          amount: 10000,
        },
        {
          source: 'booster_base',
          pieceId: 'piece-p1-booster',
          amount: 8000,
        },
      ],
    })
    expect(result.events[1]).toMatchObject({
      type: 'battle.attack_hit',
      attackPower: 18000,
      totalDefensePower: 13000,
    })
  })

  it('sums guardian shield into total defense and produces an explicit miss', () => {
    const state = makeCombatState({
      battle: makeBattle({
        boostingPieceId:
          'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
        boostingZoneId:
          'zone-p1-back-left' as GameState['zones'][number]['zoneId'],
        guardPieceIds: [
          'piece-p2-guard-5000' as GameState['pieces'][number]['pieceId'],
          'piece-p2-guard-10000' as GameState['pieces'][number]['pieceId'],
        ],
      }),
    })
    const result = expectApplied(resolveCombat(state))

    expect(result.nextState.battle?.combat).toMatchObject({
      attackPower: 18000,
      defensePower: 13000,
      shieldPower: 15000,
      totalDefensePower: 28000,
      result: 'miss',
      shieldComponents: [
        {
          source: 'guard_shield',
          pieceId: 'piece-p2-guard-5000',
          amount: 5000,
        },
        {
          source: 'guard_shield',
          pieceId: 'piece-p2-guard-10000',
          amount: 10000,
        },
      ],
    })
    expect(result.events[1]).toMatchObject({
      type: 'battle.attack_missed',
      attackPower: 18000,
      totalDefensePower: 28000,
    })
  })

  it('separates attack, boost, guard commitment, and combat comparison through the reducer pipeline', () => {
    const state = makeCombatState()
    const attackResult = expectApplied(
      applyGameAction(state, {
        action: {
          actionId: 'action-combat-pipeline-attack-1' as ActionId,
          type: 'battle.declare_attack',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          attackerPieceId:
            'piece-p1-attacker' as GameState['pieces'][number]['pieceId'],
          target: {
            kind: 'player',
            playerId: 'player-2' as GameState['players'][number]['playerId'],
          },
        },
        expectedRevision: state.revision,
      }),
    )
    const boostResult = expectApplied(
      applyGameAction(attackResult.nextState, {
        action: {
          actionId: 'action-combat-pipeline-boost-1' as ActionId,
          type: 'battle.commit_boost',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          attackerPieceId:
            'piece-p1-attacker' as GameState['pieces'][number]['pieceId'],
          boosterPieceId:
            'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
        },
        expectedRevision: attackResult.nextState.revision,
      }),
    )
    const guardRequestResult = expectApplied(
      applyGameAction(boostResult.nextState, {
        action: {
          actionId: 'action-combat-pipeline-guard-1' as ActionId,
          type: 'battle.guard',
          actor: {
            kind: 'player',
            playerId: 'player-2' as GameState['players'][number]['playerId'],
          },
          againstAttackerPieceId:
            'piece-p1-attacker' as GameState['pieces'][number]['pieceId'],
        },
        expectedRevision: boostResult.nextState.revision,
      }),
    )
    const request = guardRequestResult.nextState.pendingRequests[0]

    if (request?.type !== 'battle.guard_select') {
      throw new Error('Expected a battle.guard_select request.')
    }

    const guardResponse: GameChoiceResponseSubmission = {
      response: {
        requestId: request.requestId,
        responderPlayerId: request.responderPlayerId,
        type: 'answer.guard',
        selectedPieceIds: [
          'piece-p2-guard-5000' as GameState['pieces'][number]['pieceId'],
        ],
      },
      expectedRevision: guardRequestResult.nextState.revision,
    }
    const guardCommitResult = expectApplied(
      applyGameChoiceResponse(guardRequestResult.nextState, guardResponse),
    )
    const combatResult = expectApplied(
      resolveCombat(
        guardCommitResult.nextState,
        'action-combat-pipeline-resolve-1',
      ),
    )

    expect(attackResult.nextState.battle?.status).toBe('attack_declared')
    expect(boostResult.nextState.battle?.status).toBe('boost_declared')
    expect(guardRequestResult.nextState.battle?.status).toBe('guard_requested')
    expect(guardCommitResult.nextState.battle).toMatchObject({
      status: 'guard_resolved',
      guardPieceIds: ['piece-p2-guard-5000'],
    })
    expect(combatResult.nextState.battle).toMatchObject({
      status: 'combat_resolved',
      combat: {
        attackPower: 18000,
        shieldPower: 5000,
        totalDefensePower: 18000,
        result: 'hit',
      },
    })
  })

  it('keeps invalid and blocked combat resolution structured', () => {
    const vanguardAttackState = makeCombatState({
      battle: makeBattle({
        attackerPieceId:
          'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
        attackerZoneId:
          'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
      }),
    })
    const invalidResult = expectInvalid(resolveCombat(vanguardAttackState))

    expect(invalidResult.code).toBe('invalid_action')
    expect(invalidResult.message).toMatch(/drive check/i)
    expect(invalidResult.currentState).toEqual(vanguardAttackState)

    const pendingRequest = makePendingRequest()
    const blockedState = makeCombatState({
      battle: makeBattle(),
      pendingRequests: [pendingRequest],
    })
    const blockedResult = expectBlocked(resolveCombat(blockedState))

    expect(blockedResult.code).toBe('pending_request')
    expect(blockedResult.currentState).toEqual(blockedState)
  })

  it('fails predictably when combat math cannot resolve card stats', () => {
    const state = makeCombatState({
      battle: makeBattle({
        boostingPieceId:
          'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
        boostingZoneId:
          'zone-p1-back-left' as GameState['zones'][number]['zoneId'],
      }),
    })
    const { cardStats: _cardStats, ...stateWithoutStats } = state
    const result = expectInvalid(resolveCombat(stateWithoutStats))

    expect(result.code).toBe('invalid_action_reference')
    expect(result.message).toMatch(/card stats snapshot/i)
    expect(result.currentState).toEqual(stateWithoutStats)
  })

  it('lets missed attacks complete battle without damage check while preserving the combat result', () => {
    const state = makeCombatState({
      battle: makeBattle({
        guardPieceIds: [
          'piece-p2-guard-10000' as GameState['pieces'][number]['pieceId'],
        ],
      }),
    })
    const combatResult = expectApplied(
      resolveCombat({
        ...state,
        pieceStates: [
          {
            pieceId:
              'piece-p1-attacker' as GameState['pieces'][number]['pieceId'],
            orientation: 'rest',
            flags: [PERSONA_RIDE_POWER_FLAG],
            criticalModifier: 1,
          },
        ],
      }),
    )
    const completionResult = expectApplied(
      applyGameAction(combatResult.nextState, {
        action: {
          actionId: 'action-combat-miss-complete-1' as ActionId,
          type: 'system.resolve_mandatory_flow',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          scope: 'battle',
        },
        expectedRevision: combatResult.nextState.revision,
      }),
    )

    expect(completionResult.nextState.battle).toBeUndefined()
    expect(completionResult.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'battle.guardians_cleaned_up',
      'battle.completed',
    ])
    expect(completionResult.events[1]).toMatchObject({
      type: 'battle.guardians_cleaned_up',
      guardPieceIds: ['piece-p2-guard-10000'],
      fromZoneId: 'zone-p2-guardian',
      toZoneId: 'zone-p2-drop',
    })
    expect(completionResult.events[2]).toMatchObject({
      type: 'battle.completed',
      reason: 'attack_missed',
      guardPieceIds: ['piece-p2-guard-10000'],
      cleanupMovedPieceIds: ['piece-p2-guard-10000'],
      combat: {
        result: 'miss',
      },
    })
    expect(
      completionResult.nextState.zones.find(
        (zone) => zone.zoneId === 'zone-p2-guardian',
      )?.occupants,
    ).toEqual([])
    expect(
      completionResult.nextState.zones.find(
        (zone) => zone.zoneId === 'zone-p2-drop',
      )?.occupants,
    ).toEqual([
      {
        pieceId: 'piece-p2-guard-10000',
      },
    ])
    expect(
      completionResult.nextState.pieceStates.find(
        (pieceState) => pieceState.pieceId === 'piece-p1-attacker',
      ),
    ).toMatchObject({
      flags: [PERSONA_RIDE_POWER_FLAG],
      criticalModifier: 1,
    })
  })
})
