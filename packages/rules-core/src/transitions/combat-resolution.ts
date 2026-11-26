import type { ResolveCombatAction } from '../actions'
import { resolveBoostRelation } from '../board'
import { resolveGamePieceCardStats } from '../cards'
import { resolveCombatPieceModifiers } from '../combat'
import type { EventId, TransitionId } from '../contracts'
import type { GameEvent } from '../events'
import type {
  BattleCombatCriticalComponentState,
  BattleCombatPowerComponentState,
  BattleCombatState,
  BattleState,
  GamePieceState,
  GameState,
  GameStateIndex,
} from '../state'
import {
  buildGameStateIndex,
  findOwnedZoneByKind,
  findPieceById,
  findPieceLocation,
  findPlayerById,
  findZoneById,
} from '../state'

import {
  advanceGameStateRevision,
  createInvalidTransitionResult,
  createTransitionResult,
  createTransitionTimingWindowTriplet,
  type InvalidTransitionCode,
  type TransitionResult,
} from './transition'

type CombatMathResolution =
  | {
      readonly ok: true
      readonly combat: BattleCombatState
    }
  | {
      readonly ok: false
      readonly code: InvalidTransitionCode
      readonly message: string
    }

interface PiecePowerResolution {
  readonly total: number
  readonly components: readonly BattleCombatPowerComponentState[]
}

interface PieceCriticalResolution {
  readonly total: number
  readonly components: readonly BattleCombatCriticalComponentState[]
}

type PiecePowerResult =
  | ({
      readonly ok: true
    } & PiecePowerResolution)
  | {
      readonly ok: false
      readonly code: InvalidTransitionCode
      readonly message: string
    }

type PieceCriticalResult =
  | ({
      readonly ok: true
    } & PieceCriticalResolution)
  | {
      readonly ok: false
      readonly code: InvalidTransitionCode
      readonly message: string
    }

export function applyResolveCombatTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: ResolveCombatAction,
): TransitionResult {
  if (currentState.status !== 'in_progress') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires the match to be in progress.`,
    )
  }

  const battle = currentState.battle

  if (battle === undefined || battle.battleId !== action.battleId) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires the referenced battle ${action.battleId} to be active.`,
    )
  }

  if (battle.status !== 'guard_resolved' && battle.status !== 'drive_checked') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} can resolve combat only after guard resolution or drive check.`,
    )
  }

  const stateIndex = buildGameStateIndex(currentState)
  const attackerZone = findZoneById(stateIndex, battle.attackerZoneId)

  if (
    attackerZone?.kind === 'vanguard_circle' &&
    battle.status !== 'drive_checked'
  ) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires vanguard attacks to complete drive check before combat comparison.`,
    )
  }

  const combatResolution = resolveBattleCombatMath(
    currentState,
    battle,
    stateIndex,
  )

  if (!combatResolution.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      combatResolution.code,
      combatResolution.message,
    )
  }

  const combat = combatResolution.combat
  const nextState = advanceGameStateRevision({
    ...currentState,
    battle: {
      ...battle,
      status: 'combat_resolved',
      combat,
    },
  })
  const events: readonly GameEvent[] = [
    {
      eventId: createCombatEventId(transitionId, 0),
      type: 'battle.combat_resolved',
      sequence: 0,
      sourceActionId: action.actionId,
      origin: {
        kind: 'system',
        system: action.actor.system,
      },
      battleId: battle.battleId,
      attackerPieceId: battle.attackerPieceId,
      target: battle.target,
      combat,
    },
    {
      eventId: createCombatEventId(transitionId, 1),
      type:
        combat.result === 'hit' ? 'battle.attack_hit' : 'battle.attack_missed',
      sequence: 1,
      sourceActionId: action.actionId,
      origin: {
        kind: 'system',
        system: action.actor.system,
      },
      battleId: battle.battleId,
      attackerPieceId: battle.attackerPieceId,
      target: battle.target,
      attackPower: combat.attackPower,
      attackCritical: combat.attackCritical,
      totalDefensePower: combat.totalDefensePower,
      damageCheckCount: combat.damageCheckCount,
    },
  ]

  return createTransitionResult(transitionId, nextState, events, {
    timingWindows: createTransitionTimingWindowTriplet('battle.combat', {
      relatedEventSequence: 0,
      battleId: battle.battleId,
    }),
  })
}

