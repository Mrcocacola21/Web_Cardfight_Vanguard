import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type { GameState, PieceId, PlayerId, ZoneId, ZoneSlotId } from '../index'
import {
  resolveBoardColumn,
  resolveBoardPositionForPiece,
  resolveBoostRelation,
} from '../index'

const PLAYER_1 = 'player-1' as PlayerId
const P1_VANGUARD = 'piece-p1-vanguard' as PieceId
const P1_FRONT_LEFT = 'piece-p1-front-left' as PieceId
const P1_BACK_LEFT = 'piece-p1-back-left' as PieceId
const P1_FRONT_RIGHT = 'piece-p1-front-right' as PieceId
const P1_BACK_CENTER = 'piece-p1-back-center' as PieceId
const ZONE_P1_VANGUARD = 'zone-p1-vanguard' as ZoneId
const ZONE_P1_REARGUARD = 'zone-p1-rearguard' as ZoneId

describe('board semantics foundation', () => {
  it('resolves vanguard, front-row, back-row, and columns deterministically', () => {
    const state = makeBoardState()

    expect(resolveBoardPositionForPiece(state, P1_VANGUARD)).toMatchObject({
      ok: true,
      position: {
        circleKind: 'vanguard',
        row: 'front',
        column: 'center',
        source: 'vanguard_circle',
      },
    })
    expect(resolveBoardPositionForPiece(state, P1_BACK_LEFT)).toMatchObject({
      ok: true,
      position: {
        circleKind: 'rear_guard',
        row: 'back',
        column: 'left',
        source: 'slot_id',
      },
    })

    const leftColumn = resolveBoardColumn(state, PLAYER_1, 'left')
    const centerColumn = resolveBoardColumn(state, PLAYER_1, 'center')

    expect(
      leftColumn.frontPositions.map((position) => position.pieceId),
    ).toEqual([P1_FRONT_LEFT])
    expect(
      leftColumn.backPositions.map((position) => position.pieceId),
    ).toEqual([P1_BACK_LEFT])
    expect(centerColumn.vanguardPosition?.pieceId).toBe(P1_VANGUARD)
    expect(
      centerColumn.backPositions.map((position) => position.pieceId),
    ).toEqual([P1_BACK_CENTER])
  })

  it('keeps boost relation tied to matching front/back column positions', () => {
    const state = makeBoardState()

    expect(
      resolveBoostRelation(state, P1_VANGUARD, P1_BACK_CENTER),
    ).toMatchObject({
      ok: true,
      column: 'center',
    })
    expect(
      resolveBoostRelation(state, P1_FRONT_LEFT, P1_BACK_LEFT),
    ).toMatchObject({
      ok: true,
      column: 'left',
    })
    expect(
      resolveBoostRelation(state, P1_FRONT_LEFT, P1_BACK_CENTER),
    ).toMatchObject({
      ok: false,
      issue: {
        code: 'unresolved_board_position',
      },
    })
    expect(
      resolveBoostRelation(state, P1_FRONT_LEFT, P1_FRONT_RIGHT),
    ).toMatchObject({
      ok: false,
      issue: {
        code: 'unresolved_board_position',
      },
    })
  })

  it('surfaces malformed rear-guard coordinates instead of guessing layout', () => {
    const state = makeBoardState({
      rearGuardSlotIds: ['slot-left' as ZoneSlotId],
      rearGuardOccupants: [
        {
          pieceId: P1_FRONT_LEFT,
          slotId: 'slot-left' as ZoneSlotId,
        },
      ],
    })

    expect(resolveBoardPositionForPiece(state, P1_FRONT_LEFT)).toMatchObject({
      ok: false,
      issue: {
        code: 'unresolved_board_position',
      },
    })
  })
})

function makeBoardState(
  options: {
    readonly rearGuardSlotIds?: readonly ZoneSlotId[]
    readonly rearGuardOccupants?: readonly GameState['zones'][number]['occupants'][number][]
  } = {},
): GameState {
  const rearGuardSlotIds =
    options.rearGuardSlotIds ??
    ([
      'p1:front-left',
      'p1:back-left',
      'p1:back-center',
      'p1:front-right',
      'p1:back-right',
    ] as ZoneSlotId[])
  const rearGuardOccupants =
    options.rearGuardOccupants ??
    ([
      {
        pieceId: P1_FRONT_LEFT,
        slotId: 'p1:front-left' as ZoneSlotId,
      },
      {
        pieceId: P1_BACK_LEFT,
        slotId: 'p1:back-left' as ZoneSlotId,
      },
      {
        pieceId: P1_BACK_CENTER,
        slotId: 'p1:back-center' as ZoneSlotId,
      },
      {
        pieceId: P1_FRONT_RIGHT,
        slotId: 'p1:front-right' as ZoneSlotId,
      },
    ] satisfies GameState['zones'][number]['occupants'])

  return {
    gameId: 'game-board-semantics' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status: 'in_progress',
    revision: 0,
    turn: {
      turnNumber: 1,
      turnPlayerId: PLAYER_1,
      phase: 'battle' as GameState['turn']['phase'],
    },
    players: [
      {
        playerId: PLAYER_1,
        seat: 0,
        status: 'active',
        ownedZoneIds: [ZONE_P1_VANGUARD, ZONE_P1_REARGUARD],
        counters: [],
        flags: [],
      },
    ],
    zones: [
      {
        zoneId: ZONE_P1_VANGUARD,
        kind: 'vanguard_circle',
        scope: 'player',
        ownerPlayerId: PLAYER_1,
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'single',
        },
        occupants: [{ pieceId: P1_VANGUARD }],
      },
      {
        zoneId: ZONE_P1_REARGUARD,
        kind: 'rear_guard_circle',
        scope: 'player',
        ownerPlayerId: PLAYER_1,
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'slotted',
          slotIds: rearGuardSlotIds,
        },
        occupants: rearGuardOccupants,
      },
    ],
    pieces: [
      makePiece(P1_VANGUARD),
      makePiece(P1_FRONT_LEFT),
      makePiece(P1_BACK_LEFT),
      makePiece(P1_FRONT_RIGHT),
      makePiece(P1_BACK_CENTER),
    ],
    pieceStates: [],
    flags: [],
    pendingRequests: [],
  }
}

function makePiece(pieceId: PieceId): GameState['pieces'][number] {
  return {
    pieceId,
    kind: 'card',
    ownerPlayerId: PLAYER_1,
    controllerPlayerId: PLAYER_1,
    cardDefinitionId: `${pieceId}:card` as CardId,
  }
}
