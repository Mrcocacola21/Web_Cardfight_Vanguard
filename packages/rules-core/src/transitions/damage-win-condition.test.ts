import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type { ActionId, GameState, TransitionResult } from '../index'
import {
  applyGameAction,
  isAppliedTransitionResult,
  isInvalidTransitionResult,
  resolvePlayerDamageState,
} from '../index'

const PLAYER_1 = 'player-damage-1' as GameState['players'][number]['playerId']
const PLAYER_2 = 'player-damage-2' as GameState['players'][number]['playerId']

function makeDamageBattleState(
  options: {
    readonly existingDamageCount?: number
    readonly combatResult?: NonNullable<
      NonNullable<GameState['battle']>['combat']
    >['result']
    readonly guardPieceIds?: readonly GameState['pieces'][number]['pieceId'][]
  } = {},
): GameState {
  const existingDamageCount = options.existingDamageCount ?? 0
  const combatResult = options.combatResult ?? 'hit'
  const guardPieceIds = options.guardPieceIds ?? []
  const existingDamageOccupants = Array.from(
    { length: existingDamageCount },
    (_, index) => ({
      pieceId:
        `piece-existing-damage-${index + 1}` as GameState['pieces'][number]['pieceId'],
    }),
  )
  const existingDamagePieces = existingDamageOccupants.map(
    (occupant, index) => ({
      pieceId: occupant.pieceId,
      kind: 'card' as const,
      ownerPlayerId: PLAYER_2,
      controllerPlayerId: PLAYER_2,
      cardDefinitionId: `card-existing-damage-${index + 1}` as CardId,
    }),
  )

  return {
    gameId: 'game-damage-1' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status: 'in_progress',
    revision: 0,
    turn: {
      turnNumber: 1,
      turnPlayerId: PLAYER_1,
      priorityPlayerId: PLAYER_1,
      phase: 'battle',
      step: 'damage-window',
    },
    players: [
      {
        playerId: PLAYER_1,
        seat: 0,
        status: 'active',
        ownedZoneIds: [
          'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
        ],
        counters: [],
        flags: [],
      },
      {
        playerId: PLAYER_2,
        seat: 1,
        status: 'waiting',
        ownedZoneIds: [
          'zone-p2-vanguard' as GameState['zones'][number]['zoneId'],
          'zone-p2-deck' as GameState['zones'][number]['zoneId'],
          'zone-p2-damage' as GameState['zones'][number]['zoneId'],
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
        ownerPlayerId: PLAYER_1,
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
        zoneId: 'zone-p2-vanguard' as GameState['zones'][number]['zoneId'],
        kind: 'vanguard_circle',
        scope: 'player',
        ownerPlayerId: PLAYER_2,
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
        ownerPlayerId: PLAYER_2,
        visibility: 'owner-private',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: [
          {
            pieceId:
              'piece-damage-check-top' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-p2-damage' as GameState['zones'][number]['zoneId'],
        kind: 'damage',
        scope: 'player',
        ownerPlayerId: PLAYER_2,
        visibility: 'public',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: existingDamageOccupants,
      },
      {
        zoneId: 'zone-p2-guardian' as GameState['zones'][number]['zoneId'],
        kind: 'guardian_circle',
        scope: 'player',
        ownerPlayerId: PLAYER_2,
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'multi',
        },
        occupants: guardPieceIds.map((pieceId) => ({ pieceId })),
      },
      {
        zoneId: 'zone-p2-drop' as GameState['zones'][number]['zoneId'],
        kind: 'drop',
        scope: 'player',
        ownerPlayerId: PLAYER_2,
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
        pieceId: 'piece-p1-attacker' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: PLAYER_1,
        controllerPlayerId: PLAYER_1,
        cardDefinitionId: 'card-p1-attacker' as CardId,
      },
      {
        pieceId: 'piece-p2-vanguard' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: PLAYER_2,
        controllerPlayerId: PLAYER_2,
        cardDefinitionId: 'card-p2-vanguard' as CardId,
      },
      {
        pieceId:
          'piece-damage-check-top' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: PLAYER_2,
        controllerPlayerId: PLAYER_2,
        cardDefinitionId: 'card-damage-check-top' as CardId,
      },
      ...existingDamagePieces,
      ...guardPieceIds.map((pieceId, index) => ({
        pieceId,
        kind: 'card' as const,
        ownerPlayerId: PLAYER_2,
        controllerPlayerId: PLAYER_2,
        cardDefinitionId: `card-p2-guard-${index + 1}` as CardId,
      })),
    ],
    pieceStates: [],
    flags: [],
    battle: {
      battleId: 'battle-damage-1' as NonNullable<
        GameState['battle']
      >['battleId'],
      status: 'combat_resolved',
      attackingPlayerId: PLAYER_1,
      defendingPlayerId: PLAYER_2,
      attackerPieceId:
        'piece-p1-attacker' as GameState['pieces'][number]['pieceId'],
      attackerZoneId:
        'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
      target: {
        kind: 'player',
        playerId: PLAYER_2,
      },
      guardPieceIds,
      ...(guardPieceIds.length === 0
        ? {}
        : {
            guardZoneId:
              'zone-p2-guardian' as GameState['zones'][number]['zoneId'],
          }),
      combat: {
        attackPower: combatResult === 'hit' ? 13000 : 10000,
        attackerPowerComponents: [
          {
            source: 'attacker_base',
            pieceId:
              'piece-p1-attacker' as GameState['pieces'][number]['pieceId'],
            amount: combatResult === 'hit' ? 13000 : 10000,
          },
        ],
        attackCritical: 1,
        attackerCriticalComponents: [
          {
            source: 'attacker_base_critical',
            pieceId:
              'piece-p1-attacker' as GameState['pieces'][number]['pieceId'],
            amount: 1,
          },
        ],
        defensePower: 13000,
        defensePowerComponents: [
          {
            source: 'defender_base',
            pieceId:
              'piece-p2-vanguard' as GameState['pieces'][number]['pieceId'],
            amount: 13000,
          },
        ],
        shieldPower: 0,
        shieldComponents: [],
        totalDefensePower: 13000,
        damageCheckCount: combatResult === 'hit' ? 1 : 0,
        result: combatResult,
      },
    },
    pendingRequests: [],
  }
}

function applyDamageCheck(state: GameState): TransitionResult {
  return applyGameAction(state, {
    action: {
      actionId: `action-damage-check-r${state.revision}` as ActionId,
      type: 'system.damage_check',
      actor: {
        kind: 'system',
        system: 'automatic-flow',
      },
      battleId:
        state.battle?.battleId ??
        ('battle-damage-1' as NonNullable<GameState['battle']>['battleId']),
      playerId: PLAYER_2,
      fromZoneId: 'zone-p2-deck' as GameState['zones'][number]['zoneId'],
      toZoneId: 'zone-p2-damage' as GameState['zones'][number]['zoneId'],
      count: 1,
    },
    expectedRevision: state.revision,
  })
}

function completeBattle(state: GameState): TransitionResult {
  return applyGameAction(state, {
    action: {
      actionId: `action-complete-battle-r${state.revision}` as ActionId,
      type: 'system.resolve_mandatory_flow',
      actor: {
        kind: 'system',
        system: 'automatic-flow',
      },
      scope: 'battle',
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

function expectInvalid(result: TransitionResult) {
  expect(isInvalidTransitionResult(result)).toBe(true)

  if (!isInvalidTransitionResult(result)) {
    throw new Error(
      `Expected an invalid transition result, received ${result.status}.`,
    )
  }

  return result
}

describe('@web-vg/rules-core damage and win condition foundation', () => {
  it('counts damage from the canonical player damage zone', () => {
    const state = makeDamageBattleState({ existingDamageCount: 4 })
    const damage = resolvePlayerDamageState(state, PLAYER_2)

    expect(damage).toMatchObject({
      ok: true,
      damage: {
        playerId: PLAYER_2,
        damageZoneId: 'zone-p2-damage',
        damageCount: 4,
        defeatThreshold: 6,
        isDefeatedByDamage: false,
      },
    })
  })

  it('records a non-lethal 4 to 5 damage branch and then completes battle normally', () => {
    const damageResult = expectApplied(
      applyDamageCheck(makeDamageBattleState({ existingDamageCount: 4 })),
    )

    expect(damageResult.nextState.status).toBe('in_progress')
    expect(damageResult.nextState.battle).toMatchObject({
      status: 'damage_checked',
      damage: {
        playerId: PLAYER_2,
        damageBefore: 4,
        damageAfter: 5,
        defeatThreshold: 6,
        outcome: 'non_lethal',
      },
    })
    expect(damageResult.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'battle.damage_checked',
      'player.damage_changed',
      'effect.resolved',
    ])
    expect(damageResult.events[2]).toMatchObject({
      type: 'player.damage_changed',
      previousDamage: 4,
      nextDamage: 5,
      outcome: 'non_lethal',
    })

    const completionResult = expectApplied(
      completeBattle(damageResult.nextState),
    )

    expect(completionResult.nextState.status).toBe('in_progress')
    expect(completionResult.nextState.battle).toBeUndefined()
    expect(completionResult.events.map((event) => event.type)).toEqual([
      'battle.completed',
    ])
    expect(completionResult.events[0]).toMatchObject({
      type: 'battle.completed',
      reason: 'damage_check_completed',
      damage: {
        damageAfter: 5,
        outcome: 'non_lethal',
      },
    })
  })

  it('cleans guardians after hit damage aftermath before returning to turn flow', () => {
    const damageResult = expectApplied(
      applyDamageCheck(
        makeDamageBattleState({
          existingDamageCount: 4,
          guardPieceIds: [
            'piece-p2-guardian-1' as GameState['pieces'][number]['pieceId'],
          ],
        }),
      ),
    )
    const completionResult = expectApplied(
      completeBattle(damageResult.nextState),
    )

    expect(completionResult.nextState.status).toBe('in_progress')
    expect(completionResult.nextState.battle).toBeUndefined()
    expect(completionResult.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'battle.guardians_cleaned_up',
      'battle.completed',
    ])
    expect(completionResult.events[1]).toMatchObject({
      type: 'battle.guardians_cleaned_up',
      guardPieceIds: ['piece-p2-guardian-1'],
      fromZoneId: 'zone-p2-guardian',
      toZoneId: 'zone-p2-drop',
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
        pieceId: 'piece-p2-guardian-1',
      },
    ])
  })

  it('records a lethal 5 to 6 damage branch and completes the match through battle aftermath', () => {
    const damageResult = expectApplied(
      applyDamageCheck(
        makeDamageBattleState({
          existingDamageCount: 5,
          guardPieceIds: [
            'piece-p2-lethal-guardian' as GameState['pieces'][number]['pieceId'],
          ],
        }),
      ),
    )

    expect(damageResult.nextState.status).toBe('in_progress')
    expect(damageResult.nextState.battle).toMatchObject({
      status: 'damage_checked',
      damage: {
        damageBefore: 5,
        damageAfter: 6,
        defeatThreshold: 6,
        outcome: 'lethal',
      },
    })

    const invalidContinuation = expectInvalid(
      applyGameAction(damageResult.nextState, {
        action: {
          actionId: 'action-lethal-continue-invalid' as ActionId,
          type: 'battle.declare_attack',
          actor: {
            kind: 'player',
            playerId: PLAYER_1,
          },
          attackerPieceId:
            'piece-p1-attacker' as GameState['pieces'][number]['pieceId'],
          target: {
            kind: 'player',
            playerId: PLAYER_2,
          },
        },
        expectedRevision: damageResult.nextState.revision,
      }),
    )

    expect(invalidContinuation.message).toMatch(
      /awaiting downstream battle completion/i,
    )

    const completionResult = expectApplied(
      completeBattle(damageResult.nextState),
    )

    expect(completionResult.nextState.status).toBe('completed')
    expect(completionResult.nextState.battle).toBeUndefined()
    expect(completionResult.nextState.pendingRequests).toEqual([])
    expect(
      completionResult.nextState.players.find(
        (player) => player.playerId === PLAYER_2,
      )?.status,
    ).toBe('defeated')
    expect(completionResult.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'battle.guardians_cleaned_up',
      'battle.completed',
      'player.defeated',
      'match.ended',
    ])
    expect(completionResult.events[1]).toMatchObject({
      type: 'battle.guardians_cleaned_up',
      guardPieceIds: ['piece-p2-lethal-guardian'],
    })
    expect(completionResult.events[2]).toMatchObject({
      type: 'battle.completed',
      reason: 'damage_defeat',
      damage: {
        damageAfter: 6,
        outcome: 'lethal',
      },
    })
    expect(completionResult.events[3]).toMatchObject({
      type: 'player.defeated',
      playerId: PLAYER_2,
      reason: 'damage',
      damageCount: 6,
      defeatThreshold: 6,
    })
    expect(completionResult.events[4]).toMatchObject({
      type: 'match.ended',
      reason: 'damage_defeat',
      winnerPlayerId: PLAYER_1,
      loserPlayerId: PLAYER_2,
    })

    const repeatedCompletion = expectInvalid(
      completeBattle(completionResult.nextState),
    )

    expect(repeatedCompletion.message).toMatch(/in progress/i)
  })

  it('keeps missed attacks on the no-damage branch', () => {
    const state = makeDamageBattleState({
      existingDamageCount: 5,
      combatResult: 'miss',
    })
    const damageResult = expectInvalid(applyDamageCheck(state))

    expect(damageResult.message).toMatch(/explicit hit result/i)

    const completionResult = expectApplied(completeBattle(state))
    const damage = resolvePlayerDamageState(
      completionResult.nextState,
      PLAYER_2,
    )

    expect(completionResult.nextState.status).toBe('in_progress')
    expect(completionResult.events.map((event) => event.type)).toEqual([
      'battle.completed',
    ])
    expect(completionResult.events[0]).toMatchObject({
      type: 'battle.completed',
      reason: 'attack_missed',
    })
    expect(damage).toMatchObject({
      ok: true,
      damage: {
        damageCount: 5,
        isDefeatedByDamage: false,
      },
    })
  })
})