export function resolveBattleCombatMath(
  currentState: GameState,
  battle: BattleState,
  stateIndex = buildGameStateIndex(currentState),
): CombatMathResolution {
  const attackerLocation = findPieceLocation(stateIndex, battle.attackerPieceId)

  if (attackerLocation === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Battle ${battle.battleId} references missing attacker piece ${battle.attackerPieceId}.`,
    }
  }

  const attackerPower = resolvePiecePower(
    currentState,
    attackerLocation.piece,
    'attacker_base',
  )

  if (!attackerPower.ok) {
    return attackerPower
  }

  const attackerCritical = resolvePieceCritical(
    currentState,
    attackerLocation.piece,
  )

  if (!attackerCritical.ok) {
    return attackerCritical
  }

  const boosterPower = resolveBoosterPower(currentState, stateIndex, battle)

  if (!boosterPower.ok) {
    return boosterPower
  }

  const defenderPiece = resolveDefenderPiece(currentState, stateIndex, battle)

  if (!defenderPiece.ok) {
    return defenderPiece
  }

  const defenderPower = resolvePiecePower(
    currentState,
    defenderPiece.piece,
    'defender_base',
  )

  if (!defenderPower.ok) {
    return defenderPower
  }

  const shield = resolveGuardShield(currentState, stateIndex, battle)

  if (!shield.ok) {
    return shield
  }

  // A hit rear-guard is retired at battle close; only vanguard hits deal damage.
  const targetIsRearGuard =
    battle.target.kind === 'piece' &&
    findPieceLocation(stateIndex, battle.target.pieceId)?.zone.kind ===
      'rear_guard_circle'
  const attackPower = attackerPower.total + boosterPower.total
  const defensePower = defenderPower.total
  const totalDefensePower = defensePower + shield.total
  const result = attackPower >= totalDefensePower ? 'hit' : 'miss'

  return {
    ok: true,
    combat: {
      attackPower,
      attackerPowerComponents: [
        ...attackerPower.components,
        ...boosterPower.components,
      ],
      attackCritical: attackerCritical.total,
      attackerCriticalComponents: attackerCritical.components,
      defensePower,
      defensePowerComponents: defenderPower.components,
      shieldPower: shield.total,
      shieldComponents: shield.components,
      totalDefensePower,
      damageCheckCount:
        result === 'hit' && !targetIsRearGuard ? attackerCritical.total : 0,
      result,
    },
  }
}

function resolveBoosterPower(
  currentState: GameState,
  stateIndex: GameStateIndex,
  battle: BattleState,
): PiecePowerResult {
  if (battle.boostingPieceId === undefined) {
    return {
      ok: true,
      total: 0,
      components: [],
    }
  }

  const boosterLocation = findPieceLocation(stateIndex, battle.boostingPieceId)

  if (boosterLocation === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Battle ${battle.battleId} references missing boosting piece ${battle.boostingPieceId}.`,
    }
  }

  const boostRelation = resolveBoostRelation(
    currentState,
    battle.attackerPieceId,
    battle.boostingPieceId,
  )

  if (!boostRelation.ok) {
    return {
      ok: false,
      code: 'invalid_action',
      message: boostRelation.issue.message,
    }
  }

  return resolvePiecePower(currentState, boosterLocation.piece, 'booster_base')
}

function resolveGuardShield(
  currentState: GameState,
  stateIndex: GameStateIndex,
  battle: BattleState,
):
  | {
      readonly ok: true
      readonly total: number
      readonly components: readonly BattleCombatPowerComponentState[]
    }
  | {
      readonly ok: false
      readonly code: InvalidTransitionCode
      readonly message: string
    } {
  const components: BattleCombatPowerComponentState[] = []

  for (const pieceId of battle.guardPieceIds) {
    const piece = findPieceById(stateIndex, pieceId)

    if (piece === undefined) {
      return {
        ok: false,
        code: 'invalid_action_reference',
        message: `Battle ${battle.battleId} references missing guard piece ${pieceId}.`,
      }
    }

    const stats = resolveGamePieceCardStats(currentState, piece)

    if (!stats.ok) {
      return {
        ok: false,
        code: 'invalid_action_reference',
        message: stats.issue.message,
      }
    }

    components.push({
      source: 'guard_shield',
      pieceId,
      amount: stats.stats.shield,
    })
  }

  return {
    ok: true,
    total: components.reduce((sum, component) => sum + component.amount, 0),
    components,
  }
}

