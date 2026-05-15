import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type { PieceId, PlayerId, ZoneId, ZoneSlotId } from '../contracts'

import type { GameState } from './state'
import { buildGameStateIndex } from './state-index'
import {
  findCurrentVanguardPiece,
  findOwnedZoneByKind,
  findPieceById,
  findPieceLocation,
  findPieceStateById,
  findPlayerById,
  findZoneById,
  listOwnedZonesByKind,
} from './state-queries'

const PLAYER_1 = 'player-index-1' as PlayerId
const PLAYER_2 = 'player-index-2' as PlayerId
const PIECE_VANGUARD = 'piece-index-vanguard' as PieceId
const PIECE_REARGUARD = 'piece-index-rearguard' as PieceId
const PIECE_HAND = 'piece-index-hand' as PieceId
const ZONE_VANGUARD = 'zone-index-vanguard' as ZoneId
const ZONE_REARGUARD = 'zone-index-rearguard' as ZoneId
const ZONE_HAND = 'zone-index-hand' as ZoneId
const ZONE_DROP = 'zone-index-drop' as ZoneId

describe('@web-vg/rules-core GameStateIndex', () => {
  it('builds canonical id and relation lookups over immutable GameState', () => {
    const state = makeIndexedState()
    const index = buildGameStateIndex(state)

    expect(index.state).toBe(state)
    expect(findPlayerById(index, PLAYER_1)?.seat).toBe(0)
    expect(findZoneById(index, ZONE_HAND)?.kind).toBe('hand')
    expect(findPieceById(index, PIECE_HAND)?.cardDefinitionId).toBe('card-hand')
    expect(findPieceStateById(index, PIECE_REARGUARD)).toMatchObject({
      pieceId: PIECE_REARGUARD,
      orientation: 'rest',
    })
    expect(findCurrentVanguardPiece(index, PLAYER_1)?.pieceId).toBe(
      PIECE_VANGUARD,
    )
    expect(findOwnedZoneByKind(index, PLAYER_1, 'hand')?.zoneId).toBe(ZONE_HAND)
    expect(
      listOwnedZonesByKind(index, PLAYER_1, 'rear_guard_circle').map(
        (zone) => zone.zoneId,
      ),
    ).toEqual([ZONE_REARGUARD])
  })

  it('resolves piece locations and preserves previous first-match semantics for malformed duplicates', () => {
    const state = makeIndexedState({
      duplicateHandOccupantInDrop: true,
      duplicatePieceRecord: true,
    })
    const index = buildGameStateIndex(state)
    const handLocation = findPieceLocation(index, PIECE_HAND)

    expect(handLocation).toMatchObject({
      piece: {
        pieceId: PIECE_HAND,
        cardDefinitionId: 'card-hand',
      },
      zone: {
        zoneId: ZONE_HAND,
      },
      occupant: {
        pieceId: PIECE_HAND,
      },
    })
  })

  it('reflects moved pieces after the caller rebuilds the index from the next state', () => {
    const state = makeIndexedState()
    const nextState: GameState = {
      ...state,
      zones: state.zones.map((zone) => {
        if (zone.zoneId === ZONE_HAND) {
          return {
            ...zone,
            occupants: [],
          }
        }

        if (zone.zoneId === ZONE_DROP) {
          return {
            ...zone,
            occupants: [{ pieceId: PIECE_HAND }],
          }
        }

        return zone
      }),
    }
    const nextIndex = buildGameStateIndex(nextState)

    expect(findPieceLocation(nextIndex, PIECE_HAND)?.zone.zoneId).toBe(
      ZONE_DROP,
    )
    expect(findOwnedZoneByKind(nextIndex, PLAYER_1, 'hand')?.occupants).toEqual(
      [],
    )
  })

  it('returns undefined or empty arrays for missing indexed relations', () => {
    const index = buildGameStateIndex(makeIndexedState())

    expect(findPlayerById(index, 'missing-player' as PlayerId)).toBeUndefined()
    expect(findZoneById(index, 'missing-zone' as ZoneId)).toBeUndefined()
    expect(findPieceById(index, 'missing-piece' as PieceId)).toBeUndefined()
    expect(findPieceLocation(index, 'missing-piece' as PieceId)).toBeUndefined()
    expect(listOwnedZonesByKind(index, PLAYER_2, 'damage')).toEqual([])
  })
})

function makeIndexedState(
  options: {
    readonly duplicateHandOccupantInDrop?: boolean
    readonly duplicatePieceRecord?: boolean
  } = {},
): GameState {
  return {
    gameId: 'game-index' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status: 'in_progress',
    revision: 7,
    turn: {
      turnNumber: 2,
      turnPlayerId: PLAYER_1,
      priorityPlayerId: PLAYER_1,
      phase: 'main' as GameState['turn']['phase'],
    },
    players: [
      {
        playerId: PLAYER_1,
        seat: 0,
        status: 'active',
        ownedZoneIds: [ZONE_VANGUARD, ZONE_REARGUARD, ZONE_HAND, ZONE_DROP],
        counters: [],
        flags: [],
      },
      {
        playerId: PLAYER_2,
        seat: 1,
        status: 'waiting',
        ownedZoneIds: [],
        counters: [],
        flags: [],
      },
    ],
    zones: [
      {
        zoneId: ZONE_VANGUARD,
        kind: 'vanguard_circle',
        scope: 'player',
        ownerPlayerId: PLAYER_1,
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'single',
        },
        occupants: [{ pieceId: PIECE_VANGUARD }],
      },
      {
        zoneId: ZONE_REARGUARD,
        kind: 'rear_guard_circle',
        scope: 'player',
        ownerPlayerId: PLAYER_1,
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'slotted',
          slotIds: ['p1:front-left' as ZoneSlotId],
        },
        occupants: [
          {
            pieceId: PIECE_REARGUARD,
            slotId: 'p1:front-left' as ZoneSlotId,
          },
        ],
      },
      {
        zoneId: ZONE_HAND,
        kind: 'hand',
        scope: 'player',
        ownerPlayerId: PLAYER_1,
        visibility: 'owner-private',
        layout: {
          ordering: 'unordered',
          occupancy: 'multi',
        },
        occupants: [{ pieceId: PIECE_HAND }],
      },
      {
        zoneId: ZONE_DROP,
        kind: 'drop',
        scope: 'player',
        ownerPlayerId: PLAYER_1,
        visibility: 'public',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: options.duplicateHandOccupantInDrop
          ? [{ pieceId: PIECE_HAND }]
          : [],
      },
    ],
    pieces: [
      makePiece(PIECE_VANGUARD, 'card-vanguard' as CardId),
      makePiece(PIECE_REARGUARD, 'card-rearguard' as CardId),
      makePiece(PIECE_HAND, 'card-hand' as CardId),
      ...(options.duplicatePieceRecord
        ? [makePiece(PIECE_HAND, 'card-hand-duplicate' as CardId)]
        : []),
    ],
    pieceStates: [
      {
        pieceId: PIECE_REARGUARD,
        orientation: 'rest',
        flags: [],
      },
    ],
    flags: [],
    pendingRequests: [],
  }
}

function makePiece(
  pieceId: PieceId,
  cardDefinitionId: CardId,
): GameState['pieces'][number] {
  return {
    pieceId,
    kind: 'card',
    ownerPlayerId: PLAYER_1,
    controllerPlayerId: PLAYER_1,
    cardDefinitionId,
  }
}
