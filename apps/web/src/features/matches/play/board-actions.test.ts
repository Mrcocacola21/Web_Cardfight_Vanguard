import { describe, expect, it } from 'vitest'

import type { ParticipantLegalAction } from '@web-vg/match-session'
import type { EngineCommand } from '@web-vg/rules-core'

import { buildBoardActionModel, resolveBoardAction } from './board-actions'
import type { MatchBoardProjection } from './zone-projection'

const command = {} as EngineCommand
const board = {
  currentSide: {
    zones: [{ kind: 'vanguard_circle', pieces: [{ pieceId: 'my-vanguard' }] }],
  },
} as unknown as MatchBoardProjection

const legal = (
  entry: Omit<ParticipantLegalAction, 'command' | 'label'>,
): ParticipantLegalAction =>
  ({ ...entry, label: entry.id, command }) as ParticipantLegalAction

const ACTIONS: readonly ParticipantLegalAction[] = [
  legal({
    id: 'call-a-left',
    kind: 'call',
    pieceId: 'hand-a' as never,
    slotId: 'front-left' as never,
  }),
  legal({
    id: 'call-a-right',
    kind: 'call',
    pieceId: 'hand-a' as never,
    slotId: 'front-right' as never,
  }),
  legal({ id: 'ride-a', kind: 'ride', pieceId: 'hand-a' as never }),
  legal({ id: 'act-a', kind: 'activate', pieceId: 'hand-a' as never }),
  legal({
    id: 'attack-v',
    kind: 'attack',
    pieceId: 'my-vanguard' as never,
    targetPieceId: 'foe-vg' as never,
  }),
  legal({ id: 'boost-r', kind: 'boost', pieceId: 'my-rear' as never }),
  legal({ id: 'end', kind: 'end_phase' }),
]

describe('board actions', () => {
  it('marks every card that starts an action as a source, with no targets until one is selected', () => {
    const model = buildBoardActionModel({ legalActions: ACTIONS, board })

    expect([...model.sourcePieceIds].sort()).toEqual(
      ['hand-a', 'my-rear', 'my-vanguard'].sort(),
    )
    expect(model.targetPieceIds.size).toBe(0)
    expect(model.targetSlotIds.size).toBe(0)
  })

  it('highlights open circles and the vanguard for a selected hand card, and lists all its actions', () => {
    const model = buildBoardActionModel({
      legalActions: ACTIONS,
      board,
      selectedSourcePieceId: 'hand-a',
    })

    expect([...model.targetSlotIds].sort()).toEqual([
      'front-left',
      'front-right',
    ])
    expect([...model.targetPieceIds]).toEqual(['my-vanguard'])
    expect(model.selectedActions.map((action) => action.id)).toEqual([
      'call-a-left',
      'call-a-right',
      'ride-a',
      'act-a',
    ])
  })

  it('resolves card-onto-target into the matching legal action only', () => {
    const resolve = (
      sourcePieceId: string,
      target: Parameters<typeof resolveBoardAction>[0]['target'],
    ) =>
      resolveBoardAction({
        legalActions: ACTIONS,
        board,
        attackerPieceId: 'my-vanguard',
        sourcePieceId,
        target,
      })?.id

    expect(resolve('hand-a', { kind: 'slot', slotId: 'front-right' })).toBe(
      'call-a-right',
    )
    expect(resolve('hand-a', { kind: 'piece', pieceId: 'my-vanguard' })).toBe(
      'ride-a',
    )
    expect(resolve('my-vanguard', { kind: 'piece', pieceId: 'foe-vg' })).toBe(
      'attack-v',
    )
    expect(resolve('my-rear', { kind: 'piece', pieceId: 'my-vanguard' })).toBe(
      'boost-r',
    )
    // Not legal: no such pairing in the server list.
    expect(
      resolve('hand-a', { kind: 'slot', slotId: 'back-center' }),
    ).toBeUndefined()
    expect(
      resolve('my-vanguard', { kind: 'piece', pieceId: 'hand-a' }),
    ).toBeUndefined()
  })
})