function resolvePiecePower(
  currentState: GameState,
  piece: GamePieceState,
  baseSource: Extract<
    BattleCombatPowerComponentState['source'],
    'attacker_base' | 'booster_base' | 'defender_base'
  >,
): PiecePowerResult {
  const stats = resolveGamePieceCardStats(currentState, piece)

  if (!stats.ok) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: stats.issue.message,
    }
  }

  const modifierResolution = resolveCombatPieceModifiers(
    currentState,
    piece.pieceId,
  )

  if (!modifierResolution.ok) {
    return modifierResolution
  }

  if (modifierResolution.modifiers.powerModifier < 0) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Combat modifier provider resolved a negative power modifier for piece ${piece.pieceId}, which is outside the current bounded combat model.`,
    }
  }

  const components: BattleCombatPowerComponentState[] = [
    {
      source: baseSource,
      pieceId: piece.pieceId,
      amount: stats.stats.power,
    },
    ...modifierResolution.modifiers.powerComponents,
  ]

  return {
    ok: true,
    total: components.reduce((sum, component) => sum + component.amount, 0),
    components,
  }
}

function resolvePieceCritical(
  currentState: GameState,
  piece: GamePieceState,
): PieceCriticalResult {
  const stats = resolveGamePieceCardStats(currentState, piece)

  if (!stats.ok) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: stats.issue.message,
    }
  }

  const modifierResolution = resolveCombatPieceModifiers(
    currentState,
    piece.pieceId,
  )

  if (!modifierResolution.ok) {
    return modifierResolution
  }

  const components: BattleCombatCriticalComponentState[] = [
    {
      source: 'attacker_base_critical',
      pieceId: piece.pieceId,
      amount: stats.stats.critical,
    },
    ...modifierResolution.modifiers.criticalComponents,
  ]
  const total = components.reduce((sum, component) => sum + component.amount, 0)

  if (total < 1) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Combat modifier provider resolved effective critical ${total} for piece ${piece.pieceId}; the current damage-check model requires critical to be at least 1.`,
    }
  }

  return {
    ok: true,
    total,
    components,
  }
}

function resolveDefenderPiece(
  currentState: GameState,
  stateIndex: GameStateIndex,
  battle: BattleState,
):
  | {
      readonly ok: true
      readonly piece: GamePieceState
    }
  | {
      readonly ok: false
      readonly code: InvalidTransitionCode
      readonly message: string
    } {
  const target = battle.target

  if (target.kind === 'piece') {
    const piece = findPieceById(stateIndex, target.pieceId)

    if (piece === undefined) {
      return {
        ok: false,
        code: 'invalid_action_reference',
        message: `Battle ${battle.battleId} target piece ${target.pieceId} is missing.`,
      }
    }

    return {
      ok: true,
      piece,
    }
  }

  const defendingPlayer = findPlayerById(stateIndex, battle.defendingPlayerId)
  const vanguardZone =
    defendingPlayer === undefined
      ? undefined
      : findOwnedZoneByKind(stateIndex, defendingPlayer, 'vanguard_circle')
  const vanguardPieceId = vanguardZone?.occupants[0]?.pieceId
  const vanguardPiece =
    vanguardPieceId === undefined
      ? undefined
      : findPieceById(stateIndex, vanguardPieceId)

  if (vanguardPiece === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Battle ${battle.battleId} requires defending player ${battle.defendingPlayerId} to have a vanguard for combat comparison.`,
    }
  }

  return {
    ok: true,
    piece: vanguardPiece,
  }
}

function createCombatEventId(
  transitionId: TransitionId,
  sequence: number,
): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}
