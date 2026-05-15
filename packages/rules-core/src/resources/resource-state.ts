import type {
  GamePieceFlagKey,
  GamePieceStatusState,
  GameState,
} from '../state'
import type { PieceId } from '../contracts'

export const FACE_DOWN_DAMAGE_FLAG = 'damage.face_down' as GamePieceFlagKey

export type DamageCardFace = 'face_up' | 'face_down'

export function resolveDamageCardFace(
  currentState: GameState,
  pieceId: PieceId,
): DamageCardFace {
  return resolveRuntimePieceStatusState(
    currentState.pieceStates,
    pieceId,
  ).flags.includes(FACE_DOWN_DAMAGE_FLAG)
    ? 'face_down'
    : 'face_up'
}

export function isFaceUpDamageCard(
  currentState: GameState,
  pieceId: PieceId,
): boolean {
  return resolveDamageCardFace(currentState, pieceId) === 'face_up'
}

export function isFaceDownDamageCard(
  currentState: GameState,
  pieceId: PieceId,
): boolean {
  return resolveDamageCardFace(currentState, pieceId) === 'face_down'
}

export function setDamageCardFace(
  pieceStates: readonly GamePieceStatusState[],
  pieceId: PieceId,
  face: DamageCardFace,
): readonly GamePieceStatusState[] {
  const currentPieceState = resolveRuntimePieceStatusState(pieceStates, pieceId)
  const nextFlags =
    face === 'face_down'
      ? Array.from(new Set([...currentPieceState.flags, FACE_DOWN_DAMAGE_FLAG]))
      : currentPieceState.flags.filter((flag) => flag !== FACE_DOWN_DAMAGE_FLAG)

  return upsertRuntimePieceStatusState(pieceStates, {
    ...currentPieceState,
    flags: nextFlags,
  })
}

function resolveRuntimePieceStatusState(
  pieceStates: readonly GamePieceStatusState[],
  pieceId: PieceId,
): GamePieceStatusState {
  return (
    pieceStates.find((pieceState) => pieceState.pieceId === pieceId) ?? {
      pieceId,
      orientation: 'stand',
      flags: [],
    }
  )
}

function upsertRuntimePieceStatusState(
  pieceStates: readonly GamePieceStatusState[],
  nextPieceState: GamePieceStatusState,
): readonly GamePieceStatusState[] {
  const normalizedState = normalizeRuntimePieceStatusState(nextPieceState)
  const existingIndex = pieceStates.findIndex(
    (pieceState) => pieceState.pieceId === nextPieceState.pieceId,
  )

  if (normalizedState === undefined) {
    return existingIndex === -1
      ? pieceStates
      : pieceStates.filter(
          (pieceState) => pieceState.pieceId !== nextPieceState.pieceId,
        )
  }

  if (existingIndex === -1) {
    return [...pieceStates, normalizedState]
  }

  return pieceStates.map((pieceState) =>
    pieceState.pieceId === normalizedState.pieceId
      ? normalizedState
      : pieceState,
  )
}

function normalizeRuntimePieceStatusState(
  pieceState: GamePieceStatusState,
): GamePieceStatusState | undefined {
  const flags = Array.from(new Set(pieceState.flags))
  const powerModifier = pieceState.powerModifier ?? 0
  const criticalModifier = pieceState.criticalModifier ?? 0

  if (
    pieceState.orientation === 'stand' &&
    flags.length === 0 &&
    powerModifier === 0 &&
    criticalModifier === 0
  ) {
    return undefined
  }

  return {
    pieceId: pieceState.pieceId,
    orientation: pieceState.orientation,
    flags,
    ...(powerModifier === 0 ? {} : { powerModifier }),
    ...(criticalModifier === 0 ? {} : { criticalModifier }),
  }
}
