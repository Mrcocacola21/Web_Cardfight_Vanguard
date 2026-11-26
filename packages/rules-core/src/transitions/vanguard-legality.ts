import type { GamePieceState, GameState, PlayerState } from '../state'
import { isUnitCardStats, resolveGamePieceCardStats } from '../cards'
import {
  buildGameStateIndex,
  findCurrentVanguardPiece,
  findPieceById,
} from '../state'

import type { InvalidTransitionCode } from './transition'

export const VANGUARD_LEGALITY_CODES = {
  rideGradeRestricted: 'ride_grade_restricted',
  callGradeRestricted: 'call_grade_restricted',
  attackFirstTurnRestricted: 'attack_first_turn_restricted',
} as const

type VanguardLegalityResult =
  | {
      readonly ok: true
    }
  | {
      readonly ok: false
      readonly code: InvalidTransitionCode
      readonly message: string
    }

export function resolveNormalRideGradeLegality(input: {
  readonly currentState: GameState
  readonly actionType: string
  readonly actingPlayer: PlayerState
  readonly ridingPiece: GamePieceState
  readonly currentVanguardPieceId?: GamePieceState['pieceId']
}): VanguardLegalityResult {
  const ridingStats = resolveUnitStatsForNormalBoardAction(
    input.currentState,
    input.ridingPiece,
    input.actionType,
    'ride',
  )

  if (!ridingStats.ok) {
    return ridingStats
  }

  if (input.currentVanguardPieceId === undefined) {
    if (ridingStats.grade !== 0) {
      return {
        ok: false,
        code: VANGUARD_LEGALITY_CODES.rideGradeRestricted,
        message: `Normal ride grade restriction: first vanguard for player ${input.actingPlayer.playerId} must be grade 0, not grade ${ridingStats.grade}.`,
      }
    }

    return { ok: true }
  }

  const stateIndex = buildGameStateIndex(input.currentState)
  const currentVanguardPiece = findPieceById(
    stateIndex,
    input.currentVanguardPieceId,
  )

  if (currentVanguardPiece === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Normal ride grade legality requires current vanguard piece ${input.currentVanguardPieceId}.`,
    }
  }

  const currentVanguardStats = resolveUnitStatsForNormalBoardAction(
    input.currentState,
    currentVanguardPiece,
    input.actionType,
    'current vanguard',
  )

  if (!currentVanguardStats.ok) {
    return currentVanguardStats
  }

  const currentGrade = currentVanguardStats.grade
  const expectedGrades = [currentGrade, currentGrade + 1]

  if (!expectedGrades.includes(ridingStats.grade)) {
    return {
      ok: false,
      code: VANGUARD_LEGALITY_CODES.rideGradeRestricted,
      message: `Normal ride grade restriction: cannot ride grade ${ridingStats.grade} over grade ${currentGrade}; expected grade ${currentGrade} or ${currentGrade + 1}.`,
    }
  }

  return { ok: true }
}

export function resolveNormalCallGradeLegality(input: {
  readonly currentState: GameState
  readonly actionType: string
  readonly actingPlayer: PlayerState
  readonly callingPiece: GamePieceState
}): VanguardLegalityResult {
  const callingStats = resolveUnitStatsForNormalBoardAction(
    input.currentState,
    input.callingPiece,
    input.actionType,
    'call',
  )

  if (!callingStats.ok) {
    return callingStats
  }

  const stateIndex = buildGameStateIndex(input.currentState)
  const currentVanguardPiece = findCurrentVanguardPiece(
    stateIndex,
    input.actingPlayer,
  )

  if (currentVanguardPiece === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Normal call grade legality requires player ${input.actingPlayer.playerId} to have a current vanguard.`,
    }
  }

  const currentVanguardStats = resolveUnitStatsForNormalBoardAction(
    input.currentState,
    currentVanguardPiece,
    input.actionType,
    'current vanguard',
  )

  if (!currentVanguardStats.ok) {
    return currentVanguardStats
  }

  if (callingStats.grade > currentVanguardStats.grade) {
    return {
      ok: false,
      code: VANGUARD_LEGALITY_CODES.callGradeRestricted,
      message: `Normal call grade restriction: cannot call grade ${callingStats.grade} while current vanguard grade is ${currentVanguardStats.grade}.`,
    }
  }

  return { ok: true }
}

export function resolveFirstTurnAttackLegality(input: {
  readonly currentState: GameState
  readonly actionType: string
}): VanguardLegalityResult {
  // match.start opens turn 0, and the first player plays that turn in full
  // (stand, draw, ride, main, battle). Turn 0 is therefore the first player's
  // first turn; the second player's first turn (turn 1) may attack.
  if (input.currentState.turn.turnNumber <= 0) {
    return {
      ok: false,
      code: VANGUARD_LEGALITY_CODES.attackFirstTurnRestricted,
      message:
        "Attack is not legal on the first player's first turn under the common Vanguard baseline.",
    }
  }

  return { ok: true }
}

function resolveUnitStatsForNormalBoardAction(
  currentState: GameState,
  piece: GamePieceState,
  actionType: string,
  role: 'call' | 'current vanguard' | 'ride',
):
  | {
      readonly ok: true
      readonly grade: number
    }
  | {
      readonly ok: false
      readonly code: InvalidTransitionCode
      readonly message: string
    } {
  const statsResolution = resolveGamePieceCardStats(currentState, piece)

  if (!statsResolution.ok) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Action ${actionType} cannot resolve normal ${role} grade for piece ${piece.pieceId}: ${statsResolution.issue.message}`,
    }
  }

  if (!isUnitCardStats(statsResolution.stats)) {
    return {
      ok: false,
      code:
        role === 'call'
          ? VANGUARD_LEGALITY_CODES.callGradeRestricted
          : VANGUARD_LEGALITY_CODES.rideGradeRestricted,
      message: `Action ${actionType} requires normal ${role} piece ${piece.pieceId} to be a unit card.`,
    }
  }

  return {
    ok: true,
    grade: statsResolution.stats.grade,
  }
}
