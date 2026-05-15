import type { PlayerId, ZoneId } from '../contracts'
import type { GameState, PlayerState, ZoneState } from '../state'
import {
  buildGameStateIndex,
  findPlayerById,
  listOwnedZonesByKind,
} from '../state'

export const VANGUARD_DAMAGE_DEFEAT_THRESHOLD = 6

export type DamageCountResolutionIssueCode =
  | 'missing_player'
  | 'missing_damage_zone'
  | 'ambiguous_damage_zone'

export interface PlayerDamageState {
  readonly playerId: PlayerId
  readonly damageZoneId: ZoneId
  readonly damageCount: number
  readonly defeatThreshold: number
  readonly isDefeatedByDamage: boolean
}

export type DamageCountResolutionResult =
  | {
      readonly ok: true
      readonly damage: PlayerDamageState
    }
  | {
      readonly ok: false
      readonly issue: {
        readonly code: DamageCountResolutionIssueCode
        readonly message: string
      }
    }

export function resolvePlayerDamageState(
  state: GameState,
  playerId: PlayerState['playerId'],
): DamageCountResolutionResult {
  const stateIndex = buildGameStateIndex(state)
  const player = findPlayerById(stateIndex, playerId)

  if (player === undefined) {
    return {
      ok: false,
      issue: {
        code: 'missing_player',
        message: `Game state ${state.gameId} does not contain player ${playerId}.`,
      },
    }
  }

  const damageZones = listOwnedZonesByKind(stateIndex, player, 'damage')

  if (damageZones.length === 0) {
    return {
      ok: false,
      issue: {
        code: 'missing_damage_zone',
        message: `Player ${player.playerId} does not own a damage zone.`,
      },
    }
  }

  if (damageZones.length > 1) {
    return {
      ok: false,
      issue: {
        code: 'ambiguous_damage_zone',
        message: `Player ${player.playerId} owns multiple damage zones.`,
      },
    }
  }

  const damageZone = damageZones[0] as ZoneState
  const damageCount = damageZone.occupants.length

  return {
    ok: true,
    damage: {
      playerId: player.playerId,
      damageZoneId: damageZone.zoneId,
      damageCount,
      defeatThreshold: VANGUARD_DAMAGE_DEFEAT_THRESHOLD,
      isDefeatedByDamage: damageCount >= VANGUARD_DAMAGE_DEFEAT_THRESHOLD,
    },
  }
}
