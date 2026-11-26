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
  const temporaryPower = pieceState?.powerModifier ?? 0
  const temporaryCritical = pieceState?.criticalModifier ?? 0
  const continuousPower = pieceState?.continuousPowerModifier ?? 0
  const continuousCritical = pieceState?.continuousCriticalModifier ?? 0
  const powerModifier = temporaryPower + continuousPower
  const criticalModifier = temporaryCritical + continuousCritical

  return {
    ok: true,
    modifiers: {
      pieceId,
      powerModifier,
      powerComponents: [
        ...(temporaryPower === 0
          ? []
          : [
              {
                source: 'piece_power_modifier' as const,
                pieceId,
                amount: temporaryPower,
              },
            ]),
        ...(continuousPower === 0
          ? []
          : [
              {
                source: 'continuous_power_modifier',
                pieceId,
                amount: continuousPower,
              },
            ]),
      ],
      criticalModifier,
      criticalComponents: [
        ...(temporaryCritical === 0
          ? []
          : [
              {
                source: 'piece_critical_modifier' as const,
                pieceId,
                amount: temporaryCritical,
              },
            ]),
        ...(continuousCritical === 0
          ? []
          : [
              {
                source: 'continuous_critical_modifier',
                pieceId,
                amount: continuousCritical,
              },
            ]),
      ],
    },
  }
}
