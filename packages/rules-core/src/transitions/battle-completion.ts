import type { ResolveMandatoryFlowAction } from '../actions'
import type { EventId, TransitionId } from '../contracts'
import type { GameEvent } from '../events'
import type { GameState, PlayerState, ZoneState } from '../state'

import {
  advanceGameStateRevision,
  createInvalidTransitionResult,
  createTransitionResult,
  createTransitionTimingWindowTriplet,
  type TransitionResult,
} from './transition'
import {
  findZoneById,
  movePiecesByIdBetweenZones,
  type PieceZoneMovement,
} from './ordered-zone-operations'
import { createPieceMovedEvents } from './zone-transfer'

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

  if (battle.status !== 'damage_checked') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} can complete battle ${battle.battleId} only after damage check resolution.`,
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

  const stateAfterCleanup: GameState = {
    ...currentState,
    zones: cleanupResult.zones,
    pieceStates: cleanupResult.pieceStates,
  }
  const { battle: _completedBattle, ...stateWithoutBattle } = stateAfterCleanup
  const nextState = advanceGameStateRevision(stateWithoutBattle)
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
  const battleCompletedSequence = cleanupMovedEvents.length
  const events: readonly GameEvent[] = [
    ...cleanupMovedEvents,
    {
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
      reason: 'damage_check_completed',
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
    },
  ]

  return createTransitionResult(transitionId, nextState, events, {
    timingWindows: createTransitionTimingWindowTriplet('battle.completion', {
      relatedEventSequence: battleCompletedSequence,
      battleId: battle.battleId,
    }),
  })
}

function resolveBattleCleanup(
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

  const defendingPlayer = findPlayerById(currentState, battle.defendingPlayerId)
  const guardZone = findZoneById(currentState, battle.guardZoneId)
  const dropZone =
    defendingPlayer === undefined
      ? undefined
      : findOwnedZoneByKind(currentState, defendingPlayer, 'drop')

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

function findPlayerById(
  currentState: GameState,
  playerId: PlayerState['playerId'],
): PlayerState | undefined {
  return currentState.players.find((player) => player.playerId === playerId)
}

function findOwnedZoneByKind(
  currentState: GameState,
  player: PlayerState,
  kind: ZoneState['kind'],
): ZoneState | undefined {
  return currentState.zones.find(
    (zone) => zone.ownerPlayerId === player.playerId && zone.kind === kind,
  )
}

function createBattleCompletionEventId(
  transitionId: TransitionId,
  sequence: number,
): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}
