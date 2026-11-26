import type {
  DamageCheckAction,
  DriveCheckAction,
  ResolveCombatAction,
  ResolveMandatoryFlowAction,
} from '../actions'
import type { ActionId } from '../contracts'
import type { GameState } from '../state'
import {
  buildGameStateIndex,
  findOwnedZoneByKind,
  findPieceLocation,
} from '../state'

export type MandatoryBattleAction =
  | DriveCheckAction
  | ResolveCombatAction
  | DamageCheckAction
  | ResolveMandatoryFlowAction

const DEFAULT_DRIVE_COUNT = 1

/**
 * The next step of a battle that no player decides: drive check, combat
 * comparison, damage check and battle close. Returns undefined when the game
 * is waiting for a player (boost, guard, any pending choice) or no battle runs.
 *
 * A match server runs these after every accepted command so battles finish
 * without a client ever sending system actions.
 */
export function resolveNextMandatoryBattleAction(
  state: GameState,
): MandatoryBattleAction | undefined {
  const battle = state.battle

  if (
    battle === undefined ||
    state.status !== 'in_progress' ||
    state.pendingRequests.length > 0
  ) {
    return undefined
  }

  const actor = { kind: 'system', system: 'automatic-flow' } as const
  const actionId = (step: string) =>
    `auto:${step}:${battle.battleId}:r${state.revision}` as ActionId
  const index = buildGameStateIndex(state)

  switch (battle.status) {
    case 'guard_resolved': {
      const attackerZone = findPieceLocation(
        index,
        battle.attackerPieceId,
      )?.zone
      const deck = findOwnedZoneByKind(index, battle.attackingPlayerId, 'deck')
      const hand = findOwnedZoneByKind(index, battle.attackingPlayerId, 'hand')

      if (
        attackerZone?.kind === 'vanguard_circle' &&
        deck !== undefined &&
        hand !== undefined
      ) {
        return {
          actionId: actionId('drive'),
          type: 'system.drive_check',
          actor,
          battleId: battle.battleId,
          playerId: battle.attackingPlayerId,
          fromZoneId: deck.zoneId,
          toZoneId: hand.zoneId,
          count: DEFAULT_DRIVE_COUNT,
        }
      }

      return {
        actionId: actionId('combat'),
        type: 'system.resolve_combat',
        actor,
        battleId: battle.battleId,
      }
    }
    case 'drive_checked':
      return {
        actionId: actionId('combat'),
        type: 'system.resolve_combat',
        actor,
        battleId: battle.battleId,
      }
    case 'combat_resolved': {
      const count = battle.combat?.damageCheckCount ?? 0
      const deck = findOwnedZoneByKind(index, battle.defendingPlayerId, 'deck')
      const damage = findOwnedZoneByKind(
        index,
        battle.defendingPlayerId,
        'damage',
      )

      if (
        battle.combat?.result === 'hit' &&
        count > 0 &&
        deck !== undefined &&
        damage !== undefined
      ) {
        return {
          actionId: actionId('damage'),
          type: 'system.damage_check',
          actor,
          battleId: battle.battleId,
          playerId: battle.defendingPlayerId,
          fromZoneId: deck.zoneId,
          toZoneId: damage.zoneId,
          count,
        }
      }

      return {
        actionId: actionId('close'),
        type: 'system.resolve_mandatory_flow',
        actor,
        scope: 'battle',
      }
    }
    case 'damage_checked':
      return {
        actionId: actionId('close'),
        type: 'system.resolve_mandatory_flow',
        actor,
        scope: 'battle',
      }
    default:
      return undefined
  }
}
