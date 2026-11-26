import type { ParticipantLegalAction } from '@web-vg/match-session'

import type { MatchBoardProjection } from './zone-projection'

/**
 * Click / drag-and-drop play on the playmat, derived only from the server's
 * engine-checked `legalActions`: the board never decides legality itself.
 *
 * - call: card -> open rear-guard circle
 * - ride: card -> your vanguard
 * - attack: your unit -> opponent unit
 * - boost: rear-guard -> the attacking unit
 * Actions without a board target (play, ACT, guard step, end phase) are
 * listed for the selected card instead.
 */
export type BoardActionTarget =
  | { readonly kind: 'piece'; readonly pieceId: string }
  | { readonly kind: 'slot'; readonly slotId: string }

export interface BoardActionModel {
  /** Cards that start at least one legal action (clickable / draggable). */
  readonly sourcePieceIds: ReadonlySet<string>
  readonly selectedSourcePieceId?: string
  /** Highlighted targets for the selected card. */
  readonly targetPieceIds: ReadonlySet<string>
  readonly targetSlotIds: ReadonlySet<string>
  /** Every legal action of the selected card, for the action bar. */
  readonly selectedActions: readonly ParticipantLegalAction[]
}

export function buildBoardActionModel(input: {
  readonly legalActions: readonly ParticipantLegalAction[]
  readonly board: MatchBoardProjection
  readonly attackerPieceId?: string
  readonly selectedSourcePieceId?: string | null
}): BoardActionModel {
  const sourcePieceIds = new Set(
    input.legalActions.flatMap((action) =>
      action.pieceId === undefined ? [] : [action.pieceId as string],
    ),
  )
  const selected =
    input.selectedSourcePieceId !== undefined &&
    input.selectedSourcePieceId !== null &&
    sourcePieceIds.has(input.selectedSourcePieceId)
      ? input.selectedSourcePieceId
      : undefined
  const selectedActions =
    selected === undefined
      ? []
      : input.legalActions.filter((action) => action.pieceId === selected)
  const targetPieceIds = new Set<string>()
  const targetSlotIds = new Set<string>()

  for (const action of selectedActions) {
    const target = targetOf(action, input)

    if (target?.kind === 'piece') {
      targetPieceIds.add(target.pieceId)
    } else if (target?.kind === 'slot') {
      targetSlotIds.add(target.slotId)
    }
  }

  return {
    sourcePieceIds,
    ...(selected === undefined ? {} : { selectedSourcePieceId: selected }),
    targetPieceIds,
    targetSlotIds,
    selectedActions,
  }
}

/** The legal action meant by "this card onto that target", if any. */
export function resolveBoardAction(input: {
  readonly legalActions: readonly ParticipantLegalAction[]
  readonly board: MatchBoardProjection
  readonly attackerPieceId?: string
  readonly sourcePieceId: string
  readonly target: BoardActionTarget
}): ParticipantLegalAction | undefined {
  return input.legalActions.find((action) => {
    if (action.pieceId !== input.sourcePieceId) {
      return false
    }

    const target = targetOf(action, input)

    return (
      target !== undefined &&
      target.kind === input.target.kind &&
      (target.kind === 'piece'
        ? target.pieceId ===
          (input.target as { readonly pieceId: string }).pieceId
        : target.slotId ===
          (input.target as { readonly slotId: string }).slotId)
    )
  })
}

function targetOf(
  action: ParticipantLegalAction,
  context: {
    readonly board: MatchBoardProjection
    readonly attackerPieceId?: string
  },
): BoardActionTarget | undefined {
  switch (action.kind) {
    case 'call':
      return action.slotId === undefined
        ? undefined
        : { kind: 'slot', slotId: action.slotId }
    case 'attack':
      return action.targetPieceId === undefined
        ? undefined
        : { kind: 'piece', pieceId: action.targetPieceId }
    case 'ride': {
      const vanguardId = ownVanguardPieceId(context.board)
      return vanguardId === undefined
        ? undefined
        : { kind: 'piece', pieceId: vanguardId }
    }
    case 'boost':
      return context.attackerPieceId === undefined
        ? undefined
        : { kind: 'piece', pieceId: context.attackerPieceId }
    default:
      return undefined
  }
}

function ownVanguardPieceId(board: MatchBoardProjection): string | undefined {
  const pieceId = board.currentSide?.zones.find(
    (zone) => zone.kind === 'vanguard_circle',
  )?.pieces[0]?.pieceId

  return pieceId === undefined ? undefined : (pieceId as string)
}
