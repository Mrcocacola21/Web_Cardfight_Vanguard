import type { ResolveMandatoryFlowAction } from '../actions'
import type { EventId, TransitionId } from '../contracts'
import type { GameEvent } from '../events'
import type { BattleDamageState, GameState, ZoneState } from '../state'
import {
  buildGameStateIndex,
  findOwnedZoneByKind,
  findPieceLocation,
  findPlayerById,
  findZoneById,
} from '../state'

import {
  advanceGameStateRevision,
  createInvalidTransitionResult,
  createTransitionResult,
  createTransitionTimingWindowTriplet,
  type TransitionResult,
} from './transition'
import {
  movePiecesByIdBetweenZones,
  type PieceZoneMovement,
} from './ordered-zone-operations'
import {
  createPieceMovedEvents,
  resolveZoneTransferSequence,
} from './zone-transfer'

export function applyResolveMandatoryFlowTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: ResolveMandatoryFlowAction,
): TransitionResult {
  if (currentState.status !== 'in_progress') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires the match to be in progress.`,
    )
  }

  if (action.scope !== 'battle') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'unsupported_action',
      `Action ${action.type} currently supports only battle-scoped mandatory flow.`,
    )
  }

  const battle = currentState.battle

  if (battle === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires an active battle to complete.`,
    )
  }

  if (
    battle.status !== 'damage_checked' &&
    battle.status !== 'combat_resolved'
  ) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} can complete battle ${battle.battleId} only after damage check resolution or a resolved missed attack.`,
    )
  }

  if (
    battle.status === 'combat_resolved' &&
    battle.combat?.result !== 'miss' &&
    battle.combat?.damageCheckCount !== 0
  ) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} can skip damage check only after battle ${battle.battleId} has a miss or a rear-guard hit.`,
    )
  }

  if (battle.status === 'damage_checked' && battle.damage === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires battle ${battle.battleId} to keep a damage outcome after damage check.`,
    )
  }

  const cleanupResult = resolveBattleCleanup(currentState, battle)

  if (!cleanupResult.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      cleanupResult.code,
      cleanupResult.message,
    )
  }

  const stateAfterGuardCleanup: GameState = {
    ...currentState,
    zones: cleanupResult.zones,
    pieceStates: cleanupResult.pieceStates,
  }
  const retireResult = retireHitRearGuard(stateAfterGuardCleanup, battle)

  if (!retireResult.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      retireResult.code,
      retireResult.message,
    )
  }

  const stateAfterCleanup = retireResult.state
  const { battle: _completedBattle, ...stateWithoutBattle } = stateAfterCleanup
  const lethalDamage = resolveLethalDamage(battle)
  const nextState = advanceGameStateRevision(
    lethalDamage === undefined
      ? stateWithoutBattle
      : {
          ...stateWithoutBattle,
          status: 'completed',
          players: stateWithoutBattle.players.map((player) =>
            player.playerId === lethalDamage.playerId
              ? {
                  ...player,
                  status: 'defeated',
                }
              : player,
          ),
          pendingRequests: [],
        },
  )
  const cleanupMovedEvents = createPieceMovedEvents(
    transitionId,
    cleanupResult.movedPieces,
    {
      kind: 'system',
      system: action.actor.system,
    },
    {
      sourceActionId: action.actionId,
    },
  )
  const guardiansCleanedUpEvent =
    cleanupResult.cleanupFromZoneId === undefined ||
    cleanupResult.cleanupToZoneId === undefined ||
    cleanupResult.movedPieces.length === 0
      ? undefined
      : createGuardiansCleanedUpEvent(
          transitionId,
          action.actionId,
          action.actor.system,
          battle,
          cleanupResult,
          cleanupResult.cleanupFromZoneId,
          cleanupResult.cleanupToZoneId,
          cleanupMovedEvents.length,
        )
  const retiredMovedEvents = createPieceMovedEvents(
    transitionId,
    retireResult.movedPieces,
    {
      kind: 'system',
      system: action.actor.system,
    },
    {
      sourceActionId: action.actionId,
      startingSequence:
        cleanupMovedEvents.length +
        (guardiansCleanedUpEvent === undefined ? 0 : 1),
    },
  )
  const battleCompletedSequence =
    cleanupMovedEvents.length +
    (guardiansCleanedUpEvent === undefined ? 0 : 1) +
    retiredMovedEvents.length
  const battleCompletedEvent: GameEvent = {
    eventId: createBattleCompletionEventId(
      transitionId,
      battleCompletedSequence,
    ),
    type: 'battle.completed',
    sequence: battleCompletedSequence,
    sourceActionId: action.actionId,
    origin: {
      kind: 'system',
      system: action.actor.system,
    },
    battleId: battle.battleId,
    reason: resolveBattleCompletionReason(battle),
    ...(retireResult.movedPieces.length === 0
      ? {}
      : {
          retiredPieceIds: retireResult.movedPieces.map(
            (movement) => movement.pieceId,
          ),
        }),
    attackingPlayerId: battle.attackingPlayerId,
    defendingPlayerId: battle.defendingPlayerId,
    attackerPieceId: battle.attackerPieceId,
    attackerZoneId: battle.attackerZoneId,
    target: battle.target,
    ...(battle.boostingPieceId === undefined
      ? {}
      : {
          boostingPieceId: battle.boostingPieceId,
        }),
    ...(battle.boostingZoneId === undefined
      ? {}
      : {
          boostingZoneId: battle.boostingZoneId,
        }),
    guardPieceIds: battle.guardPieceIds,
    ...(battle.guardZoneId === undefined
      ? {}
      : {
          guardZoneId: battle.guardZoneId,
        }),
    ...(battle.lastCheck === undefined
      ? {}
      : {
          lastCheck: battle.lastCheck,
        }),
    ...(battle.combat === undefined
      ? {}
      : {
          combat: battle.combat,
        }),
    ...(battle.damage === undefined
      ? {}
      : {
          damage: battle.damage,
        }),
    cleanupMovedPieceIds: cleanupResult.movedPieces.map(
      (movement) => movement.pieceId,
    ),
    ...(cleanupResult.cleanupFromZoneId === undefined
      ? {}
      : {
          cleanupFromZoneId: cleanupResult.cleanupFromZoneId,
        }),
    ...(cleanupResult.cleanupToZoneId === undefined
      ? {}
      : {
          cleanupToZoneId: cleanupResult.cleanupToZoneId,
        }),
  }
  const defeatEvents = createDefeatEvents(
    transitionId,
    action.actionId,
    action.actor.system,
    battle,
    lethalDamage,
    battleCompletedSequence + 1,
  )
  const events: readonly GameEvent[] = [
    ...cleanupMovedEvents,
    ...(guardiansCleanedUpEvent === undefined ? [] : [guardiansCleanedUpEvent]),
    ...retiredMovedEvents,
    battleCompletedEvent,
    ...defeatEvents,
  ]

  return createTransitionResult(transitionId, nextState, events, {
    timingWindows: createTransitionTimingWindowTriplet('battle.completion', {
      relatedEventSequence: battleCompletedSequence,
      battleId: battle.battleId,
    }),
  })
}

function createGuardiansCleanedUpEvent(
  transitionId: TransitionId,
  sourceActionId: ResolveMandatoryFlowAction['actionId'],
  system: ResolveMandatoryFlowAction['actor']['system'],
  battle: NonNullable<GameState['battle']>,
  cleanupResult: Extract<ReturnType<typeof resolveBattleCleanup>, { ok: true }>,
  fromZoneId: ZoneState['zoneId'],
  toZoneId: ZoneState['zoneId'],
  sequence: number,
): Extract<GameEvent, { readonly type: 'battle.guardians_cleaned_up' }> {
  return {
    eventId: createBattleCompletionEventId(transitionId, sequence),
    type: 'battle.guardians_cleaned_up',
    sequence,
    sourceActionId,
    origin: {
      kind: 'system',
      system,
    },
    battleId: battle.battleId,
    defendingPlayerId: battle.defendingPlayerId,
    guardPieceIds: cleanupResult.movedPieces.map(
      (movement) => movement.pieceId,
    ),
    fromZoneId,
    toZoneId,
  }
}

function resolveLethalDamage(
  battle: NonNullable<GameState['battle']>,
): BattleDamageState | undefined {
  return battle.status === 'damage_checked' &&
    battle.damage?.outcome === 'lethal'
    ? battle.damage
    : undefined
}

function resolveBattleCompletionReason(
  battle: NonNullable<GameState['battle']>,
): Extract<GameEvent, { readonly type: 'battle.completed' }>['reason'] {
  if (battle.status === 'combat_resolved') {
    return battle.combat?.result === 'hit'
      ? 'rear_guard_retired'
      : 'attack_missed'
  }

  return battle.damage?.outcome === 'lethal'
    ? 'damage_defeat'
    : 'damage_check_completed'
}

function createDefeatEvents(
  transitionId: TransitionId,
  sourceActionId: ResolveMandatoryFlowAction['actionId'],
  system: ResolveMandatoryFlowAction['actor']['system'],
  battle: NonNullable<GameState['battle']>,
  lethalDamage: BattleDamageState | undefined,
  startingSequence: number,
): readonly GameEvent[] {
  if (lethalDamage === undefined) {
    return []
  }

  return [
    {
      eventId: createBattleCompletionEventId(transitionId, startingSequence),
      type: 'player.defeated',
      sequence: startingSequence,
      sourceActionId,
      origin: {
        kind: 'system',
        system,
      },
      playerId: lethalDamage.playerId,
      reason: 'damage',
      damageCount: lethalDamage.damageAfter,
      defeatThreshold: lethalDamage.defeatThreshold,
    },
    {
      eventId: createBattleCompletionEventId(
        transitionId,
        startingSequence + 1,
      ),
      type: 'match.ended',
      sequence: startingSequence + 1,
      sourceActionId,
      origin: {
        kind: 'system',
        system,
      },
      reason: 'damage_defeat',
      loserPlayerId: lethalDamage.playerId,
      winnerPlayerId: battle.attackingPlayerId,
    },
  ]
}

/**
 * A rear-guard hit by the attack is retired to its owner's drop when the
 * battle closes. Goes through zone transfers, so REPLACE rules ("if this
 * unit would be retired…") apply. Does nothing if the target already left.
 */
function retireHitRearGuard(
  state: GameState,
  battle: NonNullable<GameState['battle']>,
):
  | {
      readonly ok: true
      readonly state: GameState
      readonly movedPieces: readonly PieceZoneMovement[]
    }
  | {
      readonly ok: false
      readonly code: 'invalid_action' | 'invalid_action_reference'
      readonly message: string
    } {
  if (
    battle.status !== 'combat_resolved' ||
    battle.combat?.result !== 'hit' ||
    battle.target.kind !== 'piece'
  ) {
    return { ok: true, state, movedPieces: [] }
  }

  const stateIndex = buildGameStateIndex(state)
  const location = findPieceLocation(stateIndex, battle.target.pieceId)
  const ownerId = location?.piece.ownerPlayerId
  const drop =
    ownerId === undefined
      ? undefined
      : findOwnedZoneByKind(stateIndex, ownerId, 'drop')

  if (location?.zone.kind !== 'rear_guard_circle' || drop === undefined) {
    return { ok: true, state, movedPieces: [] }
  }

  const transfer = resolveZoneTransferSequence(state, [
    {
      pieceId: battle.target.pieceId,
      from: { zoneId: location.zone.zoneId },
      to: { zoneId: drop.zoneId },
      reason: 'retire',
    },
  ])

  if (!transfer.ok) {
    return transfer
  }

  return {
    ok: true,
    state: {
      ...state,
      zones: transfer.zones,
      pieceStates: transfer.pieceStates,
    },
    movedPieces: transfer.transfers,
  }
}

export function resolveBattleCleanup(
  currentState: GameState,
  battle: NonNullable<GameState['battle']>,
):
  | {
      readonly ok: true
      readonly zones: GameState['zones']
      readonly pieceStates: GameState['pieceStates']
      readonly movedPieces: readonly PieceZoneMovement[]
      readonly cleanupFromZoneId?: ZoneState['zoneId']
      readonly cleanupToZoneId?: ZoneState['zoneId']
    }
  | {
      readonly ok: false
      readonly code: 'invalid_action' | 'invalid_action_reference'
      readonly message: string
    } {
  if (battle.guardPieceIds.length === 0) {
    return {
      ok: true,
      zones: currentState.zones,
      pieceStates: currentState.pieceStates,
      movedPieces: [],
    }
  }

  if (battle.guardZoneId === undefined) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Battle ${battle.battleId} cannot clean guard pieces without a guard zone reference.`,
    }
  }

  const stateIndex = buildGameStateIndex(currentState)
  const defendingPlayer = findPlayerById(stateIndex, battle.defendingPlayerId)
  const guardZone = findZoneById(stateIndex, battle.guardZoneId)
  const dropZone =
    defendingPlayer === undefined
      ? undefined
      : findOwnedZoneByKind(stateIndex, defendingPlayer, 'drop')

  if (defendingPlayer === undefined || guardZone === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Battle ${battle.battleId} references missing cleanup player or guard zone state.`,
    }
  }

  if (dropZone === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Battle ${battle.battleId} requires defending player ${defendingPlayer.playerId} to own a drop zone before guard cleanup.`,
    }
  }

  const guardMoveResult = movePiecesByIdBetweenZones(
    currentState,
    battle.guardPieceIds,
    guardZone.zoneId,
    dropZone.zoneId,
    'battle_cleanup',
  )

  if (!guardMoveResult.ok) {
    return guardMoveResult
  }

  return {
    ok: true,
    zones: guardMoveResult.zones,
    pieceStates: guardMoveResult.pieceStates,
    movedPieces: guardMoveResult.movedPieces,
    cleanupFromZoneId: guardZone.zoneId,
    cleanupToZoneId: dropZone.zoneId,
  }
}

function createBattleCompletionEventId(
  transitionId: TransitionId,
  sequence: number,
): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}
