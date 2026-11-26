import type { PieceId } from '../contracts'
import type { GamePieceFlagKey, GameState } from '../state'

/** Set by effects that give the vanguard "drive -2" until end of turn. */
export const DRIVE_MINUS_TWO_FLAG =
  'standard-slice.drive-minus-two.until-end-of-turn' as GamePieceFlagKey

/**
 * Drive changes that come from state rather than keywords. Twin Drive!! is
 * a printed ability (keyword `twin-drive`), not a grade rule, so it stays on
 * the keyword path; here only "drive -2" flags lower the count, never below
 * zero.
 */
export function applyRuleDriveModifiers(input: {
  readonly state: GameState
  readonly attackerPieceId: PieceId
  readonly count: number
}): number {
  const flags =
    input.state.pieceStates.find(
      (pieceState) => pieceState.pieceId === input.attackerPieceId,
    )?.flags ?? []

  return Math.max(
    0,
    input.count - (flags.includes(DRIVE_MINUS_TWO_FLAG) ? 2 : 0),
  )
}
