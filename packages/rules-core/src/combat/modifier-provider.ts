import type {
  BattleCombatCriticalComponentState,
  BattleCombatPowerComponentState,
  GamePieceStatusState,
  GameState,
} from '../state'

export interface CombatPieceModifierSnapshot {
  readonly pieceId: GamePieceStatusState['pieceId']
  readonly powerModifier: number
  readonly powerComponents: readonly BattleCombatPowerComponentState[]
  readonly criticalModifier: number
  readonly criticalComponents: readonly BattleCombatCriticalComponentState[]
}

export type CombatPieceModifierResolution =
  | {
      readonly ok: true
      readonly modifiers: CombatPieceModifierSnapshot
    }
  | {
      readonly ok: false
      readonly code: 'invalid_action_reference'
      readonly message: string
    }

export function resolveCombatPieceModifiers(
  state: GameState,
  pieceId: GamePieceStatusState['pieceId'],
): CombatPieceModifierResolution {
  if (!state.pieces.some((piece) => piece.pieceId === pieceId)) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Combat modifier provider cannot resolve missing piece ${pieceId}.`,
    }
  }

  const pieceState = state.pieceStates.find(
    (candidate) => candidate.pieceId === pieceId,
  )
  const powerModifier = pieceState?.powerModifier ?? 0
  const criticalModifier = pieceState?.criticalModifier ?? 0

  return {
    ok: true,
    modifiers: {
      pieceId,
      powerModifier,
      powerComponents:
        powerModifier === 0
          ? []
          : [
              {
                source: 'piece_power_modifier',
                pieceId,
                amount: powerModifier,
              },
            ],
      criticalModifier,
      criticalComponents:
        criticalModifier === 0
          ? []
          : [
              {
                source: 'piece_critical_modifier',
                pieceId,
                amount: criticalModifier,
              },
            ],
    },
  }
}
